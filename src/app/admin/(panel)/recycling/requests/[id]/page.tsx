import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatPrice, toNumber } from '@/lib/format';
import { str } from '@/lib/params';
import { googleMapsUrl, yandexMapsUrl } from '@/lib/recycling/geo';
import { trackingUrl } from '@/lib/recycling/notifications';
import { canTransition, MATERIALS, materialLabels, pickupTypeLabels, TERMINAL_STATUSES } from '@/lib/recycling/statuses';
import { Badge, Field, Notice, PageHeader, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { ComplaintBadge, dt, Info, isDriverOnline, PaymentBadge, RequestStatusBadge, severityLabels, severityTone } from '@/components/admin/recycling/badges';
import { recyclingBadges } from '@/components/admin/recycling/helpers';
import { CopyButton } from '@/components/admin/recycling/CopyButton';
import { WeighingCalc } from '@/components/admin/recycling/WeighingCalc';
import { ConfirmButton } from '@/components/admin/recycling/ConfirmButton';
import { acceptBaseAction, assignAction, cancelAction, dispatchAction, fixCollectionAction, paymentAction, weighAction } from '../../actions';

export const dynamic = 'force-dynamic';
const sum = (v: unknown) => formatPrice(v as number, "so'm");

export default async function RequestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('recycling');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const r = await prisma.recycleRequest.findUnique({
    where: { id },
    include: {
      point: true, supervisor: true, assignedDriver: true, user: { select: { id: true, name: true } },
      collections: { orderBy: { id: 'desc' }, include: { driver: true } },
      complaints: { orderBy: { id: 'desc' } },
    },
  });
  if (!r) notFound();
  const c = r.collections[0] ?? null;
  const [supervisors, drivers, events, badges, earningTx] = await Promise.all([
    prisma.supervisor.findMany({ where: { isActive: true }, include: { point: { select: { cityUz: true } } }, orderBy: [{ pointId: 'asc' }, { name: 'asc' }] }),
    prisma.driver.findMany({ where: { status: { not: 'inactive' } }, include: { point: { select: { cityUz: true } } }, orderBy: [{ name: 'asc' }] }),
    prisma.botEvent.findMany({ where: { requestId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    recyclingBadges(),
    c ? prisma.driverTransaction.findFirst({ where: { collectionId: c.id, type: 'earning' }, select: { amount: true } }) : null,
  ]);

  const price = toNumber(r.point.pricePerKg);
  const driverRate = toNumber(r.point.driverRatePerKg);
  // Haydovchi daromadi — bazadagi earning yozuvi (punkt stavkasi keyin o'zgargan bo'lsa ham to'g'ri); yo'q bo'lsa stavka bo'yicha
  const driverEarning = c ? (earningTx ? Math.round(toNumber(earningTx.amount)) : Math.round(c.actualWeight * driverRate)) : 0;
  const terminal = TERMINAL_STATUSES.includes(r.status);
  const canDispatch = canTransition(r.status, 'dispatched');
  const canAssign = ['new_', 'dispatched', 'assigned'].includes(r.status);
  const canWeigh = !!r.assignedDriverId && ['arrived', 'collecting', 'collected', 'disputed'].includes(r.status);
  const canPay = !!c && ['collected', 'confirmed', 'disputed', 'completed'].includes(r.status) && !(r.status === 'completed' && c.paymentStatus !== 'pending');
  const hasCoords = r.pickupLat != null && r.pickupLng != null;
  const tracking = trackingUrl(r.accessToken, r.customerLang);
  const pointDrivers = drivers.filter((d) => d.pointId === r.pointId);
  const otherDrivers = drivers.filter((d) => d.pointId !== r.pointId);
  const driverOption = (d: (typeof drivers)[number]) => `${isDriverOnline(d) ? '🟢 ' : ''}${d.name}${d.vehicleInfo ? ` · ${d.vehicleInfo}` : ''}${d.status !== 'active' ? ` (${d.status === 'busy' ? 'band' : "yo'lda"})` : ''}`;
  const supervisorOption = (s: (typeof supervisors)[number]) => `${s.name}${s.point ? ` — ${s.point.cityUz}` : ''}${!s.telegramId ? ' (bot ulanmagan)' : ''}`;
  const times: [string, Date | null][] = [
    ['Yaratildi', r.createdAt], ["Masulga yo'naltirildi", r.dispatchedAt], ['Haydovchi tayinlandi', r.assignedAt], ["Haydovchi yo'lga chiqdi", r.driverEnRouteAt],
    ['Haydovchi yetib keldi', r.driverArrivedAt], ['Tortildi', r.collectedAt], ['Mijoz tasdiqladi', r.confirmedAt], ['Yakunlandi', r.completedAt], ['Bekor qilindi', r.cancelledAt],
  ];

  return (
    <>
      <PageHeader title={`Ariza #${r.id}`}>
        <RequestStatusBadge status={r.status} />
        <Link href="/admin/recycling" className="btn-ghost px-4 py-2 text-sm">← Arizalar</Link>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <Notice show={str(sp.saved) === '1'}>Saqlandi</Notice>
      <Notice show={!!str(sp.error)} tone="warn">{str(sp.error)}</Notice>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <div className="card grid gap-4 p-4 sm:grid-cols-2">
            <Info label="Mijoz">
              <p className="font-medium">{r.name}</p>
              <a href={`tel:+${r.phone}`} className="text-brand-500">{displayPhone(r.phone)}</a>
              {r.user && <p className="text-xs"><Link href={`/admin/customers/${r.user.id}`} className="text-brand-500">Kabinet: {r.user.name}</Link></p>}
              {r.customerTgId && <p className="text-xs text-slate-500">Telegram ID: {r.customerTgId} · til: {r.customerLang}</p>}
            </Info>
            <Info label="Punkt">
              <Link href={`/admin/recycling/points/${r.point.id}`} className="font-medium text-brand-500">{r.point.cityUz}</Link> <span className="text-slate-500">({r.point.regionUz})</span>
              <p className="text-xs text-slate-500">Narx: {sum(price)}/kg · haydovchi: {sum(driverRate)}/kg</p>
            </Info>
            <Info label="Material / hajm">{r.material ? materialLabels.uz[r.material] : "Noma'lum"}{r.volume != null && ` · ~${r.volume} kg`}{r.volumeSize && <span className="text-xs text-slate-500"> ({r.volumeSize})</span>}</Info>
            <Info label="Turi">{pickupTypeLabels.uz[r.pickupType]}{r.pickupLocationMode && <span className="text-xs text-slate-500"> · {r.pickupLocationMode}</span>}</Info>
            <Info label="Manzil" wide>
              <p className="whitespace-pre-line">{r.address ?? '—'}</p>
              {hasCoords && (
                <p className="mt-1 flex flex-wrap gap-3 text-xs">
                  <span className="font-mono text-slate-500">{r.pickupLat!.toFixed(6)}, {r.pickupLng!.toFixed(6)}</span>
                  <a href={googleMapsUrl(r.pickupLat!, r.pickupLng!)} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">Google xarita ↗</a>
                  <a href={yandexMapsUrl(r.pickupLat!, r.pickupLng!)} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">Yandex xarita ↗</a>
                  <Link href={`/admin/recycling/map?point=${r.pointId}`} className="text-brand-500 hover:underline">Admin xaritasi</Link>
                </p>
              )}
            </Info>
            <Info label="Masul">
              {r.supervisor ? (
                <><Link href={`/admin/recycling/supervisors/${r.supervisor.id}`} className="font-medium text-brand-500">{r.supervisor.name}</Link><p className="text-xs text-slate-500">{displayPhone(r.supervisor.phone)}{!r.supervisor.telegramId && ' · bot ulanmagan'}</p></>
              ) : <span className="text-amber-700">Yo'naltirilmagan</span>}
            </Info>
            <Info label="Haydovchi">
              {r.assignedDriver ? (
                <><Link href={`/admin/recycling/drivers/${r.assignedDriver.id}`} className="font-medium text-brand-500">{r.assignedDriver.name}</Link><p className="text-xs text-slate-500">{displayPhone(r.assignedDriver.phone)}{r.assignedDriver.vehicleInfo && ` · ${r.assignedDriver.vehicleInfo}`}{isDriverOnline(r.assignedDriver) ? ' · 🟢 onlayn' : ''}</p></>
              ) : <span className="text-slate-400">Tayinlanmagan</span>}
            </Info>
            {r.completedNote && <Info label="Yakuniy izoh" wide><p className="whitespace-pre-line">{r.completedNote}</p></Info>}
            {tracking && (
              <Info label="Mijoz kuzatuv havolasi" wide>
                <p className="flex flex-wrap items-center gap-2"><code className="break-all rounded bg-slate-50 px-2 py-1 text-xs">{tracking}</code><CopyButton text={tracking} /><a href={tracking} target="_blank" rel="noreferrer" className="text-xs text-brand-500">Ochish ↗</a></p>
              </Info>
            )}
          </div>

          {r.photoUrl && (
            <div className="card p-4">
              <p className="mb-2 text-xs uppercase text-slate-500">Rasm</p>
              <a href={r.photoUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.photoUrl} alt="Makulatura rasmi" className="max-h-80 rounded-lg border border-slate-200 object-contain" />
              </a>
            </div>
          )}

          <div className="card overflow-x-auto">
            <p className="px-4 pt-3 text-xs uppercase text-slate-500">Vaqtlar</p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {times.map(([label, d]) => (
                  <tr key={label} className={d ? '' : 'text-slate-400'}><td className="px-4 py-2">{label}</td><td className="whitespace-nowrap px-4 py-2 text-right">{dt(d)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-4">
            <p className="mb-2 flex items-center justify-between text-xs uppercase text-slate-500"><span>Tortish natijasi (hisob)</span>{c && <PaymentBadge status={c.paymentStatus} />}</p>
            {!c ? <p className="text-sm text-slate-400">Hali tortilmagan</p> : (
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <Info label="Haqiqiy og'irlik"><b>{c.actualWeight} kg</b></Info>
                <Info label="Chegirma">{c.discountPercent}%{c.discountReason && <span className="text-slate-500"> — {c.discountReason}</span>}</Info>
                <Info label="Hisobli og'irlik">{c.effectiveWeight} kg</Info>
                <Info label="Narx">{sum(c.pricePerKg)}/kg</Info>
                <Info label="Jami (mijozga)"><b className="text-lg">{sum(c.totalAmount)}</b></Info>
                <Info label="Material">{c.materialType ? materialLabels.uz[c.materialType] : '—'}</Info>
                <Info label="Haydovchi"><Link href={`/admin/recycling/drivers/${c.driver.id}`} className="text-brand-500">{c.driver.name}</Link><p className="text-xs text-slate-500">daromad: {sum(driverEarning)}</p></Info>
                <Info label="Mijoz tasdig'i">{c.customerConfirmed == null ? <Badge tone="amber">Kutilmoqda</Badge> : c.customerConfirmed ? <Badge tone="green">Tasdiqladi</Badge> : <Badge tone="red">Rozi emas</Badge>}{c.customerComment && <p className="text-xs text-slate-500">{c.customerComment}</p>}</Info>
                <Info label="Tortilgan vaqt">{dt(c.collectedAt)}</Info>
                <Info label="To'lov" wide>
                  {c.paidAt ? (
                    <p>Mijozga <b>{sum(c.paymentToCustomer ?? 0)}</b> · haydovchiga <b>{sum(c.paymentToDriver ?? 0)}</b> · {dt(c.paidAt)}{c.paidBy && ` · ${c.paidBy}`}{c.paymentNote && <span className="text-slate-500"> — {c.paymentNote}</span>}</p>
                  ) : <span className="text-slate-400">Belgilanmagan</span>}
                </Info>
                {c.notes && <Info label="Izoh" wide>{c.notes}</Info>}
              </div>
            )}
          </div>

          <div className="card p-4">
            <p className="mb-2 text-xs uppercase text-slate-500">Shikoyatlar ({r.complaints.length})</p>
            {!r.complaints.length ? <p className="text-sm text-slate-400">Shikoyat yo'q</p> : (
              <div className="space-y-2">
                {r.complaints.map((k) => (
                  <div key={k.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2"><ComplaintBadge status={k.status} /><Badge tone={k.level === 'director' ? 'red' : 'slate'}>{k.level === 'director' ? 'Direktor' : 'Masul'}</Badge><span className="font-medium">{k.fromName}</span><span className="text-xs text-slate-500">{displayPhone(k.fromPhone)} · {dt(k.createdAt)}</span></p>
                    <p className="mt-1 whitespace-pre-line">{k.message}</p>
                    {k.response && <p className="mt-1 rounded bg-slate-50 p-2 text-xs">Javob{k.respondedBy && ` (${k.respondedBy})`}: {k.response}</p>}
                  </div>
                ))}
                <Link href="/admin/recycling/complaints" className="text-xs text-brand-500 hover:underline">Shikoyatlar bo'limi →</Link>
              </div>
            )}
          </div>

          <Table head={['Vaqt', 'Manba', 'Hodisa', 'Daraja']} empty={!events.length}>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{dt(e.createdAt)}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{e.sourceBot}</td>
                <td className="px-4 py-2"><p className="font-medium">{e.title}</p>{e.message && <p className="text-xs text-slate-500">{e.message}</p>}</td>
                <td className="px-4 py-2"><Badge tone={severityTone[e.severity]}>{severityLabels[e.severity]}</Badge></td>
              </tr>
            ))}
          </Table>
        </div>

        <aside className="min-w-0 space-y-3">
          {terminal && <p className="card p-4 text-sm text-slate-500">Ariza yakunlangan — holat o'zgarmaydi.{c && c.paymentStatus === 'pending' && " To'lovni belgilash mumkin."}{c && c.paymentStatus !== 'pending' && " To'lov belgilangan — hisob o'zgartirilmaydi."}</p>}

          {canDispatch && (
            <details className="card" open={r.status === 'new_'}>
              <summary className="cursor-pointer px-4 py-3 font-semibold">📤 Masulga yo'naltirish</summary>
              <form action={dispatchAction} className="space-y-2 border-t border-slate-100 p-4">
                <input type="hidden" name="id" value={r.id} />
                <Field label="Masul *">
                  <select name="supervisorId" required defaultValue={r.supervisorId ?? supervisors.find((s) => s.pointId === r.pointId)?.id ?? ''} className="input">
                    <option value="">Tanlang</option>
                    {supervisors.map((s) => <option key={s.id} value={s.id}>{supervisorOption(s)}</option>)}
                  </select>
                </Field>
                <Field label="Izoh (masulga yuboriladi)"><input name="note" className="input" /></Field>
                <button className="btn-primary w-full py-2 text-sm">Yo'naltirish</button>
              </form>
            </details>
          )}

          {canAssign && (
            <details className="card" open={r.status === 'dispatched'}>
              <summary className="cursor-pointer px-4 py-3 font-semibold">🚛 Haydovchi tayinlash</summary>
              <form action={assignAction} className="space-y-2 border-t border-slate-100 p-4">
                <input type="hidden" name="id" value={r.id} />
                <Field label="Haydovchi *" hint="🟢 — hozir onlayn">
                  <select name="driverId" required defaultValue={r.assignedDriverId ?? ''} className="input">
                    <option value="">Tanlang</option>
                    {pointDrivers.length > 0 && <optgroup label={`${r.point.cityUz} punkti`}>{pointDrivers.map((d) => <option key={d.id} value={d.id}>{driverOption(d)}</option>)}</optgroup>}
                    {otherDrivers.length > 0 && <optgroup label="Boshqa punktlar">{otherDrivers.map((d) => <option key={d.id} value={d.id}>{driverOption(d)}{d.point ? ` — ${d.point.cityUz}` : ''}</option>)}</optgroup>}
                  </select>
                </Field>
                {!drivers.length && <p className="text-xs text-amber-700">Faol haydovchi yo'q — <Link href="/admin/recycling/drivers/new" className="underline">qo'shing</Link>.</p>}
                <button className="btn-primary w-full py-2 text-sm">Tayinlash</button>
              </form>
            </details>
          )}

          {canWeigh && (
            <details className="card" open={['arrived', 'collecting', 'disputed'].includes(r.status)}>
              <summary className="cursor-pointer px-4 py-3 font-semibold">⚖️ Tortishni kiritish</summary>
              <form action={weighAction} className="space-y-2 border-t border-slate-100 p-4">
                <input type="hidden" name="id" value={r.id} />
                <WeighingCalc pricePerKg={price} driverRatePerKg={driverRate} defaultWeight={c?.actualWeight ?? r.volume} defaultDiscount={c?.discountPercent ?? 0} />
                <Field label="Chegirma sababi"><input name="discountReason" defaultValue={c?.discountReason ?? ''} placeholder="namlik, iflos, aralash…" className="input" /></Field>
                <Field label="Material">
                  <select name="material" defaultValue={c?.materialType ?? r.material ?? ''} className="input">
                    <option value="">Arizadagi kabi</option>
                    {MATERIALS.map((m) => <option key={m} value={m}>{materialLabels.uz[m]}</option>)}
                  </select>
                </Field>
                <Field label="Izoh"><input name="notes" defaultValue={c?.notes ?? ''} className="input" /></Field>
                {c && <p className="text-xs text-amber-700">Mavjud hisob qayta yoziladi, mijoz tasdig'i bekor bo'ladi.</p>}
                <button className="btn-primary w-full py-2 text-sm">{c ? 'Qayta tortish' : 'Tortishni saqlash'}</button>
              </form>
            </details>
          )}

          {canPay && c && (
            <details className="card" open={['collected', 'confirmed'].includes(r.status)}>
              <summary className="cursor-pointer px-4 py-3 font-semibold">💵 To'lovni belgilash</summary>
              <form action={paymentAction} className="space-y-2 border-t border-slate-100 p-4">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="collectionId" value={c.id} />
                <Field label="Mijozga, so'm" hint={`Hisob: ${sum(c.totalAmount)}`}><input name="paymentToCustomer" type="number" min={0} step={1} defaultValue={Math.round(toNumber(c.totalAmount))} className="input" /></Field>
                <Field label="Haydovchiga, so'm" hint={`Daromad: ${sum(driverEarning)}`}><input name="paymentToDriver" type="number" min={0} step={1} defaultValue={driverEarning} className="input" /></Field>
                <Field label="Izoh"><input name="note" className="input" /></Field>
                <p className="text-xs text-slate-500">Saqlangach ariza «Yakunlandi» holatiga o'tadi, haydovchi bo'shaydi.</p>
                <button className="btn-primary w-full py-2 text-sm">To'landi deb belgilash</button>
              </form>
            </details>
          )}

          {!terminal && !c && (
            <details className="card" open={r.pickupType === 'base'}>
              <summary className="cursor-pointer px-4 py-3 font-semibold">🏭 Bazada qabul qilish</summary>
              <form action={acceptBaseAction} className="space-y-2 border-t border-slate-100 p-4">
                <input type="hidden" name="id" value={r.id} />
                <p className="text-xs text-slate-500">Mijoz makulaturani o'zi olib keldi: jurnalga qabul yozuvi tushadi, ariza yakunlanadi.{r.pickupType === 'pickup' && ' (Ariza «olib ketish» turida — admin qaroriga ko\'ra.)'}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Og'irlik, kg *"><input name="weightKg" type="number" min={0.1} step={0.1} required defaultValue={r.volume ?? ''} className="input" /></Field>
                  <Field label="Narx, so'm/kg"><input name="pricePerKg" type="number" min={0} step={1} defaultValue={price} className="input" /></Field>
                </div>
                <Field label="Izoh"><input name="note" className="input" /></Field>
                <ConfirmButton message="Bazada qabul qilinsinmi? Ariza yakunlanadi." className="btn-ghost w-full py-2 text-sm">Qabul qilish va yakunlash</ConfirmButton>
              </form>
            </details>
          )}

          {c && c.paymentStatus === 'pending' && (
            <details className="card">
              <summary className="cursor-pointer px-4 py-3 font-semibold">🛠 Hisobni to'g'rilash</summary>
              <form action={fixCollectionAction} className="space-y-2 border-t border-slate-100 p-4">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="collectionId" value={c.id} />
                <p className="text-xs text-slate-500">Narx ({sum(c.pricePerKg)}/kg) saqlanadi; og'irlik va chegirma qayta hisoblanadi, haydovchi daromadi yangilanadi.</p>
                <WeighingCalc pricePerKg={toNumber(c.pricePerKg)} driverRatePerKg={driverRate} defaultWeight={c.actualWeight} defaultDiscount={c.discountPercent} />
                <Field label="Chegirma sababi"><input name="discountReason" defaultValue={c.discountReason ?? ''} className="input" /></Field>
                <Field label="Izoh"><input name="notes" defaultValue={c.notes ?? ''} className="input" /></Field>
                <ConfirmButton message="Hisob to'g'rilansinmi?" className="btn-ghost w-full py-2 text-sm">To'g'rilash</ConfirmButton>
              </form>
            </details>
          )}

          {!terminal && (
            <details className="card">
              <summary className="cursor-pointer px-4 py-3 font-semibold text-red-700">❌ Bekor qilish</summary>
              <form action={cancelAction} className="space-y-2 border-t border-slate-100 p-4">
                <input type="hidden" name="id" value={r.id} />
                <Field label="Sabab"><input name="reason" placeholder="Mijoz rad etdi, telefon javob bermadi…" className="input" /></Field>
                <ConfirmButton message={`Ariza #${r.id} bekor qilinsinmi?`} className="btn-accent w-full py-2 text-sm">Bekor qilish</ConfirmButton>
              </form>
            </details>
          )}
        </aside>
      </div>
    </>
  );
}
