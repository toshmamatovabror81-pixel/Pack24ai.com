/** Telefon maydoni: +998 90 123 45 67 ko'rinishiga keltirish (faqat O'zbekiston raqamlari). Client va testda ishlaydi. */
export function formatPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  d = d.slice(0, 9);
  if (!d) return raw.trim() ? '+998 ' : '';
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return `+998 ${parts.join(' ')}`;
}
