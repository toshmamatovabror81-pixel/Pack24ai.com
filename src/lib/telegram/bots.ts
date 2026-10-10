import 'server-only';

/**
 * Uchta bot: mijoz (@Pack24AI_bot), haydovchi (@pack24MX_bot), boshqaruv (@pack24AUP_bot — masul va rahbariyat bitta botda).
 * Tokenlar faqat serverdagi .env da. Webhook manzili: /api/telegram/<kind>.
 *
 * `BotKind` — rol (sessiya va handlerlar shu bo'yicha ajraladi), `BOT_KINDS` — haqiqiy Telegram botlar.
 * 'hq' roli alohida botga ega emas: boshqaruv boti ('supervisor') tokenidan foydalanadi, kim yozganiga qarab
 * handlers.ts masul yoki rahbariyat menyusini ochadi.
 */
export type BotKind = 'customer' | 'driver' | 'supervisor' | 'hq';
export const BOT_KINDS: BotKind[] = ['customer', 'driver', 'supervisor'];

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
    title: 'Boshqaruv boti',
    description: "Masul: arizalar, haydovchi tayinlash, to'lovlar, jurnal. Rahbariyat: masul va haydovchilar, tasdiqlashlar, hodisalar",
    commands: [{ command: 'start', description: 'Bosh menyu' }, { command: 'requests', description: 'Arizalar' }, { command: 'help', description: 'Yordam' }],
  },
  hq: {
    // Alohida bot emas: boshqaruv boti tokeni
    envKey: 'SUPERVISOR_BOT_TOKEN',
    legacyEnvKey: 'ADMIN_BOT_TOKEN',
    title: 'Rahbariyat (boshqaruv botida)',
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

/** Boshqaruv botida rahbariyat (HQ) sifatida har doim ruxsat etilgan Telegram ID'lar (vergul bilan) */
export function hqAllowedIds(): string[] {
  return (process.env.HQ_ALLOWED_TELEGRAM_IDS || process.env.PACK24ADMIN_ALLOWED_TELEGRAM_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d{3,20}$/.test(s));
}
