import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** /api/cron/tick ochiq manzil: faqat Bearer TELEGRAM_OPS_SECRET bilan ishlaydi, kalitsiz so'rov runTick'gacha yetib bormaydi */
const h = vi.hoisted(() => ({ runTick: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/cron', () => ({ runTick: h.runTick }));

const { POST } = await import('@/app/api/cron/tick/route');

const SECRET = 'ci-dummy-ops-secret';
const call = (headers: Record<string, string> = {}) => POST(new Request('https://pack24.uz/api/cron/tick', { method: 'POST', headers }));

beforeEach(() => {
  vi.stubEnv('TELEGRAM_OPS_SECRET', SECRET);
  h.runTick.mockReset().mockResolvedValue({ digest: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('cron tick manzili', () => {
  it('kalitsiz yoki xato kalit bilan: 401, hech narsa bajarilmaydi', async () => {
    const bad: Record<string, string>[] = [
      {},
      { authorization: 'Bearer ci-dummy-wrong-secret' },
      { authorization: SECRET }, // "Bearer " siz
      { authorization: `Basic ${SECRET}` },
      { authorization: `Bearer ${SECRET}x` },
      { authorization: 'Bearer undefined' }, // konteynerda kalit yo'q bo'lsa auto-update.sh aynan shuni yuboradi
    ];
    for (const headers of bad) {
      const res = await call(headers);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ ok: false });
    }
    expect(h.runTick).not.toHaveBeenCalled();
  });

  it('serverda kalit sozlanmagan yoki 16 belgidan qisqa bo\'lsa hech qanday so\'rov qabul qilinmaydi', async () => {
    vi.stubEnv('TELEGRAM_OPS_SECRET', '');
    expect((await call({ authorization: 'Bearer ' })).status).toBe(401);
    expect((await call({ authorization: 'Bearer undefined' })).status).toBe(401);
    vi.stubEnv('TELEGRAM_OPS_SECRET', 'qisqa-kalit');
    expect((await call({ authorization: 'Bearer qisqa-kalit' })).status).toBe(401);
    expect(h.runTick).not.toHaveBeenCalled();
  });

  it('to\'g\'ri kalit: 200 va runTick natijasi', async () => {
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, digest: null });
    expect(h.runTick).toHaveBeenCalledTimes(1);

    h.runTick.mockResolvedValue({ digest: { finance: 2, orders: 1 } });
    expect(await (await call({ authorization: `Bearer ${SECRET}` })).json()).toEqual({ ok: true, digest: { finance: 2, orders: 1 } });
  });

  it('runTick xato tashlasa: 500, xato matni tashqariga chiqmaydi', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.runTick.mockRejectedValue(new Error('baza ulanmadi'));
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
    expect(errors).toHaveBeenCalled();
  });
});
