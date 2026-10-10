import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { BOT_KINDS, botMeta, botToken, isBotKind, webhookPath } = await import('@/lib/telegram/bots');
const { verifyOpsBearer, verifyWebhook, webhookSecret } = await import('@/lib/telegram/security');
const { answerCallbackQuery, clip, editMessageText, sendMessage } = await import('@/lib/telegram/api');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('telegram botlar ro\'yxati', () => {
  it('ikkita bot: mijoz va boshqaruv; olib tashlangan rollar webhook qabul qilmaydi', () => {
    expect(BOT_KINDS).toEqual(['customer', 'staff']);
    expect(isBotKind('customer')).toBe(true);
    expect(isBotKind('staff')).toBe(true);
    for (const old of ['driver', 'supervisor', 'hq', 'shmode', '', null, 1]) expect(isBotKind(old)).toBe(false);
    expect(webhookPath('staff')).toBe('/api/telegram/staff');
    expect(Object.keys(botMeta).sort()).toEqual(['customer', 'staff']);
  });
  it('token .env dan; boshqaruv boti eski SUPERVISOR_BOT_TOKEN nomini ham qabul qiladi', () => {
    vi.stubEnv('CUSTOMER_BOT_TOKEN', '');
    vi.stubEnv('STAFF_BOT_TOKEN', '');
    vi.stubEnv('SUPERVISOR_BOT_TOKEN', '');
    expect(botToken('customer')).toBeNull();
    expect(botToken('staff')).toBeNull();
    vi.stubEnv('CUSTOMER_BOT_TOKEN', ' 111:aaa ');
    expect(botToken('customer')).toBe('111:aaa');
    vi.stubEnv('SUPERVISOR_BOT_TOKEN', '222:old');
    expect(botToken('staff')).toBe('222:old');
    vi.stubEnv('STAFF_BOT_TOKEN', '333:new');
    expect(botToken('staff')).toBe('333:new');
  });
});

describe('telegram webhook himoyasi', () => {
  const req = (headers: Record<string, string>) => new Request('https://pack24.uz/api/telegram/customer', { method: 'POST', headers });
  it('maxfiy kalit sozlanmagan yoki qisqa bo\'lsa hech narsa qabul qilinmaydi', () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'short');
    expect(webhookSecret()).toBeNull();
    expect(verifyWebhook(req({ 'x-telegram-bot-api-secret-token': 'short' }))).toBe(false);
  });
  it('faqat aynan mos kalit qabul qilinadi', () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'a-very-long-webhook-secret');
    expect(verifyWebhook(req({ 'x-telegram-bot-api-secret-token': 'a-very-long-webhook-secret' }))).toBe(true);
    expect(verifyWebhook(req({ 'x-telegram-bot-api-secret-token': 'a-very-long-webhook-secreT' }))).toBe(false);
    expect(verifyWebhook(req({}))).toBe(false);
  });
  it('sozlash API: Bearer TELEGRAM_OPS_SECRET', () => {
    vi.stubEnv('TELEGRAM_OPS_SECRET', 'ci-dummy-ops-secret');
    expect(verifyOpsBearer(req({ authorization: 'Bearer ci-dummy-ops-secret' }))).toBe(true);
    expect(verifyOpsBearer(req({ authorization: 'Bearer ci-dummy-wrong-secret' }))).toBe(false);
    expect(verifyOpsBearer(req({ authorization: 'ci-dummy-ops-secret' }))).toBe(false);
    vi.stubEnv('TELEGRAM_OPS_SECRET', '');
    expect(verifyOpsBearer(req({ authorization: 'Bearer ' }))).toBe(false);
  });
});

describe('telegram matnini kesish', () => {
  const TEXT = 'a😀b😀😀c';

  it("clip: slice kabi kesadi, lekin emoji (surrogat juftligi) o'rtasidan emas", () => {
    expect(clip('salom', 10)).toBe('salom');
    expect(clip('salom', 5)).toBe('salom');
    expect(clip('salom', 3)).toBe('sal');
    expect(clip('', 5)).toBe('');
    expect(clip('Q'.repeat(300), 80)).toBe('Q'.repeat(80));
    // Kesish joyi juftlik o'rtasiga tushsa, yarim qolgan bo'lak ham tashlanadi; to'liq sig'gan emoji qoladi
    expect(clip('ab😀', 3)).toBe('ab');
    expect(clip('ab😀', 4)).toBe('ab😀');
    expect(clip('ab😀cd', 4)).toBe('ab😀');
    expect(clip('😀', 1)).toBe('');
    for (let max = 0; max <= TEXT.length + 1; max += 1) {
      const out = clip(TEXT, max);
      expect(out.isWellFormed(), String(max)).toBe(true);
      expect(TEXT.startsWith(out)).toBe(true);
      expect(out.length === Math.min(max, TEXT.length) || out.length === max - 1).toBe(true);
    }
  });

  it("sendMessage, editMessageText va answerCallbackQuery chegarada yarim emoji yubormaydi (Telegram bunday so'rovni 400 bilan rad etadi)", async () => {
    const sent: { method: string; text: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      sent.push({ method: String(url).split('/').pop()!, text: JSON.parse(String(init.body)).text });
      return new Response(JSON.stringify({ ok: true, result: true }));
    }));
    const long = `${'x'.repeat(3999)}😀 davomi`;
    await sendMessage('1:t', 5, long);
    await editMessageText('1:t', 5, 7, long);
    await answerCallbackQuery('1:t', 'q', `${'y'.repeat(199)}😀 davomi`);
    await sendMessage('1:t', 5, `${'x'.repeat(3998)}😀 davomi`);
    await answerCallbackQuery('1:t', 'q');
    expect(sent.map((s) => s.method)).toEqual(['sendMessage', 'editMessageText', 'answerCallbackQuery', 'sendMessage', 'answerCallbackQuery']);
    expect(sent[0].text).toBe('x'.repeat(3999));
    expect(sent[1].text).toBe('x'.repeat(3999));
    expect(sent[2].text).toBe('y'.repeat(199));
    // Emoji chegaraga to'liq sig'sa — qoladi
    expect(sent[3].text).toBe(`${'x'.repeat(3998)}😀`);
    expect(sent[4].text).toBeUndefined();
    for (const s of sent.slice(0, 4)) expect(s.text.isWellFormed()).toBe(true);
  });
});
