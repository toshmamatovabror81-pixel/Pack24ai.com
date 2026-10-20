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

  /**
   * Qo'llanish tartibi (nom tartibi) = yaratilish tartibi. Yangi migratsiya FAQAT shu ro'yxat OXIRIGA qo'shiladi (keyingisi 9c_...),
   * o'rtasiga emas: nomi oldingilaridan keyin turmasa (masalan 9a_boshqa — "9a_p..." dan oldin, 9_zzz — "9a_" dan oldin, 9A_x — "9_" dan
   * oldin) tartiblangan ro'yxat bunga teng chiqmaydi va test o'sha nomni ko'rsatadi. Faqat shakl tekshiruvi (9[a-z]_) buni o'tkazib yuborardi.
   */
  const APPLIED = ['0_init', '1_site_v2', '2_b2b', '3_recycling', '4_recycling_accepted', '5_remove_recycling', '6_bots_orders', '7_ai', '8_outbox', '9_payme_amount_bigint', '9a_payment_undo', '9b_customer_bot_name'];

  it('papkalar aynan ro\'yxatdagilar va nom tartibi yaratilish tartibi bilan bir xil (yangi nom ro\'yxat oxiriga qo\'shiladi va oldingilaridan keyin turishi shart)', () => {
    // sort() — UTF-16 birliklari bo'yicha; ASCII nomlarda bu Prisma ishlatadigan bayt tartibi bilan bir xil
    expect([...names].sort()).toEqual(APPLIED);
    // Ro'yxatning o'zi ham qat'iy o'sib boradi: o'rtasiga nom qo'shib "tuzatilgan" ro'yxat ham o'tmaydi
    for (let i = 1; i < APPLIED.length; i++) expect(APPLIED[i] > APPLIED[i - 1], `${APPLIED[i - 1]} < ${APPLIED[i]}`).toBe(true);
    expect(APPLIED.at(-1)).toBe('9b_customer_bot_name');
  });
});
