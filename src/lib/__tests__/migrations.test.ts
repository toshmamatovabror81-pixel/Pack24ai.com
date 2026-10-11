import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Prisma migratsiyalarni papka NOMI bo'yicha (bayt tartibida) qo'llaydi, raqam qiymati bo'yicha emas. Shuning uchun "10_..." nomi
 * "1_site_v2" dan OLDIN tushadi: ishlab turgan bazada sezilmaydi (u yerda faqat yangi migratsiya qo'llanadi), lekin bo'sh bazada
 * (CI, zaxirani tiklash, yangi server) u hali yaratilmagan jadvalga murojaat qilib yiqiladi yoki tartib ishlab turgan bazadagidan
 * farq qiladi. Bir xonali raqamlar tugagan (9_...), keyingilari "9a_", "9b_", ... deb nomlanadi — ular "9_..." dan keyin turadi.
 */
describe('migratsiya nomlari', () => {
  const names = readdirSync('prisma/migrations', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

  it('ikki va undan ko\'p xonali raqam bilan boshlanmaydi (10_... nomi 1_... dan oldin qo\'llanib, bo\'sh bazada tartibni buzadi)', () => {
    expect(names.length).toBeGreaterThan(9);
    expect(names.filter((n) => /^\d{2,}_/.test(n))).toEqual([]);
  });

  it('"9_..." dan keyingi migratsiyalar nom tartibida ham ulardan keyin turadi (9a_, 9b_, ...)', () => {
    // sort() — UTF-16 birliklari bo'yicha; ASCII nomlarda bu Prisma ishlatadigan bayt tartibi bilan bir xil
    const sorted = [...names].sort();
    const lastNine = sorted.findLastIndex((n) => n.startsWith('9_'));
    expect(lastNine).toBeGreaterThan(-1);
    expect(sorted.slice(lastNine + 1).every((n) => /^9[a-z]_/.test(n))).toBe(true);
    expect(sorted).toContain('9a_payment_undo');
    expect(sorted.indexOf('9a_payment_undo')).toBeGreaterThan(sorted.indexOf('9_payme_amount_bigint'));
  });
});
