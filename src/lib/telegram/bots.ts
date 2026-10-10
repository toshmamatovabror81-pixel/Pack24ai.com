import 'server-only';

/**
 * Ikkita bot: mijoz (@Pack24AI_bot) va boshqaruv (@pack24AUP_bot — xodimlar uchun).
 * Tokenlar faqat serverdagi .env da. Webhook manzili: /api/telegram/<kind>.
 */
export type BotKind = 'customer' | 'staff';
export const BOT_KINDS: BotKind[] = ['customer', 'staff'];

export const botMeta: Record<BotKind, { envKey: string; legacyEnvKey?: string; title: string; description: string; commands: { command: string; description: string }[] }> = {
  customer: {
    envKey: 'CUSTOMER_BOT_TOKEN',
    title: 'Mijoz boti',
    description: "Mijozlar uchun: sayt va aloqa ma'lumotlari (buyurtma holati va balans keyingi yangilanishda)",
    commands: [{ command: 'start', description: 'Bosh menyu' }, { command: 'help', description: 'Yordam' }],
  },
  staff: {
    envKey: 'STAFF_BOT_TOKEN',
    // Eski nom: bot ilgari "masul/boshqaruv" boti edi; serverda shu kalit bilan yozilgan bo'lsa ham ishlaydi
    legacyEnvKey: 'SUPERVISOR_BOT_TOKEN',
    title: 'Boshqaruv boti',
    description: "Xodimlar uchun (yangi buyurtma xabarlari va holatni o'zgartirish keyingi yangilanishda)",
    commands: [{ command: 'start', description: 'Bosh menyu' }, { command: 'help', description: 'Yordam' }],
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
