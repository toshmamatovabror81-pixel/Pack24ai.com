import { readdirSync, readFileSync } from 'node:fs';
import type { Prisma } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_TESTS, prisma, waitForBlocked } from './helpers';
import type { InlineKeyboard } from '@/lib/telegram/api';

/**
 * Xabarnomalar navbati (BotOutbox) haqiqiy PostgreSQL bilan: ikki tick bir vaqtda ishlaganda xabar ikki marta ketmasligi
 * (shartli UPDATE), urinishlar hisobi, mavzu bo'yicha eskirgan xabarni bekor qilish, oluvchini qayta tekshirish, tokeni yo'q
 * bot navbatni to'smasligi, navbat holati, tozalash va matn/tugmalarning jadval orqali o'zgarishsiz o'tishi.
 * notify.ts, outbox.ts, api.ts, staffLink.ts, customers.ts va orderNotify.ts haqiqiy — faqat tarmoq (fetch) almashtiriladi.
 *
 * Navbat butun bazaga bitta: flushOutbox() vaqti kelgan HAR QANDAY qatorni oladi, oluvchisi uzilganini va eskilarini o'chiradi.
 * Boshqa test fayllari parallel ishlaydi (runTick ham navbatni yuboradi, Telegram "ishlamayotgan" testlar esa unga qator
 * qoldiradi), shuning uchun bu fayl umumiy jadvallarga tegmaydi: shu bazaning ichida o'z sxemasini ochadi va migratsiyalarni
 * o'sha yerga qaytadan bajaradi — navbat oluvchini User, TelegramCustomer va Order jadvallaridan tekshiradi, ular ham (enum
 * turlari bilan birga) aynan ishchi bazadagidek bo'lishi kerak. Prisma manzildagi `?schema=` orqali shu sxemaga qaraydi —
 * himoya (P24_DB_TESTS=1 va faqat mahalliy baza) o'zgarmaydi, chunki host o'sha.
 */
const scope = vi.hoisted(() => {
  const SCHEMA = 'p24_outbox_test';
  const original = process.env.DATABASE_URL;
  // Importlardan oldin bajariladi: prisma mijozi (lib/db.ts) yaratilganda manzil allaqachon o'z sxemamizni ko'rsatadi
  if (process.env.P24_DB_TESTS === '1' && original) {
    try {
      const u = new URL(original);
      u.searchParams.set('schema', SCHEMA);
      process.env.DATABASE_URL = u.toString();
    } catch {
      // yaroqsiz manzil: helpers.ts dagi himoya uni birorta so'rov ketmasidan rad etadi
    }
  }
  return { SCHEMA, original };
});

vi.mock('server-only', () => ({}));
// Haqiqiy getSettings next/cache ga tayanadi; orderNotify undan faqat "bekor qilindi" xabaridagi telefon uchun foydalanadi
vi.mock('@/lib/settings', async () => (await import('./helpers')).settingsMock());

const { flushOutbox, outboxStats, supersede, supersedePrefix, OUTBOX_MAX_ATTEMPTS } = await import('@/lib/telegram/outbox');
const { notify, notifyCustomer, notifyStaff } = await import('@/lib/telegram/notify');
const { unlinkCustomer } = await import('@/lib/telegram/customers');
const { unlinkStaff } = await import('@/lib/telegram/staffLink');
const { notifyCustomerOrderStatus, notifyCustomerPaid, notifyCustomerProduction } = await import('@/lib/orderNotify');

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// Jadvallar faqat shu faylniki, shuning uchun vaqt o'ylab topilgan: ticklar shu sanadan sanaladi
const T0 = new Date('2031-05-05T04:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const NONE = { sent: 0, retry: 0, failed: 0 };
/** Yangi xabar o'rnini bosgan navbat yozuvining belgisi va tokeni qaytmagan bot xabarining xatosi (outbox.ts) */
const SUPERSEDED = 'eskirgan';
const NO_TOKEN = "bot tokeni yo'q";
const STATUS = 'order-status:15';

const CUSTOMER = '111:customer';
const STAFF = '222:staff';
const KB: InlineKeyboard = [
  [{ text: '📦 Batafsil', callback_data: 'o_15' }, { text: 'To\'landi ✅', callback_data: 'op_15' }],
  [{ text: 'Hisob-faktura / Счёт', url: 'https://pack24.uz/uz/orders/abc/invoice?print=1&lang=uz' }],
];

/**
 * Migratsiya faylini alohida buyruqlarga ajratadi (Prisma bitta so'rovda bitta buyruq bajaradi): ';' bo'yicha, lekin
 * satr ('...'), nom ("..."), $$ ... $$ blok va izoh ichidagi ';' hisobga olinmaydi.
 */
function statements(sql: string): string[] {
  const out: string[] = [];
  const skipTo = (end: string, from: number) => {
    const j = sql.indexOf(end, from);
    return j === -1 ? sql.length : j + end.length;
  };
  let start = 0;
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') i = skipTo('\n', i);
    else if (c === '/' && sql[i + 1] === '*') i = skipTo('*/', i + 2);
    else if (c === '\'' || c === '"') i = skipTo(c, i + 1);
    else if (c === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i, i + 64))?.[0];
      i = tag ? skipTo(tag, i + tag.length) : i + 1;
    } else if (c === ';') {
      out.push(sql.slice(start, i));
      i += 1;
      start = i;
    } else i += 1;
  }
  out.push(sql.slice(start));
  // Faqat izohdan iborat bo'lak buyruq emas
  return out.map((s) => s.trim()).filter((s) => s.replace(/--.*$/gm, '').trim());
}

const MIGRATIONS = new URL('../../../../prisma/migrations/', import.meta.url);

// ─── Soxta Telegram ──────────────────────────────────────────────────────────
type Sent = { token: string; chat: string; text: string; mode?: string; inline?: InlineKeyboard };
const OK = () => new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
const tgError = (code: number, description: string, retryAfter?: number) => () =>
  new Response(JSON.stringify({ ok: false, error_code: code, description, ...(retryAfter === undefined ? {} : { parameters: { retry_after: retryAfter } }) }), { status: code });
const offline = (): never => {
  throw new TypeError('fetch failed');
};
const BLOCKED = tgError(403, 'Forbidden: bot was blocked by the user');
/**
 * delayMs — har bir so'rov shuncha kutadi (parallel ticklar bir-birining orasiga kirib ulgursin);
 * during — so'rov "yo'lda" bo'lgan paytda bajariladi (Telegram javobini kutayotganda bazada nimadir o'zgaradi)
 */
const net = { sent: [] as Sent[], delayMs: 0, reply: OK as (m: Sent) => Response, during: null as ((m: Sent) => Promise<unknown>) | null };
const chats = () => net.sent.map((m) => m.chat);
const via = () => net.sent.map((m) => `${m.token} ${m.chat}`);
/** Har bir oluvchiga necha marta yuborilgani */
const perChat = () => net.sent.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.chat]: (acc[m.chat] ?? 0) + 1 }), {});

describe.skipIf(!DB_TESTS)('xabarnomalar navbati (haqiqiy baza)', { timeout: 30_000 }, () => {
  type NewRow = Partial<Omit<Prisma.BotOutboxUncheckedCreateInput, 'inline'>> & { inline?: InlineKeyboard };
  let seq = 0;
  /** Boshqaruv botiga ulangan faol xodim, xabarnomasi yoniq */
  const staff = (telegramId: string | null, data: Partial<Prisma.UserUncheckedCreateInput> = {}) => {
    seq += 1;
    return prisma.user.create({ data: { name: `Xodim ${seq}`, phone: `9989011${String(seq).padStart(5, '0')}`, passwordHash: '-', role: 'manager', telegramId, ...data } });
  };
  /** Mijoz botidan foydalanuvchi, xabarnomasi yoniq */
  const customer = (telegramId: string, data: Partial<Prisma.TelegramCustomerUncheckedCreateInput> = {}) => prisma.telegramCustomer.create({ data: { telegramId, ...data } });
  const order = (data: Partial<Prisma.OrderUncheckedCreateInput> = {}) =>
    prisma.order.create({ data: { status: 'processing', totalAmount: 250000, paymentMethod: 'cash', deliveryMethod: 'courier', customerName: 'Test mijoz', source: 'web', ...data } });
  /** Oluvchi "hali ham o'zimizniki" bo'lishi uchun (bo'lsa qayta yaratilmaydi): mijoz botida — mijoz yozuvi, boshqaruv botida — ulangan xodim */
  const known = async (bot: string, chatId: string) => {
    if (bot === 'customer') await prisma.telegramCustomer.upsert({ where: { telegramId: chatId }, create: { telegramId: chatId }, update: {} });
    else if (bot === 'staff' && !(await prisma.user.count({ where: { telegramId: chatId } }))) await staff(chatId);
  };
  /**
   * Navbatdagi xabar: standart — mijoz boti, mavzusiz, 1 ta urinish bo'lgan, vaqti bir daqiqa oldin kelgan.
   * Oluvchisi ham yaratiladi; `recipient: false` — yaratilmaydi (oluvchi tekshiruvi testlari o'zi belgilaydi).
   */
  const add = async ({ inline, ...data }: NewRow = {}, recipient = true) => {
    const row = await prisma.botOutbox.create({ data: { bot: 'customer', chatId: '777', html: 'xabar', nextAt: at(-MIN), createdAt: at(-6 * MIN), lastError: 'fetch failed', ...data, inline: inline as Prisma.InputJsonValue | undefined } });
    if (recipient) await known(row.bot, row.chatId);
    return row;
  };
  const all = () => prisma.botOutbox.findMany({ orderBy: { id: 'asc' } });
  const one = (id: number) => prisma.botOutbox.findUniqueOrThrow({ where: { id } });
  const idsOf = async () => (await all()).map((r) => r.id);
  /** Har bir qator qisqa ko'rinishda: kim, qaysi mavzu va hozirgi holati */
  const states = async () => (await all()).map((r) => `${r.bot} ${r.chatId} ${r.topic ?? '-'} ${r.sentAt ? 'yetkazildi' : r.failedAt ? r.lastError : 'kutyapti'}`);

  beforeAll(async () => {
    // Uzilib qolgan oldingi ishga tushirishdan qolgan bo'lsa — qaytadan
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${scope.SCHEMA}" CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${scope.SCHEMA}"`);
    // Xavfsizlik to'ri: mijoz o'z sxemamizga qaramayotgan bo'lsa (masalan, prisma boshqa fayl bilan umumiy bo'lib qolsa) umumiy
    // jadvallarga tegmasdan to'xtaymiz — quyidagi testlar navbat, xodim, mijoz va buyurtma jadvallarini har safar tozalaydi
    const [{ current }] = await prisma.$queryRaw<{ current: string | null }[]>`SELECT current_schema()::text AS current`;
    if (current !== scope.SCHEMA) throw new Error(`Prisma "${scope.SCHEMA}" sxemasiga emas, "${current}" ga qarayapti — test to'xtatildi`);
    // Papkalar Prisma qo'llaydigan tartibda (nomi bo'yicha). Buyruqlarda sxema nomi yozilmagan, shuning uchun hammasi o'z sxemamizda yaratiladi
    const dirs = readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    for (const dir of dirs) {
      for (const sql of statements(readFileSync(new URL(`${dir}/migration.sql`, MIGRATIONS), 'utf8'))) {
        if (/\bpublic\s*\.|search_path/i.test(sql)) throw new Error(`${dir}: migratsiyada sxema nomi ochiq yozilgan — alohida sxemada bajarilsa umumiy jadvallarga tegardi; bu test faylini moslang`);
        await prisma.$executeRawUnsafe(sql);
      }
    }
    // Nusxa to'liq: navbat va oluvchi tekshiruvi o'qiydigan jadvallar o'z sxemamizda bor
    const tables = await prisma.$queryRaw<{ name: string }[]>`SELECT table_name::text AS name FROM information_schema.tables WHERE table_schema = ${scope.SCHEMA} AND table_name IN ('BotOutbox', 'User', 'TelegramCustomer', 'Order') ORDER BY 1`;
    expect(tables.map((t) => t.name)).toEqual(['BotOutbox', 'Order', 'TelegramCustomer', 'User']);
  }, 120_000);
  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${scope.SCHEMA}" CASCADE`);
    await prisma.$disconnect();
    if (scope.original !== undefined) process.env.DATABASE_URL = scope.original;
  });
  beforeEach(async () => {
    await prisma.botOutbox.deleteMany();
    await prisma.order.deleteMany();
    await prisma.telegramCustomer.deleteMany();
    await prisma.user.deleteMany();
    Object.assign(net, { delayMs: 0, reply: OK, during: null });
    net.sent.length = 0;
    vi.stubEnv('TELEGRAM_API_BASE', '');
    vi.stubEnv('CUSTOMER_BOT_TOKEN', CUSTOMER);
    vi.stubEnv('STAFF_BOT_TOKEN', STAFF);
    vi.stubEnv('SUPERVISOR_BOT_TOKEN', '');
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { chat_id?: unknown; text?: string; parse_mode?: string; reply_markup?: { inline_keyboard?: InlineKeyboard } };
      const m: Sent = { token: /\/bot([^/]+)\/sendMessage$/.exec(String(url))?.[1] ?? String(url), chat: String(body.chat_id), text: String(body.text), mode: body.parse_mode, inline: body.reply_markup?.inline_keyboard };
      net.sent.push(m);
      if (net.delayMs) await new Promise((resolve) => setTimeout(resolve, net.delayMs));
      await net.during?.(m);
      return net.reply(m);
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('navbatga tushish', () => {
    it('notify: vaqtincha xatoda xabar jadvalga yoziladi (5 daqiqadan keyin qayta urinish uchun); doimiy xato va yetib borgan xabar yozilmaydi', async () => {
      net.reply = offline;
      const before = Date.now();
      expect(await notify('staff', 5123456789, '<b>Yangi buyurtma #15</b>', KB)).toBe(false);
      expect(await notifyCustomer('777000111', 'Buyurtmangiz qabul qilindi')).toBe(false);
      const after = Date.now();
      net.reply = BLOCKED;
      expect(await notifyCustomer('777000112', 'bloklagan mijozga')).toBe(false);
      net.reply = OK;
      expect(await notifyStaff('900000113', 'yetib boradi')).toBe(true);

      const rows = await all();
      expect(rows.map(({ bot, chatId, topic, html, inline, attempts, lastError, sentAt, failedAt }) => ({ bot, chatId, topic, html, inline, attempts, lastError, sentAt, failedAt }))).toEqual([
        { bot: 'staff', chatId: '5123456789', topic: null, html: '<b>Yangi buyurtma #15</b>', inline: KB, attempts: 1, lastError: 'fetch failed', sentAt: null, failedAt: null },
        { bot: 'customer', chatId: '777000111', topic: null, html: 'Buyurtmangiz qabul qilindi', inline: null, attempts: 1, lastError: 'fetch failed', sentAt: null, failedAt: null },
      ]);
      for (const r of rows) {
        expect(r.nextAt.getTime()).toBeGreaterThanOrEqual(before + 5 * MIN);
        expect(r.nextAt.getTime()).toBeLessThanOrEqual(after + 5 * MIN);
        // Yaratilgan vaqt — hozir (bir necha soniya farq bilan: uni Prisma yoki baza qo'yadi)
        expect(Math.abs(r.createdAt.getTime() - before)).toBeLessThan(10_000);
      }
      expect(await outboxStats()).toEqual({ pending: 2, stuck: 0, failed24h: 0 });
    });

    it('4000 belgili matn, havola/callback tugmalari va mavzu jadval orqali o\'zgarishsiz o\'tadi: qayta yuborilgan so\'rov birinchisi bilan bir xil', async () => {
      const head = '🧾 <b>Buyurtma #15</b> — «Ҳисоб-фактура» & \'счёт\' <i>готов</i>\n\tSumma: 1 500 000 so\'m; 100% \\ {"json": "yo\'q"} <a href="https://pack24.uz/?a=1&amp;b=2">havola</a>\n';
      const fill = 4000 - head.length;
      const html = head + 'Ж😀ў'.repeat(Math.floor(fill / 4)) + '.'.repeat(fill % 4);
      const topic = 'order-production:15:Гофра «quti» 30x20 <b> \'😀\'';
      expect(html).toHaveLength(4000);
      expect(html.isWellFormed()).toBe(true);
      await customer('-1001234567890');

      net.reply = offline;
      expect(await notify('customer', -1001234567890, html, KB, {}, topic)).toBe(false);
      const [first] = net.sent;
      const [queued, ...rest] = await all();
      expect(rest).toEqual([]);
      expect(queued.html).toBe(html);
      expect(queued.inline).toEqual(KB);
      expect(queued.chatId).toBe('-1001234567890');
      expect(queued.topic).toBe(topic);

      net.reply = OK;
      expect(await flushOutbox(queued.nextAt)).toEqual({ sent: 1, retry: 0, failed: 0 });
      const [, retried, ...extra] = net.sent;
      expect(extra).toEqual([]);
      expect(retried.text).toBe(html);
      expect(retried).toEqual({ token: CUSTOMER, chat: '-1001234567890', text: html, mode: 'HTML', inline: KB });
      expect(retried).toEqual(first);
      expect(await one(queued.id)).toMatchObject({ attempts: 2, sentAt: queued.nextAt, failedAt: null, lastError: null, html, inline: KB, topic });
    });
  });

  describe('poyga: bir vaqtda ishlagan ticklar', () => {
    /**
     * Ikkala ish ham navbat qatoriga yetib kelgandagina qo'yib yuboriladi: qatorlarni qulflab turamiz va bazada ikkita so'rov shu
     * qulfni kutayotganini ko'rgach bo'shatamiz. Shunda ikkalasining qo'lida ham eski holat ("hali hech kim olmagan") bo'lishi
     * tasodifga qolmaydi. Tartib ham aniq: `first` qulfga birinchi yetib keladi va qulf bo'shagach birinchi bo'lib o'tadi.
     */
    const locked = async <A, B>(first: () => Promise<A>, second: () => Promise<B>): Promise<[A, B]> => {
      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "BotOutbox" FOR UPDATE`;
          const a = first();
          // Xatosi quyida Promise.all orqali chiqadi; ungacha "ushlanmagan xato" bo'lib ko'rinmasin
          a.catch(() => undefined);
          // Kutish muddati kattaroq: butun to'plam parallel ishlaganda (CI) ikkinchi so'rov qulfgacha sekinroq yetib kelishi mumkin
          await waitForBlocked(tx, 1, 12_000);
          const both = Promise.all([a, second()]);
          await waitForBlocked(tx, 2, 12_000);
          return { both };
        },
        { timeout: 28_000 },
      );
      return held.both;
    };
    /** Ikki tick bir vaqtda: ikkalasi ham ro'yxatni o'qib, birinchi xabarni "band qilish"ga (yoki o'chirishga) yetib kelgan */
    const race = (now: Date) => locked(() => flushOutbox(now), () => flushOutbox(now));

    it('ikki tick bir vaqtda: vaqti kelgan har bir xabar aynan bir marta yuboriladi', async () => {
      const due = [];
      for (let i = 0; i < 12; i += 1) due.push(await add({ bot: i % 3 ? 'customer' : 'staff', chatId: `c${i}`, html: `xabar ${i}`, inline: i % 2 ? KB : undefined, attempts: 1 + (i % 4), topic: i % 5 ? null : `order-status:${i}` }));
      const later = await add({ chatId: 'later', nextAt: at(1) });
      net.delayMs = 5;

      const [a, b] = await race(T0);

      expect(perChat()).toEqual(Object.fromEntries(due.map((r) => [r.chatId, 1])));
      expect(a.sent + b.sent).toBe(due.length);
      expect({ retry: a.retry + b.retry, failed: a.failed + b.failed }).toEqual({ retry: 0, failed: 0 });
      // Har bir xabar o'z boti orqali, o'z matni va tugmalari bilan
      for (const r of due) {
        expect(net.sent.find((m) => m.chat === r.chatId)).toEqual({ token: r.bot === 'staff' ? STAFF : CUSTOMER, chat: r.chatId, text: r.html, mode: 'HTML', inline: r.inline ?? undefined });
        // Urinish ham bir marta sanalgan
        expect(await one(r.id)).toMatchObject({ attempts: r.attempts + 1, sentAt: T0, failedAt: null, lastError: null });
      }
      expect(await one(later.id)).toEqual(later);
    });

    it('ikki tick bir vaqtda va Telegram ishlamayapti: har bir xabarga bittadan urinish sanaladi, oxirgi urinishi bo\'lgani bir marta "yuborilmadi" bo\'ladi', async () => {
      const due = [];
      for (let i = 0; i < 8; i += 1) due.push(await add({ chatId: `c${i}`, attempts: 1 }));
      const last = await add({ chatId: 'last', attempts: OUTBOX_MAX_ATTEMPTS - 1 });
      net.delayMs = 5;
      net.reply = offline;

      const [a, b] = await race(T0);

      expect(perChat()).toEqual(Object.fromEntries([...due, last].map((r) => [r.chatId, 1])));
      expect({ sent: a.sent + b.sent, retry: a.retry + b.retry, failed: a.failed + b.failed }).toEqual({ sent: 0, retry: due.length, failed: 1 });
      for (const r of due) expect(await one(r.id)).toMatchObject({ attempts: 2, nextAt: at(15 * MIN), sentAt: null, failedAt: null, lastError: 'fetch failed' });
      expect(await one(last.id)).toMatchObject({ attempts: OUTBOX_MAX_ATTEMPTS, sentAt: null, failedAt: T0 });
    });

    it('ikki tick bir vaqtda, ba\'zi oluvchilar uzilgan: ularning xabari yuborilmaydi va o\'chadi, qolganlari aynan bir martadan ketadi', async () => {
      const gone: number[] = [];
      const due: { id: number; chatId: string }[] = [];
      // Juft o'rindagilarning oluvchisi yo'q (navbat boshidagisi ham): mijoz va boshqaruv botida ikkitadan-uchtadan
      for (let i = 0; i < 10; i += 1) {
        const r = await add({ bot: i % 4 < 2 ? 'customer' : 'staff', chatId: `c${i}` }, i % 2 === 1);
        if (i % 2) due.push(r);
        else gone.push(r.id);
      }
      net.delayMs = 5;

      const [a, b] = await race(T0);

      expect(perChat()).toEqual(Object.fromEntries(due.map((r) => [r.chatId, 1])));
      expect({ sent: a.sent + b.sent, retry: a.retry + b.retry, failed: a.failed + b.failed }).toEqual({ sent: due.length, retry: 0, failed: 0 });
      expect(await idsOf()).toEqual(due.map((r) => r.id));
      expect([gone.length, await prisma.botOutbox.count({ where: { id: { in: gone } } })]).toEqual([5, 0]);
      expect(await outboxStats(T0)).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
    });

    it('yangi holat (supersede) tick\'dan oldin ulgursa: ro\'yxatni o\'qib bo\'lgan tick ham eski holatni band qilmaydi va yubormaydi', async () => {
      const stale = await add({ chatId: '777', topic: STATUS, html: 'Holati: Yo\'lda' });
      const other = await add({ chatId: '778', topic: STATUS, html: 'boshqa oluvchi' });

      const [, tick] = await locked(() => supersede('customer', '777', STATUS, at(1000)), () => flushOutbox(T0));

      expect(perChat()).toEqual({ 778: 1 });
      expect(tick).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect(await one(stale.id)).toEqual({ ...stale, failedAt: at(1000), lastError: SUPERSEDED });
      expect(await one(other.id)).toMatchObject({ attempts: 2, sentAt: T0, failedAt: null, lastError: null });
      expect(await flushOutbox(at(DAY))).toEqual(NONE);
      expect(await outboxStats(at(HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
    });

    it('tick band qilib ulgurgandan keyin kelgan yangi holat (supersede): eski holat bir marta ketadi, lekin "yetkazildi"ga qaytarilmaydi', async () => {
      const stale = await add({ chatId: '777', topic: STATUS, html: 'Holati: Yo\'lda' });
      const other = await add({ chatId: '778', topic: STATUS, html: 'boshqa oluvchi' });
      // Yuborish sekin: tick Telegram javobini kutayotganda bekor qilish yozib bo'linadi
      net.delayMs = 60;

      const [tick] = await locked(() => flushOutbox(T0), () => supersede('customer', '777', STATUS, at(1000)));

      expect(perChat()).toEqual({ 777: 1, 778: 1 });
      expect(tick).toEqual({ sent: 2, retry: 0, failed: 0 });
      expect(await one(stale.id)).toMatchObject({ attempts: 2, sentAt: null, failedAt: at(1000), lastError: SUPERSEDED });
      expect(await one(other.id)).toMatchObject({ attempts: 2, sentAt: T0, failedAt: null, lastError: null });
      // Keyingi ticklarda ham qayta yuborilmaydi
      expect(await flushOutbox(at(DAY))).toEqual(NONE);
      expect(perChat()).toEqual({ 777: 1, 778: 1 });
      expect(await outboxStats(at(HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
    });

    it('ketma-ket kelgan ikkinchi tick birinchisi ulgurmagan xabarlarnigina oladi', async () => {
      for (let i = 0; i < 6; i += 1) await add({ chatId: `c${i}` });
      // Birinchi tick sekin Telegram bilan ishlayotgan paytda ikkinchisi boshlanadi (qulfsiz, tabiiy poyga)
      net.delayMs = 30;
      const first = flushOutbox(T0);
      await new Promise((resolve) => setTimeout(resolve, 45));
      const second = flushOutbox(T0);
      const [a, b] = await Promise.all([first, second]);

      expect(perChat()).toEqual({ c0: 1, c1: 1, c2: 1, c3: 1, c4: 1, c5: 1 });
      expect(a.sent + b.sent).toBe(6);
      expect((await all()).every((r) => r.attempts === 2 && r.sentAt?.getTime() === T0.getTime())).toBe(true);
    });
  });

  describe('urinishlar hisobi: har 5 daqiqada tick', () => {
    /** Navbatga tushgan paytdan boshlab 5 daqiqalik ticklar; qaysi daqiqalarda Telegram'ga so'rov ketganini qaytaradi */
    const ticks = async (t0: number, untilMin: number, onTick?: (minute: number) => void) => {
      const attemptsAt: number[] = [];
      const total = { ...NONE };
      for (let minute = 5; minute <= untilMin; minute += 5) {
        onTick?.(minute);
        const before = net.sent.length;
        const r = await flushOutbox(new Date(t0 + minute * MIN));
        for (let i = before; i < net.sent.length; i += 1) attemptsAt.push(minute);
        total.sent += r.sent;
        total.retry += r.retry;
        total.failed += r.failed;
      }
      return { attemptsAt, total };
    };

    it('Telegram uzoq ishlamasa: 5, 20, 80, 260 va 980-daqiqada qayta uriniladi, shundan keyin xabar "yuborilmadi" bo\'ladi', async () => {
      await customer('777');
      net.reply = offline;
      expect(await notify('customer', '777', 'Buyurtmangiz yo\'lda', KB)).toBe(false);
      const [queued] = await all();
      const t0 = queued.nextAt.getTime() - 5 * MIN;

      const { attemptsAt, total } = await ticks(t0, 20 * 60);
      // Oraliqlar: 5 daq, 15 daq, 1 soat, 3 soat, 12 soat
      expect(attemptsAt).toEqual([5, 20, 80, 260, 980]);
      expect(total).toEqual({ sent: 0, retry: 4, failed: 1 });
      expect(net.sent).toHaveLength(OUTBOX_MAX_ATTEMPTS);
      expect(net.sent.every((m) => m.chat === '777' && m.text === 'Buyurtmangiz yo\'lda' && m.token === CUSTOMER)).toBe(true);
      expect(await one(queued.id)).toMatchObject({ attempts: OUTBOX_MAX_ATTEMPTS, sentAt: null, failedAt: new Date(t0 + 980 * MIN), lastError: 'fetch failed' });
      expect(await outboxStats(new Date(t0 + 20 * HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 1 });

      // Telegram tiklangandan keyin ham "yuborilmadi" bo'lgan xabar qayta yuborilmaydi
      net.reply = OK;
      expect(await flushOutbox(new Date(t0 + 2 * DAY))).toEqual(NONE);
      expect(net.sent).toHaveLength(OUTBOX_MAX_ATTEMPTS);
    });

    it('har bir urinishdan keyingi holat: urinish soni, keyingi vaqt va oxirgi xato jadvalda', async () => {
      const r = await add({ chatId: '777', nextAt: at(5 * MIN), createdAt: T0, lastError: 'fetch failed' });
      net.reply = tgError(502, 'Bad Gateway');
      const seen = [];
      for (const minute of [5, 20, 80, 260, 980]) {
        // Vaqti kelishidan bir lahza oldin tegilmaydi
        expect(await flushOutbox(at(minute * MIN - 1))).toEqual(NONE);
        await flushOutbox(at(minute * MIN));
        const { attempts, nextAt, failedAt, sentAt, lastError } = await one(r.id);
        seen.push({ attempts, nextMin: (nextAt.getTime() - T0.getTime()) / MIN, failed: failedAt?.getTime() === at(minute * MIN).getTime(), sentAt, lastError });
      }
      const pending = { failed: false, sentAt: null, lastError: 'Telegram sendMessage: 502 Bad Gateway' };
      expect(seen.slice(0, 4)).toEqual([
        { attempts: 2, nextMin: 20, ...pending },
        { attempts: 3, nextMin: 80, ...pending },
        { attempts: 4, nextMin: 260, ...pending },
        { attempts: 5, nextMin: 980, ...pending },
      ]);
      expect(seen[4]).toMatchObject({ attempts: 6, failed: true, sentAt: null });
      expect(net.sent).toHaveLength(5);
    });

    it('Telegram yarim soatdan keyin tiklansa: xabar navbatdagi urinishda yetib boradi va boshqa yuborilmaydi', async () => {
      await staff('900');
      net.reply = offline;
      expect(await notifyStaff('900', '<b>Yangi buyurtma #15</b>', KB)).toBe(false);
      const [queued] = await all();
      const t0 = queued.nextAt.getTime() - 5 * MIN;

      const { attemptsAt, total } = await ticks(t0, 6 * 60, (minute) => {
        net.reply = minute < 30 ? offline : OK;
      });
      // 5 va 20-daqiqadagi urinishlar o'tmadi, 80-daqiqadagisi yetib bordi
      expect(attemptsAt).toEqual([5, 20, 80]);
      expect(total).toEqual({ sent: 1, retry: 2, failed: 0 });
      expect(net.sent.at(-1)).toEqual({ token: STAFF, chat: '900', text: '<b>Yangi buyurtma #15</b>', mode: 'HTML', inline: KB });
      expect(await one(queued.id)).toMatchObject({ attempts: 4, sentAt: new Date(t0 + 80 * MIN), failedAt: null, lastError: null });
    });

    it('429: Telegram so\'ragan vaqt (retry_after) navbatdagi bosqichdan uzoq bo\'lsa, undan oldin urinilmaydi', async () => {
      const r = await add({ chatId: '777' });
      net.reply = tgError(429, 'Too Many Requests: retry after 7200', 7200);
      expect(await flushOutbox(T0)).toEqual({ sent: 0, retry: 1, failed: 0 });
      expect(await one(r.id)).toMatchObject({ attempts: 2, nextAt: at(2 * HOUR), failedAt: null, lastError: 'Telegram sendMessage: 429 Too Many Requests: retry after 7200' });

      net.reply = OK;
      expect(await flushOutbox(at(2 * HOUR - 1))).toEqual(NONE);
      expect(await flushOutbox(at(2 * HOUR))).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect(chats()).toEqual(['777', '777']);
    });

    it('qayta urinishda doimiy xato (bot bloklangan): darhol "yuborilmadi", qolgan urinishlar sarflanmaydi', async () => {
      const r = await add({ chatId: '777' });
      net.reply = BLOCKED;
      expect(await flushOutbox(T0)).toEqual({ sent: 0, retry: 0, failed: 1 });
      expect(await one(r.id)).toMatchObject({ attempts: 2, failedAt: T0, sentAt: null, lastError: 'Telegram sendMessage: 403 Forbidden: bot was blocked by the user' });
      net.reply = OK;
      expect(await flushOutbox(at(DAY))).toEqual(NONE);
      expect(chats()).toEqual(['777']);
    });
  });

  describe('bot tokeni yo\'q', () => {
    it('bot tokeni olib tashlangan: xabar navbatda qoladi va urinish sarflanmaydi, token qaytgach yuboriladi', async () => {
      const queued = await add({ bot: 'staff', chatId: '900', attempts: 3 });
      const mine = await add({ chatId: '777' });
      vi.stubEnv('STAFF_BOT_TOKEN', '');

      expect(await flushOutbox(T0)).toEqual({ sent: 1, retry: 0, failed: 0 });
      for (let i = 1; i <= 6; i += 1) expect(await flushOutbox(at(i * 5 * MIN))).toEqual(NONE);
      expect(via()).toEqual([`${CUSTOMER} 777`]);
      expect(await one(queued.id)).toEqual(queued);
      expect(await one(mine.id)).toMatchObject({ attempts: 2, sentAt: T0 });

      vi.stubEnv('STAFF_BOT_TOKEN', STAFF);
      expect(await flushOutbox(at(HOUR))).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect(via()).toEqual([`${CUSTOMER} 777`, `${STAFF} 900`]);
      expect(await one(queued.id)).toMatchObject({ attempts: 4, sentAt: at(HOUR) });
    });

    // Ilgari tokeni yo'q botning 40+ xabari har tick'da butun to'plamni (40 ta) egallardi — ulardan keyingi xabarlar hech qachon olinmasdi
    it('tokeni yo\'q botning 45 ta xabari navbat boshida tursa ham boshqa botning xabari shu tick\'da ketadi', async () => {
      await prisma.user.createMany({ data: Array.from({ length: 45 }, (_, i) => ({ name: `Xodim s${i}`, phone: `9989022${String(i).padStart(5, '0')}`, passwordHash: '-', role: 'staff' as const, telegramId: `s${i}` })) });
      await prisma.botOutbox.createMany({ data: Array.from({ length: 45 }, (_, i) => ({ bot: 'staff', chatId: `s${i}`, html: `xodimga ${i}`, nextAt: at(-MIN), createdAt: at(-6 * MIN), lastError: 'fetch failed' })) });
      const mine = await add({ chatId: '777', html: 'Buyurtmangiz yo\'lda' });
      const blocked = (await all()).filter((r) => r.bot === 'staff');
      expect(blocked).toHaveLength(45);
      expect(blocked.every((r) => r.id < mine.id)).toBe(true);
      vi.stubEnv('STAFF_BOT_TOKEN', '');

      expect(await flushOutbox(T0)).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect(net.sent).toEqual([{ token: CUSTOMER, chat: '777', text: 'Buyurtmangiz yo\'lda', mode: 'HTML', inline: undefined }]);
      // Tokensiz bot xabarlari tegilmagan: urinish sarflanmagan, "yuborilmadi" bo'lmagan
      expect((await all()).filter((r) => r.bot === 'staff')).toEqual(blocked);
      expect(await outboxStats(T0)).toEqual({ pending: 45, stuck: 0, failed24h: 0 });

      // Token qaytgach ular ham ketadi: bitta tick 40 ta, qolgani keyingisida
      vi.stubEnv('STAFF_BOT_TOKEN', STAFF);
      expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 40, retry: 0, failed: 0 });
      expect(await flushOutbox(at(10 * MIN))).toEqual({ sent: 5, retry: 0, failed: 0 });
      expect(perChat()).toEqual({ 777: 1, ...Object.fromEntries(blocked.map((r) => [r.chatId, 1])) });
    });

    it('token 2 kunda ham qaytmasa xabar "yuborilmadi" bo\'ladi (bot tokeni yo\'q); yoshroqlari kutadi va token qaytsa yetib boradi', async () => {
      const old = await add({ bot: 'staff', chatId: '901', createdAt: at(-2 * DAY - 1), attempts: 3 }); // 2 kundan oshgan
      const edge = await add({ bot: 'staff', chatId: '902', createdAt: at(-2 * DAY) }); // aynan 2 kun — hali emas
      const fresh = await add({ bot: 'staff', chatId: '903', createdAt: at(-HOUR), nextAt: at(HOUR) });
      const removed = await add({ bot: 'driver', chatId: '555', createdAt: at(-3 * DAY) }); // olib tashlangan bot turi
      const removedFresh = await add({ bot: 'driver', chatId: '556', createdAt: at(-DAY) });
      const live = await add({ chatId: '777', createdAt: at(-5 * DAY), nextAt: at(HOUR), attempts: 5 }); // tokeni bor botniki: eski bo'lsa ham kutaveradi
      const done = [
        await add({ bot: 'staff', chatId: '904', createdAt: at(-9 * DAY), sentAt: at(-HOUR), lastError: null }), // yakunlangan — tegilmaydi
        await add({ bot: 'staff', chatId: '905', createdAt: at(-9 * DAY), failedAt: at(-HOUR), lastError: 'Telegram sendMessage: 403 Forbidden' }),
      ];
      vi.stubEnv('STAFF_BOT_TOKEN', '');

      expect(await flushOutbox(T0)).toEqual(NONE);
      expect(net.sent).toEqual([]);
      expect(await one(old.id)).toEqual({ ...old, failedAt: T0, lastError: NO_TOKEN });
      expect(await one(removed.id)).toEqual({ ...removed, failedAt: T0, lastError: NO_TOKEN });
      for (const r of [edge, fresh, removedFresh, live, ...done]) expect(await one(r.id)).toEqual(r);
      // Bu haqiqiy yo'qotish: kunlik tekshiruvda "yuborilmadi" bo'lib ko'rinadi (ikkitasi va avvalgi 403)
      expect(await outboxStats(T0)).toEqual({ pending: 4, stuck: 3, failed24h: 3 });

      // Token qaytdi: kutib turganlari yetib boradi, "yuborilmadi" bo'lganlari qayta yuborilmaydi
      vi.stubEnv('STAFF_BOT_TOKEN', STAFF);
      expect(await flushOutbox(at(MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect(await flushOutbox(at(HOUR))).toEqual({ sent: 2, retry: 0, failed: 0 });
      expect(via()).toEqual([`${STAFF} 902`, `${STAFF} 903`, `${CUSTOMER} 777`]);
      expect(await one(old.id)).toMatchObject({ attempts: 3, sentAt: null, failedAt: T0 });
      // Olib tashlangan bot turining yosh xabari ham 2 kundan oshgach yopiladi
      expect(await one(removedFresh.id)).toEqual(removedFresh);
      expect(await flushOutbox(at(DAY + 1))).toEqual(NONE);
      expect(await one(removedFresh.id)).toEqual({ ...removedFresh, failedAt: at(DAY + 1), lastError: NO_TOKEN });
    });

    it('hech bir botning tokeni yo\'q: hech narsa yuborilmaydi va o\'chirilmaydi, urinish sarflanmaydi', async () => {
      const kept = [
        await add({ chatId: '777' }),
        await add({ bot: 'staff', chatId: '900', attempts: 4 }),
        await add({ chatId: '778' }, false), // oluvchisi uzilgan bo'lsa ham hozir tekshirilmaydi
      ];
      const old = await add({ chatId: '779', createdAt: at(-3 * DAY) });
      vi.stubEnv('CUSTOMER_BOT_TOKEN', '   ');
      vi.stubEnv('STAFF_BOT_TOKEN', '');

      for (let i = 0; i < 3; i += 1) expect(await flushOutbox(at(i * 5 * MIN))).toEqual(NONE);
      expect(net.sent).toEqual([]);
      for (const r of kept) expect(await one(r.id)).toEqual(r);
      expect(await one(old.id)).toEqual({ ...old, failedAt: T0, lastError: NO_TOKEN });
    });
  });

  describe('mavzu (topic): eskirgan holat xabari yangisidan keyin yetib bormaydi', () => {
    it('yangi holat to\'g\'ridan-to\'g\'ri yetib borsa, navbatda turgan eski holat bekor bo\'ladi va keyin ham yuborilmaydi', async () => {
      await customer('777');
      net.reply = offline;
      expect(await notifyCustomer('777', 'Holati: Yo\'lda', KB, STATUS)).toBe(false);
      const [queued] = await all();
      expect(queued).toMatchObject({ topic: STATUS, sentAt: null, failedAt: null });

      net.reply = OK;
      net.sent.length = 0;
      const before = Date.now();
      expect(await notifyCustomer('777', 'Holati: Yetkazildi', KB, STATUS)).toBe(true);
      // O'chirilmaydi — "eskirgan" deb belgilanadi; yetib borgan yangi xabar navbatga yozilmaydi
      const [stale, ...rest] = await all();
      expect(rest).toEqual([]);
      expect(stale).toMatchObject({ id: queued.id, attempts: 1, sentAt: null, lastError: SUPERSEDED });
      expect(stale.failedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(stale.failedAt!.getTime()).toBeLessThanOrEqual(Date.now());

      for (const later of [0, 15 * MIN, DAY]) expect(await flushOutbox(new Date(queued.nextAt.getTime() + later))).toEqual(NONE);
      expect(net.sent).toEqual([{ token: CUSTOMER, chat: '777', text: 'Holati: Yetkazildi', mode: 'HTML', inline: KB }]);
      // Bu Telegram xatosi emas: "yuborilmadi" deb ham, "kutyapti" deb ham sanalmaydi
      expect(await outboxStats()).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
    });

    it('ikkalasi ham navbatga tushsa: yangisi eskisining o\'rnini bosadi va faqat yangisi yetib boradi', async () => {
      await customer('777');
      net.reply = offline;
      expect(await notifyCustomer('777', 'Holati: Yo\'lda', KB, STATUS)).toBe(false);
      expect(await notifyCustomer('777', 'Holati: Yetkazildi', KB, STATUS)).toBe(false);
      const [stale, fresh, ...rest] = await all();
      expect(rest).toEqual([]);
      expect(stale).toMatchObject({ html: 'Holati: Yo\'lda', topic: STATUS, sentAt: null, lastError: SUPERSEDED });
      expect(stale.failedAt).not.toBeNull();
      expect(fresh).toMatchObject({ html: 'Holati: Yetkazildi', topic: STATUS, attempts: 1, sentAt: null, failedAt: null, lastError: 'fetch failed' });

      net.reply = OK;
      net.sent.length = 0;
      expect(await flushOutbox(fresh.nextAt)).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect(await flushOutbox(new Date(fresh.nextAt.getTime() + DAY))).toEqual(NONE);
      expect(net.sent).toEqual([{ token: CUSTOMER, chat: '777', text: 'Holati: Yetkazildi', mode: 'HTML', inline: KB }]);
      expect(await one(fresh.id)).toMatchObject({ attempts: 2, sentAt: fresh.nextAt, failedAt: null });
    });

    it('boshqa mavzu, boshqa oluvchi, boshqa bot va mavzusiz xabarlarga tegilmaydi; yakunlangan yozuvlar ham o\'zgarmaydi', async () => {
      const target = [
        await add({ chatId: '777', topic: STATUS, html: 'eski holat' }),
        await add({ chatId: '777', topic: STATUS, html: 'undan ham eski holat', nextAt: at(3 * HOUR), attempts: 4 }), // navbatdagi urinishini kutyapti
      ];
      const untouched = [
        await add({ chatId: '777', topic: 'order-status:16', html: 'boshqa buyurtma' }),
        await add({ chatId: '777', topic: 'order-status:150', html: 'nomi shu bilan boshlanadigan mavzu' }),
        await add({ chatId: '777', topic: 'order-production:15:Quti', html: 'ishlab chiqarish' }),
        await add({ chatId: '778', topic: STATUS, html: 'shu buyurtmaning boshqa oluvchisi' }),
        await add({ chatId: '777', bot: 'staff', topic: STATUS, html: 'boshqa bot' }),
        await add({ chatId: '777', html: 'mavzusiz' }),
        await add({ chatId: '777', topic: STATUS, sentAt: at(-HOUR), lastError: null }), // allaqachon yetib borgan
        await add({ chatId: '777', topic: STATUS, failedAt: at(-HOUR), attempts: 2, lastError: 'Telegram sendMessage: 403 Forbidden: bot was blocked by the user' }), // haqiqiy xato
      ];

      // Oluvchi son ko'rinishida berilsa ham navbatdagi (matn ko'rinishidagi) yozuv topiladi
      await supersede('customer', 777, STATUS, at(-1000));
      for (const r of untouched) expect(await one(r.id)).toEqual(r);
      for (const r of target) expect(await one(r.id)).toEqual({ ...r, failedAt: at(-1000), lastError: SUPERSEDED });
      // Haqiqiy xato "yuborilmadi" hisobida qoladi, eskirganlar esa kirmaydi
      expect(await outboxStats(T0)).toEqual({ pending: 6, stuck: 0, failed24h: 1 });

      expect(await flushOutbox(at(3 * HOUR))).toEqual({ sent: 6, retry: 0, failed: 0 });
      expect(net.sent.map((m) => `${m.token} ${m.chat} ${m.text}`)).toEqual([
        `${CUSTOMER} 777 boshqa buyurtma`,
        `${CUSTOMER} 777 nomi shu bilan boshlanadigan mavzu`,
        `${CUSTOMER} 777 ishlab chiqarish`,
        `${CUSTOMER} 778 shu buyurtmaning boshqa oluvchisi`,
        `${STAFF} 777 boshqa bot`,
        `${CUSTOMER} 777 mavzusiz`,
      ]);
    });

    it('yuborilayotgan paytda o\'rnini yangisi bosgan xabar "yetkazildi"ga qaytarilmaydi; xato bilan tugasa ham "eskirgan"ligicha qoladi', async () => {
      const sending = await add({ chatId: '777', topic: STATUS, html: 'Holati: Yo\'lda' });
      const failing = await add({ chatId: '778', topic: STATUS, attempts: OUTBOX_MAX_ATTEMPTS - 1 });
      const plain = await add({ chatId: '779' });
      // Tick xabarni band qilib, Telegram javobini kutayotgan paytda yangi holat to'g'ridan-to'g'ri yetib bordi (notify → supersede)
      net.during = async (m) => {
        if (m.chat !== '779') await supersede('customer', m.chat, STATUS, at(1000));
      };
      net.reply = (m) => (m.chat === '778' ? offline() : OK());

      await flushOutbox(T0);
      expect(chats()).toEqual(['777', '778', '779']);
      expect(await one(sending.id)).toMatchObject({ attempts: 2, sentAt: null, failedAt: at(1000), lastError: SUPERSEDED });
      expect(await one(failing.id)).toMatchObject({ attempts: OUTBOX_MAX_ATTEMPTS, sentAt: null, failedAt: at(1000), lastError: SUPERSEDED });
      expect(await one(plain.id)).toMatchObject({ attempts: 2, sentAt: T0, failedAt: null, lastError: null });

      net.during = null;
      net.reply = OK;
      for (const later of [15 * MIN, HOUR, DAY]) expect(await flushOutbox(at(later))).toEqual(NONE);
      expect(chats()).toEqual(['777', '778', '779']);
      expect(await outboxStats(at(HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
    });

    it('navbatdagi eskisini bekor qilib bo\'lmasa ham (baza xatosi) yetib borgan xabar uchun true qaytadi', async () => {
      const queued = await add({ chatId: '777', topic: STATUS, nextAt: at(HOUR) });
      // Prisma kutilgan bu xatoni o'zi ham chop etadi ("prisma:error ...") — test chiqishini to'ldirmasin
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      // Xabar yetib bordi, lekin "eskisini bekor qilish" so'rovi band jadvalda kutib qoladi va baza uni uzadi
      const done = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('LOCK TABLE "BotOutbox" IN ACCESS EXCLUSIVE MODE');
          const sent = notifyCustomer('777', 'Holati: Yetkazildi', KB, STATUS);
          await waitForBlocked(tx, 1);
          // Kutayotgan so'rovni bazaning o'zi bekor qiladi — notify uchun bu oddiy baza xatosi
          await tx.$queryRaw`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))`;
          return { result: await sent };
        },
        { timeout: 15_000 },
      );
      expect(done.result).toBe(true);
      expect(chats()).toEqual(['777']);
      expect(await one(queued.id)).toEqual(queued);
      // Xato logga yozilgan — bot tokenisiz
      const logged = vi.mocked(console.error).mock.calls.map((c) => c.join(' '));
      expect(logged.some((line) => line.includes('[notify:customer] navbat'))).toBe(true);
      expect(logged.join(' ')).not.toContain(CUSTOMER);
    });
  });

  // Ikki xodim bitta buyurtmani ketma-ket o'zgartirdi: birinchi xabar hali Telegram javobini kutayotganda ikkinchisi chiqdi.
  // Navbatga kim tegishini javob kelgan tartib emas, xabar CHIQARILGAN tartib hal qiladi (notify.ts) — bu yerda haqiqiy baza bilan
  describe('mavzu (topic): ustma-ust tushgan yuborishlar', () => {
    const OLD = 'Holati: Yo\'lda';
    const NEW = 'Holati: Yetkazildi';
    /** Chat haqiqatan OLGAN xabarlar, yetib borgan tartibda (`net.sent` — urinishlar, o'tmaganlari bilan birga) */
    let got: string[];
    const deliver = (m: Sent) => {
      got.push(m.text);
      return OK();
    };
    /** Eski xabarning so'rovi Telegram'da "osilib" turadi; qaytgan funksiya uni qo'yib yuboradi */
    const hang = () => {
      let release = (): void => undefined;
      const wait = new Promise<void>((resolve) => { release = resolve; });
      net.during = async (m) => {
        if (m.text === OLD) await wait;
      };
      return release;
    };
    /** Eski xabarni chiqaradi va so'rovi Telegram'ga yetib borguncha kutadi — javobi hali yo'q (natijasi `done` da) */
    const startOld = async () => {
      const done = notifyCustomer('777', OLD, KB, STATUS);
      await vi.waitFor(() => expect(net.sent.map((m) => m.text)).toEqual([OLD]));
      return { done };
    };

    beforeEach(async () => {
      got = [];
      await customer('777');
    });

    it('sekin yetib borgan eski holat shu orada navbatga tushgan yangi holatni bekor qilmaydi: yangisi keyin yetib boradi va oxirgi bo\'lib qoladi', async () => {
      const release = hang();
      net.reply = (m) => (m.text === OLD ? deliver(m) : offline());
      const slow = await startOld(); // javobi kutilmoqda
      expect(await notifyCustomer('777', NEW, KB, STATUS)).toBe(false); // yangisi darhol o'tmadi — navbatda
      release();
      expect(await slow.done).toBe(true);

      const [queued, ...rest] = await all();
      expect(rest).toEqual([]);
      expect(queued).toMatchObject({ html: NEW, topic: STATUS, inline: KB, attempts: 1, sentAt: null, failedAt: null, lastError: 'fetch failed' });

      net.during = null;
      net.reply = deliver;
      expect(await flushOutbox(queued.nextAt)).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect(await flushOutbox(new Date(queued.nextAt.getTime() + DAY))).toEqual(NONE);
      // Chat olgan oxirgi xabar — eng yangi holat, u aynan bir marta kelgan
      expect(got).toEqual([OLD, NEW]);
      expect(await one(queued.id)).toMatchObject({ attempts: 2, sentAt: queued.nextAt, failedAt: null, lastError: null });
    });

    it('eski xabar osilib turib oxiri o\'tmasa, yangisi ham darhol o\'tmagan bo\'lsa: navbatda faqat yangisi turadi va faqat u yetib boradi', async () => {
      const release = hang();
      net.reply = offline;
      const slow = await startOld();
      expect(await notifyCustomer('777', NEW, KB, STATUS)).toBe(false);
      release();
      expect(await slow.done).toBe(false);

      // Eskirgan xabar navbatga qo'yilmadi — qo'yilsa o'zidan yangisini bekor qilib, uning o'rniga o'zi yetib borardi
      const [queued, ...rest] = await all();
      expect(rest).toEqual([]);
      expect(queued).toMatchObject({ html: NEW, topic: STATUS, sentAt: null, failedAt: null });

      net.during = null;
      net.reply = deliver;
      expect(await flushOutbox(queued.nextAt)).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect(got).toEqual([NEW]);
      expect(await outboxStats(new Date(queued.nextAt.getTime() + HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
    });

    it('eski xabar osilib turganda yangisi to\'g\'ridan-to\'g\'ri yetib borsa: navbatdagi undan ham eski holatni yangisi bekor qiladi, kechikib yiqilgan eskisi navbatga tushmaydi', async () => {
      const stale = await add({ chatId: '777', topic: STATUS, html: 'Holati: Qabul qilindi', nextAt: at(HOUR) });
      const release = hang();
      net.reply = (m) => (m.text === OLD ? offline() : deliver(m));
      const slow = await startOld();
      expect(await notifyCustomer('777', NEW, KB, STATUS)).toBe(true);
      expect(await one(stale.id)).toMatchObject({ attempts: 1, sentAt: null, lastError: SUPERSEDED });
      release();
      expect(await slow.done).toBe(false);

      const rows = await all();
      expect(rows.map((r) => r.id)).toEqual([stale.id]);
      expect(rows[0].failedAt).not.toBeNull();
      net.during = null;
      net.reply = deliver;
      for (const later of [HOUR, DAY]) expect(await flushOutbox(at(later))).toEqual(NONE);
      expect(got).toEqual([NEW]);
    });
  });

  describe('oluvchi hali ham o\'zimiznikimi', () => {
    it('xodim: o\'chirib qo\'yilgan, o\'chirilgan, botdan uzilgan, roli olingan yoki xabarnomani o\'chirgan — xabar yuborilmaydi va navbatdan o\'chadi', async () => {
      const changes: [string, Prisma.UserUncheckedUpdateInput][] = [
        ['o\'chirib qo\'yilgan', { isActive: false }],
        ['o\'chirilgan', { deletedAt: new Date() }],
        ['botdan uzilgan', { telegramId: null, telegramVerifiedAt: null }],
        ['roli olingan', { role: 'user' }],
        ['xabarnomani o\'chirgan', { telegramNotify: false }],
      ];
      for (const [i, [name, change]] of changes.entries()) {
        const u = await staff(`90${i + 1}`, { name });
        await add({ bot: 'staff', chatId: `90${i + 1}`, html: `<b>Yangi buyurtma</b> (${name})`, inline: KB, attempts: 2 });
        await prisma.user.update({ where: { id: u.id }, data: change });
        // Shu Telegram hisobi mijoz botida ro'yxatda bo'lishi xodim xabarini oqlamaydi
        await customer(`90${i + 1}`);
      }
      await add({ bot: 'staff', chatId: '906' }, false); // hech qachon ulanmagan chat
      const kept = [];
      for (const [i, role] of (['staff', 'manager', 'admin'] as const).entries()) {
        await staff(`91${i}`, { role });
        kept.push(await add({ bot: 'staff', chatId: `91${i}`, attempts: 3 }));
      }

      expect(await flushOutbox(T0)).toEqual({ sent: 3, retry: 0, failed: 0 });
      expect(via()).toEqual([`${STAFF} 910`, `${STAFF} 911`, `${STAFF} 912`]);
      const rows = await all();
      expect(rows.map((r) => r.id)).toEqual(kept.map((r) => r.id));
      expect(rows.every((r) => r.attempts === 4 && r.sentAt?.getTime() === T0.getTime())).toBe(true);
      // Bu Telegram xatosi emas: "yuborilmadi" deb sanalmaydi, hech narsa kutib ham qolmaydi
      expect(await outboxStats(T0)).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
    });

    it('mijoz: botdan chiqqan (/stop) yoki xabarnomani o\'chirgan — yuborilmaydi va o\'chadi; tasdiqlangan mijoz va havola orqali ulangan chat oladi', async () => {
      await customer('701', { phone: '998901112233', verifiedAt: at(-DAY) }); // tasdiqlangan, xabarnomasi yoniq
      await customer('702', { phone: '998901112234', verifiedAt: at(-DAY), notify: false }); // xabarnomani o'chirgan
      // 703 — /stop bosgan: yozuvi ham, ulangan buyurtmasi ham yo'q
      await order({ telegramUserId: '704' }); // yozuvi yo'q (eski sessiya), lekin havola orqali ulangan buyurtmasi bor
      await order({ telegramUserId: '705', deletedAt: at(-HOUR) }); // ulangan buyurtmasi o'chirilgan
      await customer('706', { notify: false }); // buyurtmasi ulangan bo'lsa ham xabarnomani o'chirgan: yozuvdagi sozlama ustun
      await order({ telegramUserId: '706' });
      await staff('707'); // boshqaruv botidagi faol xodim mijoz botining oluvchisi emas
      const rows = [];
      for (let i = 1; i <= 7; i += 1) rows.push(await add({ chatId: `70${i}`, html: `Buyurtma holati ${i}`, attempts: 2 }, false));

      expect(await flushOutbox(T0)).toEqual({ sent: 2, retry: 0, failed: 0 });
      expect(via()).toEqual([`${CUSTOMER} 701`, `${CUSTOMER} 704`]);
      expect(await idsOf()).toEqual([rows[0].id, rows[3].id]);
      for (const r of [rows[0], rows[3]]) expect(await one(r.id)).toMatchObject({ attempts: 3, sentAt: T0, failedAt: null });
      expect(await outboxStats(T0)).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
    });

    it('tekshiruv yuborish paytidagi holat bo\'yicha: vaqti kelmagan xabar o\'chirilmaydi, xabarnomani qayta yoqqan xodim uni oladi', async () => {
      const u = await staff('900', { telegramNotify: false });
      const due = await add({ bot: 'staff', chatId: '900' });
      const later = await add({ bot: 'staff', chatId: '900', nextAt: at(10 * MIN) });

      expect(await flushOutbox(T0)).toEqual(NONE);
      expect(await all()).toEqual([later]); // vaqti kelgani o'chdi, kelmagani tegilmadi
      expect(due.id).not.toBe(later.id);
      await prisma.user.update({ where: { id: u.id }, data: { telegramNotify: true } });
      expect(await flushOutbox(at(10 * MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect(via()).toEqual([`${STAFF} 900`]);
    });

    it('mijoz botdan chiqsa (unlinkCustomer): navbatdagi xabarlari darhol o\'chadi, keyin tushib qolgani ham yuborilmaydi', async () => {
      await customer('777', { phone: '998901112233', verifiedAt: at(-DAY) });
      await customer('778');
      const bound = await order({ telegramUserId: '777' });
      const mine = [await add({ chatId: '777', topic: STATUS }), await add({ chatId: '777', nextAt: at(HOUR), attempts: 4 })];
      const kept = [
        await add({ chatId: '777', sentAt: at(-HOUR), lastError: null }), // yetkazilgan — tarix sifatida qoladi
        await add({ chatId: '777', failedAt: at(-HOUR), attempts: 6 }), // "yuborilmadi" — kunlik tekshiruv uchun qoladi
        await add({ chatId: '777', topic: STATUS, failedAt: at(-HOUR), lastError: SUPERSEDED }),
        await add({ chatId: '778' }), // boshqa mijoz
        await add({ bot: 'staff', chatId: '777' }), // shu Telegram hisobining boshqaruv botidagi xabari
      ];

      await unlinkCustomer(777);
      expect(await idsOf()).toEqual(kept.map((r) => r.id));
      expect(await prisma.botOutbox.count({ where: { id: { in: mine.map((r) => r.id) } } })).toBe(0);
      for (const r of kept) expect(await one(r.id)).toEqual(r);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: bound.id } })).telegramUserId).toBeNull();

      // Chiqish bilan bir vaqtda ketayotgan xabar Telegram xatosi tufayli navbatga tushib qoldi
      net.reply = offline;
      expect(await notifyCustomer('777', 'Holati: Yetkazildi', KB, STATUS)).toBe(false);
      const [late] = (await all()).filter((r) => !kept.some((k) => k.id === r.id));
      expect(late).toMatchObject({ chatId: '777', sentAt: null, failedAt: null });
      net.reply = OK;
      net.sent.length = 0;
      expect(await flushOutbox(new Date(Math.max(late.nextAt.getTime(), T0.getTime())))).toEqual({ sent: 2, retry: 0, failed: 0 });
      // Faqat boshqa mijoz va boshqaruv botidagi xabar ketdi; chiqqan mijozniki o'chirildi
      expect(via()).toEqual([`${CUSTOMER} 778`, `${STAFF} 777`]);
      expect((await all()).some((r) => r.id === late.id)).toBe(false);
    });

    it('xodim botdan uzilsa (unlinkStaff): navbatdagi xabarlari darhol o\'chadi; boshqa xodim va mijoz botidagi xabarlar qoladi', async () => {
      const u = await staff('900');
      await staff('901');
      const mine = [await add({ bot: 'staff', chatId: '900', inline: KB }), await add({ bot: 'staff', chatId: '900', nextAt: at(HOUR), attempts: 4 })];
      const kept = [
        await add({ bot: 'staff', chatId: '900', sentAt: at(-HOUR), lastError: null }),
        await add({ bot: 'staff', chatId: '900', failedAt: at(-HOUR), attempts: 6 }),
        await add({ bot: 'staff', chatId: '901' }), // boshqa xodim
        await add({ chatId: '900' }), // shu Telegram hisobining mijoz botidagi xabari
      ];

      await unlinkStaff(u.id);
      expect(await idsOf()).toEqual(kept.map((r) => r.id));
      expect(await prisma.botOutbox.count({ where: { id: { in: mine.map((r) => r.id) } } })).toBe(0);
      for (const r of kept) expect(await one(r.id)).toEqual(r);

      expect(await flushOutbox(T0)).toEqual({ sent: 2, retry: 0, failed: 0 });
      expect(via()).toEqual([`${STAFF} 901`, `${CUSTOMER} 900`]);
      // Ulanmagan xodimni uzish ham xatosiz (navbatga tegmaydi)
      await expect(unlinkStaff(u.id)).resolves.toBeUndefined();
      expect(await idsOf()).toEqual(kept.map((r) => r.id));
    });
  });

  describe('orderNotify: buyurtma xabarlari navbatda', () => {
    it('holat va ishlab chiqarish xabarlari o\'z mavzusi bilan tushadi; yangi holat yetib borgach eskisi yuborilmaydi, boshqalari yetib boradi', async () => {
      const phone = '998901112233';
      await customer('777', { phone, verifiedAt: at(-DAY) });
      const o = await order({ contactPhone: phone, status: 'shipping' });
      const product = 'Quti «30x20» <b>';

      net.reply = offline;
      expect(await notifyCustomerOrderStatus(o)).toBe(0);
      expect(await notifyCustomerProduction({ id: 7, orderId: o.id, productName: product, currentStage: 'gofra', progress: 25, status: 'in_progress' })).toBe(0);
      expect(await notifyCustomerPaid(o)).toBe(0);
      expect(await states()).toEqual([
        `customer 777 order-status:${o.id} kutyapti`,
        // Mavzu — buyurtma va ish topshirig'i raqami (mahsulot nomi mavzuda yo'q)
        `customer 777 order-production:${o.id}:7 kutyapti`,
        'customer 777 - kutyapti',
      ]);

      // Telegram tiklandi: "Yetkazildi" to'g'ridan-to'g'ri yetib boradi va navbatdagi "Yo'lda"ni bekor qiladi
      net.reply = OK;
      net.sent.length = 0;
      const delivered = await prisma.order.update({ where: { id: o.id }, data: { status: 'delivered' } });
      expect(await notifyCustomerOrderStatus(delivered)).toBe(1);
      expect(net.sent.map((m) => m.text)).toEqual([expect.stringContaining('Buyurtmangiz yetkazildi.')]);
      expect(await states()).toEqual([
        `customer 777 order-status:${o.id} ${SUPERSEDED}`,
        `customer 777 order-production:${o.id}:7 kutyapti`,
        'customer 777 - kutyapti',
      ]);

      const due = new Date(Math.max(...(await all()).map((r) => r.nextAt.getTime())));
      expect(await flushOutbox(due)).toEqual({ sent: 2, retry: 0, failed: 0 });
      expect(net.sent).toHaveLength(3);
      expect(net.sent.some((m) => m.text.includes('Buyurtmangiz yo\'lga chiqdi.'))).toBe(false);
      expect(net.sent[1].text).toContain('Quti «30x20» &lt;b&gt;');
    });

    type WorkOrder = Parameters<typeof notifyCustomerProduction>[0];
    const wo = (id: number, orderId: number, over: Partial<WorkOrder> = {}): WorkOrder => ({ id, orderId, productName: 'Quti 30x20', currentStage: 'gofra', progress: 25, status: 'in_progress', ...over });
    /** Chat va xabarning birinchi satri (belgisi va buyurtma raqami): 🏭 — ishlab chiqarish, 📦 — holat, ✅ — to'lov */
    const heads = () => net.sent.map((m) => `${m.chat} ${m.text.split('\n')[0]}`).sort();

    // Ilgari mavzu mahsulot nomidan yasalardi: bitta buyurtmada bir xil mahsulotning ikki topshirig'i bir-birining xabarini bekor qilardi
    it('bir buyurtmaning bir xil mahsulotli ikki ish topshirig\'i bir-birining xabarini bekor qilmaydi; topshiriqning yangi bosqichi faqat o\'zining eski xabarini almashtiradi', async () => {
      const phone = '998901112233';
      await customer('777', { phone, verifiedAt: at(-DAY) });
      const o = await order({ contactPhone: phone });

      net.reply = offline;
      expect(await notifyCustomerProduction(wo(7, o.id))).toBe(0);
      expect(await notifyCustomerProduction(wo(8, o.id, { currentStage: 'pechat', progress: 50 }))).toBe(0);
      expect(await notifyCustomerProduction(wo(7, o.id, { currentStage: 'yiguv', progress: 75 }))).toBe(0);
      expect(await states()).toEqual([
        `customer 777 order-production:${o.id}:7 ${SUPERSEDED}`,
        `customer 777 order-production:${o.id}:8 kutyapti`,
        `customer 777 order-production:${o.id}:7 kutyapti`,
      ]);

      net.reply = OK;
      net.sent.length = 0;
      const due = new Date(Math.max(...(await all()).map((r) => r.nextAt.getTime())));
      expect(await flushOutbox(due)).toEqual({ sent: 2, retry: 0, failed: 0 });
      // Ikkala topshiriq ham yetib bordi: 8-si o'z bosqichi bilan, 7-si — faqat oxirgisi bilan
      expect(net.sent.map((m) => /\((\d+)%\)/.exec(m.text)?.[1])).toEqual(['50', '75']);
      expect(net.sent.every((m) => m.chat === '777' && m.text.includes('Quti 30x20'))).toBe(true);
    });

    // Bekor qilingan buyurtma uchun yangi ishlab chiqarish xabari chiqmaydi — navbatdagilarini "bekor qilindi" xabarining o'zi tozalaydi
    it('buyurtma bekor qilinsa navbatdagi ishlab chiqarish xabarlari hamma oluvchilarda bekor bo\'ladi va yuborilmaydi; raqami shu bilan boshlanadigan boshqa buyurtmanikiga tegilmaydi', async () => {
      const phone = '998901112233';
      await customer('777', { phone, verifiedAt: at(-DAY) });
      await customer('778', { lang: 'ru' });
      const o = await order({ contactPhone: phone, telegramUserId: '778' });
      // Raqami bekor qilinayotgan buyurtma raqami bilan BOSHLANADIGAN buyurtma (15 va 151 kabi)
      const similar = await order({ id: Number(`${o.id}1`), contactPhone: phone, telegramUserId: '778' });

      net.reply = offline;
      expect(await notifyCustomerProduction(wo(7, o.id))).toBe(0);
      expect(await notifyCustomerProduction(wo(8, o.id, { currentStage: 'pechat', progress: 50 }))).toBe(0);
      expect(await notifyCustomerProduction(wo(70, similar.id))).toBe(0);
      expect(await notifyCustomerOrderStatus(o)).toBe(0);
      expect(await notifyCustomerPaid(o)).toBe(0);
      const before = await all();
      expect(before).toHaveLength(10);
      expect(before.every((r) => !r.sentAt && !r.failedAt)).toBe(true);

      // Bekor qilindi; Telegram ishlayapti — xabar to'g'ridan-to'g'ri yetib boradi
      net.reply = OK;
      net.sent.length = 0;
      const started = Date.now();
      const cancelled = await prisma.order.update({ where: { id: o.id }, data: { status: 'cancelled' } });
      expect(await notifyCustomerOrderStatus(cancelled)).toBe(2);
      expect(heads()).toEqual([`777 📦 <b>Buyurtma #${o.id}</b>`, `778 📦 <b>Заказ #${o.id}</b>`]);
      expect((await states()).sort()).toEqual(['777', '778'].flatMap((chat) => [
        `customer ${chat} - kutyapti`,
        `customer ${chat} order-production:${similar.id}:70 kutyapti`,
        `customer ${chat} order-production:${o.id}:7 ${SUPERSEDED}`,
        `customer ${chat} order-production:${o.id}:8 ${SUPERSEDED}`,
        `customer ${chat} order-status:${o.id} ${SUPERSEDED}`,
      ]).sort());
      // Bekor bo'lganlari shu paytda belgilangan; boshqa hech bir ustuni o'zgarmagan, tegilmaganlari esa aynan avvalgidek
      for (const r of await all()) {
        const was = before.find((b) => b.id === r.id)!;
        if (!r.failedAt) expect(r).toEqual(was);
        else {
          expect(r).toEqual({ ...was, failedAt: r.failedAt, lastError: SUPERSEDED });
          expect(r.failedAt.getTime()).toBeGreaterThanOrEqual(started);
          expect(r.failedAt.getTime()).toBeLessThanOrEqual(Date.now());
        }
      }
      // Bu Telegram xatosi emas: "yuborilmadi" sanog'iga kirmaydi
      expect(await outboxStats()).toEqual({ pending: 4, stuck: 0, failed24h: 0 });

      // Navbat yuborilganda: bekor qilingan buyurtmaning ishlab chiqarish va eski holat xabarlari ketmaydi
      net.sent.length = 0;
      const due = new Date(Math.max(...(await all()).map((r) => r.nextAt.getTime())));
      expect(await flushOutbox(due)).toEqual({ sent: 4, retry: 0, failed: 0 });
      expect(await flushOutbox(new Date(due.getTime() + DAY))).toEqual(NONE);
      expect(heads()).toEqual([
        `777 ✅ <b>Buyurtma #${o.id}</b>`,
        `777 🏭 <b>Buyurtma #${similar.id}</b>`,
        `778 ✅ <b>Заказ #${o.id}</b>`,
        `778 🏭 <b>Заказ #${similar.id}</b>`,
      ]);

      // Bekor qilingan buyurtmaning topshirig'i keyin o'zgarsa ham yangi xabar chiqmaydi — navbatga ham tushmaydi
      net.reply = offline;
      net.sent.length = 0;
      expect(await notifyCustomerProduction(wo(7, o.id, { currentStage: 'qc', progress: 90 }))).toBe(0);
      expect(net.sent).toEqual([]);
      expect(await prisma.botOutbox.count({ where: { sentAt: null, failedAt: null } })).toBe(0);
    });

    it('supersedePrefix: faqat shu botning, mavzusi shu bilan boshlanadigan KUTAYOTGAN xabarlari; mavzusiz, yetib borgan va haqiqiy xatoli yozuvlar o\'zgarmaydi', async () => {
      const prefix = 'order-production:15:';
      const target = [
        await add({ chatId: '777', topic: `${prefix}7` }),
        await add({ chatId: '778', topic: `${prefix}7`, attempts: 4, nextAt: at(3 * HOUR) }), // boshqa oluvchi, navbatdagi urinishini kutyapti
        await add({ chatId: '777', topic: `${prefix}8` }),
      ];
      const untouched = [
        await add({ chatId: '777', topic: 'order-production:151:7' }),
        await add({ chatId: '777', topic: 'order-production:1:5' }),
        await add({ chatId: '777', topic: 'order-production:15' }), // oxirgi ikki nuqtasiz — boshqa mavzu
        await add({ chatId: '777', topic: STATUS }),
        await add({ chatId: '777', topic: `eski-${prefix}7` }), // qidirilgan matn boshida emas
        await add({ chatId: '777' }), // mavzusiz (NULL)
        await add({ chatId: '777', bot: 'staff', topic: `${prefix}7` }),
        await add({ chatId: '777', topic: `${prefix}7`, sentAt: at(-HOUR), lastError: null }),
        await add({ chatId: '777', topic: `${prefix}7`, failedAt: at(-HOUR), attempts: 2, lastError: 'Telegram sendMessage: 403 Forbidden: bot was blocked by the user' }),
      ];

      await supersedePrefix('customer', prefix, at(-1000));
      for (const r of target) expect(await one(r.id)).toEqual({ ...r, failedAt: at(-1000), lastError: SUPERSEDED });
      for (const r of untouched) expect(await one(r.id)).toEqual(r);
      expect(await outboxStats(T0)).toEqual({ pending: 7, stuck: 0, failed24h: 1 });

      expect(await flushOutbox(at(3 * HOUR))).toEqual({ sent: 7, retry: 0, failed: 0 });
      expect(via()).toEqual([...Array<string>(6).fill(`${CUSTOMER} 777`), `${STAFF} 777`]);
      expect(perChat()).toEqual({ 777: 7 });
    });
  });

  describe('navbat holati va tozalash', () => {
    it('outboxStats: kutayotganlar, bir soatdan beri kutayotganlar, oxirgi 24 soatda "yuborilmadi" bo\'lganlar', async () => {
      expect(await outboxStats(T0)).toEqual({ pending: 0, stuck: 0, failed24h: 0 });

      await add({ chatId: 'yangi', createdAt: at(-59 * MIN) }); // kutyapti, hali bir soat bo'lmagan
      await add({ chatId: 'eski', createdAt: at(-61 * MIN), attempts: OUTBOX_MAX_ATTEMPTS - 1 }); // tiqilib qolgan, oxirgi urinishi qolgan
      await add({ chatId: 'kutyapti', createdAt: at(-10 * HOUR), nextAt: at(2 * HOUR), attempts: 5 }); // navbatdagi urinishini kutyapti — baribir bir soatdan oshgan
      await add({ chatId: 'yetgan', createdAt: at(-10 * HOUR), sentAt: at(-9 * HOUR), lastError: null });
      await add({ chatId: 'kecha', createdAt: at(-30 * HOUR), failedAt: at(-23 * HOUR) }); // oxirgi sutkada yuborilmadi
      await add({ chatId: 'avvalgi', createdAt: at(-50 * HOUR), failedAt: at(-25 * HOUR) });
      expect(await outboxStats(T0)).toEqual({ pending: 3, stuck: 2, failed24h: 1 });
      expect(await outboxStats(at(2 * HOUR))).toEqual({ pending: 3, stuck: 3, failed24h: 0 });

      // Tick'dan keyin: "yangi" yetib bordi, "eski" oxirgi urinishida ham o'tmadi
      net.reply = (m) => (m.chat === 'eski' ? offline() : OK());
      expect(await flushOutbox(T0)).toEqual({ sent: 1, retry: 0, failed: 1 });
      expect(chats()).toEqual(['yangi', 'eski']);
      expect(await outboxStats(T0)).toEqual({ pending: 1, stuck: 1, failed24h: 2 });
    });

    it('outboxStats: o\'rnini yangisi bosgan (eskirgan) xabarlar "yuborilmadi" hisobiga kirmaydi; tokeni qaytmagan bot xabarlari kiradi', async () => {
      await add({ chatId: 'a', topic: STATUS, createdAt: at(-5 * HOUR), failedAt: at(-HOUR), lastError: SUPERSEDED });
      await add({ chatId: 'b', topic: STATUS, createdAt: at(-5 * HOUR), failedAt: at(-2 * HOUR), lastError: SUPERSEDED, attempts: 4 });
      expect(await outboxStats(T0)).toEqual({ pending: 0, stuck: 0, failed24h: 0 });

      await add({ bot: 'staff', chatId: 'c', createdAt: at(-3 * DAY), failedAt: at(-HOUR), lastError: NO_TOKEN });
      await add({ chatId: 'd', topic: STATUS, createdAt: at(-5 * HOUR), failedAt: at(-HOUR), lastError: 'Telegram sendMessage: 403 Forbidden: bot was blocked by the user' }); // mavzuli, lekin haqiqiy xato
      await add({ chatId: 'e', topic: STATUS, createdAt: at(-5 * HOUR), nextAt: at(HOUR) }); // mavzuli va kutyapti
      expect(await outboxStats(T0)).toEqual({ pending: 1, stuck: 1, failed24h: 2 });
    });

    // SQL'da NOT ("lastError" = 'eskirgan') xatosi yozilmagan (NULL) qatorni ham tashlab yuboradi — bu faqat haqiqiy bazada ko'rinadi
    it('outboxStats: xato matni yozilmagan (NULL) "yuborilmadi" xabar ham sanaladi — faqat "eskirgan" belgisi borlari chiqarib tashlanadi', async () => {
      await add({ chatId: 'a', failedAt: at(-HOUR), attempts: 6, lastError: null });
      await add({ chatId: 'b', topic: STATUS, failedAt: at(-HOUR), lastError: null });
      expect(await outboxStats(T0)).toEqual({ pending: 0, stuck: 0, failed24h: 2 });

      await add({ chatId: 'c', topic: STATUS, failedAt: at(-HOUR), lastError: SUPERSEDED });
      await add({ chatId: 'd', failedAt: at(-HOUR), lastError: `${SUPERSEDED} emas` }); // belgiga o'xshash, lekin boshqa matn
      await add({ chatId: 'e', failedAt: at(-25 * HOUR), lastError: null }); // sutkadan oldin
      await add({ chatId: 'f', sentAt: at(-HOUR), lastError: null }); // yetib borgan: xatosi yo'q, "yuborilmadi" ham emas
      expect(await outboxStats(T0)).toEqual({ pending: 0, stuck: 0, failed24h: 3 });
    });

    it('tozalash: 3 kundan eski yetkazilganlar va 30 kundan eski "yuborilmadi"lar (eskirganlar ham) o\'chadi — boshqa hech narsa', async () => {
      const gone = [
        await add({ chatId: 'sent-old', sentAt: at(-3 * DAY - 1000), lastError: null }),
        await add({ chatId: 'failed-old', failedAt: at(-30 * DAY - 1000), attempts: 6 }),
        await add({ chatId: 'superseded-old', topic: STATUS, failedAt: at(-30 * DAY - 1000), lastError: SUPERSEDED }),
        await add({ bot: 'driver', chatId: 'no-token-old', failedAt: at(-30 * DAY - 1000), lastError: NO_TOKEN }),
      ];
      const kept = [
        await add({ chatId: 'sent-fresh', sentAt: at(-3 * DAY + MIN), lastError: null }),
        await add({ chatId: 'failed-fresh', failedAt: at(-30 * DAY + MIN), attempts: 6 }),
        await add({ chatId: 'failed-4d', failedAt: at(-4 * DAY), attempts: 2 }), // "yuborilmadi" 3 kunda emas, 30 kunda o'chadi
        await add({ chatId: 'superseded-4d', topic: STATUS, failedAt: at(-4 * DAY), lastError: SUPERSEDED }), // eskirgan ham 30 kun turadi
        await add({ chatId: 'waiting', createdAt: at(-100 * DAY), nextAt: at(HOUR), attempts: 5 }), // juda eski, lekin hali kutyapti
      ];
      const due = await add({ chatId: 'due', createdAt: at(-40 * DAY) }); // shu tick'da yetkaziladi — o'chmaydi

      expect(await flushOutbox(T0)).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect(chats()).toEqual(['due']);
      const rows = await all();
      expect(rows.map((r) => r.id)).toEqual([...kept.map((r) => r.id), due.id]);
      expect(rows.slice(0, kept.length)).toEqual(kept);
      expect(rows.some((r) => gone.some((g) => g.id === r.id))).toBe(false);

      // Ikki kundan keyin navbat ularga ham yetadi: "sent-fresh" 3 kundan, "failed-fresh" 30 kundan oshdi; hozirgina va bugun yetkazilganlar qoladi
      expect(await flushOutbox(at(2 * DAY))).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect((await all()).map((r) => r.chatId)).toEqual(['failed-4d', 'superseded-4d', 'waiting', 'due']);
    });
  });
});
