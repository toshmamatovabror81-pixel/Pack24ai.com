import 'server-only';

/**
 * To'rtta bot: mijoz (@Pack24AI_bot), haydovchi (@pack24MX_bot), masul (@pack24AUP_bot), HQ admin (@pack24admin_bot).
 * Tokenlar faqat serverdagi .env da. Webhook manzili: /api/telegram/<kind>.
 */
export type BotKind = 'customer' | 'driver' | 'supervisor' | 'hq';
export const BOT_KINDS: BotKind[] = ['customer', 'driver', 'supervisor', 'hq'];

export const botMeta: Record<BotKind, { envKey: string; legacyEnvKey?: string; title: string; description: string; commands: { command: string; description: string }[] }> = {
  customer: {
    envKey: 'CUSTOMER_BOT_TOKEN',
    title: 'Mijoz boti',
    description: "Makulatura arizasi, ariza holati, tortish natijasini tasdiqlash",
    commands: [{ command: 'start', description: 'Bosh menyu' }, { command: 'requests', description: 'Mening arizalarim' }, { command: 'help', description: 'Yordam' }],
  },
  driver: {
    envKey: 'DRIVER_BOT_TOKEN',
    title: 'Haydovchi boti',
    description: "Topshiriqlar, yo'lga chiqish, tortish kalkulyatori, GPS",
    commands: [{ command: 'start', description: 'Bosh menyu' }, { command: 'tasks', description: 'Topshiriqlar' }, { command: 'password', description: 'Ilova parolini tiklash' }, { command: 'help', description: 'Yordam' }],
  },
  supervisor: {
    envKey: 'SUPERVISOR_BOT_TOKEN',
    legacyEnvKey: 'ADMIN_BOT_TOKEN',
    title: 'Masul boti',
    description: "Arizalar, haydovchi tayinlash, to'lovlar, punkt holati, kunlik jurnal",
    commands: [{ command: 'start', description: 'Bosh menyu' }, { command: 'requests', description: 'Arizalar' }, { command: 'help', description: 'Yordam' }],
  },
  hq: {
    envKey: 'HQ_BOT_TOKEN',
    legacyEnvKey: 'PACK24ADMIN_BOT_TOKEN',
    title: 'HQ admin boti',
    description: 'Masul va haydovchilarni boshqarish, tasdiqlashlar, hodisalar',
    commands: [{ command: 'start', description: 'Bosh menyu' }, { command: 'events', description: 'Hodisalar' }, { command: 'help', description: 'Yordam' }],
  },
};

export function isBotKind(v: unknown): v is BotKind {
  return typeof v === 'string' && (BOT_KINDS as string[]).includes(v);
}

export function botToken(kind: BotKind): string | null {
  const m = botMeta[kind];
  const t = process.env[m.envKey] || (m.legacyEnvKey ? process.env[m.legacyEnvKey] : '') || '';
  return t.trim() || null;
}

export const webhookPath = (kind: BotKind) => `/api/telegram/${kind}`;

/** HQ admin sifatida har doim ruxsat etilgan Telegram ID'lar (vergul bilan) */
export function hqAllowedIds(): string[] {
  return (process.env.HQ_ALLOWED_TELEGRAM_IDS || process.env.PACK24ADMIN_ALLOWED_TELEGRAM_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d{3,20}$/.test(s));
}
