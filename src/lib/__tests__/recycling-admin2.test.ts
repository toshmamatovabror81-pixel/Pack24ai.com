import { describe, expect, it } from 'vitest';
import { dayRange, hasTime, monthRange, summarize, tashkentKey } from '@/app/admin/(panel)/recycling/journal/shared';

const D = (s: string) => new Date(s);

describe('admin jurnal: Toshkent kuni oralig\'i', () => {
  it('kanonik sana ham, shu kunga tushgan vaqt belgili sana ham oraliqda', () => {
    const day = D('2026-10-08T00:00:00Z');
    const r = dayRange(day);
    expect(r.gte.toISOString()).toBe('2026-10-07T19:00:00.000Z');
    expect(r.lt.toISOString()).toBe('2026-10-08T19:00:00.000Z');
    const inRange = (d: Date) => d >= r.gte && d < r.lt;
    expect(inRange(day)).toBe(true); // kanonik
    expect(inRange(D('2026-10-08T15:45:53Z'))).toBe(true); // acceptAtBase vaqt belgisi (20:45 Toshkent)
    expect(inRange(D('2026-10-08T18:59:59Z'))).toBe(true); // 23:59 Toshkent
    expect(inRange(D('2026-10-08T19:00:00Z'))).toBe(false); // 9-oktabr 00:00 Toshkent
    expect(inRange(D('2026-10-09T00:00:00Z'))).toBe(false); // keyingi kanonik kun
    expect(inRange(D('2026-10-07T00:00:00Z'))).toBe(false); // oldingi kanonik kun
  });
  it('tashkentKey: kanonik sana o\'zgarmaydi, vaqt belgili sana Toshkent kuniga tushadi', () => {
    expect(tashkentKey(D('2026-10-08T00:00:00Z'))).toBe('2026-10-08');
    expect(tashkentKey(D('2026-10-08T15:45:53Z'))).toBe('2026-10-08');
    expect(tashkentKey(D('2026-10-08T22:00:00Z'))).toBe('2026-10-09');
    expect(hasTime(D('2026-10-08T00:00:00Z'))).toBe(false);
    expect(hasTime(D('2026-10-08T15:45:53Z'))).toBe(true);
  });
  it('monthRange oy chegaralari Toshkent bo\'yicha', () => {
    const r = monthRange(2026, 10);
    expect(r.gte.toISOString()).toBe('2026-09-30T19:00:00.000Z');
    expect(r.lt.toISOString()).toBe('2026-10-31T19:00:00.000Z');
  });
});

describe('admin jurnal: kun yig\'indisi', () => {
  it('punktda ochilish — masullar yig\'indisi (har masul uchun bitta), yakun formulasi', () => {
    const s = summarize(D('2026-10-20T00:00:00Z'), {
      cash: [{ supervisorId: 1, openingBalance: '100000' }, { supervisorId: 2, openingBalance: '900000' }, { supervisorId: 1, openingBalance: '5' }],
      intake: [{ weightKg: 120, totalAmount: '96000' }],
      press: [{ pressedKg: 10, baleCount: 2 }],
      expense: [{ expenseAmount: '1000', advanceAmount: '500' }],
      sales: [{ weightKg: 50, totalAmount: '60000' }],
    });
    expect(s.opening).toBe(1_000_000);
    expect(s.openingCount).toBe(2);
    expect(s.closing).toBe(1_000_000 + 60_000 - 96_000 - 1000 - 500);
    expect(s.intakeKg).toBe(120);
    expect(s.bales).toBe(2);
  });
  it('ochilish yo\'q — yakun null', () => {
    const s = summarize(D('2026-10-20T00:00:00Z'), { cash: [], intake: [], press: [], expense: [], sales: [] });
    expect(s.opening).toBeNull();
    expect(s.closing).toBeNull();
  });
});
