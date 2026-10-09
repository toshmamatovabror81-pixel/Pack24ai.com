import { Clock, MapPin, Navigation, Phone, Scale, Truck, FileText } from 'lucide-react';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { displayPhone, formatPrice, toNumber } from '@/lib/format';
import { pickText } from '@/lib/i18n/config';
import { resolveLocale, type LangParams } from '@/lib/locale';
import { googleMapsUrl, isValidLat, isValidLng } from '@/lib/recycling/geo';
import { pageMetadata } from '@/lib/seo';
import { getSettings } from '@/lib/settings';
import { Markdown } from '@/components/site/Markdown';
import { LeafletMap } from '@/components/recycling/LeafletMap';
import { RecyclingForm, type FormPoint } from '@/components/recycling/RecyclingForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return pageMetadata({ locale, path: '/recycling', title: t.recycling.title, description: t.recycling.metaDescription });
}

const fill = (s: string, kg: number) => s.replace('{kg}', String(kg));

export default async function RecyclingPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const r = t.recycling;
  const [s, points, user] = await Promise.all([
    getSettings(),
    prisma.recyclePoint.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' } }),
    currentUser().catch(() => null),
  ]);
  const nameOf = (p: { cityUz: string; cityRu: string }) => (locale === 'ru' ? p.cityRu : p.cityUz);
  const formPoints: FormPoint[] = points.map((p) => ({ id: p.id, name: nameOf(p), address: p.address, lat: p.lat, lng: p.lng, pricePerKg: toNumber(p.pricePerKg), isAccepting: p.isAccepting }));
  const prices = (points.some((p) => p.isAccepting) ? points.filter((p) => p.isAccepting) : points).map((p) => toNumber(p.pricePerKg)).filter((v) => v > 0);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const num = (v: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v).replace(/\u00a0/g, ' ');
  const priceText = !prices.length ? '—' : minPrice === maxPrice ? num(minPrice) : `${num(minPrice)}–${num(maxPrice)}`;
  const intro = pickText(s.recyclingText, locale);
  const mapPoints = points.filter((p) => isValidLat(p.lat) && isValidLng(p.lng)).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, title: nameOf(p), subtitle: p.address ?? undefined, muted: !p.isAccepting }));
  const steps = [
    { icon: FileText, title: r.step1t, text: r.step1 },
    { icon: Truck, title: r.step2t, text: r.step2 },
    { icon: Scale, title: r.step3t, text: r.step3 },
  ];

  return (
    <div className="container-site max-w-5xl py-8 sm:py-10">
      <h1 className="h1">{r.title}</h1>
      <div className="mt-3 text-slate-600">{intro ? <Markdown source={intro} /> : <p>{r.intro}</p>}</div>

      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-brand-50 px-3 py-1.5 font-medium text-brand-700">{fill(r.minBase, s.recyclingMinKg)}</span>
        <span className="rounded-full bg-brand-50 px-3 py-1.5 font-medium text-brand-700">{fill(r.minPickup, s.recyclingPickupMinKg)}</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800">
          {r.price}: {priceText} {prices.length ? r.pricePerKg : ''}
        </span>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{r.stepsTitle}</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {steps.map((st, i) => (
            <li key={i} className="card flex gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">{i + 1}</span>
              <div>
                <p className="flex items-center gap-2 font-semibold"><st.icon className="h-4 w-4 text-brand-500" />{st.title}</p>
                <p className="mt-1 text-sm text-slate-600">{st.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card mt-8 p-4 sm:p-6" id="form">
        <h2 className="mb-4 text-lg font-semibold">{r.formTitle}</h2>
        <RecyclingForm
          locale={locale}
          l={r}
          common={{ name: t.common.name, phone: t.common.phone, required: t.common.required }}
          points={formPoints}
          pickupMinKg={s.recyclingPickupMinKg}
          telegramBot={s.telegramBot}
          defaults={{ name: user?.name ?? '', phone: user ? displayPhone(user.phone) : '' }}
        />
      </section>

      <section className="mt-10" id="points">
        <h2 className="text-lg font-semibold">{r.pointsTitle}</h2>
        {points.length === 0 ? (
          <p className="mt-3 text-slate-500">{r.noPoints}</p>
        ) : (
          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <ul className="space-y-3">
              {points.map((p) => (
                <li key={p.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{nameOf(p)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.isAccepting ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {p.isAccepting ? r.accepting : r.notAccepting}
                    </span>
                  </div>
                  <dl className="mt-2 space-y-1 text-sm text-slate-600">
                    {p.address && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><dd>{p.address}</dd></div>}
                    <div className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><dd>{r.workingHours}: {p.workingHours}</dd></div>
                    <div className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><dd><a href={`tel:+${p.phone.replace(/\D/g, '')}`} className="hover:underline">{displayPhone(p.phone)}</a></dd></div>
                    <div className="flex items-start gap-2"><Scale className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><dd className="font-medium text-slate-900">{r.price}: {formatPrice(p.pricePerKg, r.pricePerKg)}</dd></div>
                  </dl>
                  {isValidLat(p.lat) && isValidLng(p.lng) && (
                    <a href={googleMapsUrl(p.lat, p.lng)} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:underline">
                      <Navigation className="h-4 w-4" />
                      {r.directions}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {mapPoints.length > 0 && <LeafletMap points={mapPoints} fitPoints height={320} zoom={12} className="lg:self-start" />}
          </div>
        )}
      </section>
    </div>
  );
}
