import type { LeadStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import { Badge } from './ui';

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
export const leadStatusNames: Record<LeadStatus, string> = { new_: 'Yangi', in_progress: 'Ishlanmoqda', done: 'Bajarildi', rejected: 'Rad etildi' };
export const leadTypeNames: Record<string, string> = {
  wholesale: 'Ulgurji narx',
  custom_box: 'Individual quti',
  callback: "Qo'ng'iroq",
  contact: 'Aloqa',
  recycling: 'Makulatura (arxiv)',
};

export function orderStatusBadge(s: OrderStatus) {
  const tone = s === 'new_' ? 'blue' : s === 'delivered' ? 'green' : s === 'cancelled' ? 'red' : s === 'draft' ? 'slate' : 'amber';
  return <Badge tone={tone}>{orderStatusNames[s]}</Badge>;
}
export function paymentBadge(s: PaymentStatus) {
  const tone = s === 'paid' ? 'green' : s === 'failed' ? 'red' : s === 'refunded' ? 'slate' : 'amber';
  return <Badge tone={tone}>{paymentNames[s]}</Badge>;
}
export function leadStatusBadge(s: LeadStatus) {
  const tone = s === 'new_' ? 'blue' : s === 'done' ? 'green' : s === 'rejected' ? 'red' : 'amber';
  return <Badge tone={tone}>{leadStatusNames[s]}</Badge>;
}
