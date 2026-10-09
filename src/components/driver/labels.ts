import type { CardType, DriverTransactionStatus, DriverTransactionType } from '@prisma/client';

/** Haydovchi kabineti yorliqlari (faqat o'zbek). Server va client'da ishlaydi. */

export const txTypeLabels: Record<DriverTransactionType, string> = { earning: 'Daromad', withdrawal: 'Yechib olish', bonus: 'Bonus' };
export const txStatusLabels: Record<DriverTransactionStatus, string> = { pending: 'Kutilmoqda', completed: 'Bajarildi', failed: 'Rad etildi' };
export const txStatusTone: Record<DriverTransactionStatus, 'amber' | 'green' | 'red'> = { pending: 'amber', completed: 'green', failed: 'red' };
export const cardTypeLabels: Record<CardType, string> = { uzcard: 'Uzcard', humo: 'Humo', visa: 'Visa', mastercard: 'Mastercard', other: 'Boshqa' };

export const REJECT_REASONS = [
  { value: 'band', label: 'Bandman' },
  { value: 'uzoq', label: 'Juda uzoq' },
  { value: 'nosoz', label: 'Mashina nosoz' },
  { value: 'boshqa', label: 'Boshqa sabab' },
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number]['value'];

export const DISCOUNT_REASONS = [
  { value: 'namlik', label: 'Namlik' },
  { value: 'iflos', label: 'Iflos' },
  { value: 'aralash', label: 'Aralash' },
  { value: 'boshqa', label: 'Boshqa' },
] as const;
export type DiscountReason = (typeof DISCOUNT_REASONS)[number]['value'];

export const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20, 30, 50] as const;

/** Muvaffaqiyat xabarlari: ?saved=<kalit> */
export const SAVED_MESSAGES: Record<string, string> = {
  accept: 'Topshiriq qabul qilindi',
  reject: 'Topshiriq rad etildi',
  en_route: "Yo'lga chiqdingiz — mijoz va masulga xabar ketdi",
  arrived: 'Yetib kelganingiz belgilandi',
  collecting: "Yig'ish boshlandi",
  weighed: 'Tortish saqlandi. Mijozga tasdiqlash yuborildi',
  withdraw: "Yechib olish so'rovi yuborildi — masul tasdiqlaydi",
  card: "Karta qo'shildi",
  card_removed: "Karta o'chirildi",
  online: 'Siz onlaynsiz — topshiriqlar kelishi mumkin',
  offline: 'Siz oflaynsiz',
  profile: 'Saqlandi',
};

/** Tortish natijasidagi mijoz tasdig'i qatori. Masul tasdiqsiz yakunlasa (completed yoki to'lov belgilangan) "kutilmoqda" chiqmaydi. */
export function confirmState(customerConfirmed: boolean | null, status: string, paymentStatus: string): { kind: 'waiting' | 'confirmed' | 'disputed' | 'closed'; text: string } {
  if (customerConfirmed === true) return { kind: 'confirmed', text: '🤝 Mijoz tasdiqladi' };
  if (customerConfirmed === false) return { kind: 'disputed', text: '⚠️ Mijoz rozi emas' };
  if (status === 'completed' || status === 'confirmed' || paymentStatus !== 'pending') return { kind: 'closed', text: "✔️ Mijoz tasdig'isiz yakunlandi" };
  return { kind: 'waiting', text: "⏳ Mijoz tasdig'i kutilmoqda" };
}

export const rejectReasonLabel = (v: string): string | null => REJECT_REASONS.find((r) => r.value === v)?.label ?? null;
export const discountReasonLabel = (v: string): string | null => DISCOUNT_REASONS.find((r) => r.value === v)?.label ?? null;
