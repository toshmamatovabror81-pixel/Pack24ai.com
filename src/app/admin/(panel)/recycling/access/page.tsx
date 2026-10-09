import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate } from '@/lib/format';
import { str, type SearchParams } from '@/lib/params';
import { pendingAccessRequests } from '@/lib/recycling/access';
import { Badge, Notice, PageHeader, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { ConfirmButton } from '@/components/admin/recycling/ConfirmButton';
import { recyclingNavBadges } from '../events/navBadges';
import { approveAccessAction, rejectAccessAction } from './actions';

export const metadata = { title: "Kirish so'rovlari" };
export const dynamic = 'force-dynamic';

const roleLabel = (r: 'driver' | 'supervisor') => (r === 'driver' ? 'Haydovchi' : 'Masul');
function RoleBadge({ role }: { role: 'driver' | 'supervisor' }) {
  return <Badge tone={role === 'driver' ? 'blue' : 'amber'}>{roleLabel(role)}</Badge>;
}

export default async function AccessRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const [pending, history, points, supervisors, badges] = await Promise.all([
    pendingAccessRequests(),
    prisma.botAccessRequest.findMany({ where: { status: { in: ['approved', 'rejected'] } }, orderBy: { updatedAt: 'desc' }, take: 50, include: { requestedPoint: true, requestedSupervisor: { select: { name: true } }, createdDriver: { select: { id: true, name: true } }, createdSupervisor: { select: { id: true, name: true } }, approvedByHqAdmin: { select: { name: true } }, approvedBySupervisor: { select: { name: true } } } }),
    prisma.recyclePoint.findMany({ orderBy: { id: 'asc' }, select: { id: true, cityUz: true, regionUz: true } }),
    prisma.supervisor.findMany({ where: { isActive: true }, orderBy: { id: 'asc' }, select: { id: true, name: true, pointId: true, point: { select: { cityUz: true } } } }),
    recyclingNavBadges(),
  ]);
  // Masul select: barcha faol masullar punkt bo'yicha guruhlab (admin punktni o'zgartirsa ham ro'yxat to'liq)
  const supGroups = [...points.map((p) => ({ key: `p${p.id}`, label: p.cityUz, items: supervisors.filter((s) => s.pointId === p.id) })), { key: 'none', label: 'Punktsiz', items: supervisors.filter((s) => !s.pointId || !points.some((p) => p.id === s.pointId)) }].filter((g) => g.items.length);
  const approved = str(sp.approved);
  const [createdRole, createdId] = approved?.includes(':') ? approved.split(':') : [null, null];
  const error = str(sp.error);

  return (
    <>
      <PageHeader title={`Kirish so'rovlari (${pending.length})`} />
      <RecyclingNav badges={badges} />
      <Notice show={!!approved}>
        So'rov tasdiqlandi — Telegram darhol bog'landi, so'rovchiga xabar yuborildi.{' '}
        {createdRole === 'driver' && createdId && <Link href={`/admin/recycling/drivers/${createdId}`} className="underline">Haydovchi sahifasi →</Link>}
        {createdRole === 'supervisor' && createdId && <Link href={`/admin/recycling/supervisors/${createdId}`} className="underline">Masul sahifasi →</Link>}
      </Notice>
      <Notice show={str(sp.rejected) === '1'}>So'rov rad etildi, so'rovchiga xabar yuborildi.</Notice>
      <Notice show={!!error} tone="warn">{error}</Notice>
      <p className="mb-4 text-sm text-slate-500">
        Haydovchi yoki masul botida kodi yo'q foydalanuvchi «kirish so'rovi» yuboradi. Tasdiqlansa yozuv yaratiladi va Telegram kodsiz bog'lanadi. HQ boti orqali ham tasdiqlash mumkin.
      </p>

      {!pending.length ? (
        <div className="card mb-8 p-6 text-center text-slate-500">Kutilayotgan so'rov yo'q</div>
      ) : (
        <div className="mb-8 space-y-3">
          {pending.map((r) => {
            return (
              <div key={r.id} className="card grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p className="sm:col-span-2"><RoleBadge role={r.role} /> <span className="ml-1 text-lg font-semibold">{r.name}</span> <span className="text-xs text-slate-400">#{r.id}</span></p>
                  <p>📞 <a href={`tel:+${r.phone}`} className="text-brand-500">{displayPhone(r.phone)}</a></p>
                  <p>Telegram: {r.telegramName ? <b>{r.telegramName}</b> : <span className="text-slate-400">nomi yo'q</span>}{r.telegramId && <span className="text-xs text-slate-400"> · ID {r.telegramId}</span>}</p>
                  <p>So'ralgan punkt: <b>{r.requestedPoint ? `${r.requestedPoint.cityUz} (${r.requestedPoint.regionUz})` : '—'}</b></p>
                  <p>So'ralgan masul: <b>{r.requestedSupervisor?.name ?? '—'}</b></p>
                  {r.role === 'driver' && <p>🚚 Mashina: <b>{r.vehicleInfo ?? '—'}</b></p>}
                  <p className="text-slate-500">Sana: {formatDate(r.createdAt, 'uz', true)}</p>
                </div>
                <div className="flex flex-col gap-3 lg:w-80">
                  <form action={approveAccessAction} className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="role" value={r.role} />
                    <label className="text-xs text-emerald-900">Punkt
                      <select name="pointId" defaultValue={r.requestedPointId ?? ''} className="input py-1.5">
                        <option value="">Biriktirilmagan</option>
                        {points.map((p) => <option key={p.id} value={p.id}>{p.cityUz} ({p.regionUz})</option>)}
                      </select>
                    </label>
                    {r.role === 'driver' && (
                      <label className="text-xs text-emerald-900">Masul
                        <select name="supervisorId" defaultValue={r.requestedSupervisorId ?? ''} className="input py-1.5">
                          <option value="">Tanlangan punktning birinchi faol masuli</option>
                          {supGroups.map((g) => (
                            <optgroup key={g.key} label={g.label}>
                              {g.items.map((s) => <option key={s.id} value={s.id}>{s.name}{s.id === r.requestedSupervisorId ? " (so'ralgan)" : ''}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                    )}
                    <button className="btn-primary px-4 py-2 text-sm">✅ Tasdiqlash</button>
                  </form>
                  <form action={rejectAccessAction} className="flex gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="reason" placeholder="Sabab (ixtiyoriy)" className="input py-1.5" />
                    <ConfirmButton message="So'rov rad etilsinmi?" className="btn-ghost whitespace-nowrap px-3 py-1.5 text-sm text-red-600">❌ Rad</ConfirmButton>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold">Tarix <span className="text-sm font-normal text-slate-500">oxirgi {history.length}</span></h2>
      <Table head={['#', 'Rol', 'Ism', 'Telefon', 'Telegram', 'Punkt', 'Masul', 'Mashina', 'Natija', 'Kim', 'Sana']} empty={!history.length}>
        {history.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            <td className="px-4 py-2 text-slate-500">{r.id}</td>
            <td className="px-4 py-2"><RoleBadge role={r.role} /></td>
            <td className="px-4 py-2 font-medium">
              {r.createdDriver ? <Link href={`/admin/recycling/drivers/${r.createdDriver.id}`} className="text-brand-500 hover:underline">{r.name}</Link>
                : r.createdSupervisor ? <Link href={`/admin/recycling/supervisors/${r.createdSupervisor.id}`} className="text-brand-500 hover:underline">{r.name}</Link>
                  : r.name}
            </td>
            <td className="whitespace-nowrap px-4 py-2">{displayPhone(r.phone)}</td>
            <td className="px-4 py-2 text-sm">{r.telegramName ?? <span className="text-slate-400">—</span>}</td>
            <td className="px-4 py-2 text-sm">{r.requestedPoint?.cityUz ?? '—'}</td>
            <td className="px-4 py-2 text-sm">{r.requestedSupervisor?.name ?? '—'}</td>
            <td className="px-4 py-2 text-sm">{r.vehicleInfo ?? '—'}</td>
            <td className="px-4 py-2">{r.status === 'approved' ? <Badge tone="green">Tasdiqlandi</Badge> : <><Badge tone="red">Rad etildi</Badge>{r.rejectReason && <span className="block text-xs text-slate-500">{r.rejectReason}</span>}</>}</td>
            <td className="px-4 py-2 text-sm">{r.approvedByHqAdmin?.name ?? r.approvedBySupervisor?.name ?? 'Admin panel'}</td>
            <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{formatDate(r.approvedAt ?? r.rejectedAt ?? r.updatedAt, 'uz', true)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
