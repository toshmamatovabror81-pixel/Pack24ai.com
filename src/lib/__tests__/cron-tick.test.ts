import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** /api/cron/tick ochiq manzil: faqat Bearer TELEGRAM_OPS_SECRET bilan ishlaydi, kalitsiz so'rov runTick'gacha yetib bormaydi */
const h = vi.hoisted(() => ({ runTick: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/cron', () => ({ runTick: h.runTick }));

const { POST } = await import('@/app/api/cron/tick/route');

const SECRET = 'ci-dummy-ops-secret';
const call = (headers: Record<string, string> = {}) => POST(new Request('https://pack24.uz/api/cron/tick', { method: 'POST', headers }));
/** Oddiy tick (kunlik ishlarning vaqti emas, navbat bo'sh) — runTick shunday qaytaradi */
const QUIET = { digest: null, audit: null, outbox: { sent: 0, retry: 0, failed: 0 } };

beforeEach(() => {
  vi.stubEnv('TELEGRAM_OPS_SECRET', SECRET);
  h.runTick.mockReset().mockResolvedValue(QUIET);
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
    expect(await res.json()).toEqual({ ok: true, ...QUIET });
    expect(h.runTick).toHaveBeenCalledTimes(1);
    // Vaqt so'rovdan olinmaydi: runTick server soati bilan ishlaydi (kalitni bilgan kishi ham "ertangi" tickni yubora olmaydi)
    expect(h.runTick).toHaveBeenCalledWith();

    h.runTick.mockResolvedValue({ ...QUIET, digest: { finance: 2, orders: 1 } });
    expect(await (await call({ authorization: `Bearer ${SECRET}` })).json()).toEqual({ ok: true, ...QUIET, digest: { finance: 2, orders: 1 } });
  });

  // auto-update.sh faqat javob kodiga qaraydi; tanasi qo'lda sinaganda nima bo'lganini ko'rsatadi: navbatdan nechta xabar ketgani,
  // tekshiruv tugadimi yoki fonda davom etyaptimi. Ishlar "yarim" tugagani (running / failed / null) javobni xatoga aylantirmaydi
  it('javobda uchala ish natijasi o\'zgarishsiz qaytadi: eslatma, tekshiruv ("running" / "failed" ham) va xabarlar navbati (null ham)', async () => {
    const results = [
      { digest: null, audit: { findings: 3, sent: 1, ai: true }, outbox: { sent: 2, retry: 1, failed: 0 } },
      { digest: null, audit: 'running', outbox: { sent: 0, retry: 0, failed: 4 } },
      // Ikkala kunlik ish bitta tickda (navbat shu safar yuborilmagan) yoki navbat xato bergan: outbox null
      { digest: { finance: 1, orders: 0 }, audit: 'failed', outbox: null },
    ];
    for (const result of results) {
      h.runTick.mockResolvedValue(result);
      const res = await call({ authorization: `Bearer ${SECRET}` });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, ...result });
    }
  });

  it('runTick xato tashlasa: 500, xato matni tashqariga chiqmaydi', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.runTick.mockRejectedValue(new Error('baza ulanmadi'));
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false });
    expect(text).not.toContain('baza');
    expect(errors).toHaveBeenCalled();
  });
});
