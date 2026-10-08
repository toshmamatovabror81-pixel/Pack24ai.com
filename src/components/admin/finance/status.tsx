import type { ContractStatus, CorporateInvoice, InvoiceStatus } from '@prisma/client';
import { Badge } from '../ui';

export const contractStatusNames: Record<ContractStatus, string> = { active: 'Faol', suspended: "To'xtatilgan", closed: 'Yopilgan' };
export const invoiceStatusNames: Record<InvoiceStatus, string> = {
  issued: 'Berilgan',
  partial: "Qisman to'langan",
  paid: "To'langan",
  overdue: "Muddati o'tgan",
  cancelled: 'Bekor qilingan',
};

/** Muddati o'tganini o'qishda hisoblaymiz: berilgan/qisman to'langan va muddati o'tgan bo'lsa */
export function effectiveInvoiceStatus(inv: Pick<CorporateInvoice, 'status' | 'dueDate'>, now = new Date()): InvoiceStatus {
  if ((inv.status === 'issued' || inv.status === 'partial') && inv.dueDate < now) return 'overdue';
  return inv.status;
}

export function contractStatusBadge(s: ContractStatus) {
  const tone = s === 'active' ? 'green' : s === 'suspended' ? 'amber' : 'slate';
  return <Badge tone={tone}>{contractStatusNames[s]}</Badge>;
}

export function invoiceStatusBadge(inv: Pick<CorporateInvoice, 'status' | 'dueDate'>) {
  const s = effectiveInvoiceStatus(inv);
  const tone = s === 'paid' ? 'green' : s === 'overdue' ? 'red' : s === 'partial' ? 'amber' : s === 'cancelled' ? 'slate' : 'blue';
  return <Badge tone={tone}>{invoiceStatusNames[s]}</Badge>;
}
