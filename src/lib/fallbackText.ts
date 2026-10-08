import type { Locale } from './i18n/config';

const texts: Record<string, Record<Locale, string>> = {
  privacy: {
    uz: "Matn tez orada joylanadi. Savollar bo'lsa, biz bilan bog'laning.",
    ru: 'Текст скоро будет опубликован. По вопросам свяжитесь с нами.',
    en: 'The text will be published soon. Contact us with any questions.',
  },
  offer: {
    uz: "Ommaviy oferta matni tez orada joylanadi. Buyurtma shartlarini menejerdan so'rang.",
    ru: 'Текст публичной оферты скоро будет опубликован. Условия заказа уточняйте у менеджера.',
    en: 'The public offer will be published soon. Ask a manager about order terms.',
  },
  vacancies: {
    uz: "Hozircha ochiq vakansiyalar yo'q. Rezyumeni info@pack24.uz ga yuborishingiz mumkin.",
    ru: 'Сейчас открытых вакансий нет. Резюме можно прислать на info@pack24.uz.',
    en: 'No open positions right now. You can send your CV to info@pack24.uz.',
  },
};

export function fallbackText(page: string, locale: Locale): string {
  return texts[page]?.[locale] ?? '';
}
