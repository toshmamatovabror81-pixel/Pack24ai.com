/**
 * Client'da ishlaydigan hisob-kitob (lib/recycling/collections.ts 'server-only', shuning uchun formula shu yerda takrorlanadi):
 * effektiv = round2(w × (1 − d/100)), jami = round(effektiv × narx), haydovchi daromadi = round(w × stavka).
 */
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function weighPreview(weight: number, discount: number, pricePerKg: number, driverRatePerKg: number) {
  const w = Math.max(0, Number(weight) || 0);
  const d = Math.min(100, Math.max(0, Number(discount) || 0));
  const effective = round2(w * (1 - d / 100));
  const total = Math.round(effective * (Number(pricePerKg) || 0));
  const earning = Math.round(w * (Number(driverRatePerKg) || 0));
  return { weight: w, discount: d, effective, total, earning };
}

/** Karta raqami kiritilganda 4 talab guruhlash: 8600 1234 5678 9012 */
export const formatCardInput = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');

/** Karta turini prefiksdan aniqlash (wallet.ts bilan bir xil qoidalar, faqat ko'rinish uchun) */
export function cardTypeFromDigits(digits: string): 'uzcard' | 'humo' | 'visa' | 'mastercard' | 'other' | null {
  if (digits.length < 4) return null;
  if (digits.startsWith('8600') || digits.startsWith('5614')) return 'uzcard';
  if (digits.startsWith('9860')) return 'humo';
  if (digits.startsWith('4')) return 'visa';
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'mastercard';
  return 'other';
}
