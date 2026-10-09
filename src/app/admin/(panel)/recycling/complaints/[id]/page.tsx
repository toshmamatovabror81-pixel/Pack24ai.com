import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate, formatPrice } from '@/lib/format';
import { str, type SearchParams } from '@/lib/params';
import { materialLabels } from '@/lib/recycling/statuses';
import { Badge, Field, Notice, PageHeader } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { ConfirmButton } from '@/components/admin/recycling/ConfirmButton';
import { ComplaintBadge, Info, RequestStatusBadge } from '@/components/admin/recycling/badges';
import { recyclingNavBadges } from '../../events/navBadges';
import { escalateComplaintAction, respondComplaintAction, setComplaintStatusAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ComplaintDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  await requireStaff('recycling');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const [c, badges] = await Promise.all([
    prisma.recycleComplaint.findUnique({
      where: { id },
      include: { request: { include: { point: true, supervisor: true, assignedDriver: true, collections: { orderBy: { id: 'desc' }, take: 1 } } } },
    }),
    recyclingNavBadges(),
  ]);
  if (!c) notFound();
  const r = c.request;
  const col = r.collections[0];
  const active = c.status === 'open' || c.status === 'in_progress';
  const error = str(sp.error);

  return (
    <>
      <PageHeader title={`Shikoyat #${c.id}`}>
        <ComplaintBadge status={c.status} />
        {c.level === 'director' ? <Badge tone="red">Direktor darajasi</Badge> : <Badge tone="blue">Masul darajasi</Badge>}
        <Link href="/admin/recycling/complaints" className="btn-ghost px-4 py-2 text-sm">← Shikoyatlar</Link>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <Notice show={str(sp.saved) === '1'}>Saqlandi</Notice>
      <Notice show={str(sp.sent) === '1'}>Javob saqlandi va mijozga Telegram orqali yuborildi.</Notice>
      <Notice show={str(sp.notsent) === '1'} tone="warn">Javob saqlandi, lekin mijozga Telegram orqali yuborilmadi (bot bloklangan yoki token sozlanmagan) — telefon orqali xabar bering: <a href={`tel:+${r.phone}`} className="underline">{displayPhone(r.phone)}</a>.</Notice>
      <Notice show={str(sp.escalated) === '1'} tone="warn">Shikoyat direktorga ko'tarildi — HQ adminlar va masulga xabar yuborildi.</Notice>
      <Notice show={!!error} tone="warn">{error}</Notice>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Shikoyat</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Shikoyatchi">{c.fromName} · <a href={`tel:+${c.fromPhone}`} className="text-brand-500">{displayPhone(c.fromPhone)}</a></Info>
              <Info label="Sana">{formatDate(c.createdAt, 'uz', true)}</Info>
              <Info label="Matn" wide><p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3">{c.message}</p></Info>
              {c.response && (
                <Info label={`Javob · ${c.respondedBy ?? ''}${c.resolvedAt ? ` · ${formatDate(c.resolvedAt, 'uz', true)}` : ''}`} wide>
                  <p className="whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-emerald-900">{c.response}</p>
                </Info>
              )}
            </div>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Ariza <Link href={`/admin/recycling/requests/${r.id}`} className="text-brand-500 hover:underline">#{r.id}</Link> <RequestStatusBadge status={r.status} /></h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Mijoz">{r.name} · <a href={`tel:+${r.phone}`} className="text-brand-500">{displayPhone(r.phone)}</a>{r.customerTgId ? <Badge tone="green">Telegram</Badge> : <span className="ml-1 text-xs text-slate-400">Telegram yo'q</span>}</Info>
              <Info label="Punkt">{r.point.cityUz} ({r.point.regionUz})</Info>
              <Info label="Masul">{r.supervisor ? <Link href={`/admin/recycling/supervisors/${r.supervisor.id}`} className="hover:underline">{r.supervisor.name}</Link> : '—'}</Info>
              <Info label="Haydovchi">{r.assignedDriver ? <Link href={`/admin/recycling/drivers/${r.assignedDriver.id}`} className="hover:underline">{r.assignedDriver.name}</Link> : '—'}</Info>
              <Info label="Material">{r.material ? materialLabels.uz[r.material] : '—'}{r.volume ? ` · ~${r.volume} kg` : ''}</Info>
              <Info label="Tortish natijasi">{col ? <>{col.actualWeight} kg{col.discountPercent ? ` · chegirma ${col.discountPercent}% → ${col.effectiveWeight} kg` : ''} · {formatPrice(col.pricePerKg, "so'm")}/kg · <b>{formatPrice(col.totalAmount, "so'm")}</b>{col.customerComment && <span className="block text-xs text-slate-500">Mijoz izohi: {col.customerComment}</span>}</> : '—'}</Info>
            </div>
          </section>
        </div>
        <div className="space-y-4">
          <form action={respondComplaintAction} className="card space-y-3 p-5">
            <input type="hidden" name="id" value={c.id} />
            <h2 className="font-semibold">Javob berish</h2>
            <Field label="Javob matni *" hint={r.customerTgId ? 'Mijozga mijoz boti orqali yuboriladi' : 'Mijoz Telegramda emas — telefon orqali ham xabar bering'}>
              <textarea name="response" rows={5} required minLength={2} defaultValue={c.response ?? ''} className="input" placeholder="Hurmatli mijoz, ..." />
            </Field>
            <button className="btn-primary w-full">{c.response ? 'Javobni yangilash' : 'Javob yuborish'} va hal qilish</button>
          </form>
          <section className="card space-y-2 p-5">
            <h2 className="font-semibold">Holat</h2>
            {c.status === 'open' && (
              <form action={setComplaintStatusAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="in_progress" /><button className="btn-ghost w-full px-4 py-2 text-sm">Ko'rilmoqda deb belgilash</button></form>
            )}
            {c.level !== 'director' && active && (
              <form action={escalateComplaintAction}><input type="hidden" name="id" value={c.id} /><ConfirmButton message="Shikoyat direktorga ko'tarilsinmi? HQ adminlarga xabar boradi." className="btn-accent w-full px-4 py-2 text-sm">⬆ Direktorga ko'tarish</ConfirmButton></form>
            )}
            {c.status !== 'closed' && (
              <form action={setComplaintStatusAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="closed" /><ConfirmButton message="Shikoyat yopilsinmi?" className="btn-ghost w-full px-4 py-2 text-sm">Yopish</ConfirmButton></form>
            )}
            {!active && (
              <form action={setComplaintStatusAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="open" /><button className="btn-ghost w-full px-4 py-2 text-sm">Qayta ochish</button></form>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
