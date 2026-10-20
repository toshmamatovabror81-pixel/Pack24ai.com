/**
 * Sayt manzili. APP_URL serverda ishga tushganda .env dan o'qiladi (docker-compose DOMAIN'dan yasaydi);
 * NEXT_PUBLIC_APP_URL faqat build vaqtida inlayn bo'ladi, shuning uchun zaxira sifatida qoldirilgan.
 */
export function siteUrl(): string {
  const url = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://pack24.uz';
  return url.replace(/\/+$/, '');
}
