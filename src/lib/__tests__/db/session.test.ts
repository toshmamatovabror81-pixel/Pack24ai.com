import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DB_TESTS, fixture, prisma, type Fixture } from './helpers';

vi.mock('server-only', () => ({}));

const { clearSession, getSession, setSession } = await import('@/lib/telegram/session');

describe.skipIf(!DB_TESTS)('telegram/session (haqiqiy baza)', { timeout: 20_000 }, () => {
  let fx: Fixture;

  beforeAll(async () => {
    fx = await fixture(7);
    // setSession ba'zan (2%) bazadagi HAMMA eskirgan sessiyalarni tozalaydi — test begona qatorlarga tegmasligi uchun o'chirib qo'yiladi
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await fx?.cleanup();
    await prisma.$disconnect();
  });

  it('saqlangan holat keyingi so\'rovda o\'qiladi; qayta yozilsa to\'liq almashtiriladi', async () => {
    const tg = fx.tg();
    expect(await getSession('customer', tg)).toBeNull();

    await setSession('customer', tg, { step: 'phone', draft: { page: 2, ids: [1, 2] } });
    expect(await getSession('customer', Number(tg))).toEqual({ step: 'phone', draft: { page: 2, ids: [1, 2] } });

    await setSession('customer', Number(tg), { step: 'done' });
    expect(await getSession('customer', tg)).toEqual({ step: 'done' });
    expect(await prisma.botSession.count({ where: { telegramId: tg } })).toBe(1);
  });

  it('holat bot turi va Telegram ID bo\'yicha alohida: bir odamning ikki botdagi suhbati aralashmaydi', async () => {
    const tg = fx.tg();
    const other = fx.tg();
    await setSession('customer', tg, { who: 'mijoz' });
    await setSession('staff', tg, { who: 'xodim' });
    await setSession('staff', other, { who: 'boshqa xodim' });

    expect(await getSession('customer', tg)).toEqual({ who: 'mijoz' });
    expect(await getSession('staff', tg)).toEqual({ who: 'xodim' });
    expect(await getSession('customer', other)).toBeNull();

    await clearSession('staff', tg);
    expect(await getSession('staff', tg)).toBeNull();
    expect(await getSession('customer', tg)).toEqual({ who: 'mijoz' });
    expect(await getSession('staff', other)).toEqual({ who: 'boshqa xodim' });
    await expect(clearSession('staff', tg)).resolves.toBeUndefined(); // yo'q sessiyani tozalash ham xatosiz
  });

  // Boshqaruv botida noto'g'ri ulash kodlari hisobi suhbat sessiyasidan alohida kalitda turadi: bot menyu, qidiruv, ulanish va /stop da
  // suhbat sessiyasini tozalaydi — hisob (va 30 daqiqalik qulf) bundan o'chib ketmasligi kerak.
  it('kod hisobi (staff_code) suhbat sessiyasidan (staff) alohida qator: birini tozalash ikkinchisiga tegmaydi', async () => {
    const tg = fx.tg();
    await setSession('staff', tg, { step: 'find' });
    await setSession('staff_code', tg, { codeFails: 5, codeFailAt: 1_800_000_000_000 });
    expect(await prisma.botSession.findMany({ where: { telegramId: tg }, select: { bot: true }, orderBy: { bot: 'asc' } })).toEqual([{ bot: 'staff' }, { bot: 'staff_code' }]);

    await clearSession('staff', tg);
    expect(await getSession('staff', tg)).toBeNull();
    expect(await getSession('staff_code', tg)).toEqual({ codeFails: 5, codeFailAt: 1_800_000_000_000 });

    await setSession('staff', tg, { step: 'find' });
    await clearSession('staff_code', tg);
    expect(await getSession('staff_code', tg)).toBeNull();
    expect(await getSession('staff', tg)).toEqual({ step: 'find' });
  });

  it('7 kundan eski sessiya yo\'q hisoblanadi; qayta yozilsa yana ishlaydi', async () => {
    const tg = fx.tg();
    await setSession('staff', tg, { step: 'search' });
    await prisma.$executeRaw`UPDATE "BotSession" SET "updatedAt" = now() - interval '8 days' WHERE "bot" = 'staff' AND "telegramId" = ${tg}`;
    expect(await getSession('staff', tg)).toBeNull();

    await setSession('staff', tg, { step: 'again' });
    expect(await getSession('staff', tg)).toEqual({ step: 'again' });
  });

  it('bir foydalanuvchidan bir vaqtda kelgan ikki so\'rov sessiyani xatosiz yozadi', async () => {
    const tg = fx.tg();
    await expect(Promise.all([setSession('customer', tg, { n: 1 }), setSession('customer', tg, { n: 2 }), setSession('customer', tg, { n: 3 })])).resolves.toHaveLength(3);
    expect(await prisma.botSession.count({ where: { bot: 'customer', telegramId: tg } })).toBe(1);
    expect([{ n: 1 }, { n: 2 }, { n: 3 }]).toContainEqual(await getSession('customer', tg));
  });
});
