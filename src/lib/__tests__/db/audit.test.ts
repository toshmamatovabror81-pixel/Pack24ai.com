import type { CorporateInvoice, Order, Prisma, User } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditCheck } from '@/lib/ai/audit';
import { clearOutbox, DB_TESTS, fixture, outbox, prisma, type Fixture } from './helpers';

/**
 * Kunlik tekshiruvning aniq qoidalari (collectChecks) haqiqiy bazada: har bir qoida kerakli qatordagina ishlashi tekshiriladi.
 * Qoidalar butun bazani sanaydi, bazada esa parallel ishlayotgan boshqa test fayllarining qatorlari ham bor. Sonlar aniq
 * chiqishi uchun ikki narsa qilingan:
 *  1) "Hozir" 1960-yilga qo'yiladi: boshqa hamma qator bu sanadan keyin yaratilgan, shuning uchun "…dan beri" shartlariga faqat
 *     shu faylning qatorlari tushadi (cron.test.ts dagi 1970-yil usuli). Bitta istisno — "oxirgi 24 soatda o'tmagan to'lovlar":
 *     u to'lov tarixidagi YANGI yozuvlarni sanaydi, shuning uchun 2090-yildagi "hozir" bilan tekshiriladi.
 *  2) Fayl bitta ochiq tranzaksiya ichida ishlaydi va oxirida ROLLBACK qilinadi: 1960-yilgi qatorlar boshqa fayllarga ko'rinmaydi
 *     (aks holda cron.test.ts dagi "eng eski yangi buyurtmalar" sanog'ini buzardi), test uzilib qolsa ham bazada hech narsa qolmaydi.
 * Baza soxtalashtirilmaydi: `prisma` haqiqiy, faqat tranzaksiya ochiq paytida so'rovlar o'sha tranzaksiya ulanishidan o'tadi.
 * Ikki jadval butun bazaga bitta, shuning uchun alohida ehtiyot qilinadi:
 *  - Xabarlar navbati (BotOutbox): "yetkazilmagan / kutib qolgan xabarlar" qoidalari uni butunlay sanaydi, boshqa fayllar esa unga
 *    parallel yozadi. Bu faylda navbatning faqat shu fayl testlari qo'ygan yozuvlari ko'rinadi — `create` yozuv raqamini eslab qoladi,
 *    qolgan har bir so'rov shartiga "id shulardan biri" qo'shiladi (db/cron.test.ts dagi kabi); so'rovning o'zi haqiqiy.
 *  - Server holati (SiteSetting "ops"): boshida tranzaksiya ichida o'chiriladi (ishlab chiquvchi bazasida qolgan signal sanoqlarni
 *    buzmasin), testlar o'z holatini saveOps bilan yozadi — oxirida hammasi ROLLBACK bilan avvalgi holiga qaytadi.
 */
const h = vi.hoisted(() => ({
  tx: null as object | null,
  queueIds: [] as number[],
  settings: { companyName: 'Pack24', phone: '998880557888', lowStockThreshold: 10, legalName: 'Pack24 MChJ', inn: '301234567', bankDetails: 'h/r 2020 8000 0000 0000 0001' },
  http: vi.fn<(url: string, init: RequestInit) => Promise<Response>>(),
}));

vi.mock('server-only', () => ({}));
// Anthropic SDK haqiqiy, lekin fetch'i shu fayldagi soxta "API"ga ulangan (ai-client.test.ts dagi kabi): api.anthropic.com ga hech narsa ketmaydi
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const real = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  class Offline extends real.default {
    constructor(options: ConstructorParameters<typeof real.default>[0] = {}) {
      super({ ...options, fetch: (url, init) => h.http(String(url), init ?? {}) });
    }
  }
  return { ...real, default: Offline };
});
vi.mock('@/lib/db', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/db')>();
  const filtered = ['count', 'findMany', 'findFirst', 'updateMany', 'deleteMany'];
  /** BotOutbox so'rovlari: faqat shu fayl qo'ygan yozuvlarga tegadi (fayl boshidagi izohga qarang) */
  const queue = (table: object) => new Proxy(table, {
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
      if (!filtered.includes(prop)) return () => { throw new Error(`test: botOutbox.${prop} bu faylda kutilmagan (navbatni o'z yozuvlari bilan cheklab bo'lmaydi)`); };
      return (args: { where?: object } = {}) => (value as (a: object) => unknown).call(target, { ...args, where: { AND: [args.where ?? {}, { id: { in: h.queueIds } }] } });
    },
  });
  const routed = new Proxy(real.prisma, {
    get(target, prop) {
      const source = (h.tx ?? target) as Record<PropertyKey, unknown>;
      const value = source[prop];
      if (prop === 'botOutbox') return queue(value as object);
      return typeof value === 'function' ? value.bind(source) : value;
    },
  });
  return { prisma: routed };
});
vi.mock('@/lib/telegram/notify', async () => (await import('./helpers')).notifyMock());
vi.mock('@/lib/settings', () => ({ getSettings: async () => h.settings }));

const { collectChecks, dailyAudit, reportChecks, runAudit } = await import('@/lib/ai/audit');
const { formatDate, formatPrice } = await import('@/lib/format');
const { overdueCutoff } = await import('@/lib/invoiceStatus');
const { alertChats, saveOps } = await import('@/lib/ops');

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date('1960-03-10T05:00:00Z'); // Toshkent vaqti (UTC+5) bilan 10.03.1960, 10:00
const TODAY = new Date('1960-03-09T19:00:00Z'); // shu kunning boshi (Toshkent) — hisob-faktura muddati shu chegaradan sanaladi
const FUTURE = new Date('2090-03-10T05:00:00Z');
const ago = (ms: number, from = NOW) => new Date(from.getTime() - ms);
const utcDay = (day: string) => new Date(`${day}T00:00:00Z`); // admin paneldagi <input type="date"> aynan shunday saqlaydi
/** Soxta kalit: gitleaks ruxsat bergan ko'rinishda (ci-dummy-…-secret), hech qayerda ishlamaydi */
const KEY = 'sk-ant-ci-dummy-anthropic-secret';
const AI_SUMMARY = { headline: 'Bugun 4 ta shoshilinch ish bor', priorities: [{ title: "To'langan buyurtmalarni qabul qiling", why: "Mijoz pulni to'lab bo'lgan", action: '"Buyurtmalar" bo\'limida Yangi holatdagilarni oching' }], note: '' };
/** Soxta "API" har so'rovga shu xulosani qaytaradi (sarf: 900 kirish, 120 chiqish tokeni) */
const aiAnswers = () => h.http.mockImplementation(async () => new Response(
  JSON.stringify({ id: 'msg_01', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(AI_SUMMARY) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 900, output_tokens: 120 } }),
  { status: 200, headers: { 'content-type': 'application/json' } },
));

/** Butun fayl uchun bitta tranzaksiya: `rollback()` chaqirilguncha ochiq turadi, keyin bekor qilinadi */
function openTransaction() {
  let finish = () => {};
  const finished = new Promise<void>((resolve) => { finish = resolve; });
  const ROLLBACK = new Error('test tugadi: ROLLBACK');
  let closed: Promise<void> = Promise.resolve();
  const ready = new Promise<void>((started, failed) => {
    closed = prisma.$transaction(async (tx) => {
      h.tx = tx;
      started();
      await finished;
      throw ROLLBACK;
    }, { maxWait: 20_000, timeout: 120_000 }).then(() => undefined, (e: unknown) => {
      h.tx = null;
      if (e !== ROLLBACK) failed(e);
    });
  });
  return { ready, rollback: async () => { finish(); await closed; } };
}

describe.skipIf(!DB_TESTS)('kunlik tekshiruv: aniq qoidalar (haqiqiy baza)', { timeout: 30_000 }, () => {
  let fx: Fixture;
  let transaction: ReturnType<typeof openTransaction> | undefined;
  let manager: User;
  let worker: User;
  let muted: User;
  const orders: Record<string, Order> = {};
  const invoices: Record<string, CorporateInvoice> = {};
  const workNo = (n: number) => `T${fx.tag}-WO-${n}`;
  const productName = (label: string) => `000 ${fx.tag} ${label}`; // "000": ro'yxat nom bo'yicha tartiblanadi — boshqa fayllarning mahsulotlaridan oldin turadi
  // Tekshiruv natijasiga ham, AI'ga ham chiqmasligi kerak bo'lgan mijoz ma'lumotlari
  const PII = { name: 'Zarnigor Maxfiyeva', company: 'Sirli Savdo MChJ', address: 'Yashirin ko\'cha 77-uy', phone: '', text: 'Maxfiy izoh matni' };

  const order = async (name: string, data: Partial<Prisma.OrderUncheckedCreateInput>) => {
    // Standart: 5 kun oldin yaratilgan, bir kun oldin qabul qilingan "Tayyorlanmoqda" — hech bir qoidaga tushmaydi
    orders[name] = await fx.order({ status: 'processing', createdAt: ago(5 * DAY), confirmedAt: ago(DAY), customerName: PII.name, contactPhone: PII.phone, shippingAddress: PII.address, companyName: PII.company, comment: PII.text, ...data });
    return orders[name];
  };
  /**
   * Buyurtma tarixiga yozuv (OrderEvent): holat yoki to'lov o'zgargan payt — orderFlow.ts yozadigan ko'rinishda.
   * Ijrochi o'rnida mijoz ismi: tarixdagi nom ham tekshiruv natijasiga chiqmasligi kerak.
   */
  const event = (name: string, kind: 'status' | 'payment', toValue: string, createdAt: Date) =>
    prisma.orderEvent.create({ data: { orderId: orders[name].id, kind, toValue, actor: PII.name, via: 'admin', createdAt } });
  const invoice = async (name: string, data: Omit<Parameters<Fixture['invoice']>[0], 'orderId'>, owner: Partial<Prisma.OrderUncheckedCreateInput> = {}) => {
    const o = await order(`inv:${name}`, { paymentMethod: 'bank_transfer', ...owner });
    invoices[name] = await fx.invoice({ orderId: o.id, ...data });
    return invoices[name];
  };
  const orderItem = (name: string) => `#${orders[name].id} · ${formatDate(orders[name].createdAt, 'uz')} · ${formatPrice(orders[name].totalAmount, "so'm")}`;
  const invoiceItem = (name: string, left: number) => `${invoices[name].invoiceNo} · qoldiq ${formatPrice(left, "so'm")} · muddat ${formatDate(invoices[name].dueDate, 'uz')}`;
  const found = async (key: string, now = NOW): Promise<AuditCheck | undefined> => (await collectChecks(now)).find((c) => c.key === key);

  beforeAll(async () => {
    transaction = openTransaction();
    await transaction.ready;
    fx = await fixture(0);
    PII.phone = fx.phone();
    // Toza server holati: bazada qolgan kuzatuv signali (bo'lsa) shu tranzaksiya ichida ko'rinmaydi
    await prisma.siteSetting.deleteMany({ where: { key: 'ops' } });

    manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
    worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
    muted = await fx.user({ role: 'admin', telegramId: fx.tg(), telegramNotify: false });

    // ── "Yangi" turgan buyurtmalar: 24 soat (qabul qilinmagan) va 2 soat (to'lovi kelgan) chegaralari
    await order('staleOld', { status: 'new_', createdAt: ago(25 * HOUR), confirmedAt: null });
    await order('staleEdge', { status: 'new_', createdAt: ago(24 * HOUR), confirmedAt: null }); // aynan 24 soat — hali emas
    await order('fresh', { status: 'new_', createdAt: ago(23 * HOUR), confirmedAt: null });
    await order('staleDeleted', { status: 'new_', createdAt: ago(3 * DAY), confirmedAt: null, deletedAt: ago(DAY) });
    await order('paidOld', { status: 'new_', paymentStatus: 'paid', createdAt: ago(2 * DAY), confirmedAt: null, totalAmount: 750000 }); // ikkala ro'yxatda ham
    await order('paidWaiting', { status: 'new_', paymentStatus: 'paid', createdAt: ago(3 * HOUR), confirmedAt: null });
    await order('paidEdge', { status: 'new_', paymentStatus: 'paid', createdAt: ago(2 * HOUR), confirmedAt: null }); // aynan 2 soat — hali emas
    await order('unpaidWaiting', { status: 'new_', createdAt: ago(3 * HOUR), confirmedAt: null });
    await order('paidAccepted', { status: 'processing', paymentStatus: 'paid', createdAt: ago(3 * HOUR), confirmedAt: ago(HOUR) });
    await order('paidDeleted', { status: 'new_', paymentStatus: 'paid', createdAt: ago(3 * HOUR), confirmedAt: null, deletedAt: ago(HOUR) });

    // ── Jarayonda qotgan buyurtmalar: 5 kun. Holatga qachon o'tgani tarixdan (OrderEvent) olinadi; tarixi yo'q eski buyurtmalarda —
    //    confirmedAt / shippedAt dan. Dastlabki uchtasi tarixsiz (eski) buyurtmalar
    await order('procSlow', { status: 'processing', createdAt: ago(9 * DAY), confirmedAt: ago(5 * DAY + HOUR) });
    await order('procEdge', { status: 'processing', createdAt: ago(9 * DAY), confirmedAt: ago(5 * DAY) });
    await order('procDeleted', { status: 'processing', createdAt: ago(9 * DAY), confirmedAt: ago(8 * DAY), deletedAt: ago(DAY) });
    // Onlayn to'langan: confirmedAt to'lov paytida (6 kun oldin) qo'yilgan, buyurtma esa atigi 1 soat oldin qabul qilingan
    await order('procPaidEarly', { status: 'processing', paymentStatus: 'paid', paymentMethod: 'click', createdAt: ago(9 * DAY), confirmedAt: ago(6 * DAY) });
    await event('procPaidEarly', 'payment', 'paid', ago(6 * DAY));
    await event('procPaidEarly', 'status', 'processing', ago(HOUR));
    // Tarix bo'yicha 6 kundan beri shu holatda (confirmedAt bo'sh — faqat tarixga qarab topiladi)
    await order('procOldEvent', { status: 'processing', createdAt: ago(9 * DAY), confirmedAt: null });
    await event('procOldEvent', 'status', 'processing', ago(6 * DAY));
    // Aynan 5 kun oldin qabul qilingan — hali emas
    await order('procEventEdge', { status: 'processing', createdAt: ago(9 * DAY), confirmedAt: ago(5 * DAY) });
    await event('procEventEdge', 'status', 'processing', ago(5 * DAY));
    // Orqaga qaytarilib, 1 soat oldin qayta qabul qilingan: confirmedAt birinchi qabuldan (8 kun oldin) qolgan
    await order('procReaccepted', { status: 'processing', createdAt: ago(9 * DAY), confirmedAt: ago(8 * DAY) });
    await event('procReaccepted', 'status', 'processing', ago(8 * DAY));
    await event('procReaccepted', 'status', 'new_', ago(2 * DAY));
    await event('procReaccepted', 'status', 'processing', ago(HOUR));
    // 7 kundan beri shu holatda, 1 soat oldin faqat to'lovi kelgan (Click confirmedAt ni to'lov paytiga qo'yadi): to'lov yozuvi —
    // qiymati "processing" bo'lsa ham — holat muddatini yangilamaydi
    await order('procPaidLater', { status: 'processing', paymentStatus: 'paid', paymentMethod: 'click', createdAt: ago(9 * DAY), confirmedAt: ago(HOUR) });
    await event('procPaidLater', 'status', 'processing', ago(7 * DAY));
    await event('procPaidLater', 'payment', 'processing', ago(2 * HOUR));
    await event('procPaidLater', 'payment', 'paid', ago(HOUR));

    await order('shipSlow', { status: 'shipping', createdAt: ago(9 * DAY), shippedAt: ago(6 * DAY) });
    await order('shipRecent', { status: 'shipping', createdAt: ago(9 * DAY), shippedAt: ago(2 * DAY) });
    await order('shipDeleted', { status: 'shipping', createdAt: ago(9 * DAY), shippedAt: ago(8 * DAY), deletedAt: ago(DAY) });
    // Qaytib kelib, 1 soat oldin qayta jo'natilgan: shippedAt birinchi jo'natishdan (8 kun oldin) qolgan
    await order('shipAgain', { status: 'shipping', createdAt: ago(9 * DAY), shippedAt: ago(8 * DAY) });
    await event('shipAgain', 'status', 'shipping', ago(8 * DAY));
    await event('shipAgain', 'status', 'processing', ago(3 * DAY));
    await event('shipAgain', 'status', 'shipping', ago(HOUR));
    // Tarix bo'yicha 6 kundan beri yo'lda (shippedAt bo'sh)
    await order('shipOldEvent', { status: 'shipping', createdAt: ago(9 * DAY), shippedAt: null });
    await event('shipOldEvent', 'status', 'shipping', ago(6 * DAY));
    // 7 kun oldin qabul qilingan, yo'lga esa kecha chiqqan: boshqa holatning eski yozuvi hisobga olinmaydi
    await order('shipFresh', { status: 'shipping', createdAt: ago(9 * DAY), confirmedAt: ago(7 * DAY), shippedAt: ago(DAY) });
    await event('shipFresh', 'status', 'processing', ago(7 * DAY));
    await event('shipFresh', 'status', 'shipping', ago(DAY));

    // ── Yetkazilgan, lekin to'lanmagan: 3 kun
    await order('delUnpaid', { status: 'delivered', createdAt: ago(9 * DAY), deliveredAt: ago(4 * DAY) });
    await order('delFailed', { status: 'delivered', paymentStatus: 'failed', createdAt: ago(9 * DAY), deliveredAt: ago(4 * DAY) });
    await order('delPaid', { status: 'delivered', paymentStatus: 'paid', createdAt: ago(9 * DAY), deliveredAt: ago(4 * DAY) });
    await order('delRefunded', { status: 'delivered', paymentStatus: 'refunded', createdAt: ago(9 * DAY), deliveredAt: ago(4 * DAY) });
    await order('delEdge', { status: 'delivered', createdAt: ago(9 * DAY), deliveredAt: ago(3 * DAY) });
    await order('delDeleted', { status: 'delivered', createdAt: ago(9 * DAY), deliveredAt: ago(8 * DAY), deletedAt: ago(DAY) });

    // ── Hisob-fakturalar. Muddat kuni to'liq hisobga kiradi: kechagi kunning oxirgi lahzasi — o'tgan, bugunning boshi — hali yo'q
    await invoice('legacy', { total: 300000, status: 'overdue', dueDate: ago(40 * DAY) }); // eski bazadan: holati bazada "overdue"
    await invoice('old', { total: 500000, dueDate: ago(30 * DAY) });
    await invoice('yesterday', { total: 1200000, paid: 200000, status: 'partial', dueDate: new Date(TODAY.getTime() - 1) });
    await invoice('today', { total: 100000, dueDate: TODAY });
    await invoice('in3days', { total: 100000, dueDate: new Date(TODAY.getTime() + 4 * DAY - 1) }); // 13-mart, kunning oxirgi lahzasi
    await invoice('in4days', { total: 100000, dueDate: new Date(TODAY.getTime() + 4 * DAY) });
    await invoice('paidOrder', { total: 100000, dueDate: ago(30 * DAY) }, { status: 'delivered', paymentStatus: 'paid', deliveredAt: ago(DAY) });
    await invoice('cancelledOrder', { total: 100000, dueDate: ago(30 * DAY) }, { status: 'cancelled' });
    await invoice('closed', { total: 100000, paid: 100000, status: 'paid', dueDate: ago(30 * DAY) });
    await invoice('cancelled', { total: 100000, status: 'cancelled', dueDate: new Date(TODAY.getTime() + DAY) });
    await invoice('soonPaidOrder', { total: 100000, dueDate: new Date(TODAY.getTime() + DAY) }, { status: 'delivered', paymentStatus: 'paid', deliveredAt: ago(DAY) });

    // ── Yetkazilgan, to'lanmagan, lekin hisob-fakturasi bor buyurtmalar (4 kun oldin yetkazilgan): qarz hisob-faktura orqali kuzatiladi
    const delivered = { status: 'delivered', createdAt: ago(9 * DAY), deliveredAt: ago(4 * DAY) } as const;
    await invoice('delOpen', { total: 600000, dueDate: new Date(TODAY.getTime() + 5 * DAY) }, delivered); // muddati 15-mart — hali kelmagan
    await invoice('delPartial', { total: 600000, paid: 100000, status: 'partial', dueDate: new Date(TODAY.getTime() + 6 * DAY) }, delivered); // 16-mart
    await invoice('delOverdue', { total: 400000, dueDate: ago(20 * DAY) }, delivered); // muddati o'tgan — "muddati o'tgan hisob-fakturalar"da turadi
    await invoice('delVoid', { total: 100000, status: 'cancelled', dueDate: ago(20 * DAY) }, delivered); // hisob-faktura bekor qilingan — ochiq hujjat yo'q

    // ── Ishlab chiqarish topshiriqlari (muddat — sana, UTC yarim tuni ko'rinishida saqlanadi)
    const work = (n: number, data: Pick<Prisma.WorkOrderUncheckedCreateInput, 'status' | 'deadline'> & { progress?: number }) =>
      prisma.workOrder.create({ data: { orderNo: workNo(n), clientName: PII.name, customerPhone: PII.phone, productName: 'Gofra quti 30x20x15', quantity: 500, notes: PII.text, ...data } });
    await work(1, { status: 'in_progress', deadline: utcDay('1960-03-08'), progress: 40 });
    await work(2, { status: 'paused', deadline: utcDay('1960-03-01'), progress: 10 });
    await work(3, { status: 'planned', deadline: utcDay('1960-03-09') }); // kecha
    await work(4, { status: 'in_progress', deadline: utcDay('1960-03-11'), progress: 70 }); // ertaga
    await work(5, { status: 'completed', deadline: utcDay('1960-03-01'), progress: 100 });
    await work(6, { status: 'cancelled', deadline: utcDay('1960-03-01') });
    await work(7, { status: 'in_progress', deadline: utcDay('1960-03-10'), progress: 55 }); // bugun: UTC yarim tuni "hozir"dan (10:00) oldin, lekin muddat kuni hali tugamagan
    await work(8, { status: 'planned', deadline: new Date('1960-03-10T12:00:00Z'), progress: 5 }); // bugun, soati bilan saqlangan (boshqa manbadan kelgan yozuv)

    // ── Arizalar (24 soat) va sharhlar (3 kun)
    const lead = (data: Pick<Prisma.LeadCreateInput, 'status' | 'createdAt'>) => prisma.lead.create({ data: { type: 'callback', name: PII.name, phone: PII.phone, company: PII.company, message: PII.text, ...data } });
    await lead({ status: 'new_', createdAt: ago(2 * DAY) });
    await lead({ status: 'new_', createdAt: ago(24 * HOUR) });
    await lead({ status: 'in_progress', createdAt: ago(5 * DAY) });
    const review = (data: Pick<Prisma.ReviewCreateInput, 'status' | 'createdAt'>) => prisma.review.create({ data: { authorName: PII.name, company: PII.company, text: PII.text, ...data } });
    await review({ status: 'pending', createdAt: ago(3 * DAY + HOUR) });
    await review({ status: 'pending', createdAt: ago(3 * DAY) });
    await review({ status: 'approved', createdAt: ago(10 * DAY) });

    // ── Ombor: chegara 10 dona (sozlamalardan)
    await fx.stock((await fx.product({ name: productName('kam') })).id, 3);
    await fx.stock((await fx.product({ name: productName('chegarada') })).id, 10);
    await fx.product({ name: productName('qoldiqsiz') }); // omborda yozuvi yo'q — 0 dona
    await fx.stock((await fx.product({ name: productName('yetarli') })).id, 11);
    await fx.stock((await fx.product({ name: productName('arxiv'), status: 'archived' })).id, 0);

    // ── O'tmagan onlayn to'lovlar: to'lov tarixida 2090-yildagi "hozir"dan oldingi 24 soat ichida "failed" yozuvi bor buyurtmalar.
    //    Hammasining updatedAt i yangi (1 soat oldin): buyurtmaga tegilgani emas, to'lov qachon o'tmagani hisobga olinadi
    const failed = (name: string, data: Partial<Prisma.OrderUncheckedCreateInput> = {}) =>
      order(name, { paymentStatus: 'failed', paymentMethod: 'click', createdAt: ago(5 * DAY, FUTURE), confirmedAt: null, updatedAt: ago(HOUR, FUTURE), ...data });
    await failed('failRecent', { totalAmount: 480000 });
    await event('failRecent', 'payment', 'failed', ago(HOUR, FUTURE));
    await failed('failEdge');
    await event('failEdge', 'payment', 'failed', ago(24 * HOUR, FUTURE)); // aynan 24 soat oldin — endi kirmaydi
    // Uch kun oldin o'tmagan; bugun buyurtmaga boshqa sabab bilan tegilgan (xodim holatini o'zgartirgan) — bu yangi muvaffaqiyatsizlik emas
    await failed('failOld');
    await event('failOld', 'payment', 'failed', ago(3 * DAY, FUTURE));
    await event('failOld', 'status', 'processing', ago(HOUR, FUTURE));
    // Tarixi yo'q (eski yozuv): qachon o'tmagani noma'lum
    await failed('failNoHistory');
    // Tarixda yangi yozuvlar bor, lekin hech biri "to'lov o'tmadi" emas
    await failed('failOtherEvents');
    await event('failOtherEvents', 'payment', 'pending', ago(HOUR, FUTURE));
    await event('failOtherEvents', 'status', 'failed', ago(HOUR, FUTURE));
    // 2 soat oldin o'tmagan, lekin bekor qilingan / qoralama / o'chirilgan buyurtmalar va qayta urinishda to'langan buyurtma
    await failed('failCancelled', { status: 'cancelled' });
    await failed('failDraft', { status: 'draft' });
    await failed('failDeleted', { deletedAt: ago(HOUR, FUTURE) });
    await failed('paidRecent', { paymentStatus: 'paid' });
    for (const name of ['failCancelled', 'failDraft', 'failDeleted', 'paidRecent']) await event(name, 'payment', 'failed', ago(2 * HOUR, FUTURE));
    await event('paidRecent', 'payment', 'paid', ago(HOUR, FUTURE));
  }, 60_000);

  afterAll(async () => {
    await transaction?.rollback();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    clearOutbox();
    h.http.mockReset();
    // AI kaliti va bot tokeni yo'q holat: tekshiruv xulosasiz ishlaydi, AI'ga hech qanday so'rov yuborilmaydi
    for (const name of ['ANTHROPIC_API_KEY', 'STAFF_BOT_TOKEN', 'SUPERVISOR_BOT_TOKEN']) vi.stubEnv(name, '');
    for (const name of ['ANTHROPIC_MODEL', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_CUSTOM_HEADERS', 'AI_DAILY_LIMIT']) vi.stubEnv(name, undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('test sozlamasi: muddat chegarasi ilovaning o\'z qoidasidan olingan (overdueCutoff)', () => {
    expect(overdueCutoff(NOW)).toEqual(TODAY);
  });

  it('"Yangi" turgan buyurtmalar: 24 soatdan oshgani; aynan 24 soatlik, yangi va o\'chirilgani kirmaydi', async () => {
    const stale = await found('stale_new');
    expect(stale).toMatchObject({ severity: 'high', count: 2, link: '/admin/orders?status=new_' });
    expect(stale?.items).toEqual([orderItem('staleOld'), orderItem('paidOld')]);
    // Misol satri: raqam, yaratilgan sana (Toshkent) va summa — mijoz haqida hech narsa yo'q
    expect(stale?.items[0]).toMatch(new RegExp(`^#${orders.staleOld.id} · 09\\.03\\.1960 · 100\\s000 so'm$`));
  });

  it('to\'lovi kelgan, lekin qabul qilinmagan: 2 soatdan oshgani; to\'lanmagani, qabul qilingani va o\'chirilgani kirmaydi', async () => {
    const paid = await found('paid_not_started');
    expect(paid).toMatchObject({ severity: 'high', count: 2, link: '/admin/orders?status=new_' });
    // 2 kundan beri turgan to'langan buyurtma ikkala ro'yxatda ham bor (yuqoridagi testda ham)
    expect(paid?.items).toEqual([orderItem('paidOld'), orderItem('paidWaiting')]);
    expect(paid?.items[0]).toMatch(/ · 750\s000 so'm$/);
  });

  // confirmedAt faqat birinchi marta qo'yiladi (onlayn to'lovda — to'lov paytida, buyurtma hali "Yangi" bo'lsa ham), shippedAt ham shunday:
  // ularga qarab sanalsa, hozirgina qabul qilingan yoki qayta jo'natilgan buyurtma "5 kundan beri qotgan" bo'lib chiqardi
  it('5 kundan beri "Tayyorlanmoqda" turgan buyurtmalar: holatga o\'tgan payt tarixdan olinadi, tarixsiz eski buyurtmada — confirmedAt dan', async () => {
    // Hamma buyurtma 9 kun oldin yaratilgan — yaratilgan sana emas, shu holatga o'tgan vaqt hisobga olinadi
    const processing = await found('slow_processing');
    expect(processing).toMatchObject({ severity: 'medium', count: 3, link: '/admin/orders?status=processing' });
    // Tarixsiz, 5 kun-u 1 soat oldin tasdiqlangan; tarix bo'yicha 6 kundan beri; 7 kundan beri (1 soat oldin faqat to'lovi kelgan)
    expect(processing?.items).toEqual([orderItem('procSlow'), orderItem('procOldEvent'), orderItem('procPaidLater')]);
    const listed = processing?.items.join('\n') ?? '';
    // Kirmaydi: 6 kun oldin to'lab, 1 soat oldin qabul qilingan; orqaga qaytib, qayta qabul qilingan; aynan 5 kunlik (tarixli va tarixsiz); o'chirilgan
    for (const name of ['procPaidEarly', 'procReaccepted', 'procEventEdge', 'procEdge', 'procDeleted', 'paidAccepted']) expect(listed, name).not.toContain(`#${orders[name].id} `);
  });

  it('5 kundan beri "Yo\'lda" turgan buyurtmalar: qayta jo\'natilgani oxirgi jo\'natishdan sanaladi, tarixsiz eski buyurtma — shippedAt dan', async () => {
    const shipping = await found('slow_shipping');
    expect(shipping).toMatchObject({ severity: 'medium', count: 2, link: '/admin/orders?status=shipping' });
    expect(shipping?.items).toEqual([orderItem('shipSlow'), orderItem('shipOldEvent')]);
    const listed = shipping?.items.join('\n') ?? '';
    // Kirmaydi: 1 soat oldin qayta jo'natilgan (shippedAt 8 kunlik); kecha yo'lga chiqqan (7 kunlik "Tayyorlanmoqda" yozuvi bilan); 2 kunlik; o'chirilgan
    for (const name of ['shipAgain', 'shipFresh', 'shipRecent', 'shipDeleted']) expect(listed, name).not.toContain(`#${orders[name].id} `);
  });

  it('holat muddati tekshiruv paytiga nisbatan sanaladi: bugun "yangi" bo\'lgan yozuv 5 kundan keyin qotgan hisoblanadi', async () => {
    const slowAt = async (key: string, now: Date) => (await found(key, now))?.items ?? [];
    // 5 kun-u 2 soatdan keyin: 1 soat oldin qabul qilingan / qayta jo'natilgan buyurtmalar ham ro'yxatga tushadi
    const later = new Date(NOW.getTime() + 5 * DAY + 2 * HOUR);
    const processing = await slowAt('slow_processing', later);
    for (const name of ['procPaidEarly', 'procReaccepted', 'procEventEdge', 'procEdge']) expect(processing, name).toContain(orderItem(name));
    expect(await slowAt('slow_shipping', later)).toEqual(['shipSlow', 'shipRecent', 'shipAgain', 'shipOldEvent', 'shipFresh'].map(orderItem));
  });

  it('yetkazilgan, lekin 3 kundan beri to\'lanmagan: to\'lovi kutilayotgan va o\'tmagan; to\'langani va qaytarilgani kirmaydi', async () => {
    const unpaid = await found('delivered_unpaid');
    expect(unpaid).toMatchObject({ severity: 'high', count: 3, link: '/admin/orders?status=delivered' });
    // Uchinchisi — hisob-fakturasi bekor qilingan buyurtma: ochiq hujjati yo'q, qarz faqat shu ro'yxatda ko'rinadi
    expect(unpaid?.items).toEqual([orderItem('delUnpaid'), orderItem('delFailed'), orderItem('inv:delVoid')]);
  });

  // Hisob-faktura bo'yicha ishlaydigan mijoz to'lovni muddatigacha qiladi: muddat kelmaguncha u qarzdor emas, muddat o'tgach esa
  // "muddati o'tgan hisob-fakturalar"da turadi — bitta qarz ikki ro'yxatda takrorlanmaydi
  it('yetkazilgan, to\'lanmagan, lekin ochiq hisob-fakturasi bor buyurtma "to\'lanmagan"lar ro\'yxatiga kirmaydi; muddati o\'tsa — faqat hisob-fakturalarda', async () => {
    const checks = await collectChecks(NOW);
    const unpaid = checks.find((c) => c.key === 'delivered_unpaid')?.items.join('\n') ?? '';
    const overdue = checks.find((c) => c.key === 'overdue_invoices')?.items.join('\n') ?? '';
    for (const name of ['delOpen', 'delPartial', 'delOverdue']) expect(unpaid, name).not.toContain(`#${orders[`inv:${name}`].id} `);
    // Muddati kelmagan (berilgan yoki qisman to'langan) hisob-faktura hech qaysi ro'yxatda yo'q; muddati o'tgani — bir marta
    for (const name of ['delOpen', 'delPartial']) expect(overdue, name).not.toContain(invoices[name].invoiceNo);
    expect(overdue.split(invoices.delOverdue.invoiceNo)).toHaveLength(2);
    expect(JSON.stringify(checks).split(invoices.delOverdue.invoiceNo)).toHaveLength(2);

    // 6 kundan keyin (16-mart): delOpen muddati o'tgan — buyurtma "to'lanmagan"larga qaytmaydi, hisob-fakturasi "muddati o'tgan"larga o'tadi;
    // delPartial muddati (16-mart) hali tugamagan — u hamon hech qaysi ro'yxatda yo'q
    const later = await collectChecks(new Date(NOW.getTime() + 6 * DAY));
    // "To'lanmagan"lar: avvalgi uchtasi va endi 3 kundan oshgan delEdge — hisob-fakturali buyurtmalarning birortasi ham qo'shilmagan
    expect(later.find((c) => c.key === 'delivered_unpaid')?.items).toEqual([orderItem('delUnpaid'), orderItem('delFailed'), orderItem('delEdge'), orderItem('inv:delVoid')]);
    const overdueLater = later.find((c) => c.key === 'overdue_invoices')?.items.join('\n') ?? '';
    expect(overdueLater).toContain(invoices.delOpen.invoiceNo);
    expect(overdueLater).toContain(invoices.delOverdue.invoiceNo);
    expect(overdueLater).not.toContain(invoices.delPartial.invoiceNo);
  });

  it('muddati o\'tgan hisob-fakturalar: muddat kuni to\'liq hisobga kiradi; sarlavhada jami qoldiq', async () => {
    const overdue = await found('overdue_invoices');
    expect(overdue).toMatchObject({ severity: 'high', count: 4, link: '/admin/invoices?status=overdue' });
    // 300 000 + 500 000 + 400 000 + (1 200 000 − 200 000 to'langan)
    expect(overdue?.title).toMatch(/^Muddati o'tgan hisob-fakturalar \(jami qoldiq 2\s200\s000 so'm\)$/);
    // Eng eski muddat tepada; qisman to'langanida to'liq summa emas, qoldiq ko'rsatiladi
    expect(overdue?.items).toEqual([invoiceItem('legacy', 300000), invoiceItem('old', 500000), invoiceItem('delOverdue', 400000), invoiceItem('yesterday', 1000000)]);
    // Bugun muddati tugaydigan, to'langan/bekor qilingan buyurtmaniki va yopilgan yoki bekor qilingan hisob-faktura ro'yxatda yo'q
    for (const name of ['today', 'in3days', 'paidOrder', 'cancelledOrder', 'closed', 'delVoid']) expect(overdue?.items.join('\n'), name).not.toContain(invoices[name].invoiceNo);
  });

  it('muddati 3 kun ichida tugaydigan hisob-fakturalar: bugundan 3 kun keyingi kunning oxirigacha', async () => {
    // Kiradi: bugun (kun boshi) va 13-mart oxiri. Kirmaydi: 14-mart, bekor qilingan hisob-faktura, to'langan buyurtmaniki, muddati o'tganlar
    expect(await found('invoices_due_soon')).toMatchObject({ severity: 'low', count: 2, items: [], link: '/admin/invoices' });
  });

  it('ishlab chiqarish: muddati o\'tgan, hali tugallanmagan topshiriqlar (eng kechikkani tepada)', async () => {
    const late = await found('late_production');
    expect(late).toMatchObject({ severity: 'medium', count: 3, link: '/admin/production' });
    expect(late?.items).toEqual([`${workNo(2)} · muddat 01.03.1960 · 10%`, `${workNo(1)} · muddat 08.03.1960 · 40%`, `${workNo(3)} · muddat 09.03.1960 · 0%`]);
  });

  // Muddat admin panelda sana bo'lib kiritiladi va UTC yarim tuni (Toshkentda 05:00) bo'lib saqlanadi: soat bilan solishtirilsa muddati
  // BUGUN bo'lgan topshiriq ertalabki tekshiruvdayoq "muddati o'tgan" bo'lib chiqardi. Admin paneldagi isOverdue
  // (components/admin/production/badges.tsx) muddat kunini to'liq hisoblaydi — tekshiruv ham shunday
  it('ishlab chiqarish: muddat kunining o\'zida topshiriq hali "muddati o\'tgan" emas — ertasi kun (Toshkent) boshlangachgina', async () => {
    const lateAt = async (iso: string) => (await found('late_production', new Date(iso)))?.items.map((i) => i.split(' · ')[0]) ?? [];
    const yesterdayAndOlder = [workNo(2), workNo(1), workNo(3)];
    // 10-mart (Toshkent): kun boshida (UTC bo'yicha hali 9-mart), ertalab 08:00 va 10:00 da, kun oxirida — muddati 10-mart bo'lganlar yo'q
    for (const moment of ['1960-03-09T19:00:00Z', '1960-03-10T03:00:00Z', '1960-03-10T05:00:00Z', '1960-03-10T18:59:59Z']) expect(await lateAt(moment), moment).toEqual(yesterdayAndOlder);
    // 11-mart 00:00 (Toshkent): muddati 10-mart bo'lgan ikkalasi qo'shiladi (soati bilan saqlangani ham); muddati 11-mart bo'lgani — hali yo'q
    expect(await lateAt('1960-03-10T19:00:00Z')).toEqual([...yesterdayAndOlder, workNo(7), workNo(8)]);
    // 9-martning oxirgi soniyasida (Toshkent) muddati 9-mart bo'lgan topshiriq ham hali o'tmagan
    expect(await lateAt('1960-03-09T18:59:59Z')).toEqual([workNo(2), workNo(1)]);
  });

  it('24 soatdan beri javobsiz arizalar va 3 kundan beri ko\'rilmagan sharhlar', async () => {
    // Har biridan uchtadan bor: eskisi, aynan chegaradagisi va allaqachon ko'rib chiqilgani — faqat birinchisi sanaladi
    expect(await found('stale_leads')).toMatchObject({ severity: 'medium', count: 1, items: [], link: '/admin/leads' });
    expect(await found('old_reviews')).toMatchObject({ severity: 'low', count: 1, items: [], link: '/admin/reviews' });
  });

  it('kam qolgan mahsulotlar: chegaradan kam yoki teng, omborda yozuvi yo\'q; yetarlisi va arxivdagisi kirmaydi', async () => {
    const low = await found('low_stock');
    expect(low).toMatchObject({ severity: 'medium', link: '/admin/inventory?low=1' });
    expect(low?.title).toContain('(10 dona va undan kam)');
    expect(low?.count).toBeGreaterThanOrEqual(3); // bazada boshqa fayllarning mahsulotlari ham bo'lishi mumkin
    const mine = low?.items.filter((i) => i.startsWith(`000 ${fx.tag} `));
    expect(mine).toEqual([`${productName('chegarada')} · 10 dona`, `${productName('kam')} · 3 dona`, `${productName('qoldiqsiz')} · 0 dona`]);

    // Chegara sozlamadan olinadi: 2 donaga tushirilsa 3 va 10 donali mahsulotlar ro'yxatdan chiqadi
    const saved = h.settings.lowStockThreshold;
    h.settings.lowStockThreshold = 2;
    try {
      const strict = await found('low_stock');
      expect(strict?.title).toContain('(2 dona va undan kam)');
      expect(strict?.items.filter((i) => i.startsWith(`000 ${fx.tag} `))).toEqual([`${productName('qoldiqsiz')} · 0 dona`]);
    } finally {
      h.settings.lowStockThreshold = saved;
    }
  });

  // updatedAt har qanday o'zgarishda yangilanadi (xodim izoh yozsa ham): unga qarab sanalsa, bir hafta oldin o'tmagan to'lov har safar
  // "oxirgi 24 soatda" bo'lib qaytib chiqardi. To'lov qachon o'tmagani tarixdagi (OrderEvent) to'lov yozuvidan olinadi
  it('oxirgi 24 soatda o\'tmagan onlayn to\'lovlar: tarixida shu vaqt ichida "to\'lov o\'tmadi" yozuvi bor buyurtmalargina', async () => {
    const failed = await found('failed_payments', FUTURE);
    expect(failed).toMatchObject({ severity: 'low', count: 1, items: [orderItem('failRecent')], link: '/admin/orders' });
    expect(failed?.items[0]).toMatch(/ · 480\s000 so'm$/);
    // Ro'yxatga kirmaganlarning hammasida to'lov "o'tmagan" (yoki o'tmagan edi) va updatedAt 1 soat oldin: aynan 24 soat oldingi yozuv; 3 kun
    // oldin o'tmagan-u bugun holati o'zgargan; tarixsiz; tarixida boshqa turdagi yangi yozuvlar; bekor qilingan, qoralama, o'chirilgan; to'langan
    for (const name of ['failEdge', 'failOld', 'failNoHistory', 'failOtherEvents', 'failCancelled', 'failDraft', 'failDeleted', 'paidRecent']) {
      expect(orders[name].updatedAt, name).toEqual(ago(HOUR, FUTURE));
    }
  });

  it('o\'tmagan to\'lov tekshiruv paytidan oldingi 24 soat bo\'yicha sanaladi: 3 kun oldingisi o\'sha kuni ko\'ringan, ertasiga — yo\'q', async () => {
    const failedAt = async (now: Date) => (await found('failed_payments', now))?.items ?? [];
    // 3 kun oldingi muvaffaqiyatsizlikdan 2 soat keyin o'tkazilgan tekshiruv uni ko'rgan
    expect(await failedAt(ago(3 * DAY - 2 * HOUR, FUTURE))).toContain(orderItem('failOld'));
    // Ertasi kungi tekshiruvda (yana 25 soat o'tgach) u endi yo'q — buyurtmaning updatedAt i esa undan ham yangi
    expect(await failedAt(ago(2 * DAY - HOUR, FUTURE))).not.toContain(orderItem('failOld'));
    // "Aynan 24 soat" chegarasidan bir soniya oldin o'tkazilgan tekshiruvda chegaradagi yozuv ham bor
    expect(await failedAt(ago(1000, FUTURE))).toEqual([orderItem('failRecent'), orderItem('failEdge')]);
  });

  // Tekshiruv faqat tarixga qaraydi, shuning uchun Click yo'li (app/api/payment/click/route.ts) allaqachon "o'tmagan" buyurtmaning keyingi
  // muvaffaqiyatsiz urinishini ham tarixga yozadi ("failed" -> "failed"). Bu yerda o'sha yozuv afterPaymentChange yozadigan ko'rinishda
  // qo'shiladi; Click so'rovining o'zi (qachon yoziladi, qachon takror hisoblanadi) payment-webhooks.test.ts da tekshirilgan
  it('allaqachon "o\'tmagan" turgan buyurtmada Click orqali yana o\'tmagan urinish ham oxirgi 24 soatdagi o\'tmagan to\'lovlarda ko\'rinadi', async () => {
    const failedAt = async (now: Date) => (await found('failed_payments', now))?.items ?? [];
    // failOld: 3 kun oldin o'tmagan, to'lovi hamon "failed"; bugun unga faqat boshqa sabab bilan tegilgan (holat yozuvi, updatedAt) — ro'yxatda yo'q
    expect(orders.failOld).toMatchObject({ paymentStatus: 'failed', updatedAt: ago(HOUR, FUTURE) });
    expect(await failedAt(FUTURE)).toEqual([orderItem('failRecent')]);
    // Mijoz 2 soat oldin Click orqali yana urinib ko'rdi va yana o'tmadi: buyurtma holati o'zgarmadi, tarixga esa yangi to'lov yozuvi tushdi
    const retry = await prisma.orderEvent.create({ data: { orderId: orders.failOld.id, kind: 'payment', fromValue: 'failed', toValue: 'failed', actor: 'Click', via: 'click', createdAt: ago(2 * HOUR, FUTURE) } });
    try {
      expect(await found('failed_payments', FUTURE)).toMatchObject({ severity: 'low', count: 2, items: [orderItem('failRecent'), orderItem('failOld')] });
      // Yangi urinish ham o'z vaqtidan boshlab 24 soat ko'rinadi: 21 soatdan keyingi tekshiruvda hali bor, 22 soatdan keyin (aynan 24 soat) — yo'q
      expect(await failedAt(new Date(FUTURE.getTime() + 21 * HOUR))).toEqual([orderItem('failRecent'), orderItem('failOld')]);
      expect(await failedAt(new Date(FUTURE.getTime() + 22 * HOUR))).toEqual([orderItem('failRecent')]);
    } finally {
      // Fayl bitta umumiy tranzaksiyada ishlaydi: keyingi testlar uchun tarix avvalgi holiga qaytariladi
      await prisma.orderEvent.delete({ where: { id: retry.id } });
    }
    expect(await failedAt(FUTURE)).toEqual([orderItem('failRecent')]);
  });

  it('tartib: avval muhim, keyin o\'rta, oxirida past; topilma bermagan qoida ro\'yxatga kirmaydi', async () => {
    const checks = await collectChecks(NOW);
    const rank = { high: 0, medium: 1, low: 2 };
    const ranks = checks.map((c) => rank[c.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    // "failed_payments" 1960-yilgi "hozir"da keyingi hamma to'lov yozuvlarini (boshqa fayllarnikini ham) sanaydi — u yuqorida alohida tekshirilgan
    expect(checks.map((c) => c.key).filter((k) => k !== 'failed_payments')).toEqual([
      'paid_not_started', 'stale_new', 'overdue_invoices', 'delivered_unpaid',
      'late_production', 'slow_processing', 'slow_shipping', 'stale_leads', 'low_stock',
      'invoices_due_soon', 'old_reviews',
    ]);
    for (const c of checks) expect(c.count, c.key).toBeGreaterThan(0);
  });

  it('sozlamalar: rekvizitlar to\'liq bo\'lmasa eslatadi; botga xodim ulangan bo\'lsa "hech kim ulanmagan" demaydi', async () => {
    expect(await found('requisites_missing')).toBeUndefined();
    const saved = h.settings.inn;
    h.settings.inn = '';
    try {
      expect(await found('requisites_missing')).toMatchObject({ severity: 'low', count: 1, items: [], link: '/admin/settings' });
    } finally {
      h.settings.inn = saved;
    }
    // Boshqaruv boti tokeni bor va "orders" ruxsatli xodim (shu faylning menejeri) botga ulangan
    vi.stubEnv('STAFF_BOT_TOKEN', '222:staff-token');
    expect(await found('no_staff_linked')).toBeUndefined();
    // Administrator ham ulangan (shu faylniki xabarnomani o'chirib qo'ygan — server nosozligi xabari uchun bu ahamiyatsiz)
    expect(await found('ops_no_admin')).toBeUndefined();
  });

  // Server nosozligi xabarlarini (deploy/watchdog.sh) oladiganlar ro'yxati haqiqiy so'rov bilan: faqat faol, o'chirilmagan administratorlar
  it('server xabarlarini oladiganlar (alertChats): menejer, oddiy xodim, o\'chirilgan yoki faol bo\'lmagan administrator kirmaydi', async () => {
    const inactive = await fx.user({ role: 'admin', telegramId: fx.tg(), isActive: false });
    const removed = await fx.user({ role: 'admin', telegramId: fx.tg(), deletedAt: ago(DAY) });
    const chats = await alertChats();
    for (const user of [manager, worker, inactive, removed]) expect(chats, user.role).not.toContain(user.telegramId);
    // Ro'yxat ko'pi bilan 10 kishilik va bazada boshqa fayllarning administratorlari ham bo'lishi mumkin — shu faylniki unga sig'gan bo'lsa, u bor
    if (chats.length < 10) expect(chats).toContain(muted.telegramId);
    expect(chats.length).toBeGreaterThanOrEqual(1);
    for (const id of chats) expect(id).toMatch(/^-?\d{4,20}$/);
  });

  // ── Server holati va xabarlar navbati (kaliti ops_ / outbox_): haqiqiy SiteSetting va BotOutbox jadvallaridan

  const infra = (checks: AuditCheck[]) => checks.filter((c) => /^(ops|outbox)_/.test(c.key)).map((c) => `${c.severity}:${c.key}`);
  const MINUTE = 60_000;
  const HEALTHY = { disk: 41, backupAgeH: 5, restoreOk: 1, offsiteOk: 1, certDays: 60, siteOk: 1, tickOk: 1 };
  const TOOL_LINE = '🛠 Bular admin panelda tuzatilmaydi — texnik mutaxassisga ayting («Batafsil» → Server holati).';
  const dropOps = () => prisma.siteSetting.deleteMany({ where: { key: 'ops' } });

  it('server holati: kuzatuv signali (SiteSetting "ops") bo\'yicha topilmalar; signal hali kelmagan yoki sog\'lom bo\'lsa — yo\'q, eskirgan bo\'lsa — faqat shu', async () => {
    try {
      // Signal hali umuman kelmagan (eski server skripti): server bo'yicha hech narsa aytilmaydi
      expect(infra(await collectChecks(NOW))).toEqual([]);

      await saveOps({ disk: 93, backupAgeH: 31, restoreOk: 0, offsiteOk: 0, certDays: 5, siteOk: 0, tickOk: 1 }, ago(2 * MINUTE));
      const bad = await collectChecks(NOW);
      expect(infra(bad)).toEqual(['high:ops_disk', 'high:ops_backup', 'high:ops_restore', 'high:ops_cert', 'high:ops_site', 'medium:ops_offsite']);
      const title = Object.fromEntries(bad.map((c) => [c.key, c.title]));
      expect(title.ops_disk).toContain('93%');
      expect(title.ops_backup).toContain('31 soat');
      expect(title.ops_cert).toContain('5 kun');
      for (const c of bad.filter((x) => x.key.startsWith('ops_'))) expect(c, c.key).toMatchObject({ count: 1, items: [], link: '/admin/audit' });
      // Muhim server topilmalari ish topilmalarining muhimlari bilan birga tepada: umumiy tartib buzilmagan
      const rank = { high: 0, medium: 1, low: 2 };
      expect(bad.map((c) => rank[c.severity])).toEqual(bad.map((c) => rank[c.severity]).sort((a, b) => a - b));

      // Xuddi shu faktlar 31 daqiqa oldin kelgan: ular endi hozirgi holat emas — bitta "signal kelmayapti" (oxirgi signal vaqti bilan)
      await saveOps({ disk: 93, backupAgeH: 31, restoreOk: 0, offsiteOk: 0, certDays: 5, siteOk: 0, tickOk: 1 }, ago(31 * MINUTE));
      const stale = (await collectChecks(NOW)).filter((c) => c.key.startsWith('ops_'));
      expect(stale).toEqual([expect.objectContaining({ key: 'ops_stale', severity: 'medium', count: 1, items: [], link: '/admin/audit' })]);
      expect(stale[0].title).toContain('10.03.1960');
      expect(stale[0].title).toContain(`(oxirgisi ${formatDate(ago(31 * MINUTE), 'uz', true)})`);

      await saveOps(HEALTHY, ago(MINUTE));
      expect(infra(await collectChecks(NOW))).toEqual([]);
    } finally {
      await dropOps();
    }
  });

  it('xabarlar navbati: oxirgi 24 soatda yetkazilmagan va bir soatdan beri kutayotgan xabarlar sanaladi; yuborilgani, yangisi va eskirib o\'rnini yangisi bosgani — yo\'q', async () => {
    const chatId = manager.telegramId ?? '';
    const row = (data: { createdAt: Date; sentAt?: Date; failedAt?: Date; lastError?: string }) =>
      prisma.botOutbox.create({ data: { bot: 'staff', chatId, html: 'x', attempts: 2, nextAt: new Date(NOW.getTime() + 5 * MINUTE), ...data } });
    try {
      expect(infra(await collectChecks(NOW))).toEqual([]);
      // Kutayotganlar: 2 soatdan beri (qotgan), aynan 1 soat (hali emas) va 30 daqiqa (oddiy kutish — keyingi tick yuboradi)
      await row({ createdAt: ago(2 * HOUR) });
      await row({ createdAt: ago(HOUR) });
      await row({ createdAt: ago(30 * MINUTE) });
      // Yetkazilmaganlar: 2 soat oldin (urinishlar tugagan) va token yo'qligidan — sanaladi; aynan 24 soat va 25 soat oldingisi — yo'q
      await row({ createdAt: ago(20 * HOUR), failedAt: ago(2 * HOUR), lastError: 'Telegram sendMessage: 502 Bad Gateway' });
      await row({ createdAt: ago(3 * DAY), failedAt: ago(HOUR), lastError: "bot tokeni yo'q" });
      await row({ createdAt: ago(2 * DAY), failedAt: ago(DAY), lastError: 'fetch failed' });
      await row({ createdAt: ago(2 * DAY), failedAt: ago(25 * HOUR), lastError: 'fetch failed' });
      // Yangi holat xabari o'rnini bosgan (eskirgan) yozuv yetkazilmagan sanalmaydi: mijoz yangisini olgan
      await row({ createdAt: ago(3 * HOUR), failedAt: ago(HOUR), lastError: 'eskirgan' });
      // Yetib borgan xabar hech qaysi sanoqda yo'q (2 soat oldin yaratilgan bo'lsa ham)
      await row({ createdAt: ago(2 * HOUR), sentAt: ago(HOUR) });

      const checks = await collectChecks(NOW);
      expect(infra(checks)).toEqual(['medium:outbox_failed', 'medium:outbox_stuck']);
      expect(checks.find((c) => c.key === 'outbox_failed')).toMatchObject({ count: 2, items: [], link: '/admin/audit' });
      expect(checks.find((c) => c.key === 'outbox_stuck')).toMatchObject({ count: 1, items: [], link: '/admin/audit' });
      // Xabar matni ham, oluvchi ham hisobotga tushmaydi — faqat sonlar
      expect(JSON.stringify(checks)).not.toContain(chatId);

      // Bir daqiqadan keyingi tekshiruvda aynan 1 soatlik yozuv ham "qotgan"; 23 soatdan keyin 2 soat oldingi xato hali hisobda, 1 soat oldingisi ham
      expect((await collectChecks(new Date(NOW.getTime() + MINUTE))).find((c) => c.key === 'outbox_stuck')?.count).toBe(2);
      expect((await collectChecks(new Date(NOW.getTime() + 22 * HOUR + MINUTE))).find((c) => c.key === 'outbox_failed')?.count).toBe(1);
    } finally {
      await prisma.botOutbox.deleteMany({});
    }
  });

  it('maxfiylik: natijada mijoz ismi, telefoni, manzili, kompaniyasi yoki izohi yo\'q', async () => {
    const all = JSON.stringify([await collectChecks(NOW), await collectChecks(FUTURE)]);
    for (const secret of [PII.name, 'Maxfiyeva', PII.phone, PII.phone.slice(-9), PII.address, 'Yashirin', PII.company, PII.text, manager.phone, manager.telegramId ?? '-']) expect(all, secret).not.toContain(secret);
    // Misollar bor (ro'yxat bo'sh emas) — ya'ni yuqoridagi tekshiruv bo'sh natija ustida o'tmagan
    expect(all).toContain(`#${orders.staleOld.id} · `);
    expect(all).toContain(invoices.old.invoiceNo);
    // Tarixdan (OrderEvent) topilgan buyurtmalar ham ro'yxatda — ularning tarixidagi ijrochi nomi (yuqorida tekshirilgan ism) esa yo'q
    expect(all).toContain(`#${orders.procOldEvent.id} · `);
    expect(all).toContain(`#${orders.failRecent.id} · `);
  });

  it('runAudit("manual"): hisobot saqlanadi; AI sozlanmagan — xulosa va model bo\'sh', async () => {
    const expected = await collectChecks(NOW);
    const report = await runAudit('manual', NOW);
    const row = await prisma.auditReport.findUniqueOrThrow({ where: { id: report.id } });
    expect(row).toMatchObject({ trigger: 'manual', summary: null, model: null, createdAt: NOW });
    // Saqlangan JSON admin sahifasi o'qiydigan ko'rinishda va hozirgina hisoblangan natija bilan bir xil
    expect(row.checks).toEqual(expected);
    expect(reportChecks(row.checks)).toEqual(expected);
    expect(JSON.stringify(row.checks)).not.toContain(PII.name);
    // Qo'lda ishga tushirilgan tekshiruv hech kimga xabar yubormaydi; kalit yo'q — AI'ga so'rov ham ketmagan, hisobdan so'rov band qilinmagan
    expect(outbox.staff).toEqual([]);
    expect(h.http).not.toHaveBeenCalled();
    expect(await prisma.aiUsage.findUnique({ where: { day: '1960-03-10' } })).toBeNull();
  });

  it('AI yoqilgan: Anthropic\'ka ketadigan so\'rovda mijoz ma\'lumoti yo\'q; xulosa, model va sarf saqlanadi', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    aiAnswers();

    const report = await runAudit('manual', NOW);

    // Simdan ketgan butun so'rov tanasi: buyurtma va hisob-faktura raqamlari bor, mijozga tegishli hech narsa yo'q
    expect(h.http).toHaveBeenCalledTimes(1);
    const wire = String(h.http.mock.calls[0][1].body);
    expect(wire).toContain(`#${orders.staleOld.id} · `);
    expect(wire).toContain(invoices.yesterday.invoiceNo);
    expect(wire).toContain(workNo(1));
    for (const secret of [PII.name, 'Maxfiyeva', PII.phone, PII.phone.slice(-9), PII.address, 'Yashirin', PII.company, 'Sirli', PII.text, '/admin']) expect(wire, secret).not.toContain(secret);

    const row = await prisma.auditReport.findUniqueOrThrow({ where: { id: report.id } });
    expect(row).toMatchObject({ trigger: 'manual', model: 'claude-opus-5-5', createdAt: NOW });
    expect(row.summary).toEqual(AI_SUMMARY);
    // Sarf Toshkent kuni bo'yicha yozilgan (tranzaksiya ichida — test tugagach bu qator ham bekor qilinadi). So'rov bir marta sanalgan:
    // yuborishdan oldin band qilingan, javobdan keyin faqat tokenlar qo'shilgan
    expect(await prisma.aiUsage.findUnique({ where: { day: '1960-03-10' } })).toMatchObject({ requests: 1, inputTokens: 900, outputTokens: 120 });
  });

  // Chegara bitta shartli UPDATE bilan band qilinadi (reserveAiRequest) — bu faqat haqiqiy bazada tekshiriladi
  it('AI chegarasi: qo\'lda ishga tushirilgan tekshiruv kunlik chegaradan oshmaydi, kunlik (cron) xulosa esa chegaradan tashqari sanaladi', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    vi.stubEnv('AI_DAILY_LIMIT', '2');
    aiAnswers();
    const now = new Date('1960-03-12T05:00:00Z'); // boshqa testlar tegmagan kun
    const usage = () => prisma.aiUsage.findUnique({ where: { day: '1960-03-12' }, select: { requests: true, inputTokens: true, outputTokens: true } });

    expect((await runAudit('manual', now)).summary).toEqual(AI_SUMMARY);
    expect((await runAudit('manual', now)).summary).toEqual(AI_SUMMARY);
    expect(await usage()).toEqual({ requests: 2, inputTokens: 1800, outputTokens: 240 });

    // Chegara to'ldi: uchinchi urinish AI'ga yetib bormaydi, hisobot xulosasiz saqlanadi, sanoq o'zgarmaydi
    const third = await runAudit('manual', now);
    expect(third).toMatchObject({ trigger: 'manual', summary: null, model: null });
    expect(reportChecks(third.checks).length).toBeGreaterThan(0);
    expect(h.http).toHaveBeenCalledTimes(2);
    expect(await usage()).toEqual({ requests: 2, inputTokens: 1800, outputTokens: 240 });

    // Kunlik avtomatik xulosa: mijozlar chegarani tugatib qo'ygan kuni ham ega xulosasiz qolmaydi — va bu so'rov ham hisobga yoziladi
    const cron = await runAudit('cron', now);
    expect(cron).toMatchObject({ trigger: 'cron', model: 'claude-opus-5-5' });
    expect(cron.summary).toEqual(AI_SUMMARY);
    expect(h.http).toHaveBeenCalledTimes(3);
    expect(await usage()).toEqual({ requests: 3, inputTokens: 2700, outputTokens: 360 });
  });

  it('AI javobi yaroqsiz (uzilgan JSON): hisobot xulosasiz saqlanadi, sarflangan so\'rov va tokenlar esa hisobda', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    h.http.mockImplementation(async () => new Response(
      JSON.stringify({ id: 'msg_02', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: '{"headline":"Bugun' }], stop_reason: 'max_tokens', stop_sequence: null, usage: { input_tokens: 700, output_tokens: 8000 } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    const now = new Date('1960-03-13T05:00:00Z');
    try {
      const report = await runAudit('manual', now);
      expect(report).toMatchObject({ trigger: 'manual', summary: null, model: null });
      expect(reportChecks(report.checks).length).toBeGreaterThan(0);
      expect(await prisma.aiUsage.findUnique({ where: { day: '1960-03-13' } })).toMatchObject({ requests: 1, inputTokens: 700, outputTokens: 8000 });
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });

  it('dailyAudit: hisobot saqlanadi, "reports" ruxsati bor xodimlarga boradi, 90 kundan eski hisobotlar o\'chadi', async () => {
    const old = await prisma.auditReport.create({ data: { trigger: 'cron', checks: [], createdAt: ago(90 * DAY + 1000) } });
    const edge = await prisma.auditReport.create({ data: { trigger: 'cron', checks: [], createdAt: ago(90 * DAY) } });
    const before = await prisma.auditReport.count({ where: { trigger: 'cron', createdAt: NOW } });

    const result = await dailyAudit(NOW);
    // 11 ta qoida (yuqoridagi "tartib" testidagi ro'yxat) + o'tmagan to'lovlar
    expect(result).toEqual({ findings: 12, sent: outbox.staff.length, ai: false });
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const rows = await prisma.auditReport.findMany({ where: { trigger: 'cron', createdAt: NOW } });
    expect(rows).toHaveLength(before + 1);
    expect(rows.at(-1)).toMatchObject({ summary: null, model: null });
    expect(reportChecks(rows.at(-1)?.checks)).toHaveLength(12);

    // Menejerda "reports" ruxsati bor; oddiy xodimda yo'q; administrator xabarnomani o'chirib qo'ygan
    const toManager = outbox.staff.filter((m) => m.to === manager.telegramId);
    expect(toManager).toHaveLength(1);
    expect(outbox.staff.filter((m) => m.to === worker.telegramId || m.to === muted.telegramId)).toEqual([]);
    const lines = toManager[0].html.split('\n');
    expect(lines[0]).toBe('🧭 <b>Kunlik tekshiruv</b>');
    // AI xulosasi yo'q: dastlabki 8 ta tekshiruv muhimlik tartibida, soni bilan; qolgan 4 tasi borligi oxirgi satrda aytiladi.
    // Server va navbat topilmalari yo'q — "admin panelda tuzatilmaydi" izohi ham chiqmaydi
    expect(lines).toHaveLength(11);
    expect(lines[1]).toBe('');
    expect(lines[9]).toMatch(/^🟠 /);
    expect(lines[10]).toBe('… yana 4 ta');
    expect(toManager[0].html).not.toContain('🛠');
    expect(lines[2]).toBe("🔴 To'lovi kelgan, lekin hali qabul qilinmagan buyurtmalar (2 soatdan ortiq): <b>2</b>");
    expect(lines[3]).toBe('🔴 24 soatdan beri qabul qilinmagan yangi buyurtmalar: <b>2</b>');
    expect(lines[4]).toMatch(/^🔴 Muddati o'tgan hisob-fakturalar \(jami qoldiq 2\s200\s000 so'm\): <b>4<\/b>$/);
    expect(lines[5]).toBe("🔴 Yetkazilgan, lekin 3 kundan beri to'lanmagan buyurtmalar: <b>3</b>");
    expect(lines[6]).toBe("🟠 Muddati o'tgan ishlab chiqarish topshiriqlari: <b>3</b>");
    expect(lines[7]).toBe('🟠 5 kundan beri "Tayyorlanmoqda" holatida turgan buyurtmalar: <b>3</b>');
    expect(lines[8]).toBe('🟠 5 kundan beri "Yo\'lda" holatida turgan buyurtmalar: <b>2</b>');
    expect(toManager[0].html).not.toContain(PII.name);
    expect(toManager[0].inline?.flat().map((b) => b.url)).toEqual([expect.stringMatching(/\/admin\/audit$/)]);

    // 90 kundan (bir soniyaga bo'lsa ham) eski hisobot o'chgan; aynan 90 kunlik va yangilari joyida
    expect(await prisma.auditReport.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.auditReport.findUnique({ where: { id: edge.id } })).not.toBeNull();
    expect(await prisma.auditReport.count({ where: { trigger: 'manual', createdAt: NOW } })).toBeGreaterThanOrEqual(1);
  });

  // Server topilmalari admin panelda tuzatilmaydi: AI ularga panel bo'limini ko'rsatib to'qilgan amal yozmasin deb umuman yuborilmaydi,
  // xabarda esa modelga bog'liq bo'lmagan o'z satrida, ustuvor ishlardan oldin turadi
  it('dailyAudit, server va navbat topilmalari bilan: AI\'ga faqat ish topilmalari ketadi; xabarda ular sarlavhadan keyin o\'z satrlarida', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    aiAnswers();
    const now = new Date('1960-03-14T05:00:00Z'); // AI sarfi bo'yicha boshqa testlar tegmagan kun
    try {
      await saveOps({ ...HEALTHY, restoreOk: 0 }, new Date(now.getTime() - 2 * MINUTE));
      await prisma.botOutbox.create({ data: { bot: 'staff', chatId: worker.telegramId ?? '', html: 'x', attempts: 6, nextAt: now, createdAt: new Date(now.getTime() - DAY), failedAt: new Date(now.getTime() - HOUR), lastError: 'fetch failed' } });

      const result = await dailyAudit(now);
      expect(result).toMatchObject({ sent: outbox.staff.length, ai: true });
      const report = await prisma.auditReport.findFirstOrThrow({ where: { trigger: 'cron', createdAt: now } });
      const saved = reportChecks(report.checks);
      expect(saved).toHaveLength(result.findings);
      // Hisobotda (admin sahifasi shundan o'qiydi) hammasi bor
      expect(infra(saved)).toEqual(['high:ops_restore', 'medium:outbox_failed']);
      expect(report.summary).toEqual(AI_SUMMARY);

      // Simdan ketgan so'rov: ish topilmalari bor, server va navbat topilmalarining kaliti ham, matni ham yo'q
      expect(h.http).toHaveBeenCalledTimes(1);
      const wire = String(h.http.mock.calls[0][1].body);
      expect(wire).toContain('overdue_invoices');
      for (const hidden of ['ops_', 'outbox_', 'Zaxira nusxani', 'bot xabarlari']) expect(wire, hidden).not.toContain(hidden);

      const [toManager] = outbox.staff.filter((m) => m.to === manager.telegramId);
      expect(toManager.html.split('\n')).toEqual([
        '🧭 <b>Kunlik tekshiruv</b>', AI_SUMMARY.headline, '',
        "🔴 Zaxira nusxani sinov tariqasida tiklab bo'lmadi — nusxa yaroqsiz bo'lishi mumkin: <b>1</b>",
        "🟠 Oxirgi 24 soatda Telegram'ga yetkazib bo'lmagan bot xabarlari (qayta urinishlar tugadi): <b>1</b>",
        TOOL_LINE, '',
        `1. <b>${AI_SUMMARY.priorities[0].title}</b>`, AI_SUMMARY.priorities[0].action,
      ]);
    } finally {
      await dropOps();
      await prisma.botOutbox.deleteMany({});
    }
  });
});
