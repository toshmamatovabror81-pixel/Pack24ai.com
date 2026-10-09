import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireDriver } from '@/lib/auth/driver';
import { REQUEST_INCLUDE } from '@/lib/recycling/requests';
import { MATERIALS, materialLabels } from '@/lib/recycling/statuses';
import { formatDate, toNumber } from '@/lib/format';
import { CollectionSummary } from '@/components/driver/CollectionSummary';
import { Flash } from '@/components/driver/Flash';
import { TaskCard } from '@/components/driver/TaskCard';
import { WeighForm } from '@/components/driver/WeighForm';
import { acceptedTaskIds } from '../../accepted';

export const dynamic = 'force-dynamic';

const WEIGHABLE = ['arrived', 'collecting', 'collected', 'disputed'];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Ariza #${(await params).id}` };
}

export default async function DriverTaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const d = await requireDriver();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const r = await prisma.recycleRequest.findUnique({ where: { id }, include: { ...REQUEST_INCLUDE, collections: { orderBy: { id: 'desc' }, take: 1 } } });
  // Begona topshiriq — 404 (mavjudligini ham oshkor qilmaymiz)
  if (!r || r.assignedDriverId !== d.id) notFound();
  const c = r.collections[0] ?? null;
  const [earningTx, sp, accepted] = await Promise.all([
    c ? prisma.driverTransaction.findFirst({ where: { collectionId: c.id, type: 'earning' }, select: { amount: true } }) : null,
    searchParams,
    acceptedTaskIds(d.id, [r]),
  ]);
  const canWeigh = WEIGHABLE.includes(r.status);
  const again = r.status === 'collected' || r.status === 'disputed';
  const timeline = [
    ['Tayinlandi', r.assignedAt], ["Yo'lga chiqdi", r.driverEnRouteAt], ['Yetib keldi', r.driverArrivedAt], ['Tortildi', r.collectedAt],
    ['Mijoz tasdiqladi', r.confirmedAt], ['Yakunlandi', r.completedAt], ['Bekor qilindi', r.cancelledAt],
  ].filter((x): x is [string, Date] => x[1] instanceof Date);

  return (
    <>
      <Link href="/driver" className="mb-3 inline-block text-sm text-brand-500">← Topshiriqlar</Link>
      <Flash saved={sp.saved} error={sp.error} info={r.status === 'cancelled' ? '🚫 Bu ariza bekor qilingan — hech narsa qilish shart emas.' : null} />
      <div className="space-y-3">
        <TaskCard task={r} detail accepted={accepted.has(r.id)} />
        {c && <CollectionSummary c={c} earning={earningTx ? toNumber(earningTx.amount) : null} status={r.status} />}
        {canWeigh && (() => {
          const form = (
            <WeighForm
              requestId={r.id}
              pricePerKg={toNumber(r.point.pricePerKg)}
              driverRatePerKg={toNumber(r.point.driverRatePerKg)}
              materials={MATERIALS.map((m) => ({ value: m, label: materialLabels.uz[m] }))}
              defaultMaterial={c?.materialType ?? r.material}
              defaults={c ? { weight: c.actualWeight, discount: c.discountPercent, notes: c.notes } : null}
              again={again}
            />
          );
          // Tortilgan arizada qayta tortish yig'iq turadi (faqat xato bo'lsa kerak)
          return again ? (
            <details className="card p-4" open={!!sp.error}>
              <summary className="cursor-pointer select-none text-sm font-medium text-brand-500">⚖️ Qayta tortish (xato bo'lsa)</summary>
              <div className="mt-3 -mx-4 -mb-4">{form}</div>
            </details>
          ) : form;
        })()}
        {timeline.length > 0 && (
          <section className="card p-4 text-sm">
            <h2 className="mb-2 text-base font-bold">🕒 Vaqtlar</h2>
            <ul className="space-y-1">
              {timeline.map(([label, at]) => <li key={label} className="flex justify-between"><span className="text-slate-500">{label}</span><span>{formatDate(at, 'uz', true)}</span></li>)}
            </ul>
          </section>
        )}
        {r.completedNote && <p className="text-xs text-slate-500">{r.completedNote}</p>}
      </div>
    </>
  );
}
