import type { RecycleCollection, RecycleRequestStatus } from '@prisma/client';
import { paymentStatusLabels } from '@/lib/recycling/statuses';
import { formatDate, formatPrice } from '@/lib/format';
import { confirmState } from './labels';

const sum = (v: unknown) => formatPrice(v as number, "so'm");
const CONFIRM_CLS = { waiting: 'bg-amber-50 text-amber-800', confirmed: 'bg-emerald-50 text-emerald-800', disputed: 'bg-red-50 text-red-700', closed: 'bg-slate-100 text-slate-600' };

/** Tortish natijasi: og'irlik, hisob, mijoz tasdig'i, to'lov holati va haydovchi daromadi */
export function CollectionSummary({ c, earning, status }: { c: RecycleCollection; earning: number | null; status: RecycleRequestStatus }) {
  const confirm = confirmState(c.customerConfirmed, status, c.paymentStatus);
  return (
    <section className="card space-y-2 p-4 text-sm">
      <h2 className="text-base font-bold">⚖️ Tortish natijasi</h2>
      <p className="flex justify-between"><span>Haqiqiy og'irlik</span><b>{c.actualWeight} kg</b></p>
      {c.discountPercent > 0 && <p className="flex justify-between"><span>Chegirma {c.discountPercent}%{c.discountReason ? ` (${c.discountReason})` : ''}</span><b>→ {c.effectiveWeight} kg</b></p>}
      <p className="flex justify-between"><span>Narx</span><span>{sum(c.pricePerKg)}/kg</span></p>
      <p className="flex justify-between text-base"><span>Mijozga jami</span><b>{sum(c.totalAmount)}</b></p>
      {earning != null && <p className="flex justify-between text-emerald-700"><span>Sizning daromadingiz</span><b>{sum(earning)}</b></p>}
      {c.notes && <p className="text-slate-500">Izoh: {c.notes}</p>}
      <p className={`rounded-lg px-3 py-2 ${CONFIRM_CLS[confirm.kind]}`}>{confirm.text}{c.customerComment ? ` — ${c.customerComment}` : ''}</p>
      <p className="flex justify-between"><span>To'lov</span><span>{paymentStatusLabels[c.paymentStatus]}</span></p>
      {c.paymentToDriver != null && <p className="flex justify-between"><span>Sizga to'landi</span><b>{sum(c.paymentToDriver)}</b></p>}
      {c.paidAt && <p className="text-xs text-slate-400">{formatDate(c.paidAt, 'uz', true)}{c.paidBy ? ` · ${c.paidBy}` : ''}</p>}
    </section>
  );
}
