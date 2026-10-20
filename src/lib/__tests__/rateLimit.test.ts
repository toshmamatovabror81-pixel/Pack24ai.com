import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * IP bo'yicha cheklov (parol tanlash, spam, promokod terish). Mijoz IP manzili X-Forwarded-For ning OXIRGI elementidan olinadi:
 * uni proksi (nginx/Caddy) o'zi yozadi. Birinchi elementni mijoz o'zi yuborishi mumkin — nginx `$proxy_add_x_forwarded_for`
 * uni saqlab, oxiriga haqiqiy manzilni qo'shadi; birinchisi olinsa har so'rovda boshqa manzil yozib cheklov chetlab o'tilardi.
 */
const h = vi.hoisted(() => ({ headers: new Map<string, string>() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => ({ get: (k: string) => h.headers.get(k.toLowerCase()) ?? null }) }));

const { clientIp, rateLimit } = await import('@/lib/rateLimit');
const set = (o: Record<string, string>) => { h.headers.clear(); for (const [k, v] of Object.entries(o)) h.headers.set(k.toLowerCase(), v); };

beforeEach(() => h.headers.clear());

describe('clientIp', () => {
  it('X-Forwarded-For ning oxirgi (proksi yozgan) elementi olinadi, mijoz yozgan birinchisi emas', async () => {
    set({ 'x-forwarded-for': '10.9.1.1, 84.54.70.12' });
    expect(await clientIp()).toBe('84.54.70.12');
    set({ 'x-forwarded-for': '10.9.1.1,10.9.2.2 , 84.54.70.12 ' });
    expect(await clientIp()).toBe('84.54.70.12');
    // Caddy sarlavhani butunlay almashtiradi: bitta element
    set({ 'x-forwarded-for': '84.54.70.12' });
    expect(await clientIp()).toBe('84.54.70.12');
  });

  it('X-Real-IP faqat zaxira (Caddy mijoz yuborgan X-Real-IP ni o\'zgartirmaydi — u birinchi o\'rinda ishlatilmaydi)', async () => {
    set({ 'x-forwarded-for': '84.54.70.12', 'x-real-ip': '10.9.1.1' });
    expect(await clientIp()).toBe('84.54.70.12');
    set({ 'x-real-ip': '84.54.70.13' });
    expect(await clientIp()).toBe('84.54.70.13');
    set({});
    expect(await clientIp()).toBe('unknown');
    // Bo'sh yoki faqat vergul: ma'nosiz qiymat o'rniga zaxira
    set({ 'x-forwarded-for': ' , ', 'x-real-ip': '84.54.70.14' });
    expect(await clientIp()).toBe('84.54.70.14');
  });
});

describe('rateLimit', () => {
  it('birinchi element har so\'rovda o\'zgartirilsa ham cheklov bitta manzilga tegishli bo\'lib qoladi', async () => {
    const scope = `t-${Math.random()}`;
    for (let i = 1; i <= 3; i += 1) {
      set({ 'x-forwarded-for': `10.9.${i}.${i}, 84.54.70.12` });
      expect(await rateLimit(scope, 3, 60_000)).toBe(true);
    }
    set({ 'x-forwarded-for': '10.9.9.9, 84.54.70.12' });
    expect(await rateLimit(scope, 3, 60_000)).toBe(false);
    // Boshqa haqiqiy manzil — o'z hisobi
    set({ 'x-forwarded-for': '10.9.9.9, 84.54.70.99' });
    expect(await rateLimit(scope, 3, 60_000)).toBe(true);
  });
});
