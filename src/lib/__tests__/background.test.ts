import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settleWithin } from '@/lib/background';

/** settleWithin: checkout, ariza formasi va to'lov webhook'lari Telegram xabarnomasini shu orqali kutadi — muddat va "xato tashlamaslik" shu yerda tekshiriladi */
describe('settleWithin', () => {
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ish muddat ichida tugasa: natijasi qaytadi, kutish darhol tugaydi va taymer qolmaydi', async () => {
    await expect(settleWithin(Promise.resolve(7), 3_000)).resolves.toBe(7);
    expect(vi.getTimerCount()).toBe(0);

    const slow = settleWithin(new Promise<string>((resolve) => { setTimeout(() => resolve('tayyor'), 1_000); }), 3_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(slow).resolves.toBe('tayyor');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ish ulgurmasa: aynan muddat tugaganda undefined qaytadi, ish esa fonda oxirigacha bajariladi', async () => {
    let finished = false;
    const work = new Promise<number>((resolve) => { setTimeout(() => { finished = true; resolve(1); }, 10_000); });
    let settled: { value: number | undefined } | null = null;
    void settleWithin(work, 3_000).then((value) => { settled = { value }; });

    await vi.advanceTimersByTimeAsync(2_999);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toEqual({ value: undefined });
    expect(finished).toBe(false);

    await vi.advanceTimersByTimeAsync(7_000);
    expect(finished).toBe(true);
    expect(errors).not.toHaveBeenCalled();
  });

  it('hech qachon osilib qolgan ishni kutib qolmaydi', async () => {
    const p = settleWithin(new Promise<never>(() => undefined), 500);
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toBeUndefined();
  });

  it('xato tashlamaydi: ish xato bilan tugasa undefined qaytadi va xato logga yoziladi', async () => {
    const boom = new Error('telegram ishlamayapti');
    await expect(settleWithin(Promise.reject(boom), 3_000)).resolves.toBeUndefined();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls[0]).toContain(boom);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('muddatdan KEYIN kelgan xato ham ushlanadi (jarayonni yiqitadigan "unhandled rejection" bo\'lmaydi)', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const late = new Error('kechikkan xato');
      const work = new Promise<number>((_, reject) => { setTimeout(() => reject(late), 5_000); });
      const p = settleWithin(work, 1_000);
      await vi.advanceTimersByTimeAsync(1_000);
      await expect(p).resolves.toBeUndefined();
      expect(errors).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(4_000);
      // unhandledRejection hodisasi mikrovazifalardan keyin, navbatdagi "tick"da chiqadi — haqiqiy vaqt bilan kutamiz
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(errors).toHaveBeenCalledTimes(1);
      expect(errors.mock.calls[0]).toContain(late);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
