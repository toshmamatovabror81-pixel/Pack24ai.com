import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: {} }));

const { nextSeq, splitVat } = await import('@/lib/documents');

describe('hujjat raqamlari', () => {
  it('navbatdagi tartib raqami sonli hisoblanadi: 9999 dan keyin 10000 (matn bo\'yicha "INV-2026-9999" kattaroq chiqardi)', () => {
    const p = 'INV-2026-';
    expect(nextSeq([], p)).toBe(1);
    expect(nextSeq([`${p}0007`, `${p}0003`], p)).toBe(8);
    expect(nextSeq([`${p}9999`, `${p}10000`], p)).toBe(10001);
    expect(nextSeq([`${p}10000`, `${p}9999`], p)).toBe(10001);
    // Qo'lda yozilgan yaroqsiz raqam hisobga olinmaydi
    expect(nextSeq([`${p}abc`, `${p}0002`], p)).toBe(3);
    expect(nextSeq(['SH-2026-003', 'SH-2026-010'], 'SH-2026-')).toBe(11);
  });

  it('QQS jamidan ajratiladi', () => {
    expect(splitVat(112, 12)).toEqual({ subtotal: 100, vatAmount: 12, vatPercent: 12 });
    expect(splitVat(100, 0)).toEqual({ subtotal: 100, vatAmount: 0, vatPercent: 0 });
  });
});
