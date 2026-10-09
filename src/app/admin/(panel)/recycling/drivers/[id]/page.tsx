import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatPrice, toNumber } from '@/lib/format';
import { str } from '@/lib/params';
import { googleMapsUrl, yandexMapsUrl } from '@/lib/recycling/geo';
import { driverTasks } from '@/lib/recycling/driverTasks';
import { driverBalance, driverCards, driverTransactions } from '@/lib/recycling/wallet';
import { Badge, Field, Notice, PageHeader } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { ConfirmButton } from '@/components/admin/recycling/ConfirmButton';
import { CopyButton } from '@/components/admin/recycling/CopyButton';
import { DriverCredentials } from '@/components/admin/recycling/DriverCredentials';
import { DriverStatusBadge, dt, OnlineBadge, RegistrationCode, RequestStatusBadge, TelegramBadge } from '@/components/admin/recycling/badges';
import { recyclingBadges } from '@/components/admin/recycling/helpers';
import { bonusAction, resetDriverTelegramAction, setDriverStatusAction, updateDriverAction } from '../../actions';

export const dynamic = 'force-dynamic';
const sum = (v: unknown) => formatPrice(v as number, "so'm");
const txLabels = { earning: 'Daromad', withdrawal: 'Yechib olish', bonus: 'Bonus' } as const;
const txStatus = { pending: 'Kutilmoqda', completed: 'Bajarildi', failed: 'Rad etildi' } as const;

export default async function DriverDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('recycling');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const d = await prisma.driver.findUnique({ where: { id }, include: { point: true, supervisor: true } });
  if (!d) notFound();
  const [points, supervisors, balance, transactions, cards, tasks, badges, completedCount] = await Promise.all([
    prisma.recyclePoint.findMany({ orderBy: { id: 'asc' } }),
    prisma.supervisor.findMany({ where: { isActive: true }, orderBy: { id: 'asc' }, include: { point: { select: { cityUz: true } } } }),
    driverBalance(id),
    driverTransactions(id, 20),
    driverCards(id),
    driverTasks(id),
    recyclingBadges(),
    prisma.recycleRequest.count({ where: { assignedDriverId: id, status: 'completed' } }),
  ]);
  const created = str(sp.created) === '1';
  const reset = str(sp.reset) === '1';
  const hasLoc = d.lastLat != null && d.lastLng != null;
  return (
    <>
      <PageHeader title={`Haydovchi: ${d.name}`}>
        <DriverStatusBadge status={d.status} />
        <Link href="/admin/recycling/drivers" className="btn-ghost px-4 py-2 text-sm">← Haydovchilar</Link>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <Notice show={str(sp.saved) === '1'}>Saqlandi{Number(str(sp.handed)) > 0 && ` — ${str(sp.handed)} ta faol topshiriq masulga/navbatga qaytarildi`}</Notice>
      <Notice show={!!str(sp.error)} tone="warn">{str(sp.error)}</Notice>
      {(created || reset || !d.telegramId) && d.registrationCode && (
        <div className="card mb-4 border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">{created ? 'Haydovchi yaratildi.' : reset ? 'Telegram uzildi, yangi kod berildi.' : 'Haydovchi hali botga ulanmagan.'} Haydovchiga shu kodni bering:</p>
          <p className="my-3 flex flex-wrap items-center gap-3"><RegistrationCode code={d.registrationCode} big /><CopyButton text={d.registrationCode} label="Kodni nusxalash" /></p>
          <p className="text-amber-900">Haydovchi boti → <b>/start</b> → kodni yuboradi → «Telefonni ulashish» (raqam <b>{displayPhone(d.phone)}</b> bilan mos bo'lishi shart). Kod bir martalik.</p>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <form action={updateDriverAction} className="card grid gap-4 p-5 sm:grid-cols-2">
            <input type="hidden" name="id" value={d.id} />
            <Field label="Ism *"><input name="name" required minLength={2} defaultValue={d.name} className="input" /></Field>
            <Field label="Telefon *"><input name="phone" type="tel" required defaultValue={displayPhone(d.phone)} className="input" /></Field>
            <Field label="Masul">
              <select name="supervisorId" defaultValue={d.supervisorId ?? ''} className="input">
                <option value="">Tanlanmagan</option>
                {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}{s.point ? ` — ${s.point.cityUz}` : ''}</option>)}
              </select>
            </Field>
            <Field label="Punkt">
              <select name="pointId" defaultValue={d.pointId ?? ''} className="input">
                <option value="">Biriktirilmagan</option>
                {points.map((p) => <option key={p.id} value={p.id}>{p.cityUz} ({p.regionUz})</option>)}
              </select>
            </Field>
            <Field label="Mashina" wide><input name="vehicleInfo" defaultValue={d.vehicleInfo ?? ''} placeholder="Damas 01A123BC" className="input" /></Field>
            <div className="sm:col-span-2"><button className="btn-primary">Saqlash</button></div>
          </form>

          <div className="card p-4">
            <p className="mb-2 text-sm font-semibold">Faol topshiriqlar ({tasks.length})</p>
            {!tasks.length ? <p className="text-sm text-slate-400">Hozir topshiriq yo'q</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {tasks.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Link href={`/admin/recycling/requests/${r.id}`} className="font-semibold text-brand-500">#{r.id}</Link>
                    <span>{r.name}</span>
                    <span className="text-xs text-slate-500">{r.volume ? `~${r.volume} kg · ` : ''}{r.address ?? r.point?.cityUz}</span>
                    <span className="ml-auto"><RequestStatusBadge status={r.status} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <div className="mb-3 grid gap-3 sm:grid-cols-4">
              <div><p className="text-xs uppercase text-slate-500">Balans</p><p className="text-xl font-bold">{sum(balance.balance)}</p></div>
              <div><p className="text-xs uppercase text-slate-500">Jami daromad</p><p className="font-semibold text-emerald-700">{sum(balance.earned)}</p></div>
              <div><p className="text-xs uppercase text-slate-500">Yechib olingan</p><p className="font-semibold">{sum(balance.withdrawn)}</p></div>
              <div><p className="text-xs uppercase text-slate-500">Kutilayotgan</p><p className="font-semibold text-amber-700">{sum(balance.pending)}</p></div>
            </div>
            <p className="mb-2 text-sm font-semibold">Oxirgi tranzaksiyalar</p>
            {!transactions.length ? <p className="text-sm text-slate-400">Tranzaksiya yo'q</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap py-2 pr-3 text-xs text-slate-500">{dt(t.createdAt)}</td>
                      <td className="py-2 pr-3"><Badge tone={t.type === 'withdrawal' ? 'amber' : t.type === 'bonus' ? 'blue' : 'green'}>{txLabels[t.type]}</Badge></td>
                      <td className="py-2 pr-3 text-slate-600">{t.description ?? '—'}{t.card && <span className="text-xs text-slate-400"> · {t.card.cardNumber}</span>}</td>
                      <td className={`whitespace-nowrap py-2 pr-3 text-right font-medium ${t.type === 'withdrawal' ? 'text-red-700' : 'text-emerald-700'}`}>{t.type === 'withdrawal' ? '−' : '+'}{sum(toNumber(t.amount))}</td>
                      <td className="py-2 text-xs text-slate-500">{txStatus[t.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>

          <div className="card p-4 text-sm">
            <p className="mb-2 font-semibold">Kartalar ({cards.length})</p>
            {!cards.length ? <p className="text-slate-400">Karta qo'shilmagan (haydovchi botida qo'shadi)</p> : (
              <ul className="space-y-1">
                {cards.map((c) => <li key={c.id} className="flex flex-wrap items-center gap-2"><span className="font-mono">{c.cardNumber}</span><span className="text-slate-500">{c.cardHolder} · {String(c.expiryMonth).padStart(2, '0')}/{String(c.expiryYear).slice(-2)}</span><Badge tone="slate">{c.cardType}</Badge>{c.isDefault && <Badge tone="green">Asosiy</Badge>}</li>)}
              </ul>
            )}
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="card p-4 text-sm">
            <p className="mb-2 font-semibold">Holat</p>
            <p className="flex flex-wrap items-center gap-2"><DriverStatusBadge status={d.status} /><OnlineBadge driver={d} /></p>
            <p className="mt-2 text-xs text-slate-500">Yakunlangan arizalar: <b>{completedCount}</b></p>
            {hasLoc ? (
              <p className="mt-2 text-xs">Oxirgi joylashuv: <span className="font-mono text-slate-500">{d.lastLat!.toFixed(5)}, {d.lastLng!.toFixed(5)}</span><br />
                <a href={googleMapsUrl(d.lastLat!, d.lastLng!)} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">Google ↗</a> · <a href={yandexMapsUrl(d.lastLat!, d.lastLng!)} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">Yandex ↗</a> · <Link href="/admin/recycling/map" className="text-brand-500 hover:underline">Admin xaritasi</Link></p>
            ) : <p className="mt-2 text-xs text-slate-400">Joylashuv hali yuborilmagan</p>}
            <form action={setDriverStatusAction} className="mt-3">
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="status" value={d.status === 'inactive' ? 'active' : 'inactive'} />
              {d.status === 'inactive' ? (
                <ConfirmButton message="Haydovchi qayta faollashtirilsinmi?" className="btn-ghost w-full py-2 text-sm">Faollashtirish</ConfirmButton>
              ) : (
                <ConfirmButton message={`${d.name} bloklansinmi? Botga kira olmaydi, topshiriq olmaydi.${tasks.length ? ` ${tasks.length} ta faol topshirig'i masulga/navbatga qaytariladi (mijoz oldidagi bo'lsa — bloklanmaydi).` : ''}`} className="btn-ghost w-full py-2 text-sm text-red-700">Bloklash (nofaol qilish)</ConfirmButton>
              )}
            </form>
          </div>

          <div className="card p-4 text-sm">
            <p className="mb-2 font-semibold">Haydovchi kabineti (/driver)</p>
            {d.passwordHash ? (
              <p className="text-xs text-slate-500">Parol berilgan{d.passwordSetByBotAt && ` (${dt(d.passwordSetByBotAt)})`}. Login: {displayPhone(d.phone)}. Yangi parol — faqat haydovchi boti orqali.</p>
            ) : (
              <DriverCredentials driverId={d.id} phone={displayPhone(d.phone)} />
            )}
          </div>

          <div className="card p-4 text-sm">
            <p className="mb-2 font-semibold">Telegram</p>
            <p className="mb-1"><TelegramBadge telegramId={d.telegramId} telegramName={d.telegramName} /></p>
            {d.telegramId && <p className="text-xs text-slate-500">ID: {d.telegramId} · ulangan: {dt(d.registeredAt)}</p>}
            {!d.telegramId && <p className="text-xs text-slate-500">Kod: <RegistrationCode code={d.registrationCode} /></p>}
            <form action={resetDriverTelegramAction} className="mt-3">
              <input type="hidden" name="id" value={d.id} />
              <ConfirmButton message={d.telegramId ? 'Telegram uzilsinmi? Haydovchi botdan chiqariladi va yangi kod beriladi.' : 'Yangi kod berilsinmi? Eski kod ishlamaydi.'} className="btn-ghost w-full py-2 text-sm">{d.telegramId ? 'Telegramni uzish / yangi kod' : 'Yangi kod berish'}</ConfirmButton>
            </form>
          </div>

          <form action={bonusAction} className="card space-y-2 p-4 text-sm">
            <input type="hidden" name="id" value={d.id} />
            <p className="font-semibold">🎁 Bonus berish</p>
            <Field label="Summa, so'm *"><input name="amount" type="number" min={1} step={1} required className="input" /></Field>
            <Field label="Sabab"><input name="description" placeholder="Oyning eng yaxshi haydovchisi" className="input" /></Field>
            <p className="text-xs text-slate-500">Balansga qo'shiladi, haydovchi botda xabar oladi.</p>
            <button className="btn-primary w-full py-2 text-sm">Bonus berish</button>
          </form>

          <div className="card p-4 text-xs text-slate-500">
            <p>Yaratilgan: {dt(d.createdAt)}</p>
            {d.invitedAt && <p>Taklif qilingan: {dt(d.invitedAt)}</p>}
            <p>ID: {d.id}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
