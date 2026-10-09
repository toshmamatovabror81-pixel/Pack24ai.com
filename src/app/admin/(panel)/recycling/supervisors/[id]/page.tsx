import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone } from '@/lib/format';
import { str } from '@/lib/params';
import { ACTIVE_STATUSES } from '@/lib/recycling/statuses';
import { Badge, Field, Notice, PageHeader } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { ConfirmButton } from '@/components/admin/recycling/ConfirmButton';
import { CopyButton } from '@/components/admin/recycling/CopyButton';
import { DriverStatusBadge, dt, RegistrationCode, RequestStatusBadge, TelegramBadge } from '@/components/admin/recycling/badges';
import { recyclingBadges } from '@/components/admin/recycling/helpers';
import { resetSupervisorTelegramAction, updateSupervisorAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function SupervisorDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('recycling');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const s = await prisma.supervisor.findUnique({ where: { id }, include: { point: true, drivers: { orderBy: { id: 'asc' } } } });
  if (!s) notFound();
  const [points, requests, badges] = await Promise.all([
    prisma.recyclePoint.findMany({ orderBy: { id: 'asc' } }),
    prisma.recycleRequest.findMany({ where: { supervisorId: id, status: { in: ACTIVE_STATUSES } }, orderBy: { createdAt: 'desc' }, take: 20, include: { assignedDriver: { select: { name: true } } } }),
    recyclingBadges(),
  ]);
  const created = str(sp.created) === '1';
  const reset = str(sp.reset) === '1';
  return (
    <>
      <PageHeader title={`Masul: ${s.name}`}>
        {s.isActive ? <Badge tone="green">Faol</Badge> : <Badge tone="slate">Nofaol</Badge>}
        <Link href="/admin/recycling/supervisors" className="btn-ghost px-4 py-2 text-sm">← Masullar</Link>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <Notice show={str(sp.saved) === '1'}>Saqlandi</Notice>
      <Notice show={!!str(sp.error)} tone="warn">{str(sp.error)}</Notice>
      {(created || reset || !s.telegramId) && s.registrationCode && (
        <div className="card mb-4 border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">{created ? 'Masul yaratildi.' : reset ? 'Telegram uzildi, yangi kod berildi.' : 'Masul hali botga ulanmagan.'} Masulga shu kodni va bot manzilini bering:</p>
          <p className="my-3 flex flex-wrap items-center gap-3"><RegistrationCode code={s.registrationCode} big /><CopyButton text={s.registrationCode} label="Kodni nusxalash" /></p>
          <p className="text-amber-900">Masul boti → <b>/start</b> → kodni yuboradi → «Telefonni ulashish» tugmasi (raqam <b>{displayPhone(s.phone)}</b> bilan mos bo'lishi shart). Kod bir martalik.</p>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <form action={updateSupervisorAction} className="card grid gap-4 p-5 sm:grid-cols-2">
            <input type="hidden" name="id" value={s.id} />
            <Field label="Ism *"><input name="name" required minLength={2} defaultValue={s.name} className="input" /></Field>
            <Field label="Telefon *"><input name="phone" type="tel" required defaultValue={displayPhone(s.phone)} className="input" /></Field>
            <Field label="Punkt" wide>
              <select name="pointId" defaultValue={s.pointId ?? ''} className="input">
                <option value="">Biriktirilmagan</option>
                {points.map((p) => <option key={p.id} value={p.id}>{p.cityUz} ({p.regionUz})</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="isActive" defaultChecked={s.isActive} /> Faol (nofaol masul botga kira olmaydi, arizalar unga yo'naltirilmaydi; faol arizalari bo'lsa nofaol qilib bo'lmaydi)</label>
            <div className="sm:col-span-2"><button className="btn-primary">Saqlash</button></div>
          </form>

          <div className="card p-4">
            <p className="mb-2 text-sm font-semibold">Faol arizalar ({requests.length})</p>
            {!requests.length ? <p className="text-sm text-slate-400">Hozir faol ariza yo'q</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Link href={`/admin/recycling/requests/${r.id}`} className="font-semibold text-brand-500">#{r.id}</Link>
                    <span>{r.name}</span>
                    <span className="text-xs text-slate-500">{r.volume ? `~${r.volume} kg · ` : ''}{dt(r.createdAt)}</span>
                    {r.assignedDriver && <span className="text-xs text-slate-500">🚛 {r.assignedDriver.name}</span>}
                    <span className="ml-auto"><RequestStatusBadge status={r.status} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <aside className="min-w-0 space-y-4">
          <div className="card p-4 text-sm">
            <p className="mb-2 font-semibold">Telegram</p>
            <p className="mb-1"><TelegramBadge telegramId={s.telegramId} telegramName={s.telegramName} /></p>
            {s.telegramId && <p className="text-xs text-slate-500">ID: {s.telegramId} · ulangan: {dt(s.registeredAt)}</p>}
            {!s.telegramId && <p className="text-xs text-slate-500">Kod: <RegistrationCode code={s.registrationCode} /></p>}
            <form action={resetSupervisorTelegramAction} className="mt-3">
              <input type="hidden" name="id" value={s.id} />
              <ConfirmButton message={s.telegramId ? 'Telegram uzilsinmi? Masul botdan chiqariladi va yangi kod beriladi.' : 'Yangi kod berilsinmi? Eski kod ishlamaydi.'} className="btn-ghost w-full py-2 text-sm">{s.telegramId ? 'Telegramni uzish / yangi kod' : 'Yangi kod berish'}</ConfirmButton>
            </form>
          </div>
          <div className="card p-4 text-sm">
            <p className="mb-2 flex items-center justify-between font-semibold">Haydovchilar ({s.drivers.length}) <Link href={`/admin/recycling/drivers/new?supervisorId=${s.id}${s.pointId ? `&pointId=${s.pointId}` : ''}`} className="text-xs font-normal text-brand-500">+ qo'shish</Link></p>
            {!s.drivers.length ? <p className="text-slate-400">Haydovchi yo'q</p> : (
              <ul className="space-y-2">
                {s.drivers.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/recycling/drivers/${d.id}`} className="font-medium text-brand-500">{d.name}</Link>
                    <span className="text-xs text-slate-500">{d.vehicleInfo ?? displayPhone(d.phone)}</span>
                    <DriverStatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-4 text-xs text-slate-500">
            <p>Yaratilgan: {dt(s.createdAt)}</p>
            <p>ID: {s.id}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
