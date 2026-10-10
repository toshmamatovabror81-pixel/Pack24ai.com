import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DB_TESTS, fixture, prisma, waitForBlocked, type Fixture } from './helpers';

vi.mock('server-only', () => ({}));

const { bindOrderByToken, botCustomer, customerScope, ensureBotCustomer, linkCustomerPhone, orderRecipients, setCustomerLang, setCustomerNotify, unlinkCustomer } = await import('@/lib/telegram/customers');

describe.skipIf(!DB_TESTS)('telegram/customers (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;

  beforeAll(async () => {
    fx = await fixture(2);
  });
  afterAll(async () => {
    await fx?.cleanup();
    await prisma.$disconnect();
  });

  const boundTo = async (orderId: number) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { telegramUserId: true } })).telegramUserId;
  const byId = <T extends { telegramId: string }>(list: T[]) => [...list].sort((a, b) => a.telegramId.localeCompare(b.telegramId));

  describe('linkCustomerPhone', () => {
    it('raqamni bir xil ko\'rinishga keltirib bog\'laydi', async () => {
      const phone = fx.phone();
      const tg = fx.tg();
      const started = Date.now();

      const linked = await linkCustomerPhone(tg, `+${phone.slice(0, 3)} (${phone.slice(3, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`, 'Ali Valiyev');
      expect(linked).toMatchObject({ telegramId: tg, phone, name: 'Ali Valiyev', lang: 'uz', notify: true });
      expect(linked!.verifiedAt!.getTime()).toBeGreaterThanOrEqual(started);
      expect(await botCustomer(tg)).toEqual(linked);

      // Sonli Telegram ID ham qabul qilinadi
      const phone2 = fx.phone();
      const tg2 = fx.tg();
      expect(await linkCustomerPhone(Number(tg2), phone2)).toMatchObject({ telegramId: tg2, phone: phone2, name: null });
    });

    // Telegram o'z kontaktini to'liq xalqaro ko'rinishda beradi. 9 xonali yozuvga 998 qo'shilsa, jami 9 raqamli xorijiy raqam
    // (+508 41 12 34) egasi shu raqamli O'zbekiston mijozining buyurtma va qarzini ko'rib qolardi.
    it('9 xonali raqam (mahalliy ko\'rinish yoki qisqa xorijiy raqam) bog\'lanmaydi va mavjud mijozga tegmaydi', async () => {
      const phone = fx.phone();
      const owner = fx.tg();
      const stranger = fx.tg();
      await linkCustomerPhone(owner, phone, 'Haqiqiy ega');

      for (const nine of [phone.slice(3), `+${phone.slice(3)}`, `+${phone.slice(3, 6)} ${phone.slice(6)}`]) expect(await linkCustomerPhone(stranger, nine)).toBeNull();
      expect(await botCustomer(stranger)).toBeNull();
      expect(await botCustomer(owner)).toMatchObject({ phone, name: 'Haqiqiy ega' });
    });

    // Telegram ismi 64 + 64 belgigacha bo'ladi. UTF-16 bo'yicha kesish emoji o'rtasidan bo'lsa, yarim surrogatni Prisma rad etardi:
    // bunday mijozga /start ham, kontakt ulashish ham har safar "Xatolik yuz berdi" bilan tugardi.
    it('100 belgidan uzun, chegarasida emoji turgan ism: yozuv yaratiladi va telefon ulanadi, ismda yarim emoji qolmaydi', async () => {
      const name = `${'N'.repeat(64)} ${'L'.repeat(34)}😀😀`; // 100-chi UTF-16 birligi — birinchi emojining yarmi
      const cut = `${'N'.repeat(64)} ${'L'.repeat(34)}`; // chegaraga tushgan emoji butunligicha tashlanadi (telegram/api.ts clip)
      expect(name.slice(0, 100).isWellFormed()).toBe(false);

      const tg = fx.tg();
      expect(await ensureBotCustomer(tg, { name, lang: 'ru' })).toMatchObject({ telegramId: tg, name: cut, lang: 'ru' });
      // Telefonni ulash: mavjud yozuvda (update) ham, yangi yozuvda (create) ham
      const phone = fx.phone();
      expect(await linkCustomerPhone(tg, phone, `${name}!`)).toMatchObject({ phone, name: cut, lang: 'ru' });
      const fresh = fx.tg();
      expect(await linkCustomerPhone(fresh, fx.phone(), name)).toMatchObject({ telegramId: fresh, name: cut });
      // 100 belgidan qisqa ism o'zgarmaydi
      expect(await ensureBotCustomer(fx.tg(), { name: 'Ali 😀' })).toMatchObject({ name: 'Ali 😀' });
    });

    it('oldin /start bosgan foydalanuvchining tili saqlanadi, ism berilmasa eskisi qoladi', async () => {
      const tg = fx.tg();
      const phone = fx.phone();
      await ensureBotCustomer(tg, { name: 'Vali', lang: 'ru' });

      expect(await linkCustomerPhone(tg, phone)).toMatchObject({ telegramId: tg, phone, name: 'Vali', lang: 'ru' });
      expect(await prisma.telegramCustomer.count({ where: { telegramId: tg } })).toBe(1);
    });

    it('raqamni boshqa Telegram hisobi tasdiqlasa, eski hisobdan uziladi', async () => {
      const phone = fx.phone();
      const first = fx.tg();
      const second = fx.tg();
      await linkCustomerPhone(first, phone, 'Eski ega');

      expect(await linkCustomerPhone(second, phone, 'Yangi ega')).toMatchObject({ telegramId: second, phone });
      expect(await botCustomer(first)).toMatchObject({ phone: null, verifiedAt: null, name: 'Eski ega' });
      expect(await prisma.telegramCustomer.findMany({ where: { phone }, select: { telegramId: true } })).toEqual([{ telegramId: second }]);
    });

    it('noto\'g\'ri raqam: null qaytadi, yozuv yaratilmaydi va eski bog\'lanish buzilmaydi', async () => {
      const tg = fx.tg();
      for (const bad of ['', 'abc', '12345', '901234567', '+508 41 12 34', '+7 900 123 45 67', '99890123456']) expect(await linkCustomerPhone(tg, bad)).toBeNull();
      expect(await botCustomer(tg)).toBeNull();

      const phone = fx.phone();
      await linkCustomerPhone(tg, phone);
      expect(await linkCustomerPhone(tg, '12345')).toBeNull();
      expect(await botCustomer(tg)).toMatchObject({ phone });
    });
  });

  describe('bindOrderByToken', () => {
    it('ulanmagan buyurtmani chatga bog\'laydi; o\'sha chat qayta so\'rasa natija o\'zgarmaydi', async () => {
      const o = await fx.order({ contactPhone: fx.phone() });
      const tg = fx.tg();

      expect(await bindOrderByToken(tg, o.accessToken!)).toMatchObject({ bound: true, order: { id: o.id, telegramUserId: tg } });
      expect(await boundTo(o.id)).toBe(tg);
      expect(await bindOrderByToken(Number(tg), o.accessToken!)).toMatchObject({ bound: true, order: { id: o.id, telegramUserId: tg } });
      expect(await boundTo(o.id)).toBe(tg);
    });

    it('boshqa chatga ulangan buyurtma qayta bog\'lanmaydi', async () => {
      const o = await fx.order();
      const owner = fx.tg();
      const stranger = fx.tg();
      await bindOrderByToken(owner, o.accessToken!);

      expect(await bindOrderByToken(stranger, o.accessToken!)).toMatchObject({ bound: false, order: { id: o.id, telegramUserId: owner } });
      expect(await boundTo(o.id)).toBe(owner);
    });

    it('ikki chat bir vaqtda so\'rasa faqat bittasi bog\'lanadi', async () => {
      const o = await fx.order();
      const a = fx.tg();
      const b = fx.tg();

      const results = await Promise.all([bindOrderByToken(a, o.accessToken!), bindOrderByToken(b, o.accessToken!)]);
      expect(results.filter((r) => r?.bound)).toHaveLength(1);
      const winner = results[0]?.bound ? a : b;
      expect(await boundTo(o.id)).toBe(winner);
    });

    it('buzuq, noma\'lum yoki o\'chirilgan buyurtma kaliti: null', async () => {
      const o = await fx.order();
      const tg = fx.tg();
      const token = o.accessToken!;
      for (const bad of ['', 'qisqa', token.slice(0, 19), `${token}${'a'.repeat(17)}`, `${token.slice(0, 20)} ab`, `${token.slice(0, 20)}'--`, `${token.slice(0, 20)}%_`]) {
        expect(await bindOrderByToken(tg, bad)).toBeNull();
      }
      // Ko'rinishi to'g'ri, lekin bunday buyurtma yo'q (oxirgi belgi almashtirilgan)
      expect(await bindOrderByToken(tg, `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`)).toBeNull();
      expect(await boundTo(o.id)).toBeNull();

      const deleted = await fx.order({ deletedAt: new Date() });
      expect(await bindOrderByToken(tg, deleted.accessToken!)).toBeNull();
      expect(await boundTo(deleted.id)).toBeNull();
    });
  });

  describe('unlinkCustomer', () => {
    it('yozuvni o\'chiradi va havola orqali ulangan buyurtmalarni uzadi; boshqalarnikiga tegmaydi', async () => {
      const phone = fx.phone();
      const tg = fx.tg();
      const other = fx.tg();
      await linkCustomerPhone(tg, phone, 'Ketuvchi');
      await fx.customer({ telegramId: other });
      const mine = await fx.order({ contactPhone: phone });
      const theirs = await fx.order();
      await bindOrderByToken(tg, mine.accessToken!);
      await bindOrderByToken(other, theirs.accessToken!);

      await unlinkCustomer(tg);
      expect(await botCustomer(tg)).toBeNull();
      expect(await boundTo(mine.id)).toBeNull();
      expect(await botCustomer(other)).not.toBeNull();
      expect(await boundTo(theirs.id)).toBe(other);
      // Buyurtmaning o'zi joyida qoladi
      expect(await prisma.order.findUnique({ where: { id: mine.id }, select: { contactPhone: true, deletedAt: true } })).toEqual({ contactPhone: phone, deletedAt: null });

      await expect(unlinkCustomer(tg)).resolves.toBeUndefined(); // ikkinchi marta ham xatosiz
    });
  });

  describe('sozlamalar', () => {
    it('ensureBotCustomer mavjud yozuvni o\'zgartirmaydi; til va xabarnoma alohida saqlanadi', async () => {
      const tg = fx.tg();
      const created = await ensureBotCustomer(tg, { name: 'Sardor', lang: 'ru' });
      expect(created).toMatchObject({ telegramId: tg, name: 'Sardor', lang: 'ru', notify: true, phone: null, verifiedAt: null });
      expect(await ensureBotCustomer(tg, { name: 'Boshqa', lang: 'uz' })).toEqual(created);

      await setCustomerLang(tg, 'uz');
      await setCustomerNotify(tg, false);
      expect(await botCustomer(tg)).toMatchObject({ name: 'Sardor', lang: 'uz', notify: false });

      // Yozuvi yo'q foydalanuvchi til tanlasa — yozuv yaratiladi
      const fresh = fx.tg();
      await setCustomerLang(fresh, 'ru');
      expect(await botCustomer(fresh)).toMatchObject({ lang: 'ru', phone: null });
    });

    // Yangi foydalanuvchidan ikki murojaat bir vaqtda kelsa (ikki marta bosish, Telegram webhook'ni qayta yuborishi) ikkalasi ham
    // "yozuv yo'q" deb o'qiydi. Ilgari ensureBotCustomer upsert (`update: {}`) edi — Prisma uni SELECT + INSERT qilib bajarardi va
    // bittasi P2002 (unique) xatosi bilan yiqilib, mijoz "Xatolik yuz berdi" javobini olardi.
    it('yangi foydalanuvchidan bir vaqtda kelgan ikki murojaat: ikkalasi ham o\'sha bitta yozuvni oladi', async () => {
      const tg = fx.tg();
      const held = await prisma.$transaction(
        async (tx) => {
          // Shu ID bilan tugallanmagan yozuv ushlab turiladi: ikkala chaqiruv ham yaratishga yetib kelib shu yerda kutadi
          await tx.telegramCustomer.create({ data: { telegramId: tg } });
          const calls = Promise.allSettled([ensureBotCustomer(tg, { name: 'Ali', lang: 'ru' }), ensureBotCustomer(tg, { name: 'Ali', lang: 'ru' })]);
          await waitForBlocked(tx, 2);
          await tx.telegramCustomer.delete({ where: { telegramId: tg } });
          return { calls };
        },
        { timeout: 15_000 },
      );
      const results = await held.calls;

      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
      expect(new Set(results.map((r) => (r.status === 'fulfilled' ? r.value.id : null))).size).toBe(1);
      expect(await prisma.telegramCustomer.findMany({ where: { telegramId: tg }, select: { name: true, lang: true } })).toEqual([{ name: 'Ali', lang: 'ru' }]);
    });

    it('til tanlash va telefonni bog\'lash bir vaqtda kelsa ham xatosiz bajariladi', async () => {
      const tg = fx.tg();
      const phone = fx.phone();
      await expect(Promise.all([setCustomerLang(tg, 'ru'), linkCustomerPhone(tg, phone), setCustomerLang(tg, 'ru'), linkCustomerPhone(tg, phone)])).resolves.toHaveLength(4);
      expect(await prisma.telegramCustomer.findMany({ where: { telegramId: tg }, select: { phone: true, lang: true } })).toEqual([{ phone, lang: 'ru' }]);
    });
  });

  describe('customerScope', () => {
    it('telefon tasdiqlanmagan bo\'lsa faqat chatning o\'zi; tasdiqlangan bo\'lsa shu telefonli mijoz akkaunti qo\'shiladi', async () => {
      const tg = fx.tg();
      expect(await customerScope({ telegramId: tg, phone: null })).toEqual({ telegramId: tg, phone: null, userId: null });

      const phone = fx.phone();
      expect(await customerScope({ telegramId: tg, phone })).toEqual({ telegramId: tg, phone, userId: null });
      const account = await fx.user({ phone, role: 'user' });
      expect(await customerScope({ telegramId: tg, phone })).toEqual({ telegramId: tg, phone, userId: account.id });
    });

    it('xodim, o\'chirilgan yoki bloklangan akkaunt mijoz doirasiga qo\'shilmaydi', async () => {
      const tg = fx.tg();
      const staffPhone = fx.phone();
      const inactivePhone = fx.phone();
      const deletedPhone = fx.phone();
      await fx.user({ phone: staffPhone, role: 'manager' });
      await fx.user({ phone: inactivePhone, role: 'user', isActive: false });
      await fx.user({ phone: deletedPhone, role: 'user', deletedAt: new Date() });

      for (const phone of [staffPhone, inactivePhone, deletedPhone]) expect(await customerScope({ telegramId: tg, phone })).toEqual({ telegramId: tg, phone, userId: null });
    });
  });

  describe('orderRecipients', () => {
    it('havola orqali ulangan chat va telefoni mos mijozlar — har biri o\'z tilida', async () => {
      const contactPhone = fx.phone();
      const accountPhone = fx.phone();
      const account = await fx.user({ phone: accountPhone, role: 'user' });
      const viaLink = await fx.customer({ lang: 'ru' });
      const viaPhone = await fx.customer({ phone: contactPhone });
      const viaAccount = await fx.customer({ phone: accountPhone, lang: 'ru' });
      await fx.customer({ phone: fx.phone() }); // begona mijoz

      const got = await orderRecipients({ telegramUserId: viaLink.telegramId, contactPhone, userId: account.id });
      expect(byId(got)).toEqual(byId([
        { telegramId: viaLink.telegramId, lang: 'ru' },
        { telegramId: viaPhone.telegramId, lang: 'uz' },
        { telegramId: viaAccount.telegramId, lang: 'ru' },
      ]));
    });

    it('bitta mijoz ham havola, ham telefon bo\'yicha mos kelsa — bir marta', async () => {
      const phone = fx.phone();
      const c = await fx.customer({ phone });
      expect(await orderRecipients({ telegramUserId: c.telegramId, contactPhone: phone, userId: null })).toEqual([{ telegramId: c.telegramId, lang: 'uz' }]);
    });

    it('xabarnomani o\'chirganlar chiqarib tashlanadi (havola orqali ulangan bo\'lsa ham)', async () => {
      const phone = fx.phone();
      const mutedByPhone = await fx.customer({ phone, notify: false });
      const mutedByLink = await fx.customer({ notify: false });

      expect(await orderRecipients({ telegramUserId: null, contactPhone: phone, userId: null })).toEqual([]);
      expect(await orderRecipients({ telegramUserId: mutedByLink.telegramId, contactPhone: phone, userId: null })).toEqual([]);
      expect(await orderRecipients({ telegramUserId: mutedByPhone.telegramId, contactPhone: null, userId: null })).toEqual([]);
    });

    it('yozuvi yo\'q, lekin havola orqali ulangan chat standart til bilan olinadi; hech narsa bog\'lanmagan buyurtma — bo\'sh', async () => {
      const ghost = fx.tg();
      expect(await orderRecipients({ telegramUserId: ghost, contactPhone: null, userId: null })).toEqual([{ telegramId: ghost, lang: 'uz' }]);
      expect(await orderRecipients({ telegramUserId: null, contactPhone: null, userId: null })).toEqual([]);
      expect(await orderRecipients({ telegramUserId: null, contactPhone: fx.phone(), userId: null })).toEqual([]);
    });

    it('buyurtma xodim akkauntidan berilgan bo\'lsa, xodimning telefoni bo\'yicha mijoz qidirilmaydi', async () => {
      const staffPhone = fx.phone();
      const staff = await fx.user({ phone: staffPhone, role: 'staff' });
      await fx.customer({ phone: staffPhone });
      expect(await orderRecipients({ telegramUserId: null, contactPhone: null, userId: staff.id })).toEqual([]);
    });

    // customerScope bilan bir xil qoida: bot bunday akkaunt buyurtmalarini ko'rsatmaydi ("Buyurtma topilmadi"),
    // demak holat xabari ham (buyurtma sahifasiga havolasi bilan) shu telefon bo'yicha bormasligi kerak.
    it('bloklangan yoki o\'chirilgan akkaunt telefoni bo\'yicha xabar yuborilmaydi; buyurtma telefoni va havola ishlayveradi', async () => {
      const blocked = await fx.user({ role: 'user', isActive: false });
      const deleted = await fx.user({ role: 'user', deletedAt: new Date() });
      const active = await fx.user({ role: 'user' });
      await fx.customer({ phone: blocked.phone });
      await fx.customer({ phone: deleted.phone });
      const viaActive = await fx.customer({ phone: active.phone });

      for (const u of [blocked, deleted]) expect(await orderRecipients({ telegramUserId: null, contactPhone: null, userId: u.id })).toEqual([]);
      expect(await orderRecipients({ telegramUserId: null, contactPhone: null, userId: active.id })).toEqual([{ telegramId: viaActive.telegramId, lang: 'uz' }]);

      // Akkaunt bloklangan bo'lsa ham buyurtmaning o'z telefoni va havola orqali ulangan chat xabar oladi
      const contactPhone = fx.phone();
      const viaPhone = await fx.customer({ phone: contactPhone });
      const viaLink = await fx.customer({ lang: 'ru' });
      expect(byId(await orderRecipients({ telegramUserId: viaLink.telegramId, contactPhone, userId: blocked.id }))).toEqual(byId([
        { telegramId: viaPhone.telegramId, lang: 'uz' },
        { telegramId: viaLink.telegramId, lang: 'ru' },
      ]));

      // Akkaunt qayta yoqilsa, xabar yana boradi
      await prisma.user.update({ where: { id: blocked.id }, data: { isActive: true } });
      expect(await orderRecipients({ telegramUserId: null, contactPhone: null, userId: blocked.id })).toHaveLength(1);
    });
  });
});
