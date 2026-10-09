import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, Check, Clock, MapPin, Navigation, Phone, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import { SiteImage as Image } from '@/components/site/SiteImage';
import { StatusBadge } from '@/components/recycling/StatusBadge';
import { prisma } from '@/lib/db';
import { displayPhone, formatDate, formatPrice } from '@/lib/format';
import { resolveLocale } from '@/lib/locale';
import { cancelFormAction, decisionFormAction } from '@/lib/recycling/customerActions';
import { googleMapsUrl, isValidLat, isValidLng } from '@/lib/recycling/geo';
import { materialLabels, pickupTypeLabels } from '@/lib/recycling/statuses';

/**
 * Mijozning kuzatuv sahifasi: URL'dagi token — maxfiy kalit. Sahifa indekslanmaydi,
 * boshqa arizalarga havola yo'q. Tortish natijasini tasdiqlash va bekor qilish shu yerdan.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ lang: string; token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Mijozga ko'rsatiladigan maydonlar bilan chegaralangan so'rov (requestByToken o'rniga):
 * haydovchi/masulning telefoni, paroli, Telegram ID'si va boshqa maxfiy ustunlar umuman yuklanmaydi.
 * Token regex poydevordagi requestByToken bilan bir xil.
 */
async function loadByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  return prisma.recycleRequest.findUnique({
    where: { accessToken: token },
    select: {
      id: true, status: true, pickupType: true, material: true, volume: true, address: true, pickupLat: true, pickupLng: true, photoUrl: true,
      createdAt: true, updatedAt: true, dispatchedAt: true, assignedAt: true, driverEnRouteAt: true, driverArrivedAt: true,
      collectedAt: true, confirmedAt: true, completedAt: true, cancelledAt: true,
      point: { select: { cityUz: true, cityRu: true, address: true, phone: true, workingHours: true, lat: true, lng: true } },
      assignedDriver: { select: { name: true, vehicleInfo: true } },
      collections: {
        orderBy: { id: 'desc' },
        select: { actualWeight: true, discountPercent: true, discountReason: true, effectiveWeight: true, pricePerKg: true, totalAmount: true, customerConfirmed: true, customerComment: true },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.recycling.tracking.title, robots: { index: false, follow: false } };
}

export default async function TrackingPage({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const { token } = await params;
  const sp = await searchParams;
  const notice = typeof sp.notice === 'string' ? sp.notice : '';
  const r = await loadByToken(token);
  if (!r) notFound();
  const tr = t.recycling.tracking;
  const sum = (v: Parameters<typeof formatPrice>[0]) => formatPrice(v, t.common.sum);
  const date = (d: Date | null | undefined) => (d ? formatDate(d, locale, true) : null);
  const point = r.point;
  const driver = r.assignedDriver;
  const collection = r.collections[0] ?? null;
  const pointName = point ? (locale === 'ru' ? point.cityRu : point.cityUz) : '';

  // Jarayon qadamlari: olib ketishda haydovchi bosqichlari bor, bazaga olib kelishda yo'q
  const allSteps: { key: string; label: string; at: Date | null }[] = [
    { key: 'created', label: tr.created, at: r.createdAt },
    { key: 'dispatched', label: tr.dispatched, at: r.dispatchedAt },
    ...(r.pickupType === 'pickup'
      ? [
          { key: 'assigned', label: tr.assigned, at: r.assignedAt },
          { key: 'en_route', label: tr.enRoute, at: r.driverEnRouteAt },
          { key: 'arrived', label: tr.arrived, at: r.driverArrivedAt },
        ]
      : []),
    { key: 'collected', label: tr.collected, at: r.collectedAt },
    ...(r.pickupType === 'pickup' ? [{ key: 'confirmed', label: tr.confirmed, at: r.confirmedAt }] : []),
    { key: 'completed', label: tr.completed, at: r.completedAt },
  ];
  const isCancelled = r.status === 'cancelled';
  const steps = isCancelled ? [...allSteps.filter((s) => s.at), { key: 'cancelled', label: tr.cancelled, at: r.cancelledAt ?? r.updatedAt }] : allSteps;
  const canCancel = ['new_', 'dispatched', 'assigned'].includes(r.status);
  const driverMoving = ['en_route', 'arrived', 'collecting'].includes(r.status);
  const noticeText =
    notice === 'cancelled' ? tr.noticeCancelled : notice === 'confirmed' ? tr.noticeConfirmed : notice === 'disputed' ? tr.noticeDisputed : notice === 'error' ? tr.noticeError : '';

  return (
    <div className="container-site max-w-3xl py-8 sm:py-10">
      {noticeText && (
        <p className={`mb-4 rounded-lg p-3 text-sm ${notice === 'error' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`} role="status">
          {noticeText}
        </p>
      )}

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="h1">{tr.title} #{r.id}</h1>
            <p className="mt-1 text-sm text-slate-500">{date(r.createdAt)}</p>
          </div>
          <StatusBadge status={r.status} locale={locale} />
        </div>

        {r.status === 'completed' && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">🎉 {tr.completedText}</p>}
        {isCancelled && (
          <p className="mt-4 rounded-lg bg-slate-100 p-3 text-slate-700">
            {tr.cancelledText}{' '}
            <Link href={`/${locale}/recycling`} className="font-medium text-brand-500 underline">{tr.newRequest}</Link>
          </p>
        )}
        {r.status === 'disputed' && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {tr.youDisputed}
          </p>
        )}

        {/* Jarayon */}
        <h2 className="mt-6 font-semibold">{tr.timeline}</h2>
        <ol className="mt-3 space-y-0">
          {steps.map((s, i) => {
            const done = !!s.at;
            const last = i === steps.length - 1;
            const cancelStep = s.key === 'cancelled';
            return (
              <li key={s.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${cancelStep ? 'bg-slate-400 text-white' : done ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 bg-white'}`}>
                    {done && (cancelStep ? '×' : <Check className="h-3.5 w-3.5" />)}
                  </span>
                  {!last && <span className={`w-0.5 flex-1 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} style={{ minHeight: 18 }} />}
                </div>
                <div className={`pb-4 ${done ? '' : 'text-slate-400'}`}>
                  <p className={`text-sm ${done ? 'font-medium text-slate-900' : ''}`}>{s.label}</p>
                  {s.at && <p className="text-xs text-slate-500">{date(s.at)}</p>}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Tortish natijasi va mijoz qarori */}
        {collection && (
          <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="font-semibold">{tr.weighing}</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{tr.actualWeight}</dt><dd className="font-medium">{collection.actualWeight} kg</dd></div>
              {collection.discountPercent > 0 && (
                <div className="flex justify-between gap-3"><dt className="text-slate-600">{tr.discount}</dt><dd>{collection.discountPercent}%{collection.discountReason ? ` (${collection.discountReason})` : ''}</dd></div>
              )}
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{tr.effectiveWeight}</dt><dd className="font-medium">{collection.effectiveWeight} kg</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{tr.pricePerKg}</dt><dd>{sum(collection.pricePerKg)}/kg</dd></div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base font-bold"><dt>{tr.total}</dt><dd>{sum(collection.totalAmount)}</dd></div>
            </dl>
            {r.status === 'collected' && (
              <form action={decisionFormAction.bind(null, token, locale)} className="mt-4 space-y-3">
                <p className="font-medium">{tr.awaitingDecision}</p>
                <textarea name="comment" rows={2} maxLength={500} placeholder={tr.disputeComment} className="input py-3 text-base" />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button name="decision" value="yes" className="btn-primary w-full sm:w-auto">✅ {tr.confirm}</button>
                  <button name="decision" value="no" className="btn-ghost w-full sm:w-auto">{tr.dispute}</button>
                </div>
              </form>
            )}
            {r.status !== 'collected' && collection.customerConfirmed === true && <p className="mt-3 text-sm text-emerald-700">✅ {tr.youConfirmed}</p>}
            {r.status !== 'collected' && collection.customerConfirmed === false && (
              <p className="mt-3 text-sm text-amber-800">⚠️ {tr.youDisputed}{collection.customerComment ? `: ${collection.customerComment}` : ''}</p>
            )}
          </section>
        )}

        {/* Tafsilotlar */}
        <h2 className="mt-6 font-semibold">{tr.details}</h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          {r.material && <div className="rounded-lg bg-slate-50 p-3"><dt className="text-slate-500">{t.recycling.material}</dt><dd className="font-medium">{materialLabels[locale][r.material]}</dd></div>}
          {r.volume != null && <div className="rounded-lg bg-slate-50 p-3"><dt className="text-slate-500">{t.recycling.volume}</dt><dd className="font-medium">~{r.volume} kg</dd></div>}
          <div className="rounded-lg bg-slate-50 p-3"><dt className="text-slate-500">{t.recycling.pickupType}</dt><dd className="font-medium">{pickupTypeLabels[locale][r.pickupType]}</dd></div>
          {r.pickupType === 'pickup' && (r.address || (r.pickupLat != null && r.pickupLng != null)) && (
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-slate-500">{t.recycling.address}</dt>
              <dd className="font-medium">{r.address ?? `${r.pickupLat?.toFixed(5)}, ${r.pickupLng?.toFixed(5)}`}</dd>
              {isValidLat(r.pickupLat) && isValidLng(r.pickupLng) && (
                <a href={googleMapsUrl(r.pickupLat, r.pickupLng)} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-500 hover:underline">
                  <MapPin className="h-3 w-3" />{tr.openMap}
                </a>
              )}
            </div>
          )}
        </dl>
        {r.photoUrl && (
          <div className="relative mt-3 h-40 w-40 overflow-hidden rounded-lg bg-slate-100">
            <Image src={r.photoUrl} alt="" fill sizes="160px" className="object-cover" />
          </div>
        )}

        {/* Punkt va haydovchi */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {point && (
            <section className="rounded-xl border border-slate-200 p-4">
              <h2 className="font-semibold">{tr.pointTitle}</h2>
              <p className="mt-1 font-medium">{pointName}</p>
              <dl className="mt-1 space-y-1 text-sm text-slate-600">
                {point.address && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><dd>{point.address}</dd></div>}
                <div className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><dd>{t.recycling.workingHours}: {point.workingHours}</dd></div>
                <div className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><dd><a href={`tel:+${point.phone.replace(/\D/g, '')}`} className="hover:underline">{displayPhone(point.phone)}</a></dd></div>
              </dl>
              {isValidLat(point.lat) && isValidLng(point.lng) && (
                <a href={googleMapsUrl(point.lat, point.lng)} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:underline">
                  <Navigation className="h-4 w-4" />{tr.openMap}
                </a>
              )}
            </section>
          )}
          {driver && r.pickupType === 'pickup' && !isCancelled && (
            <section className="rounded-xl border border-slate-200 p-4">
              <h2 className="font-semibold">{tr.driverTitle}</h2>
              <p className="mt-1 flex items-center gap-2 font-medium"><Truck className="h-4 w-4 text-brand-500" />{driver.name}</p>
              {driver.vehicleInfo && <p className="mt-1 text-sm text-slate-600">{tr.vehicle}: {driver.vehicleInfo}</p>}
            </section>
          )}
        </div>

        {/* Bekor qilish */}
        {canCancel && (
          <details className="mt-6 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">{tr.cancel}</summary>
            <form action={cancelFormAction.bind(null, token, locale)} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-slate-600">{tr.cancelAsk}</p>
              <button className="btn-accent w-full sm:w-auto">{tr.cancelYes}</button>
            </form>
          </details>
        )}
        {driverMoving && point && (
          <p className="mt-6 text-sm text-slate-500">
            {tr.cancelLate} <a href={`tel:+${point.phone.replace(/\D/g, '')}`} className="font-medium text-brand-500">{displayPhone(point.phone)}</a>
          </p>
        )}
      </div>
    </div>
  );
}
