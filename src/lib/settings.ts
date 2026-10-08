import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from './db';
import type { I18nText } from './i18n/config';

/** Admin panelda tahrirlanadigan sayt sozlamalari (SiteSetting jadvali, key = "site") */
export type SiteSettings = {
  companyName: string;
  legalName: string;
  inn: string;
  bankDetails: string;
  directorName: string; // shartnoma va hisob-fakturada imzo
  vatPercent: number; // QQS foizi (narxlar QQS bilan)
  lowStockThreshold: number; // shu miqdordan kam qolsa ogohlantirish
  contractText: string; // Shartnoma matni (Markdown), {{company}} kabi o'rinbosarlar bilan
  phone: string; // faqat raqamlar: 998880557888
  phone2: string;
  email: string;
  address: I18nText;
  workHours: I18nText;
  mapEmbedUrl: string;
  telegramBot: string; // Pack24AI_bot
  telegramChannel: string; // pack24uz
  instagram: string;
  deliveryFee: number; // Toshkent ichida kuryer narxi, so'm
  freeDeliveryFrom: number; // shu summadan yuqori bepul
  yandexMetrikaId: string;
  ga4Id: string;
  deliveryText: I18nText; // Markdown
  paymentText: I18nText;
  privacyText: I18nText;
  offerText: I18nText;
  vacanciesText: I18nText;
};

export const defaultSettings: SiteSettings = {
  companyName: 'Pack24',
  legalName: '',
  inn: '',
  bankDetails: '',
  directorName: '',
  vatPercent: 12,
  lowStockThreshold: 10,
  contractText: '',
  phone: '998880557888',
  phone2: '',
  email: 'info@pack24.uz',
  address: { uz: "Toshkent, Oybek ko'chasi 14", ru: 'Ташкент, ул. Айбека 14', en: '14 Oybek street, Tashkent' },
  workHours: { uz: 'Du-Sh, 9:00-18:00', ru: 'Пн-Сб, 9:00-18:00', en: 'Mon-Sat, 9:00-18:00' },
  mapEmbedUrl: '',
  telegramBot: 'Pack24AI_bot',
  telegramChannel: 'pack24uz',
  instagram: '',
  deliveryFee: 30000,
  freeDeliveryFrom: 1000000,
  yandexMetrikaId: '',
  ga4Id: '',
  deliveryText: {
    uz: "**Toshkent bo'ylab** kuryer orqali 1 ish kunida yetkaziladi.\n\n**Viloyatlarga** pochta yoki yuk tashish kompaniyalari orqali yuboramiz, narxi hajmga qarab menejer bilan kelishiladi.\n\n**Olib ketish**: omborimizdan ish vaqtida bepul.",
    ru: '**По Ташкенту** курьером за 1 рабочий день.\n\n**В регионы** отправляем почтой или транспортными компаниями, стоимость согласуется с менеджером.\n\n**Самовывоз**: со склада в рабочее время бесплатно.',
    en: '**Tashkent**: courier delivery within 1 business day.\n\n**Regions**: by post or freight carriers, price agreed with a manager.\n\n**Pickup**: free from our warehouse during working hours.',
  },
  paymentText: {
    uz: "- **Payme** va **Click**: saytda buyurtma berishda onlayn.\n- **Naqd**: kuryerga qabul qilishda.\n- **Bank o'tkazmasi**: yuridik shaxslar uchun hisob-faktura asosida (QQS bilan).",
    ru: '- **Payme** и **Click**: онлайн при оформлении заказа.\n- **Наличные**: курьеру при получении.\n- **Перечисление**: для юрлиц по счёту (с НДС).',
    en: '- **Payme** and **Click**: online at checkout.\n- **Cash**: to the courier on delivery.\n- **Bank transfer**: for companies against an invoice (with VAT).',
  },
  privacyText: {},
  offerText: {},
  vacanciesText: {},
};

const SETTINGS_KEY = 'site';

export const getSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    try {
      const row = await prisma.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
      const stored = (row?.value ?? {}) as Partial<SiteSettings>;
      return { ...defaultSettings, ...stored };
    } catch {
      return defaultSettings;
    }
  },
  ['site-settings'],
  { tags: ['settings'], revalidate: 300 },
);

export async function saveSettings(patch: Partial<SiteSettings>) {
  const row = await prisma.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
  const value = { ...defaultSettings, ...((row?.value ?? {}) as object), ...patch };
  await prisma.siteSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value },
    update: { value },
  });
}
