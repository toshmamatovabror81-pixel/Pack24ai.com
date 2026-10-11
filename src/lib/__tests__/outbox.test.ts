import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { InlineKeyboard } from '@/lib/telegram/api';

/**
 * Xabarnomalar navbati (telegram/outbox.ts) va uni to'ldiradigan notify() — bazasiz va tarmoqsiz.
 * outbox.ts, notify.ts, api.ts, bots.ts, oluvchini tekshiradigan staffLink.ts / customers.ts, mavzu beradigan orderNotify.ts va xodim
 * kartasini yasaydigan staffCards.ts haqiqiy.
 * prisma o'rnida xotiradagi jadvallar turadi (BotOutbox, User, TelegramCustomer, Order, CorporateInvoice): ular kod bergan `where`
 * shartini o'zi hisoblaydi (tenglik, null, not, startsWith, lt/lte/gt/gte, in/notIn, OR, NOT, bog'langan qator bo'yicha shart — SQL'dagi
 * kabi NULL bilan taqqoslash "noma'lum"), shuning uchun noto'g'ri shart noto'g'ri natija beradi.
 * Telegram o'rnida soxta fetch: so'rov qaysi bot tokeni bilan, kimga, qanday matn va tugmalar bilan ketgani yozib olinadi.
 * Haqiqiy bazadagi poyga (ikki tick bir vaqtda) va jadvalga yozib-o'qish — db/outbox.test.ts da.
 */
const db = vi.hoisted(() => {
  type Row = { id: number; bot: string; chatId: string; topic: string | null; html: string; inline: unknown; attempts: number; nextAt: Date; lastError: string | null; sentAt: Date | null; failedAt: Date | null; createdAt: Date };
  type Staff = { id: number; name: string; role: string; phone: string; telegramId: string | null; telegramNotify: boolean; isActive: boolean; deletedAt: Date | null };
  type Customer = { id: number; telegramId: string; phone: string | null; name: string | null; lang: string; notify: boolean; verifiedAt: Date | null };
  type Order = { id: number; status: string; paymentStatus: string; deliveryMethod: string | null; totalAmount: number; accessToken: string | null; telegramUserId: string | null; contactPhone: string | null; userId: number | null; deletedAt: Date | null } & StaffCard;
  /** Faqat xodim kartasi (staffCards.ts) o'qiydigan maydonlar. Baza mahsulot va hisob-fakturani `include` bilan qo'shib beradi — bu yerda ular qatorning o'zida */
  type StaffCard = { paymentMethod?: string | null; customerName?: string | null; createdAt?: Date; items?: { quantity: number; product: { name: string } }[]; corporateInvoices?: { invoiceNo: string }[] };
  /** Kunlik eslatma (sendDailyDigest) o'qiydigan hisob-faktura; `order` — bog'langan buyurtma qatorining o'zi (shart ham, mijoz nomi ham undan olinadi) */
  type Invoice = { id: number; invoiceNo: string; status: string; totalAmount: number; paidAmount: number; dueDate: Date; order: Order };
  type Where = { [key: string]: unknown };
  /** SQL mantiqi uch qiymatli: rost, yolg'on va "noma'lum" (null) — qator faqat shart ROST bo'lgandagina olinadi */
  type Tri = boolean | null;
  /**
   * down — baza ishlamayapti (har so'rov xato); afterFind — navbat ro'yxati o'qilgandan keyin bir marta ishlaydi ("shu orada boshqa
   * jarayon..."); failUpdate — navbatdagi faqat shu shartga mos yangilash so'rovi yiqiladi
   */
  const state = {
    rows: [] as Row[], users: [] as Staff[], customers: [] as Customer[], orders: [] as Order[], invoices: [] as Invoice[],
    seq: 0, down: false, afterFind: null as (() => void) | null, failUpdate: null as ((where: Where) => boolean) | null,
  };

  const num = (v: unknown) => (v instanceof Date ? v.getTime() : v);
  const empty = (v: unknown) => v === null || v === undefined;
  const all = (xs: Tri[]): Tri => (xs.includes(false) ? false : xs.includes(null) ? null : true);
  const any = (xs: Tri[]): Tri => (xs.includes(true) ? true : xs.includes(null) ? null : false);
  const holds = (value: unknown, cond: unknown): Tri => {
    if (cond === null) return empty(value); // IS NULL
    // SQL: NULL bilan taqqoslash hech qachon rost emas (yolg'on ham emas — NOT ichida ham qator chiqmaydi)
    if (cond instanceof Date || typeof cond !== 'object') return empty(value) ? null : num(value) === num(cond);
    return all(Object.entries(cond as Where).map(([op, x]): Tri => {
      if (op === 'in' || op === 'notIn') {
        const list = x as unknown[];
        // Prisma bo'sh ro'yxatni ustunga qaramay hal qiladi: in [] — hech bir qator, notIn [] — hamma qator
        if (!list.length) return op === 'notIn';
        if (empty(value)) return null;
        return list.some((y) => num(y) === num(value)) === (op === 'in');
      }
      if (op === 'not') {
        if (x === null) return !empty(value); // IS NOT NULL
        if (typeof x === 'object' && !(x instanceof Date)) throw new Error('soxta jadval: "not" ichida faqat oddiy qiymat qo\'llab-quvvatlanadi');
        // SQL'dagi "<>": ustun NULL bo'lsa natija noma'lum — qator chiqmaydi
        return empty(value) ? null : num(value) !== num(x);
      }
      if (empty(value)) return null;
      // LIKE 'boshi%': mavzudagi belgilar (harf, raqam, ":", "-") LIKE uchun maxsus emas
      if (op === 'startsWith') return String(value).startsWith(String(x));
      const a = num(value) as number;
      const b = num(x) as number;
      if (op === 'lt') return a < b;
      if (op === 'lte') return a <= b;
      if (op === 'gt') return a > b;
      if (op === 'gte') return a >= b;
      throw new Error(`soxta jadval: "${op}" sharti qo'llab-quvvatlanmaydi`);
    }));
  };
  const evaluate = (row: object, where: Where = {}): Tri => all(Object.entries(where).map(([key, cond]): Tri => {
    if (cond === undefined) return true;
    if (key === 'OR') return any((cond as Where[]).map((w) => evaluate(row, w)));
    if (key === 'NOT') {
      const inner = evaluate(row, cond as Where);
      return inner === null ? null : !inner;
    }
    if (!(key in row)) throw new Error(`soxta jadval: "${key}" ustuni yo'q`);
    const value = (row as Where)[key];
    // Bog'langan qator bo'yicha shart (hisob-fakturaning buyurtmasi): ichki shart o'sha qatorning o'zida hisoblanadi
    if (typeof value === 'object' && value !== null && !(value instanceof Date) && !Array.isArray(value)) return evaluate(value, cond as Where);
    return holds(value, cond);
  }));
  const matches = (row: object, where?: Where): boolean => evaluate(row, where) === true;
  const guard = () => {
    if (state.down) throw new Error('baza ulanmadi');
  };

  const table = {
    create: vi.fn(async ({ data }: { data: Pick<Row, 'bot' | 'chatId' | 'html' | 'nextAt'> & Partial<Row> }) => {
      guard();
      state.seq += 1;
      const row: Row = { topic: null, inline: null, attempts: 1, lastError: null, sentAt: null, failedAt: null, createdAt: new Date(), ...data, id: state.seq };
      if (row.inline === undefined) row.inline = null;
      if (row.topic === undefined) row.topic = null;
      state.rows.push(row);
      return { ...row };
    }),
    // Haqiqiy baza kabi nusxa qaytaradi: o'qilgandan keyingi o'zgarishlar kod qo'lidagi qatorda ko'rinmaydi
    findMany: vi.fn(async ({ where, orderBy, take }: { where?: Where; orderBy?: { id?: 'asc' | 'desc' }; take?: number } = {}) => {
      guard();
      const found = state.rows.filter((r) => matches(r, where)).map((r) => ({ ...r }));
      if (orderBy?.id) found.sort((a, b) => (orderBy.id === 'asc' ? a.id - b.id : b.id - a.id));
      const hook = state.afterFind;
      state.afterFind = null;
      hook?.();
      return take === undefined ? found : found.slice(0, take);
    }),
    updateMany: vi.fn(async ({ where, data }: { where?: Where; data: Partial<Row> }) => {
      guard();
      if (state.failUpdate?.(where ?? {})) throw new Error('baza ulanmadi');
      const hit = state.rows.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data);
      return { count: hit.length };
    }),
    deleteMany: vi.fn(async ({ where }: { where?: Where } = {}) => {
      guard();
      const before = state.rows.length;
      state.rows = state.rows.filter((r) => !matches(r, where));
      return { count: before - state.rows.length };
    }),
    count: vi.fn(async ({ where }: { where?: Where } = {}) => {
      guard();
      return state.rows.filter((r) => matches(r, where)).length;
    }),
  };

  /** Faqat o'qiladigan jadvallar (oluvchini tekshirish va buyurtma xabarlari uchun): kod so'ragan ustunlargina qaytadi */
  const lookup = <T extends object>(rows: () => T[]) => {
    const first = async ({ where, select }: { where?: Where; select?: { [key: string]: boolean } } = {}) => {
      guard();
      const hit = rows().find((r) => matches(r, where));
      if (!hit) return null;
      return select ? Object.fromEntries(Object.entries(hit).filter(([k]) => select[k])) : { ...hit };
    };
    return {
      findFirst: vi.fn(first),
      findUnique: vi.fn(first),
      findMany: vi.fn(async ({ where }: { where?: Where } = {}) => {
        guard();
        return rows().filter((r) => matches(r, where)).map((r) => ({ ...r }));
      }),
      count: vi.fn(async ({ where }: { where?: Where } = {}) => {
        guard();
        return rows().filter((r) => matches(r, where)).length;
      }),
    };
  };
  return { state, table, user: lookup(() => state.users), telegramCustomer: lookup(() => state.customers), order: lookup(() => state.orders), corporateInvoice: lookup(() => state.invoices) };
});

/** Do'kon sozlamalari: phone — xabardagi "Savollar bo'lsa" satri (bo'sh — telefon kiritilmagan); fail — sozlamalarni o'qib bo'lmadi */
const shop = vi.hoisted(() => ({ phone: '998880557888', fail: false }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: { botOutbox: db.table, user: db.user, telegramCustomer: db.telegramCustomer, order: db.order, corporateInvoice: db.corporateInvoice } }));
// Haqiqiy getSettings next/cache ga tayanadi; orderNotify undan faqat "bekor qilindi" va to'lov tuzatishi xabaridagi telefon uchun foydalanadi
vi.mock('@/lib/settings', () => ({
  getSettings: async () => {
    if (shop.fail) throw new Error('sozlamalar o\'qilmadi');
    return { companyName: 'Pack24', phone: shop.phone };
  },
}));

const { call, TelegramError } = await import('@/lib/telegram/api');
const { enqueue, flushOutbox, OUTBOX_MAX_ATTEMPTS, outboxStats, retryable, supersede, supersedePrefix } = await import('@/lib/telegram/outbox');
const { notify, notifyCustomer, notifyStaff } = await import('@/lib/telegram/notify');
const { notifyCustomerInvoice, notifyCustomerOrderStatus, notifyCustomerPaid, notifyCustomerPaymentReverted, notifyCustomerProduction, notifyStaffLead, notifyStaffNewOrder, notifyStaffPaid, notifyStaffPaymentReverted, sendDailyDigest } =
  await import('@/lib/orderNotify');

type Row = (typeof db.state.rows)[number];
type Staff = (typeof db.state.users)[number];
type Customer = (typeof db.state.customers)[number];
type Order = (typeof db.state.orders)[number];
type TgError = InstanceType<typeof TelegramError>;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = new Date('2026-10-11T07:00:00.000Z');
const at = (ms: number) => new Date(NOW.getTime() + ms);
/** Urinishdan keyingi kutish, daqiqa: 1-urinishdan (notify) keyin 5, 2-dan keyin 15, ... 5-dan keyin 720; 6-urinish oxirgisi */
const STEPS = [5, 15, 60, 180, 720];
const NONE = { sent: 0, retry: 0, failed: 0 };
/** Yangi xabar o'rnini bosgan navbat yozuvining belgisi va tokeni qaytmagan bot xabarining xatosi (outbox.ts) */
const SUPERSEDED = 'eskirgan';
const NO_TOKEN = "bot tokeni yo'q";
const STATUS = 'order-status:15';

const CUSTOMER = '111:customer';
const STAFF = '222:staff';
const KB: InlineKeyboard = [[{ text: 'Batafsil', callback_data: 'o_15' }], [{ text: 'Hisob-faktura', url: 'https://pack24.uz/uz/orders/abc/invoice' }]];

// ─── Soxta Telegram ──────────────────────────────────────────────────────────
type Sent = { token: string; method: string; chat: string; text: string; inline?: InlineKeyboard };
const sent: Sent[] = [];
let reply: (m: Sent) => Response | Promise<Response>;
const OK = () => new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
const tgError = (code: number, description: string, retryAfter?: number) => () =>
  new Response(JSON.stringify({ ok: false, error_code: code, description, ...(retryAfter === undefined ? {} : { parameters: { retry_after: retryAfter } }) }), { status: code });
const offline = (): never => {
  throw new TypeError('fetch failed');
};
const BLOCKED = tgError(403, 'Forbidden: bot was blocked by the user');

// ─── Jadvallarga to'g'ridan-to'g'ri qator qo'yish ────────────────────────────
const nextId = (list: { id: number }[]) => Math.max(0, ...list.map((r) => r.id)) + 1;
/** Boshqaruv botiga ulangan faol xodim, xabarnomasi yoniq */
const staff = (telegramId: string | null, over: Partial<Staff> = {}): Staff => {
  const id = nextId(db.state.users);
  const u: Staff = { id, name: `Xodim ${id}`, role: 'manager', phone: `9989011${String(id).padStart(5, '0')}`, telegramId, telegramNotify: true, isActive: true, deletedAt: null, ...over };
  db.state.users.push(u);
  return u;
};
/** Mijoz botidan foydalanuvchi, xabarnomasi yoniq */
const customer = (telegramId: string, over: Partial<Customer> = {}): Customer => {
  const c: Customer = { id: nextId(db.state.customers), telegramId, phone: null, name: null, lang: 'uz', notify: true, verifiedAt: null, ...over };
  db.state.customers.push(c);
  return c;
};
const order = (over: Partial<Order> = {}): Order => {
  const o: Order = { id: nextId(db.state.orders), status: 'processing', paymentStatus: 'pending', deliveryMethod: 'courier', totalAmount: 250000, accessToken: null, telegramUserId: null, contactPhone: null, userId: null, deletedAt: null, ...over };
  db.state.orders.push(o);
  return o;
};
/** Oluvchi "hali ham o'zimizniki" bo'lishi uchun (bo'lsa qayta qo'shilmaydi): mijoz botida — mijoz yozuvi, boshqaruv botida — ulangan xodim */
const known = (bot: string, chatId: string) => {
  if (bot === 'customer' && !db.state.customers.some((c) => c.telegramId === chatId)) customer(chatId);
  if (bot === 'staff' && !db.state.users.some((u) => u.telegramId === chatId)) staff(chatId);
};
/**
 * Navbatdagi xabar: standart — mijoz boti, mavzusiz, 1 ta urinish bo'lgan, vaqti bir daqiqa oldin kelgan.
 * Oluvchisi ham ro'yxatga qo'shiladi; `recipient: false` — qo'shilmaydi (oluvchi tekshiruvi testlari o'zi belgilaydi).
 */
const seed = (over: Partial<Row> = {}, recipient = true): Row => {
  const id = over.id ?? nextId(db.state.rows);
  const row: Row = { bot: 'customer', chatId: `70${id}`, topic: null, html: `xabar ${id}`, inline: null, attempts: 1, nextAt: at(-MIN), lastError: 'fetch failed', sentAt: null, failedAt: null, createdAt: at(-6 * MIN), ...over, id };
  db.state.rows.push(row);
  db.state.seq = Math.max(db.state.seq, id);
  if (recipient) known(row.bot, row.chatId);
  return row;
};
const row = (id: number) => db.state.rows.find((r) => r.id === id);
const snapshot = (...ids: number[]) => ids.map((id) => ({ ...row(id)! }));
const ids = () => db.state.rows.map((r) => r.id);
const pending = () => db.state.rows.filter((r) => !r.sentAt && !r.failedAt).map((r) => r.id);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const via = () => sent.map((m) => `${m.token} ${m.chat}`);
const failure = (p: Promise<unknown>) => p.then(() => { throw new Error('xato kutilgan edi'); }, (e: unknown) => e as TgError);
/** Qo'lda ochiladigan to'siq: Telegram javobi test xohlagan paytgacha "yo'lda" turadi */
const gate = () => {
  let open = (): void => undefined;
  const wait = new Promise<void>((resolve) => { open = resolve; });
  return { wait, open };
};
/** notify.ts ning "shu mavzuda oxirgi chiqarilgan xabar" hisobi (globalThis da): kalit — `bot:chat:mavzu` */
const issued = () => {
  const map = (globalThis as unknown as { p24NotifyLatest?: Map<string, number> }).p24NotifyLatest;
  if (!map) throw new Error('notify.ts hisobi (globalThis.p24NotifyLatest) topilmadi — nomi o\'zgargan bo\'lsa shu testni ham yangilang');
  return map;
};

let errors: MockInstance<typeof console.error>;

beforeEach(() => {
  issued().clear();
  // Faqat soat soxta (kutishlar haqiqiy): enqueue() ichidagi "hozir" va tick'ning 15 soniyalik chegarasi aniq boshqariladi
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  vi.stubEnv('TELEGRAM_API_BASE', '');
  vi.stubEnv('CUSTOMER_BOT_TOKEN', CUSTOMER);
  vi.stubEnv('STAFF_BOT_TOKEN', STAFF);
  vi.stubEnv('SUPERVISOR_BOT_TOKEN', '');
  vi.stubEnv('APP_URL', 'https://pack24.uz');
  Object.assign(db.state, { rows: [], users: [], customers: [], orders: [], invoices: [], seq: 0, down: false, afterFind: null, failUpdate: null });
  Object.assign(shop, { phone: '998880557888', fail: false });
  for (const t of [db.table, db.user, db.telegramCustomer, db.order, db.corporateInvoice]) for (const fn of Object.values(t)) fn.mockClear();
  sent.length = 0;
  reply = OK;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { chat_id?: unknown; text?: string; reply_markup?: { inline_keyboard?: InlineKeyboard } };
    const m: Sent = { token: /\/bot([^/]+)\//.exec(String(url))?.[1] ?? '', method: String(url).split('/').pop() ?? '', chat: String(body.chat_id), text: String(body.text), inline: body.reply_markup?.inline_keyboard };
    sent.push(m);
    return reply(m);
  }));
  errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  const left = [...issued().keys()];
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Har bir testdan keyin yo'lda hech narsa qolmagan: notify hisobi bo'sh (xotira o'smaydi) — xabar qanday tugaganidan qat'i nazar
  expect(left).toEqual([]);
});

describe('retryable: qaysi xatodan keyin qayta urinish foydali', () => {
  it('Telegram uzil-kesil rad etgan (400, 401, 403, 404) — foydasiz', () => {
    for (const code of [400, 401, 403, 404]) expect(retryable(new TelegramError('sendMessage', code, 'rad etildi')), String(code)).toBe(false);
    // Rad javobida kutish vaqti kelgan bo'lsa ham hal qiluvchi narsa — kod
    expect(retryable(new TelegramError('sendMessage', 400, 'Bad Request: chat not found', 30))).toBe(false);
  });

  it('429 (juda tez-tez) va 5xx (Telegram yoki oraliq server nosoz) — foydali', () => {
    for (const code of [429, 500, 502, 503, 504]) expect(retryable(new TelegramError('sendMessage', code, 'keyinroq')), String(code)).toBe(true);
  });

  it('Telegram javobi bo\'lmagan har qanday xato (tarmoq uzilishi, vaqt tugashi) — foydali', () => {
    const aborted = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
    const timedOut = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    for (const e of [new Error('ECONNRESET'), new TypeError('fetch failed'), aborted, timedOut, 'matnli xato', undefined]) expect(retryable(e), String(e)).toBe(true);
  });
});

describe('Telegram xatosi: retry_after', () => {
  it('429 javobidagi parameters.retry_after TelegramError.retryAfter ga o\'tadi', async () => {
    reply = tgError(429, 'Too Many Requests: retry after 37', 37);
    const e = await failure(call(CUSTOMER, 'sendMessage', { chat_id: 5, text: 'x' }));
    expect(e).toBeInstanceOf(TelegramError);
    expect(e).toMatchObject({ method: 'sendMessage', code: 429, retryAfter: 37 });
    expect(e.message).toBe('Telegram sendMessage: 429 Too Many Requests: retry after 37');
    expect(retryable(e)).toBe(true);
  });

  it('kutish vaqti berilmagan xatoda retryAfter yo\'q; JSON bo\'lmagan javobda kod HTTP holatidan olinadi', async () => {
    reply = BLOCKED;
    const blocked = await failure(call(CUSTOMER, 'sendMessage', { chat_id: 5, text: 'x' }));
    expect(blocked).toMatchObject({ code: 403 });
    expect(blocked.retryAfter).toBeUndefined();

    reply = tgError(429, 'Too Many Requests', 0);
    expect((await failure(call(CUSTOMER, 'sendMessage'))).retryAfter).toBeUndefined();

    reply = () => new Response('<html>502 Bad Gateway</html>', { status: 502 });
    const gateway = await failure(call(STAFF, 'sendMessage'));
    expect(gateway).toBeInstanceOf(TelegramError);
    expect(gateway).toMatchObject({ code: 502 });
    expect(gateway.retryAfter).toBeUndefined();
    expect(retryable(gateway)).toBe(true);
  });
});

describe('notify: darhol yuborish va navbat', () => {
  it('yetib borsa true qaytadi va navbatga hech narsa tushmaydi', async () => {
    expect(await notify('customer', 777, '<b>Salom</b>', KB)).toBe(true);
    expect(await notifyStaff('900', 'Yangi buyurtma')).toBe(true);
    expect(sent).toEqual([
      { token: CUSTOMER, method: 'sendMessage', chat: '777', text: '<b>Salom</b>', inline: KB },
      { token: STAFF, method: 'sendMessage', chat: '900', text: 'Yangi buyurtma' },
    ]);
    expect(db.state.rows).toEqual([]);
    expect(db.table.create).not.toHaveBeenCalled();
    // Mavzusiz xabar navbatga umuman tegmaydi
    expect(db.table.updateMany).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it('bot tokeni yoki oluvchi yo\'q: false, hech narsa yuborilmaydi va navbatga tushmaydi', async () => {
    reply = offline;
    for (const chat of [null, undefined, '', 0]) expect(await notify('customer', chat, 'x', KB), String(chat)).toBe(false);
    expect(await notify('customer', null, 'x', KB, {}, STATUS)).toBe(false);
    vi.stubEnv('STAFF_BOT_TOKEN', '');
    expect(await notify('staff', '900', 'x', KB)).toBe(false);
    expect(await notifyStaff('900', 'x')).toBe(false);
    vi.stubEnv('CUSTOMER_BOT_TOKEN', '   ');
    expect(await notifyCustomer('777', 'x')).toBe(false);
    expect(await notifyCustomer('777', 'x', KB, STATUS)).toBe(false);

    expect(sent).toEqual([]);
    expect(db.state.rows).toEqual([]);
    for (const fn of Object.values(db.table)) expect(fn).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it('vaqtincha xato (tarmoq, vaqt tugashi, 5xx, 429): false qaytadi va xabar tugmalari bilan navbatga tushadi', async () => {
    const cases: [string, () => Response][] = [
      ['tarmoq uzilgan', offline],
      ['javob 10 soniyada kelmadi', () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); }],
      ['Telegram 500', tgError(500, 'Internal Server Error')],
      ['oraliq server 502 (javob JSON emas)', () => new Response('<html>502 Bad Gateway</html>', { status: 502 })],
      ['429, qisqa kutish', tgError(429, 'Too Many Requests: retry after 3', 3)],
    ];
    for (const [name, respond] of cases) {
      db.state.rows = [];
      sent.length = 0;
      reply = respond;
      expect(await notify('staff', 900, '<b>Yangi buyurtma #15</b>', KB), name).toBe(false);
      // Darhol takrorlanmaydi: bitta urinish, qolgani tick'ning ishi
      expect(sent, name).toEqual([{ token: STAFF, method: 'sendMessage', chat: '900', text: '<b>Yangi buyurtma #15</b>', inline: KB }]);
      expect(db.state.rows, name).toHaveLength(1);
      expect(db.state.rows[0], name).toMatchObject({ bot: 'staff', chatId: '900', topic: null, html: '<b>Yangi buyurtma #15</b>', inline: KB, attempts: 1, nextAt: at(5 * MIN), sentAt: null, failedAt: null });
      expect(db.state.rows[0].lastError, name).toBeTruthy();
    }
    expect(errors).toHaveBeenCalledTimes(cases.length);
  });

  it('mijoz va boshqaruv xabarlari o\'z boti nomi bilan yoziladi; tugmasiz xabar tugmasiz saqlanadi', async () => {
    reply = offline;
    expect(await notifyCustomer('777', 'Buyurtmangiz qabul qilindi')).toBe(false);
    expect(await notifyStaff('900', 'Yangi ariza', KB)).toBe(false);
    expect(db.state.rows.map((r) => ({ bot: r.bot, chatId: r.chatId, html: r.html, inline: r.inline }))).toEqual([
      { bot: 'customer', chatId: '777', html: 'Buyurtmangiz qabul qilindi', inline: null },
      { bot: 'staff', chatId: '900', html: 'Yangi ariza', inline: KB },
    ]);
  });

  it('429: Telegram 5 daqiqadan uzoqroq kutishni so\'rasa, birinchi qayta urinish o\'sha vaqtdan oldin bo\'lmaydi', async () => {
    reply = tgError(429, 'Too Many Requests: retry after 1800', 1800);
    expect(await notify('customer', '777', 'x')).toBe(false);
    expect(db.state.rows[0]).toMatchObject({ attempts: 1, nextAt: at(30 * MIN) });
    expect(db.state.rows[0].lastError).toContain('429');
  });

  it('doimiy xato (bot bloklangan, chat topilmadi, token bekor qilingan): false, navbatga TUSHMAYDI', async () => {
    for (const respond of [BLOCKED, tgError(400, 'Bad Request: chat not found'), tgError(401, 'Unauthorized')]) {
      reply = respond;
      expect(await notify('customer', '777', 'x', KB)).toBe(false);
    }
    expect(sent).toHaveLength(3);
    expect(db.state.rows).toEqual([]);
    expect(db.table.create).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledTimes(3);
  });

  it('navbatga yozib bo\'lmasa ham (baza ishlamayapti) xato tashlamaydi — biznes jarayon to\'xtamaydi', async () => {
    reply = offline;
    db.state.down = true;
    await expect(notify('staff', '900', 'x', KB)).resolves.toBe(false);
    await expect(notifyCustomer('777', 'x')).resolves.toBe(false);
    expect(db.table.create).toHaveBeenCalledTimes(2);
    expect(db.state.rows).toEqual([]);
    // Har biri uchun ikkita yozuv: yuborish xatosi va navbat xatosi
    expect(errors).toHaveBeenCalledTimes(4);

    // Mavzuli xabarda ham: navbatdagi eskisini bekor qilish xatosi tashqariga chiqmaydi
    await expect(notifyCustomer('777', 'x', KB, STATUS)).resolves.toBe(false);
    expect(db.state.rows).toEqual([]);
    expect(errors).toHaveBeenCalledTimes(6);
  });
});

describe('mavzu (topic): eskirgan holat xabari yangisidan keyin yetib bormaydi', () => {
  it('yangi xabar to\'g\'ridan-to\'g\'ri yetib borsa, navbatda turgan shu mavzudagi eski xabar bekor bo\'ladi va keyin ham yuborilmaydi', async () => {
    seed({ id: 1, chatId: '777', topic: STATUS, html: 'Holati: Yo\'lda', nextAt: at(4 * MIN), attempts: 2 });

    expect(await notifyCustomer('777', 'Holati: Yetkazildi', KB, STATUS)).toBe(true);
    // O'chirilmaydi — "eskirgan" deb belgilanadi; yangi xabarning o'zi navbatga yozilmaydi
    expect(db.state.rows).toHaveLength(1);
    expect(row(1)).toMatchObject({ html: 'Holati: Yo\'lda', attempts: 2, sentAt: null, failedAt: NOW, lastError: SUPERSEDED });

    for (const minute of [4, 20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN)), String(minute)).toEqual(NONE);
    expect(sent).toEqual([{ token: CUSTOMER, method: 'sendMessage', chat: '777', text: 'Holati: Yetkazildi', inline: KB }]);
    // Bu Telegram xatosi emas: "yuborilmadi" deb ham, "kutyapti" deb ham sanalmaydi
    expect(await outboxStats(at(HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
    expect(errors).not.toHaveBeenCalled();
  });

  it('ikkalasi ham navbatga tushsa: yangisi eskisining o\'rnini bosadi va faqat yangisi yetib boradi', async () => {
    customer('777');
    reply = offline;
    expect(await notifyCustomer('777', 'Holati: Yo\'lda', KB, STATUS)).toBe(false);
    vi.setSystemTime(at(2 * MIN));
    expect(await notifyCustomer('777', 'Holati: Yetkazildi', KB, STATUS)).toBe(false);
    expect(db.state.rows.map((r) => ({ id: r.id, topic: r.topic, html: r.html, nextAt: r.nextAt, sentAt: r.sentAt, failedAt: r.failedAt, lastError: r.lastError }))).toEqual([
      { id: 1, topic: STATUS, html: 'Holati: Yo\'lda', nextAt: at(5 * MIN), sentAt: null, failedAt: at(2 * MIN), lastError: SUPERSEDED },
      { id: 2, topic: STATUS, html: 'Holati: Yetkazildi', nextAt: at(7 * MIN), sentAt: null, failedAt: null, lastError: 'fetch failed' },
    ]);

    reply = OK;
    sent.length = 0;
    // 5-daqiqa: eskisining vaqti kelgan bo'lardi — yuborilmaydi; 7-daqiqa: yangisi
    expect(await flushOutbox(at(5 * MIN))).toEqual(NONE);
    expect(await flushOutbox(at(7 * MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(sent).toEqual([{ token: CUSTOMER, method: 'sendMessage', chat: '777', text: 'Holati: Yetkazildi', inline: KB }]);
    expect(row(2)).toMatchObject({ attempts: 2, sentAt: at(7 * MIN), failedAt: null, lastError: null });
    expect(await outboxStats(at(HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
  });

  // Ilgari har bir xabar o'z jadvali bo'yicha qayta urinilardi: 0-daqiqadagi "qabul qilindi" (keyingi urinishi 20-daqiqada)
  // 10-daqiqadagi "yetkazildi"dan (keyingi urinishi 15-daqiqada) KEYIN yetib borardi
  it('qayta urinishlar orasida qolgan eski holat yangisidan keyin yetib bormaydi', async () => {
    customer('777');
    reply = offline;
    expect(await notifyCustomer('777', 'Buyurtma #15 qabul qilindi', undefined, STATUS)).toBe(false); // 0-daqiqa
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 0, retry: 1, failed: 0 }); // keyingi urinishi 20-daqiqada
    vi.setSystemTime(at(10 * MIN));
    expect(await notifyCustomer('777', 'Buyurtma #15 yetkazildi', undefined, STATUS)).toBe(false); // 10-daqiqa; keyingi urinishi 15-daqiqada
    reply = OK; // Telegram tiklandi
    sent.length = 0;
    for (const minute of [15, 20, 25, 80, 260]) await flushOutbox(at(minute * MIN));
    expect(sent.map((m) => m.text)).toEqual(['Buyurtma #15 yetkazildi']);
    expect(row(1)).toMatchObject({ attempts: 2, sentAt: null, failedAt: at(10 * MIN), lastError: SUPERSEDED });
  });

  it('mavzusiz (hodisa) xabarlar bir-birini bekor qilmaydi: ikkalasi ham bir martadan yetib boradi', async () => {
    customer('777');
    reply = offline;
    expect(await notifyCustomer('777', 'To\'lov qabul qilindi')).toBe(false);
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 0, retry: 1, failed: 0 });
    vi.setSystemTime(at(10 * MIN));
    expect(await notifyCustomer('777', 'Hisob-faktura tayyor')).toBe(false);
    reply = OK;
    sent.length = 0;
    for (const minute of [15, 20, 25, 80, 260]) await flushOutbox(at(minute * MIN));
    // Tartib kafolatlanmaydi (har biri o'z jadvali bo'yicha) — muhimi, hech biri yo'qolmaydi va takrorlanmaydi
    expect(sent.map((m) => m.text).sort()).toEqual(['Hisob-faktura tayyor', 'To\'lov qabul qilindi']);
    expect(db.state.rows.map((r) => [r.topic, Boolean(r.sentAt), r.failedAt])).toEqual([[null, true, null], [null, true, null]]);
  });

  it('boshqa mavzu, boshqa oluvchi, boshqa bot va mavzusiz xabarlarga tegilmaydi; yakunlangan yozuvlar ham o\'zgarmaydi', async () => {
    seed({ id: 1, chatId: '777', topic: STATUS, html: 'eski holat' });
    seed({ id: 2, chatId: '777', topic: 'order-status:16', html: 'boshqa buyurtma' });
    seed({ id: 3, chatId: '777', topic: 'order-production:15:Quti', html: 'ishlab chiqarish' });
    seed({ id: 4, chatId: '778', topic: STATUS, html: 'shu buyurtmaning boshqa oluvchisi' });
    seed({ id: 5, chatId: '777', bot: 'staff', topic: STATUS, html: 'boshqa bot' });
    seed({ id: 6, chatId: '777', html: 'mavzusiz' });
    seed({ id: 7, chatId: '777', topic: STATUS, sentAt: at(-HOUR), lastError: null }); // allaqachon yetib borgan
    seed({ id: 8, chatId: '777', topic: STATUS, failedAt: at(-HOUR), attempts: 2, lastError: 'Telegram sendMessage: 403 Forbidden: bot was blocked by the user' }); // haqiqiy xato
    seed({ id: 9, chatId: '777', topic: STATUS, html: 'undan ham eski holat', nextAt: at(3 * HOUR), attempts: 4 }); // navbatdagi urinishini kutyapti
    const untouched = snapshot(2, 3, 4, 5, 6, 7, 8);

    // Oluvchi son ko'rinishida berilsa ham navbatdagi (matn ko'rinishidagi) yozuv topiladi
    expect(await notify('customer', 777, 'yangi holat', undefined, {}, STATUS)).toBe(true);
    expect(snapshot(2, 3, 4, 5, 6, 7, 8)).toEqual(untouched);
    expect(row(1)).toMatchObject({ attempts: 1, sentAt: null, failedAt: NOW, lastError: SUPERSEDED });
    expect(row(9)).toMatchObject({ attempts: 4, sentAt: null, failedAt: NOW, lastError: SUPERSEDED, nextAt: at(3 * HOUR) });
    // Haqiqiy xato "yuborilmadi" hisobida qoladi, eskirganlar esa kirmaydi
    expect(await outboxStats(NOW)).toEqual({ pending: 5, stuck: 0, failed24h: 1 });

    sent.length = 0;
    expect(await flushOutbox(at(3 * HOUR))).toEqual({ sent: 5, retry: 0, failed: 0 });
    expect(sent.map((m) => `${m.token} ${m.chat} ${m.text}`)).toEqual([
      `${CUSTOMER} 777 boshqa buyurtma`,
      `${CUSTOMER} 777 ishlab chiqarish`,
      `${CUSTOMER} 778 shu buyurtmaning boshqa oluvchisi`,
      `${STAFF} 777 boshqa bot`,
      `${CUSTOMER} 777 mavzusiz`,
    ]);
  });

  it('mavzusiz xabar yetib borsa, navbatdagi mavzuli xabar ham kutaveradi', async () => {
    seed({ id: 1, chatId: '777', topic: STATUS, nextAt: at(HOUR) });
    const before = snapshot(1);
    expect(await notifyCustomer('777', 'To\'lov qabul qilindi', KB)).toBe(true);
    expect(db.table.updateMany).not.toHaveBeenCalled();
    expect(snapshot(1)).toEqual(before);
  });

  it('yangi xabar uzil-kesil rad etilsa (bot bloklangan): navbatdagi eskisi bekor qilinmaydi, yangisi navbatga tushmaydi', async () => {
    seed({ id: 1, chatId: '777', topic: STATUS, nextAt: at(HOUR) });
    const before = snapshot(1);
    reply = BLOCKED;
    expect(await notifyCustomer('777', 'Holati: Yetkazildi', KB, STATUS)).toBe(false);
    expect(db.state.rows).toHaveLength(1);
    expect(snapshot(1)).toEqual(before);
  });

  it('navbatdagi eskisini bekor qilib bo\'lmasa ham (baza xatosi) yetib borgan xabar uchun true qaytadi va xato tashlanmaydi', async () => {
    seed({ id: 1, chatId: '777', topic: STATUS, nextAt: at(HOUR) });
    const before = snapshot(1);
    db.table.updateMany.mockRejectedValueOnce(new Error('baza ulanmadi'));
    await expect(notifyCustomer('777', 'Holati: Yetkazildi', KB, STATUS)).resolves.toBe(true);
    db.state.down = true;
    await expect(notify('customer', 777, 'Holati: Yetkazildi', KB, { disable_notification: true }, STATUS)).resolves.toBe(true);
    db.state.down = false;

    expect(sent.map((m) => m.text)).toEqual(['Holati: Yetkazildi', 'Holati: Yetkazildi']);
    expect(snapshot(1)).toEqual(before);
    // Ikkala xato ham logga yozilgan — bot tokenisiz
    expect(errors).toHaveBeenCalledTimes(2);
    expect(errors.mock.calls.map((c) => c.join(' ')).every((line) => line.includes('baza ulanmadi') && !line.includes(CUSTOMER))).toBe(true);
  });

  it('mavzu Telegram so\'roviga qo\'shilmaydi: yuborilgan so\'rov mavzusiz xabarniki bilan bir xil', async () => {
    const bodies: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      bodies.push(init.body);
      return OK();
    }));
    expect(await notifyCustomer('777', 'Holati: Yetkazildi', KB, STATUS)).toBe(true);
    expect(await notifyCustomer('777', 'Holati: Yetkazildi', KB)).toBe(true);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toBe(bodies[1]);
    expect(bodies[0]).not.toContain('order-status');
  });
});

// Ikki xodim bitta buyurtmani ketma-ket o'zgartirdi: birinchi xabar hali Telegram javobini kutayotganda ikkinchisi chiqdi.
// Navbatga kim tegishini javob kelgan tartib emas, xabar CHIQARILGAN tartib hal qiladi (notify.ts dagi hisob): eskirgan xabar
// yangisini bekor qilmaydi va undan keyin navbatga ham tushmaydi
describe('mavzu (topic): ustma-ust tushgan yuborishlar — chiqarilish tartibi hal qiladi', () => {
  const OLD = 'Holati: Yo\'lda';
  const NEW = 'Holati: Yetkazildi';
  const KEY = `customer:777:${STATUS}`;
  /** Chat haqiqatan OLGAN xabarlar, yetib borgan tartibda (`sent` — urinishlar, o'tmaganlari bilan birga) */
  let got: string[];
  const deliver = (m: Sent) => {
    got.push(m.text);
    return OK();
  };
  /** Xabarni chiqaradi va so'rovi Telegram'ga yetib borguncha kutadi — javobi hali yo'q (natijasi `done` da) */
  const start = async (send: () => Promise<boolean>) => {
    const before = sent.length;
    const clock = Date.now();
    const done = send();
    await vi.waitFor(() => expect(sent).toHaveLength(before + 1));
    // vi.waitFor kutayotganda soxta soatni suradi — test vaqti o'zgarmasin
    vi.setSystemTime(clock);
    return { done };
  };
  const status = (text: string) => () => notifyCustomer('777', text, undefined, STATUS);
  const queue = () => db.state.rows.map((r) => ({ html: r.html, live: !r.sentAt && !r.failedAt }));

  beforeEach(() => {
    got = [];
    customer('777');
  });

  // Ilgari yetib borgan har qanday xabar navbatdagi shu mavzuni bekor qilardi — kech yetib borgan ESKI holat ham: yangi holat
  // navbatdan yo'qolib, mijozda eski holat qolardi
  it('sekin yetib borgan eski holat o\'zidan keyin navbatga tushgan yangi holatni bekor qilmaydi: yangisi keyinroq yetib boradi va oxirgi bo\'lib qoladi', async () => {
    const hold = gate();
    reply = async (m) => {
      if (m.text !== OLD) return offline();
      await hold.wait;
      return deliver(m);
    };
    // Oluvchi bir joyda son, boshqa joyda matn ko'rinishida berilsa ham bu bitta mavzu
    const slow = await start(() => notify('customer', 777, OLD, undefined, {}, STATUS)); // javobi kutilmoqda
    expect([...issued().keys()]).toEqual([KEY]);
    vi.setSystemTime(at(2000));
    expect(await notifyCustomer('777', NEW, KB, STATUS)).toBe(false); // ikki soniyadan keyin: yangisi darhol o'tmadi — navbatda
    expect(pending()).toEqual([1]);
    hold.open();
    expect(await slow.done).toBe(true);

    // Eski xabar yetib bordi, lekin navbatga tegmadi: yagona so'rov — yangisining o'zidan oldingilarni bekor qilishi
    expect(db.state.rows).toHaveLength(1);
    expect(row(1)).toMatchObject({ html: NEW, topic: STATUS, inline: KB, attempts: 1, nextAt: at(2000 + 5 * MIN), sentAt: null, failedAt: null });
    expect(db.table.updateMany).toHaveBeenCalledTimes(1);

    reply = deliver;
    expect(await flushOutbox(at(2000 + 5 * MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
    for (const minute of [20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN)), String(minute)).toEqual(NONE);
    // Chat olgan oxirgi xabar — eng yangi holat, u aynan bir marta kelgan
    expect(got).toEqual([OLD, NEW]);
    expect(sent.at(-1)).toEqual({ token: CUSTOMER, method: 'sendMessage', chat: '777', text: NEW, inline: KB });
    expect(row(1)).toMatchObject({ attempts: 2, sentAt: at(2000 + 5 * MIN), failedAt: null, lastError: null });
    // Logda faqat yangisining o'tmagan birinchi urinishi
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('eski xabar osilib turib oxiri o\'tmasa, yangisi ham darhol o\'tmagan bo\'lsa: navbatda faqat yangisi turadi va faqat u yetib boradi', async () => {
    const hold = gate();
    reply = async (m) => {
      if (m.text === OLD) await hold.wait;
      return offline();
    };
    const slow = await start(status(OLD));
    expect(await notifyCustomer('777', NEW, KB, STATUS)).toBe(false);
    hold.open();
    expect(await slow.done).toBe(false); // javob kelmadi (vaqt tugadi)

    // Eskirgan xabar navbatga qo'yilmadi — qo'yilsa o'zidan yangisini bekor qilib, uning o'rniga o'zi yetib borardi
    expect(queue()).toEqual([{ html: NEW, live: true }]);
    expect(db.table.create).toHaveBeenCalledTimes(1);
    // Yiqilgani baribir logga yozilgan (ikkala urinish ham)
    expect(errors).toHaveBeenCalledTimes(2);

    reply = deliver;
    for (const minute of [5, 20, 80]) await flushOutbox(at(minute * MIN));
    expect(got).toEqual([NEW]);
    expect(sent.at(-1)).toMatchObject({ chat: '777', text: NEW, inline: KB });
    expect(await outboxStats(at(2 * HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
  });

  it('eski xabar osilib turganda yangisi to\'g\'ridan-to\'g\'ri yetib borsa: kechikib yiqilgan eskisi navbatga tushmaydi', async () => {
    seed({ id: 1, chatId: '777', topic: STATUS, html: 'Holati: Qabul qilindi', nextAt: at(4 * MIN) }); // undan ham oldingi holat navbatda turibdi
    const hold = gate();
    reply = async (m) => {
      if (m.text !== OLD) return deliver(m);
      await hold.wait;
      return offline();
    };
    const slow = await start(status(OLD));
    expect(await notifyCustomer('777', NEW, undefined, STATUS)).toBe(true);
    // Eng yangi xabar yetib bordi: navbatdagi eski holatni aynan u bekor qiladi
    expect(row(1)).toMatchObject({ sentAt: null, failedAt: NOW, lastError: SUPERSEDED });
    // Yangisi tugadi — hisobda u qolmadi, eskisi esa hamon yo'lda
    expect([...issued().keys()]).toEqual([]);
    hold.open();
    expect(await slow.done).toBe(false);

    expect(db.state.rows).toHaveLength(1);
    expect(db.table.create).not.toHaveBeenCalled();
    reply = deliver;
    for (const minute of [4, 5, 20, 24 * 60]) expect(await flushOutbox(at(minute * MIN)), String(minute)).toEqual(NONE);
    expect(got).toEqual([NEW]);
    expect(await outboxStats(at(HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
  });

  // Ikkala xabar ham yo'lda: har biri yetib borishi yoki o'tmasligi mumkin, javoblar esa istalgan tartibda keladi — 8 ta holatning hammasi.
  // Navbatda eski xabar hech qachon paydo bo'lmaydi; yangisi — faqat o'zi darhol o'tmagan bo'lsa, va keyin aynan bir marta yetib boradi
  const OUTCOMES: [string, string, string, string[]][] = [
    ['yetib bordi', 'yetib bordi', 'eskisiniki', [OLD, NEW]],
    // Ikkalasi ham to'g'ridan-to'g'ri yetib borgan, faqat teskari tartibda: bu yerda navbatning qo'lidan hech narsa kelmaydi
    ['yetib bordi', 'yetib bordi', 'yangisiniki', [NEW, OLD]],
    ['yetib bordi', 'o\'tmadi', 'eskisiniki', [OLD, NEW]],
    ['yetib bordi', 'o\'tmadi', 'yangisiniki', [OLD, NEW]],
    ['o\'tmadi', 'yetib bordi', 'eskisiniki', [NEW]],
    ['o\'tmadi', 'yetib bordi', 'yangisiniki', [NEW]],
    ['o\'tmadi', 'o\'tmadi', 'eskisiniki', [NEW]],
    ['o\'tmadi', 'o\'tmadi', 'yangisiniki', [NEW]],
  ];
  it.each(OUTCOMES)('ikkalasi ham yo\'lda — eskisi %s, yangisi %s, birinchi kelgan javob %s: navbatda eskisi yo\'q, yangisi bir marta yetib boradi', async (oldResult, newResult, first, received) => {
    const holds: Record<string, ReturnType<typeof gate>> = { [OLD]: gate(), [NEW]: gate() };
    const ok: Record<string, boolean> = { [OLD]: oldResult === 'yetib bordi', [NEW]: newResult === 'yetib bordi' };
    reply = async (m) => {
      await holds[m.text].wait;
      return ok[m.text] ? deliver(m) : offline();
    };
    const running: Record<string, { done: Promise<boolean> }> = { [OLD]: await start(status(OLD)) };
    running[NEW] = await start(status(NEW));
    // Hisobda mavzu bo'yicha bitta yozuv: oxirgi chiqarilgan xabar
    expect([...issued().keys()]).toEqual([KEY]);
    for (const text of first === 'eskisiniki' ? [OLD, NEW] : [NEW, OLD]) {
      holds[text].open();
      expect(await running[text].done, text).toBe(ok[text]);
    }

    expect(queue()).toEqual(ok[NEW] ? [] : [{ html: NEW, live: true }]);
    reply = deliver;
    for (const minute of [5, 20, 80]) await flushOutbox(at(minute * MIN));
    expect(got).toEqual(received);
    expect(got.filter((text) => text === NEW)).toHaveLength(1);
    expect(pending()).toEqual([]);
  });

  it('uchinchi xabar: yo\'ldagi eng eski xabar keyin chiqqan ikkalasidan ham "yangi" bo\'lib qolmaydi', async () => {
    const NEWEST = 'Holati: Topshirildi';
    const hold = gate();
    reply = async (m) => {
      if (m.text !== OLD) return offline();
      await hold.wait;
      return deliver(m);
    };
    const slow = await start(status(OLD));
    expect(await notifyCustomer('777', NEW, undefined, STATUS)).toBe(false);
    // O'rtadagi xabar tugagach hisob bo'shagan — eng eskisi shunda ham "oxirgi chiqarilgan" emas
    expect([...issued().keys()]).toEqual([]);
    vi.setSystemTime(at(MIN));
    expect(await notifyCustomer('777', NEWEST, undefined, STATUS)).toBe(false);
    expect(queue()).toEqual([{ html: NEW, live: false }, { html: NEWEST, live: true }]);
    hold.open();
    expect(await slow.done).toBe(true);

    expect(queue()).toEqual([{ html: NEW, live: false }, { html: NEWEST, live: true }]);
    reply = deliver;
    for (const minute of [5, 6, 20, 80]) await flushOutbox(at(minute * MIN));
    expect(got).toEqual([OLD, NEWEST]);
  });

  it('hisob har bir bot, oluvchi va mavzu uchun alohida: boshqa mavzu, boshqa oluvchi, boshqa bot yoki mavzusiz xabar chiqishi yo\'ldagi xabarni eskirtirmaydi', async () => {
    customer('778');
    staff('777');
    seed({ id: 1, chatId: '777', topic: STATUS, html: 'Holati: Qabul qilindi', nextAt: at(HOUR) });
    const others = async () => {
      expect(await notifyCustomer('777', 'boshqa buyurtma', undefined, 'order-status:16')).toBe(false);
      expect(await notifyCustomer('777', 'nomi shu bilan boshlanadigan mavzu', undefined, `${STATUS}0`)).toBe(false);
      expect(await notifyCustomer('778', 'boshqa oluvchi', undefined, STATUS)).toBe(false);
      expect(await notify('staff', '777', 'boshqa bot', undefined, {}, STATUS)).toBe(false);
      expect(await notifyCustomer('777', 'mavzusiz')).toBe(false);
    };

    // 1) Yo'ldagi xabar yetib boradi: o'z mavzusida u hamon eng yangisi — navbatdagi eski holatni bekor qiladi
    const first = gate();
    reply = async (m) => {
      if (m.text !== OLD) return offline();
      await first.wait;
      return deliver(m);
    };
    const delivered = await start(status(OLD));
    await others();
    // Mavzusiz xabar hisobga umuman kirmaydi; tugaganlari chiqib ketgan
    expect([...issued().keys()]).toEqual([KEY]);
    first.open();
    expect(await delivered.done).toBe(true);
    expect(row(1)).toMatchObject({ failedAt: NOW, lastError: SUPERSEDED });
    expect(pending()).toEqual([2, 3, 4, 5, 6]);

    // 2) Yo'ldagi xabar o'tmaydi: o'z mavzusida eng yangisi bo'lgani uchun navbatga tushadi, boshqalarnikiga tegmaydi
    const second = gate();
    reply = async (m) => {
      if (m.text === NEW) await second.wait;
      return offline();
    };
    const failed = await start(status(NEW));
    await others();
    second.open();
    expect(await failed.done).toBe(false);
    expect(db.state.rows.at(-1)).toMatchObject({ bot: 'customer', chatId: '777', topic: STATUS, html: NEW, sentAt: null, failedAt: null });
    // Har bir mavzuda bittadan kutayotgan xabar: ikkinchi turdagilar birinchi turdagi o'z mavzusini almashtirgan, mavzusizlar ikkalasi ham turibdi
    expect(db.state.rows.filter((r) => !r.sentAt && !r.failedAt).map((r) => `${r.bot} ${r.chatId} ${r.topic ?? '-'}`).sort()).toEqual([
      'customer 777 -',
      'customer 777 -',
      'customer 777 order-status:15',
      'customer 777 order-status:150',
      'customer 777 order-status:16',
      'customer 778 order-status:15',
      'staff 777 order-status:15',
    ]);
  });
});

describe('supersede: navbatdagi eski xabarni bekor qilish', () => {
  it('faqat shu bot, shu oluvchi va shu mavzudagi KUTAYOTGAN xabarlar "eskirgan" bo\'ladi; vaqt berilmasa — hozir', async () => {
    seed({ id: 1, bot: 'staff', chatId: '900', topic: 'audit' });
    seed({ id: 2, bot: 'staff', chatId: '900', topic: 'audit', nextAt: at(DAY), attempts: 5 });
    seed({ id: 3, bot: 'staff', chatId: '901', topic: 'audit' });
    seed({ id: 4, bot: 'customer', chatId: '900', topic: 'audit' });
    seed({ id: 5, bot: 'staff', chatId: '900', topic: 'audit:2' });
    seed({ id: 6, bot: 'staff', chatId: '900' });
    seed({ id: 7, bot: 'staff', chatId: '900', topic: 'audit', sentAt: at(-MIN), lastError: null });
    seed({ id: 8, bot: 'staff', chatId: '900', topic: 'audit', failedAt: at(-MIN), lastError: 'Telegram sendMessage: 400 Bad Request' });
    const untouched = snapshot(3, 4, 5, 6, 7, 8);

    await supersede('staff', 900, 'audit', at(-10_000));
    expect(row(1)).toMatchObject({ failedAt: at(-10_000), lastError: SUPERSEDED, sentAt: null, attempts: 1 });
    expect(row(2)).toMatchObject({ failedAt: at(-10_000), lastError: SUPERSEDED, sentAt: null, attempts: 5 });
    expect(snapshot(3, 4, 5, 6, 7, 8)).toEqual(untouched);
    expect(ids()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    await supersede('customer', '900', 'audit');
    expect(row(4)).toMatchObject({ failedAt: NOW, lastError: SUPERSEDED });
    expect(snapshot(3, 5, 6, 7, 8)).toEqual([untouched[0], ...untouched.slice(2)]);
  });

  it('baza xatosi chaqiruvchiga qaytadi (uni notify ushlaydi)', async () => {
    db.state.down = true;
    await expect(supersede('customer', '777', STATUS, NOW)).rejects.toThrow('baza ulanmadi');
  });
});

describe('supersedePrefix: bir turkum mavzularni hamma oluvchilarda bekor qilish', () => {
  const PREFIX = 'order-production:15:';

  it('shu botning mavzusi shu bilan BOSHLANADIGAN kutayotgan xabarlari "eskirgan" bo\'ladi — oluvchidan qat\'i nazar; qolganiga tegilmaydi', async () => {
    seed({ id: 1, chatId: '777', topic: `${PREFIX}7` });
    seed({ id: 2, chatId: '778', topic: `${PREFIX}7`, attempts: 4, nextAt: at(DAY) }); // shu topshiriq, boshqa oluvchi
    seed({ id: 3, chatId: '777', topic: `${PREFIX}8` }); // shu buyurtmaning boshqa topshirig'i
    seed({ id: 4, chatId: '777', topic: 'order-production:151:7' }); // raqami "15" bilan boshlanadigan boshqa buyurtma
    seed({ id: 5, chatId: '777', topic: 'order-production:1:5' });
    seed({ id: 6, chatId: '777', topic: 'order-production:15' }); // oxirgi ikki nuqtasiz — boshqa mavzu
    seed({ id: 7, chatId: '777', topic: STATUS }); // shu buyurtmaning holat xabari
    seed({ id: 8, chatId: '777', topic: `eski-${PREFIX}7` }); // qidirilgan matn boshida emas, o'rtasida
    seed({ id: 9, chatId: '777' }); // mavzusiz
    seed({ id: 10, bot: 'staff', chatId: '777', topic: `${PREFIX}7` }); // boshqa bot
    seed({ id: 11, chatId: '777', topic: `${PREFIX}7`, sentAt: at(-MIN), lastError: null }); // allaqachon yetib borgan
    seed({ id: 12, chatId: '777', topic: `${PREFIX}7`, failedAt: at(-MIN), attempts: 2, lastError: 'Telegram sendMessage: 403 Forbidden: bot was blocked by the user' }); // haqiqiy xato
    const untouched = snapshot(...range(4, 12));

    await supersedePrefix('customer', PREFIX, at(-10_000));
    expect(row(1)).toMatchObject({ attempts: 1, sentAt: null, failedAt: at(-10_000), lastError: SUPERSEDED });
    expect(row(2)).toMatchObject({ attempts: 4, nextAt: at(DAY), sentAt: null, failedAt: at(-10_000), lastError: SUPERSEDED });
    expect(row(3)).toMatchObject({ sentAt: null, failedAt: at(-10_000), lastError: SUPERSEDED });
    expect(snapshot(...range(4, 12))).toEqual(untouched);
    // O'chirilmaydi — belgilanadi (ayni paytda yuborilayotgan yozuv "topilmadi" xatosiga uchramasin)
    expect(ids()).toEqual(range(1, 12));

    // Bu Telegram xatosi emas: "yuborilmadi" sanog'ida faqat haqiqiy xato; bekor qilinganlari keyin ham yuborilmaydi
    expect(await outboxStats(NOW)).toEqual({ pending: 7, stuck: 0, failed24h: 1 });
    expect(await flushOutbox(NOW)).toEqual({ sent: 7, retry: 0, failed: 0 });
    expect(sent.map((m) => `${m.token} ${m.chat}`)).toEqual([...Array<string>(6).fill(`${CUSTOMER} 777`), `${STAFF} 777`]);
    expect(await flushOutbox(at(2 * DAY))).toEqual(NONE);
    expect(sent).toHaveLength(7);
  });

  it('vaqt berilmasa — hozir; mos yozuv bo\'lmasa hech narsa o\'zgarmaydi', async () => {
    seed({ id: 1, bot: 'staff', chatId: '900', topic: `${PREFIX}7` });
    seed({ id: 2, chatId: '777', topic: 'order-production:16:7' });
    const before = snapshot(1, 2);
    await supersedePrefix('customer', PREFIX);
    await supersedePrefix('customer', 'order-production:150:');
    expect(snapshot(1, 2)).toEqual(before);
    await supersedePrefix('staff', PREFIX);
    expect(row(1)).toMatchObject({ sentAt: null, failedAt: NOW, lastError: SUPERSEDED });
    expect(snapshot(2)).toEqual(before.slice(1));
  });

  it('baza xatosi chaqiruvchiga qaytadi (uni orderNotify ushlaydi)', async () => {
    db.state.down = true;
    await expect(supersedePrefix('customer', PREFIX, NOW)).rejects.toThrow('baza ulanmadi');
  });
});

describe('enqueue: navbatga qo\'yish', () => {
  it('birinchi urinish sanalgan holda yoziladi, keyingisi 5 daqiqadan keyin', async () => {
    const t = at(-3 * DAY);
    await enqueue('customer', 5123456789, '<b>Buyurtma #15</b>\nTayyor', KB, new TypeError('fetch failed'), t);
    await enqueue('staff', '-1001234567890', 'tugmasiz', undefined, 'matnli xato', t);
    expect(db.state.rows).toHaveLength(2);
    // Telegram ID 32 bitga sig'maydi va guruhlarda manfiy — matn sifatida, o'zgarishsiz
    expect(db.state.rows[0]).toMatchObject({ bot: 'customer', chatId: '5123456789', topic: null, html: '<b>Buyurtma #15</b>\nTayyor', inline: KB, attempts: 1, nextAt: new Date(t.getTime() + 5 * MIN), lastError: 'fetch failed', sentAt: null, failedAt: null });
    expect(db.state.rows[1]).toMatchObject({ bot: 'staff', chatId: '-1001234567890', topic: null, html: 'tugmasiz', inline: null, attempts: 1, nextAt: new Date(t.getTime() + 5 * MIN), lastError: 'matnli xato' });
    // Mavzusiz xabar navbatdagi boshqa yozuvlarga tegmaydi
    expect(db.table.updateMany).not.toHaveBeenCalled();
  });

  it('vaqt berilmasa "hozir"dan hisoblanadi', async () => {
    await enqueue('customer', '777', 'x', undefined, new Error('ECONNRESET'));
    expect(db.state.rows[0].nextAt).toEqual(at(5 * MIN));
  });

  it('Telegram uzoqroq kutishni so\'rasa (retry_after) o\'sha vaqt, qisqaroq bo\'lsa — baribir 5 daqiqa', async () => {
    await enqueue('customer', '1', 'x', undefined, new TelegramError('sendMessage', 429, 'Too Many Requests: retry after 900', 900), NOW);
    await enqueue('customer', '2', 'x', undefined, new TelegramError('sendMessage', 429, 'Too Many Requests: retry after 30', 30), NOW);
    await enqueue('customer', '3', 'x', undefined, new TelegramError('sendMessage', 502, 'Bad Gateway'), NOW);
    expect(db.state.rows.map((r) => r.nextAt)).toEqual([at(15 * MIN), at(5 * MIN), at(5 * MIN)]);
    expect(db.state.rows[0].lastError).toBe('Telegram sendMessage: 429 Too Many Requests: retry after 900');
  });

  it('xato matni 300 belgigacha kesiladi (emoji o\'rtasidan emas), xabar matni esa kesilmaydi', async () => {
    const html = `<b>${'ж'.repeat(3993)}</b>`;
    await enqueue('customer', '1', html, undefined, new Error('E'.repeat(1000)), NOW);
    await enqueue('customer', '2', 'x', undefined, new Error(`${'E'.repeat(299)}😀 davomi`), NOW);
    expect(html).toHaveLength(4000);
    expect(db.state.rows[0].html).toBe(html);
    expect(db.state.rows[0].lastError).toBe('E'.repeat(300));
    expect(db.state.rows[1].lastError).toBe('E'.repeat(299));
  });

  it('mavzu bilan: avval shu oluvchining shu mavzudagi kutayotgan xabari bekor qilinadi, keyin yangisi mavzusi bilan yoziladi', async () => {
    seed({ id: 1, chatId: '777', topic: STATUS, attempts: 3, nextAt: at(HOUR) });
    seed({ id: 2, chatId: '777', topic: 'order-status:16' });
    seed({ id: 3, chatId: '778', topic: STATUS });
    const untouched = snapshot(2, 3);
    const t = at(10 * MIN);

    await enqueue('customer', 777, 'Holati: Yetkazildi', KB, new TelegramError('sendMessage', 429, 'Too Many Requests: retry after 600', 600), t, STATUS);
    expect(row(1)).toMatchObject({ attempts: 3, sentAt: null, failedAt: t, lastError: SUPERSEDED });
    expect(snapshot(2, 3)).toEqual(untouched);
    expect(row(4)).toMatchObject({ bot: 'customer', chatId: '777', topic: STATUS, html: 'Holati: Yetkazildi', inline: KB, attempts: 1, nextAt: at(20 * MIN), sentAt: null, failedAt: null });
    // Yangi yozuvning o'zi bekor bo'lib qolmagan: avval yoziladi, keyin undan boshqalari bekor qilinadi
    expect(pending()).toEqual([2, 3, 4]);
  });

  // Ilgari avval eskisi bekor qilinib, keyin yangisi yozilardi: yozish yiqilsa ikkalasi ham yo'qolardi, "eskirgan" belgisi esa
  // "yetkazilmadi" hisobiga kirmagani uchun kunlik tekshiruvda ham ko'rinmasdi
  it('yangisini yozib bo\'lmasa (baza xatosi aynan shu so\'rovda) eski kutayotgan holat xabari bekor qilinmaydi — mijoz hech bo\'lmaganda uni oladi', async () => {
    seed({ id: 1, chatId: '777', topic: STATUS, attempts: 2, nextAt: at(HOUR) });
    const before = snapshot(1);
    db.table.create.mockRejectedValueOnce(new Error('baza ulanmadi'));
    await expect(enqueue('customer', 777, 'Holati: Yetkazildi', KB, new TypeError('fetch failed'), at(10 * MIN), STATUS)).rejects.toThrow('baza ulanmadi');
    expect(snapshot(1)).toEqual(before);
    expect(pending()).toEqual([1]);
    expect(db.table.updateMany).not.toHaveBeenCalled();
    // Keyingi tick eski holatni yetkazadi
    reply = OK;
    expect(await flushOutbox(at(HOUR))).toEqual({ sent: 1, retry: 0, failed: 0 });
  });

  it('baza xatosi chaqiruvchiga qaytadi (uni notify ushlaydi)', async () => {
    db.state.down = true;
    await expect(enqueue('customer', '1', 'x', undefined, new Error('x'), NOW)).rejects.toThrow('baza ulanmadi');
    await expect(enqueue('customer', '1', 'x', undefined, new Error('x'), NOW, STATUS)).rejects.toThrow('baza ulanmadi');
  });
});

describe('flushOutbox: navbatni qayta yuborish', () => {
  it('faqat vaqti kelgan xabarlar ketadi: id tartibida, har biri o\'z boti orqali, saqlangan tugmalari bilan', async () => {
    // Jadvalda tartibsiz turibdi — yuborish tartibi id bo'yicha bo'lishi kerak
    seed({ id: 3, bot: 'staff', chatId: '900', html: '<b>Yangi buyurtma #15</b>', inline: KB });
    seed({ id: 1, chatId: '777', html: 'Buyurtmangiz qabul qilindi' });
    seed({ id: 2, chatId: '778', html: 'Hisob-faktura tayyor', inline: [[{ text: 'Ochish', url: 'https://pack24.uz/uz/orders/abc/invoice' }]], nextAt: NOW });
    seed({ id: 4, chatId: '779', nextAt: at(1) }); // vaqti hali kelmagan
    seed({ id: 5, chatId: '780', sentAt: at(-HOUR), lastError: null }); // allaqachon yetib borgan
    seed({ id: 6, chatId: '781', failedAt: at(-HOUR), attempts: 6 }); // urinishlar tugagan
    const untouched = snapshot(4, 5, 6);

    expect(await flushOutbox(NOW)).toEqual({ sent: 3, retry: 0, failed: 0 });
    expect(sent).toEqual([
      { token: CUSTOMER, method: 'sendMessage', chat: '777', text: 'Buyurtmangiz qabul qilindi' },
      { token: CUSTOMER, method: 'sendMessage', chat: '778', text: 'Hisob-faktura tayyor', inline: [[{ text: 'Ochish', url: 'https://pack24.uz/uz/orders/abc/invoice' }]] },
      { token: STAFF, method: 'sendMessage', chat: '900', text: '<b>Yangi buyurtma #15</b>', inline: KB },
    ]);
    for (const id of [1, 2, 3]) expect(row(id), String(id)).toMatchObject({ attempts: 2, sentAt: NOW, failedAt: null, lastError: null });
    expect(snapshot(4, 5, 6)).toEqual(untouched);

    // Yetib borgan xabar ikkinchi marta yuborilmaydi; vaqti endi kelgani esa keyingi tick'da ketadi
    expect(await flushOutbox(NOW)).toEqual(NONE);
    expect(sent).toHaveLength(3);
    expect(await flushOutbox(at(1))).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(sent.slice(3).map((m) => m.chat)).toEqual(['779']);
    expect(snapshot(5, 6)).toEqual(untouched.slice(1));
  });

  it('vaqtincha xato: urinish sanaladi, keyingi vaqt bosqichma-bosqich uzayadi (15 daq, 1 soat, 3 soat, 12 soat)', async () => {
    reply = offline;
    for (const attempts of [1, 2, 3, 4]) {
      db.state.rows = [];
      seed({ id: attempts, attempts, lastError: 'eski xato' });
      expect(await flushOutbox(NOW), String(attempts)).toEqual({ sent: 0, retry: 1, failed: 0 });
      expect(row(attempts), String(attempts)).toMatchObject({ attempts: attempts + 1, nextAt: at(STEPS[attempts] * MIN), sentAt: null, failedAt: null, lastError: 'fetch failed' });
    }
    expect(sent).toHaveLength(4);
  });

  it('to\'liq zanjir: notify dan keyin 5, 15, 60, 180, 720 daqiqa oraliq bilan 5 marta qayta uriniladi, 6-urinish ham o\'tmasa "yuborilmadi"', async () => {
    customer('777');
    reply = tgError(502, 'Bad Gateway');
    expect(await notify('customer', '777', 'Buyurtmangiz yo\'lda', KB)).toBe(false);
    expect(row(1)).toMatchObject({ attempts: 1, nextAt: at(5 * MIN) });

    let t = NOW.getTime();
    for (const [i, step] of STEPS.entries()) {
      t += step * MIN;
      const last = i === STEPS.length - 1;
      // Vaqti kelishidan bir lahza oldin tegilmaydi
      expect(await flushOutbox(new Date(t - 1)), `${step} daqiqa to'lmasdan`).toEqual(NONE);
      expect(sent).toHaveLength(i + 1);

      expect(await flushOutbox(new Date(t)), `${step} daqiqadan keyin`).toEqual(last ? { sent: 0, retry: 0, failed: 1 } : { sent: 0, retry: 1, failed: 0 });
      expect(sent).toHaveLength(i + 2);
      expect(row(1)).toMatchObject({ attempts: i + 2, sentAt: null, failedAt: last ? new Date(t) : null });
      if (!last) expect(row(1)?.nextAt).toEqual(new Date(t + STEPS[i + 1] * MIN));
    }
    expect(OUTBOX_MAX_ATTEMPTS).toBe(6);
    expect(sent).toHaveLength(OUTBOX_MAX_ATTEMPTS);
    expect(sent.every((m) => m.chat === '777' && m.text === 'Buyurtmangiz yo\'lda' && m.token === CUSTOMER)).toBe(true);
    expect(row(1)?.lastError).toContain('502');
    expect(await outboxStats(new Date(t))).toEqual({ pending: 0, stuck: 0, failed24h: 1 });

    // "Yuborilmadi" bo'lgan xabarga boshqa urinilmaydi
    for (const later of [HOUR, DAY, 7 * DAY]) expect(await flushOutbox(new Date(t + later))).toEqual(NONE);
    expect(sent).toHaveLength(OUTBOX_MAX_ATTEMPTS);
  });

  it('oxirgi (6-) urinish: o\'tmasa failedAt qo\'yiladi, o\'tsa — oddiy yetkazilgan xabar', async () => {
    seed({ id: 1, attempts: 5 });
    seed({ id: 2, attempts: 5, chatId: '702' });
    reply = (m) => (m.chat === '702' ? OK() : offline());
    expect(await flushOutbox(NOW)).toEqual({ sent: 1, retry: 0, failed: 1 });
    expect(row(1)).toMatchObject({ attempts: 6, failedAt: NOW, sentAt: null, lastError: 'fetch failed' });
    expect(row(2)).toMatchObject({ attempts: 6, failedAt: null, sentAt: NOW, lastError: null });
  });

  it('qayta urinishda doimiy xato chiqsa (mijoz botni bloklab qo\'ygan) darhol "yuborilmadi" — qolgan urinishlar sarflanmaydi', async () => {
    seed({ id: 1, attempts: 1 });
    seed({ id: 2, attempts: 3, chatId: '702' });
    reply = (m) => (m.chat === '702' ? tgError(400, 'Bad Request: chat not found')() : BLOCKED());
    expect(await flushOutbox(NOW)).toEqual({ sent: 0, retry: 0, failed: 2 });
    expect(row(1)).toMatchObject({ attempts: 2, failedAt: NOW, sentAt: null, lastError: 'Telegram sendMessage: 403 Forbidden: bot was blocked by the user' });
    expect(row(2)).toMatchObject({ attempts: 4, failedAt: NOW, sentAt: null });
    expect(row(2)?.lastError).toContain('chat not found');

    reply = OK;
    expect(await flushOutbox(at(DAY))).toEqual(NONE);
    expect(sent).toHaveLength(2);
  });

  it('429: retry_after navbatdagi bosqichdan uzoq bo\'lsa o\'sha vaqt olinadi, qisqa bo\'lsa bosqich o\'zgarmaydi', async () => {
    seed({ id: 1, attempts: 1, chatId: '701' }); // navbatdagi bosqich: 15 daqiqa
    seed({ id: 2, attempts: 1, chatId: '702' });
    seed({ id: 3, attempts: 3, chatId: '703' }); // navbatdagi bosqich: 3 soat
    const waits: Record<string, number> = { 701: 3600, 702: 60, 703: 7200 };
    reply = (m) => tgError(429, 'Too Many Requests', waits[m.chat])();
    expect(await flushOutbox(NOW)).toEqual({ sent: 0, retry: 3, failed: 0 });
    expect(row(1)).toMatchObject({ attempts: 2, nextAt: at(HOUR), failedAt: null });
    expect(row(2)).toMatchObject({ attempts: 2, nextAt: at(15 * MIN), failedAt: null });
    expect(row(3)).toMatchObject({ attempts: 4, nextAt: at(3 * HOUR), failedAt: null });
    for (const id of [1, 2, 3]) expect(row(id)?.lastError).toContain('429');

    // Telegram so'ragan vaqt o'tmaguncha qayta urinilmaydi
    reply = OK;
    expect(await flushOutbox(at(HOUR - 1))).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(sent.slice(3).map((m) => m.chat)).toEqual(['702']);
    expect(await flushOutbox(at(HOUR))).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(sent.slice(4).map((m) => m.chat)).toEqual(['701']);
  });

  it('429 oxirgi urinishda kelsa ham xabar "yuborilmadi" bo\'ladi (cheksiz kutilmaydi)', async () => {
    seed({ id: 1, attempts: 5 });
    reply = tgError(429, 'Too Many Requests', 86_400);
    expect(await flushOutbox(NOW)).toEqual({ sent: 0, retry: 0, failed: 1 });
    expect(row(1)).toMatchObject({ attempts: 6, failedAt: NOW, sentAt: null });
  });

  it('boshqa jarayon band qilib ulgurgan xabar yuborilmaydi va holati o\'zgarmaydi', async () => {
    seed({ id: 1, chatId: '701' });
    seed({ id: 2, chatId: '702' });
    seed({ id: 3, chatId: '703' });
    // Ro'yxat o'qilgandan keyin, lekin band qilishdan oldin: parallel tick 1-xabarni oldi (urinish +1, vaqt surildi), 3-sini esa yetkazib ham bo'ldi
    db.state.afterFind = () => {
      Object.assign(row(1)!, { attempts: 2, nextAt: at(15 * MIN) });
      Object.assign(row(3)!, { attempts: 2, nextAt: at(15 * MIN), sentAt: at(-1), lastError: null });
    };

    expect(await flushOutbox(NOW)).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(sent.map((m) => m.chat)).toEqual(['702']);
    expect(row(1)).toMatchObject({ attempts: 2, nextAt: at(15 * MIN), sentAt: null, failedAt: null, lastError: 'fetch failed' });
    expect(row(2)).toMatchObject({ attempts: 2, sentAt: NOW });
    expect(row(3)).toMatchObject({ attempts: 2, sentAt: at(-1) });
  });

  it('boshqa jarayon band qilgan xabar bizda xato bilan tugagan deb ham hisoblanmaydi', async () => {
    seed({ id: 1, attempts: 5 });
    db.state.afterFind = () => Object.assign(row(1)!, { attempts: 6, nextAt: at(12 * HOUR) });
    reply = offline;
    expect(await flushOutbox(NOW)).toEqual(NONE);
    expect(sent).toEqual([]);
    expect(row(1)).toMatchObject({ attempts: 6, failedAt: null, sentAt: null });
  });

  it('ro\'yxat o\'qilgandan keyin o\'rnini yangisi bosgan (eskirgan) xabar yuborilmaydi', async () => {
    seed({ id: 1, chatId: '777', topic: STATUS, html: 'Holati: Yo\'lda' });
    seed({ id: 2, chatId: '778' });
    db.state.afterFind = () => Object.assign(row(1)!, { failedAt: at(-1), lastError: SUPERSEDED });

    expect(await flushOutbox(NOW)).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(sent.map((m) => m.chat)).toEqual(['778']);
    expect(row(1)).toMatchObject({ attempts: 1, sentAt: null, failedAt: at(-1), lastError: SUPERSEDED });
  });

  it('yuborilayotgan paytda o\'rnini yangisi bosgan xabar "yetkazildi"ga qaytarilmaydi va qayta yuborilmaydi', async () => {
    seed({ id: 1, chatId: '777', topic: STATUS, html: 'Holati: Yo\'lda' });
    seed({ id: 2, chatId: '778' });
    // Tick 1-xabarni band qilib, Telegram javobini kutayotgan paytda yangi holat to'g'ridan-to'g'ri yetib bordi (notify → supersede)
    reply = async (m) => {
      if (m.chat === '777') await supersede('customer', '777', STATUS, at(1000));
      return OK();
    };

    // Telegram qabul qilgani uchun tick uni "yuborildi" deb sanaydi, lekin yozuv "eskirgan"ligicha qoladi
    expect(await flushOutbox(NOW)).toEqual({ sent: 2, retry: 0, failed: 0 });
    expect(row(1)).toMatchObject({ attempts: 2, sentAt: null, failedAt: at(1000), lastError: SUPERSEDED });
    expect(row(2)).toMatchObject({ attempts: 2, sentAt: NOW, failedAt: null, lastError: null });

    reply = OK;
    for (const minute of [15, 60, 24 * 60]) expect(await flushOutbox(at(minute * MIN))).toEqual(NONE);
    expect(sent.map((m) => m.chat)).toEqual(['777', '778']);
    expect(await outboxStats(at(HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
  });

  it('yuborilayotgan paytda o\'rnini yangisi bosgan xabar xato bilan tugasa ham "eskirgan"ligicha qoladi — "yuborilmadi" hisobiga kirmaydi', async () => {
    seed({ id: 1, chatId: '777', topic: STATUS, attempts: 5 }); // oxirgi urinishi
    seed({ id: 2, chatId: '778', topic: STATUS, attempts: 2 });
    reply = async (m) => {
      await supersede('customer', m.chat, STATUS, at(1000));
      return m.chat === '777' ? offline() : BLOCKED();
    };

    await flushOutbox(NOW);
    expect(row(1)).toMatchObject({ attempts: 6, sentAt: null, failedAt: at(1000), lastError: SUPERSEDED });
    expect(row(2)).toMatchObject({ attempts: 3, sentAt: null, failedAt: at(1000), lastError: SUPERSEDED });
    expect(await outboxStats(at(HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
  });

  it('15 soniyalik chegara: Telegram sekin bo\'lsa tick to\'xtaydi, ulgurilmagan xabarlar tegilmay qoladi va keyingi tick\'da ketadi', async () => {
    for (let i = 0; i < 5; i += 1) seed();
    const waiting = snapshot(4, 5);
    // Har bir yuborish 6 soniya davom etadi: 0, 6 va 12-soniyada boshlanganlari ketadi, 18-soniyada chegara o'tgan bo'ladi
    reply = () => {
      vi.setSystemTime(Date.now() + 6_000);
      return OK();
    };
    expect(await flushOutbox(NOW)).toEqual({ sent: 3, retry: 0, failed: 0 });
    expect(sent.map((m) => m.chat)).toEqual(['701', '702', '703']);
    expect(snapshot(4, 5)).toEqual(waiting);

    vi.setSystemTime(at(5 * MIN));
    reply = OK;
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 2, retry: 0, failed: 0 });
    expect(sent.map((m) => m.chat)).toEqual(['701', '702', '703', '704', '705']);
  });

  it('Telegram umuman javob bermayapti (har so\'rov 10 soniyada uziladi): tick 2 ta urinishdan keyin to\'xtaydi, keyingisi navbatning davomidan boshlaydi', async () => {
    for (let i = 0; i < 5; i += 1) seed();
    const waiting = snapshot(3, 4, 5);
    reply = () => {
      vi.setSystemTime(Date.now() + 10_000);
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    };
    expect(await flushOutbox(NOW)).toEqual({ sent: 0, retry: 2, failed: 0 });
    expect(sent.map((m) => m.chat)).toEqual(['701', '702']);
    expect(snapshot(3, 4, 5)).toEqual(waiting);
    for (const id of [1, 2]) expect(row(id)).toMatchObject({ attempts: 2, nextAt: at(15 * MIN), failedAt: null });

    // Birinchi ikkitasi 15 daqiqaga surilgan — navbat boshida tiqilib qolmaydi
    vi.setSystemTime(at(5 * MIN));
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 0, retry: 2, failed: 0 });
    vi.setSystemTime(at(10 * MIN));
    expect(await flushOutbox(at(10 * MIN))).toEqual({ sent: 0, retry: 1, failed: 0 });
    expect(sent.map((m) => m.chat)).toEqual(['701', '702', '703', '704', '705']);
    expect(db.state.rows.map((r) => r.attempts)).toEqual([2, 2, 2, 2, 2]);
  });

  it('chegara o\'tgandan keyin oluvchisi uzilgan xabarlar ham tegilmay qoladi (keyingi tick\'da o\'chadi)', async () => {
    seed({ id: 1, chatId: '701' });
    seed({ id: 2, chatId: '702' }, false);
    seed({ id: 3, chatId: '703' });
    reply = () => {
      vi.setSystemTime(Date.now() + 16_000);
      return OK();
    };
    expect(await flushOutbox(NOW)).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(ids()).toEqual([1, 2, 3]);

    vi.setSystemTime(at(5 * MIN));
    reply = OK;
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(ids()).toEqual([1, 3]);
    expect(sent.map((m) => m.chat)).toEqual(['701', '703']);
  });

  it('bitta tick ko\'pi bilan 40 ta xabar oladi (eng eskilaridan), qolgani keyingi tick\'ka; yakunlangan xabarlar bu hisobga kirmaydi', async () => {
    // Jadval boshida yakunlangan (yetkazilgan, "yuborilmadi" va eskirgan) xabarlar ko'p — ular kutayotganlarning joyini egallamasligi kerak
    for (let i = 0; i < 20; i += 1) seed({ sentAt: at(-HOUR), lastError: null });
    for (let i = 0; i < 20; i += 1) seed({ failedAt: at(-HOUR), attempts: 6 });
    for (let i = 0; i < 10; i += 1) seed({ failedAt: at(-HOUR), lastError: SUPERSEDED, topic: STATUS });
    for (let i = 0; i < 45; i += 1) seed();
    expect(await flushOutbox(NOW)).toEqual({ sent: 40, retry: 0, failed: 0 });
    expect(sent.map((m) => m.chat)).toEqual(Array.from({ length: 40 }, (_, i) => `70${i + 51}`));
    expect(pending()).toEqual([91, 92, 93, 94, 95]);
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 5, retry: 0, failed: 0 });
    expect(sent).toHaveLength(45);
  });

  it('natija sanog\'i: yetkazilgan, keyinroq uriniladigan va "yuborilmadi" alohida; bitta xabardagi xato qolganlarini to\'xtatmaydi', async () => {
    seed({ id: 1, chatId: 'ok-1' });
    seed({ id: 2, chatId: 'server' });
    seed({ id: 3, chatId: 'blocked' });
    seed({ id: 4, chatId: 'offline' });
    seed({ id: 5, chatId: 'last', attempts: 5 });
    seed({ id: 6, chatId: 'ok-2', bot: 'staff' });
    seed({ id: 7, chatId: 'ketgan', bot: 'staff' }, false); // oluvchisi uzilgan: hech qaysi sanoqqa kirmaydi
    reply = (m) => {
      if (m.chat === 'server') return tgError(500, 'Internal Server Error')();
      if (m.chat === 'blocked') return BLOCKED();
      if (m.chat === 'last') return tgError(502, 'Bad Gateway')();
      if (m.chat === 'offline') return offline();
      return OK();
    };
    expect(await flushOutbox(NOW)).toEqual({ sent: 2, retry: 2, failed: 2 });
    expect(sent.map((m) => m.chat)).toEqual(['ok-1', 'server', 'blocked', 'offline', 'last', 'ok-2']);
    expect(db.state.rows.map((r) => [r.id, r.sentAt ? 'sent' : r.failedAt ? 'failed' : 'retry', r.attempts])).toEqual([
      [1, 'sent', 2], [2, 'retry', 2], [3, 'failed', 2], [4, 'retry', 2], [5, 'failed', 6], [6, 'sent', 2],
    ]);
  });

  it('tozalash: 3 kundan eski yetkazilganlar va 30 kundan eski "yuborilmadi"lar (eskirganlar ham) o\'chadi — boshqa hech narsa', async () => {
    seed({ id: 1, sentAt: at(-3 * DAY - 1), lastError: null }); // o'chadi
    seed({ id: 2, sentAt: at(-3 * DAY + MIN), lastError: null });
    seed({ id: 3, failedAt: at(-30 * DAY - 1), attempts: 6 }); // o'chadi
    seed({ id: 4, failedAt: at(-30 * DAY + MIN), attempts: 6 });
    seed({ id: 5, failedAt: at(-4 * DAY), attempts: 2 }); // "yuborilmadi" 3 kunda emas, 30 kunda o'chadi
    seed({ id: 6, createdAt: at(-100 * DAY), nextAt: at(HOUR), attempts: 5 }); // juda eski, lekin hali kutyapti
    seed({ id: 7, createdAt: at(-40 * DAY) }); // shu tick'da yetkaziladi
    seed({ id: 8, topic: STATUS, failedAt: at(-30 * DAY - 1), lastError: SUPERSEDED }); // eskirgan ham "yuborilmadi" kabi 30 kunda o'chadi
    seed({ id: 9, topic: STATUS, failedAt: at(-4 * DAY), lastError: SUPERSEDED });
    seed({ id: 10, bot: 'driver', failedAt: at(-30 * DAY - 1), lastError: NO_TOKEN }); // o'chadi
    seed({ id: 11, bot: 'driver', failedAt: at(-DAY), lastError: NO_TOKEN });
    const kept = snapshot(2, 4, 5, 6, 9, 11);

    expect(await flushOutbox(NOW)).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(ids()).toEqual([2, 4, 5, 6, 7, 9, 11]);
    expect(snapshot(2, 4, 5, 6, 9, 11)).toEqual(kept);
    expect(row(7)).toMatchObject({ sentAt: NOW });
    expect(sent.map((m) => m.chat)).toEqual(['707']);
  });

  it('tozalash xatosi tick natijasini buzmaydi', async () => {
    seed({ id: 1 });
    db.table.deleteMany.mockRejectedValueOnce(new Error('baza ulanmadi'));
    await expect(flushOutbox(NOW)).resolves.toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(row(1)).toMatchObject({ sentAt: NOW });
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('navbat bo\'sh: Telegram\'ga hech narsa ketmaydi', async () => {
    expect(await flushOutbox(NOW)).toEqual(NONE);
    expect(sent).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('flushOutbox: bot tokeni yo\'q', () => {
  it('bot tokeni olib tashlangan: xabar navbatda qoladi, urinish sarflanmaydi; token qaytsa yuboriladi', async () => {
    seed({ id: 1, bot: 'staff', chatId: '900', attempts: 3 });
    seed({ id: 2, bot: 'customer', chatId: '777' });
    seed({ id: 3, bot: 'driver', chatId: '555' }); // olib tashlangan bot turi: tokeni yo'q
    const before = snapshot(1, 3);
    vi.stubEnv('STAFF_BOT_TOKEN', '');

    expect(await flushOutbox(NOW)).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(via()).toEqual([`${CUSTOMER} 777`]);
    expect(snapshot(1, 3)).toEqual(before);
    // Bir necha tick o'tsa ham urinishlar tugab qolmaydi
    for (let i = 1; i <= 8; i += 1) expect(await flushOutbox(at(i * 5 * MIN))).toEqual(NONE);
    expect(snapshot(1, 3)).toEqual(before);

    vi.stubEnv('STAFF_BOT_TOKEN', STAFF);
    expect(await flushOutbox(at(HOUR))).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(via()).toEqual([`${CUSTOMER} 777`, `${STAFF} 900`]);
    expect(row(1)).toMatchObject({ attempts: 4, sentAt: at(HOUR) });
    expect(snapshot(3)).toEqual(before.slice(1));
  });

  // Ilgari tokeni yo'q botning 40+ xabari har tick'da butun "take: 40" ni egallardi — ulardan keyingi xabarlar hech qachon olinmasdi
  it('tokeni yo\'q botning xabarlari ko\'p bo\'lsa ham boshqa botning xabarlari yuboriladi', async () => {
    for (let i = 0; i < 45; i += 1) seed({ bot: i % 5 ? 'staff' : 'driver' });
    seed({ bot: 'customer', chatId: '777' });
    const blocked = snapshot(...range(1, 45));
    vi.stubEnv('STAFF_BOT_TOKEN', '');

    expect(await flushOutbox(NOW)).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(via()).toEqual([`${CUSTOMER} 777`]);
    expect(row(46)).toMatchObject({ attempts: 2, sentAt: NOW });
    // Tokensiz bot xabarlari tegilmagan: urinish sarflanmagan, "yuborilmadi" bo'lmagan
    expect(snapshot(...range(1, 45))).toEqual(blocked);

    // Token qaytgach ular ham ketadi (olib tashlangan bot turiniki — yo'q)
    vi.stubEnv('STAFF_BOT_TOKEN', STAFF);
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 36, retry: 0, failed: 0 });
    expect(sent.slice(1).every((m) => m.token === STAFF)).toBe(true);
    expect(pending()).toEqual(range(1, 45).filter((id) => (id - 1) % 5 === 0));
  });

  it('token 2 kunda ham qaytmasa xabar "yuborilmadi" bo\'ladi (bot tokeni yo\'q); yoshroqlari kutadi va token qaytsa yetib boradi', async () => {
    seed({ id: 1, bot: 'staff', chatId: '901', createdAt: at(-2 * DAY - 1), attempts: 3 }); // 2 kundan oshgan
    seed({ id: 2, bot: 'staff', chatId: '902', createdAt: at(-2 * DAY) }); // aynan 2 kun — hali emas
    seed({ id: 3, bot: 'staff', chatId: '903', createdAt: at(-HOUR), nextAt: at(HOUR) });
    seed({ id: 4, bot: 'driver', chatId: '555', createdAt: at(-3 * DAY) }); // olib tashlangan bot turi
    seed({ id: 5, bot: 'driver', chatId: '556', createdAt: at(-DAY) });
    seed({ id: 6, chatId: '777', createdAt: at(-5 * DAY), nextAt: at(HOUR), attempts: 5 }); // tokeni bor botniki: eski bo'lsa ham kutaveradi
    seed({ id: 7, bot: 'staff', chatId: '904', createdAt: at(-9 * DAY), sentAt: at(-HOUR), lastError: null }); // yakunlangan — tegilmaydi
    seed({ id: 8, bot: 'staff', chatId: '905', createdAt: at(-9 * DAY), failedAt: at(-HOUR), lastError: 'Telegram sendMessage: 403 Forbidden' });
    vi.stubEnv('STAFF_BOT_TOKEN', '');
    const kept = snapshot(2, 3, 5, 6, 7, 8);

    expect(await flushOutbox(NOW)).toEqual(NONE);
    expect(sent).toEqual([]);
    expect(row(1)).toMatchObject({ attempts: 3, sentAt: null, failedAt: NOW, lastError: NO_TOKEN });
    expect(row(4)).toMatchObject({ attempts: 1, sentAt: null, failedAt: NOW, lastError: NO_TOKEN });
    expect(snapshot(2, 3, 5, 6, 7, 8)).toEqual(kept);
    // Bu haqiqiy yo'qotish: kunlik tekshiruvda "yuborilmadi" bo'lib ko'rinadi (1, 4 va avvalgi 8)
    expect(await outboxStats(NOW)).toEqual({ pending: 4, stuck: 3, failed24h: 3 });

    // Token qaytdi: kutib turganlari yetib boradi, "yuborilmadi" bo'lganlari qayta yuborilmaydi
    vi.stubEnv('STAFF_BOT_TOKEN', STAFF);
    expect(await flushOutbox(at(MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(await flushOutbox(at(HOUR))).toEqual({ sent: 2, retry: 0, failed: 0 });
    expect(via()).toEqual([`${STAFF} 902`, `${STAFF} 903`, `${CUSTOMER} 777`]);
    expect(row(1)).toMatchObject({ attempts: 3, sentAt: null, failedAt: NOW });
    // Olib tashlangan bot turining yosh xabari ham 2 kundan oshgach yopiladi
    expect(row(5)).toMatchObject({ failedAt: null });
    expect(await flushOutbox(at(DAY + 1))).toEqual(NONE);
    expect(row(5)).toMatchObject({ sentAt: null, failedAt: at(DAY + 1), lastError: NO_TOKEN });
  });

  it('hech bir botning tokeni yo\'q: hech narsa yuborilmaydi, urinish sarflanmaydi, oluvchi tekshirilmaydi', async () => {
    seed({ id: 1, chatId: '777' });
    seed({ id: 2, bot: 'staff', chatId: '900', attempts: 4 });
    seed({ id: 3, chatId: '778' }, false); // oluvchisi uzilgan bo'lsa ham hozir o'chirilmaydi
    seed({ id: 4, chatId: '779', createdAt: at(-3 * DAY) });
    const before = snapshot(1, 2, 3);
    vi.stubEnv('CUSTOMER_BOT_TOKEN', '   ');
    vi.stubEnv('STAFF_BOT_TOKEN', '');

    for (let i = 0; i < 3; i += 1) expect(await flushOutbox(at(i * 5 * MIN))).toEqual(NONE);
    expect(sent).toEqual([]);
    expect(snapshot(1, 2, 3)).toEqual(before);
    expect(row(4)).toMatchObject({ attempts: 1, sentAt: null, failedAt: NOW, lastError: NO_TOKEN });
    for (const t of [db.user, db.telegramCustomer, db.order]) for (const fn of Object.values(t)) expect(fn).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();

    // Eski nomdagi kalit (SUPERVISOR_BOT_TOKEN) ham boshqaruv botini "tokenli" qiladi
    vi.stubEnv('SUPERVISOR_BOT_TOKEN', STAFF);
    expect(await flushOutbox(at(20 * MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(via()).toEqual([`${STAFF} 900`]);
  });

  it('eskirganlarni belgilash xatosi tick natijasini ham, tozalashni ham to\'xtatmaydi', async () => {
    seed({ id: 1, chatId: '777' });
    seed({ id: 2, bot: 'driver', createdAt: at(-3 * DAY) });
    seed({ id: 3, sentAt: at(-4 * DAY), lastError: null });
    // Faqat "tokeni yo'q bot" so'rovi yiqiladi (undagi shart: bot — ro'yxatda YO'Q)
    db.state.failUpdate = (where) => typeof where.bot === 'object';
    await expect(flushOutbox(NOW)).resolves.toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(row(1)).toMatchObject({ sentAt: NOW });
    expect(row(2)).toMatchObject({ failedAt: null });
    expect(ids()).toEqual([1, 2]); // 4 kun oldin yetkazilgani tozalangan
    expect(errors).toHaveBeenCalledTimes(1);
  });
});

describe('flushOutbox: oluvchi hali ham o\'zimiznikimi', () => {
  it('xodim: o\'chirib qo\'yilgan, o\'chirilgan, botdan uzilgan, roli olingan yoki xabarnomani o\'chirgan — xabar yuborilmaydi va navbatdan o\'chadi', async () => {
    const cases: [string, Partial<Staff>][] = [
      ['o\'chirib qo\'yilgan', { isActive: false }],
      ['o\'chirilgan', { deletedAt: at(-HOUR) }],
      ['botdan uzilgan', { telegramId: null }],
      ['roli olingan', { role: 'user' }],
      ['xabarnomani o\'chirgan', { telegramNotify: false }],
    ];
    for (const [i, [name, change]] of cases.entries()) {
      const u = staff(`90${i + 1}`, { name });
      seed({ id: i + 1, bot: 'staff', chatId: `90${i + 1}`, html: `<b>Yangi buyurtma</b> (${name})`, inline: KB, attempts: 2 });
      Object.assign(u, change);
      // Shu Telegram hisobi mijoz botida ro'yxatda bo'lishi xodim xabarini oqlamaydi
      customer(`90${i + 1}`);
    }
    seed({ id: 6, bot: 'staff', chatId: '906' }, false); // hech qachon ulanmagan chat
    seed({ id: 7, bot: 'staff', chatId: '907', attempts: 3 }); // faol menejer
    staff('908', { role: 'staff' });
    seed({ id: 8, bot: 'staff', chatId: '908' });
    staff('909', { role: 'admin' });
    seed({ id: 9, bot: 'staff', chatId: '909' });

    expect(await flushOutbox(NOW)).toEqual({ sent: 3, retry: 0, failed: 0 });
    expect(via()).toEqual([`${STAFF} 907`, `${STAFF} 908`, `${STAFF} 909`]);
    expect(ids()).toEqual([7, 8, 9]);
    expect(row(7)).toMatchObject({ attempts: 4, sentAt: NOW });
    // Bu Telegram xatosi emas: "yuborilmadi" deb sanalmaydi, hech narsa kutib ham qolmaydi
    expect(await outboxStats(NOW)).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
    // Tekshiruv band qilishdan OLDIN: uzilgan oluvchilarning xabariga urinish ham yozilmagan
    const claimed = db.table.updateMany.mock.calls.map(([a]) => a).filter((a) => a.data.attempts !== undefined).map((a) => a.where?.id);
    expect(claimed).toEqual([7, 8, 9]);
    expect(errors).not.toHaveBeenCalled();
  });

  it('mijoz: botdan chiqqan (/stop) yoki xabarnomani o\'chirgan — yuborilmaydi va o\'chadi; tasdiqlangan mijoz va havola orqali ulangan chat oladi', async () => {
    customer('701', { phone: '998901112233', verifiedAt: at(-DAY) }); // tasdiqlangan, xabarnomasi yoniq
    customer('702', { phone: '998901112234', verifiedAt: at(-DAY), notify: false }); // xabarnomani o'chirgan
    // 703 — /stop bosgan: yozuvi ham, ulangan buyurtmasi ham yo'q
    order({ telegramUserId: '704' }); // yozuvi yo'q (eski sessiya), lekin havola orqali ulangan buyurtmasi bor
    order({ telegramUserId: '705', deletedAt: at(-HOUR) }); // ulangan buyurtmasi o'chirilgan
    customer('706', { notify: false }); // buyurtmasi ulangan bo'lsa ham xabarnomani o'chirgan: yozuvdagi sozlama ustun
    order({ telegramUserId: '706' });
    staff('707'); // boshqaruv botidagi faol xodim mijoz botining oluvchisi emas
    for (let id = 1; id <= 7; id += 1) seed({ id, chatId: `70${id}`, html: `Buyurtma #${id} holati`, attempts: 2 }, false);

    expect(await flushOutbox(NOW)).toEqual({ sent: 2, retry: 0, failed: 0 });
    expect(via()).toEqual([`${CUSTOMER} 701`, `${CUSTOMER} 704`]);
    expect(ids()).toEqual([1, 4]);
    for (const id of [1, 4]) expect(row(id)).toMatchObject({ attempts: 3, sentAt: NOW, failedAt: null });
    expect(await outboxStats(NOW)).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
    const claimed = db.table.updateMany.mock.calls.map(([a]) => a).filter((a) => a.data.attempts !== undefined).map((a) => a.where?.id);
    expect(claimed).toEqual([1, 4]);
  });

  it('tekshiruv yuborish paytidagi holat bo\'yicha: vaqti kelmagan xabar o\'chirilmaydi, xabarnomani qayta yoqqan xodim uni oladi', async () => {
    const u = staff('900', { telegramNotify: false });
    seed({ id: 1, bot: 'staff', chatId: '900', nextAt: at(10 * MIN) });
    seed({ id: 2, bot: 'staff', chatId: '900', nextAt: at(-MIN) });

    expect(await flushOutbox(NOW)).toEqual(NONE);
    expect(ids()).toEqual([1]); // vaqti kelgani o'chdi, kelmagani tegilmadi
    u.telegramNotify = true;
    expect(await flushOutbox(at(10 * MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(via()).toEqual([`${STAFF} 900`]);
  });

  it('oluvchisi uzilgan xabarlar navbatni to\'smaydi: o\'chiriladi va ortidagi xabar yetib boradi', async () => {
    for (let i = 0; i < 45; i += 1) seed({ bot: i % 2 ? 'staff' : 'customer' }, false);
    seed({ chatId: '777', html: 'Buyurtmangiz yo\'lda' });

    // Bitta tick 40 ta yozuvni ko'radi: hammasi o'chadi, 46-xabar keyingisiga qoladi
    expect(await flushOutbox(NOW)).toEqual(NONE);
    expect(ids()).toEqual([41, 42, 43, 44, 45, 46]);
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(ids()).toEqual([46]);
    expect(sent).toEqual([{ token: CUSTOMER, method: 'sendMessage', chat: '777', text: 'Buyurtmangiz yo\'lda' }]);
  });

  it('oluvchisi uzilgan xabarni boshqa jarayon band qilib (yoki yetkazib) ulgurgan bo\'lsa — o\'chirilmaydi', async () => {
    seed({ id: 1, chatId: '701' }, false);
    seed({ id: 2, chatId: '702' }, false);
    seed({ id: 3, chatId: '703', topic: STATUS }, false);
    db.state.afterFind = () => {
      Object.assign(row(1)!, { attempts: 2, nextAt: at(15 * MIN) });
      Object.assign(row(2)!, { attempts: 2, sentAt: at(-1), lastError: null });
      Object.assign(row(3)!, { failedAt: at(-1), lastError: SUPERSEDED });
    };
    expect(await flushOutbox(NOW)).toEqual(NONE);
    expect(sent).toEqual([]);
    expect(row(1)).toMatchObject({ attempts: 2, nextAt: at(15 * MIN), sentAt: null, failedAt: null });
    expect(row(2)).toMatchObject({ attempts: 2, sentAt: at(-1) });
    expect(row(3)).toMatchObject({ attempts: 1, failedAt: at(-1), lastError: SUPERSEDED });
  });

  it('oluvchini tekshirib bo\'lmasa (baza xatosi): xabar yuborilmaydi ham, o\'chirilmaydi ham — keyingi tick\'da ketadi', async () => {
    seed({ id: 1, bot: 'staff', chatId: '900' });
    seed({ id: 2, chatId: '777' });
    const before = snapshot(1, 2);
    db.user.findFirst.mockRejectedValueOnce(new Error('baza ulanmadi'));

    // Xato tashqariga chiqishi mumkin (cron uni ushlaydi) — muhimi, xabar tekshiruvsiz ketmaydi va yo'qolmaydi
    await flushOutbox(NOW).catch(() => null);
    expect(sent.filter((m) => m.chat === '900')).toEqual([]);
    expect(snapshot(1)).toEqual(before.slice(0, 1));
    expect(ids()).toEqual([1, 2]);

    await flushOutbox(at(5 * MIN));
    expect(via().sort()).toEqual([`${CUSTOMER} 777`, `${STAFF} 900`].sort());
    expect(row(1)).toMatchObject({ attempts: 2, sentAt: at(5 * MIN) });
  });
});

describe('orderNotify: buyurtma xabarlarining mavzusi', () => {
  const PHONE = '998901112233';
  type StatusOrder = Parameters<typeof notifyCustomerOrderStatus>[0];
  const base: Partial<Order> = { id: 15, totalAmount: 250000, accessToken: null, telegramUserId: null, contactPhone: PHONE, userId: null, deliveryMethod: 'courier' };
  /** Holati o'zgargan buyurtma (orderFlow shu ko'rinishda beradi); summa bazada Decimal, bu yerda oddiy son yetarli */
  const ref = (status: StatusOrder['status'], over: Partial<Order> = {}) => ({ ...base, ...over, status }) as unknown as StatusOrder;
  const queued = () => db.state.rows.map((r) => ({ chatId: r.chatId, topic: r.topic, live: !r.sentAt && !r.failedAt }));

  beforeEach(() => {
    customer('777', { phone: PHONE, verifiedAt: at(-DAY) });
  });

  it('holat xabari "order-status:<buyurtma>" mavzusi bilan navbatga tushadi; yangi holat yetib borgach eskisi yuborilmaydi', async () => {
    reply = offline;
    expect(await notifyCustomerOrderStatus(ref('shipping'))).toBe(0);
    expect(queued()).toEqual([{ chatId: '777', topic: 'order-status:15', live: true }]);
    expect(row(1)?.html).toContain('Buyurtmangiz yo\'lga chiqdi.');
    expect(row(1)?.inline).toEqual([[{ text: '📦 Batafsil', callback_data: 'o_15' }]]);

    // Telegram tiklandi: "Yetkazildi" to'g'ridan-to'g'ri yetib boradi
    reply = OK;
    sent.length = 0;
    vi.setSystemTime(at(3 * MIN));
    expect(await notifyCustomerOrderStatus(ref('delivered'))).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('Buyurtmangiz yetkazildi.');
    expect(row(1)).toMatchObject({ sentAt: null, failedAt: at(3 * MIN), lastError: SUPERSEDED });

    // Kechikkan "Yo'lda" endi hech qachon ketmaydi
    for (const minute of [5, 20, 80]) expect(await flushOutbox(at(minute * MIN))).toEqual(NONE);
    expect(sent).toHaveLength(1);
  });

  it('har bir oluvchi va har bir buyurtma alohida: boshqa mijozning va boshqa buyurtmaning navbatdagi holati bekor bo\'lmaydi', async () => {
    customer('778', { lang: 'ru' });
    const linked = { telegramUserId: '778' };
    reply = offline;
    expect(await notifyCustomerOrderStatus(ref('processing', linked))).toBe(0);
    expect(await notifyCustomerOrderStatus(ref('shipping', { ...linked, id: 16 }))).toBe(0);
    expect(queued().sort((a, b) => `${a.topic}${a.chatId}`.localeCompare(`${b.topic}${b.chatId}`))).toEqual([
      { chatId: '777', topic: 'order-status:15', live: true },
      { chatId: '778', topic: 'order-status:15', live: true },
      { chatId: '777', topic: 'order-status:16', live: true },
      { chatId: '778', topic: 'order-status:16', live: true },
    ]);

    // 15-buyurtmaning yangi holati faqat 777 ga yetib bordi (778 da Telegram hali ham o'tmayapti)
    reply = (m) => (m.chat === '777' ? OK() : offline());
    expect(await notifyCustomerOrderStatus(ref('shipping', linked))).toBe(1);
    const state = db.state.rows.map((r) => `${r.chatId} ${r.topic} ${r.failedAt ? r.lastError : 'kutyapti'}`).sort();
    expect(state).toEqual([
      '777 order-status:15 eskirgan',
      '777 order-status:16 kutyapti',
      '778 order-status:15 eskirgan', // o'rniga 778 uchun yangi holat navbatga tushdi
      '778 order-status:15 kutyapti',
      '778 order-status:16 kutyapti',
    ]);
  });

  type WorkOrder = Parameters<typeof notifyCustomerProduction>[0];
  /** Buyurtmaga bog'langan ish topshirig'i (production/actions.ts shu ko'rinishda beradi): standart — 15-buyurtmaning «Quti 30x20» topshirig'i */
  const wo = (id: number, over: Partial<WorkOrder> = {}): WorkOrder => ({ id, orderId: 15, productName: 'Quti 30x20', currentStage: 'gofra', progress: 25, status: 'in_progress', ...over });
  /** Chat va xabarning birinchi satri (belgisi va buyurtma raqami): 🏭 — ishlab chiqarish, 📦 — holat, ✅ — to'lov, ℹ️ — to'lov tuzatishi, 🧾 — hisob-faktura */
  const heads = () => sent.map((m) => `${m.chat} ${m.text.split('\n')[0]}`).sort();

  // Ilgari mavzu mahsulot nomidan yasalardi: bitta buyurtmada bir xil mahsulotning ikki topshirig'i (ikki partiya) bir-birining xabarini bekor qilardi
  it('ishlab chiqarish xabari ish topshirig\'i bo\'yicha alohida mavzu oladi: bir buyurtmaning ikki topshirig\'i (mahsulot nomi bir xil bo\'lsa ham) bir-birini bekor qilmaydi', async () => {
    order({ ...base, status: 'processing' });
    reply = offline;
    expect(await notifyCustomerProduction(wo(7))).toBe(0);
    expect(await notifyCustomerProduction(wo(8, { currentStage: 'pechat', progress: 50 }))).toBe(0); // shu mahsulotning ikkinchi partiyasi
    expect(await notifyCustomerProduction(wo(9, { productName: 'Skotch <48mm>', currentStage: 'qc', progress: 90 }))).toBe(0);
    expect(queued()).toEqual([
      { chatId: '777', topic: 'order-production:15:7', live: true },
      { chatId: '777', topic: 'order-production:15:8', live: true },
      { chatId: '777', topic: 'order-production:15:9', live: true },
    ]);
    // Mavzuda mahsulot nomi yo'q; nom faqat matnda (HTML uchun qochirilgan)
    expect(db.state.rows.map((r) => r.topic).join(' ')).not.toMatch(/Quti|Skotch/);
    expect(row(3)?.html).toContain('Skotch &lt;48mm&gt;');

    // 7-topshiriqning keyingi bosqichi: faqat o'sha topshiriqning eski xabari o'rnini bosadi
    expect(await notifyCustomerProduction(wo(7, { currentStage: 'yiguv', progress: 75 }))).toBe(0);
    expect(queued()).toEqual([
      { chatId: '777', topic: 'order-production:15:7', live: false },
      { chatId: '777', topic: 'order-production:15:8', live: true },
      { chatId: '777', topic: 'order-production:15:9', live: true },
      { chatId: '777', topic: 'order-production:15:7', live: true },
    ]);
    expect(row(1)).toMatchObject({ lastError: SUPERSEDED });

    reply = OK;
    sent.length = 0;
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 3, retry: 0, failed: 0 });
    // Bir xil nomli ikki topshiriqning ikkalasi ham yetib bordi: 8-topshiriq o'z bosqichi bilan, 7-topshiriq — faqat oxirgisi bilan
    expect(sent.filter((m) => m.text.includes('Quti 30x20')).map((m) => /\((\d+)%\)/.exec(m.text)?.[1])).toEqual(['50', '75']);
    expect(sent.filter((m) => m.text.includes('Skotch'))).toHaveLength(1);
  });

  it('topshiriq raqami bir xil bo\'lsa ham boshqa buyurtmaning ishlab chiqarish xabari bekor bo\'lmaydi; har bir oluvchi o\'z navbatiga ega', async () => {
    customer('778', { lang: 'ru' });
    order({ ...base, telegramUserId: '778', status: 'processing' });
    order({ ...base, id: 16, status: 'processing' });
    reply = offline;
    expect(await notifyCustomerProduction(wo(7))).toBe(0);
    expect(await notifyCustomerProduction(wo(7, { orderId: 16 }))).toBe(0);
    // 15-buyurtmaning yangi bosqichi faqat 777 ga yetib bordi (778 da Telegram hali ham o'tmayapti)
    reply = (m) => (m.chat === '777' ? OK() : offline());
    expect(await notifyCustomerProduction(wo(7, { currentStage: 'pechat', progress: 50 }))).toBe(1);
    expect(db.state.rows.map((r) => `${r.chatId} ${r.topic} ${r.failedAt ? r.lastError : 'kutyapti'}`).sort()).toEqual([
      '777 order-production:15:7 eskirgan',
      '777 order-production:16:7 kutyapti',
      '778 order-production:15:7 eskirgan', // o'rniga 778 uchun yangi bosqich navbatga tushdi
      '778 order-production:15:7 kutyapti',
    ]);
  });

  // Bekor qilingan buyurtma uchun yangi ishlab chiqarish xabari chiqmaydi, ya'ni navbatdagilarini boshqa hech narsa bekor qilmasdi:
  // mijoz "Buyurtmangiz bekor qilindi"dan keyin kechikkan "... bosqichida (25%)" xabarini olardi
  it('buyurtma bekor qilinsa navbatdagi ishlab chiqarish xabarlari (hamma topshiriq, hamma oluvchi) endi yetib bormaydi; boshqa buyurtmanikiga, to\'lov xabariga tegilmaydi', async () => {
    customer('778', { lang: 'ru' });
    const linked = { telegramUserId: '778' };
    order({ ...base, ...linked, status: 'processing' });
    order({ ...base, ...linked, id: 151, status: 'processing' }); // raqami "15" bilan boshlanadigan boshqa buyurtma
    reply = offline;
    expect(await notifyCustomerProduction(wo(7))).toBe(0);
    expect(await notifyCustomerProduction(wo(8, { currentStage: 'pechat', progress: 50 }))).toBe(0);
    expect(await notifyCustomerProduction(wo(70, { orderId: 151 }))).toBe(0);
    expect(await notifyCustomerOrderStatus(ref('processing', linked))).toBe(0);
    expect(await notifyCustomerPaid(ref('processing', linked))).toBe(0);
    expect(pending()).toHaveLength(10);

    // Bekor qilindi — Telegram hali ham o'tmayapti: "bekor qilindi" xabarining o'zi ham navbatga tushadi
    vi.setSystemTime(at(MIN));
    expect(await notifyCustomerOrderStatus(ref('cancelled', linked))).toBe(0);
    const state = () => db.state.rows.map((r) => `${r.chatId} ${r.topic ?? '-'} ${r.failedAt ? r.lastError : 'kutyapti'}`).sort();
    expect(state()).toEqual(['777', '778'].flatMap((chat) => [
      `${chat} order-payment:15 kutyapti`, // to'lov xabari o'z mavzusida — bekor qilish unga tegmaydi
      `${chat} order-production:151:70 kutyapti`,
      `${chat} order-production:15:7 eskirgan`,
      `${chat} order-production:15:8 eskirgan`,
      `${chat} order-status:15 eskirgan`, // "Tayyorlanmoqda" — o'rnini "bekor qilindi" bosdi
      `${chat} order-status:15 kutyapti`,
    ]));
    // Bekor qilingan paytda belgilangan; bu Telegram xatosi emas — "yuborilmadi" sanog'iga kirmaydi
    for (const r of db.state.rows.filter((x) => x.topic?.startsWith('order-production:15:'))) expect(r).toMatchObject({ sentAt: null, failedAt: at(MIN), lastError: SUPERSEDED });
    expect(await outboxStats(at(MIN))).toEqual({ pending: 6, stuck: 0, failed24h: 0 });

    // Telegram tiklandi: bekor qilingan buyurtmaning ishlab chiqarish xabarlari hech qachon ketmaydi
    reply = OK;
    sent.length = 0;
    for (const minute of [5, 6, 20, 80, 24 * 60]) await flushOutbox(at(minute * MIN));
    expect(heads()).toEqual([
      '777 ✅ <b>Buyurtma #15</b>',
      '777 🏭 <b>Buyurtma #151</b>',
      '777 📦 <b>Buyurtma #15</b>',
      '778 ✅ <b>Заказ #15</b>',
      '778 🏭 <b>Заказ #151</b>',
      '778 📦 <b>Заказ #15</b>',
    ]);
    expect(sent.filter((m) => m.text.startsWith('📦')).map((m) => m.text.split('\n')[2])).toEqual(expect.arrayContaining(['Buyurtmangiz bekor qilindi.', 'Ваш заказ отменён.']));
    expect(pending()).toEqual([]);
  });

  it('"bekor qilindi" to\'g\'ridan-to\'g\'ri yetib borganda ham navbatdagi ishlab chiqarish xabarlari bekor bo\'ladi; boshqa holatlar (yo\'lda, yetkazildi) ularga tegmaydi', async () => {
    order({ ...base, status: 'processing' });
    reply = offline;
    expect(await notifyCustomerProduction(wo(7))).toBe(0);
    reply = OK;
    sent.length = 0;
    // Oddiy holat o'zgarishi: ishlab chiqarish xabari navbatda qoladi (u boshqa narsa haqida)
    for (const next of ['processing', 'shipping', 'delivered'] as const) expect(await notifyCustomerOrderStatus(ref(next))).toBe(1);
    expect(queued()).toEqual([{ chatId: '777', topic: 'order-production:15:7', live: true }]);
    expect(db.table.updateMany.mock.calls.every(([a]) => typeof a.where?.topic === 'string')).toBe(true);

    vi.setSystemTime(at(2 * MIN));
    expect(await notifyCustomerOrderStatus(ref('cancelled'))).toBe(1);
    expect(row(1)).toMatchObject({ sentAt: null, failedAt: at(2 * MIN), lastError: SUPERSEDED });
    // Avval navbat tozalanadi, keyin xabar yuboriladi: "bekor qilindi" yetib borgan paytda navbatda eski xabar qolmagan
    const prefixCall = db.table.updateMany.mock.invocationCallOrder[db.table.updateMany.mock.calls.findIndex(([a]) => typeof a.where?.topic === 'object')];
    expect(prefixCall).toBeLessThan(vi.mocked(fetch).mock.invocationCallOrder.at(-1)!);
    expect(db.table.updateMany.mock.calls.find(([a]) => typeof a.where?.topic === 'object')?.[0].where).toEqual({ bot: 'customer', topic: { startsWith: 'order-production:15:' }, sentAt: null, failedAt: null });

    sent.length = 0;
    for (const minute of [5, 20, 80]) expect(await flushOutbox(at(minute * MIN))).toEqual(NONE);
    expect(sent).toEqual([]);
  });

  // supersedePrefix faqat navbatda TURGAN yozuvlarni bekor qiladi; bekor qilish paytida yo'lda bo'lgan (Telegram javobini kutayotgan) xabarni staleInFlight eskirgan deb belgilaydi
  it('ishlab chiqarish xabari yo\'lda turgan paytda buyurtma bekor qilinsa, o\'sha xabar keyin navbatga tushmaydi', async () => {
    order({ ...base, status: 'processing' });
    const hold = gate();
    reply = async (m) => {
      if (!m.text.startsWith('🏭')) return OK();
      await hold.wait;
      return offline();
    };
    const production = notifyCustomerProduction(wo(7)); // javobi kutilmoqda (Telegram osilib turibdi)
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(await notifyCustomerOrderStatus(ref('cancelled'))).toBe(1);
    hold.open();
    expect(await production).toBe(0);
    expect(queued().filter((r) => r.live)).toEqual([]);
  });

  // Holat o'qilgandan keyin, notify() yo'ldagi xabar belgisini qo'yguncha (oluvchilar bazadan o'qilayotgan oraliq) bekor qilish tushsa, u na
  // yo'ldagi, na navbatdagi xabarni topadi. Shuning uchun ishlab chiqarish xabari yuborilgach holat qayta o'qiladi
  it('buyurtma ishlab chiqarish xabari yuborilayotgan paytda bekor qilingan bo\'lsa (bekor qilish uni ko\'rmagan): navbatga tushgani keyin ketmaydi', async () => {
    const o = order({ ...base, status: 'processing' });
    reply = () => {
      // Telegram javob bermayotgan paytda buyurtma boshqa jarayonda bekor qilindi — uning tozalashi bu xabarni hali topmagan
      o.status = 'cancelled';
      return offline();
    };
    expect(await notifyCustomerProduction(wo(7))).toBe(0);
    expect(queued()).toEqual([{ chatId: '777', topic: 'order-production:15:7', live: false }]);
    expect(row(1)).toMatchObject({ sentAt: null, lastError: SUPERSEDED });
    reply = OK;
    sent.length = 0;
    for (const minute of [5, 20, 80]) expect(await flushOutbox(at(minute * MIN))).toEqual(NONE);
    expect(sent).toEqual([]);
    // Bekor qilinmagan buyurtmada qayta o'qish hech narsani o'zgartirmaydi: xabar navbatda qoladi
    db.state.rows.length = 0;
    o.status = 'processing';
    reply = offline;
    expect(await notifyCustomerProduction(wo(7))).toBe(0);
    expect(queued()).toEqual([{ chatId: '777', topic: 'order-production:15:7', live: true }]);
  });

  it('navbatni tozalab bo\'lmasa ham (baza xatosi) "bekor qilindi" xabari yuboriladi: xato faqat logga tushadi', async () => {
    order({ ...base, status: 'processing' });
    reply = offline;
    expect(await notifyCustomerProduction(wo(7))).toBe(0);
    errors.mockClear();
    reply = OK;
    sent.length = 0;
    // Faqat "mavzusi shu bilan boshlanadigan" so'rov yiqiladi
    db.state.failUpdate = (where) => typeof where.topic === 'object';
    await expect(notifyCustomerOrderStatus(ref('cancelled'))).resolves.toBe(1);
    expect(sent.map((m) => m.text.split('\n')[2])).toEqual(['Buyurtmangiz bekor qilindi.']);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls[0].slice(0, 2)).toEqual(['[orderNotify] navbat', 15]);
    expect(errors.mock.calls[0].join(' ')).not.toContain(CUSTOMER);
    // Tozalanmagan xabar navbatda qolgan (keyingi tick uni yuboradi) — boshqa hech narsa buzilmagan
    expect(queued()).toEqual([{ chatId: '777', topic: 'order-production:15:7', live: true }]);
  });

  // ─── To'lov xabarlari: "to'lov qabul qilindi" va xato qo'yilgan belgining tuzatishi — bitta mavzu (order-payment:<buyurtma>) ───
  const PAYMENT = 'order-payment:15';
  const INVOICE = { invoiceNo: 'INV-15', totalAmount: 250000, dueDate: at(7 * DAY) };
  /** Navbat qatorlari yozilgan tartibda: chat, mavzu va holati */
  const states = () => db.state.rows.map((r) => `${r.chatId} ${r.topic ?? '-'} ${r.sentAt ? 'yetkazildi' : r.failedAt ? r.lastError : 'kutyapti'}`);
  /** "To'lov qabul qilindi" va uning tuzatishi (orderFlow.afterPaymentChange shu ko'rinishdagi buyurtma bilan chaqiradi) */
  const paid = (over: Partial<Order> = {}) => notifyCustomerPaid(ref('processing', over));
  const reverted = (over: Partial<Order> = {}) => notifyCustomerPaymentReverted(ref('processing', over));

  it('hisob-faktura xabari mavzusiz: navbatdagi holat va to\'lov xabarini ham, oldingi hisob-faktura xabarini ham bekor qilmaydi', async () => {
    order({ ...base, status: 'processing' });
    reply = offline;
    expect(await notifyCustomerOrderStatus(ref('processing'))).toBe(0);
    expect(await paid()).toBe(0);
    expect(await notifyCustomerInvoice(15, INVOICE)).toBe(0);
    expect(await notifyCustomerInvoice(15, INVOICE)).toBe(0);
    expect(queued()).toEqual([
      { chatId: '777', topic: 'order-status:15', live: true },
      { chatId: '777', topic: PAYMENT, live: true },
      { chatId: '777', topic: null, live: true },
      { chatId: '777', topic: null, live: true },
    ]);

    // Yetib borgan hisob-faktura xabari ham navbatga umuman tegmaydi
    reply = OK;
    db.table.updateMany.mockClear();
    expect(await notifyCustomerInvoice(15, INVOICE)).toBe(1);
    expect(db.table.updateMany).not.toHaveBeenCalled();
    expect(pending()).toEqual([1, 2, 3, 4]);
    sent.length = 0;
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 4, retry: 0, failed: 0 });
  });

  it('to\'lov xabari "order-payment:<buyurtma>" mavzusi bilan navbatga tushadi: takroriy "qabul qilindi" eskisining o\'rnini bosadi, holat va hisob-faktura xabarlariga tegilmaydi', async () => {
    order({ ...base, status: 'processing' });
    reply = offline;
    expect(await notifyCustomerOrderStatus(ref('processing'))).toBe(0);
    expect(await notifyCustomerInvoice(15, INVOICE)).toBe(0);
    expect(await paid()).toBe(0);
    expect(row(3)).toMatchObject({ bot: 'customer', chatId: '777', topic: PAYMENT, attempts: 1, nextAt: at(5 * MIN), sentAt: null, failedAt: null, inline: [[{ text: '📦 Batafsil', callback_data: 'o_15' }]] });
    expect(row(3)?.html).toMatch(/^✅ <b>Buyurtma #15<\/b>\nTo'lov qabul qilindi: <b>250\s000 so'm<\/b>$/);

    // Takroriy "qabul qilindi" (belgi olib tashlanib, qayta qo'yilgan): navbatda bittasi qoladi
    vi.setSystemTime(at(MIN));
    expect(await paid()).toBe(0);
    expect(states()).toEqual(['777 order-status:15 kutyapti', '777 - kutyapti', `777 ${PAYMENT} ${SUPERSEDED}`, `777 ${PAYMENT} kutyapti`]);

    // To'g'ridan-to'g'ri yetib borgan to'lov xabari: navbatdagi to'lov xabari bekor bo'ladi, qolganlari — yo'q
    reply = OK;
    vi.setSystemTime(at(2 * MIN));
    expect(await paid()).toBe(1);
    expect(states()).toEqual(['777 order-status:15 kutyapti', '777 - kutyapti', `777 ${PAYMENT} ${SUPERSEDED}`, `777 ${PAYMENT} ${SUPERSEDED}`]);
    expect(row(4)).toMatchObject({ sentAt: null, failedAt: at(2 * MIN), lastError: SUPERSEDED });
    sent.length = 0;
    expect(await flushOutbox(at(7 * MIN))).toEqual({ sent: 2, retry: 0, failed: 0 });
    expect(heads()).toEqual(['777 📦 <b>Buyurtma #15</b>', '777 🧾 <b>Buyurtma #15</b>']);
  });

  // Xodim «To'landi»ni xato bosdi va bekor qildi. Telegram vaqtincha javob bermay navbatda qolgan "to'lov qabul qilindi" tuzatishdan
  // KEYIN yetib borsa, mijoz buyurtmani to'langan deb o'ylab qolardi
  it('"to\'lov qabul qilindi" va uning tuzatishi bitta mavzuda: navbatda qolgan "qabul qilindi" tuzatish yetib borgach bekor bo\'ladi va keyin ham yuborilmaydi', async () => {
    reply = offline;
    expect(await paid()).toBe(0);
    expect(queued()).toEqual([{ chatId: '777', topic: PAYMENT, live: true }]);

    // Telegram tiklandi: tuzatish to'g'ridan-to'g'ri yetib boradi
    reply = OK;
    sent.length = 0;
    vi.setSystemTime(at(2 * MIN));
    expect(await reverted()).toBe(1);
    expect(heads()).toEqual(['777 ℹ️ <b>Buyurtma #15</b>']);
    expect(row(1)).toMatchObject({ attempts: 1, sentAt: null, failedAt: at(2 * MIN), lastError: SUPERSEDED });
    // Tuzatishning o'zi navbatga tushmagan; bekor bo'lgan xabar — Telegram xatosi emas ("yuborilmadi" sanog'iga kirmaydi)
    expect(ids()).toEqual([1]);
    expect(await outboxStats(at(2 * MIN))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });

    for (const minute of [5, 20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN))).toEqual(NONE);
    expect(sent).toHaveLength(1);
  });

  it('tuzatish ham navbatga tushsa (Telegram hali ham o\'tmayapti): har bir oluvchida faqat tuzatish kutadi — tiklangach mijoz faqat uni oladi', async () => {
    customer('778', { lang: 'ru' });
    const linked = { telegramUserId: '778' };
    reply = offline;
    expect(await paid(linked)).toBe(0);
    vi.setSystemTime(at(MIN));
    expect(await reverted(linked)).toBe(0);
    expect(states().sort()).toEqual(['777', '778'].flatMap((chat) => [`${chat} ${PAYMENT} ${SUPERSEDED}`, `${chat} ${PAYMENT} kutyapti`]));
    // Kutayotgani — aynan tuzatish, har kimga o'z tilida
    expect(db.state.rows.filter((r) => !r.failedAt).map((r) => `${r.chatId} ${r.html.split('\n')[0]}`).sort()).toEqual(['777 ℹ️ <b>Buyurtma #15</b>', '778 ℹ️ <b>Заказ #15</b>']);
    expect(await outboxStats(at(MIN))).toEqual({ pending: 2, stuck: 0, failed24h: 0 });

    reply = OK;
    sent.length = 0;
    // 5-daqiqa: "qabul qilindi"ning vaqti kelgan, lekin u bekor bo'lgan; tuzatishning vaqti — 6-daqiqada
    expect(await flushOutbox(at(5 * MIN))).toEqual(NONE);
    expect(await flushOutbox(at(6 * MIN))).toEqual({ sent: 2, retry: 0, failed: 0 });
    for (const minute of [20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN))).toEqual(NONE);
    expect(heads()).toEqual(['777 ℹ️ <b>Buyurtma #15</b>', '778 ℹ️ <b>Заказ #15</b>']);
    expect(pending()).toEqual([]);
  });

  // Teskari holat: tuzatish navbatda turganda belgi qayta qo'yildi (to'lov haqiqatan kelgan ekan) — endi eskirgan narsa tuzatishning o'zi
  it('teskarisi: navbatda qolgan tuzatish belgi qayta qo\'yilgach bekor bo\'ladi — mijoz faqat "to\'lov qabul qilindi"ni oladi', async () => {
    reply = offline;
    expect(await reverted()).toBe(0);
    expect(row(1)).toMatchObject({ topic: PAYMENT, sentAt: null, failedAt: null });
    expect(row(1)?.html.split('\n')[0]).toBe('ℹ️ <b>Buyurtma #15</b>');

    reply = OK;
    sent.length = 0;
    vi.setSystemTime(at(MIN));
    expect(await paid()).toBe(1);
    expect(row(1)).toMatchObject({ sentAt: null, failedAt: at(MIN), lastError: SUPERSEDED });
    for (const minute of [5, 20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN))).toEqual(NONE);
    expect(heads()).toEqual(['777 ✅ <b>Buyurtma #15</b>']);
  });

  it('belgi bir necha marta qo\'yilib-olinsa (hammasi navbatda): faqat eng oxirgi xabar kutadi va yetib boradi', async () => {
    reply = offline;
    for (const [i, step] of [paid, reverted, paid, reverted, paid].entries()) {
      vi.setSystemTime(at(i * MIN));
      expect(await step()).toBe(0);
    }
    expect(states()).toEqual([...Array<string>(4).fill(`777 ${PAYMENT} ${SUPERSEDED}`), `777 ${PAYMENT} kutyapti`]);
    expect(await outboxStats(at(4 * MIN))).toEqual({ pending: 1, stuck: 0, failed24h: 0 });

    reply = OK;
    sent.length = 0;
    expect(await flushOutbox(at(9 * MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
    for (const minute of [20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN))).toEqual(NONE);
    expect(heads()).toEqual(['777 ✅ <b>Buyurtma #15</b>']);
  });

  // Mavzu aniq tenglik bilan solishtiriladi (boshlanishi bo'yicha emas): 1-buyurtmaning tuzatishi 15- va 150-buyurtmaning xabarini bekor qilmasin
  it('boshqa buyurtmaning to\'lov xabariga tegilmaydi: 1, 15 va 150-buyurtma (raqami bir-birining boshi) — har biri o\'z mavzusida', async () => {
    reply = offline;
    for (const id of [1, 15, 150]) expect(await paid({ id })).toBe(0);
    expect(queued()).toEqual([1, 15, 150].map((id) => ({ chatId: '777', topic: `order-payment:${id}`, live: true })));

    // 15-buyurtmaning tuzatishi yetib bordi: faqat 15 niki bekor bo'ladi
    reply = OK;
    expect(await reverted({ id: 15 })).toBe(1);
    expect(states()).toEqual(['777 order-payment:1 kutyapti', `777 order-payment:15 ${SUPERSEDED}`, '777 order-payment:150 kutyapti']);

    // 1-buyurtmaning tuzatishi navbatga tushdi: 150 nikiga tegilmaydi
    reply = offline;
    vi.setSystemTime(at(MIN));
    expect(await reverted({ id: 1 })).toBe(0);
    expect(states()).toEqual([`777 order-payment:1 ${SUPERSEDED}`, `777 order-payment:15 ${SUPERSEDED}`, '777 order-payment:150 kutyapti', '777 order-payment:1 kutyapti']);
    // To'lov mavzusi navbatda hech qachon "shu bilan boshlanadigan" deb izlanmaydi
    expect(db.table.updateMany.mock.calls.map(([a]) => a.where?.topic)).toEqual(['order-payment:1', 'order-payment:15', 'order-payment:150', 'order-payment:15', 'order-payment:1']);

    reply = OK;
    sent.length = 0;
    expect(await flushOutbox(at(6 * MIN))).toEqual({ sent: 2, retry: 0, failed: 0 });
    expect(heads()).toEqual(['777 ℹ️ <b>Buyurtma #1</b>', '777 ✅ <b>Buyurtma #150</b>']);
  });

  it('to\'lov mavzusi holat va ishlab chiqarish xabarlarining o\'rnini bosmaydi; yangi holat va yangi bosqich ham navbatdagi to\'lov xabariga tegmaydi', async () => {
    order({ ...base, status: 'processing' });
    reply = offline;
    expect(await notifyCustomerOrderStatus(ref('processing'))).toBe(0);
    expect(await notifyCustomerProduction(wo(7))).toBe(0);
    expect(await paid()).toBe(0);
    expect(states()).toEqual(['777 order-status:15 kutyapti', '777 order-production:15:7 kutyapti', `777 ${PAYMENT} kutyapti`]);

    // Tuzatish yetib bordi: faqat to'lov xabari bekor bo'ladi
    reply = OK;
    expect(await reverted()).toBe(1);
    expect(states()).toEqual(['777 order-status:15 kutyapti', '777 order-production:15:7 kutyapti', `777 ${PAYMENT} ${SUPERSEDED}`]);

    // Endi tuzatish navbatda; yangi holat va yangi bosqich yetib boradi — o'z mavzusidagi eskisini bekor qiladi, tuzatishga tegmaydi
    reply = offline;
    expect(await reverted()).toBe(0);
    reply = OK;
    expect(await notifyCustomerOrderStatus(ref('shipping'))).toBe(1);
    expect(await notifyCustomerProduction(wo(7, { currentStage: 'pechat', progress: 50 }))).toBe(1);
    expect(states()).toEqual([`777 order-status:15 ${SUPERSEDED}`, `777 order-production:15:7 ${SUPERSEDED}`, `777 ${PAYMENT} ${SUPERSEDED}`, `777 ${PAYMENT} kutyapti`]);

    sent.length = 0;
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(heads()).toEqual(['777 ℹ️ <b>Buyurtma #15</b>']);
  });

  it('buyurtma bekor qilinsa (ishlab chiqarish xabarlari mavzu boshi bo\'yicha tozalanadi) navbatdagi to\'lov xabari ham, tuzatishi ham joyida qoladi va yetib boradi', async () => {
    order({ ...base, status: 'processing' });
    order({ ...base, id: 151, status: 'processing' });
    reply = offline;
    expect(await notifyCustomerProduction(wo(7))).toBe(0);
    expect(await reverted()).toBe(0); // 15-buyurtma: tuzatish navbatda
    expect(await paid({ id: 151 })).toBe(0); // raqami "15" bilan boshlanadigan buyurtma: "qabul qilindi" navbatda

    reply = OK;
    expect(await notifyCustomerOrderStatus(ref('cancelled'))).toBe(1);
    expect(states()).toEqual([`777 order-production:15:7 ${SUPERSEDED}`, `777 ${PAYMENT} kutyapti`, '777 order-payment:151 kutyapti']);
    // To'g'ridan-to'g'ri ham: ishlab chiqarish mavzusining boshi hech bir to'lov mavzusiga mos kelmaydi
    for (const id of [1, 15, 151]) await supersedePrefix('customer', `order-production:${id}:`);
    expect(pending()).toEqual([2, 3]);

    sent.length = 0;
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 2, retry: 0, failed: 0 });
    expect(heads()).toEqual(['777 ℹ️ <b>Buyurtma #15</b>', '777 ✅ <b>Buyurtma #151</b>']);
  });

  // Mavzu bitta bo'lgani uchun notify.ts dagi "oxirgi chiqarilgan xabar" hisobi ham ikkalasiga umumiy: osilib turgan eski xabar yangisidan keyin navbatga tushmaydi
  it('"to\'lov qabul qilindi" Telegram javobini kutib turgan paytda tuzatish chiqsa: kechikib yiqilgan "qabul qilindi" navbatga tushmaydi', async () => {
    const hold = gate();
    reply = async (m) => {
      if (!m.text.startsWith('✅')) return OK();
      await hold.wait;
      return offline();
    };
    const first = paid(); // javobi kutilmoqda (Telegram osilib turibdi)
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(await reverted()).toBe(1);
    hold.open();
    expect(await first).toBe(0);
    expect(db.state.rows).toEqual([]);
  });

  it('kechikib yetib borgan "to\'lov qabul qilindi" shu orada navbatga tushgan tuzatishni bekor qilmaydi: tuzatish keyin yetib boradi va oxirgi bo\'lib qoladi', async () => {
    const hold = gate();
    reply = async (m) => {
      if (!m.text.startsWith('✅')) return offline();
      await hold.wait;
      return OK();
    };
    const first = paid();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(await reverted()).toBe(0); // tuzatish o'tmadi — navbatga tushdi
    hold.open();
    expect(await first).toBe(1);
    expect(queued()).toEqual([{ chatId: '777', topic: PAYMENT, live: true }]);

    reply = OK;
    sent.length = 0;
    // Qatorning o'z vaqti bilan: vi.waitFor kutayotganda soxta soatni ham biroz suradi
    expect(await flushOutbox(row(1)!.nextAt)).toEqual({ sent: 1, retry: 0, failed: 0 });
    expect(heads()).toEqual(['777 ℹ️ <b>Buyurtma #15</b>']);
  });

  it('tuzatish xabari: har kimga o\'z tilida, ayblovsiz va summasiz; do\'kon telefoni, "Batafsil" tugmasi va buyurtma havolasi bilan', async () => {
    customer('778', { lang: 'ru' });
    // Buyurtma sahifasining havola kaliti: soxta qiymat sir skaneri (gitleaks) ruxsat bergan ko'rinishda
    const token = 'ci-dummy-order-link-secret';
    expect(await reverted({ telegramUserId: '778', accessToken: token })).toBe(2);
    expect(sent).toHaveLength(2);
    const uz = sent.find((m) => m.chat === '777')!;
    const ru = sent.find((m) => m.chat === '778')!;
    expect(uz.token).toBe(CUSTOMER);

    const [uzHead, uzBody, uzPhone, ...uzRest] = uz.text.split('\n');
    expect(uzHead).toBe('ℹ️ <b>Buyurtma #15</b>');
    expect(uzBody).toContain('«to\'lov qabul qilindi» belgisi xato qo\'yilgan edi — u olib tashlandi');
    expect(uzBody).toContain('<b>to\'lanmagan</b>');
    // "Buyurtma #15" sarlavhasi ostida "bekor qilindi" buyurtmaning o'zi bekor qilingandek o'qilardi
    expect(uz.text).not.toMatch(/bekor qilindi/i);
    // Xato do'konniki: tuzatish uzr bilan tugaydi
    expect(uzBody).toMatch(/ Noqulaylik uchun uzr so'raymiz\.$/);
    expect(uzPhone).toBe('Savollar bo\'lsa: +998 88 055 78 88');
    expect(uzRest).toEqual([]);

    const [ruHead, ruBody, ruPhone, ...ruRest] = ru.text.split('\n');
    expect(ruHead).toBe('ℹ️ <b>Заказ #15</b>');
    expect(ruBody).toContain('отметка «оплата получена» по этому заказу была поставлена по ошибке и снята');
    expect(ruBody).toContain('<b>неоплаченным</b>');
    expect(ru.text).not.toMatch(/отмен/iu);
    expect(ruBody).toMatch(/ Приносим извинения за неудобство\.$/);
    expect(ruPhone).toBe('Если есть вопросы: +998 88 055 78 88');
    expect(ruRest).toEqual([]);

    for (const m of [uz, ru]) {
      // Betaraf ohang: xato do'konniki — summa, undov va pul talab qiladigan so'zlar yo'q
      expect(m.text).not.toMatch(/250\s?000|so'm|сум/u);
      expect(m.text).not.toMatch(/[!❌⚠]/u);
      expect(m.text).not.toMatch(/qarz|to'lang|shoshiling|долг|оплатите|срочно/iu);
      // Telegram HTML: <b> dan boshqa teg yo'q
      expect(m.text.replace(/<\/?b>/g, '')).not.toMatch(/[<>]/);
    }
    expect(uz.inline).toEqual([[{ text: '📦 Batafsil', callback_data: 'o_15' }, { text: '🌐 Saytda ochish', url: `https://pack24.uz/uz/orders/${token}` }]]);
    expect(ru.inline).toEqual([[{ text: '📦 Подробнее', callback_data: 'o_15' }, { text: '🌐 Открыть на сайте', url: `https://pack24.uz/ru/orders/${token}` }]]);

    // Oluvchisi yo'q buyurtma (telefoni tasdiqlanmagan, chat ulanmagan): hech narsa yuborilmaydi va navbatga tushmaydi
    sent.length = 0;
    expect(await reverted({ contactPhone: '998909999999' })).toBe(0);
    expect(sent).toEqual([]);
    expect(db.state.rows).toEqual([]);
  });

  it('tuzatish xabari: do\'konda telefon kiritilmagan bo\'lsa "Savollar bo\'lsa" satri yozilmaydi; telefon matni HTML uchun qochiriladi; sozlamalar o\'qilmasa ham xabar ketadi', async () => {
    shop.phone = '';
    expect(await reverted()).toBe(1);
    expect(sent[0].text.split('\n')).toHaveLength(2);
    expect(sent[0].text).not.toMatch(/Savollar|\+998/);
    // Havola kaliti yo'q buyurtmada faqat "Batafsil"
    expect(sent[0].inline).toEqual([[{ text: '📦 Batafsil', callback_data: 'o_15' }]]);

    // 12 xonali bo'lmagan qiymat o'zgarishsiz chiqadi (displayPhone) — sozlamadagi belgilar xabar HTML'ini buzmasin
    sent.length = 0;
    shop.phone = '<b>88</b> 055 & 78';
    expect(await reverted()).toBe(1);
    expect(sent[0].text.split('\n')[2]).toBe('Savollar bo\'lsa: &lt;b&gt;88&lt;/b&gt; 055 &amp; 78');
    expect(sent[0].text.replace(/<\/?b>/g, '')).not.toMatch(/[<>]/);

    // Sozlamalarni o'qib bo'lmadi: tuzatish baribir ketadi, faqat telefon satrisiz; navbatga ham shu ko'rinishda tushadi
    sent.length = 0;
    shop.fail = true;
    await expect(reverted()).resolves.toBe(1);
    expect(sent[0].text.split('\n')).toHaveLength(2);
    reply = offline;
    await expect(reverted()).resolves.toBe(0);
    expect(db.state.rows.map((r) => ({ topic: r.topic, lines: r.html.split('\n').length }))).toEqual([{ topic: PAYMENT, lines: 2 }]);
  });

  // Bekor qilingan buyurtmadagi xato belgi ham olib tashlanadi (mijozda "to'lov qabul qilindi" xabari turibdi), lekin undan to'lov
  // kutilmaydi: "hozircha to'lanmagan" gapi mijozni to'lashga undagandek o'qilardi (hisob-faktura xabaridagi qoida bilan bir xil)
  it('tuzatish xabari buyurtma holatiga qarab: bekor qilingan buyurtmada "hozircha to\'lanmagan" gapi yo\'q (uz va ru) — sarlavha, birinchi gap, uzr, telefon va tugmalar joyida; qolgan hamma holatda gap bor', async () => {
    customer('778', { lang: 'ru' });
    // Buyurtma sahifasining havola kaliti: soxta qiymat sir skaneri (gitleaks) ruxsat bergan ko'rinishda
    const token = 'ci-dummy-order-link-secret';
    const linked = { telegramUserId: '778', accessToken: token };
    const text = {
      uz: { first: 'Tuzatish: bu buyurtma bo\'yicha «to\'lov qabul qilindi» belgisi xato qo\'yilgan edi — u olib tashlandi.', unpaid: 'Buyurtma hozircha <b>to\'lanmagan</b> deb hisoblanadi.', sorry: 'Noqulaylik uchun uzr so\'raymiz.' },
      ru: { first: 'Исправление: отметка «оплата получена» по этому заказу была поставлена по ошибке и снята.', unpaid: 'Заказ пока считается <b>неоплаченным</b>.', sorry: 'Приносим извинения за неудобство.' },
    };
    const body = (lang: keyof typeof text, owed: boolean) => [text[lang].first, ...(owed ? [text[lang].unpaid] : []), text[lang].sorry].join(' ');
    // Record: yangi holat qo'shilsa tsc shu jadvalni to'ldirishni talab qiladi — hech bir holat tekshiruvsiz qolmaydi
    const owed: Record<StatusOrder['status'], boolean> = { draft: true, new_: true, processing: true, shipping: true, delivered: true, cancelled: false };
    for (const [status, expected] of Object.entries(owed) as [StatusOrder['status'], boolean][]) {
      sent.length = 0;
      expect(await notifyCustomerPaymentReverted(ref(status, linked)), status).toBe(2);
      const uz = sent.find((m) => m.chat === '777')!;
      const ru = sent.find((m) => m.chat === '778')!;
      expect(uz.text.split('\n'), status).toEqual(['ℹ️ <b>Buyurtma #15</b>', body('uz', expected), 'Savollar bo\'lsa: +998 88 055 78 88']);
      expect(ru.text.split('\n'), status).toEqual(['ℹ️ <b>Заказ #15</b>', body('ru', expected), 'Если есть вопросы: +998 88 055 78 88']);
      expect(/to'lanmagan/i.test(uz.text), status).toBe(expected);
      expect(/неоплаченн/iu.test(ru.text), status).toBe(expected);
      // Hech bir holatda: buyurtma bekor qilingandek o'qiladigan ibora, summa va undov yo'q
      expect(uz.text, status).not.toMatch(/bekor qilindi/i);
      expect(ru.text, status).not.toMatch(/отмен/iu);
      for (const m of [uz, ru]) expect(m.text, status).not.toMatch(/250\s?000|so'm|сум|[!❌⚠]/u);
      expect(uz.inline, status).toEqual([[{ text: '📦 Batafsil', callback_data: 'o_15' }, { text: '🌐 Saytda ochish', url: `https://pack24.uz/uz/orders/${token}` }]]);
      expect(ru.inline, status).toEqual([[{ text: '📦 Подробнее', callback_data: 'o_15' }, { text: '🌐 Открыть на сайте', url: `https://pack24.uz/ru/orders/${token}` }]]);
    }
    expect(db.state.rows).toEqual([]);

    // Navbat orqali ham shunday: Telegram ishlamasa bekor qilingan buyurtmaning tuzatishi o'sha matn bilan, to'lov mavzusida navbatga tushadi
    reply = offline;
    expect(await notifyCustomerPaymentReverted(ref('cancelled', linked))).toBe(0);
    expect(queued().sort((a, b) => a.chatId.localeCompare(b.chatId))).toEqual([{ chatId: '777', topic: PAYMENT, live: true }, { chatId: '778', topic: PAYMENT, live: true }]);
    reply = OK;
    sent.length = 0;
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 2, retry: 0, failed: 0 });
    expect(sent.find((m) => m.chat === '777')?.text.split('\n')).toEqual(['ℹ️ <b>Buyurtma #15</b>', body('uz', false), 'Savollar bo\'lsa: +998 88 055 78 88']);
    expect(sent.find((m) => m.chat === '778')?.text.split('\n')).toEqual(['ℹ️ <b>Заказ #15</b>', body('ru', false), 'Если есть вопросы: +998 88 055 78 88']);
  });

  it('bekor qilingan buyurtmaning tuzatishi: do\'konda telefon kiritilmagan bo\'lsa xabar ikki satr — sarlavha va "to\'lanmagan" gapisiz tuzatish (uzr bilan tugaydi)', async () => {
    shop.phone = '';
    expect(await notifyCustomerPaymentReverted(ref('cancelled'))).toBe(1);
    expect(sent[0].text).toBe('ℹ️ <b>Buyurtma #15</b>\nTuzatish: bu buyurtma bo\'yicha «to\'lov qabul qilindi» belgisi xato qo\'yilgan edi — u olib tashlandi. Noqulaylik uchun uzr so\'raymiz.');
    expect(sent[0].inline).toEqual([[{ text: '📦 Batafsil', callback_data: 'o_15' }]]);
  });
});

// Tugmalarning to'liq jadvali — bot-staff.test.ts da, haqiqiy bazada — db/orderNotify.test.ts da. Bu yerda: xabarnoma har bir xodimga
// O'Z ruxsatiga mos tugmalar bilan ketishi («To'landi» hisob-fakturani ham yopadi — faqat moliya ruxsati borlarga) va navbatda ham aralashmasligi
describe('orderNotify: xodim kartasi — tugmalar oluvchining ruxsatiga qarab', () => {
  const card = (over: Partial<Order> = {}) =>
    order({ id: 15, status: 'new_', paymentMethod: 'cash', customerName: 'Olim', createdAt: at(-HOUR), items: [{ quantity: 2, product: { name: 'Quti 30x20' } }], corporateInvoices: [], ...over });
  const datas = (inline: unknown) => ((inline ?? []) as InlineKeyboard).flat().flatMap((b) => (b.callback_data ? [b.callback_data] : []));
  const cardOf = (chat: string) => datas(sent.find((m) => m.chat === chat)?.inline);

  beforeEach(() => {
    staff('900', { role: 'staff' });
    staff('901', { role: 'manager' });
    staff('902', { role: 'admin' });
    staff('903', { role: 'admin', telegramNotify: false });
    staff('904', { role: 'user' }); // mijoz akkaunti — xodim emas
    staff(null, { role: 'manager' }); // botga ulanmagan
  });

  it('yangi buyurtma: karta "orders" bo\'limidagi hamma xodimga boradi; «To\'landi» faqat moliya ruxsati borlarning kartasida', async () => {
    card();
    expect(await notifyStaffNewOrder(15)).toBe(3);
    expect(via().sort()).toEqual([`${STAFF} 900`, `${STAFF} 901`, `${STAFF} 902`]);
    expect(cardOf('900')).toEqual(['os_15_processing', 'oc_15', 'or_15']);
    for (const chat of ['901', '902']) expect(cardOf(chat), chat).toEqual(['os_15_processing', 'op_15', 'oc_15', 'or_15']);
    // Matn hammaga bir xil — faqat tugmalar farq qiladi
    expect(new Set(sent.map((m) => m.text)).size).toBe(1);
    expect(sent[0].text).toContain('🛒 <b>Yangi buyurtma</b>');
    expect(sent[0].text).toContain('Buyurtma #15');
    expect(sent[0].text).toContain('Quti 30x20 × 2');
    expect(db.state.rows).toEqual([]);
  });

  it('to\'langan naqd buyurtma: «To\'lov belgisini bekor qilish» faqat moliya ruxsati borlarda; Telegram ishlamasa har kimning kartasi o\'z tugmalari bilan navbatga tushadi va o\'ziga yetib boradi', async () => {
    card({ status: 'processing', paymentStatus: 'paid' });
    const expected = { 900: ['os_15_shipping', 'oc_15', 'or_15'], 901: ['os_15_shipping', 'oc_15', 'ou_15', 'or_15'], 902: ['os_15_shipping', 'oc_15', 'ou_15', 'or_15'] };

    reply = offline;
    expect(await notifyStaffPaid(15, 'Kassa')).toBe(0);
    // To'lov mavzusida (mijozga ketadigan to'lov xabarlari bilan bir xil satr, lekin boshqaruv botida): har bir xodimga bittadan, o'z tugmalari bilan
    expect(Object.fromEntries(db.state.rows.map((r) => [`${r.bot} ${r.chatId} ${r.topic ?? '-'}`, datas(r.inline)]))).toEqual({
      'staff 900 order-payment:15': expected[900],
      'staff 901 order-payment:15': expected[901],
      'staff 902 order-payment:15': expected[902],
    });
    for (const r of db.state.rows) expect(r).toMatchObject({ attempts: 1, nextAt: at(5 * MIN), sentAt: null, failedAt: null, lastError: 'fetch failed' });

    reply = OK;
    sent.length = 0;
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 3, retry: 0, failed: 0 });
    expect(via().sort()).toEqual([`${STAFF} 900`, `${STAFF} 901`, `${STAFF} 902`]);
    for (const [chat, buttons] of Object.entries(expected)) expect(cardOf(chat), chat).toEqual(buttons);
    expect(sent[0].text).toContain('✅ <b>To\'lov qabul qilindi</b> (Kassa)');
    // Bir martadan: keyingi ticklar hech narsa yubormaydi
    expect(await flushOutbox(at(80 * MIN))).toEqual(NONE);
    expect(sent).toHaveLength(3);
  });

  // Xodimlarga e'lon qilingan to'lov xato bo'lib chiqdi (orderFlow.afterPaymentChange): chatida "To'lov qabul qilindi" kartasi qolgan
  // xodim to'lanmagan buyurtmani jo'natib yubormasin — belgi bekor qilingani ham kartasi bilan shu xodimlarga boradi
  const REVERTED = '↩️ <b>To\'lov belgisi bekor qilindi</b> (Ali &lt;admin&gt; &amp; Co)';
  /** Buyurtma yana to'lanmagan: «To'landi» (op_) moliya ruxsati borlarga qaytadi, belgini bekor qilish (ou_) hech kimda yo'q */
  const UNPAID = { 900: ['os_15_shipping', 'oc_15', 'or_15'], 901: ['os_15_shipping', 'op_15', 'oc_15', 'or_15'], 902: ['os_15_shipping', 'op_15', 'oc_15', 'or_15'] };

  it('to\'lov belgisi bekor qilindi (notifyStaffPaymentReverted): izohli karta "orders" bo\'limidagi hamma xodimga; buyurtma yana to\'lanmagan — «To\'landi» faqat moliya ruxsati borlarning kartasida qaytadan chiqadi', async () => {
    card({ status: 'processing', paymentStatus: 'pending' });
    expect(await notifyStaffPaymentReverted(15, 'Ali <admin> & Co')).toBe(3);
    expect(via().sort()).toEqual([`${STAFF} 900`, `${STAFF} 901`, `${STAFF} 902`]);
    for (const [chat, buttons] of Object.entries(UNPAID)) expect(cardOf(chat), chat).toEqual(buttons);
    expect(sent.find((m) => m.chat === '901')?.inline?.[1]).toEqual([{ text: '💵 To\'landi', callback_data: 'op_15' }, { text: '❌ Bekor qilish', callback_data: 'oc_15' }]);
    // Matn hammaga bir xil: izoh birinchi satrda (kim bekor qilgani HTML uchun qochirilgan), keyin bo'sh satr va buyurtma kartasi — hozirgi (to'lanmagan) holati bilan
    expect(new Set(sent.map((m) => m.text)).size).toBe(1);
    expect(sent[0].text.split('\n').slice(0, 2)).toEqual([REVERTED, '']);
    expect(sent[0].text.split('\n')[2]).toMatch(/<b>Buyurtma #15<\/b> · Tayyorlanmoqda$/);
    expect(sent[0].text).toMatch(/💰 <b>250\s000 so'm<\/b> · Naqd · To'lanmagan/);
    expect(sent[0].text).toContain('Quti 30x20 × 2');
    expect(sent[0].text.replace(/<\/?b>/g, '')).not.toMatch(/[<>]/);
    // Navbatsiz: to'g'ridan-to'g'ri yetib bordi (mavzu faqat navbat uchun — navbatda bekor qiladigan narsa ham yo'q edi)
    expect(db.state.rows).toEqual([]);

    // Bekor qilingan buyurtmadan to'lov kutilmaydi: «To'landi» hech kimda yo'q (holat tugmalari ham — bekor qilingan buyurtmadan boshqa holatga o'tilmaydi)
    db.state.orders.length = 0;
    card({ status: 'cancelled', paymentStatus: 'pending' });
    sent.length = 0;
    expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(3);
    for (const chat of ['900', '901', '902']) expect(cardOf(chat), chat).toEqual(['or_15']);
    expect(sent[0].text.split('\n')[0]).toBe('↩️ <b>To\'lov belgisi bekor qilindi</b> (Kassa)');
  });

  it('belgi bekor qilingani haqidagi karta navbatdan ham o\'tadi: Telegram ishlamasa har kimniki o\'z tugmalari bilan navbatga tushadi va keyin o\'ziga yetib boradi', async () => {
    card({ status: 'processing', paymentStatus: 'pending' });
    reply = offline;
    expect(await notifyStaffPaymentReverted(15, 'Ali <admin> & Co')).toBe(0);
    // "To'lov qabul qilindi" kartasi bilan bitta mavzuda: har bir xodimga bittadan, o'z tugmalari bilan
    expect(Object.fromEntries(db.state.rows.map((r) => [`${r.bot} ${r.chatId} ${r.topic ?? '-'}`, datas(r.inline)]))).toEqual({
      'staff 900 order-payment:15': UNPAID[900],
      'staff 901 order-payment:15': UNPAID[901],
      'staff 902 order-payment:15': UNPAID[902],
    });
    for (const r of db.state.rows) expect(r).toMatchObject({ attempts: 1, nextAt: at(5 * MIN), sentAt: null, failedAt: null, lastError: 'fetch failed' });
    expect(new Set(db.state.rows.map((r) => r.html.split('\n')[0]))).toEqual(new Set([REVERTED]));
    expect(await outboxStats(NOW)).toEqual({ pending: 3, stuck: 0, failed24h: 0 });

    // Telegram hali ham ishlamayapti: karta navbatda qoladi (keyingi urinish — 15 daqiqadan keyin)
    sent.length = 0;
    expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 0, retry: 3, failed: 0 });
    expect(pending()).toHaveLength(3);

    reply = OK;
    sent.length = 0;
    expect(await flushOutbox(at(20 * MIN))).toEqual({ sent: 3, retry: 0, failed: 0 });
    expect(via().sort()).toEqual([`${STAFF} 900`, `${STAFF} 901`, `${STAFF} 902`]);
    for (const [chat, buttons] of Object.entries(UNPAID)) expect(cardOf(chat), chat).toEqual(buttons);
    for (const m of sent) expect(m.text.split('\n')[0]).toBe(REVERTED);
    expect(pending()).toEqual([]);
    // Bir martadan: keyingi ticklar hech narsa yubormaydi
    expect(await flushOutbox(at(80 * MIN))).toEqual(NONE);
    expect(sent).toHaveLength(3);
  });

  // "To'lov qabul qilindi" kartasi (to'langan holat, moliya xodimida «belgini bekor qilish») ham navbatda qolgan bo'lsa: u tuzatishdan
  // KEYIN yetib borsa xodim to'lanmagan buyurtmani to'langan deb jo'natib yuborardi. Ikkala karta bitta mavzuda (order-payment:<buyurtma>,
  // mijozga ketadigan to'lov xabarlari kabi): tuzatish navbatdagi "qabul qilindi"ning o'rnini bosadi — u endi umuman yuborilmaydi
  it('"To\'lov qabul qilindi" kartasi ham, tuzatish kartasi ham navbatda qolgan bo\'lsa: har bir xodimda faqat tuzatish kutadi — tiklangach yagona karta bo\'lib u (to\'lanmagan holat va o\'z tugmalari bilan) keladi, "qabul qilindi" esa yuborilmaydi', async () => {
    const o = card({ status: 'processing', paymentStatus: 'paid' });
    reply = offline;
    expect(await notifyStaffPaid(15, 'Hisob-faktura')).toBe(0);
    // Belgi bekor qilindi — Telegram hali ham o'tmayapti
    o.paymentStatus = 'pending';
    vi.setSystemTime(at(MIN));
    expect(await notifyStaffPaymentReverted(15, 'Ali <admin> & Co')).toBe(0);
    const corrections = db.state.rows.filter((r) => r.html.startsWith('↩️'));
    expect(corrections.map((r) => `${r.bot} ${r.chatId} ${r.topic ?? '-'}`).sort()).toEqual(['staff 900 order-payment:15', 'staff 901 order-payment:15', 'staff 902 order-payment:15']);
    for (const r of corrections) expect(r).toMatchObject({ attempts: 1, nextAt: at(6 * MIN), sentAt: null, failedAt: null });
    // "Qabul qilindi" kartalari shu paytda eskirgan deb belgilangan: har bir xodimniki, urinishi sarflanmagan
    const stale = db.state.rows.filter((r) => r.html.startsWith('✅'));
    expect(stale.map((r) => `${r.bot} ${r.chatId} ${r.topic ?? '-'}`).sort()).toEqual(['staff 900 order-payment:15', 'staff 901 order-payment:15', 'staff 902 order-payment:15']);
    for (const r of stale) expect(r).toMatchObject({ attempts: 1, nextAt: at(5 * MIN), sentAt: null, failedAt: at(MIN), lastError: SUPERSEDED });
    expect(db.state.rows).toHaveLength(6);
    // Bu Telegram xatosi emas: "yuborilmadi" sanog'iga kirmaydi
    expect(await outboxStats(at(MIN))).toEqual({ pending: 3, stuck: 0, failed24h: 0 });

    reply = OK;
    sent.length = 0;
    // 5-daqiqa: "qabul qilindi"ning vaqti kelgan bo'lardi — u bekor bo'lgan; tuzatishning vaqti — 6-daqiqada
    expect(await flushOutbox(at(5 * MIN))).toEqual(NONE);
    expect(await flushOutbox(at(6 * MIN))).toEqual({ sent: 3, retry: 0, failed: 0 });
    for (const minute of [20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN))).toEqual(NONE);
    // Har bir xodimga aynan bitta karta — tuzatish; "qabul qilindi" hech kimga ketmagan
    expect(via().sort()).toEqual([`${STAFF} 900`, `${STAFF} 901`, `${STAFF} 902`]);
    expect(sent.some((m) => m.text.includes('To\'lov qabul qilindi'))).toBe(false);
    for (const [chat, buttons] of Object.entries(UNPAID)) {
      const last = sent.filter((m) => m.chat === chat).at(-1)!;
      expect(last.text.split('\n')[0], chat).toBe(REVERTED);
      expect(last.text, chat).toMatch(/· Naqd · To'lanmagan/);
      expect(datas(last.inline), chat).toEqual(buttons);
    }
    expect(pending()).toEqual([]);
    expect(await outboxStats(at(HOUR))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
  });

  it('belgi bekor qilingani haqidagi karta: yo\'q yoki o\'chirilgan buyurtmada 0 qaytadi; baza ishlamasa ham xato tashlamaydi — hech narsa yuborilmaydi va navbatga tushmaydi', async () => {
    // Bunday buyurtma yo'q
    await expect(notifyStaffPaymentReverted(15, 'Kassa')).resolves.toBe(0);
    // O'chirilgan buyurtma
    card({ paymentStatus: 'pending', deletedAt: at(-HOUR) });
    await expect(notifyStaffPaymentReverted(15, 'Kassa')).resolves.toBe(0);
    // Bu xato emas: logga hech narsa yozilmaydi, xodimlar ro'yxati so'ralmaydi ham
    expect(errors).not.toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();

    // Baza ishlamayapti (to'lovni bekor qilish amali allaqachon bajarilgan — xabarnoma uni yiqitmasin): xato faqat logga tushadi
    db.state.orders.length = 0;
    card({ status: 'processing', paymentStatus: 'pending' });
    db.state.down = true;
    await expect(notifyStaffPaymentReverted(15, 'Kassa')).resolves.toBe(0);
    db.state.down = false;
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls[0].slice(0, 2)).toEqual(['[orderNotify] xodim kartasi', 15]);
    expect(errors.mock.calls[0].join(' ')).not.toContain(STAFF);
    expect(sent).toEqual([]);
    expect(db.state.rows).toEqual([]);

    // Baza tiklangach shu buyurtma uchun karta odatdagidek ketadi
    expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(3);
  });

  it('onlayn to\'langan buyurtma (Payme): to\'lov tugmalari hech kimda yo\'q — holat tugmalari hammada bir xil', async () => {
    card({ status: 'processing', paymentMethod: 'payme', paymentStatus: 'paid' });
    expect(await notifyStaffPaid(15, 'Payme')).toBe(3);
    for (const chat of ['900', '901', '902']) expect(cardOf(chat), chat).toEqual(['os_15_shipping', 'oc_15', 'or_15']);
  });

  // ─── To'lov kartalarining mavzusi ────────────────────────────────────────────
  // "✅ To'lov qabul qilindi" va "↩️ To'lov belgisi bekor qilindi" kartalari bitta mavzuda (order-payment:<buyurtma>) — mijozga ketadigan
  // to'lov xabarlari bilan bir xil satr, lekin navbat ham, yo'ldagi xabarlar hisobi ham har bir bot va har bir chat uchun alohida
  // (notify.ts, outbox.ts). Yangi buyurtma kartasi, ariza xabari va kunlik eslatma — mavzusiz
  describe('to\'lov kartalarining mavzusi: navbatda yoki yo\'lda kechikkan karta yangisidan keyin yetib bormaydi', () => {
    const PAYMENT = 'order-payment:15';
    const CHATS = ['900', '901', '902'];
    const ACCEPTED = '✅ <b>To\'lov qabul qilindi</b> (Hisob-faktura)';
    /** Buyurtma to'langan: belgini bekor qilish (ou_) faqat moliya ruxsati borlarda, «To'landi» (op_) hech kimda yo'q */
    const PAID = { 900: ['os_15_shipping', 'oc_15', 'or_15'], 901: ['os_15_shipping', 'oc_15', 'ou_15', 'or_15'], 902: ['os_15_shipping', 'oc_15', 'ou_15', 'or_15'] };
    /** Xabarning belgisi: ✅ — to'lov qabul qilindi, ↩️ — belgi bekor qilindi, 🛒 — yangi buyurtma, 📩 — ariza, ⏰ va ⏳ — kunlik eslatma, ℹ️ — mijozga tuzatish */
    const mark = (html: string) => html.split(' ')[0];
    const stateOf = (r: Row) => (r.sentAt ? 'yetkazildi' : r.failedAt ? r.lastError : 'kutyapti');
    /** Har bir xodimning navbati, yozilgan tartibda: xabarning belgisi, mavzusi va holati */
    const queues = () => Object.fromEntries(CHATS.map((chat) => [chat, db.state.rows.filter((r) => r.bot === 'staff' && r.chatId === chat).map((r) => `${mark(r.html)} ${r.topic ?? '-'} ${stateOf(r)}`)]));
    const everyone = (...rows: string[]) => Object.fromEntries(CHATS.map((chat) => [chat, rows]));
    /** Chat haqiqatan OLGAN xabarlar, yetib borgan tartibda (`sent` — urinishlar, o'tmaganlari bilan birga) */
    let got: string[];
    const deliver = (m: Sent) => {
      got.push(`${m.chat} ${mark(m.text)}`);
      return OK();
    };
    /** "To'lov qabul qilindi" kartalarini chiqaradi va uchala so'rov ham Telegram'ga yetib borguncha kutadi — javoblari hali yo'q (natijasi `done` da) */
    const startAccepted = async () => {
      const clock = Date.now();
      const done = notifyStaffPaid(15, 'Hisob-faktura');
      await vi.waitFor(() => expect(sent).toHaveLength(3));
      // vi.waitFor kutayotganda soxta soatni suradi — test vaqti o'zgarmasin
      vi.setSystemTime(clock);
      return { done };
    };

    beforeEach(() => {
      got = [];
    });

    it('tuzatish kartasi to\'g\'ridan-to\'g\'ri yetib borsa: har bir xodimning navbatdagi "To\'lov qabul qilindi" kartasi bekor bo\'ladi va keyin ham yuborilmaydi', async () => {
      const o = card({ status: 'processing', paymentStatus: 'paid' });
      reply = offline;
      expect(await notifyStaffPaid(15, 'Hisob-faktura')).toBe(0);
      expect(queues()).toEqual(everyone(`✅ ${PAYMENT} kutyapti`));

      // Telegram tiklandi (navbatning vaqti hali kelmagan); belgi bekor qilindi — tuzatish to'g'ridan-to'g'ri yetib boradi
      reply = OK;
      sent.length = 0;
      o.paymentStatus = 'pending';
      vi.setSystemTime(at(2 * MIN));
      expect(await notifyStaffPaymentReverted(15, 'Ali <admin> & Co')).toBe(3);
      expect(queues()).toEqual(everyone(`✅ ${PAYMENT} ${SUPERSEDED}`));
      // Urinishi sarflanmagan, bekor qilingan payt yozilgan; tuzatishning o'zi navbatga tushmagan
      for (const r of db.state.rows) expect(r).toMatchObject({ attempts: 1, nextAt: at(5 * MIN), sentAt: null, failedAt: at(2 * MIN), lastError: SUPERSEDED });
      expect(db.state.rows).toHaveLength(3);
      // Bu Telegram xatosi emas: "yuborilmadi" deb ham, "kutyapti" deb ham sanalmaydi
      expect(await outboxStats(at(2 * MIN))).toEqual({ pending: 0, stuck: 0, failed24h: 0 });
      // Navbatdagi har bir so'rov boshqaruv botining bitta chatiga va aniq shu mavzuga
      expect(db.table.updateMany.mock.calls.map(([a]) => `${String(a.where?.bot)} ${String(a.where?.chatId)} ${String(a.where?.topic)}`).sort()).toEqual(CHATS.flatMap((chat) => Array<string>(2).fill(`staff ${chat} ${PAYMENT}`)));

      for (const minute of [5, 20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN)), String(minute)).toEqual(NONE);
      // Har bir xodim chatida yagona karta — tuzatish: to'lanmagan holat va o'z tugmalari bilan
      expect(sent).toHaveLength(3);
      for (const [chat, buttons] of Object.entries(UNPAID)) {
        expect(sent.filter((m) => m.chat === chat).map((m) => m.text.split('\n')[0]), chat).toEqual([REVERTED]);
        expect(cardOf(chat), chat).toEqual(buttons);
      }
      expect(errors).toHaveBeenCalledTimes(3); // faqat "qabul qilindi"ning o'tmagan birinchi urinishlari
    });

    // Teskari holat: tuzatish kartasi navbatda turganda to'lov qayta qabul qilindi (hisob-faktura sahifasida) — endi eskirgan narsa tuzatishning o'zi
    it('teskarisi: navbatda qolgan tuzatish kartasi yangi "To\'lov qabul qilindi" kartasidan keyin yetib bormaydi — yangisi navbatga tushsa ham, to\'g\'ridan-to\'g\'ri yetib borsa ham', async () => {
      const o = card({ status: 'processing', paymentStatus: 'pending' });
      reply = offline;
      expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(0);
      expect(queues()).toEqual(everyone(`↩️ ${PAYMENT} kutyapti`));

      // To'lov qayta qabul qilindi — Telegram hali ham o'tmayapti: har bir xodimda faqat yangi karta kutadi
      o.paymentStatus = 'paid';
      vi.setSystemTime(at(MIN));
      expect(await notifyStaffPaid(15, 'Hisob-faktura')).toBe(0);
      expect(queues()).toEqual(everyone(`↩️ ${PAYMENT} ${SUPERSEDED}`, `✅ ${PAYMENT} kutyapti`));

      reply = OK;
      sent.length = 0;
      // 5-daqiqa: tuzatishning vaqti kelgan bo'lardi — u bekor bo'lgan; "qabul qilindi"ning vaqti — 6-daqiqada
      expect(await flushOutbox(at(5 * MIN))).toEqual(NONE);
      expect(await flushOutbox(at(6 * MIN))).toEqual({ sent: 3, retry: 0, failed: 0 });
      expect(sent).toHaveLength(3);
      for (const [chat, buttons] of Object.entries(PAID)) {
        expect(sent.filter((m) => m.chat === chat).map((m) => m.text.split('\n')[0]), chat).toEqual([ACCEPTED]);
        expect(cardOf(chat), chat).toEqual(buttons);
      }

      // To'g'ridan-to'g'ri yetib borgan "qabul qilindi" ham navbatdagi tuzatishni bekor qiladi
      reply = offline;
      o.paymentStatus = 'pending';
      vi.setSystemTime(at(10 * MIN));
      expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(0);
      reply = OK;
      sent.length = 0;
      o.paymentStatus = 'paid';
      vi.setSystemTime(at(11 * MIN));
      expect(await notifyStaffPaid(15, 'Hisob-faktura')).toBe(3);
      expect(queues()).toEqual(everyone(`↩️ ${PAYMENT} ${SUPERSEDED}`, `✅ ${PAYMENT} yetkazildi`, `↩️ ${PAYMENT} ${SUPERSEDED}`));
      for (const minute of [15, 20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN)), String(minute)).toEqual(NONE);
      expect(sent.map((m) => m.text.split('\n')[0])).toEqual([ACCEPTED, ACCEPTED, ACCEPTED]);
    });

    it('tuzatish bir xodimga o\'tmasa: faqat uning tuzatishi navbatga tushadi, "To\'lov qabul qilindi" kartasi esa uchalasida ham bekor bo\'ladi — eskirgan kartani hech kim olmaydi', async () => {
      const o = card({ status: 'processing', paymentStatus: 'paid' });
      reply = offline;
      expect(await notifyStaffPaid(15, 'Hisob-faktura')).toBe(0);

      // Tuzatish 900 va 901 ga yetib bordi, 902 da Telegram hali ham o'tmayapti
      reply = (m) => (m.chat === '902' ? offline() : OK());
      o.paymentStatus = 'pending';
      vi.setSystemTime(at(MIN));
      expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(2);
      expect(queues()).toEqual({ 900: [`✅ ${PAYMENT} ${SUPERSEDED}`], 901: [`✅ ${PAYMENT} ${SUPERSEDED}`], 902: [`✅ ${PAYMENT} ${SUPERSEDED}`, `↩️ ${PAYMENT} kutyapti`] });
      expect(await outboxStats(at(MIN))).toEqual({ pending: 1, stuck: 0, failed24h: 0 });

      reply = OK;
      sent.length = 0;
      expect(await flushOutbox(at(5 * MIN))).toEqual(NONE);
      expect(await flushOutbox(at(6 * MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
      for (const minute of [20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN)), String(minute)).toEqual(NONE);
      expect(sent.map((m) => `${m.token} ${m.chat} ${mark(m.text)}`)).toEqual([`${STAFF} 902 ↩️`]);
      expect(cardOf('902')).toEqual(UNPAID[902]);
    });

    it('to\'lov bir necha marta qabul qilinib, belgisi bekor qilinsa (hammasi navbatda): har bir xodimda faqat eng oxirgi karta kutadi va yetib boradi', async () => {
      const o = card({ status: 'processing', paymentStatus: 'pending' });
      reply = offline;
      for (const [i, accepted] of [true, false, true, false].entries()) {
        vi.setSystemTime(at(i * MIN));
        o.paymentStatus = accepted ? 'paid' : 'pending';
        expect(await (accepted ? notifyStaffPaid(15, 'Hisob-faktura') : notifyStaffPaymentReverted(15, 'Ali <admin> & Co')), String(i)).toBe(0);
      }
      expect(queues()).toEqual(everyone(`✅ ${PAYMENT} ${SUPERSEDED}`, `↩️ ${PAYMENT} ${SUPERSEDED}`, `✅ ${PAYMENT} ${SUPERSEDED}`, `↩️ ${PAYMENT} kutyapti`));
      expect(await outboxStats(at(3 * MIN))).toEqual({ pending: 3, stuck: 0, failed24h: 0 });

      reply = OK;
      sent.length = 0;
      // Eskirganlarining vaqti 5, 6 va 7-daqiqada kelgan bo'lardi
      for (const minute of [5, 6, 7]) expect(await flushOutbox(at(minute * MIN)), String(minute)).toEqual(NONE);
      expect(await flushOutbox(at(8 * MIN))).toEqual({ sent: 3, retry: 0, failed: 0 });
      for (const minute of [20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN)), String(minute)).toEqual(NONE);
      expect(sent).toHaveLength(3);
      for (const [chat, buttons] of Object.entries(UNPAID)) {
        expect(sent.filter((m) => m.chat === chat).map((m) => m.text.split('\n')[0]), chat).toEqual([REVERTED]);
        expect(cardOf(chat), chat).toEqual(buttons);
      }
    });

    // Bitta Telegram hisobi ham xodim (boshqaruv boti), ham shu buyurtmaning mijozi (mijoz boti) bo'lishi mumkin: chat raqami ham, mavzu
    // satri ham bir xil — lekin bu ikki alohida suhbat. Xodim kartasi mijoz xabarining o'rnini bosmaydi va aksincha
    it('mavzu har bir bot uchun alohida: chat raqami va mavzusi bir xil bo\'lsa ham xodim kartasi mijoz botidagi navbatga, mijoz xabari esa boshqaruv botidagi navbatga tegmaydi', async () => {
      customer('901');
      const o = card({ status: 'processing', paymentStatus: 'paid', telegramUserId: '901' });
      const ref = o as unknown as Parameters<typeof notifyCustomerPaid>[0];
      /** 901-chatning ikkala botdagi navbati, yozilgan tartibda */
      const both = () => db.state.rows.filter((r) => r.chatId === '901').map((r) => `${r.bot} ${mark(r.html)} ${r.topic ?? '-'} ${stateOf(r)}`);
      reply = offline;
      expect(await notifyCustomerPaid(ref)).toBe(0);
      expect(await notifyStaffPaid(15, 'Hisob-faktura')).toBe(0);
      expect(both()).toEqual([`customer ✅ ${PAYMENT} kutyapti`, `staff ✅ ${PAYMENT} kutyapti`]);

      // Faqat boshqaruv boti tiklandi: tuzatish kartasi xodimlarga yetib boradi — mijoz botidagi navbatga tegilmaydi
      reply = (m) => (m.token === STAFF ? OK() : offline());
      o.paymentStatus = 'pending';
      db.table.updateMany.mockClear();
      expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(3);
      expect(both()).toEqual([`customer ✅ ${PAYMENT} kutyapti`, `staff ✅ ${PAYMENT} ${SUPERSEDED}`]);
      expect(db.table.updateMany.mock.calls.map(([a]) => a.where?.bot)).toEqual(['staff', 'staff', 'staff']);

      // Mijozga tuzatish navbatga tushadi (mijoz boti hali ham o'tmayapti): faqat mijoz botidagi "qabul qilindi"ning o'rnini bosadi
      expect(await notifyCustomerPaymentReverted(ref)).toBe(0);
      expect(both()).toEqual([`customer ✅ ${PAYMENT} ${SUPERSEDED}`, `staff ✅ ${PAYMENT} ${SUPERSEDED}`, `customer ℹ️ ${PAYMENT} kutyapti`]);

      // Aksincha: xodim kartasi navbatda turganda mijozga yangi xabar yetib boradi — boshqaruv botidagi navbatga tegilmaydi
      reply = offline;
      o.paymentStatus = 'paid';
      expect(await notifyStaffPaid(15, 'Hisob-faktura')).toBe(0);
      reply = (m) => (m.token === CUSTOMER ? OK() : offline());
      db.table.updateMany.mockClear();
      expect(await notifyCustomerPaid(ref)).toBe(1);
      expect(both()).toEqual([`customer ✅ ${PAYMENT} ${SUPERSEDED}`, `staff ✅ ${PAYMENT} ${SUPERSEDED}`, `customer ℹ️ ${PAYMENT} ${SUPERSEDED}`, `staff ✅ ${PAYMENT} kutyapti`]);
      expect(db.table.updateMany.mock.calls.map(([a]) => a.where?.bot)).toEqual(['customer']);
      expect(queues()).toEqual(everyone(`✅ ${PAYMENT} ${SUPERSEDED}`, `✅ ${PAYMENT} kutyapti`));

      // Tiklangach xodim kartasi boshqaruv boti orqali yetib boradi; mijoz botining navbatidan hech narsa ketmaydi
      reply = OK;
      sent.length = 0;
      expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 3, retry: 0, failed: 0 });
      expect(via().sort()).toEqual([`${STAFF} 900`, `${STAFF} 901`, `${STAFF} 902`]);
      expect(sent.map((m) => m.text.split('\n')[0])).toEqual([ACCEPTED, ACCEPTED, ACCEPTED]);
    });

    it('yo\'ldagi xabarlar hisobi ham har bir bot uchun alohida: xodim kartasi Telegram javobini kutayotganda shu chatga mijoz botidan shu mavzuda xabar chiqsa, kechikib yiqilgan karta baribir navbatga tushadi', async () => {
      customer('901');
      const o = card({ status: 'processing', paymentStatus: 'paid', telegramUserId: '901' });
      const hold = gate();
      reply = async (m) => {
        if (m.token !== STAFF || m.chat !== '901') return OK();
        await hold.wait;
        return offline();
      };
      const cards = notifyStaffPaid(15, 'Hisob-faktura'); // 901 ning kartasi javob kutmoqda, qolgan ikkitasi yetib bordi
      await vi.waitFor(() => expect([...issued().keys()]).toEqual([`staff:901:${PAYMENT}`]));
      expect(await notifyCustomerPaid(o as unknown as Parameters<typeof notifyCustomerPaid>[0])).toBe(1); // shu chat, shu mavzu — lekin mijoz boti
      expect([...issued().keys()]).toEqual([`staff:901:${PAYMENT}`]);
      hold.open();
      expect(await cards).toBe(2);
      // O'z botida u hamon eng yangisi: navbatga tushadi va keyin yetib boradi
      expect(db.state.rows.map((r) => `${r.bot} ${r.chatId} ${r.topic ?? '-'} ${stateOf(r)}`)).toEqual([`staff 901 ${PAYMENT} kutyapti`]);
      reply = OK;
      sent.length = 0;
      expect(await flushOutbox(row(1)!.nextAt)).toEqual({ sent: 1, retry: 0, failed: 0 });
      expect(sent.map((m) => `${m.token} ${m.chat} ${m.text.split('\n')[0]}`)).toEqual([`${STAFF} 901 ${ACCEPTED}`]);
      expect(cardOf('901')).toEqual(PAID[901]);
    });

    // Mavzu aniq tenglik bilan solishtiriladi (boshlanishi bo'yicha emas): 1-buyurtmaning tuzatishi 15- va 150-buyurtmaning kartasini bekor qilmasin
    it('boshqa buyurtmaning to\'lov kartasiga tegilmaydi: 1, 15 va 150-buyurtma (raqami bir-birining boshi) — har biri o\'z mavzusida', async () => {
      const [first, middle] = [1, 15, 150].map((id) => card({ id, status: 'processing', paymentStatus: 'paid' }));
      /** Har bir xodimda shu qatorlar (tartibsiz solishtirish uchun saralangan) */
      const each = (...rows: string[]) => CHATS.flatMap((chat) => rows.map((r) => `${chat} ${r}`)).sort();
      const waiting = () => db.state.rows.filter((r) => !r.sentAt && !r.failedAt).map((r) => `${r.chatId} ${mark(r.html)} ${r.topic ?? '-'}`).sort();
      reply = offline;
      for (const id of [1, 15, 150]) expect(await notifyStaffPaid(id, 'Hisob-faktura')).toBe(0);
      expect(waiting()).toEqual(each('✅ order-payment:1', '✅ order-payment:15', '✅ order-payment:150'));
      expect(db.state.rows.every((r) => r.bot === 'staff')).toBe(true);

      // 15-buyurtmaning tuzatishi yetib bordi: faqat 15 niki bekor bo'ladi
      reply = OK;
      middle.paymentStatus = 'pending';
      expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(3);
      expect(waiting()).toEqual(each('✅ order-payment:1', '✅ order-payment:150'));

      // 1-buyurtmaning tuzatishi navbatga tushdi: 150 nikiga tegilmaydi
      reply = offline;
      vi.setSystemTime(at(MIN));
      first.paymentStatus = 'pending';
      expect(await notifyStaffPaymentReverted(1, 'Kassa')).toBe(0);
      expect(waiting()).toEqual(each('↩️ order-payment:1', '✅ order-payment:150'));
      // To'lov mavzusi navbatda hech qachon "shu bilan boshlanadigan" deb izlanmaydi: har bir so'rov — aniq mavzu, har bir xodimga bittadan
      expect(db.table.updateMany.mock.calls.map(([a]) => a.where?.topic)).toEqual([1, 15, 150, 15, 1].flatMap((id) => Array<string>(3).fill(`order-payment:${id}`)));

      reply = OK;
      sent.length = 0;
      expect(await flushOutbox(at(6 * MIN))).toEqual({ sent: 6, retry: 0, failed: 0 });
      expect(sent.map((m) => `${m.chat} ${mark(m.text)} #${/Buyurtma #(\d+)/.exec(m.text)?.[1]}`).sort()).toEqual(each('↩️ #1', '✅ #150'));
      expect(pending()).toEqual([]);
    });

    // Hodisa xabarlari (yangi buyurtma, ariza, kunlik eslatma) mavzusiz: har biri alohida voqea — biri ikkinchisining o'rnini bosmaydi,
    // to'lov kartalari esa (mavzu aniq tenglik bilan izlangani uchun) ularga tegmaydi
    it('yangi buyurtma kartasi, ariza xabari va kunlik eslatma mavzusiz: to\'lov kartalari navbatga tushib ham, to\'g\'ridan-to\'g\'ri yetib borib ham ularning o\'rnini bosmaydi; ular ham navbatdagi to\'lov kartasiga tegmaydi', async () => {
      const o = card({ status: 'processing', paymentStatus: 'pending' });
      // Kunlik eslatma uchun: 24 soatdan beri "Yangi" turgan buyurtma va muddati o'tgan hisob-faktura
      card({ id: 16, status: 'new_', createdAt: at(-2 * DAY) });
      const debtor = card({ id: 17, status: 'delivered', paymentMethod: 'bank_transfer', customerName: 'Qarzdor MChJ', createdAt: at(-10 * DAY) });
      db.state.invoices.push({ id: 1, invoiceNo: 'INV-17', status: 'issued', totalAmount: 500000, paidAmount: 0, dueDate: at(-3 * DAY), order: debtor });
      // Moliya eslatmasi (⏰) faqat moliya ruxsati bor xodimlarga; qolgani "orders" / "leads" bo'limidagi hammaga
      const EVENTS: Record<string, string[]> = { 900: ['🛒', '🛒', '📩', '⏳'], 901: ['🛒', '🛒', '📩', '⏰', '⏳'], 902: ['🛒', '🛒', '📩', '⏰', '⏳'] };
      /** Hodisa xabarlari hammasi kutyapti; `payments` — ulardan keyin yozilgan to'lov kartalari */
      const events = (...payments: string[]) => Object.fromEntries(CHATS.map((chat) => [chat, [...EVENTS[chat].map((m) => `${m} - kutyapti`), ...payments]]));

      reply = offline;
      expect(await notifyStaffNewOrder(15)).toBe(0);
      expect(await notifyStaffNewOrder(15)).toBe(0); // takroriy karta ham eskisining o'rnini bosmaydi
      expect(await notifyStaffLead(['📩 Yangi ariza', 'Ali <Valiyev>'])).toBe(0);
      expect(await sendDailyDigest(NOW)).toEqual({ finance: 0, orders: 0 });
      expect(queues()).toEqual(events());
      expect(db.state.rows.every((r) => r.bot === 'staff' && r.topic === null)).toBe(true);
      expect(db.state.rows.find((r) => r.html.startsWith('⏰'))?.html).toContain('<b>INV-17</b>');
      expect(db.state.rows.find((r) => r.html.startsWith('⏳'))?.html).toContain('<b>#16</b>');
      // Mavzusiz xabar navbatda hech narsani izlamaydi
      expect(db.table.updateMany).not.toHaveBeenCalled();

      // To'lov kartalari: navbatga tushadi, o'z mavzusidagisining o'rnini bosadi, oxirgisi to'g'ridan-to'g'ri yetib boradi
      o.paymentStatus = 'paid';
      expect(await notifyStaffPaid(15, 'Hisob-faktura')).toBe(0);
      o.paymentStatus = 'pending';
      expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(0);
      expect(queues()).toEqual(events(`✅ ${PAYMENT} ${SUPERSEDED}`, `↩️ ${PAYMENT} kutyapti`));
      reply = OK;
      o.paymentStatus = 'paid';
      expect(await notifyStaffPaid(15, 'Hisob-faktura')).toBe(3);
      expect(queues()).toEqual(events(`✅ ${PAYMENT} ${SUPERSEDED}`, `↩️ ${PAYMENT} ${SUPERSEDED}`));
      // Navbatdagi har bir so'rov aniq to'lov mavzusi bilan: mavzusiz (NULL) qatorlar unga hech qachon mos kelmaydi
      expect(db.table.updateMany.mock.calls.map(([a]) => a.where?.topic)).toEqual(Array<string>(9).fill(PAYMENT));

      // Aksincha: to'lov kartasi navbatda turganda yetib borgan hodisa xabarlari unga tegmaydi
      reply = offline;
      o.paymentStatus = 'pending';
      expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(0);
      reply = OK;
      db.table.updateMany.mockClear();
      expect(await notifyStaffNewOrder(15)).toBe(3);
      expect(await notifyStaffLead(['📩 Yangi ariza'])).toBe(3);
      expect(await sendDailyDigest(NOW)).toEqual({ finance: 2, orders: 3 });
      expect(db.table.updateMany).not.toHaveBeenCalled();
      expect(queues()).toEqual(events(`✅ ${PAYMENT} ${SUPERSEDED}`, `↩️ ${PAYMENT} ${SUPERSEDED}`, `↩️ ${PAYMENT} kutyapti`));

      // Navbat yuborilganda: har bir hodisa xabari bir martadan, to'lov kartalaridan esa faqat oxirgisi
      sent.length = 0;
      expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 17, retry: 0, failed: 0 });
      expect(Object.fromEntries(CHATS.map((chat) => [chat, sent.filter((m) => m.chat === chat).map((m) => mark(m.text))]))).toEqual(Object.fromEntries(CHATS.map((chat) => [chat, [...EVENTS[chat], '↩️']])));
      expect(sent.every((m) => m.token === STAFF)).toBe(true);
      expect(pending()).toEqual([]);
      expect(await flushOutbox(at(80 * MIN))).toEqual(NONE);
    });

    // Mavzu bitta bo'lgani uchun notify.ts dagi "oxirgi chiqarilgan xabar" hisobi ham ikkala kartaga umumiy (har bir xodim uchun alohida):
    // osilib turgan "qabul qilindi" tuzatishdan keyin navbatga tushsa, keyingi tick uni tuzatishdan KEYIN yetkazardi
    it('"To\'lov qabul qilindi" kartasi Telegram javobini kutib turgan paytda tuzatish kartasi chiqsa: kechikib yiqilgan karta navbatga tushmaydi — xodim chatidagi yagona karta tuzatish bo\'lib qoladi', async () => {
      const o = card({ status: 'processing', paymentStatus: 'paid' });
      const hold = gate();
      reply = async (m) => {
        if (!m.text.startsWith('✅')) return deliver(m);
        await hold.wait;
        return offline();
      };
      const slow = await startAccepted(); // uchala xodimning kartasi ham javob kutmoqda (Telegram osilib turibdi)
      expect([...issued().keys()].sort()).toEqual(CHATS.map((chat) => `staff:${chat}:${PAYMENT}`));
      o.paymentStatus = 'pending';
      expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(3);
      // Tuzatish tugadi — hisobda u qolmadi; "qabul qilindi" esa hamon yo'lda
      expect([...issued().keys()]).toEqual([]);
      hold.open();
      expect(await slow.done).toBe(0);

      expect(db.state.rows).toEqual([]);
      expect(db.table.create).not.toHaveBeenCalled();
      // Yiqilgani baribir logga yozilgan — bot tokenisiz
      expect(errors).toHaveBeenCalledTimes(3);
      expect(errors.mock.calls.map((c) => c.join(' ')).join('\n')).not.toContain(STAFF);
      reply = deliver;
      for (const minute of [5, 20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN)), String(minute)).toEqual(NONE);
      expect(got.sort()).toEqual(['900 ↩️', '901 ↩️', '902 ↩️']);
    });

    it('tuzatish kartasi ham bir xodimga o\'tmagan bo\'lsa: navbatda faqat o\'sha tuzatish turadi — kechikib yiqilgan "To\'lov qabul qilindi" kartasi uning o\'rnini bosmaydi va o\'zi ham navbatga tushmaydi', async () => {
      const o = card({ status: 'processing', paymentStatus: 'paid' });
      const hold = gate();
      reply = async (m) => {
        if (m.text.startsWith('✅')) {
          await hold.wait;
          return offline();
        }
        return m.chat === '902' ? offline() : deliver(m);
      };
      const slow = await startAccepted();
      o.paymentStatus = 'pending';
      expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(2);
      expect(queues()).toEqual({ 900: [], 901: [], 902: [`↩️ ${PAYMENT} kutyapti`] });
      hold.open();
      expect(await slow.done).toBe(0);
      // Eskirgan karta navbatga qo'yilmadi — qo'yilsa o'zidan yangi tuzatishni bekor qilib, uning o'rniga o'zi yetib borardi
      expect(queues()).toEqual({ 900: [], 901: [], 902: [`↩️ ${PAYMENT} kutyapti`] });
      expect(db.table.create).toHaveBeenCalledTimes(1);

      reply = deliver;
      sent.length = 0;
      expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 1, retry: 0, failed: 0 });
      for (const minute of [20, 80, 24 * 60]) expect(await flushOutbox(at(minute * MIN)), String(minute)).toEqual(NONE);
      expect(got.sort()).toEqual(['900 ↩️', '901 ↩️', '902 ↩️']);
      expect(cardOf('902')).toEqual(UNPAID[902]);
    });

    // Aksi: kechikkan karta oxiri YETIB bordi — u ham o'zidan keyin chiqqan tuzatishni navbatdan bekor qilmaydi (javob kelgan tartib emas,
    // chiqarilgan tartib hal qiladi). Ikkalasi ham chatga tushadi, lekin oxirgisi — tuzatish
    it('kechikib yetib borgan "To\'lov qabul qilindi" kartasi shu orada navbatga tushgan tuzatishni bekor qilmaydi: tuzatish keyin yetib boradi va har bir xodim chatida oxirgi karta bo\'lib qoladi', async () => {
      const o = card({ status: 'processing', paymentStatus: 'paid' });
      const hold = gate();
      reply = async (m) => {
        if (!m.text.startsWith('✅')) return offline();
        await hold.wait;
        return deliver(m);
      };
      const slow = await startAccepted();
      o.paymentStatus = 'pending';
      expect(await notifyStaffPaymentReverted(15, 'Kassa')).toBe(0); // tuzatish o'tmadi — navbatga tushdi
      hold.open();
      expect(await slow.done).toBe(3);
      expect(queues()).toEqual(everyone(`↩️ ${PAYMENT} kutyapti`));
      // Kechikkan karta navbatga tegmadi: yagona so'rovlar — tuzatishlarning o'zidan oldingilarni bekor qilishi
      expect(db.table.updateMany).toHaveBeenCalledTimes(3);

      reply = deliver;
      expect(await flushOutbox(at(5 * MIN))).toEqual({ sent: 3, retry: 0, failed: 0 });
      for (const chat of CHATS) expect(got.filter((g) => g.startsWith(chat)), chat).toEqual([`${chat} ✅`, `${chat} ↩️`]);
      for (const [chat, buttons] of Object.entries(UNPAID)) expect(datas(sent.filter((m) => m.chat === chat).at(-1)?.inline), chat).toEqual(buttons);
      expect(pending()).toEqual([]);
    });
  });
});

describe('outboxStats: navbat holati', () => {
  it('kutayotganlar, bir soatdan beri kutayotganlar va oxirgi 24 soatda "yuborilmadi" bo\'lganlar', async () => {
    expect(await outboxStats(NOW)).toEqual({ pending: 0, stuck: 0, failed24h: 0 });

    seed({ createdAt: at(-59 * MIN) }); // kutyapti, hali bir soat bo'lmagan
    seed({ createdAt: at(-61 * MIN) }); // tiqilib qolgan
    seed({ createdAt: at(-10 * HOUR), nextAt: at(2 * HOUR), attempts: 5 }); // navbatdagi urinishini kutyapti — baribir bir soatdan oshgan
    seed({ createdAt: at(-10 * HOUR), sentAt: at(-9 * HOUR) }); // yetib borgan
    seed({ createdAt: at(-30 * HOUR), failedAt: at(-23 * HOUR) }); // oxirgi sutkada yuborilmadi
    seed({ createdAt: at(-50 * HOUR), failedAt: at(-25 * HOUR) }); // undan oldin
    expect(await outboxStats(NOW)).toEqual({ pending: 3, stuck: 2, failed24h: 1 });

    // Ikki soat o'tib: yangi xabar ham "tiqilgan"ga o'tadi, kechagi xato 24 soatdan chiqadi
    expect(await outboxStats(at(2 * HOUR))).toEqual({ pending: 3, stuck: 3, failed24h: 0 });
  });

  it('o\'rnini yangisi bosgan (eskirgan) xabarlar "yuborilmadi" hisobiga kirmaydi; tokeni qaytmagan bot xabarlari kiradi', async () => {
    seed({ topic: STATUS, createdAt: at(-5 * HOUR), failedAt: at(-HOUR), lastError: SUPERSEDED });
    seed({ topic: STATUS, createdAt: at(-5 * HOUR), failedAt: at(-2 * HOUR), lastError: SUPERSEDED, attempts: 4 });
    expect(await outboxStats(NOW)).toEqual({ pending: 0, stuck: 0, failed24h: 0 });

    seed({ bot: 'staff', createdAt: at(-3 * DAY), failedAt: at(-HOUR), lastError: NO_TOKEN });
    seed({ topic: STATUS, createdAt: at(-5 * HOUR), failedAt: at(-HOUR), lastError: 'Telegram sendMessage: 403 Forbidden: bot was blocked by the user' }); // mavzuli, lekin haqiqiy xato
    seed({ topic: STATUS, createdAt: at(-5 * HOUR) }); // mavzuli va kutyapti
    expect(await outboxStats(NOW)).toEqual({ pending: 1, stuck: 1, failed24h: 2 });
  });

  // SQL'da NOT (lastError = 'eskirgan') xatosi yozilmagan (NULL) qatorni ham tashlab yuboradi: "eskirgan emas" sharti NULL ni alohida olishi kerak
  it('xato matni yozilmagan (NULL) "yuborilmadi" xabar ham sanaladi — faqat "eskirgan" belgisi borlari chiqarib tashlanadi', async () => {
    seed({ failedAt: at(-HOUR), attempts: 6, lastError: null });
    seed({ topic: STATUS, failedAt: at(-HOUR), lastError: null });
    seed({ topic: STATUS, failedAt: at(-HOUR), lastError: SUPERSEDED });
    seed({ failedAt: at(-HOUR), lastError: `${SUPERSEDED} emas` }); // belgiga o'xshash, lekin boshqa matn
    seed({ failedAt: at(-25 * HOUR), lastError: null }); // sutkadan oldin
    seed({ sentAt: at(-HOUR), lastError: null }); // yetib borgan: xatosi yo'q, "yuborilmadi" ham emas
    expect(await outboxStats(NOW)).toEqual({ pending: 0, stuck: 0, failed24h: 3 });
  });
});
