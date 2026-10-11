import type { ContractStatus, CorporateInvoice } from '@prisma/client';
import { contractStatusNames, effectiveInvoiceStatus, invoiceStatusNames } from '@/lib/invoiceStatus';
import { Badge } from '../ui';

// Nomlar va hisob React'siz modulda (botlar ham ishlatadi); admin sahifalar eski joyidan import qilaveradi
export { contractStatusNames, effectiveInvoiceStatus, invoiceStatusNames } from '@/lib/invoiceStatus';

export function contractStatusBadge(s: ContractStatus) {
  const tone = s === 'active' ? 'green' : s === 'suspended' ? 'amber' : 'slate';
  return <Badge tone={tone}>{contractStatusNames[s]}</Badge>;
}

export function invoiceStatusBadge(inv: Pick<CorporateInvoice, 'status' | 'dueDate'>) {
  const s = effectiveInvoiceStatus(inv);
  const tone = s === 'paid' ? 'green' : s === 'overdue' ? 'red' : s === 'partial' ? 'amber' : s === 'cancelled' ? 'slate' : 'blue';
  return <Badge tone={tone}>{invoiceStatusNames[s]}</Badge>;
}
