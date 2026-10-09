import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone } from '@/lib/format';
import { str } from '@/lib/params';
import { ACTIVE_STATUSES } from '@/lib/recycling/statuses';
import { Badge, Notice, PageHeader } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { PointForm } from '@/components/admin/recycling/PointForm';
import { ConfirmButton } from '@/components/admin/recycling/ConfirmButton';
import { DriverStatusBadge, dt, RegistrationCode, TelegramBadge } from '@/components/admin/recycling/badges';
import { POINT_LINK_COUNTS, pointLinkedCount, recyclingBadges } from '@/components/admin/recycling/helpers';
import { deletePointAction, updatePointAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function PointDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('recycling');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const point = await prisma.recyclePoint.findUnique({
    where: { id },
    include: {
      supervisors: { orderBy: { id: 'asc' } },
      drivers: { orderBy: { id: 'asc' } },
      _count: { select: POINT_LINK_COUNTS },
    },
  });
  if (!point) notFound();
  const [activeCount, badges] = await Promise.all([
    prisma.recycleRequest.count({ where: { pointId: id, status: { in: ACTIVE_STATUSES } } }),
    recyclingBadges(),
  ]);
  // Bog'langan yozuvlar: arizalar, xodimlar, jurnal (qabul/press/xarajat/kassa/sotuv), so'rovlar — o'chirish faqat 0 bo'lsa
  const linked = pointLinkedCount(point._count);
  const journalCount = point._count.intakeLogs + point._count.pressLogs + point._count.expenseLogs + point._count.cashLogs + point._count.salesLogs + point._count.journalCorrectionRequests;
  return (
    <>
      <PageHeader title={`Punkt: ${point.cityUz}`}>
        {point.status === 'active' ? <Badge tone="green">Faol</Badge> : <Badge tone="slate">Rejada</Badge>}
        <Link href={`/admin/recycling?point=${point.id}`} className="btn-ghost px-4 py-2 text-sm">Arizalar ({activeCount} faol)</Link>
        <Link href="/admin/recycling/points" className="btn-ghost px-4 py-2 text-sm">← Punktlar</Link>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <Notice show={str(sp.saved) === '1'}>Saqlandi</Notice>
      <Notice show={str(sp.archived) === '1'} tone="warn">Punktga yozuvlar (arizalar, xodimlar yoki jurnal) bog'langan — o'chirilmadi, «Rejada» holatiga o'tkazildi va qabul to'xtatildi.</Notice>
      <Notice show={!!str(sp.error)} tone="warn">{str(sp.error)}</Notice>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <PointForm point={point} action={updatePointAction} submitLabel="Saqlash" />
        <aside className="min-w-0 space-y-4">
          <div className="card p-4 text-sm">
            <p className="mb-2 flex items-center justify-between font-semibold">Masullar ({point.supervisors.length}) <Link href={`/admin/recycling/supervisors/new?pointId=${point.id}`} className="text-xs font-normal text-brand-500">+ qo'shish</Link></p>
            {!point.supervisors.length ? <p className="text-amber-700">Masul biriktirilmagan — yangi arizalar «Yangi» holatida qoladi, HQ botiga xabar boradi.</p> : (
              <ul className="space-y-2">
                {point.supervisors.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/recycling/supervisors/${s.id}`} className={`font-medium text-brand-500 ${s.isActive ? '' : 'line-through'}`}>{s.name}</Link>
                    <span className="text-xs text-slate-500">{displayPhone(s.phone)}</span>
                    <TelegramBadge telegramId={s.telegramId} telegramName={s.telegramName} />
                    {!s.telegramId && <RegistrationCode code={s.registrationCode} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-4 text-sm">
            <p className="mb-2 flex items-center justify-between font-semibold">Haydovchilar ({point.drivers.length}) <Link href={`/admin/recycling/drivers/new?pointId=${point.id}`} className="text-xs font-normal text-brand-500">+ qo'shish</Link></p>
            {!point.drivers.length ? <p className="text-slate-400">Haydovchi yo'q</p> : (
              <ul className="space-y-2">
                {point.drivers.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/recycling/drivers/${d.id}`} className="font-medium text-brand-500">{d.name}</Link>
                    <span className="text-xs text-slate-500">{d.vehicleInfo ?? displayPhone(d.phone)}</span>
                    <DriverStatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-4 text-sm">
            <p className="mb-1 font-semibold">Statistika</p>
            <p>Jami arizalar: <b>{point._count.requests}</b> · faol: <b>{activeCount}</b></p>
            <p className="text-xs text-slate-500">Jurnal yozuvlari: {journalCount} · so'rovlar: {point._count.botAccessRequests}</p>
            <p className="text-xs text-slate-500">Yaratilgan: {dt(point.createdAt)}</p>
          </div>
          <form action={deletePointAction} className="card p-4 text-sm">
            <input type="hidden" name="id" value={point.id} />
            <p className="mb-2 font-semibold text-red-700">O'chirish</p>
            <p className="mb-2 text-xs text-slate-500">{linked ? `Bog'langan yozuvlar bor (${linked}: arizalar, xodimlar, jurnal, so'rovlar) — o'chirilmaydi, «Rejada» holatiga o'tkaziladi va qabul to'xtatiladi.` : "Bog'langan yozuvlar yo'q — punkt butunlay o'chiriladi."}</p>
            <ConfirmButton message={linked ? 'Punkt «Rejada» holatiga o‘tkazilsinmi?' : 'Punkt butunlay o‘chirilsinmi?'} className="btn-ghost w-full py-2 text-sm text-red-700">{linked ? 'Rejaga o\'tkazish' : "O'chirish"}</ConfirmButton>
          </form>
        </aside>
      </div>
    </>
  );
}
