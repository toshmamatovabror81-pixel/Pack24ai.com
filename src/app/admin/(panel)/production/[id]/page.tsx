import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate } from '@/lib/format';
import { Notice, PageHeader, Table } from '@/components/admin/ui';
import { STAGE_ORDER, productionStageNames } from '@/components/admin/production/names';
import { ProgressBar, isOverdue, priorityBadge, productionStageBadge, stageStatusBadge, workOrderStatusBadge } from '@/components/admin/production/badges';
import { WorkOrderForm } from '../WorkOrderForm';
import { ensureStages, finishStage, saveStage, startStage } from '../actions';

export const metadata = { title: 'Ish buyurtmasi' };

export default async function WorkOrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireStaff('production');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) notFound();
  const wo = await prisma.workOrder.findUnique({ where: { id }, include: { stages: true, order: { select: { id: true } }, lead: { select: { id: true, type: true } } } });
  if (!wo) notFound();
  const sp = await searchParams;
  // Bosqichlar belgilangan tartibda
  const stages = STAGE_ORDER.map((s) => wo.stages.find((st) => st.stage === s)).filter((s) => s != null);
  const overdue = isOverdue(wo.deadline, wo.status);
  return (
    <>
      <PageHeader title={`${wo.orderNo} · ${wo.productName}`}>
        <Link href="/admin/production" className="btn-ghost px-4 py-2 text-sm">← Ro'yxat</Link>
      </PageHeader>
      <Notice show={sp.saved === '1'}>Saqlandi</Notice>
      <Notice show={sp.error === '1'} tone="warn">Mijoz, mahsulot, soni va muddat majburiy</Notice>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <WorkOrderForm wo={wo} />
        <aside className="space-y-4">
          <div className="card space-y-3 p-4 text-sm">
            <p className="flex items-center justify-between">Holat {workOrderStatusBadge(wo.status)}</p>
            <p className="flex items-center justify-between">Muhimlik {priorityBadge(wo.priority)}</p>
            <p className="flex items-center justify-between">Joriy bosqich {productionStageBadge(wo.currentStage)}</p>
            <p className="flex items-center justify-between">Progress <ProgressBar value={wo.progress} /></p>
            <p className="flex items-center justify-between">Muddat <span className={overdue ? 'font-semibold text-red-600' : 'font-medium'}>{formatDate(wo.deadline, 'uz')}{overdue && " · o'tgan"}</span></p>
            <p className="flex items-center justify-between">Telefon {wo.customerPhone ? <a href={`tel:+${wo.customerPhone.replace(/\D/g, '')}`} className="text-brand-500">{displayPhone(wo.customerPhone)}</a> : '—'}</p>
            {wo.areaPerPiece != null && <p className="flex items-center justify-between">Maydon, 1 dona <span>{wo.areaPerPiece} m²</span></p>}
            {wo.totalArea != null && <p className="flex items-center justify-between">Umumiy maydon <span className="font-medium">{wo.totalArea} m²</span></p>}
            <p className="flex items-center justify-between text-slate-500">Yaratilgan <span>{formatDate(wo.createdAt, 'uz', true)}</span></p>
          </div>
          {(wo.order || wo.lead) && (
            <div className="card space-y-1 p-4 text-sm">
              <p className="mb-1 font-semibold">Bog'langan</p>
              {wo.order && <p><Link href={`/admin/orders/${wo.order.id}`} className="text-brand-500 hover:underline">Buyurtma #{wo.order.id} →</Link></p>}
              {wo.lead && <p><Link href={`/admin/leads?open=${wo.lead.id}`} className="text-brand-500 hover:underline">Ariza #{wo.lead.id} →</Link></p>}
            </div>
          )}
        </aside>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Bosqichlar</h2>
      {/* Har bir bosqich uchun alohida forma (jadval tashqarisida); maydonlar form= orqali bog'lanadi.
          Yashirin tugma — Enter bosilganda "Saqlash" ishlaydi (Boshlash/Yakunlash emas) */}
      {stages.map((s) => (
        <form key={s.id} id={`stage-${s.id}`} action={saveStage}>
          <input type="hidden" name="stageId" value={s.id} />
          <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
        </form>
      ))}
      <Table head={['Bosqich', 'Holat', 'Operator', 'Izoh', 'Boshlandi', 'Yakunlandi', '']} empty={!stages.length}>
        {stages.map((s) => (
          <tr key={s.id} className="align-middle">
            <td className="whitespace-nowrap px-4 py-3 font-medium">{productionStageNames[s.stage]}</td>
            <td className="px-4 py-3">{stageStatusBadge(s.status)}</td>
            <td className="px-4 py-3"><input form={`stage-${s.id}`} name="operator" defaultValue={s.operator ?? ''} placeholder="Operator" className="input min-w-32 py-1.5" /></td>
            <td className="px-4 py-3"><input form={`stage-${s.id}`} name="notes" defaultValue={s.notes ?? ''} placeholder="Izoh" className="input min-w-40 py-1.5" /></td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{s.startedAt ? formatDate(s.startedAt, 'uz', true) : '—'}</td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{s.completedAt ? formatDate(s.completedAt, 'uz', true) : '—'}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right">
              <span className="inline-flex gap-1">
                {s.status === 'pending' && <button form={`stage-${s.id}`} formAction={startStage} className="btn-primary px-3 py-1.5 text-xs">Boshlash</button>}
                {s.status !== 'completed' && <button form={`stage-${s.id}`} formAction={finishStage} className="btn-accent px-3 py-1.5 text-xs">Yakunlash</button>}
                <button form={`stage-${s.id}`} className="btn-ghost px-3 py-1.5 text-xs">Saqlash</button>
              </span>
            </td>
          </tr>
        ))}
      </Table>
      {stages.length < STAGE_ORDER.length && (
        <form action={ensureStages} className="mt-3">
          <input type="hidden" name="id" value={wo.id} />
          <button className="btn-ghost px-4 py-2 text-sm">Yetishmayotgan bosqichlarni yaratish</button>
        </form>
      )}
    </>
  );
}
