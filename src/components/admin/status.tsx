import type { LeadStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import { orderStatusNames, paymentNames } from '@/lib/orderStatus';
import { Badge } from './ui';

// Nomlar React'siz modulda (botlar ham ishlatadi); admin sahifalar eski joyidan import qilaveradi
export { orderStatusNames, paymentMethodNames, paymentNames } from '@/lib/orderStatus';
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
