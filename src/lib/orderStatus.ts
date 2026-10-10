import type { OrderStatus, PaymentStatus } from '@prisma/client';

/** Prisma enum "new_" bazada "new" */
export const statusKey = (s: OrderStatus) => (s === 'new_' ? 'new' : s) as 'draft' | 'new' | 'processing' | 'shipping' | 'delivered' | 'cancelled';
export const paymentKey = (s: PaymentStatus) => s;

/** Xodimlar uchun nomlar (admin panel va boshqaruv boti); mijozga ko'rinadigan matnlar i18n lug'atida (order.statuses) */
export const orderStatusNames: Record<OrderStatus, string> = {
  draft: 'Qoralama',
  new_: 'Yangi',
  processing: 'Tayyorlanmoqda',
  shipping: "Yo'lda",
  delivered: 'Yetkazildi',
  cancelled: 'Bekor qilingan',
};
export const paymentNames: Record<PaymentStatus, string> = {
  pending: "To'lanmagan",
  processing: 'Jarayonda',
  paid: "To'langan",
  failed: "O'tmadi",
  refunded: 'Qaytarilgan',
};
export const paymentMethodNames: Record<string, string> = { cash: 'Naqd', payme: 'Payme', click: 'Click', bank_transfer: "Bank o'tkazmasi" };

/** Admin panelda tanlanadigan holatlar (qoralama hech qachon qo'lda qo'yilmaydi) */
export const ORDER_STATUSES: OrderStatus[] = ['new_', 'processing', 'shipping', 'delivered', 'cancelled'];

/**
 * Buyurtmaning tabiiy yo'li: har holatdan qaysilariga o'tish mumkin. Boshqaruv boti tugmalari shu bo'yicha chiqadi
 * (bir bosishda xato holat qo'yib bo'lmaydi); admin panelda tuzatish uchun istalgan holat tanlanadi.
 */
export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  draft: [],
  new_: ['processing', 'cancelled'],
  processing: ['shipping', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/** To'lov holati qo'lda o'zgartiriladigan usullar: onlayn to'lovni Payme/Click o'zi belgilaydi */
export const isManualPayment = (method: string | null | undefined) => !method || method === 'cash' || method === 'bank_transfer';
