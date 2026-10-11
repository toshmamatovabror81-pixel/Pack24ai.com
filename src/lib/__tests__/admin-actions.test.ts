import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Section } from '@/lib/auth/permissions';

/**
 * Admin panel amallari botlar poydevoriga to'g'ri ulanganini tekshiradi: buyurtma formasi orderFlow orqali ishlaydi (to'lov holatini
 * faqat moliya ruxsati bor xodim o'zgartiradi), hisob-faktura to'lovi va ishlab chiqarish bosqichi kerakli paytdagina xabar yuboradi,
 * Xodimlar sahifasidagi Telegram amallari faqat xodim yozuvlariga qo'llanadi. Baza xotirada; orderFlow, orderNotify va staffLink
 * chaqiruvlari `s.calls` ga, buyurtma / hisob-faktura / tarix jadvallariga murojaatlar tartibi `s.db` ga yoziladi.
 * Ruxsatlar jadvali (auth/permissions) haqiqiy: soxta requireStaff ham shu jadval bo'yicha kiritadi.
 */
const s = vi.hoisted(() => ({
  calls: [] as unknown[][],
  revalidated: [] as string[],
  // Amalni bajarayotgan xodim (requireStaff shuni qaytaradi): to'lov holatini o'zgartirish uning rolidagi "finance" ruxsatiga bog'liq
  user: { id: 1, name: 'Admin Ali', role: 'admin' as 'admin' | 'manager' | 'staff' },
  statusResult: null as unknown,
  paymentResult: null as unknown,
  orders: new Map<number, Record<string, unknown>>(),
  invoices: new Map<number, Record<string, unknown>>(),
  users: new Map<number, Record<string, unknown>>(),
  workOrders: new Map<number, Record<string, unknown>>(),
  stages: new Map<number, Record<string, unknown>>(),
  // Tarix yozuvlari (OrderEvent) — bazaga qanday berilgan bo'lsa shunday; `eventError` — yozuvni baza rad etgan holat
  events: [] as Record<string, unknown>[],
  eventError: null as Error | null,
  // Tartib: tranzaksiya chegaralari ("begin"/"commit"), tarix yozuvi va afterPaymentChange qaysi ketma-ketlikda bo'lgani
  steps: [] as string[],
  // Bazaga murojaatlar kelgan tartibda (tranzaksiya chegaralari bilan): qatorlar qaysi ketma-ketlikda qulflanishi va o'qilishi
  db: [] as string[],
  // Xom so'rovlar (qatorni qulflash — SELECT ... FOR UPDATE): matni (qiymatlar o'rnida "?"), bog'langan qiymatlari va so'rov
  // tranzaksiya mijozi orqali kelgani (`tx`) — qulf tranzaksiyadan tashqarida olinsa u so'rov tugashi bilan bo'shab, hech narsani himoyalamasdi
  locks: [] as { sql: string; values: unknown[]; tx: boolean }[],
  // Qulf olingan paytda bajariladi: amal qulfni kutib turganda boshqa xodimning tranzaksiyasi yakunlangan holat (qator o'zgargan)
  onLock: null as (() => void) | null,
}));

/** next/navigation redirect() xato tashlab chiqadi — testda manzilini shu xatodan olamiz */
class Redirect extends Error {
  constructor(public url: string) { super(`REDIRECT ${url}`); }
}

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { s.revalidated.push(p); } }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Redirect(url); } }));
vi.mock('@/lib/auth', async () => {
  // Haqiqiy requireStaff kabi: so'ralgan bo'limga ruxsati yo'q rol amalga kiritilmaydi (bosh sahifaga qaytariladi) — amal bazaga
  // tegishidan OLDIN ruxsat so'rashi shu bilan tekshiriladi. Kimga nima mumkinligini haqiqiy jadval hal qiladi
  const { can } = await import('@/lib/auth/permissions');
  return {
    requireStaff: async (section: Section) => {
      s.calls.push(['requireStaff', section]);
      if (!can(s.user.role, section)) throw new Redirect('/admin?denied=1');
      return { ...s.user };
    },
    hashPassword: async (p: string) => `h:${p}`,
  };
});
vi.mock('@/lib/orderFlow', async (importOriginal) => {
  // To'lov tarixi yozuvini haqiqiy writePaymentEvent yozadi (xotiradagi bazaga): hisob-faktura amali bergan surat bazaga aynan qanday
  // tushishi tekshiriladi — belgi bekor qilinganda orderFlow shu yozuvni o'qiydi. Qolganlari soxta (o'zi db/orderFlow.test.ts da)
  const real = await importOriginal<typeof import('@/lib/orderFlow')>();
  return {
    changeOrderStatus: async (...a: unknown[]) => { s.calls.push(['changeOrderStatus', ...a]); return s.statusResult; },
    setManualPayment: async (...a: unknown[]) => { s.calls.push(['setManualPayment', ...a]); return s.paymentResult; },
    afterPaymentChange: async (...a: unknown[]) => { s.steps.push('afterPaymentChange'); s.calls.push(['afterPaymentChange', ...a]); },
    writePaymentEvent: real.writePaymentEvent,
  };
});
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
  // Haqiqiysi kabi: mavjud bo'lsa o'shani (created: false), aks holda yangisini (created: true) qaytaradi
  ensureInvoiceForOrder: async (orderId: number) => {
    const existing = [...s.invoices.values()].find((i) => i.orderId === orderId && i.status !== 'cancelled');
    if (existing) return { invoice: existing, created: false };
    const inv = { id: 500, orderId, invoiceNo: 'INV-2026-0001', totalAmount: 100, dueDate: new Date(), status: 'issued' };
    s.invoices.set(500, inv);
    return { invoice: inv, created: true };
  },
}));
vi.mock('@/lib/db', () => {
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'not' in v) return row[k] !== (v as { not: unknown }).not;
      if (v && typeof v === 'object' && 'in' in v) return (v as { in: unknown[] }).in.includes(row[k]);
      if (v && typeof v === 'object' && 'notIn' in v) return !(v as { notIn: unknown[] }).notIn.includes(row[k]);
      return row[k] === v;
    });
  const prisma: Record<string, unknown> = {
    order: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        s.db.push('order.findFirst');
        return [...s.orders.values()].find((o) => matches(o, where)) ?? null;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        s.db.push('order.updateMany');
        const rows = [...s.orders.values()].filter((o) => matches(o, where));
        rows.forEach((o) => Object.assign(o, data));
        return { count: rows.length };
      },
    },
    contract: { findUnique: async () => { s.db.push('contract.findUnique'); return null; } },
    orderEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (s.eventError) throw s.eventError;
        s.steps.push('orderEvent.create');
        s.db.push('orderEvent.create');
        s.events.push(data);
        return { id: s.events.length, ...data };
      },
    },
    corporateInvoice: {
      findUnique: async ({ where }: { where: { id: number } }) => {
        s.db.push('corporateInvoice.findUnique');
        const i = s.invoices.get(where.id);
        return i ? { ...i, order: { ...s.orders.get(i.orderId as number) } } : null;
      },
      // Haqiqiy baza kabi: faqat so'ralgan ustunlar, o'qilgan paytdagi qiymatlari bilan (keyingi yozuv bu nusxani o'zgartirmaydi)
      findUniqueOrThrow: async ({ where, select }: { where: { id: number }; select?: Record<string, boolean> }) => {
        s.db.push('corporateInvoice.findUniqueOrThrow');
        const row = s.invoices.get(where.id);
        if (!row) throw new Error('test: hisob-faktura topilmadi');
        return select ? Object.fromEntries(Object.entries(row).filter(([k]) => select[k])) : { ...row };
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        s.db.push('corporateInvoice.findFirst');
        return [...s.invoices.values()].find((i) => matches(i, where)) ?? null;
      },
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        s.db.push('corporateInvoice.update');
        return Object.assign(s.invoices.get(where.id)!, data);
      },
      // Shartli yozuv: shart (buyurtmasiga qo'yilgani ham — `order`) xotiradagi hozirgi holatga solinadi; berilgan shart va
      // qiymatlarning o'zi `s.calls` da qoladi
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        s.db.push('corporateInvoice.updateMany');
        s.calls.push(['corporateInvoice.updateMany', args]);
        const { order: orderWhere, ...own } = args.where;
        const rows = [...s.invoices.values()].filter((i) => {
          const o = s.orders.get(i.orderId as number);
          return matches(i, own) && (!orderWhere || (!!o && matches(o, orderWhere as Record<string, unknown>)));
        });
        rows.forEach((i) => Object.assign(i, args.data));
        return { count: rows.length };
      },
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
  // Xom so'rov (teg-shablon): amallar uni faqat qatorni qulflash uchun ishlatadi. Haqiqiy bazada qulf band bo'lsa so'rov o'sha
  // tranzaksiya yakunlanguncha kutadi — `s.onLock` shu kutish paytida yakunlangan boshqa xodimning o'zgarishini qo'yadi
  const rawQuery = (tx: boolean) => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    s.db.push('$queryRaw');
    s.locks.push({ sql: strings.join('?'), values, tx });
    s.onLock?.();
    return [];
  };
  prisma.$queryRaw = rawQuery(false);
  // Tranzaksiya chegarasi `s.steps` ga yoziladi: ichidagi yozuv xato bersa "commit" bo'lmaydi (haqiqiy baza hammasini qaytaradi).
  // Amalga tranzaksiya mijozi beriladi: jadvallari o'sha, xom so'rovi esa tranzaksiya ichida kelganini belgilaydi (`s.locks[].tx`)
  prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => {
    s.steps.push('begin');
    s.db.push('begin');
    const result = await fn({ ...prisma, $queryRaw: rawQuery(true) });
    s.steps.push('commit');
    s.db.push('commit');
    return result;
  };
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
/** Bazaga murojaatlar (`s.db`) shu tartibda kelganini tekshiradi (orasida boshqasi bo'lishi mumkin); har biri aynan bir marta */
const expectDbOrder = (...ops: string[]) => {
  for (const op of ops) expect(s.db.filter((x) => x === op), `${op}: ${s.db.join(' > ')}`).toHaveLength(1);
  const at = ops.map((op) => s.db.indexOf(op));
  expect(at, s.db.join(' > ')).toEqual([...at].sort((a, b) => a - b));
};
type TestUser = typeof s.user;
const STAFF: TestUser = { id: 2, name: 'Xodim Vali', role: 'staff' };
const MANAGER: TestUser = { id: 3, name: 'Menejer Sora', role: 'manager' };
const ADMIN: TestUser = { id: 1, name: 'Admin Ali', role: 'admin' };

beforeEach(() => {
  s.calls.length = 0;
  s.revalidated.length = 0;
  s.user = { ...ADMIN };
  s.orders.clear();
  s.invoices.clear();
  s.users.clear();
  s.workOrders.clear();
  s.stages.clear();
  s.events.length = 0;
  s.eventError = null;
  s.steps.length = 0;
  s.db.length = 0;
  s.locks.length = 0;
  s.onLock = null;
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

// "To'landi" belgisi hisob-fakturani ham yopadi, bekor qilinishi esa uni qayta ochadi — shuning uchun to'lov holatini faqat "finance"
// (moliya) ruxsati bor xodim o'zgartiradi. Rollar haqiqiy jadvaldan: "staff" da buyurtmalar bor, moliya yo'q; "manager" va "admin" da bor
describe('admin: buyurtma formasi (updateOrder) — to\'lov holati faqat moliya ruxsati bilan', () => {
  const by = (user: { name: string }) => ({ name: user.name, via: 'admin' });

  it('moliya ruxsati yo\'q xodim to\'lovni o\'zgartirsa: to\'lov qo\'llanmaydi (error=finance), shu so\'rovdagi holat o\'zgarishi esa saqlanadi', async () => {
    s.user = STAFF;
    // Yangilanishdan oldin ochilgan sahifa yoki qo'lda yasalgan so'rov: xodimning yangi formasida to'lov maydoni yo'q
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'new_', paymentStatus: 'paid', prevPaymentStatus: 'pending' })).toBe('/admin/orders/12?error=finance');
    expect(named('requireStaff')).toEqual([['requireStaff', 'orders']]);
    expect(named('setManualPayment')).toHaveLength(0);
    expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'processing', by(STAFF), { expected: 'new_' }]]);
    expect(s.revalidated).toEqual(['/admin/orders/12']);
    // "Yetkazildi" ham to'liq qo'llanadi: ombor sahifasi yangilanadi, faqat to'lov rad etiladi
    s.calls.length = 0;
    s.revalidated.length = 0;
    s.statusResult = { ok: true, changed: true, order: { status: 'delivered' } };
    expect(await run(updateOrder, { id: '12', status: 'delivered', prevStatus: 'shipping', paymentStatus: 'paid', prevPaymentStatus: 'pending' })).toBe('/admin/orders/12?error=finance');
    expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'delivered', by(STAFF), { expected: 'shipping' }]]);
    expect(named('setManualPayment')).toHaveLength(0);
    expect(s.revalidated).toEqual(['/admin/inventory', '/admin/orders/12']);
  });

  it('moliya ruxsati yo\'q xodim: belgini bekor qilish va "qaytarilgan" ham rad etiladi — to\'lovning har qanday o\'zgarishi', async () => {
    s.user = STAFF;
    for (const [prevPaymentStatus, paymentStatus] of [['pending', 'paid'], ['paid', 'pending'], ['paid', 'refunded'], ['refunded', 'pending'], ['pending', 'refunded']]) {
      s.calls.length = 0;
      const name = `${prevPaymentStatus} -> ${paymentStatus}`;
      expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'processing', paymentStatus, prevPaymentStatus }), name).toBe('/admin/orders/12?error=finance');
      expect(named('setManualPayment'), name).toHaveLength(0);
      expect(named('changeOrderStatus'), name).toHaveLength(0);
    }
  });

  it('moliya ruxsati yo\'q xodimning formasi (to\'lov maydonlari umuman yo\'q): holat o\'zgarishi odatdagidek saqlanadi', async () => {
    s.user = STAFF;
    expect(await run(updateOrder, { id: '12', status: 'shipping', prevStatus: 'processing' })).toBe('/admin/orders/12?saved=1');
    expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'shipping', by(STAFF), { expected: 'processing' }]]);
    expect(named('setManualPayment')).toHaveLength(0);
    expect(s.revalidated).toEqual(['/admin/orders/12']);
    // Hech narsani o'zgartirmay "Saqlash" bosilsa ham ogohlantirish chiqmaydi
    s.calls.length = 0;
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'processing' })).toBe('/admin/orders/12?saved=1');
    expect(named('changeOrderStatus')).toHaveLength(0);
    expect(named('setManualPayment')).toHaveLength(0);
  });

  it('qo\'lda yasalgan so\'rov (prevPaymentStatus yo\'q): moliya ruxsati yo\'q xodimdan qabul qilinmaydi', async () => {
    s.user = STAFF;
    // prev* bo'lmasa maydon "o'zgartirilgan" sanaladi (ruxsati bor chaqiruvchida har doim qo'llanadi) — ruxsatsiz xodimda har doim rad
    for (const paymentStatus of ['paid', 'pending', 'refunded']) {
      s.calls.length = 0;
      expect(await run(updateOrder, { id: '12', status: 'new_', prevStatus: 'new_', paymentStatus }), paymentStatus).toBe('/admin/orders/12?error=finance');
      expect(named('setManualPayment'), paymentStatus).toHaveLength(0);
      expect(named('changeOrderStatus'), paymentStatus).toHaveLength(0);
    }
    // Holat bilan birga kelsa: holat qo'llanadi, to'lov — yo'q
    s.calls.length = 0;
    expect(await run(updateOrder, { id: '12', status: 'processing', paymentStatus: 'paid' })).toBe('/admin/orders/12?error=finance');
    expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'processing', by(STAFF)]]);
    expect(named('setManualPayment')).toHaveLength(0);
  });

  it('eski sahifadan kelgan so\'rov: to\'lovga tegilmagan bo\'lsa (tanlov forma ko\'rsatgan qiymatda) rad etilmaydi', async () => {
    s.user = STAFF;
    for (const paymentStatus of ['pending', 'paid', 'refunded']) {
      s.calls.length = 0;
      expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'new_', paymentStatus, prevPaymentStatus: paymentStatus }), paymentStatus).toBe('/admin/orders/12?saved=1');
      expect(named('changeOrderStatus'), paymentStatus).toHaveLength(1);
      expect(named('setManualPayment'), paymentStatus).toHaveLength(0);
    }
  });

  it.each<[string, TestUser]>([['menejer', MANAGER], ['administrator', ADMIN]])('%s: "to\'langan" -> "to\'lanmagan" (xato belgini bekor qilish) orderFlow\'ga { expected: "paid" } bilan boradi', async (_name, user) => {
    s.user = user;
    // orderFlow javobi: belgi bekor qilindi va u yopgan bitta hisob-faktura qayta ochildi — bu manzilga ham chiqadi (pastdagi testlar)
    s.paymentResult = { ok: true, changed: true, order: { paymentStatus: 'pending' }, reopened: 1, stillPaid: [] };
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'processing', paymentStatus: 'pending', prevPaymentStatus: 'paid' })).toBe('/admin/orders/12?saved=1&invoice=reopened');
    expect(named('requireStaff')).toEqual([['requireStaff', 'orders']]);
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'pending', by(user), { expected: 'paid' }]]);
    expect(named('changeOrderStatus')).toHaveLength(0);
    expect(s.revalidated).toEqual(['/admin/orders/12']);
    // Belgini qo'yish ham shu rollarda ishlaydi ("to'lanmagan" -> "to'langan"); orderFlow bu yo'nalishda hisob-faktura haqida hech narsa qaytarmaydi
    s.calls.length = 0;
    s.paymentResult = { ok: true, changed: true, order: { paymentStatus: 'paid' } };
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'processing', paymentStatus: 'paid', prevPaymentStatus: 'pending' })).toBe('/admin/orders/12?saved=1');
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'paid', by(user), { expected: 'pending' }]]);
  });

  it('prevPaidMark: forma ko\'rgan "to\'langan" belgisi orderFlow\'ga expectedMark bo\'lib boradi (eskirgan belgi — "conflict"); yaroqsiz qiymat e\'tiborsiz qoladi', async () => {
    s.user = MANAGER;
    const undo = { id: '12', status: 'processing', prevStatus: 'processing', paymentStatus: 'pending', prevPaymentStatus: 'paid' };
    expect(await run(updateOrder, { ...undo, prevPaidMark: '77' })).toBe('/admin/orders/12?saved=1');
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'pending', by(MANAGER), { expected: 'paid', expectedMark: 77 }]]);
    // 0 — tarixsiz (yangilanishdan oldingi) belgi: u ham tekshiriladi
    s.calls.length = 0;
    expect(await run(updateOrder, { ...undo, prevPaidMark: '0' })).toBe('/admin/orders/12?saved=1');
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'pending', by(MANAGER), { expected: 'paid', expectedMark: 0 }]]);
    // Forma ochiq turganda belgi bekor qilinib, haqiqiy to'lov bilan qayta qo'yilgan: holat yana "to'langan", lekin belgi boshqa — orderFlow "conflict"
    s.calls.length = 0;
    s.paymentResult = { ok: false, reason: 'conflict', order: { paymentStatus: 'paid' } };
    expect(await run(updateOrder, { ...undo, prevPaidMark: '77' })).toBe('/admin/orders/12?error=conflict');
    // Yaroqsiz qiymatlar: faqat holat tekshiriladi (avvalgidek)
    s.paymentResult = { ok: true, changed: true, order: { paymentStatus: 'pending' } };
    for (const bad of ['', 'abc', '-1', '1.5', '2147483648', '99999999999', '77x']) {
      s.calls.length = 0;
      expect(await run(updateOrder, { ...undo, prevPaidMark: bad }), bad).toBe('/admin/orders/12?saved=1');
      expect(named('setManualPayment'), bad).toEqual([['setManualPayment', 12, 'pending', by(MANAGER), { expected: 'paid' }]]);
    }
    // prevPaymentStatus siz (qo'lda yasalgan so'rov): belgi bo'lsa faqat u tekshiriladi
    s.calls.length = 0;
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'processing', paymentStatus: 'pending', prevPaidMark: '77' })).toBe('/admin/orders/12?saved=1');
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'pending', by(MANAGER), { expectedMark: 77 }]]);
  });

  // Belgi bekor qilinganda hisob-faktura bilan nima bo'lgani manzilga chiqadi — buyurtma sahifasi shunga qarab xabar ko'rsatadi
  // (pages.test.ts). Qiymatlarni orderFlow.setManualPayment hisoblaydi (db/orderFlow.test.ts): `reopened` — qayta ochilganlar soni,
  // `stillPaid` — belgi bekor qilingandan keyin ham "to'langan" turgan hisob-fakturalar raqamlari
  describe('belgi bekor qilinganda hisob-faktura natijasi manzilda', () => {
    const undo = { id: '12', status: 'processing', prevStatus: 'processing', paymentStatus: 'pending', prevPaymentStatus: 'paid' };
    const undone = (over: Record<string, unknown>) => ({ ok: true, changed: true, order: { paymentStatus: 'pending' }, ...over });
    beforeEach(() => {
      s.user = MANAGER;
    });

    it('hisob-faktura qayta ochilgan (reopened > 0): saved=1&invoice=reopened', async () => {
      for (const reopened of [1, 2]) {
        s.paymentResult = undone({ reopened, stillPaid: [] });
        expect(await run(updateOrder, undo), String(reopened)).toBe('/admin/orders/12?saved=1&invoice=reopened');
      }
      expect(s.revalidated).toEqual(['/admin/orders/12', '/admin/orders/12']);
    });

    it('hech biri ochilmagan, hisob-faktura "to\'langan" holida qolgan (stillPaid bo\'sh emas): saved=1&invoice=paid', async () => {
      // Masalan: belgi yangilanishdan oldin qo'yilgan (tarix yozuvida surat yo'q) yoki hisob-faktura alohida to'langan
      s.paymentResult = undone({ reopened: 0, stillPaid: ['INV-2026-0007'] });
      expect(await run(updateOrder, undo)).toBe('/admin/orders/12?saved=1&invoice=paid');
      s.paymentResult = undone({ reopened: 0, stillPaid: ['INV-2026-0007', 'INV-2026-0008'] });
      expect(await run(updateOrder, undo)).toBe('/admin/orders/12?saved=1&invoice=paid');
    });

    it('biri qayta ochilgan, boshqasi "to\'langan" qolgan: manzilda invoice=reopened (bitta qiymat — qayta ochilgani ustun)', async () => {
      s.paymentResult = undone({ reopened: 1, stillPaid: ['INV-2026-0008'] });
      expect(await run(updateOrder, undo)).toBe('/admin/orders/12?saved=1&invoice=reopened');
    });

    it('hisob-fakturasi yo\'q buyurtma (reopened 0, stillPaid bo\'sh): manzilda faqat saved=1', async () => {
      s.paymentResult = undone({ reopened: 0, stillPaid: [] });
      expect(await run(updateOrder, undo)).toBe('/admin/orders/12?saved=1');
    });

    it('"to\'lanmagan" -> "to\'langan" va "qaytarilgan": orderFlow hisob-faktura natijasini qaytarmaydi — manzilda invoice yo\'q', async () => {
      for (const [prevPaymentStatus, paymentStatus] of [['pending', 'paid'], ['pending', 'refunded'], ['paid', 'refunded'], ['refunded', 'paid']]) {
        s.calls.length = 0;
        s.paymentResult = { ok: true, changed: true, order: { paymentStatus } };
        const name = `${prevPaymentStatus} -> ${paymentStatus}`;
        expect(await run(updateOrder, { ...undo, paymentStatus, prevPaymentStatus }), name).toBe('/admin/orders/12?saved=1');
        expect(named('setManualPayment'), name).toEqual([['setManualPayment', 12, paymentStatus, by(MANAGER), { expected: prevPaymentStatus }]]);
      }
    });

    it('to\'lov yozilmagan (belgi allaqachon bekor qilingan, ziddiyat yoki onlayn to\'lov): manzilda invoice yo\'q', async () => {
      s.paymentResult = { ok: true, changed: false, order: { paymentStatus: 'pending' } };
      expect(await run(updateOrder, undo)).toBe('/admin/orders/12?saved=1');
      s.paymentResult = { ok: false, reason: 'conflict', order: { paymentStatus: 'refunded' } };
      expect(await run(updateOrder, undo)).toBe('/admin/orders/12?error=conflict');
      s.paymentResult = { ok: false, reason: 'online', order: { paymentStatus: 'paid' } };
      expect(await run(updateOrder, undo)).toBe('/admin/orders/12?saved=1');
    });

    // "Qaytarilgan" -> "to'lanmagan" ham hisob-fakturani qayta ochadi (orderFlow): forma uni xuddi shunday uzatadi va natijani ko'rsatadi
    it.each<[string, TestUser]>([['menejer', MANAGER], ['administrator', ADMIN]])('%s: "qaytarilgan" -> "to\'lanmagan" orderFlow\'ga { expected: "refunded" } bilan boradi, natija manzilda', async (_name, user) => {
      s.user = user;
      const fromRefunded = { ...undo, prevPaymentStatus: 'refunded' };
      s.paymentResult = undone({ reopened: 1, stillPaid: [] });
      expect(await run(updateOrder, fromRefunded)).toBe('/admin/orders/12?saved=1&invoice=reopened');
      expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'pending', by(user), { expected: 'refunded' }]]);
      expect(named('changeOrderStatus')).toHaveLength(0);
      s.paymentResult = undone({ reopened: 0, stillPaid: ['INV-2026-0007'] });
      expect(await run(updateOrder, fromRefunded)).toBe('/admin/orders/12?saved=1&invoice=paid');
    });

    it('holat ham shu so\'rovda o\'zgargan: ikkalasi qo\'llanadi, hisob-faktura natijasi manzilda qoladi', async () => {
      s.statusResult = { ok: true, changed: true, order: { status: 'delivered' } };
      s.paymentResult = undone({ reopened: 0, stillPaid: ['INV-2026-0007'] });
      expect(await run(updateOrder, { ...undo, status: 'delivered', prevStatus: 'shipping' })).toBe('/admin/orders/12?saved=1&invoice=paid');
      expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'delivered', by(MANAGER), { expected: 'shipping' }]]);
      expect(s.revalidated).toEqual(['/admin/inventory', '/admin/orders/12']);
    });

    // Holat va to'lov bir-biridan mustaqil qo'llanadi: holat eskirgan ("conflict") bo'lsa ham shu so'rovdagi belgi bekor qilinadi.
    // Hisob-faktura natijasi o'shanda ham manzilda qoladi — aks holda xodim "to'langan holida qoldi" ogohlantirishini ko'rmay qolardi
    describe('holat ziddiyatga uchragan so\'rovda (error=conflict)', () => {
      // Sahifa buyurtma "Yangi" va "to'langan" paytida ochilgan; shu orada bot holatni "Yo'lda" qilgan — holat yozilmaydi, belgi bekor qilinadi
      const stale = { ...undo, status: 'processing', prevStatus: 'new_' };
      beforeEach(() => {
        s.statusResult = { ok: false, reason: 'conflict', order: { status: 'shipping' } };
      });

      it('belgi bekor qilingan, hisob-faktura "to\'langan" holida qolgan: error=conflict&invoice=paid', async () => {
        s.paymentResult = undone({ reopened: 0, stillPaid: ['INV-2026-0007'] });
        expect(await run(updateOrder, stale)).toBe('/admin/orders/12?error=conflict&invoice=paid');
        // Ikkala amal ham chaqirilgan: holat ziddiyati to'lov o'zgarishini to'xtatmaydi
        expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'processing', by(MANAGER), { expected: 'new_' }]]);
        expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'pending', by(MANAGER), { expected: 'paid' }]]);
        expect(s.revalidated).toEqual(['/admin/orders/12']);
        // "Qaytarilgan"dan qaytarilganda ham shunday
        s.calls.length = 0;
        expect(await run(updateOrder, { ...stale, prevPaymentStatus: 'refunded' })).toBe('/admin/orders/12?error=conflict&invoice=paid');
        expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'pending', by(MANAGER), { expected: 'refunded' }]]);
      });

      it('belgi bekor qilingan, hisob-faktura qayta ochilgan: error=conflict&invoice=reopened (biri ochilib, boshqasi "to\'langan" qolsa ham)', async () => {
        s.paymentResult = undone({ reopened: 1, stillPaid: [] });
        expect(await run(updateOrder, stale)).toBe('/admin/orders/12?error=conflict&invoice=reopened');
        expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'pending', by(MANAGER), { expected: 'paid' }]]);
        expect(s.revalidated).toEqual(['/admin/orders/12']);
        s.paymentResult = undone({ reopened: 1, stillPaid: ['INV-2026-0008'] });
        expect(await run(updateOrder, stale)).toBe('/admin/orders/12?error=conflict&invoice=reopened');
        s.paymentResult = undone({ reopened: 2, stillPaid: [] });
        expect(await run(updateOrder, { ...stale, prevPaymentStatus: 'refunded' })).toBe('/admin/orders/12?error=conflict&invoice=reopened');
      });

      it('hisob-faktura natijasi bo\'lmasa manzil aynan error=conflict — ortiqcha hech narsa qo\'shilmaydi', async () => {
        const cases: [string, unknown, Record<string, string>][] = [
          ['hisob-fakturasi yo\'q buyurtmaning belgisi bekor qilingan', undone({ reopened: 0, stillPaid: [] }), stale],
          ['belgi allaqachon bekor qilingan (o\'zgarmadi)', { ok: true, changed: false, order: { paymentStatus: 'pending' } }, stale],
          ['to\'lov ham eskirgan', { ok: false, reason: 'conflict', order: { paymentStatus: 'refunded' } }, stale],
          ['onlayn to\'lov', { ok: false, reason: 'online', order: { paymentStatus: 'paid' } }, stale],
          // Belgini qo'yish va "qaytarilgan": orderFlow hisob-faktura natijasini qaytarmaydi
          ['"to\'lanmagan" -> "to\'langan"', { ok: true, changed: true, order: { paymentStatus: 'paid' } }, { ...stale, paymentStatus: 'paid', prevPaymentStatus: 'pending' }],
          ['"to\'langan" -> "qaytarilgan"', { ok: true, changed: true, order: { paymentStatus: 'refunded' } }, { ...stale, paymentStatus: 'refunded' }],
        ];
        for (const [name, paymentResult, fields] of cases) {
          s.calls.length = 0;
          s.paymentResult = paymentResult;
          expect(await run(updateOrder, fields), name).toBe('/admin/orders/12?error=conflict');
          expect(named('setManualPayment'), name).toHaveLength(1);
        }
        // To'lovga tegilmagan (forma ko'rsatgan qiymatda qolgan): setManualPayment chaqirilmaydi — oldingi natija manzilga o'tib qolmaydi
        s.calls.length = 0;
        s.paymentResult = undone({ reopened: 1, stillPaid: ['INV-2026-0008'] });
        expect(await run(updateOrder, { ...stale, paymentStatus: 'paid' })).toBe('/admin/orders/12?error=conflict');
        expect(named('setManualPayment')).toHaveLength(0);
      });

      it('moliya ruxsati yo\'q xodim: belgi bekor qilinmagan, manzilda invoice yo\'q — holat ziddiyati bilan error=conflict&denied=1, aks holda error=finance', async () => {
        s.user = STAFF;
        // orderFlow javobi tayyor tursa ham unga yetib borilmaydi
        s.paymentResult = undone({ reopened: 1, stillPaid: ['INV-2026-0008'] });
        expect(await run(updateOrder, stale)).toBe('/admin/orders/12?error=conflict&denied=1');
        expect(named('setManualPayment')).toHaveLength(0);
        expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'processing', by(STAFF), { expected: 'new_' }]]);
        // Holat ziddiyatsiz saqlanganda ham, faqat to'lov o'zgartirilganda ham shunday
        s.statusResult = { ok: true, changed: true, order: { status: 'processing' } };
        expect(await run(updateOrder, stale)).toBe('/admin/orders/12?error=finance');
        expect(await run(updateOrder, undo)).toBe('/admin/orders/12?error=finance');
        expect(named('setManualPayment')).toHaveLength(0);
      });
    });
  });

  it('belgini bekor qilish eskirgan formadan: orderFlow "conflict" qaytarsa ogohlantirish; allaqachon bekor qilingan bo\'lsa — ziddiyat emas', async () => {
    s.user = MANAGER;
    // Sahifa buyurtma "to'langan" paytida ochilgan; shu orada boshqa xodim uni "qaytarilgan" qilgan — ustidan yozilmaydi
    s.paymentResult = { ok: false, reason: 'conflict', order: { paymentStatus: 'refunded' } };
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'processing', paymentStatus: 'pending', prevPaymentStatus: 'paid' })).toBe('/admin/orders/12?error=conflict');
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'pending', by(MANAGER), { expected: 'paid' }]]);
    expect(s.revalidated).toEqual(['/admin/orders/12']);
    // Belgini boshqa xodim (yoki bot) allaqachon bekor qilgan: orderFlow "o'zgarmadi" deydi
    s.paymentResult = { ok: true, changed: false, order: { paymentStatus: 'pending' } };
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'processing', paymentStatus: 'pending', prevPaymentStatus: 'paid' })).toBe('/admin/orders/12?saved=1');
  });

  it('ruxsat yo\'qligi ziddiyatni yutmaydi: holat eskirgan ("conflict") bo\'lsa manzilda error=conflict&denied=1 — sahifada ikkala ogohlantirish (holat ham saqlanmagan)', async () => {
    s.user = STAFF;
    s.statusResult = { ok: false, reason: 'conflict', order: { status: 'shipping' } };
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'new_', paymentStatus: 'paid', prevPaymentStatus: 'pending' })).toBe('/admin/orders/12?error=conflict&denied=1');
    expect(named('changeOrderStatus')).toEqual([['changeOrderStatus', 12, 'processing', by(STAFF), { expected: 'new_' }]]);
    expect(named('setManualPayment')).toHaveLength(0);
    // Ruxsati bor xodimda xuddi shu so'rov: to'lov qo'llanadi, holat ziddiyati esa ogohlantirish bo'lib chiqadi
    s.calls.length = 0;
    s.user = MANAGER;
    expect(await run(updateOrder, { id: '12', status: 'processing', prevStatus: 'new_', paymentStatus: 'paid', prevPaymentStatus: 'pending' })).toBe('/admin/orders/12?error=conflict');
    expect(named('setManualPayment')).toEqual([['setManualPayment', 12, 'paid', by(MANAGER), { expected: 'pending' }]]);
  });

  it('buyurtma topilmasa (o\'chirilgan) — ro\'yxatga: to\'lov yo\'lida ham, ruxsatsiz xodimning holat o\'zgarishida ham', async () => {
    s.user = MANAGER;
    s.paymentResult = { ok: false, reason: 'not_found' };
    expect(await run(updateOrder, { id: '13', status: 'processing', prevStatus: 'processing', paymentStatus: 'pending', prevPaymentStatus: 'paid' })).toBe('/admin/orders');
    expect(named('setManualPayment')).toEqual([['setManualPayment', 13, 'pending', by(MANAGER), { expected: 'paid' }]]);
    expect(s.revalidated).toEqual([]);
    // Ruxsatsiz xodim: "topilmadi" javobini holat o'zgarishi beradi — manzil error=finance emas
    s.calls.length = 0;
    s.user = STAFF;
    s.statusResult = { ok: false, reason: 'not_found' };
    expect(await run(updateOrder, { id: '13', status: 'processing', prevStatus: 'new_', paymentStatus: 'paid', prevPaymentStatus: 'pending' })).toBe('/admin/orders');
    expect(named('setManualPayment')).toHaveLength(0);
    expect(s.revalidated).toEqual([]);
  });
});

describe('admin: hisob-faktura amallari', () => {
  const order = (over: Record<string, unknown> = {}) => ({ id: 7, paymentMethod: 'bank_transfer', status: 'processing', paymentStatus: 'pending', totalAmount: 100, accessToken: 't', telegramUserId: null, contactPhone: '998901234567', userId: null, deletedAt: null, ...over });
  const invoice = (over: Record<string, unknown> = {}) => ({ id: 3, orderId: 7, invoiceNo: 'INV-1', totalAmount: 100, paidAmount: 0, paidAt: null, status: 'issued', createdAt: new Date(), ...over });
  /** Hisob-faktura sahifasidan yozilgan "to'langan" tarix yozuvi (`meta` — faqat yopilgan hisob-fakturaning surati bo'lsa) */
  const paidEvent = (over: Record<string, unknown> = {}) => ({ orderId: 7, kind: 'payment', fromValue: 'pending', toValue: 'paid', actor: 'Admin Ali', via: 'invoice', ...over });
  /** Buyurtma + hisob-faktura + tarix yozuvi bitta tranzaksiyada; mijozga va xodimlarga xabar — faqat u yakunlangach */
  const IN_ONE_TRANSACTION = ['begin', 'orderEvent.create', 'commit', 'afterPaymentChange'];

  it('markPaid: bank o\'tkazmali buyurtma bir marta "to\'langan" bo\'ladi va tarixga yoziladi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice());
    expect(await run(invoices.markPaid, { id: '3' })).toBe('/admin/invoices/3?saved=1');
    expect(s.invoices.get(3)!.status).toBe('paid');
    expect(s.orders.get(7)!.paymentStatus).toBe('paid');
    // Tarix yozuvi hisob-fakturaning yopilishdan OLDINGI holati bilan: buyurtmadagi "to'landi" belgisi keyin bekor qilinsa
    // (buyurtma sahifasi yoki bot) orderFlow hisob-fakturani aynan shu suratga qaytaradi
    expect(s.events).toEqual([paidEvent({ meta: { invoices: [{ id: 3, status: 'issued', paidAmount: '0', paidAt: null }] } })]);
    expect(s.steps).toEqual(IN_ONE_TRANSACTION);
    const calls = named('afterPaymentChange');
    expect(calls).toHaveLength(1);
    expect((calls[0][1] as Record<string, unknown>).paymentStatus).toBe('paid');
    expect((calls[0][1] as Record<string, unknown>).id).toBe(7);
    expect(calls[0][2]).toBe('pending');
    expect(calls[0][3]).toEqual({ name: 'Admin Ali', via: 'invoice' });
    // Tarix tranzaksiyada yozib bo'lingan — afterPaymentChange uni ikkinchi marta yozmaydi (xodimlarga xabar o'chirilmagan)
    expect(calls[0][4]).toEqual({ event: false });
    await run(invoices.markPaid, { id: '3' });
    expect(named('afterPaymentChange')).toHaveLength(1);
    expect(s.events).toHaveLength(1);
  });

  it('markPaid: naqd yoki onlayn to\'lovli buyurtmaga tegmaydi', async () => {
    for (const paymentMethod of ['cash', 'payme', 'click']) {
      s.steps.length = 0;
      s.orders.set(7, order({ paymentMethod }));
      s.invoices.set(3, invoice());
      await run(invoices.markPaid, { id: '3' });
      expect(s.invoices.get(3)!.status, paymentMethod).toBe('paid');
      expect(s.orders.get(7)!.paymentStatus, paymentMethod).toBe('pending');
      expect(named('afterPaymentChange'), paymentMethod).toHaveLength(0);
      // Buyurtma o'zgarmagan — tarixga ham hech narsa yozilmaydi
      expect(s.events, paymentMethod).toEqual([]);
      expect(s.steps, paymentMethod).toEqual(['begin', 'commit']);
    }
  });

  it('markPaid: buyurtma allaqachon "to\'langan" bo\'lsa hisob-faktura yopiladi, tarix va xabar esa takrorlanmaydi', async () => {
    // Masalan: buyurtma botda "to'landi" qilingan, hisob-faktura undan keyin yaratilgan
    s.orders.set(7, order({ paymentStatus: 'paid' }));
    s.invoices.set(3, invoice());
    expect(await run(invoices.markPaid, { id: '3' })).toBe('/admin/invoices/3?saved=1');
    expect(s.invoices.get(3)).toMatchObject({ status: 'paid', paidAmount: 100 });
    expect(s.events).toEqual([]);
    expect(named('afterPaymentChange')).toHaveLength(0);
    expect(s.steps).toEqual(['begin', 'commit']);
  });

  // Suratni keyin orderFlow o'qiydi (belgi bekor qilinganda): summa satr, sana ISO ko'rinishida bo'lmasa u yozuvni tashlab ketadi.
  // Bazadan summa Decimal, sana Date bo'lib keladi — JSON ustunga shu ko'rinishda tushmasligi kerak
  it.each(['issued', 'partial', 'overdue'])('markPaid: "%s" hisob-fakturaning avvalgi holati suratga tushadi (summa — satr, sana — ISO yoki null)', async (status) => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice({ status, totalAmount: new Prisma.Decimal('1250000.50'), paidAmount: new Prisma.Decimal('400000.50'), paidAt: new Date('2026-09-30T19:00:00.000Z') }));
    await run(invoices.markPaid, { id: '3' });
    expect(s.events).toEqual([paidEvent({ meta: { invoices: [{ id: 3, status, paidAmount: '400000.5', paidAt: '2026-09-30T19:00:00.000Z' }] } })]);
    expect(s.steps).toEqual(IN_ONE_TRANSACTION);
    // Sana yo'q (hali hech narsa to'lanmagan) — null; summa baribir satr
    s.events.length = 0;
    s.orders.set(7, order());
    s.invoices.set(3, invoice({ status, paidAmount: new Prisma.Decimal('0.00') }));
    await run(invoices.markPaid, { id: '3' });
    const [snapshot] = (s.events[0].meta as { invoices: Record<string, unknown>[] }).invoices;
    expect(snapshot).toEqual({ id: 3, status, paidAmount: '0', paidAt: null });
    expect(snapshot.paidAmount).toBeTypeOf('string');
  });

  it('markPaid: hisob-faktura allaqachon "to\'langan" bo\'lsa surat yozilmaydi (qayta ochadigan narsa yo\'q), tarix esa yoziladi', async () => {
    // Buyurtma hisob-faktura orqali to'langan, keyin buyurtma sahifasida "qaytarilgan" qilingan; hisob-faktura yopiqligicha qolgan
    s.orders.set(7, order({ paymentStatus: 'refunded' }));
    s.invoices.set(3, invoice({ status: 'paid', paidAmount: 100, paidAt: new Date('2026-10-01T05:00:00.000Z') }));
    expect(await run(invoices.markPaid, { id: '3' })).toBe('/admin/invoices/3?saved=1');
    expect(s.orders.get(7)!.paymentStatus).toBe('paid');
    // `meta` kaliti umuman yo'q: bu belgi bekor qilinsa hisob-faktura "to'langan"ligicha qoladi
    expect(s.events).toEqual([paidEvent({ fromValue: 'refunded' })]);
    expect(s.events[0]).not.toHaveProperty('meta');
    expect(named('afterPaymentChange')).toHaveLength(1);
    expect(named('afterPaymentChange')[0].slice(2)).toEqual(['refunded', { name: 'Admin Ali', via: 'invoice' }, { event: false }]);
  });

  it('markPaid: bekor qilingan hisob-faktura — hech narsa yozilmaydi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice({ status: 'cancelled' }));
    expect(await run(invoices.markPaid, { id: '3' })).toBe('/admin/invoices/3?error=state');
    expect(s.invoices.get(3)!.status).toBe('cancelled');
    expect(s.orders.get(7)!.paymentStatus).toBe('pending');
    expect(s.events).toEqual([]);
    expect(s.steps).toEqual([]);
  });

  it('markPaid: tarix yozuvini baza rad etsa amal xato bilan to\'xtaydi — tranzaksiya yakunlanmaydi, xabar ketmaydi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice());
    s.eventError = new Error('test: OrderEvent yozilmadi');
    // Xato yutib yuborilmaydi: tranzaksiya ichida bo'lgani uchun haqiqiy baza buyurtma va hisob-faktura o'zgarishini ham qaytaradi;
    // surati yo'q "to'langan" belgisi bazada qolmaydi (uni bekor qilganda hisob-faktura ochilmay qolardi)
    await expect(run(invoices.markPaid, { id: '3' })).rejects.toThrow('test: OrderEvent yozilmadi');
    expect(s.steps).toEqual(['begin']);
    expect(named('afterPaymentChange')).toHaveLength(0);
    expect(s.revalidated).toEqual([]);
  });

  // Sahifa ko'rsatgan holat (amal boshida o'qilgan) qulflangan qatordagidan farq qilsa — eskirgan sahifa: hech narsa yozilmaydi (error=stale).
  // Aks holda sahifadagi eskirgan hisobdan chiqqan summa orada kiritilgan to'lovning ustidan yozilib, u jimgina yo'qolardi
  it('markPaid: qulfni kutganda boshqa xodim qisman to\'lov kiritgan — eskirgan sahifa rad etiladi: hisob-faktura, tarix o\'zgarmaydi, xabar ketmaydi, tranzaksiya yakunlanmaydi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice({ totalAmount: new Prisma.Decimal('1250000.00') }));
    // Amal hisob-fakturani "berilgan, 0" deb o'qidi; qulfni kutayotganda boshqa moliya xodimining 300 000 so'mlik qisman to'lovi yakunlandi
    s.onLock = () => { Object.assign(s.invoices.get(3)!, { status: 'partial', paidAmount: new Prisma.Decimal('300000.00') }); };
    expect(await run(invoices.markPaid, { id: '3' })).toBe('/admin/invoices/3?error=stale');
    expect(s.invoices.get(3)!.status).toBe('partial');
    expect(String(s.invoices.get(3)!.paidAmount)).toBe('300000');
    expect(s.db).not.toContain('corporateInvoice.update');
    expect(s.events).toEqual([]);
    expect(named('afterPaymentChange')).toHaveLength(0);
    // Tranzaksiya xato bilan to'xtaydi (commit yo'q): haqiqiy baza buyurtma yozuvini ham qaytaradi (db/orderFlow.test.ts)
    expect(s.steps).toEqual(['begin']);
    expect(s.revalidated).toEqual([]);
    // Holat o'sha-o'sha, faqat summa farq qilsa ham eskirgan
    s.invoices.set(3, invoice({ status: 'partial', paidAmount: 40 }));
    s.orders.set(7, order());
    s.onLock = () => { Object.assign(s.invoices.get(3)!, { paidAmount: 50 }); };
    expect(await run(invoices.markPaid, { id: '3' })).toBe('/admin/invoices/3?error=stale');
    expect(s.events).toEqual([]);
  });

  it('markPaid: qulflangan qator allaqachon "to\'langan" (boshqa tranzaksiya yopgan) — eskirgan sahifa: tarix va xabar takrorlanmaydi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice());
    // Amal boshida "berilgan, 0" deb o'qilgan hisob-faktura qulf olinganda allaqachon to'liq to'langan
    s.onLock = () => { Object.assign(s.invoices.get(3)!, { status: 'paid', paidAmount: 100, paidAt: new Date('2026-10-01T05:00:00.000Z') }); };
    expect(await run(invoices.markPaid, { id: '3' })).toBe('/admin/invoices/3?error=stale');
    expect(s.events).toEqual([]);
    expect(named('afterPaymentChange')).toHaveLength(0);
    expect(s.steps).toEqual(['begin']);
  });

  it('markPaid: qulflangan qator sahifadagi bilan bir xil bo\'lsa (faqat paidAt yoki boshqa ustun farq qilsa ham) odatdagidek yoziladi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice({ status: 'partial', paidAmount: 40 }));
    s.onLock = () => { Object.assign(s.invoices.get(3)!, { dueDate: new Date('2026-12-01T00:00:00.000Z') }); };
    expect(await run(invoices.markPaid, { id: '3' })).toBe('/admin/invoices/3?saved=1');
    expect(s.events).toEqual([paidEvent({ meta: { invoices: [{ id: 3, status: 'partial', paidAmount: '40', paidAt: null }] } })]);
    expect(s.steps).toEqual(IN_ONE_TRANSACTION);
  });

  // Qulflash tartibi orderFlow.setManualPayment bilan bir xil (avval buyurtma qatori, keyin hisob-faktura): teskari tartibda ikki xodim
  // bir vaqtda shu buyurtmani "to'landi" qilsa baza o'zaro qulflanish (deadlock) deb birini bekor qilardi. Holat faqat qulfdan keyin o'qiladi
  it.each(['bank_transfer', 'cash'])('markPaid (%s): avval buyurtma yoziladi, keyin hisob-faktura qatori qulflanadi; holati qulfdan keyin o\'qiladi, undan keyin yoziladi', async (paymentMethod) => {
    s.orders.set(7, order({ paymentMethod }));
    s.invoices.set(3, invoice());
    await run(invoices.markPaid, { id: '3' });
    // Aynan shu hisob-faktura qatori qulflanadi; raqami so'rov matniga qo'shib yozilmaydi — bog'langan qiymat bo'lib beriladi
    expect(s.locks).toHaveLength(1);
    expect(s.locks[0].sql).toMatch(/FROM "CorporateInvoice" WHERE "id" = \? FOR UPDATE\s*$/);
    expect(s.locks[0].values).toEqual([3]);
    expect(s.locks[0].tx).toBe(true);
    // Hammasi tranzaksiya ichida: qulf tranzaksiya yakunlanguncha ushlab turiladi
    expectDbOrder('begin', 'order.updateMany', '$queryRaw', 'corporateInvoice.findUniqueOrThrow', 'corporateInvoice.update', 'commit');
    // Tarix yozuvi (bank o'tkazmasida) qulflab o'qilgan holatdan yasaladi
    if (paymentMethod === 'bank_transfer') expectDbOrder('corporateInvoice.findUniqueOrThrow', 'orderEvent.create', 'commit');
    else expect(s.db).not.toContain('orderEvent.create');
  });

  it('registerPartial: oraliq qisman to\'lovda buyurtma yozilmaydi, hisob-faktura qatori esa baribir qulflanadi (o\'qish va yozuvdan oldin)', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice());
    await run(invoices.registerPartial, { id: '3', amount: '40' });
    expect(s.db).not.toContain('order.updateMany');
    expect(s.locks.map((l) => l.values)).toEqual([[3]]);
    expect(s.locks[0].sql).toMatch(/FROM "CorporateInvoice" WHERE "id" = \? FOR UPDATE\s*$/);
    expect(s.locks[0].tx).toBe(true);
    expectDbOrder('begin', '$queryRaw', 'corporateInvoice.findUniqueOrThrow', 'corporateInvoice.update', 'commit');
  });

  it('registerPartial: qisman to\'lovda jim, oxirgi to\'lov buyurtmani "to\'langan" qiladi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice());
    expect(await run(invoices.registerPartial, { id: '3', amount: '40' })).toBe('/admin/invoices/3?saved=1');
    expect(s.invoices.get(3)!.status).toBe('partial');
    expect(s.orders.get(7)!.paymentStatus).toBe('pending');
    expect(named('afterPaymentChange')).toHaveLength(0);
    // Buyurtma hali "to'langan" emas — tarixga hech narsa yozilmaydi
    expect(s.events).toEqual([]);
    expect(s.steps).toEqual(['begin', 'commit']);
    s.steps.length = 0;
    await run(invoices.registerPartial, { id: '3', amount: '60' });
    expect(s.invoices.get(3)!.status).toBe('paid');
    expect(s.orders.get(7)!.paymentStatus).toBe('paid');
    expect(named('afterPaymentChange')).toHaveLength(1);
    expect(named('afterPaymentChange')[0][2]).toBe('pending');
    expect(named('afterPaymentChange')[0][3]).toEqual({ name: 'Admin Ali', via: 'invoice' });
    expect(named('afterPaymentChange')[0][4]).toEqual({ event: false });
    // Surat — oxirgi to'lovdan OLDINGI holat: belgi bekor qilinsa hisob-faktura "qisman to'langan, 40" ga qaytadi
    expect(s.events).toEqual([paidEvent({ meta: { invoices: [{ id: 3, status: 'partial', paidAmount: '40', paidAt: null }] } })]);
    expect(s.steps).toEqual(IN_ONE_TRANSACTION);
  });

  it('registerPartial: bir yo\'la to\'liq summa — surat "berilgan, 0"; kasrli summa ham satr bo\'lib yoziladi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice());
    await run(invoices.registerPartial, { id: '3', amount: '100' });
    expect(s.invoices.get(3)).toMatchObject({ status: 'paid', paidAmount: 100 });
    expect(s.events).toEqual([paidEvent({ meta: { invoices: [{ id: 3, status: 'issued', paidAmount: '0', paidAt: null }] } })]);
    // Bazadagi kabi Decimal: 1 250 000,50 dan 400 000,25 to'langan, qoldiq 850 000,25 kiritiladi
    s.events.length = 0;
    s.orders.set(7, order());
    s.invoices.set(3, invoice({ status: 'partial', totalAmount: new Prisma.Decimal('1250000.50'), paidAmount: new Prisma.Decimal('400000.25') }));
    expect(await run(invoices.registerPartial, { id: '3', amount: '850000.25' })).toBe('/admin/invoices/3?saved=1');
    expect(s.invoices.get(3)).toMatchObject({ status: 'paid', paidAmount: 1250000.5 });
    expect(s.orders.get(7)!.paymentStatus).toBe('paid');
    expect(s.events).toEqual([paidEvent({ meta: { invoices: [{ id: 3, status: 'partial', paidAmount: '400000.25', paidAt: null }] } })]);
  });

  it('registerPartial: ikki moliya xodimi bir vaqtda qisman to\'lov kiritsa ikkinchisi rad etiladi (error=stale) — birinchisining summasi ustidan yozilmaydi; yangilangan sahifadan qo\'shiladi', async () => {
    s.orders.set(7, order({ totalAmount: 1000000 }));
    s.invoices.set(3, invoice({ totalAmount: 1000000 }));
    // B amali hisob-fakturani "berilgan, 0" deb o'qidi; qulfni kutganda A ning 400 000 so'mi yakunlandi
    s.onLock = () => { Object.assign(s.invoices.get(3)!, { status: 'partial', paidAmount: 400000 }); };
    expect(await run(invoices.registerPartial, { id: '3', amount: '300000' })).toBe('/admin/invoices/3?error=stale');
    expect(s.invoices.get(3)).toMatchObject({ status: 'partial', paidAmount: 400000 });
    expect(s.db).not.toContain('corporateInvoice.update');
    expect(s.steps).toEqual(['begin']);
    expect(s.revalidated).toEqual([]);
    // Sahifa yangilangach (400 000 ko'rinib turadi) 300 000 unga qo'shiladi
    s.onLock = null;
    s.steps.length = 0;
    s.db.length = 0;
    expect(await run(invoices.registerPartial, { id: '3', amount: '300000' })).toBe('/admin/invoices/3?saved=1');
    expect(s.invoices.get(3)).toMatchObject({ status: 'partial', paidAmount: 700000 });
    expect(s.orders.get(7)!.paymentStatus).toBe('pending');
    expect(s.events).toEqual([]);
    // Oxirgi to'lov (eskirmagan sahifadan): buyurtma "to'langan", surat — oxirgi to'lovdan oldingi holat
    expect(await run(invoices.registerPartial, { id: '3', amount: '300000' })).toBe('/admin/invoices/3?saved=1');
    expect(s.orders.get(7)!.paymentStatus).toBe('paid');
    expect(s.events).toEqual([paidEvent({ meta: { invoices: [{ id: 3, status: 'partial', paidAmount: '700000', paidAt: null }] } })]);
  });

  it('registerPartial: qoldiqdan ortiq summa qabul qilinmaydi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice({ paidAmount: 40, status: 'partial' }));
    expect(await run(invoices.registerPartial, { id: '3', amount: '60.01' })).toBe('/admin/invoices/3?error=over');
    expect(s.invoices.get(3)).toMatchObject({ paidAmount: 40, status: 'partial' });
    expect(s.orders.get(7)!.paymentStatus).toBe('pending');
    expect(named('afterPaymentChange')).toHaveLength(0);
    expect(s.events).toEqual([]);
  });

  // «Qayta ochish»: buyurtmadan to'lov kutilmoqda ("to'langan" ham, "qaytarilgan" ham emas), hisob-fakturasi esa "to'langan" bo'lib
  // qolgan holatni moliya xodimi qo'lda tuzatadi — buyurtmadagi belgi bekor qilingan-u, hisob-fakturani u yopmagan edi (masalan,
  // yangilanishdan oldin qo'yilgan belgi), yoki to'lov hisob-faktura sahifasida xato kiritilgan. Buyurtma "to'langan" yoki "qaytarilgan"
  // turganda bu yerdan ochilmaydi: avval buyurtma «To'lanmagan»ga qaytariladi (u shu belgi yopgan hisob-fakturani o'zi ochadi); puli
  // qaytarilgan buyurtmaning to'langan hisob-fakturasi esa odatiy yakuniy holat
  describe('reopenInvoice', () => {
    const PAID_AT = new Date('2026-10-01T05:00:00.000Z');
    const paidInvoice = (over: Record<string, unknown> = {}) => invoice({ status: 'paid', paidAmount: 100, paidAt: PAID_AT, ...over });
    const reopenEvent = (over: Record<string, unknown> = {}) => ({ orderId: 7, kind: 'invoice', fromValue: 'paid', toValue: 'issued', actor: 'Admin Ali', via: 'invoice', meta: { invoiceNo: 'INV-1' }, ...over });
    /** Bazaga beriladigan shartli yozuv: faqat hozir "to'langan" va buyurtmasi "to'langan" ham, "qaytarilgan" ham EMAS hisob-faktura "berilgan, 0" ga qaytadi */
    const CONDITIONAL_UPDATE = { where: { id: 3, status: 'paid', order: { paymentStatus: { notIn: ['paid', 'refunded'] } } }, data: { status: 'issued', paidAmount: 0, paidAt: null } };
    /** Buyurtma qatorini qulflaydigan so'rov: raqam matnga qo'shib yozilmaydi ("?" — bog'langan qiymat) */
    const ORDER_LOCK = /^\s*SELECT "id" FROM "Order" WHERE "id" = \? FOR NO KEY UPDATE\s*$/;
    /** Bazaga murojaatlarning to'liq ro'yxati: amal boshidagi o'qish, keyin tranzaksiya — uning birinchi so'rovi buyurtma qatorining qulfi */
    const REOPENED_DB = ['corporateInvoice.findUnique', 'begin', '$queryRaw', 'corporateInvoice.updateMany', 'orderEvent.create', 'commit'];
    /** Rad etilganda: qulf va shartli yozuv bazaga boradi, boshqa hech narsa yozilmaydi */
    const REFUSED_DB = ['corporateInvoice.findUnique', 'begin', '$queryRaw', 'corporateInvoice.updateMany', 'commit'];

    // "Jarayonda" va "o'tmadi" — onlayn to'lovning holatlari: bunday buyurtmadan ham to'lov hali kutilmoqda
    it.each([['pending', 'bank_transfer'], ['pending', 'cash'], ['processing', 'payme'], ['failed', 'click']])('buyurtma "%s" (%s), hisob-faktura "to\'langan": "berilgan, 0" ga qaytadi va tarixga yoziladi — bitta tranzaksiyada', async (paymentStatus, paymentMethod) => {
      s.orders.set(7, order({ paymentStatus, paymentMethod }));
      s.invoices.set(3, paidInvoice());
      expect(await run(invoices.reopenInvoice, { id: '3' })).toBe('/admin/invoices/3?saved=1');
      expect(named('corporateInvoice.updateMany')).toEqual([['corporateInvoice.updateMany', CONDITIONAL_UPDATE]]);
      expect(s.invoices.get(3)).toMatchObject({ status: 'issued', paidAmount: 0, paidAt: null });
      // Tarix: buyurtma sahifasidagi "Tarix"da "Hisob-faktura INV-1: qayta ochildi" bo'lib chiqadi (pages.test.ts)
      expect(s.events).toEqual([reopenEvent()]);
      expect(s.steps).toEqual(['begin', 'orderEvent.create', 'commit']);
      expectDbOrder('begin', 'corporateInvoice.updateMany', 'orderEvent.create', 'commit');
      // Buyurtmaga tegilmaydi va hech kimga xabar ketmaydi
      expect(s.orders.get(7)).toEqual(order({ paymentStatus, paymentMethod }));
      expect(s.db).not.toContain('order.updateMany');
      expect(named('afterPaymentChange')).toHaveLength(0);
      expect(named('notifyCustomerInvoice')).toHaveLength(0);
      expect(s.revalidated).toEqual(['/admin/invoices', '/admin/invoices/3', '/admin/orders/7']);
    });

    // Boshqa to'lov amallari bilan bir xil tartib (avval buyurtma, keyin hisob-faktura). Qulf ayni paytda buyurtmani "to'landi" qilayotgan
    // tranzaksiya tugashini kutadi: busiz shartli yozuv buyurtmaning eski holatini ko'rib, to'langan buyurtmaning hisob-fakturasini ochib yuborardi
    it('qulflash tartibi: tranzaksiyaning birinchi so\'rovi — buyurtma qatorining qulfi (FOR NO KEY UPDATE); hisob-faktura yozuvi va tarix undan keyin', async () => {
      s.orders.set(7, order());
      s.invoices.set(3, paidInvoice());
      expect(await run(invoices.reopenInvoice, { id: '3' })).toBe('/admin/invoices/3?saved=1');
      // Aynan shu hisob-fakturaning BUYURTMASI qulflanadi (7 — hisob-faktura raqami 3 emas), raqam bog'langan qiymat bo'lib beriladi;
      // qulf tranzaksiya mijozi orqali olinadi — u tranzaksiya yakunlanguncha ushlab turiladi
      expect(s.locks).toHaveLength(1);
      expect(s.locks[0].sql).toMatch(ORDER_LOCK);
      expect(s.locks[0].values).toEqual([7]);
      expect(s.locks[0].tx).toBe(true);
      // Tranzaksiya ichida qulfdan oldin hech narsa o'qilmaydi ham, yozilmaydi ham
      expect(s.db).toEqual(REOPENED_DB);
    });

    it.each(['paid', 'refunded'])('qulfni kutayotganda buyurtma "%s" qilingan bo\'lsa hisob-faktura ochilmaydi: error=state, hech narsa yozilmaydi', async (paymentStatus) => {
      s.orders.set(7, order());
      const inv = paidInvoice();
      s.invoices.set(3, { ...inv });
      // Amal buyurtmani "to'lanmagan" deb o'qidi; qulf bo'shaganda boshqa xodimning (yoki botning) tranzaksiyasi yakunlangan
      s.onLock = () => { s.orders.get(7)!.paymentStatus = paymentStatus; };
      expect(await run(invoices.reopenInvoice, { id: '3' })).toBe('/admin/invoices/3?error=state');
      expect(s.locks.map((l) => l.values)).toEqual([[7]]);
      // Qaror qulfdan KEYINGI holat bo'yicha: shartli yozuv hech narsa topmaydi
      expect(named('corporateInvoice.updateMany')).toEqual([['corporateInvoice.updateMany', CONDITIONAL_UPDATE]]);
      expect(s.db).toEqual(REFUSED_DB);
      expect(s.invoices.get(3)).toEqual(inv);
      expect(s.events).toEqual([]);
      expect(s.revalidated).toEqual([]);
    });

    // Puli qaytarilgan buyurtmaning to'langan hisob-fakturasi — odatiy yakuniy holat (qarz sanalmaydi): bu yerdan ochilsa summa 0 ga
    // tushib, buyurtma keyin «To'lanmagan»ga qaytarilganda to'lov belgisi saqlagan surat qo'llanmay qolardi
    it.each(['bank_transfer', 'cash', 'payme'])('puli qaytarilgan buyurtma (%s): to\'langan hisob-faktura ochilmaydi — error=state, hech narsa yozilmaydi', async (paymentMethod) => {
      const refunded = order({ paymentMethod, paymentStatus: 'refunded' });
      const inv = paidInvoice();
      s.orders.set(7, { ...refunded });
      s.invoices.set(3, { ...inv });
      expect(await run(invoices.reopenInvoice, { id: '3' })).toBe('/admin/invoices/3?error=state');
      expect(named('corporateInvoice.updateMany')).toEqual([['corporateInvoice.updateMany', CONDITIONAL_UPDATE]]);
      expect(s.db).toEqual(REFUSED_DB);
      expect(s.invoices.get(3)).toEqual(inv);
      expect(s.orders.get(7)).toEqual(refunded);
      expect(s.events).toEqual([]);
      expect(s.steps).toEqual(['begin', 'commit']);
      expect(named('afterPaymentChange')).toHaveLength(0);
      expect(named('notifyCustomerInvoice')).toHaveLength(0);
      expect(s.revalidated).toEqual([]);
    });

    it('shartli yozuv hech narsani o\'zgartirmasa (buyurtma "to\'langan" yoki hisob-faktura "to\'langan" emas): error=state, tarixga yozilmaydi', async () => {
      const cases: [string, Record<string, unknown>, Record<string, unknown>][] = [
        ['buyurtma to\'langan', { paymentStatus: 'paid' }, paidInvoice()],
        ['hisob-faktura berilgan', {}, invoice()],
        ['hisob-faktura qisman to\'langan', {}, invoice({ status: 'partial', paidAmount: 40 })],
        ['hisob-faktura bekor qilingan', {}, invoice({ status: 'cancelled' })],
      ];
      for (const [name, orderOver, inv] of cases) {
        s.calls.length = 0;
        s.steps.length = 0;
        s.db.length = 0;
        s.locks.length = 0;
        s.orders.set(7, order(orderOver));
        s.invoices.set(3, { ...inv });
        expect(await run(invoices.reopenInvoice, { id: '3' }), name).toBe('/admin/invoices/3?error=state');
        // Qaror amalning oldindan o'qiganiga emas, bazadagi shartli yozuvga tayanadi: shart baribir bazaga boradi va hech narsa topmaydi
        expect(named('corporateInvoice.updateMany'), name).toEqual([['corporateInvoice.updateMany', CONDITIONAL_UPDATE]]);
        // Buyurtma qatori bu holda ham avval qulflanadi; shartli yozuvdan boshqa hech narsa yozilmaydi
        expect(s.locks.map((l) => l.values), name).toEqual([[7]]);
        expect(s.db, name).toEqual(REFUSED_DB);
        expect(s.invoices.get(3), name).toEqual(inv);
        expect(s.events, name).toEqual([]);
        expect(s.steps, name).toEqual(['begin', 'commit']);
        expect(s.revalidated, name).toEqual([]);
      }
    });

    it('tugma ikki marta bosilsa: ikkinchisi error=state, tarixda bitta yozuv', async () => {
      s.orders.set(7, order());
      s.invoices.set(3, paidInvoice());
      expect(await run(invoices.reopenInvoice, { id: '3' })).toBe('/admin/invoices/3?saved=1');
      expect(await run(invoices.reopenInvoice, { id: '3' })).toBe('/admin/invoices/3?error=state');
      expect(s.events).toEqual([reopenEvent()]);
      expect(s.invoices.get(3)).toMatchObject({ status: 'issued', paidAmount: 0, paidAt: null });
    });

    it('tarix yozuvini baza rad etsa amal xato bilan to\'xtaydi — tranzaksiya yakunlanmaydi (hisob-faktura yozuvi ham qaytadi)', async () => {
      s.orders.set(7, order());
      s.invoices.set(3, paidInvoice());
      s.eventError = new Error('test: OrderEvent yozilmadi');
      await expect(run(invoices.reopenInvoice, { id: '3' })).rejects.toThrow('test: OrderEvent yozilmadi');
      expect(s.steps).toEqual(['begin']);
      expect(s.revalidated).toEqual([]);
    });

    it('topilmagan hisob-faktura: ro\'yxatga qaytadi, hech narsa yozilmaydi', async () => {
      s.orders.set(7, order());
      s.invoices.set(3, paidInvoice());
      expect(await run(invoices.reopenInvoice, { id: '99' })).toBe('/admin/invoices');
      expect(s.steps).toEqual([]);
      expect(s.locks).toEqual([]);
      expect(named('corporateInvoice.updateMany')).toHaveLength(0);
      expect(s.invoices.get(3)).toMatchObject({ status: 'paid', paidAmount: 100, paidAt: PAID_AT });
      expect(s.events).toEqual([]);
      expect(s.revalidated).toEqual([]);
    });

    it('faqat moliya ruxsati bilan: "Xodim" roli kiritilmaydi (bazaga murojaat ham bo\'lmaydi); menejer va administrator ochadi, tarixda ismi qoladi', async () => {
      s.orders.set(7, order());
      s.invoices.set(3, paidInvoice());
      s.user = STAFF;
      expect(await run(invoices.reopenInvoice, { id: '3' })).toBe('/admin?denied=1');
      expect(named('requireStaff')).toEqual([['requireStaff', 'finance']]);
      expect(s.db).toEqual([]);
      expect(s.invoices.get(3)).toMatchObject({ status: 'paid', paidAmount: 100, paidAt: PAID_AT });
      expect(s.events).toEqual([]);
      expect(s.revalidated).toEqual([]);
      for (const user of [MANAGER, ADMIN]) {
        s.calls.length = 0;
        s.events.length = 0;
        s.user = user;
        s.invoices.set(3, paidInvoice());
        expect(await run(invoices.reopenInvoice, { id: '3' }), user.role).toBe('/admin/invoices/3?saved=1');
        expect(named('requireStaff'), user.role).toEqual([['requireStaff', 'finance']]);
        expect(s.events, user.role).toEqual([reopenEvent({ actor: user.name })]);
      }
    });

    it('tarixdagi ism to\'lov yozuvlaridagi kabi 100 belgigacha qisqartiriladi', async () => {
      s.user = { ...MANAGER, name: 'M'.repeat(130) };
      s.orders.set(7, order());
      s.invoices.set(3, paidInvoice());
      expect(await run(invoices.reopenInvoice, { id: '3' })).toBe('/admin/invoices/3?saved=1');
      expect(s.events).toEqual([reopenEvent({ actor: 'M'.repeat(100) })]);
    });
  });

  it('har bir hisob-faktura amali "finance" bo\'limi ruxsatini so\'raydi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice());
    await run(invoices.createInvoiceForOrder, { orderId: '7' });
    await run(invoices.registerPartial, { id: '3', amount: '10' });
    await run(invoices.markPaid, { id: '3' });
    await run(invoices.reopenInvoice, { id: '3' });
    await run(invoices.cancelInvoice, { id: '3' });
    await run(invoices.linkContract, { id: '3' });
    expect(named('requireStaff')).toEqual(Array(6).fill(['requireStaff', 'finance']));
  });

  it('moliya ruxsati yo\'q xodim ("Xodim" roli) hech bir hisob-faktura amaliga kiritilmaydi — bazaga murojaat ham bo\'lmaydi', async () => {
    s.user = STAFF;
    s.orders.set(7, order());
    const before = invoice({ status: 'paid', paidAmount: 100, paidAt: new Date('2026-10-01T05:00:00.000Z') });
    s.invoices.set(3, { ...before });
    const all: [string, (fd: FormData) => Promise<unknown>, Record<string, string>][] = [
      ['createInvoiceForOrder', invoices.createInvoiceForOrder, { orderId: '7' }],
      ['registerPartial', invoices.registerPartial, { id: '3', amount: '10' }],
      ['markPaid', invoices.markPaid, { id: '3' }],
      ['reopenInvoice', invoices.reopenInvoice, { id: '3' }],
      ['cancelInvoice', invoices.cancelInvoice, { id: '3' }],
      ['linkContract', invoices.linkContract, { id: '3' }],
    ];
    for (const [name, fn, fields] of all) expect(await run(fn, fields), name).toBe('/admin?denied=1');
    expect(named('requireStaff')).toEqual(Array(6).fill(['requireStaff', 'finance']));
    expect(s.db).toEqual([]);
    expect(s.invoices.get(3)).toEqual(before);
    expect(s.orders.get(7)!.paymentStatus).toBe('pending');
    expect(s.events).toEqual([]);
    expect(named('afterPaymentChange')).toHaveLength(0);
    expect(named('notifyCustomerInvoice')).toHaveLength(0);
    expect(s.revalidated).toEqual([]);
  });

  it('createInvoiceForOrder: mijozga faqat yangi yaratilgan hisob-faktura haqida xabar ketadi', async () => {
    s.orders.set(7, order());
    expect(await run(invoices.createInvoiceForOrder, { orderId: '7' })).toBe('/admin/invoices/500');
    expect(named('notifyCustomerInvoice')).toHaveLength(1);
    expect(named('notifyCustomerInvoice')[0][1]).toBe(7);
    expect(named('notifyCustomerInvoice')[0][2]).toMatchObject({ id: 500, invoiceNo: 'INV-2026-0001' });
    await run(invoices.createInvoiceForOrder, { orderId: '7' });
    expect(named('notifyCustomerInvoice')).toHaveLength(1);
  });

  // Tugma ikki marta bosilganda ikkala so'rov ham "hali yo'q" deb ko'rib, ikkita xabar yuborardi: endi "yangi"ligini
  // ensureInvoiceForOrder o'z tranzaksiyasida aytadi, amal alohida tekshirmaydi
  it('createInvoiceForOrder: hujjat allaqachon bor bo\'lsa (created: false) xabar ketmaydi, amal mavjud hujjatga o\'tkazadi', async () => {
    s.orders.set(7, order());
    s.invoices.set(3, invoice());
    expect(await run(invoices.createInvoiceForOrder, { orderId: '7' })).toBe('/admin/invoices/3');
    expect(named('notifyCustomerInvoice')).toHaveLength(0);
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

  it('bekor qilingan topshiriqning oxirgi bosqichi yakunlansa ham u "tayyor" bo\'lmaydi va mijozga xabar ketmaydi', async () => {
    setup({ status: 'cancelled' });
    for (const stageId of ['1', '2', '3', '4']) await run(production.finishStage, { stageId });
    expect(s.workOrders.get(WORK_ORDER)).toMatchObject({ status: 'cancelled', progress: 100, currentStage: 'qc' });
    expect(named('notifyCustomerProduction')).toHaveLength(0);
    // Boshlash ham holatni o'zgartirmaydi
    s.stages.clear();
    setup({ status: 'cancelled' });
    await run(production.startStage, { stageId: '1' });
    expect(s.workOrders.get(WORK_ORDER)!.status).toBe('cancelled');
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

  it('issueTelegramCode: faqat faol xodimga; manzilda kod emas, faqat xodim raqami (kod sahifada bazadan ko\'rsatiladi)', async () => {
    expect(await run(staff.issueTelegramCode, { id: '5' })).toBe('/admin/staff?tg=5');
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
    expect(await run(staff.issueTelegramCode, { id: '5' })).toBe('/admin/staff?tg=5');
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
