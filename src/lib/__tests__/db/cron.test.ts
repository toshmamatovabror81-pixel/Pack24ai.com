import { Prisma, type CorporateInvoice, type User } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOutbox, DB_TESTS, fixture, outbox, prisma, type Fixture } from './helpers';

/**
 * settingsDown: sozlamalarni o'qib bo'lmaydigan holat — kunlik tekshiruv shu yerda yiqiladi (eslatma sozlamalarga murojaat qilmaydi).
 * queueDown: xabarlar navbati (BotOutbox) jadvali o'qilmaydigan holat. queueIds: navbatga shu faylning o'zi qo'ygan yozuvlar.
 */
const h = vi.hoisted(() => ({ settingsDown: false, queueDown: false, queueIds: [] as number[] }));

vi.mock('server-only', () => ({}));
/**
 * Xabarlar navbati (BotOutbox) butun bazaga bitta: har bir tick (flushOutbox) vaqti kelgan HAR QANDAY yozuvni yuboradi, eskilarini
 * "yuborilmadi" deb belgilaydi va o'chiradi. Baza fayllari bitta bazada parallel ishlaydi, shu faylning ticklari esa 2031-yilda:
 * cheklanmasa boshqa fayllarning kutayotgan yozuvlari shu yerdan "eskirgan" bo'lib yoki o'chib ketardi, bu yerdagi sanoqlar esa
 * o'zgalarning yozuvlariga bog'liq bo'lib qolardi (boshqa fayl haqiqiy xabarnoma bilan shu faylning xodimlariga ham xabar qo'yishi mumkin).
 * Shuning uchun bu faylda navbatning faqat shu fayl testlari qo'ygan yozuvlari ko'rinadi: `create` yozuv raqamini eslab qoladi,
 * qolgan har bir so'rov shartiga "id shulardan biri" qo'shiladi. So'rovlarning o'zi va baza haqiqiy.
 */
vi.mock('@/lib/db', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/db')>();
  const filtered = ['count', 'findMany', 'findFirst', 'updateMany', 'deleteMany'];
  const queue = new Proxy(real.prisma.botOutbox, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop);
      if (typeof prop !== 'string' || typeof value !== 'function') return value;
      if (prop === 'create') {
        return async (args: object) => {
          const row = await (value as (a: object) => Promise<{ id: number }>).call(target, args);
          h.queueIds.push(row.id);
          return row;
        };
      }
      // Shart qo'shib bo'lmaydigan so'rov (update, delete, upsert ...) jim o'tib ketmasin: kod shunday so'rov ishlata boshlasa test to'xtaydi
      if (!filtered.includes(prop)) return () => { throw new Error(`test: botOutbox.${prop} bu faylda kutilmagan (navbatni o'z yozuvlari bilan cheklab bo'lmaydi)`); };
      return (args: { where?: object } = {}) => {
        if (h.queueDown) return Promise.reject(new Error('test: navbat jadvalini o\'qib bo\'lmadi'));
        return (value as (a: object) => unknown).call(target, { ...args, where: { AND: [args.where ?? {}, { id: { in: h.queueIds } }] } });
      };
    },
  });
  const prisma = new Proxy(real.prisma, {
    get(target, prop) {
      if (prop === 'botOutbox') return queue;
      const value: unknown = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { prisma };
});
vi.mock('@/lib/telegram/notify', async () => (await import('./helpers')).notifyMock());
// Xavfsizlik to'ri: bu faylda AI kaliti yo'q va so'rov yuborilmasligi kerak; kod xato qilib yuborsa ham u tarmoqqa chiqmaydi
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const real = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  class Offline extends real.default {
    constructor(options: ConstructorParameters<typeof real.default>[0] = {}) {
      super({ ...options, fetch: async () => { throw new Error('test: Anthropic API ga so\'rov ketmasligi kerak'); } });
    }
  }
  return { ...real, default: Offline };
});
// Kunlik tekshiruv ombor chegarasini ham o'qiydi — umumiy test sozlamalariga shu qo'shiladi
vi.mock('@/lib/settings', async () => {
  const { TEST_SETTINGS } = await import('./helpers');
  return {
    getSettings: async () => {
      if (h.settingsDown) throw new Error('test: sozlamalarni o\'qib bo\'lmadi');
      return { ...TEST_SETTINGS, lowStockThreshold: 10 };
    },
  };
});

const { collectChecks, reportChecks } = await import('@/lib/ai/audit');
const { runTick, tashkentClock } = await import('@/lib/cron');
const { overdueInvoiceWhere } = await import('@/lib/invoiceStatus');
const { sendDailyDigest } = await import('@/lib/orderNotify');

// Toshkent = UTC+5: 02:59Z — 07:59, 03:00Z — 08:00, 03:59Z — 08:59, 05:00Z — 10:00, 19:00Z — ertasi kuni 00:00
const at = (iso: string) => new Date(iso);
const OVERDUE = "Muddati o'tgan hisob-fakturalar";
const STALE = '24 soatdan beri qabul qilinmagan buyurtmalar';
const AUDIT = '🧭 <b>Kunlik tekshiruv</b>';

// Sof hisob — bazasiz, oddiy `npm test` da ham tekshiriladi
describe('cron: Toshkent vaqti', () => {
  it('tashkentClock: sana va soat UTC+5 bo\'yicha', () => {
    expect(tashkentClock(at('2031-03-10T03:59:00Z'))).toEqual({ day: '2031-03-10', hour: 8 });
    expect(tashkentClock(at('2031-03-10T18:59:59Z'))).toEqual({ day: '2031-03-10', hour: 23 });
    expect(tashkentClock(at('2031-03-10T19:00:00Z'))).toEqual({ day: '2031-03-11', hour: 0 });
  });
});

describe.skipIf(!DB_TESTS)('cron: kunlik tekshiruv va eslatma (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;
  let saved: { value: Prisma.JsonValue; updatedAt: Date } | null | undefined; // undefined — hali o'qilmagan
  let manager: User;
  let worker: User;
  let invoice: CorporateInvoice;

  // Shu fayldagi ticklar 2031-yil yanvar–aprel sanalarida: tekshiruv hisobotlari (AuditReport) shu oraliq bo'yicha tozalanadi —
  // boshida ham (uzilib qolgan oldingi ishga tushirishdan qolgani sanoqlarni buzmasin), oxirida ham
  const dropReports = () => prisma.auditReport.deleteMany({ where: { createdAt: { gte: at('2031-01-01T00:00:00Z'), lt: at('2031-05-01T00:00:00Z') } } });
  const state = async () => (await prisma.siteSetting.findUnique({ where: { key: 'cron' } }))?.value ?? null;
  const sentTo = (u: User) => outbox.staff.filter((m) => m.to === u.telegramId).map((m) => m.html);
  // Tekshiruv xabari ham "Muddati o'tgan hisob-fakturalar" degan satrni o'z ichiga oladi — xabar turi sarlavhasidan ajratiladi
  const auditTo = (u: User) => sentTo(u).filter((html) => html.startsWith(AUDIT));
  const digestTo = (u: User) => sentTo(u).filter((html) => !html.startsWith(AUDIT));
  const reportsAt = (now: Date) => prisma.auditReport.findMany({ where: { trigger: 'cron', createdAt: now } });
  /** Shu Toshkent kunida (kun boshi — 19:00Z) saqlangan kunlik hisobotlar soni */
  const reportsOnDay = (dayStartUtc: string) => prisma.auditReport.count({ where: { trigger: 'cron', createdAt: { gte: at(dayStartUtc), lt: new Date(at(dayStartUtc).getTime() + 86_400_000) } } });
  /** Tekshiruv bajarilishi kutilgan tick; natijasi tayyor bo'lishi shart: kechikkan ("running") yoki yiqilgan ("failed") bo'lsa test to'xtaydi */
  const auditTick = async (now: Date) => {
    const result = await runTick(now);
    if (!result.audit || typeof result.audit === 'string') throw new Error(`tekshiruv bajarilmadi: ${JSON.stringify(result)}`);
    return { digest: result.digest, audit: result.audit, outbox: result.outbox };
  };

  // ── Xabarlar navbati (BotOutbox). Bu faylda xabarnoma (notify) soxta — navbatga faqat testning o'zi yozuv qo'yadi
  /** Navbatda yuboradigan narsa bo'lmagan tick natijasi */
  const NOTHING_QUEUED = { sent: 0, retry: 0, failed: 0 };
  const STAFF_TOKEN = '222:staff';
  /**
   * Boshqaruv boti "ulangan" server: token bor, Telegram o'rnida soxta fetch. Yetib borgan xabarlar `sent` ga yig'iladi;
   * `online = false` — Telegram javob bermayapti (tarmoq xatosi). Boshqa manzilga so'rov ketsa xato.
   */
  const telegram = () => {
    vi.stubEnv('STAFF_BOT_TOKEN', STAFF_TOKEN);
    const net = { online: true, sent: [] as { chat: string; text: string }[], attempts: 0 };
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      if (url !== `https://api.telegram.org/bot${STAFF_TOKEN}/sendMessage`) throw new Error(`test: kutilmagan manzilga so'rov: ${url}`);
      net.attempts += 1;
      if (!net.online) throw new Error('ECONNRESET');
      const body = JSON.parse(init.body) as { chat_id: unknown; text: string };
      net.sent.push({ chat: String(body.chat_id), text: body.text });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    });
    return net;
  };
  /** Navbatda turgan xodim xabari: birinchi urinish (darhol yuborish) o'tmagan, keyingisi `nextAt` da */
  const queued = (to: User, html: string, nextAt: Date) =>
    prisma.botOutbox.create({ data: { bot: 'staff', chatId: to.telegramId ?? '', html, attempts: 1, nextAt, lastError: 'fetch failed', createdAt: new Date(nextAt.getTime() - 5 * 60_000) } });
  const queueRow = (id: number) => prisma.botOutbox.findFirst({ where: { id } });
  const queueLogs = (log: { mock: { calls: unknown[][] } }) => log.mock.calls.filter((c) => String(c[0]).includes('[cron] xabarlar navbati'));

  beforeAll(async () => {
    fx = await fixture(5);
    // "cron" yozuvi butun bazaga bitta: oldingi qiymatni saqlab, oxirida joyiga qaytaramiz
    saved = await prisma.siteSetting.findUnique({ where: { key: 'cron' }, select: { value: true, updatedAt: true } });
    await prisma.siteSetting.deleteMany({ where: { key: 'cron' } });
    await dropReports();

    manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
    worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
    // Muddati eng eski sana: bazadagi boshqa hisob-fakturalar orasida ham ro'yxatning boshida (dastlabki 15 talikda) turadi
    const invoiced = await fx.order({ customerName: 'Test <MChJ>', status: 'processing', paymentMethod: 'bank_transfer' });
    invoice = await fx.invoice({ orderId: invoiced.id, total: 1200000, paid: 200000, status: 'partial', dueDate: new Date(0) });
    // Birinchi tick (2031-03-10 05:00Z) dan 25 soat oldin yaratilgan — 24 soatdan beri "Yangi" turgani haqiqiy sanaga bog'liq emas
    await fx.order({ status: 'new_', createdAt: at('2031-03-09T04:00:00Z') });
  });
  afterAll(async () => {
    if (saved !== undefined) {
      await prisma.siteSetting.deleteMany({ where: { key: 'cron' } });
      if (saved) await prisma.siteSetting.create({ data: { key: 'cron', value: saved.value ?? Prisma.JsonNull, updatedAt: saved.updatedAt } });
    }
    await dropReports();
    // Shu fayl navbatga qo'ygan yozuvlar (so'rov faqat o'shalarga tegadi — yuqoridagi @/lib/db ga qarang)
    h.queueDown = false;
    await prisma.botOutbox.deleteMany({});
    await fx?.cleanup();
    await prisma.$disconnect();
  });
  beforeEach(() => {
    clearOutbox();
    h.settingsDown = false;
    h.queueDown = false;
    // AI kaliti kiritilmagan server: tekshiruv xulosasiz saqlanadi va Anthropic'ka hech narsa ketmaydi
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    // Bot tokenlari ham kiritilmagan (navbat testlari o'zi yoqadi): tick hech narsa yubormaydi. Yuborsa ham — tarmoqqa chiqmaydi
    for (const name of ['CUSTOMER_BOT_TOKEN', 'STAFF_BOT_TOKEN', 'SUPERVISOR_BOT_TOKEN', 'TELEGRAM_API_BASE']) vi.stubEnv(name, '');
    vi.stubGlobal('fetch', async (url: string) => { throw new Error(`test: tarmoqqa so'rov ketmasligi kerak (${url})`); });
  });
  afterEach(() => {
    h.settingsDown = false;
    h.queueDown = false;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Toshkent vaqti bilan 08:00 gacha hech narsa bajarilmaydi va belgi qo\'yilmaydi', async () => {
    const early = at('2031-03-10T02:59:59Z'); // 07:59:59
    // Kunlik ishlar hali yo'q; xabarlar navbati esa har tickda ko'riladi (bu yerda bo'sh)
    expect(await runTick(early)).toEqual({ digest: null, audit: null, outbox: NOTHING_QUEUED });
    expect(outbox.staff).toEqual([]);
    expect(await state()).toBeNull();
    expect(await reportsAt(early)).toEqual([]);
  });

  it('08:00 dan 09:00 gacha faqat kunlik tekshiruv: hisobot saqlanadi va "reports" xodimlariga boradi, eslatma hali yuborilmaydi', async () => {
    const now = at('2031-03-10T03:00:00Z'); // aynan 08:00
    const first = await auditTick(now);
    expect(first.digest).toBeNull();
    expect(first.audit).toEqual({ findings: expect.any(Number), sent: expect.any(Number), ai: false });
    expect(first.audit.sent).toBeGreaterThanOrEqual(1);
    expect(first.outbox).toEqual(NOTHING_QUEUED);
    expect(await state()).toEqual({ auditDay: '2031-03-10' });

    // Hisobot: AI kaliti yo'q — xulosasiz; muddati 1970-yilda tugagan hisob-faktura topilmalar ichida
    const rows = await reportsAt(now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ trigger: 'cron', summary: null, model: null });
    const checks = reportChecks(rows[0].checks);
    expect(checks).toHaveLength(first.audit.findings);
    expect(checks.find((c) => c.key === 'overdue_invoices')?.count).toBeGreaterThanOrEqual(1);
    // Hisobotga buyurtma va hisob-faktura raqamlari tushadi, mijoz nomi ("Test <MChJ>") esa yo'q
    expect(JSON.stringify(rows[0].checks)).not.toContain('MChJ');

    // Menejerda "reports" ruxsati bor — bitta xabar (tekshiruv); oddiy xodimda yo'q. Moliya va buyurtma eslatmasi hali kelmagan
    expect(sentTo(manager)).toHaveLength(1);
    expect(auditTo(manager)).toHaveLength(1);
    expect(auditTo(manager)[0]).toContain(`${OVERDUE} (jami qoldiq`);
    expect(auditTo(manager)[0]).not.toContain('MChJ');
    expect(sentTo(worker)).toEqual([]);

    // 08:59 da: tekshiruv takrorlanmaydi, eslatma vaqti ham hali kelmagan
    clearOutbox();
    expect(await runTick(at('2031-03-10T03:59:59Z'))).toEqual({ digest: null, audit: null, outbox: NOTHING_QUEUED });
    expect(outbox.staff).toEqual([]);
    expect(await state()).toEqual({ auditDay: '2031-03-10' });
    expect(await reportsOnDay('2031-03-09T19:00:00Z')).toBe(1);
  });

  it('10:00 da bir marta yuboriladi, shu kuni takrorlanmaydi, ertasi kuni yana yuboriladi', async () => {
    const first = await runTick(at('2031-03-10T05:00:00Z'));
    expect(first.audit).toBeNull(); // tekshiruv bugun 08:00 da bajarilgan — eslatma bilan birga qayta ishlamaydi
    expect(first.digest?.finance).toBeGreaterThanOrEqual(1);
    expect(first.digest?.orders).toBeGreaterThanOrEqual(1);
    expect(first.outbox).toEqual(NOTHING_QUEUED); // faqat bitta kunlik ish — navbat shu tickda ham ko'rilgan
    expect(await state()).toEqual({ auditDay: '2031-03-10', digestDay: '2031-03-10' });
    // Tekshiruv fonda ham qayta boshlanmagan: xodimlarga ikkinchi "Kunlik tekshiruv" xabari kelmagan (keyingi ticklardan so'ng yana tekshiriladi)
    expect(auditTo(manager)).toEqual([]);

    // Menejer: moliya va buyurtmalar eslatmasi; oddiy xodimda moliya ruxsati yo'q — faqat buyurtmalar
    const toManager = sentTo(manager);
    expect(toManager).toHaveLength(2);
    expect(toManager[0]).toContain(OVERDUE);
    expect(toManager[0]).toContain(`<b>${invoice.invoiceNo}</b>`);
    expect(toManager[0]).toMatch(/1\s000\s000 so'm/);
    expect(toManager[0]).toContain('Test &lt;MChJ&gt;');
    expect(toManager[1]).toContain(STALE);
    const toWorker = sentTo(worker);
    expect(toWorker).toHaveLength(1);
    expect(toWorker[0]).toContain(STALE);

    clearOutbox();
    const quiet = { digest: null, audit: null, outbox: NOTHING_QUEUED };
    expect(await runTick(at('2031-03-10T05:05:00Z'))).toEqual(quiet);
    expect(await runTick(at('2031-03-10T18:59:00Z'))).toEqual(quiet);
    expect(await runTick(at('2031-03-10T19:00:00Z'))).toEqual(quiet); // ertasi kun boshlandi, lekin hali 08:00 emas
    expect(outbox.staff).toEqual([]);
    expect(await state()).toEqual({ auditDay: '2031-03-10', digestDay: '2031-03-10' });
    // Kun bo'yi bitta hisobot — ertalabki (08:00); eslatma tickida (10:00) ikkinchisi saqlanmagan
    expect(await reportsAt(at('2031-03-10T05:00:00Z'))).toEqual([]);
    expect(await reportsOnDay('2031-03-09T19:00:00Z')).toBe(1);

    // Ertasi kuni birinchi tick 10:00 da keladi (masalan server ertalab o'chiq edi): tekshiruv ham, eslatma ham shu tickda bajariladi
    const nextDay = at('2031-03-11T05:00:00Z');
    const next = await auditTick(nextDay);
    expect(next.audit.ai).toBe(false);
    expect(next.digest?.finance).toBeGreaterThanOrEqual(1);
    // Ikkala kunlik ish bitta tickda: navbat shu safar yuborilmaydi (cron so'rovining 60 soniyasiga sig'ish uchun) — keyingi tick yuboradi
    expect(next.outbox).toBeNull();
    expect(await state()).toEqual({ auditDay: '2031-03-11', digestDay: '2031-03-11' });
    expect(await reportsAt(nextDay)).toHaveLength(1);
    expect(auditTo(manager)).toHaveLength(1);
    expect(digestTo(manager)).toHaveLength(2);
    expect(sentTo(worker)).toHaveLength(1);
    expect(sentTo(worker)[0]).toContain(STALE);

    clearOutbox();
    expect(await runTick(at('2031-03-11T05:05:00Z'))).toEqual(quiet);
    expect(outbox.staff).toEqual([]);
    expect(await reportsAt(at('2031-03-11T05:05:00Z'))).toEqual([]);
  });

  // Yangilanish kuni serverda eski koddan qolgan holat bo'ladi: faqat { digestDay } — eslatma bugun yuborilgan, tekshiruv esa hali yo'q
  it('eski holat ({ digestDay } faqat): tekshiruv shu kuniyoq bajariladi, bugungi eslatma takrorlanmaydi', async () => {
    const value = { digestDay: '2031-03-12' };
    await prisma.siteSetting.upsert({ where: { key: 'cron' }, create: { key: 'cron', value }, update: { value } });
    const now = at('2031-03-12T09:00:00Z'); // 14:00
    const result = await auditTick(now);
    expect(result.digest).toBeNull();
    expect(result.audit.findings).toBeGreaterThanOrEqual(1);
    expect(result.outbox).toEqual(NOTHING_QUEUED);
    expect(await state()).toEqual({ digestDay: '2031-03-12', auditDay: '2031-03-12' });
    expect(await reportsAt(now)).toHaveLength(1);
    expect(auditTo(manager)).toHaveLength(1);
    expect(digestTo(manager)).toEqual([]);
    expect(sentTo(worker)).toEqual([]);

    clearOutbox();
    expect(await runTick(at('2031-03-12T09:05:00Z'))).toEqual({ digest: null, audit: null, outbox: NOTHING_QUEUED });
    expect(outbox.staff).toEqual([]);
  });

  it('tekshiruv 90 kundan eski hisobotlarni o\'chiradi, yangilariga tegmaydi', async () => {
    // 13-aprel 08:00 dagi tick uchun: 1-yanvardagi hisobot 102 kunlik, 13-yanvardagisi aynan 90 kunlik, 10-martdagisi 34 kunlik
    const stale = at('2031-01-01T03:00:00Z');
    const kept = at('2031-01-13T03:00:00Z'); // aynan 90 kun — hali o'chmaydi
    await prisma.auditReport.createMany({ data: [stale, kept].map((createdAt) => ({ trigger: 'cron', checks: [], createdAt })) });

    const result = await auditTick(at('2031-04-13T03:00:00Z'));
    expect(result.digest).toBeNull(); // 08:00 — eslatma vaqti emas
    expect(await reportsAt(stale)).toEqual([]);
    expect(await reportsAt(kept)).toHaveLength(1);
    expect(await reportsAt(at('2031-03-10T03:00:00Z'))).toHaveLength(1);
    expect(await reportsAt(at('2031-04-13T03:00:00Z'))).toHaveLength(1);
  });

  // Kun tekshiruvdan OLDIN belgilanadi (ikki marta yuborgandan ko'ra yaxshi), shuning uchun yiqilgan tekshiruv o'sha kuni qayta urinilmaydi.
  // Tick javobida bu "running" (fonda davom etyapti) emas, "failed" bo'lib ko'rinishi kerak — aks holda xato faqat logda qoladi
  it('tekshiruv xato bilan tugasa: tick javobida "failed", kun belgilangan, shu tickdagi eslatma esa yuboriladi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await prisma.siteSetting.deleteMany({ where: { key: 'cron' } });
    h.settingsDown = true;
    const now = at('2031-03-16T05:00:00Z'); // 10:00 — tekshiruv ham, eslatma ham shu tickda

    const result = await runTick(now);
    expect(result.audit).toBe('failed');
    expect(result.digest?.finance).toBeGreaterThanOrEqual(1);
    expect(result.digest?.orders).toBeGreaterThanOrEqual(1);
    expect(result.outbox).toBeNull(); // ikkala kunlik ish bitta tickda — navbat keyingi tickka qoldirilgan
    expect(await state()).toEqual({ auditDay: '2031-03-16', digestDay: '2031-03-16' });
    // Hisobot saqlanmagan, tekshiruv xabari ketmagan; eslatma esa odatdagidek: menejerga moliya va buyurtmalar, xodimga buyurtmalar
    expect(await reportsOnDay('2031-03-15T19:00:00Z')).toBe(0);
    expect(auditTo(manager)).toEqual([]);
    expect(digestTo(manager)).toHaveLength(2);
    expect(digestTo(manager)[0]).toContain(OVERDUE);
    expect(digestTo(manager)[1]).toContain(STALE);
    expect(sentTo(worker)).toHaveLength(1);
    expect(sentTo(worker)[0]).toContain(STALE);
    // Sababi logda: qaysi ish va qanday xato
    const failure = log.mock.calls.find((c) => String(c[0]).includes('[cron] kunlik tekshiruv'));
    expect(String(failure?.[1])).toContain('sozlamalarni o\'qib bo\'lmadi');

    // Sozlamalar tiklandi, lekin shu kuni tekshiruv ham, eslatma ham takrorlanmaydi
    h.settingsDown = false;
    clearOutbox();
    expect(await runTick(at('2031-03-16T05:05:00Z'))).toEqual({ digest: null, audit: null, outbox: NOTHING_QUEUED });
    expect(await runTick(at('2031-03-16T18:59:00Z'))).toEqual({ digest: null, audit: null, outbox: NOTHING_QUEUED });
    expect(outbox.staff).toEqual([]);
    expect(await reportsOnDay('2031-03-15T19:00:00Z')).toBe(0);

    // Ertasi kuni tekshiruv odatdagidek bajariladi
    const next = await auditTick(at('2031-03-17T03:00:00Z'));
    expect(next.digest).toBeNull();
    expect(next.audit).toEqual({ findings: expect.any(Number), sent: expect.any(Number), ai: false });
    expect(next.audit.findings).toBeGreaterThanOrEqual(1);
    expect(await state()).toEqual({ auditDay: '2031-03-17', digestDay: '2031-03-16' });
    expect(await reportsAt(at('2031-03-17T03:00:00Z'))).toHaveLength(1);
    expect(auditTo(manager)).toHaveLength(1);
  });

  it('faqat tekshiruv vaqti kelgan tickda (08:00) tekshiruv yiqilsa: "failed", eslatma esa o\'z vaqtida (09:00) alohida yuboriladi', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await prisma.siteSetting.deleteMany({ where: { key: 'cron' } });
    h.settingsDown = true;
    expect(await runTick(at('2031-03-18T03:00:00Z'))).toEqual({ digest: null, audit: 'failed', outbox: NOTHING_QUEUED });
    expect(await state()).toEqual({ auditDay: '2031-03-18' });
    expect(outbox.staff).toEqual([]);

    // 09:00: sozlamalar hamon o'qilmayapti — eslatmaga bu ta'sir qilmaydi, tekshiruv esa bugun qayta boshlanmaydi
    const nine = await runTick(at('2031-03-18T04:00:00Z'));
    expect(nine.audit).toBeNull();
    expect(nine.digest?.finance).toBeGreaterThanOrEqual(1);
    expect(nine.outbox).toEqual(NOTHING_QUEUED);
    expect(await state()).toEqual({ auditDay: '2031-03-18', digestDay: '2031-03-18' });
    expect(auditTo(manager)).toEqual([]);
    expect(digestTo(manager)).toHaveLength(2);
    expect(await reportsOnDay('2031-03-17T19:00:00Z')).toBe(0);
  });

  // ── Xabarlar navbati tick ichida: Telegram'ga yetib bormagan bot xabarlari har 5 daqiqalik signalda qayta yuboriladi.
  //    Navbatning o'z qoidalari (urinishlar oralig'i, eskirish, tozalash) — db/outbox.test.ts da; bu yerda — tick bilan bog'lanishi

  it('test sozlamasi: bu fayl navbatda faqat o\'zi qo\'ygan yozuvlarni ko\'radi — boshqa fayllarning yozuvlari yuborilmaydi, eskirmaydi va o\'chmaydi', async () => {
    const net = telegram();
    // Boshqa fayl qo'ygan yozuv (to'g'ridan-to'g'ri SQL bilan — shu faylning `create` hisobiga kirmaydi), ustiga shu faylning xodimiga
    // atalgan: haqiqiy xabarnoma ishlatadigan fayllar bazadagi HAMMA ulangan xodimga xabar qo'yadi. Shu faylning 2031-yilgi ticklari
    // uchun u "vaqti kelgan" va "2 kundan eski" — cheklov bo'lmasa yuborilardi, token bo'lmasa "yuborilmadi" deb belgilanardi
    const [foreign] = await prisma.$queryRaw<{ id: number }[]>`
      INSERT INTO "BotOutbox" ("bot", "chatId", "html", "attempts", "nextAt", "lastError")
      VALUES ('staff', ${manager.telegramId}, 'boshqa faylning xabari', 1, ${at('2030-06-01T00:00:00Z')}, 'fetch failed') RETURNING "id"`;
    const untouched = async () => (await prisma.$queryRaw<{ attempts: number; sentAt: Date | null; failedAt: Date | null }[]>`SELECT "attempts", "sentAt", "failedAt" FROM "BotOutbox" WHERE "id" = ${foreign.id}`)[0];
    try {
      expect((await runTick(at('2031-03-19T01:00:00Z'))).outbox).toEqual(NOTHING_QUEUED);
      expect(net.attempts).toBe(0);
      expect(await untouched()).toEqual({ attempts: 1, sentAt: null, failedAt: null });
      // Tokensiz tick (eskirganlarni belgilash va tozalash qadamlari) ham tegmaydi
      vi.stubEnv('STAFF_BOT_TOKEN', '');
      expect((await runTick(at('2031-03-19T01:05:00Z'))).outbox).toEqual(NOTHING_QUEUED);
      expect(await untouched()).toEqual({ attempts: 1, sentAt: null, failedAt: null });
    } finally {
      await prisma.$executeRaw`DELETE FROM "BotOutbox" WHERE "id" = ${foreign.id}`;
    }
  });

  it('tick navbatda vaqti kelgan xabarni yuboradi (outbox.sent = 1): yozuv "yuborildi" bo\'ladi va keyingi tickda takrorlanmaydi', async () => {
    const net = telegram();
    const now = at('2031-03-19T02:00:00Z'); // 07:00 — kunlik ishlarning vaqti emas
    const minute = 60_000;
    const marks = await state();
    const due = await queued(manager, '🆕 <b>Navbatdagi xabar</b>', new Date(now.getTime() - minute));
    const later = await queued(worker, 'Vaqti hali kelmagan xabar', new Date(now.getTime() + minute));

    expect(await runTick(now)).toEqual({ digest: null, audit: null, outbox: { sent: 1, retry: 0, failed: 0 } });
    expect(net.sent).toEqual([{ chat: manager.telegramId, text: '🆕 <b>Navbatdagi xabar</b>' }]);
    expect(await queueRow(due.id)).toMatchObject({ sentAt: now, failedAt: null, attempts: 2, lastError: null });
    expect(await queueRow(later.id)).toMatchObject({ sentAt: null, failedAt: null, attempts: 1 });

    // 5 daqiqadan keyingi tick: ikkinchisining vaqti keldi; yuborilgani qayta ketmaydi
    net.sent.length = 0;
    expect((await runTick(new Date(now.getTime() + 5 * minute))).outbox).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(net.sent).toEqual([{ chat: worker.telegramId, text: 'Vaqti hali kelmagan xabar' }]);
    expect((await runTick(new Date(now.getTime() + 10 * minute))).outbox).toEqual(NOTHING_QUEUED);
    expect(net.sent).toHaveLength(1);
    expect(net.attempts).toBe(2);
    // Navbat xabarlari kunlik ishlar belgisiga tegmaydi; xodimlarga boshqa (kunlik) xabar ham ketmagan
    expect(await state()).toEqual(marks);
    expect(outbox.staff).toEqual([]);
  });

  it('Telegram javob bermasa xabar navbatda qoladi (outbox.retry) va tick yiqilmaydi; aloqa tiklangach keyingi urinishda yetib boradi', async () => {
    const net = telegram();
    net.online = false;
    const now = at('2031-03-19T02:30:00Z');
    const minute = 60_000;
    const row = await queued(manager, 'Kechikkan xabar', new Date(now.getTime() - minute));

    expect(await runTick(now)).toEqual({ digest: null, audit: null, outbox: { sent: 0, retry: 1, failed: 0 } });
    expect(net.attempts).toBe(1);
    const waiting = await queueRow(row.id);
    expect(waiting).toMatchObject({ sentAt: null, failedAt: null, attempts: 2 });
    // Keyingi urinish kelajakka surilgan: 5 daqiqadan keyingi tick uni qayta yubormaydi
    expect(waiting?.nextAt.getTime()).toBeGreaterThan(now.getTime() + 5 * minute);
    net.online = true;
    expect((await runTick(new Date(now.getTime() + 5 * minute))).outbox).toEqual(NOTHING_QUEUED);
    expect(net.attempts).toBe(1);

    // O'z vaqtida (belgilangan keyingi urinishda) yetib boradi
    const retryAt = waiting?.nextAt ?? now;
    expect((await runTick(retryAt)).outbox).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(net.sent).toEqual([{ chat: manager.telegramId, text: 'Kechikkan xabar' }]);
    expect(await queueRow(row.id)).toMatchObject({ sentAt: retryAt, failedAt: null, attempts: 3 });
  });

  it('kunlik tekshiruv tickida ham navbat yuboriladi: tekshiruv natijasi va outbox.sent bitta javobda', async () => {
    const net = telegram();
    await prisma.siteSetting.deleteMany({ where: { key: 'cron' } });
    const now = at('2031-03-20T03:00:00Z'); // 08:00 — faqat tekshiruv vaqti
    const row = await queued(worker, 'Tekshiruv bilan bir tickda', new Date(now.getTime() - 60_000));

    const result = await auditTick(now);
    expect(result.digest).toBeNull();
    expect(result.audit.findings).toBeGreaterThanOrEqual(1);
    expect(result.outbox).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(net.sent).toEqual([{ chat: worker.telegramId, text: 'Tekshiruv bilan bir tickda' }]);
    expect(await queueRow(row.id)).toMatchObject({ sentAt: now, failedAt: null });
    expect(await reportsAt(now)).toHaveLength(1);
    expect(auditTo(manager)).toHaveLength(1);
  });

  // Telegram javob bermayotgan bo'lsa navbat ~25 soniya, tekshiruv yana 25 soniya kutadi, ustiga eslatma: uchalasi birga cron
  // so'rovining 60 soniyalik chegarasidan oshardi — shuning uchun ikkala kunlik ish tushgan tickda navbat keyingi tickka qoldiriladi
  it('ikkala kunlik ish bitta tickka tushsa navbat shu safar yuborilmaydi (outbox: null): xabar joyida qoladi va keyingi tickda ketadi', async () => {
    const net = telegram();
    await prisma.siteSetting.deleteMany({ where: { key: 'cron' } });
    const now = at('2031-03-21T05:00:00Z'); // 10:00 — tekshiruv ham, eslatma ham shu tickda
    const row = await queued(manager, 'Keyingi tickni kutadi', new Date(now.getTime() - 60_000));

    const result = await auditTick(now);
    expect(result.outbox).toBeNull();
    expect(result.digest?.finance).toBeGreaterThanOrEqual(1);
    expect(await state()).toEqual({ auditDay: '2031-03-21', digestDay: '2031-03-21' });
    // Navbatga tegilmagan: Telegram'ga urinish yo'q, yozuvning urinishlar soni va vaqti o'zgarmagan
    expect(net.attempts).toBe(0);
    expect(await queueRow(row.id)).toMatchObject({ sentAt: null, failedAt: null, attempts: 1, nextAt: row.nextAt });

    expect(await runTick(new Date(now.getTime() + 5 * 60_000))).toEqual({ digest: null, audit: null, outbox: { sent: 1, retry: 0, failed: 0 } });
    expect(net.sent).toEqual([{ chat: manager.telegramId, text: 'Keyingi tickni kutadi' }]);
  });

  it('navbatni yuborib bo\'lmasa (jadval o\'qilmadi): tick javobida outbox null, sababi logda; kunlik tekshiruv va eslatma baribir bajariladi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const net = telegram();
    await prisma.siteSetting.deleteMany({ where: { key: 'cron' } });
    const eight = at('2031-03-22T03:00:00Z');
    const row = await queued(manager, 'Navbat tiklangach ketadi', new Date(eight.getTime() - 60_000));
    h.queueDown = true;

    // 08:00 — tekshiruv vaqti: navbat yiqildi, tekshiruv esa bajarildi, saqlandi va yuborildi
    const first = await auditTick(eight);
    expect(first.outbox).toBeNull();
    expect(first.digest).toBeNull();
    expect(first.audit.findings).toBeGreaterThanOrEqual(1);
    expect(await reportsAt(eight)).toHaveLength(1);
    expect(auditTo(manager)).toHaveLength(1);
    expect(queueLogs(log)).toHaveLength(1);
    expect(String(queueLogs(log)[0][1])).toContain('navbat jadvalini o\'qib bo\'lmadi');

    // 09:00 — eslatma vaqti: navbat yana yiqildi, eslatma odatdagidek ketdi
    clearOutbox();
    const nine = await runTick(at('2031-03-22T04:00:00Z'));
    expect(nine.outbox).toBeNull();
    expect(nine.audit).toBeNull();
    expect(nine.digest?.finance).toBeGreaterThanOrEqual(1);
    expect(digestTo(manager)).toHaveLength(2);
    expect(await state()).toEqual({ auditDay: '2031-03-22', digestDay: '2031-03-22' });
    // Kunlik ishi yo'q tick ham yiqilmaydi
    await expect(runTick(at('2031-03-22T04:05:00Z'))).resolves.toEqual({ digest: null, audit: null, outbox: null });
    expect(queueLogs(log)).toHaveLength(3);
    expect(net.attempts).toBe(0);
    expect(log.mock.calls.map((c) => c.map(String).join(' ')).join('\n')).not.toContain(STAFF_TOKEN);

    // Baza tiklangach xabar yo'qolmagan: navbatdagi yozuv keyingi tickda yetib boradi
    h.queueDown = false;
    expect((await runTick(at('2031-03-22T04:10:00Z'))).outbox).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(net.sent).toEqual([{ chat: manager.telegramId, text: 'Navbat tiklangach ketadi' }]);
    expect(await queueRow(row.id)).toMatchObject({ sentAt: at('2031-03-22T04:10:00Z') });
  });

  // Xabar navbatda turgan paytda xodim ishdan ketgan bo'lishi mumkin: unga buyurtma ma'lumotlari keyinroq ham yetib bormasin
  it('navbatdagi xabarning oluvchisi endi xodim bo\'lmasa (o\'chirilgan yoki xabarnomani o\'chirgan): yuborilmaydi va navbatdan olib tashlanadi', async () => {
    const net = telegram();
    const now = at('2031-03-23T02:00:00Z');
    const gone = await fx.user({ role: 'staff', telegramId: fx.tg(), isActive: false });
    const quiet = await fx.user({ role: 'staff', telegramId: fx.tg(), telegramNotify: false });
    const toGone = await queued(gone, 'Ishdan ketgan xodimga', new Date(now.getTime() - 60_000));
    const toQuiet = await queued(quiet, 'Xabarnomani o\'chirgan xodimga', new Date(now.getTime() - 60_000));
    const toWorker = await queued(worker, 'Faol xodimga', new Date(now.getTime() - 60_000));

    // Yuborilmagan ikkitasi "yuborildi" ham, "yetkazilmadi" ham emas — ular shunchaki navbatdan chiqadi
    expect((await runTick(now)).outbox).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(net.sent).toEqual([{ chat: worker.telegramId, text: 'Faol xodimga' }]);
    expect(await queueRow(toGone.id)).toBeNull();
    expect(await queueRow(toQuiet.id)).toBeNull();
    expect(await queueRow(toWorker.id)).toMatchObject({ sentAt: now });
  });

  // Eski bazadan qolgan, holati bazada 'overdue' deb yozilgan hisob-fakturalar ham ochiq qarz (OPEN_INVOICE_STATUSES,
  // effectiveInvoiceStatus va admin paneldagi "Muddati o'tgan" filtri ularni hisobga oladi) — eslatmada ham chiqishi kerak.
  it('eski yozuv: holati bazada "overdue" bo\'lgan hisob-faktura ham eslatmada chiqadi', async () => {
    const o = await fx.order({ status: 'delivered', paymentMethod: 'bank_transfer' });
    const legacy = await fx.invoice({ orderId: o.id, total: 300000, status: 'overdue', dueDate: new Date(0) });

    await sendDailyDigest(at('2031-03-12T05:00:00Z'));
    const finance = sentTo(manager).filter((html) => html.includes(OVERDUE));
    expect(finance).toHaveLength(1);
    expect(finance[0].includes(`<b>${legacy.invoiceNo}</b>`)).toBe(true);
  });

  // Mijoz botidagi "Balans" bilan bir xil qoida (invoiceStatus.OWED_ORDER): aks holda xodimlar to'langan buyurtma uchun pul so'raydi
  it('to\'langan, puli qaytarilgan yoki bekor qilingan buyurtmaning ochiq hisob-fakturasi eslatmaga kirmaydi', async () => {
    const invoiceOf = async (order: Parameters<Fixture['order']>[0]) => {
      const o = await fx.order({ paymentMethod: 'bank_transfer', ...order });
      return fx.invoice({ orderId: o.id, total: 100000, dueDate: new Date(0) });
    };
    const owed = await invoiceOf({ status: 'delivered' });
    const paid = await invoiceOf({ status: 'delivered', paymentStatus: 'paid' });
    const refunded = await invoiceOf({ paymentStatus: 'refunded' });
    const cancelled = await invoiceOf({ status: 'cancelled' });
    const now = at('2031-03-13T05:00:00Z');

    const mine = { id: { in: [owed, paid, refunded, cancelled].map((i) => i.id) } };
    expect(await prisma.corporateInvoice.findMany({ where: { AND: [overdueInvoiceWhere(now), mine] }, select: { id: true } })).toEqual([{ id: owed.id }]);

    await sendDailyDigest(now);
    const [finance] = sentTo(manager).filter((html) => html.includes(OVERDUE));
    expect(finance).toContain(`<b>${owed.invoiceNo}</b>`);
    for (const hidden of [paid, refunded, cancelled]) expect(finance).not.toContain(`<b>${hidden.invoiceNo}</b>`);
  });

  it('muddat kunining o\'zida hisob-faktura eslatmaga kirmaydi: keyingi kun (Toshkent vaqti) boshlangachgina muddati o\'tgan sanaladi', async () => {
    const o = await fx.order({ status: 'processing', paymentMethod: 'bank_transfer' });
    // Muddat — Toshkentda 15.03.2031, 08:00 (hisob-faktura 7 kun oldin shu soatda berilgan); mijozga faqat sana ko'rsatilgan
    const due = await fx.invoice({ orderId: o.id, total: 100000, dueDate: at('2031-03-15T03:00:00Z') });
    const overdueAt = async (now: Date) => (await prisma.corporateInvoice.count({ where: { AND: [overdueInvoiceWhere(now), { id: due.id }] } })) === 1;

    expect(await overdueAt(at('2031-03-15T05:00:00Z'))).toBe(false); // o'sha kuni 10:00 — kunlik eslatma vaqti
    expect(await overdueAt(at('2031-03-15T18:59:59Z'))).toBe(false); // o'sha kuni 23:59:59
    expect(await overdueAt(at('2031-03-15T19:00:00Z'))).toBe(true); // ertasi kuni 00:00
  });

  // 40-belgisi emojining birinchi yarmiga to'g'ri keladigan nom: oddiy slice(0, 40) juftsiz surrogat qoldiradi va Telegram
  // bunday xabarni butunlay rad etadi (eslatma hech kimga yetib bormaydi)
  const EMOJI_NAME = `${'K'.repeat(39)}😀 MChJ`;

  it('moliya eslatmasi: mijoz nomi kesilganda yarim emoji qolmaydi', async () => {
    const o = await fx.order({ customerName: EMOJI_NAME, status: 'delivered', paymentMethod: 'bank_transfer' });
    const inv = await fx.invoice({ orderId: o.id, total: 100000, dueDate: new Date(0) });

    await sendDailyDigest(at('2031-03-14T05:00:00Z'));
    const [finance] = sentTo(manager).filter((html) => html.includes(OVERDUE));
    expect(finance.split('\n').find((line) => line.includes(`<b>${inv.invoiceNo}</b>`))).toMatch(new RegExp(` · ${'K'.repeat(39)}$`));
    expect(finance.isWellFormed()).toBe(true);
  });

  it('"Yangi" turgan buyurtmalar: sarlavhada haqiqiy son; 15 tadan ko\'p bo\'lsa ro\'yxatda 15 ta va "… yana N ta"', async () => {
    // Soat 1970-yilga qo'yiladi: bazadagi boshqa buyurtmalar (shu faylniki ham, boshqa test fayllariniki ham) bu "hozir"dan keyin
    // yaratilgan, shuning uchun ro'yxatga faqat shu testning buyurtmalari tushadi va sonlar aniq
    const created = at('1970-01-01T00:00:00Z');
    const now = at('1970-01-02T00:00:01Z');
    const first = await fx.order({ status: 'new_', createdAt: created, customerName: EMOJI_NAME, totalAmount: 250000 });
    for (let i = 0; i < 14; i += 1) await fx.order({ status: 'new_', createdAt: created });
    // Ro'yxatga kirmaydiganlar: qabul qilingan, o'chirilgan va yaratilganiga hali 24 soat to'lmagan (aynan 24 soat)
    await fx.order({ status: 'processing', createdAt: created });
    await fx.order({ status: 'new_', createdAt: created, deletedAt: new Date() });
    await fx.order({ status: 'new_', createdAt: at('1970-01-01T00:00:01Z') });

    await sendDailyDigest(now);
    const exact = sentTo(worker).filter((h) => h.includes(STALE));
    expect(exact).toHaveLength(1);
    const lines = exact[0].split('\n');
    expect(lines[0]).toBe(`⏳ <b>${STALE}: 15 ta</b>`);
    expect(lines).toHaveLength(17); // sarlavha, 15 ta buyurtma, havola — "… yana" satri yo'q
    expect(lines[1]).toMatch(new RegExp(`^• <b>#${first.id}</b> · 01\\.01\\.1970 · 250\\s000 so'm · ${'K'.repeat(39)}$`));
    expect(exact[0].isWellFormed()).toBe(true);
    expect(lines.at(-1)).toMatch(/\/admin\/orders$/);

    // Kunlik tekshiruv ham aynan shu buyurtmalarni sanaydi (eslatma bilan bir xil shart); misollarida dastlabki 8 tasi, mijoz nomisiz
    const audit = (await collectChecks(now)).find((c) => c.key === 'stale_new');
    expect(audit).toMatchObject({ severity: 'high', count: 15, link: '/admin/orders?status=new_' });
    expect(audit?.items).toHaveLength(8);
    expect(audit?.items[0]).toMatch(new RegExp(`^#${first.id} · 01\\.01\\.1970 · 250\\s000 so'm$`));
    expect(audit?.items.join('\n')).not.toContain('KKK');

    // 16-buyurtma: ro'yxat 15 ta bo'lib qoladi (eng eskilari), sarlavha esa haqiqiy sonni aytadi
    const last = await fx.order({ status: 'new_', createdAt: created });
    clearOutbox();
    await sendDailyDigest(now);
    const more = sentTo(worker).filter((h) => h.includes(STALE))[0].split('\n');
    expect(more[0]).toBe(`⏳ <b>${STALE}: 16 ta</b>`);
    expect(more.filter((l) => l.startsWith('• <b>#'))).toHaveLength(15);
    expect(more.some((l) => l.startsWith(`• <b>#${last.id}</b>`))).toBe(false);
    expect(more.at(-2)).toBe('… yana 1 ta');
    expect(more.at(-1)).toMatch(/\/admin\/orders$/);
  });
});
