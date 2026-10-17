import { describe, expect, it } from 'vitest';
import { date, num, tashkentDay } from '../formData';

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

describe('formData', () => {
  it('tashkentDay: <input type="date"> kuni Toshkent vaqti bilan — boshi 00:00, oxiri 23:59:59.999 (+05:00)', () => {
    const f = fd({ startsAt: '2026-10-01', endsAt: '2026-10-31' });
    expect(tashkentDay(f, 'startsAt')!.toISOString()).toBe('2026-09-30T19:00:00.000Z');
    expect(tashkentDay(f, 'endsAt', true)!.toISOString()).toBe('2026-10-31T18:59:59.999Z');
    // date() esa UTC yarim tun deb olardi — Toshkentda soat 05:00 (promokod kunning qolgan 19 soatida ishlamasdi)
    expect(date(f, 'endsAt')!.toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });

  it('tashkentDay: bo\'sh yoki noto\'g\'ri qiymat null', () => {
    expect(tashkentDay(fd({}), 'd')).toBeNull();
    expect(tashkentDay(fd({ d: '' }), 'd')).toBeNull();
    expect(tashkentDay(fd({ d: '31.10.2026' }), 'd')).toBeNull();
    expect(tashkentDay(fd({ d: '2026-13-45' }), 'd')).toBeNull();
    expect(tashkentDay(fd({ d: '2026-10-31T10:00' }), 'd')).toBeNull();
  });

  it('num: bo\'shliq va vergul', () => {
    expect(num(fd({ n: '12 000,50' }), 'n')).toBe(12000.5);
    expect(num(fd({ n: '' }), 'n')).toBeNull();
    expect(num(fd({ n: 'abc' }), 'n')).toBeNull();
  });
});
