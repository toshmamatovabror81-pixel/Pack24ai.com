import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Admin panel amallari botlar poydevoriga to'g'ri ulanganini tekshiradi: buyurtma formasi orderFlow orqali ishlaydi,
 * hisob-faktura to'lovi va ishlab chiqarish bosqichi kerakli paytdagina xabar yuboradi, Xodimlar sahifasidagi Telegram amallari
 * faqat xodim yozuvlariga qo'llanadi. Baza xotirada; orderFlow, orderNotify va staffLink chaqiruvlari `s.calls` ga yoziladi.
 */
const s = vi.hoisted(() => ({
  calls: [] as unknown[][],
  revalidated: [] as string[],
  statusResult: null as unknown,
  paymentResult: null as unknown,
  orders: new Map<number, Record<string, unknown>>(),
  invoices: new Map<number, Record<string, unknown>>(),
  users: new Map<number, Record<string, unknown>>(),
  workOrders: new Map<number, Record<string, unknown>>(),
  stages: new Map<number, Record<string, unknown>>(),
}));

/** next/navigation redirect() xato tashlab chiqadi — testda manzilini shu xatodan olamiz */
class Redirect extends Error {
  constructor(public url: string) { super(`REDIRECT ${url}`); }
}

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { s.revalidated.push(p); } }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Redirect(url); } }));
vi.mock('@/lib/auth', () => ({ requireStaff: async (section: string) => { s.calls.push(['requireStaff', section]); return { id: 1, name: 'Admin Ali', role: 'admin' }; }, hashPassword: async (p: string) => `h:${p}` }));
vi.mock('@/lib/orderFlow', () => ({
  changeOrderStatus: async (...a: unknown[]) => { s.calls.push(['changeOrderStatus', ...a]); return s.statusResult; },
  setManualPayment: async (...a: unknown[]) => { s.calls.push(['setManualPayment', ...a]); return s.paymentResult; },
  afterPaymentChange: async (...a: unknown[]) => { s.calls.push(['afterPaymentChange', ...a]); },
}));
vi.mock('@/lib/orderNotify', () => ({
  notifyCustomerInvoice: async (...a: unknown[]) => { s.calls.push(['notifyCustomerInvoice', ...a]); return 1; },
  notifyCustomerProduction: async (...a: unknown[]) => { s.calls.push(['notifyCustomerProduction', ...a]); return 1; },
}));
vi.mock('@/lib/telegram/staffLink', () => ({
  issueStaffCode: async (id: number) => { s.calls.push(['issueStaffCode', id]); return { code: '042917', expires: new Date() }; },
  unlinkStaff: async (id: number) => { s.calls.push(['unlinkStaff', id]); },
  setStaffNotify: async (id: number, on: boolean) => { s.calls.push(['setStaffNotify', id, on]); },
}));
vi.mock('@/lib/settings', () => ({ getSettings: async () => ({ vatPercent: 12 }) }));
vi.mock('@/lib/documents', () => ({
  ensureInvoiceForOrder: async (orderId: number) => {
    const existing = [...s.invoices.values()].find((i) => i.orderId === orderId && i.status !== 'cancelled');
    if (existing) return existing;
    const inv = { id: 500, orderId, invoiceNo: 'INV-2026-0001', totalAmount: 100, dueDate: new Date(), status: 'issued' };
    s.invoices.set(500, inv);
    return inv;
  },
}));
vi.mock('@/lib/db', () => {
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'not' in v) return row[k] !== (v as { not: unknown }).not;
      if (v && typeof v === 'object' && 'in' in v) return (v as { in: unknown[] }).in.includes(row[k]);
      return row[k] === v;
    });
  const prisma: Record<string, unknown> = {
    order: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => [...s.orders.values()].find((o) => matches(o, where)) ?? null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = [...s.orders.values()].filter((o) => matches(o, where));
        rows.forEach((o) => Object.assign(o, data));
        return { count: rows.length };
      },
    },
    contract: { findUnique: async () => null },
    corporateInvoice: {
      findUnique: async ({ where }: { where: { id: number } }) => { const i = s.invoices.get(where.id); return i ? { ...i, order: { ...s.orders.get(i.orderId as number) } } : null; },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => [...s.invoices.values()].find((i) => matches(i, where)) ?? null,
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => Object.assign(s.invoices.get(where.id)!, data),
    },
    user: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => [...s.users.values()].find((u) => matches(u, where)) ?? null,
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => Object.assign(s.users.get(where.id) ?? {}, data),
    },
    workOrderStage: {
      findUnique: async ({ where }: { where: { id: number } }) => s.stages.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => Object.assign(s.stages.get(where.id)!, data),
    },
    workOrder: {
      findUnique: async ({ where }: { where: { id: number } }) => { const w = s.workOrders.get(where.id); return w ? { ...w, stages: [...s.stages.values()].filter((st) => st.workOrderId === where.id).map((st) => ({ ...st })) } : null; },
      // Haqiqiy baza kabi: `select` berilsa faqat so'ralgan ustunlar qaytadi (xabarnomaga nima yetib borishi shunga bog'liq)
      update: async ({ where, data, select }: { where: { id: number }; data: Record<string, unknown>; select?: Record<string, boolean> }) => {
        const row = Object.assign(s.workOrders.get(where.id)!, data);
        return select ? Object.fromEntries(Object.entries(row).filter(([k]) => select[k])) : { ...row };
      },
    },
  };
  prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
  return { prisma };
});

const { updateOrder } = await import('@/app/admin/(panel)/orders/actions');
const invoices = await import('@/app/admin/(panel)/invoices/actions');
const production = await import('@/app/admin/(panel)/production/actions');
const staff = await import('@/app/admin/(panel)/staff/actions');

const form = (o: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, v); return fd; };
/** Amalni bajaradi va u yo'naltirgan manzilni qaytaradi */
const run = async (fn: (fd: FormData) => Promise<unknown>, o: Record<string, string>): Promise<string> => {
  try {
    await fn(form(o));
  } catch (e) {
    if (e instanceof Redirect) return e.url;
    throw e;
  }
  throw new Error('amal hech qayerga yo\'naltirmadi');
};
const named = (name: string) => s.calls.filter((c) => c[0] === name);

beforeEach(() => {
  s.calls.length = 0;
  s.revalidated.length = 0;
  s.orders.clear();
  s.invoices.clear();
  s.users.clear();
  s.workOrders.clear();
  s.stages.clear();
  s.statusResult = { ok: true, changed: true, order: { status: 'processing' } };
  s.paymentResult = { ok: true, changed: true, order: {} };
});

describe('admin: buyurtma formasi (updateOrder)', () => {
  const actor = { name: 'Admin Ali', via: 'admin' };

  it('orderFlow orqali ishlaydi (enforceFlow siz) va yo\'naltirish manzili o\'zgarmagan', async () => {
    const url = await run(updateOrder, { id: '12', status: 'processing', paymentStatus: 'paid' });
    expect(url).toBe('/admin/orders/12?saved=1');
    expect(named('requireStaff')).toEqual([['requireStaff', 'orders']]);
    expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'processing', actor]]);
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'paid', actor]]);
    expect(s.revalidated).toEqual(['/admin/orders/12']);
  });

  it('holat "Yetkazildi" bo\'lganda ombor sahifasi ham yangilanadi', async () => {
    s.statusResult = { ok: true, changed: true, order: { status: 'delivered' } };
    await run(updateOrder, { id: '12', status: 'delivered', paymentStatus: 'pending' });
    expect(s.revalidated).toEqual(['/admin/inventory', '/admin/orders/12']);
    s.revalidated.length = 0;
    s.statusResult = { ok: true, changed: false, order: { status: 'delivered' } };
    await run(updateOrder, { id: '12', status: 'delivered', paymentStatus: 'pending' });
    expect(s.revalidated).toEqual(['/admin/orders/12']);
  });

  it('eskirgan forma: faqat xodim o\'zi o\'zgartirgan maydon qo\'llanadi', async () => {
    const url = await run(updateOrder, { id: '12', status: 'new_', prevStatus: 'new_', paymentStatus: 'paid', prevPaymentStatus: 'pending' });
    expect(url).toBe('/admin/orders/12?saved=1');
    expect(named('changeOrderStatus')).toHaveLength(0);
    expect(named('setManualPayment')).toHaveLength(1);
    s.calls.length = 0;
    await run(updateOrder, { id: '12', status: 'shipping', prevStatus: 'new_', paymentStatus: 'pending', prevPaymentStatus: 'pending' });
    expect(named('changeOrderStatus')).toHaveLength(1);
    expect(named('setManualPayment')).toHaveLength(0);
  });

  // Eskirganini orderFlow o'zi aniqlaydi (bazadagi qiymat bilan solishtirib, shartli yozuv bilan birga — db/orderFlow.test.ts);
  // forma faqat o'zi ko'rsatgan qiymatni "kutilgan" deb uzatadi va "conflict" javobini ogohlantirishga aylantiradi
  it('eskirgan forma: forma ko\'rsatgan holat va to\'lov orderFlow\'ga "kutilgan qiymat" bo\'lib beriladi', async () => {
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'new_', paymentStatus: 'paid', prevPaymentStatus: 'pending' })).toBe('/admin/orders/12?saved=1');
    expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'processing', actor, { expected: 'new_' }]]);
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'paid', actor, { expected: 'pending' }]]);
    s.calls.length = 0;
    // prev* yo'q (boshqa chaqiruvchi): solishtiradigan narsa yo'q — kutilgan qiymat berilmaydi, har doim qo'llanadi
    expect(await run(updateOrder, { id: '12', status: 'processing', paymentStatus: 'pending' })).toBe('/admin/orders/12?saved=1');
    expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'processing', actor]]);
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'pending', actor]]);
  });

  it('eskirgan forma: orderFlow "conflict" qaytarsa ogohlantirish chiqadi; eskirmagan maydon baribir qo\'llanadi', async () => {
    // Sahifa buyurtma "Yangi" paytida ochilgan; shu orada boshqaruv boti uni "Yo'lda" qilgan — holat yozilmadi, to'lov esa qo'llandi
    s.statusResult = { ok: false, reason: 'conflict', order: { status: 'shipping' } };
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'new_', paymentStatus: 'paid', prevPaymentStatus: 'pending' })).toBe('/admin/orders/12?error=conflict');
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'paid', actor, { expected: 'pending' }]]);
    expect(s.revalidated).toEqual(['/admin/orders/12']);
    s.calls.length = 0;
    // Teskarisi: to'lov eskirgan ("To'lanmagan" deb ko'rilgan, aslida "To'langan" — "Qaytarilgan" ustidan yozilmadi), holat esa qo'llandi
    s.statusResult = { ok: true, changed: true, order: { status: 'processing' } };
    s.paymentResult = { ok: false, reason: 'conflict', order: { paymentStatus: 'paid' } };
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'new_', paymentStatus: 'refunded', prevPaymentStatus: 'pending' })).toBe('/admin/orders/12?error=conflict');
    expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'processing', actor, { expected: 'new_' }]]);
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'refunded', actor, { expected: 'pending' }]]);
  });

  it('eskirgan forma: tanlangan qiymat allaqachon joyida bo\'lsa — ziddiyat emas; o\'chirilgan buyurtma — avvalgidek ro\'yxatga', async () => {
    // orderFlow "o'zgarmadi" deb qaytaradi (kutilgan qiymat mos kelmasa ham)
    s.statusResult = { ok: true, changed: false, order: { status: 'shipping' } };
    expect(await run(updateOrder, { id: '12', status: 'shipping', prevStatus: 'new_', paymentStatus: 'pending', prevPaymentStatus: 'pending' })).toBe('/admin/orders/12?saved=1');
    expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'shipping', actor, { expected: 'new_' }]]);
    expect(named('setManualPayment')).toHaveLength(0);
    // O'chirilgan buyurtma: "topilmadi" javobini orderFlow beradi
    s.statusResult = { ok: false, reason: 'not_found' };
    expect(await run(updateOrder, { id: '13', status: 'processing', prevStatus: 'new_', paymentStatus: 'pending', prevPaymentStatus: 'pending' })).toBe('/admin/orders');
  });

  it('onlayn to\'lov (tanlov maydoni yo\'q) va noma\'lum to\'lov qiymati setManualPayment ga yetib bormaydi', async () => {
    await run(updateOrder, { id: '12', status: 'processing' });
    await run(updateOrder, { id: '12', status: 'processing', paymentStatus: 'processing' });
    await run(updateOrder, { id: '12', status: 'processing', paymentStatus: 'failed' });
    expect(named('setManualPayment')).toHaveLength(0);
  });

  it('topilmasa yoki id yaroqsiz bo\'lsa — ro\'yxatga; poyga yutqazilsa — ogohlantirish', async () => {
    s.statusResult = { ok: false, reason: 'not_found' };
    expect(await run(updateOrder, { id: '99', status: 'processing', paymentStatus: 'paid' })).toBe('/admin/orders');
    expect(await run(updateOrder, { id: 'abc', status: 'processing' })).toBe('/admin/orders');
    s.statusResult = { ok: false, reason: 'conflict', order: {} };
    expect(await run(updateOrder, { id: '12', status: 'processing', paymentStatus: 'paid' })).toBe('/admin/orders/12?error=conflict');
    s.statusResult = { ok: false, reason: 'flow' };
    s.paymentResult = { ok: false, reason: 'online', order: {} };
    expect(await run(updateOrder, { id: '12', status: 'draft', paymentStatus: 'paid' })).toBe('/admin/orders/12?saved=1');
  });
});

describe('admin: hisob-faktura amallari', () => {
  const order = (over: Record<string, unknown> = {}) => ({ id: 7, paymentMethod: 'bank_transfer', status: 'processing', paymentStatus: 'pending', totalAmount: 100, accessToken: 't', telegramUserId: null, contactPhone: '998901234567', userId: null, deletedAt: null, ...over });
  const invoice = (over: Record<string, unknown> = {}) => ({ id: 3, orderId: 7, invoiceNo: 'INV-1', totalAmount: 100, paidAmount: 0, status: 'issued', createdAt: new Date(), ...over });

  it('markPaid: bank o\'tkazmali buyurtma bir marta "to\'langan" bo\'ladi va tarixga yoziladi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice());
    expect(await run(invoices.markPaid, { id: '3' })).toBe('/admin/invoices/3?saved=1');
    expect(s.invoices.get(3)!.status).toBe('paid');
    expect(s.orders.get(7)!.paymentStatus).toBe('paid');
    const calls = named('afterPaymentChange');
    expect(calls).toHaveLength(1);
    expect((calls[0][1] as Record<string, unknown>).paymentStatus).toBe('paid');
    expect((calls[0][1] as Record<string, unknown>).id).toBe(7);
    expect(calls[0][2]).toBe('pending');
    expect(calls[0][3]).toEqual({ name: 'Admin Ali', via: 'invoice' });
    await run(invoices.markPaid, { id: '3' });
    expect(named('afterPaymentChange')).toHaveLength(1);
  });

  it('markPaid: naqd yoki onlayn to\'lovli buyurtmaga tegmaydi', async () => {
    s.orders.set(7, order({ paymentMethod: 'cash' }));
    s.invoices.set(3, invoice());
    await run(invoices.markPaid, { id: '3' });
    expect(s.orders.get(7)!.paymentStatus).toBe('pending');
    expect(named('afterPaymentChange')).toHaveLength(0);
  });

  it('registerPartial: qisman to\'lovda jim, oxirgi to\'lov buyurtmani "to\'langan" qiladi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice());
    expect(await run(invoices.registerPartial, { id: '3', amount: '40' })).toBe('/admin/invoices/3?saved=1');
    expect(s.invoices.get(3)!.status).toBe('partial');
    expect(s.orders.get(7)!.paymentStatus).toBe('pending');
    expect(named('afterPaymentChange')).toHaveLength(0);
    await run(invoices.registerPartial, { id: '3', amount: '60' });
    expect(s.invoices.get(3)!.status).toBe('paid');
    expect(s.orders.get(7)!.paymentStatus).toBe('paid');
    expect(named('afterPaymentChange')).toHaveLength(1);
    expect(named('afterPaymentChange')[0][2]).toBe('pending');
  });

  it('registerPartial: qoldiqdan ortiq summa qabul qilinmaydi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice({ paidAmount: 40, status: 'partial' }));
    expect(await run(invoices.registerPartial, { id: '3', amount: '60.01' })).toBe('/admin/invoices/3?error=over');
    expect(s.invoices.get(3)).toMatchObject({ paidAmount: 40, status: 'partial' });
    expect(s.orders.get(7)!.paymentStatus).toBe('pending');
    expect(named('afterPaymentChange')).toHaveLength(0);
  });

  it('har bir hisob-faktura amali "finance" bo\'limi ruxsatini so\'raydi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice());
    await run(invoices.createInvoiceForOrder, { orderId: '7' });
    await run(invoices.registerPartial, { id: '3', amount: '10' });
    await run(invoices.markPaid, { id: '3' });
    expect(named('requireStaff')).toEqual(Array(3).fill(['requireStaff', 'finance']));
  });

  it('createInvoiceForOrder: mijozga faqat yangi yaratilgan hisob-faktura haqida xabar ketadi', async () => {
    s.orders.set(7, order());
    expect(await run(invoices.createInvoiceForOrder, { orderId: '7' })).toBe('/admin/invoices/500');
    expect(named('notifyCustomerInvoice')).toHaveLength(1);
    expect(named('notifyCustomerInvoice')[0][1]).toBe(7);
    await run(invoices.createInvoiceForOrder, { orderId: '7' });
    expect(named('notifyCustomerInvoice')).toHaveLength(1);
  });
});

describe('admin: ishlab chiqarish bosqichlari', () => {
  /** Ish topshirig'ining raqami: bosqich raqamlaridan (1–4) ham, buyurtma raqamidan (7) ham farq qiladi */
  const WORK_ORDER = 31;
  const setup = (woOver: Record<string, unknown> = {}) => {
    s.workOrders.set(WORK_ORDER, { id: WORK_ORDER, orderId: 7, productName: 'Quti 30x20', currentStage: 'gofra', progress: 0, status: 'planned', ...woOver });
    ['gofra', 'pechat', 'yiguv', 'qc'].forEach((stage, i) => s.stages.set(i + 1, { id: i + 1, workOrderId: WORK_ORDER, stage, status: 'pending', startedAt: null }));
  };

  it('ish boshlanganda, bosqich almashganda va tayyor bo\'lganda xabar ketadi — boshqa paytda yo\'q', async () => {
    setup();
    await run(production.startStage, { stageId: '1' });
    expect(named('notifyCustomerProduction')).toHaveLength(1);
    // Xabarnomaga topshiriqning O'Z raqami ham beriladi: navbatdagi xabar mavzusi shundan yasaladi (bir xil mahsulotli ikki topshiriq
    // bir-birining xabarini bekor qilmasin)
    expect(named('notifyCustomerProduction')[0][1]).toMatchObject({ id: WORK_ORDER, orderId: 7, productName: 'Quti 30x20', currentStage: 'gofra', progress: 0, status: 'in_progress' });
    await run(production.saveStage, { stageId: '1', operator: 'Vali' });
    expect(named('notifyCustomerProduction')).toHaveLength(1);
    await run(production.finishStage, { stageId: '1' });
    expect(named('notifyCustomerProduction')).toHaveLength(2);
    expect(named('notifyCustomerProduction')[1][1]).toMatchObject({ currentStage: 'pechat', progress: 25, status: 'in_progress' });
    await run(production.startStage, { stageId: '2' });
    expect(named('notifyCustomerProduction')).toHaveLength(2);
    await run(production.finishStage, { stageId: '2' });
    await run(production.finishStage, { stageId: '3' });
    await run(production.finishStage, { stageId: '4' });
    const all = named('notifyCustomerProduction');
    expect(all).toHaveLength(5);
    expect(all[4][1]).toMatchObject({ currentStage: 'qc', progress: 100, status: 'completed' });
    // Yuqoridagi 7 ta bosqich amalining har biri "production" bo'limi ruxsatini so'ragan
    expect(named('requireStaff')).toEqual(Array(7).fill(['requireStaff', 'production']));
  });

  it('buyurtmaga bog\'lanmagan yoki bekor qilingan topshiriq haqida xabar ketmaydi', async () => {
    setup({ orderId: null });
    await run(production.finishStage, { stageId: '1' });
    expect(named('notifyCustomerProduction')).toHaveLength(0);
    s.stages.clear();
    setup({ status: 'cancelled' });
    await run(production.finishStage, { stageId: '1' });
    expect(named('notifyCustomerProduction')).toHaveLength(0);
  });
});

describe('admin: xodimning Telegram amallari', () => {
  beforeEach(() => {
    s.users.set(5, { id: 5, role: 'manager', isActive: true, deletedAt: null });
    s.users.set(6, { id: 6, role: 'staff', isActive: false, deletedAt: null });
    s.users.set(9, { id: 9, role: 'user', isActive: true, deletedAt: null });
    // Boshqaruv boti sozlangan holat (tokensiz holat alohida testda)
    vi.stubEnv('STAFF_BOT_TOKEN', '111:test-token');
    vi.stubEnv('SUPERVISOR_BOT_TOKEN', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('issueTelegramCode: faqat faol xodimga; kod faqat yo\'naltirish manzilida', async () => {
    expect(await run(staff.issueTelegramCode, { id: '5' })).toBe('/admin/staff?code=042917&for=5');
    expect(named('requireStaff')).toEqual([['requireStaff', 'staff']]);
    expect(named('issueStaffCode')).toEqual([['issueStaffCode', 5]]);
    expect(await run(staff.issueTelegramCode, { id: '9' })).toBe('/admin/staff');
    expect(await run(staff.issueTelegramCode, { id: 'x' })).toBe('/admin/staff');
    expect(await run(staff.issueTelegramCode, { id: '6' })).toBe('/admin/staff?error=tgInactive');
    expect(named('issueStaffCode')).toHaveLength(1);
  });

  it('issueTelegramCode: boshqaruv boti tokeni kiritilmagan bo\'lsa kod berilmaydi (uni qabul qiladigan bot yo\'q)', async () => {
    vi.stubEnv('STAFF_BOT_TOKEN', '');
    expect(await run(staff.issueTelegramCode, { id: '5' })).toBe('/admin/staff?error=tgNoBot');
    expect(await run(staff.issueTelegramCode, { id: '6' })).toBe('/admin/staff?error=tgNoBot');
    // Xodim bo'lmagan yozuv uchun javob avvalgidek — bot holatidan qat'i nazar
    expect(await run(staff.issueTelegramCode, { id: '9' })).toBe('/admin/staff');
    expect(named('issueStaffCode')).toHaveLength(0);
    // Eski nomdagi kalit (SUPERVISOR_BOT_TOKEN) bilan ham bot sozlangan hisoblanadi
    vi.stubEnv('SUPERVISOR_BOT_TOKEN', '222:legacy-token');
    expect(await run(staff.issueTelegramCode, { id: '5' })).toBe('/admin/staff?code=042917&for=5');
    expect(named('issueStaffCode')).toEqual([['issueStaffCode', 5]]);
  });

  it('unlinkTelegram: faqat xodim yozuvlariga (mijoz akkauntiga emas)', async () => {
    expect(await run(staff.unlinkTelegram, { id: '6' })).toBe('/admin/staff?saved=1');
    expect(await run(staff.unlinkTelegram, { id: '9' })).toBe('/admin/staff');
    expect(named('unlinkStaff')).toEqual([['unlinkStaff', 6]]);
    expect(named('requireStaff').every((c) => c[1] === 'staff')).toBe(true);
  });

  it('updateStaff: "Telegram xabar" belgisi saqlanadi', async () => {
    await run(staff.updateStaff, { id: '5', role: 'manager', isActive: 'on', telegramNotify: 'on' });
    await run(staff.updateStaff, { id: '5', role: 'manager', isActive: 'on' });
    expect(named('setStaffNotify')).toEqual([['setStaffNotify', 5, true], ['setStaffNotify', 5, false]]);
  });
});
