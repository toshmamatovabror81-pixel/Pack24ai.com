import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Ariza formasi (submitLead): ariza saqlangach bir xil matn eski admin guruhga ham, boshqaruv botidagi xodimlarga ham ketadi.
 * Mijoz Telegram'ni ko'pi bilan 3 s kutadi va xabarnomadagi xato saqlangan arizani "xato"ga aylantirmaydi. Baza va Telegram soxta.
 */
const s = vi.hoisted(() => ({
  created: [] as Record<string, unknown>[],
  admins: [] as unknown[],
  staff: [] as unknown[],
  createImpl: null as null | (() => never),
  adminsImpl: (async () => undefined) as () => Promise<unknown>,
  staffImpl: (async () => 1) as () => Promise<unknown>,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: async () => true }));
vi.mock('@/lib/db', () => ({
  prisma: { lead: { create: async ({ data }: { data: Record<string, unknown> }) => { s.createImpl?.(); s.created.push(data); return { id: 41, ...data }; } } },
}));
vi.mock('@/lib/telegram', () => ({ notifyAdmins: (l: unknown) => { s.admins.push(l); return s.adminsImpl(); } }));
vi.mock('@/lib/orderNotify', () => ({ notifyStaffLead: (l: unknown) => { s.staff.push(l); return s.staffImpl(); } }));

const { submitLead } = await import('@/lib/leads');

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const CALLBACK = { type: 'callback', name: 'Ali Valiyev', phone: '+998 90 123-45-67', quantity: '500' };
const hang = () => new Promise<never>(() => undefined);

beforeEach(() => {
  s.created.length = 0;
  s.admins.length = 0;
  s.staff.length = 0;
  s.createImpl = null;
  s.adminsImpl = async () => undefined;
  s.staffImpl = async () => 1;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('submitLead', () => {
  it('ariza saqlanadi va xodimlarga admin guruhdagi bilan aynan bir xil satrlar boradi', async () => {
    expect(await submitLead(null, form(CALLBACK))).toEqual({ ok: true });
    expect(s.created).toHaveLength(1);
    expect(s.created[0]).toMatchObject({ type: 'callback', name: 'Ali Valiyev', phone: '998901234567', details: { quantity: '500' } });
    expect(s.admins).toHaveLength(1);
    expect(s.staff).toHaveLength(1);
    expect(s.staff[0]).toBe(s.admins[0]);
    expect((s.staff[0] as string[])[0]).toBe("📩 Qayta qo'ng'iroq #41");
    expect(s.staff[0]).toContain('quantity: 500');
  });

  it('yashirin maydon to\'ldirilgan (bot) yoki telefon xato bo\'lsa: hech narsa saqlanmaydi va yuborilmaydi', async () => {
    expect(await submitLead(null, form({ type: 'callback', name: 'Spam', phone: '998901234567', website: 'http://x' }))).toEqual({ ok: true });
    expect(await submitLead(null, form({ type: 'callback', name: 'Ali Valiyev', phone: '12' }))).toEqual({ error: 'phone' });
    expect(s.created).toEqual([]);
    expect(s.admins).toEqual([]);
    expect(s.staff).toEqual([]);
  });

  it('Telegram javob bermasa mijoz ko\'pi bilan 3 s kutadi; bitta xabarnoma osilib qolsa ikkinchisi baribir ketadi', async () => {
    vi.useFakeTimers();
    s.adminsImpl = hang;
    s.staffImpl = hang;
    let result: unknown = null;
    void submitLead(null, form(CALLBACK)).then((r) => { result = r; });
    await vi.advanceTimersByTimeAsync(2_900);
    expect(result).toBeNull();
    // Ariza allaqachon saqlangan va ikkala xabarnoma ham boshlangan (biri ikkinchisini kutmaydi)
    expect(s.created).toHaveLength(1);
    expect(s.admins).toHaveLength(1);
    expect(s.staff).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(result).toEqual({ ok: true });
  });

  it('xabarnoma xato tashlasa ham saqlangan ariza "server xatosi" bo\'lib qaytmaydi', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    s.adminsImpl = async () => { throw new Error('guruh topilmadi'); };
    s.staffImpl = async () => { throw new Error('telegram ishlamayapti'); };
    expect(await submitLead(null, form(CALLBACK))).toEqual({ ok: true });
    expect(s.created).toHaveLength(1);
    expect(s.staff).toHaveLength(1);
    expect(errors).toHaveBeenCalled();
  });

  it('ariza bazaga yozilmasa: server xatosi, xabarnoma yuborilmaydi', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    s.createImpl = () => { throw new Error('baza ulanmadi'); };
    expect(await submitLead(null, form(CALLBACK))).toEqual({ error: 'server' });
    expect(s.admins).toEqual([]);
    expect(s.staff).toEqual([]);
    expect(errors).toHaveBeenCalled();
  });
});
