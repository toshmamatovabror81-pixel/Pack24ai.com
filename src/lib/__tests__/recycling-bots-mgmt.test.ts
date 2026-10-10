import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TgUpdate } from '@/lib/telegram/api';

// Boshqaruv boti: masul va rahbariyat bitta botda — handlers.ts yangilanishni kimga berishini tekshiramiz
vi.mock('server-only', () => ({}));
const supervisorByTelegram = vi.fn();
const hqAdminByTelegram = vi.fn();
vi.mock('@/lib/recycling/staff', () => ({
  supervisorByTelegram: (...a: unknown[]) => supervisorByTelegram(...a),
  hqAdminByTelegram: (...a: unknown[]) => hqAdminByTelegram(...a),
}));
const getSession = vi.fn();
const setSession = vi.fn();
vi.mock('@/lib/telegram/session', () => ({ getSession: (...a: unknown[]) => getSession(...a), setSession: (...a: unknown[]) => setSession(...a) }));
const fakeBot = (prefixes: string[]) => ({ handle: vi.fn(async (_u: TgUpdate) => undefined), handlesCallback: (d: string) => prefixes.some((p) => d.startsWith(p)) });
const sup = fakeBot(['assign_', 'wd_ok_', 'menu']);
const hq = fakeBot(['acc_ok_', 'wd_ok_', 'menu']);
const other = fakeBot([]);
vi.mock('@/lib/telegram/bots/supervisor', () => ({ bot: sup }));
vi.mock('@/lib/telegram/bots/hq', () => ({ bot: hq }));
vi.mock('@/lib/telegram/bots/customer', () => ({ bot: other }));
vi.mock('@/lib/telegram/bots/driver', () => ({ bot: other }));

const { dispatchUpdate } = await import('@/lib/telegram/handlers');
const { BOT_KINDS, botToken, isBotKind } = await import('@/lib/telegram/bots');

const from = { id: 501, first_name: 'A' };
const text = (t: string): TgUpdate => ({ update_id: 1, message: { message_id: 1, chat: { id: 501 }, from, text: t } } as TgUpdate);
const callback = (data: string): TgUpdate => ({ update_id: 1, callback_query: { id: 'c', from, data } } as TgUpdate);

beforeEach(() => {
  vi.clearAllMocks();
  supervisorByTelegram.mockResolvedValue(null);
  hqAdminByTelegram.mockResolvedValue(null);
  getSession.mockResolvedValue(null);
  vi.stubEnv('HQ_ALLOWED_TELEGRAM_IDS', '');
});

describe('uchta bot: rahbariyat alohida botga ega emas', () => {
  it("webhook faqat 3 ta botga; 'hq' roli boshqaruv boti tokenini oladi", () => {
    expect(BOT_KINDS).toEqual(['customer', 'driver', 'supervisor']);
    expect(isBotKind('hq')).toBe(false);
    vi.stubEnv('SUPERVISOR_BOT_TOKEN', '123456:abc');
    expect(botToken('hq')).toBe('123456:abc');
    expect(botToken('hq')).toBe(botToken('supervisor'));
  });
});

describe('boshqaruv boti: rol bo\'yicha yo\'naltirish', () => {
  it('faqat masul -> masul oqimi', async () => {
    supervisorByTelegram.mockResolvedValue({ id: 1 });
    await dispatchUpdate('supervisor', text('/start'));
    expect(sup.handle).toHaveBeenCalledTimes(1);
    expect(hq.handle).not.toHaveBeenCalled();
  });
  it('faqat rahbariyat (bazada yoki .env ID) -> rahbariyat oqimi', async () => {
    hqAdminByTelegram.mockResolvedValue({ id: 2 });
    await dispatchUpdate('supervisor', text('/start'));
    expect(hq.handle).toHaveBeenCalledTimes(1);
    hqAdminByTelegram.mockResolvedValue(null);
    vi.stubEnv('HQ_ALLOWED_TELEGRAM_IDS', '777, 501');
    await dispatchUpdate('supervisor', text('/start'));
    expect(hq.handle).toHaveBeenCalledTimes(2);
    expect(sup.handle).not.toHaveBeenCalled();
  });
  it("mehmon -> masul ro'yxati; rahbariyat kodi kiritilgan bo'lsa (HQ sessiyasi reg_contact) -> rahbariyat oqimi", async () => {
    await dispatchUpdate('supervisor', text('salom'));
    expect(sup.handle).toHaveBeenCalledTimes(1);
    getSession.mockImplementation(async (bot: string) => (bot === 'hq' ? { step: 'reg_contact', code: '33333' } : null));
    await dispatchUpdate('supervisor', text(''));
    expect(hq.handle).toHaveBeenCalledTimes(1);
  });
  it('ikkala rol: standart rahbariyat, /masul va /hq almashtiradi va menyuni ochadi', async () => {
    supervisorByTelegram.mockResolvedValue({ id: 1 });
    hqAdminByTelegram.mockResolvedValue({ id: 2 });
    await dispatchUpdate('supervisor', text('📋 Arizalar'));
    expect(hq.handle).toHaveBeenCalledTimes(1);
    await dispatchUpdate('supervisor', text('/masul'));
    expect(setSession).toHaveBeenCalledWith('shmode', 501, { mode: 'supervisor' });
    expect(sup.handle.mock.calls[0][0].message?.text).toBe('/start');
    getSession.mockImplementation(async (bot: string) => (bot === 'shmode' ? { mode: 'supervisor' } : null));
    await dispatchUpdate('supervisor', text('📋 Arizalar'));
    expect(sup.handle).toHaveBeenCalledTimes(2);
    await dispatchUpdate('supervisor', text('/hq'));
    expect(setSession).toHaveBeenCalledWith('shmode', 501, { mode: 'hq' });
    expect(hq.handle).toHaveBeenCalledTimes(2);
  });
  it('ikkala rol: xabarnoma tugmasi uni taniydigan rolga beriladi, umumiy tugma joriy rejimda qoladi', async () => {
    supervisorByTelegram.mockResolvedValue({ id: 1 });
    hqAdminByTelegram.mockResolvedValue({ id: 2 });
    await dispatchUpdate('supervisor', callback('assign_12')); // rejim: rahbariyat, tugma: masulniki
    expect(sup.handle).toHaveBeenCalledTimes(1);
    await dispatchUpdate('supervisor', callback('wd_ok_5')); // ikkalasida bor -> joriy rejim
    expect(hq.handle).toHaveBeenCalledTimes(1);
    getSession.mockImplementation(async (bot: string) => (bot === 'shmode' ? { mode: 'supervisor' } : null));
    await dispatchUpdate('supervisor', callback('acc_ok_3'));
    expect(hq.handle).toHaveBeenCalledTimes(2);
  });
});
