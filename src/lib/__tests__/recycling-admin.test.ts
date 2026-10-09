import { describe, expect, it } from 'vitest';
import { dayEnd, parseDayStart, tashkentDayStart } from '@/components/admin/recycling/dates';
import { colorHex, isPointColor, POINT_COLORS } from '@/components/admin/recycling/pointColors';

describe('admin recycling: Toshkent kuni', () => {
  it("bugungi kun boshi — Toshkent yarim tuni (UTC 19:00 oldingi kun)", () => {
    // 2026-10-08 03:30 Toshkent = 2026-10-07 22:30 UTC → kun boshi 2026-10-07T19:00Z
    const start = tashkentDayStart(new Date('2026-10-07T22:30:00Z'));
    expect(start.toISOString()).toBe('2026-10-07T19:00:00.000Z');
    // 2026-10-07 23:30 Toshkent = 18:30 UTC → hali 7-oktabr: boshi 2026-10-06T19:00Z
    expect(tashkentDayStart(new Date('2026-10-07T18:30:00Z')).toISOString()).toBe('2026-10-06T19:00:00.000Z');
  });
  it('sana parametri', () => {
    expect(parseDayStart('2026-10-08')?.toISOString()).toBe('2026-10-07T19:00:00.000Z');
    expect(dayEnd(parseDayStart('2026-10-08')!).toISOString()).toBe('2026-10-08T19:00:00.000Z');
    expect(parseDayStart('2026-13-01')).toBeNull();
    expect(parseDayStart('2026-02-30')).toBeNull();
    expect(parseDayStart('08.10.2026')).toBeNull();
    expect(parseDayStart(undefined)).toBeNull();
  });
});

describe('admin recycling: punkt ranglari', () => {
  it('klass → hex, noma\'lum klass → standart yashil', () => {
    expect(POINT_COLORS.length).toBeGreaterThan(5);
    expect(colorHex('bg-blue-500')).toBe('#3b82f6');
    expect(colorHex('bg-nope')).toBe('#10b981');
    expect(isPointColor('bg-emerald-500')).toBe(true);
    expect(isPointColor('red')).toBe(false);
  });
});
