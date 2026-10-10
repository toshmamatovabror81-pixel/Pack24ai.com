import 'server-only';

/**
 * Ikkita bot: mijoz (@Pack24AI_bot) va boshqaruv (@pack24AUP_bot — xodimlar uchun).
 * Tokenlar faqat serverdagi .env da. Webhook manzili: /api/telegram/<kind>.
 * `commands` — Telegram'dagi "/" menyusi (Sozlamalar > "Webhook'larni o'rnatish" bosilganda yangilanadi); har bir buyruqni
 * bots/customer.ts va bots/staff.ts ushlaydi.
 */
export type BotKind = 'customer' | 'staff';
export const BOT_KINDS: BotKind[] = ['customer', 'staff'];

export const botMeta: Record<BotKind, { envKey: string; legacyEnvKey?: string; title: string; description: string; commands: { command: string; description: string }[] }> = {
  customer: {
    envKey: 'CUSTOMER_BOT_TOKEN',
    title: 'Mijoz boti',
    description: "Mijozlar uchun: buyurtmalar (holati, ishlab chiqarish bosqichi, to'lovi), balans (qarzdorlik), rekvizitlar va aloqa; holat o'zgarsa avtomatik xabar",
    commands: [
      // "/" menyusi bitta ro'yxat (tilga qarab alohida o'rnatilmaydi), shuning uchun mijoz botida har bir nom ikki tilda
      { command: 'start', description: 'Bosh menyu / Главное меню' },
      { command: 'orders', description: 'Buyurtmalarim / Мои заказы' },
      { command: 'balance', description: 'Balans / Баланс' },
      { command: 'lang', description: 'Til / Язык' },
      { command: 'help', description: 'Yordam / Помощь' },
    ],
  },
  staff: {
    envKey: 'STAFF_BOT_TOKEN',
    // Eski nom: bot ilgari "masul/boshqaruv" boti edi; serverda shu kalit bilan yozilgan bo'lsa ham ishlaydi
    legacyEnvKey: 'SUPERVISOR_BOT_TOKEN',
    title: 'Boshqaruv boti',
    description: "Xodimlar uchun: yangi buyurtma va to'lov xabarlari, buyurtma holatini o'zgartirish, qidiruv, bugungi holat va muddati o'tgan qarzlar",
    commands: [
      { command: 'start', description: 'Bosh menyu' },
      { command: 'new', description: 'Yangi buyurtmalar' },
      { command: 'active', description: 'Jarayondagi buyurtmalar' },
      { command: 'find', description: 'Buyurtma qidirish' },
      { command: 'today', description: 'Bugungi holat' },
      { command: 'help', description: 'Yordam' },
    ],
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
