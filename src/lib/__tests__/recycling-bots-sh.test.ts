import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InlineKeyboard } from '@/lib/telegram/api';

// shCommon server modullarini tortadi — bazasiz test uchun ularni almashtiramiz
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('@/lib/recycling/events', () => ({ logEvent: vi.fn() }));
vi.mock('@/lib/telegram/notify', () => ({ notifyCustomer: vi.fn() }));
const cancelRequest = vi.fn();
vi.mock('@/lib/recycling/requests', () => ({ cancelRequest: (...a: unknown[]) => cancelRequest(...a) }));
const registerByCode = vi.fn();
vi.mock('@/lib/recycling/staff', () => ({ registerByCode: (...a: unknown[]) => registerByCode(...a) }));

const sh = await import('@/lib/telegram/bots/shCommon');
type Ctx = Parameters<typeof sh.sendLines>[0];

/** Soxta Ctx: reply/edit/answer/sessiya chaqiruvlarini yig'adi */
function fakeCtx(over: Partial<Ctx> = {}): Ctx & { calls: { kind: string; args: unknown[] }[] } {
  const calls: { kind: string; args: unknown[] }[] = [];
  const rec = <F,>(kind: string): F => ((...args: unknown[]) => { calls.push({ kind, args }); return Promise.resolve(null); }) as unknown as F;
  return {
    kind: 'supervisor', token: 't', update: { update_id: 1 }, chatId: 1, from: { id: 1, first_name: 'A' }, text: '', data: '',
    reply: rec<Ctx['reply']>('reply'), edit: rec<Ctx['edit']>('edit'), answer: rec<Ctx['answer']>('answer'), sendLocation: rec<Ctx['sendLocation']>('sendLocation'),
    session: async () => null, setSession: rec<Ctx['setSession']>('setSession'), clearSession: rec<Ctx['clearSession']>('clearSession'),
    calls, ...over,
  };
}

describe('masul/HQ botlari: raqam va matn yordamchilari', () => {
  it("parseNum: bo'sh joy, vergul va nuqta", () => {
    expect(sh.parseNum('12 500')).toBe(12500);
    expect(sh.parseNum('12,5')).toBe(12.5);
    expect(sh.parseNum('86 760 so\'m')).toBe(86760);
    expect(sh.parseNum('0')).toBe(0);
    expect(sh.parseNum('abc')).toBeNull();
    expect(sh.parseNum('')).toBeNull();
  });
  it('ids: prefiksdan keyingi raqamlar (pick_<req>_<driver>, accpt_<req>_0)', () => {
    expect(sh.ids('pick_12_5', 'pick_')).toEqual([12, 5]);
    expect(sh.ids('accpt_4_0', 'accpt_')).toEqual([4, 0]);
    expect(sh.ids('cres_7_3', 'cres_')).toEqual([7, 3]);
    expect(sh.ids('x_abc', 'x_')).toEqual([]);
  });
  it("codeFrom: faqat 5 raqam; isSkip: ⏭ / - / bo'sh", () => {
    expect(sh.codeFrom('1 2 3 4 5')).toBe('12345');
    expect(sh.codeFrom('1234')).toBeNull();
    expect(sh.isSkip('⏭')).toBe(true);
    expect(sh.isSkip(sh.SKIP)).toBe(true);
    expect(sh.isSkip('-')).toBe(true);
    expect(sh.isSkip('')).toBe(true);
    expect(sh.isSkip('Labo 01A777AA')).toBe(false);
  });
  it('val: bosqich tugmasi val_<qiymat>', () => {
    expect(sh.val('💰 Jami', 86760)).toEqual({ text: '💰 Jami', callback_data: 'val_86760' });
    expect(sh.val('📅 Bugun', 'bugun').callback_data).toBe('val_bugun');
  });
  it('todayRange: Toshkent kuni (UTC+5) va haqiqiy oraliq', () => {
    const r = sh.todayRange(new Date('2026-10-08T20:30:00Z')); // Toshkentda 09.10 01:30
    expect(r.day.toISOString()).toBe('2026-10-09T00:00:00.000Z');
    expect(r.from.toISOString()).toBe('2026-10-08T19:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-10-09T19:00:00.000Z');
    const r2 = sh.todayRange(new Date('2026-10-08T10:00:00Z'));
    expect(r2.day.toISOString()).toBe('2026-10-08T00:00:00.000Z');
  });
});

describe('masul/HQ botlari: HTML kartalar', () => {
  const driver = { id: 1, name: 'Ali <b>', phone: '998901112244', vehicleInfo: 'Damas & Co', status: 'busy', isOnline: true, telegramId: '1', registrationCode: null } as unknown as Parameters<typeof sh.driverLine>[0];
  it("driverLine: foydalanuvchi matni qochiriladi, holat va Telegram ko'rsatiladi", () => {
    const html = sh.driverLine(driver);
    expect(html).toContain('Ali &lt;b&gt;');
    expect(html).toContain('Damas &amp; Co');
    expect(html).toContain('🟢');
    expect(html).toContain('Band · Telegram ✅');
    expect(sh.driverLine({ ...driver, isOnline: false, telegramId: null, registrationCode: '12345', status: 'active' })).toContain('kod <code>12345</code>');
  });
  it('pointInfoHtml: narx, stavka va qabul holati', () => {
    const p = { cityUz: 'Yunusobod', regionUz: 'Toshkent', address: null, phone: '998', workingHours: '08:00-18:00', pricePerKg: 800, driverRatePerKg: 100, isAccepting: false, status: 'active' } as unknown as Parameters<typeof sh.pointInfoHtml>[0];
    const html = sh.pointInfoHtml(p, ['🚛 2']);
    expect(html).toContain("800 so'm/kg");
    expect(html).toContain("🔴 Qabul to'xtatilgan");
    expect(html.endsWith('🚛 2')).toBe(true);
  });
  it('cancelRows / wdRows: poydevor kutadigan callback prefikslari', () => {
    expect(sh.cancelRows(5).flat().map((b) => b.callback_data)).toEqual(['cres_5_1', 'cres_5_2', 'cres_5_3']);
    expect(sh.wdRows(9).flat().map((b) => b.callback_data)).toEqual(['wd_ok_9', 'wd_no_9']);
  });
});

describe('masul/HQ botlari: xabar oqimi', () => {
  it("sendLines: uzun ro'yxat bir nechta xabarga bo'linadi, tugmalar oxirgisida", async () => {
    const ctx = fakeCtx();
    const rows: InlineKeyboard = [[{ text: 'x', callback_data: 'y' }]];
    await sh.sendLines(ctx, Array.from({ length: 60 }, (_, i) => `qator ${i} ${'a'.repeat(100)}`), { rows });
    const replies = ctx.calls.filter((c) => c.kind === 'reply');
    expect(replies.length).toBeGreaterThan(1);
    for (const r of replies) expect((r.args[0] as string).length).toBeLessThanOrEqual(3500);
    expect(replies.slice(0, -1).every((r) => r.args[1] && !(r.args[1] as { reply_markup?: unknown }).reply_markup)).toBe(true);
    expect((replies.at(-1)!.args[1] as { reply_markup: { inline_keyboard: InlineKeyboard } }).reply_markup.inline_keyboard).toEqual(rows);
  });
  it("finishRegistration: faqat o'z kontakti qabul qilinadi", async () => {
    registerByCode.mockResolvedValue({ ok: true, role: 'supervisor' });
    const noContact = fakeCtx();
    expect(await sh.finishRegistration(noContact, 'supervisor', '11111')).toEqual({ ok: false, reason: 'nocontact' });
    const foreign = fakeCtx({ message: { message_id: 1, chat: { id: 1, type: 'private' }, date: 0, contact: { phone_number: '+998901112255', first_name: 'B', user_id: 5555 } } });
    expect(await sh.finishRegistration(foreign, 'supervisor', '11111')).toEqual({ ok: false, reason: 'self' });
    const own = fakeCtx({ from: { id: 777020, first_name: 'Masul', last_name: 'Kod' }, message: { message_id: 1, chat: { id: 777020, type: 'private' }, date: 0, contact: { phone_number: '+998901112255', first_name: 'M', user_id: 777020 } } });
    expect((await sh.finishRegistration(own, 'hq', '33333')).ok).toBe(true);
    expect(registerByCode).toHaveBeenCalledWith('hq', '33333', '+998901112255', { id: 777020, name: 'Masul Kod' });
  });
});

describe('masul/HQ botlari: bekor qilish oqimi', () => {
  const actor = { kind: 'supervisor' as const, id: 1, name: 'Masul Test' };
  beforeEach(() => cancelRequest.mockReset());
  it('cres_<id>_1: tayyor sabab bilan darhol bekor qilinadi', async () => {
    cancelRequest.mockResolvedValue({ id: 7, supervisor: null });
    const ctx = fakeCtx({ data: 'cres_7_1' });
    await sh.cancelReasonCallback(ctx, actor, async () => true);
    expect(cancelRequest).toHaveBeenCalledWith(7, actor, 'Mijoz rad etdi');
    expect(ctx.calls.find((c) => c.kind === 'edit')?.args[0]).toContain('Ariza #7 bekor qilindi');
  });
  it("cres_<id>_2: poydevor shu masulga o'zi xabar bergan bo'lsa edit o'rniga faqat answer", async () => {
    cancelRequest.mockResolvedValue({ id: 7, supervisor: { telegramId: '1' } });
    const ctx = fakeCtx({ data: 'cres_7_2', from: { id: 1, first_name: 'A' } });
    await sh.cancelReasonCallback(ctx, actor, async () => true);
    expect(cancelRequest).toHaveBeenCalledWith(7, actor, "Mijoz topilmadi / aloqa yo'q");
    expect(ctx.calls.some((c) => c.kind === 'edit')).toBe(false);
    expect(ctx.calls.find((c) => c.kind === 'answer')?.args[0]).toBe('Bekor qilindi');
  });
  it("cres_<id>_3: matn so'raladi (step cancel_reason); begona ariza rad etiladi", async () => {
    const ctx = fakeCtx({ data: 'cres_7_3' });
    await sh.cancelReasonCallback(ctx, actor, async () => true);
    expect(cancelRequest).not.toHaveBeenCalled();
    expect(ctx.calls.find((c) => c.kind === 'setSession')?.args[0]).toEqual({ step: 'cancel_reason', requestId: 7 });
    const other = fakeCtx({ data: 'cres_8_1' });
    await sh.cancelReasonCallback(other, actor, async () => false);
    expect(cancelRequest).not.toHaveBeenCalled();
    expect(other.calls.find((c) => c.kind === 'answer')?.args[1]).toBe(true);
  });
  it("cancelReasonStep: poydevor shu masulga o'zi xabar bergan bo'lsa takrorlanmaydi", async () => {
    cancelRequest.mockResolvedValue({ id: 9, supervisor: { telegramId: '1' } });
    const ctx = fakeCtx({ from: { id: 1, first_name: 'A' } });
    await sh.cancelReasonStep(ctx, actor, 9, 'Mijoz boshqa kunga qoldirdi');
    expect(cancelRequest).toHaveBeenCalledWith(9, actor, 'Mijoz boshqa kunga qoldirdi');
    expect(ctx.calls.some((c) => c.kind === 'clearSession')).toBe(true);
    expect(ctx.calls.some((c) => c.kind === 'reply')).toBe(false);
    cancelRequest.mockResolvedValue({ id: 9, supervisor: { telegramId: '2' } });
    const hq = fakeCtx({ from: { id: 999001, first_name: 'HQ' } });
    await sh.cancelReasonStep(hq, { kind: 'admin', id: 0, name: 'HQ' }, 9, 'Sabab');
    expect(hq.calls.some((c) => c.kind === 'reply')).toBe(true);
  });
});
