import { readFileSync } from 'node:fs';
import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Section } from '@/lib/auth/permissions';
import { DB_TESTS, fixture, prisma, waitForBlocked, type Fixture } from './helpers';

vi.mock('server-only', () => ({}));

const { issueStaffCode, linkStaffByCode, linkStaffByPhone, setStaffNotify, staffByTelegram, staffRecipients, unlinkStaff } = await import('@/lib/telegram/staffLink');

describe.skipIf(!DB_TESTS)('telegram/staffLink (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;

  beforeAll(async () => {
    fx = await fixture(4);
  });
  afterAll(async () => {
    await fx?.cleanup();
    await prisma.$disconnect();
  });

  const row = (id: number) => prisma.user.findUniqueOrThrow({ where: { id } });
  const wrongCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

  describe('linkStaffByPhone', () => {
    it('faol xodimni telefoni bo\'yicha ulaydi', async () => {
      const phone = fx.phone();
      const tg = fx.tg();
      const u = await fx.user({ phone, role: 'staff', name: 'Omborchi Olim' });
      const started = Date.now();

      const r = await linkStaffByPhone(Number(tg), `+${phone.slice(0, 3)} ${phone.slice(3, 5)} ${phone.slice(5)}`);
      expect(r).toEqual({ ok: true, user: { id: u.id, name: 'Omborchi Olim', role: 'staff', phone, telegramId: tg, telegramNotify: true } });
      const saved = await row(u.id);
      expect(saved.telegramId).toBe(tg);
      expect(saved.telegramVerifiedAt!.getTime()).toBeGreaterThanOrEqual(started);
      expect(await staffByTelegram(tg)).toEqual({ id: u.id, name: 'Omborchi Olim', role: 'staff', phone, telegramId: tg, telegramNotify: true });
    });

    it('mijoz akkaunti, o\'chirib qo\'yilgan yoki o\'chirilgan xodim ulanmaydi', async () => {
      const tg = fx.tg();
      const customer = await fx.user({ role: 'user' });
      const inactive = await fx.user({ role: 'manager', isActive: false });
      const deleted = await fx.user({ role: 'admin', deletedAt: new Date() });

      for (const u of [customer, inactive, deleted]) {
        expect(await linkStaffByPhone(tg, u.phone)).toEqual({ ok: false, reason: 'not_found' });
        expect((await row(u.id)).telegramId).toBeNull();
      }
      expect(await linkStaffByPhone(tg, fx.phone())).toEqual({ ok: false, reason: 'not_found' }); // ro'yxatda yo'q raqam
      expect(await linkStaffByPhone(tg, '12345')).toEqual({ ok: false, reason: 'not_found' });
      expect(await staffByTelegram(tg)).toBeNull();
    });

    // Telegram kontakti to'liq xalqaro ko'rinishda keladi: 9 xonali yozuvga 998 qo'shilsa, jami 9 raqamli xorijiy raqam egasi
    // shu raqamli xodim (masalan administrator) nomidan ulanib qolardi.
    it('9 xonali raqam faol xodimni ham ulamaydi; to\'liq raqam shundan keyin ham ulaydi', async () => {
      const tg = fx.tg();
      const u = await fx.user({ role: 'admin' });

      for (const nine of [u.phone.slice(3), `+${u.phone.slice(3)}`, `+${u.phone.slice(3, 6)} ${u.phone.slice(6)}`]) {
        expect(await linkStaffByPhone(tg, nine)).toEqual({ ok: false, reason: 'not_found' });
      }
      expect((await row(u.id)).telegramId).toBeNull();
      expect(await staffByTelegram(tg)).toBeNull();
      expect(await linkStaffByPhone(tg, `+${u.phone}`)).toMatchObject({ ok: true, user: { id: u.id, telegramId: tg } });
    });

    it('shu Telegram hisobi boshqa xodimga ulansa, oldingisidan uziladi', async () => {
      const tg = fx.tg();
      const first = await fx.user({ role: 'staff' });
      const second = await fx.user({ role: 'manager' });

      expect(await linkStaffByPhone(tg, first.phone)).toMatchObject({ ok: true, user: { id: first.id, telegramId: tg } });
      expect(await linkStaffByPhone(tg, second.phone)).toMatchObject({ ok: true, user: { id: second.id, telegramId: tg } });
      expect(await row(first.id)).toMatchObject({ telegramId: null, telegramVerifiedAt: null });
      expect((await row(second.id)).telegramId).toBe(tg);
      expect((await staffByTelegram(tg))?.id).toBe(second.id);
    });
  });

  describe('bir martalik kod', () => {
    it('issueStaffCode: 6 xonali kod, 30 daqiqa amal qiladi; qayta berilsa eskisi bekor bo\'ladi', async () => {
      const u = await fx.user({ role: 'staff' });
      const started = Date.now();

      const first = await issueStaffCode(u.id);
      expect(first.code).toMatch(/^\d{6}$/);
      expect(first.expires.getTime()).toBeGreaterThanOrEqual(started + 30 * 60_000);
      expect(first.expires.getTime()).toBeLessThanOrEqual(Date.now() + 30 * 60_000);
      expect(await row(u.id)).toMatchObject({ telegramCode: first.code, otpExpiry: first.expires, telegramId: null });

      // Xodimda har doim bitta kod: yangisi eskisining o'rniga yoziladi
      const second = await issueStaffCode(u.id);
      expect(await row(u.id)).toMatchObject({ telegramCode: second.code, otpExpiry: second.expires });
      await unlinkStaff(u.id); // keyingi testlarga faol kod qolmasin
    });

    it('kod bilan ulanadi (bo\'sh joy bilan yozilsa ham) va faqat bir marta ishlaydi', async () => {
      const u = await fx.user({ role: 'manager', name: 'Menejer Madina' });
      const tg = fx.tg();
      const { code } = await issueStaffCode(u.id);

      const r = await linkStaffByCode(tg, `${code.slice(0, 3)} ${code.slice(3)}`);
      expect(r).toEqual({ ok: true, user: { id: u.id, name: 'Menejer Madina', role: 'manager', phone: u.phone, telegramId: tg, telegramNotify: true } });
      expect(await row(u.id)).toMatchObject({ telegramId: tg, telegramCode: null, otpExpiry: null });

      expect(await linkStaffByCode(fx.tg(), code)).toEqual({ ok: false, reason: 'code' });
      expect((await row(u.id)).telegramId).toBe(tg);
    });

    it('bitta kodni ikki Telegram hisobi bir vaqtda yuborsa faqat bittasi ulanadi', async () => {
      const u = await fx.user({ role: 'staff' });
      const tgs = [fx.tg(), fx.tg()];
      const { code } = await issueStaffCode(u.id);

      // Ikkala chaqiruv ham kodni o'qib, uni sarflashga yetib kelgandagina qo'yib yuboriladi (qator qulflab turiladi)
      const held = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${u.id} FOR UPDATE`;
          const race = Promise.all(tgs.map((tg) => linkStaffByCode(tg, code)));
          await waitForBlocked(tx, 2);
          return { race };
        },
        { timeout: 15_000 },
      );
      const results = await held.race;

      const won = results.flatMap((r) => (r.ok ? [r.user] : []));
      expect(won).toHaveLength(1);
      expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: 'code' }]);
      expect(tgs).toContain(won[0].telegramId);
      expect(await row(u.id)).toMatchObject({ telegramId: won[0].telegramId, telegramCode: null, otpExpiry: null });
    });

    it('noto\'g\'ri yoki chala kod ulamaydi; to\'g\'ri kod shundan keyin ham ishlaydi', async () => {
      const u = await fx.user({ role: 'staff' });
      const tg = fx.tg();
      const { code } = await issueStaffCode(u.id);

      for (const bad of [wrongCode(code), code.slice(0, 5), `${code}0`, '', 'abcdef']) expect(await linkStaffByCode(tg, bad)).toEqual({ ok: false, reason: 'code' });
      expect(await row(u.id)).toMatchObject({ telegramId: null, telegramCode: code });
      expect(await linkStaffByCode(tg, code)).toMatchObject({ ok: true, user: { id: u.id } });
    });

    it('muddati o\'tgan kod ulamaydi', async () => {
      const u = await fx.user({ role: 'staff' });
      const { code } = await issueStaffCode(u.id);
      await prisma.user.update({ where: { id: u.id }, data: { otpExpiry: new Date(Date.now() - 1000) } });

      expect(await linkStaffByCode(fx.tg(), code)).toEqual({ ok: false, reason: 'code' });
      expect((await row(u.id)).telegramId).toBeNull();
    });

    it('kod berilgandan keyin o\'chirib qo\'yilgan xodim ulanmaydi', async () => {
      const u = await fx.user({ role: 'staff' });
      const { code } = await issueStaffCode(u.id);
      await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });

      expect(await linkStaffByCode(fx.tg(), code)).toEqual({ ok: false, reason: 'code' });
      expect((await row(u.id)).telegramId).toBeNull();
    });
  });

  describe('staffByTelegram', () => {
    it('admin panelda o\'chirib qo\'yilgan, roli olingan yoki o\'chirilgan xodim botdan darhol uziladi', async () => {
      const changes = [{ isActive: false }, { role: 'user' as const }, { deletedAt: new Date() }];
      for (const change of changes) {
        const u = await fx.user({ role: 'manager', telegramId: fx.tg() });
        expect((await staffByTelegram(u.telegramId!))?.id).toBe(u.id);
        await prisma.user.update({ where: { id: u.id }, data: change });
        expect(await staffByTelegram(u.telegramId!)).toBeNull();
      }
      expect(await staffByTelegram(fx.tg())).toBeNull(); // hech kimga ulanmagan hisob
    });

    it('mijoz akkauntining Telegram ID si xodim sifatida qabul qilinmaydi', async () => {
      const u = await fx.user({ role: 'user', telegramId: fx.tg() });
      expect(await staffByTelegram(u.telegramId!)).toBeNull();
    });
  });

  // staffByTelegram "User.telegramId" ustuniga ishonadi, bu ustunni esa eski botlar zaifroq tekshiruv bilan to'ldirgan. Shuning uchun
  // 6_bots_orders migratsiyasi eski qiymatlarni bir marta tozalaydi. Bu yerda migratsiyadagi so'rovning o'zi bajariladi, lekin haqiqiy
  // jadvalga tegmasdan: tranzaksiya ichida shu nomli vaqtinchalik jadval ochiladi (PostgreSQL uni haqiqiysidan oldin topadi) va
  // tranzaksiya tugashi bilan yo'qoladi — bazadagi boshqa (parallel testlar yaratgan) xodimlarga ta'sir qilmaydi.
  describe('eski tizimdan qolgan ulanishlar (6_bots_orders migratsiyasi)', () => {
    type Row = { id: number; name: string; phone: string; role: string; isActive: boolean; telegramId: string | null; telegramVerifiedAt: Date | null; telegramCode: string | null; otpExpiry: Date | null };
    const migration = () => readFileSync(new URL('../../../../prisma/migrations/6_bots_orders/migration.sql', import.meta.url), 'utf8');

    it('eski telegramId, tasdiq vaqti va kod tozalanadi; boshqa ustunlar va ulanmagan foydalanuvchilar o\'zgarmaydi', async () => {
      const reset = /UPDATE "User"[^;]+;/.exec(migration())?.[0];
      expect(reset, 'migratsiyada eski ulanishlarni tozalaydigan UPDATE "User" bo\'lishi kerak').toBeDefined();

      const legacyStaff = await fx.user({ role: 'manager', name: 'Eski menejer', telegramId: fx.tg(), telegramVerifiedAt: new Date('2024-01-01T00:00:00Z') });
      const legacyCustomer = await fx.user({ role: 'user', telegramId: fx.tg() }); // keyin "Yangi xodim" orqali xodimga aylantirilishi mumkin
      const pendingCode = await fx.user({ role: 'staff', telegramCode: '123456', otpExpiry: new Date(Date.now() + 60_000) });
      const clean = await fx.user({ role: 'admin', isActive: false });
      const users = [legacyStaff, legacyCustomer, pendingCode, clean];
      const ids = users.map((u) => u.id);

      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('CREATE TEMP TABLE "User" (LIKE public."User") ON COMMIT DROP');
        const [{ temp }] = await tx.$queryRaw<{ temp: boolean }[]>`SELECT '"User"'::regclass = 'pg_temp."User"'::regclass AS temp`;
        if (!temp) throw new Error('"User" vaqtinchalik jadvalni ko\'rsatmayapti — so\'rov haqiqiy jadvalda bajarilmaydi');
        await tx.$executeRaw`INSERT INTO "User" SELECT * FROM public."User" WHERE id IN (${Prisma.join(ids)})`;
        const changed = await tx.$executeRawUnsafe(reset!);
        const rows = await tx.$queryRaw<Row[]>`SELECT id, name, phone, role::text AS role, "isActive", "telegramId", "telegramVerifiedAt", "telegramCode", "otpExpiry" FROM "User" ORDER BY id`;
        return { changed, rows };
      });

      expect(result.changed).toBe(3); // ulanmagan, kodi yo'q qatorga tegilmaydi
      expect(result.rows).toEqual(users.map((u) => ({ id: u.id, name: u.name, phone: u.phone, role: u.role, isActive: u.isActive, telegramId: null, telegramVerifiedAt: null, telegramCode: null, otpExpiry: null })));
      // Haqiqiy jadval o'zgarmagan: so'rov faqat vaqtinchalik nusxada bajarildi
      expect(await row(legacyStaff.id)).toMatchObject({ telegramId: legacyStaff.telegramId, telegramVerifiedAt: legacyStaff.telegramVerifiedAt });
      expect((await row(pendingCode.id)).telegramCode).toBe('123456');
    });
  });

  describe('unlinkStaff va setStaffNotify', () => {
    it('uzilgan xodim botda tanilmaydi; xabarnoma sozlamasi saqlanadi', async () => {
      const u = await fx.user({ role: 'staff', telegramId: fx.tg() });
      await issueStaffCode(u.id);

      await setStaffNotify(u.id, false);
      expect(await staffByTelegram(u.telegramId!)).toMatchObject({ id: u.id, telegramNotify: false });
      await setStaffNotify(u.id, true);
      expect((await row(u.id)).telegramNotify).toBe(true);

      await unlinkStaff(u.id);
      expect(await staffByTelegram(u.telegramId!)).toBeNull();
      expect(await row(u.id)).toMatchObject({ telegramId: null, telegramVerifiedAt: null, telegramCode: null, otpExpiry: null, isActive: true });
    });
  });

  describe('staffRecipients', () => {
    it('bo\'lim ruxsati, botga ulanganlik va xabarnoma sozlamasi bo\'yicha saralaydi', async () => {
      const worker = await fx.user({ role: 'staff', telegramId: fx.tg() });
      const manager = await fx.user({ role: 'manager', telegramId: fx.tg() });
      const admin = await fx.user({ role: 'admin', telegramId: fx.tg() });
      const muted = await fx.user({ role: 'manager', telegramId: fx.tg(), telegramNotify: false });
      const unlinked = await fx.user({ role: 'admin' });
      const inactive = await fx.user({ role: 'admin', telegramId: fx.tg(), isActive: false });
      const deleted = await fx.user({ role: 'admin', telegramId: fx.tg(), deletedAt: new Date() });
      const customer = await fx.user({ role: 'user', telegramId: fx.tg() });

      // Bazada boshqa test fayllarining xodimlari ham bo'lishi mumkin — faqat o'zimiznikilarga qaraymiz
      const ours = new Set([worker, manager, admin, muted, unlinked, inactive, deleted, customer].map((u) => u.id));
      const got = async (section: Section) => (await staffRecipients(section)).filter((u) => ours.has(u.id)).map((u) => u.id).sort((a, b) => a - b);

      expect(await got('orders')).toEqual([worker.id, manager.id, admin.id]);
      expect(await got('finance')).toEqual([manager.id, admin.id]); // oddiy xodimda moliya ruxsati yo'q
      expect(await got('settings')).toEqual([admin.id]);

      const [first] = (await staffRecipients('finance')).filter((u) => u.id === manager.id);
      expect(first).toEqual({ id: manager.id, name: manager.name, role: 'manager', phone: manager.phone, telegramId: manager.telegramId, telegramNotify: true });

      await setStaffNotify(manager.id, false);
      expect(await got('finance')).toEqual([admin.id]);
    });
  });
});
