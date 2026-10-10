import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { BOT_KINDS, botMeta, botToken, isBotKind, webhookPath } = await import('@/lib/telegram/bots');
const { verifyOpsBearer, verifyWebhook, webhookSecret } = await import('@/lib/telegram/security');

afterEach(() => vi.unstubAllEnvs());

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
    vi.stubEnv('TELEGRAM_OPS_SECRET', 'ops-secret-0123456789');
    expect(verifyOpsBearer(req({ authorization: 'Bearer ops-secret-0123456789' }))).toBe(true);
    expect(verifyOpsBearer(req({ authorization: 'Bearer wrong-secret-0123456789' }))).toBe(false);
    expect(verifyOpsBearer(req({ authorization: 'ops-secret-0123456789' }))).toBe(false);
    vi.stubEnv('TELEGRAM_OPS_SECRET', '');
    expect(verifyOpsBearer(req({ authorization: 'Bearer ' }))).toBe(false);
  });
});
