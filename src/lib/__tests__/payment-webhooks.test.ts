import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Payme va Click webhook'lari: to'lov tizimiga javob shakli o'zgarmagani, to'lov holati haqiqatan o'zgargandagina tarix va
 * xabarnoma (afterPaymentChange) chaqirilishi, Telegram sekin yoki xato bo'lsa ham javob kechikmasligi. Baza xotirada.
 */
const state = vi.hoisted(() => ({
  orders: new Map<number, Record<string, unknown>>(),
  txs: new Map<string, Record<string, unknown>>(),
  after: [] as unknown[][],
  admins: [] as unknown[],
  afterImpl: (async () => undefined) as (...a: unknown[]) => Promise<unknown>,
  /** Poygani taqlid qilish uchun: so'rov eski holatni o'qib bo'lgach, yozishidan oldin chaqiriladi (orada boshqa so'rov yozib ulgurgan) */
  beforeBatch: (() => undefined) as () => void,
  beforeUpdateMany: (() => undefined) as () => void,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/telegram', () => ({ notifyAdmins: async (l: unknown) => { state.admins.push(l); } }));
vi.mock('@/lib/orderFlow', () => ({ afterPaymentChange: (...a: unknown[]) => { state.after.push(a); return state.afterImpl(...a); } }));
vi.mock('@/lib/db', () => {
  type Op = { run: () => Promise<unknown> };
  // order.update to'g'ridan-to'g'ri ham kutiladi (Click, "o'tmadi"), $transaction ga ham beriladi (Payme): then + run()
  const op = (run: () => Promise<unknown>): Op & PromiseLike<unknown> => ({ run, then: (res, rej) => run().then(res, rej) });
  const prisma = {
    order: {
      findUnique: async ({ where, select }: { where: { id: number }; select?: Record<string, boolean> }) => {
        const o = state.orders.get(where.id);
        if (!o) return null;
        return select ? Object.fromEntries(Object.keys(select).map((k) => [k, o[k]])) : { ...o };
      },
      update: ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => op(async () => { const o = state.orders.get(where.id)!; Object.assign(o, data); return { ...o }; }),
      updateMany: async ({ where, data }: { where: { id: number; paymentStatus?: { not: string } }; data: Record<string, unknown> }) => {
        state.beforeUpdateMany();
        const o = state.orders.get(where.id);
        if (!o || (where.paymentStatus && o.paymentStatus === where.paymentStatus.not)) return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      },
    },
    paymeTransaction: {
      findUnique: async ({ where }: { where: { id: string } }) => { const t = state.txs.get(where.id); return t ? { ...t } : null; },
      // Prisma kabi: `where` dagi qo'shimcha shartga (state) mos qator bo'lmasa P2025 xatosi
      update: ({ where, data }: { where: { id: string; state?: number }; data: Record<string, unknown> }) => op(async () => {
        const t = state.txs.get(where.id)!;
        if (where.state !== undefined && t.state !== where.state) throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
        Object.assign(t, data);
        return { ...t };
      }),
    },
    // Haqiqiy tranzaksiya kabi: birinchi amal xato bersa keyingisi bajarilmaydi
    $transaction: async (ops: Op[]) => { state.beforeBatch(); const out = []; for (const o of ops) out.push(await o.run()); return out; },
  };
  return { prisma };
});

const payme = await import('@/app/api/payment/payme/webhook/route');
const click = await import('@/app/api/payment/click/route');

const baseOrder = () => ({ id: 7, status: 'new_', paymentStatus: 'processing', paymentMethod: 'payme', totalAmount: 150000, accessToken: 'tok', telegramUserId: null, contactPhone: '998901234567', userId: null, deletedAt: null });
const tx = (id: string, orderId: number, st: number) => ({ id, orderId, amount: 15000000, state: st, createTime: BigInt(Date.now()), performTime: st === 2 ? BigInt(5) : null, cancelTime: null, reason: null });

beforeEach(() => {
  state.orders.clear();
  state.txs.clear();
  state.after.length = 0;
  state.admins.length = 0;
  state.afterImpl = async () => undefined;
  state.beforeBatch = () => undefined;
  state.beforeUpdateMany = () => undefined;
  vi.stubEnv('PAYME_SECRET_KEY', 'payme-key');
  vi.stubEnv('CLICK_SECRET_KEY', 'click-key');
  vi.stubEnv('CLICK_SERVICE_ID', '55');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const paymeReq = (body: unknown) => new Request('https://pack24.uz/api/payment/payme/webhook', { method: 'POST', headers: { authorization: `Basic ${Buffer.from('Paycom:payme-key').toString('base64')}` }, body: JSON.stringify(body) });
const paymeCall = async (body: unknown) => (await payme.POST(paymeReq(body) as never)).json();

describe('Payme webhook: tarix va xabarnoma', () => {
  it('PerformTransaction: javob shakli o\'zgarmagan, afterPaymentChange oldingi holat bilan chaqiriladi', async () => {
    state.orders.set(7, baseOrder());
    state.txs.set('tx1', tx('tx1', 7, 1));
    const json = await paymeCall({ id: 1, method: 'PerformTransaction', params: { id: 'tx1' } });
    expect(Object.keys(json)).toEqual(['id', 'result']);
    expect(json.id).toBe(1);
    expect(Object.keys(json.result)).toEqual(['transaction', 'perform_time', 'state']);
    expect(json.result.transaction).toBe('tx1');
    expect(json.result.state).toBe(2);
    expect(state.admins).toHaveLength(1);
    expect(state.after).toHaveLength(1);
    const [order, from, actor] = state.after[0] as [Record<string, unknown>, string, unknown];
    expect(order.id).toBe(7);
    expect(order.paymentStatus).toBe('paid');
    expect(from).toBe('processing');
    expect(actor).toEqual({ name: 'Payme', via: 'payme' });
  });

  it('takroriy Perform (holat 2): ikkinchi marta xabar ketmaydi', async () => {
    state.orders.set(7, { ...baseOrder(), paymentStatus: 'paid' });
    state.txs.set('tx1', tx('tx1', 7, 2));
    const json = await paymeCall({ id: 2, method: 'PerformTransaction', params: { id: 'tx1' } });
    expect(json).toEqual({ id: 2, result: { transaction: 'tx1', perform_time: 5, state: 2 } });
    expect(state.after).toHaveLength(0);
  });

  it('bir vaqtda kelgan ikki Perform: faqat bittasi yozadi — tarix va xabarnoma bir marta, ikkala javob bir xil', async () => {
    state.orders.set(7, baseOrder());
    state.txs.set('tx1', tx('tx1', 7, 1));
    let batches = 0;
    state.beforeBatch = () => { batches += 1; };
    const perform = { id: 1, method: 'PerformTransaction', params: { id: 'tx1' } };
    const [a, b] = await Promise.all([paymeCall(perform), paymeCall(perform)]);
    // Ikkalasi ham "holat 1"ni o'qib, yozishgacha yetib kelgan (aks holda bu test hech narsani tekshirmagan bo'lardi)
    expect(batches).toBe(2);
    expect(state.after).toHaveLength(1);
    expect(state.admins).toHaveLength(1);
    expect(a).toEqual({ id: 1, result: { transaction: 'tx1', perform_time: Number(state.txs.get('tx1')!.performTime), state: 2 } });
    expect(b).toEqual(a);
    expect(state.orders.get(7)!.paymentStatus).toBe('paid');
  });

  it('Perform yozishga ulgurmadi (orada boshqa Perform yozgan): saqlangan vaqt bilan takroriy so\'rov javobi, hech narsa qayta yozilmaydi', async () => {
    state.orders.set(7, baseOrder());
    state.txs.set('tx1', tx('tx1', 7, 1));
    state.beforeBatch = () => {
      Object.assign(state.txs.get('tx1')!, { state: 2, performTime: BigInt(777) });
      state.orders.get(7)!.paymentStatus = 'paid';
    };
    const json = await paymeCall({ id: 12, method: 'PerformTransaction', params: { id: 'tx1' } });
    expect(json).toEqual({ id: 12, result: { transaction: 'tx1', perform_time: 777, state: 2 } });
    expect(state.txs.get('tx1')!.performTime).toBe(BigInt(777));
    expect(state.after).toHaveLength(0);
    expect(state.admins).toHaveLength(0);
  });

  it('Perform yozishga ulgurmadi (orada tranzaksiya bekor qilingan): -31008, buyurtma "to\'langan" bo\'lmaydi', async () => {
    state.orders.set(7, baseOrder());
    state.txs.set('tx1', tx('tx1', 7, 1));
    state.beforeBatch = () => {
      Object.assign(state.txs.get('tx1')!, { state: -1, cancelTime: BigInt(888), reason: 3 });
      state.orders.get(7)!.paymentStatus = 'pending';
    };
    const json = await paymeCall({ id: 13, method: 'PerformTransaction', params: { id: 'tx1' } });
    expect(Object.keys(json)).toEqual(['id', 'error']);
    expect(json.error.code).toBe(-31008);
    expect(state.txs.get('tx1')).toMatchObject({ state: -1, performTime: null });
    expect(state.orders.get(7)!.paymentStatus).toBe('pending');
    expect(state.after).toHaveLength(0);
    expect(state.admins).toHaveLength(0);
  });

  it('Perform (holat 1), buyurtma esa boshqa yo\'l bilan allaqachon to\'langan: tarix va xabarnoma takrorlanmaydi', async () => {
    state.orders.set(7, { ...baseOrder(), paymentStatus: 'paid' });
    state.txs.set('tx1', tx('tx1', 7, 1));
    const json = await paymeCall({ id: 14, method: 'PerformTransaction', params: { id: 'tx1' } });
    expect(json.result.state).toBe(2);
    expect(state.txs.get('tx1')!.state).toBe(2);
    expect(state.after).toHaveLength(0);
  });

  it('CancelTransaction: to\'langan -> qaytarilgan tarixga tushadi; yetkazilgan buyurtma bekor qilinmaydi', async () => {
    state.orders.set(7, { ...baseOrder(), paymentStatus: 'paid' });
    state.txs.set('tx1', tx('tx1', 7, 2));
    const json = await paymeCall({ id: 3, method: 'CancelTransaction', params: { id: 'tx1', reason: 5 } });
    expect(Object.keys(json.result)).toEqual(['transaction', 'cancel_time', 'state']);
    expect(json.result.state).toBe(-2);
    expect(state.after).toHaveLength(1);
    expect((state.after[0][0] as Record<string, unknown>).paymentStatus).toBe('refunded');
    expect(state.after[0][1]).toBe('paid');

    state.after.length = 0;
    state.orders.set(8, { ...baseOrder(), id: 8, status: 'delivered', paymentStatus: 'paid' });
    state.txs.set('tx2', tx('tx2', 8, 2));
    const j2 = await paymeCall({ id: 4, method: 'CancelTransaction', params: { id: 'tx2', reason: 5 } });
    expect(j2.error.code).toBe(-31007);
    expect(state.after).toHaveLength(0);
    expect(state.orders.get(8)!.paymentStatus).toBe('paid');
  });

  it('kutilayotgan tranzaksiya bekor qilinsa: buyurtmaning to\'lov holati haqiqatan o\'zgargandagina yoziladi', async () => {
    state.orders.set(7, { ...baseOrder(), paymentStatus: 'pending' });
    state.txs.set('tx1', tx('tx1', 7, 1));
    const j = await paymeCall({ id: 5, method: 'CancelTransaction', params: { id: 'tx1', reason: 3 } });
    expect(j.result.state).toBe(-1);
    expect(state.after).toHaveLength(0);
    state.orders.set(9, { ...baseOrder(), id: 9, paymentStatus: 'processing' });
    state.txs.set('tx3', tx('tx3', 9, 1));
    await paymeCall({ id: 6, method: 'CancelTransaction', params: { id: 'tx3', reason: 3 } });
    expect(state.after).toHaveLength(1);
    expect(state.after[0][1]).toBe('processing');
    expect((state.after[0][0] as Record<string, unknown>).paymentStatus).toBe('pending');
  });

  it('osilib qolgan xabarnoma javobni ko\'pi bilan 4 s kechiktiradi; xato tashlagani javobni buzmaydi', async () => {
    vi.useFakeTimers();
    state.afterImpl = () => new Promise(() => undefined);
    state.orders.set(7, baseOrder());
    state.txs.set('tx1', tx('tx1', 7, 1));
    let done = false;
    const p = payme.POST(paymeReq({ id: 1, method: 'PerformTransaction', params: { id: 'tx1' } }) as never).then((r) => { done = true; return r; });
    await vi.advanceTimersByTimeAsync(3_900);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
    expect((await (await p).json()).result.state).toBe(2);
    vi.useRealTimers();

    state.afterImpl = async () => { throw new Error('boom'); };
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    state.orders.set(10, { ...baseOrder(), id: 10 });
    state.txs.set('tx9', tx('tx9', 10, 1));
    const json = await paymeCall({ id: 11, method: 'PerformTransaction', params: { id: 'tx9' } });
    expect(json.result.state).toBe(2);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

const clickForm = (over: Record<string, string>) => {
  const p: Record<string, string> = { click_trans_id: '900', service_id: '55', merchant_trans_id: '7', merchant_prepare_id: '7', amount: '150000', action: '1', error: '0', sign_time: '2026-10-10 10:00:00', ...over };
  const parts = p.action === '1' ? [p.click_trans_id, p.service_id, 'click-key', p.merchant_trans_id, p.merchant_prepare_id, p.amount, p.action, p.sign_time] : [p.click_trans_id, p.service_id, 'click-key', p.merchant_trans_id, p.amount, p.action, p.sign_time];
  p.sign_string = createHash('md5').update(parts.join('')).digest('hex');
  return new Request('https://pack24.uz/api/payment/click', { method: 'POST', body: new URLSearchParams(p).toString() });
};
const clickCall = async (over: Record<string, string>) => (await click.POST(clickForm(over) as never)).json();

describe('Click: tarix va xabarnoma', () => {
  it('COMPLETE: javob shakli o\'zgarmagan, bitta xabarnoma; takroriy so\'rovda yana ketmaydi', async () => {
    state.orders.set(7, { ...baseOrder(), paymentMethod: 'click', paymentStatus: 'pending' });
    expect(await clickCall({})).toEqual({ click_trans_id: '900', merchant_trans_id: '7', error: 0, error_note: 'Success', merchant_confirm_id: 7 });
    expect(state.after).toHaveLength(1);
    expect(state.after[0][1]).toBe('pending');
    expect((state.after[0][0] as Record<string, unknown>).paymentStatus).toBe('paid');
    expect(state.after[0][2]).toEqual({ name: 'Click', via: 'click' });
    expect(await clickCall({})).toEqual({ click_trans_id: '900', merchant_trans_id: '7', error: -4, error_note: 'Already paid', merchant_confirm_id: 7 });
    expect(state.after).toHaveLength(1);
  });

  it('COMPLETE poygasi: o\'qish va yozish orasida boshqa so\'rov to\'lab ulgursa javob o\'sha, tarix va xabarnoma takrorlanmaydi', async () => {
    state.orders.set(7, { ...baseOrder(), paymentMethod: 'click', paymentStatus: 'pending' });
    state.beforeUpdateMany = () => { state.orders.get(7)!.paymentStatus = 'paid'; };
    expect(await clickCall({})).toEqual({ click_trans_id: '900', merchant_trans_id: '7', error: 0, error_note: 'Success', merchant_confirm_id: 7 });
    expect(state.after).toHaveLength(0);
    expect(state.admins).toHaveLength(0);
  });

  it('o\'tmagan COMPLETE: "failed" tarixga bir marta yoziladi', async () => {
    state.orders.set(7, { ...baseOrder(), paymentMethod: 'click', paymentStatus: 'pending' });
    expect(await clickCall({ error: '-5017' })).toEqual({ click_trans_id: '900', merchant_trans_id: '7', error: -9, error_note: 'Transaction cancelled' });
    expect(state.after).toHaveLength(1);
    expect((state.after[0][0] as Record<string, unknown>).paymentStatus).toBe('failed');
    expect(state.after[0][1]).toBe('pending');
    await clickCall({ error: '-5017' });
    expect(state.after).toHaveLength(1);
  });
});
