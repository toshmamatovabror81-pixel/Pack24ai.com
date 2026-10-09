'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Crosshair, ExternalLink, MapPin, Navigation, PenLine, Send } from 'lucide-react';
import type { MaterialType, PickupType } from '@prisma/client';
import type { Locale } from '@/lib/i18n/config';
import type { Dict } from '@/lib/i18n/dict/uz';
import { formatKm, isValidLat, isValidLng, nearestPoint } from '@/lib/recycling/geo';
import { MATERIALS, materialLabels } from '@/lib/recycling/statuses';
import { submitRecyclingRequest, type RecyclingErrorCode, type RecyclingState } from '@/lib/recycling/customerActions';
import { LeafletMap } from './LeafletMap';
import { formatPhoneInput } from './phone';
import { track } from '../site/track';

/**
 * Mijoz arizasi formasi: ism, telefon, material, kg, topshirish turi va (olib ketish uchun) joylashuv — 3 usul:
 * GPS (navigator.geolocation + teskari geokodlash), xaritada belgilash (Leaflet) yoki manzil yozish.
 * Maydonlar boshqariladigan (controlled): server action'dan xato qaytsa kiritilgan qiymatlar yo'qolmaydi.
 */

export type FormPoint = { id: number; name: string; address: string | null; lat: number | null; lng: number | null; pricePerKg: number; isAccepting: boolean };

type Labels = Omit<Dict['recycling'], 'tracking'>;
type LocMode = 'gps' | 'map' | 'text';

const fill = (s: string, kg: number) => s.replace('{kg}', String(kg));

export function RecyclingForm({
  locale,
  l,
  common,
  points,
  pickupMinKg,
  telegramBot,
  defaults,
}: {
  locale: Locale;
  l: Labels;
  common: { name: string; phone: string; required: string };
  points: FormPoint[];
  pickupMinKg: number;
  telegramBot: string;
  defaults: { name: string; phone: string };
}) {
  const [state, formAction, pending] = useActionState<RecyclingState, FormData>(submitRecyclingRequest, null);
  const [name, setName] = useState(defaults.name);
  const [phone, setPhone] = useState(defaults.phone ? formatPhoneInput(defaults.phone) : '');
  const [material, setMaterial] = useState<MaterialType>('karton');
  const [volume, setVolume] = useState('');
  const [pickupType, setPickupType] = useState<PickupType>('base');
  const [mode, setMode] = useState<LocMode>('gps');
  const [coords, setCoords] = useState<{ lat: number; lng: number; via: 'gps' | 'map' } | null>(null);
  const [address, setAddress] = useState('');
  const [addressAuto, setAddressAuto] = useState(false);
  const [pointId, setPointId] = useState<number | null>(null);
  const [gps, setGps] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [localError, setLocalError] = useState<RecyclingErrorCode | null>(null);

  // Tanlash mumkin bo'lgan punktlar: qabul qilayotganlar (hech biri bo'lmasa — hammasi). Eng yaqini ham faqat shular orasidan
  const selectable = useMemo(() => {
    const accepting = points.filter((p) => p.isAccepting);
    return accepting.length ? accepting : points;
  }, [points]);
  const near = useMemo(() => (coords ? nearestPoint(selectable, coords.lat, coords.lng) : null), [coords, selectable]);
  // Xaritadagi punktlar (qabul qilmayotganlari ham, lekin xira) — har renderda yangi massiv bo'lmasin
  const mapPoints = useMemo(
    () => points.filter((p) => isValidLat(p.lat) && isValidLng(p.lng)).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, title: p.name, subtitle: p.address ?? undefined, muted: !p.isAccepting })),
    [points],
  );
  // Foydalanuvchi qo'lda tanlagan punkt ustun; bo'lmasa koordinata bo'yicha eng yaqini; bo'lmasa birinchi
  const effectivePointId = pointId ?? near?.point.id ?? selectable[0]?.id ?? null;
  const volumeNum = Number(volume.replace(',', '.'));
  const tooSmall = pickupType === 'pickup' && volume !== '' && Number.isFinite(volumeNum) && volumeNum > 0 && volumeNum < pickupMinKg;

  useEffect(() => {
    if (state?.ok && state.id) track('recycling_submit', { request_id: state.id, pickup_type: state.pickupType });
  }, [state]);

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(`/api/geo/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
      const data = (await res.json()) as { ok: boolean; address?: string };
      if (data.ok && data.address) {
        setAddress(data.address);
        setAddressAuto(true);
      }
    } catch {
      /* manzilni foydalanuvchi o'zi yozadi */
    }
  }

  function pick(lat: number, lng: number, via: 'gps' | 'map') {
    if (!isValidLat(lat) || !isValidLng(lng)) return;
    setCoords({ lat, lng, via });
    setLocalError(null);
    void reverseGeocode(lat, lng);
  }

  function locate() {
    if (!('geolocation' in navigator)) {
      setGps('error');
      return;
    }
    setGps('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps('done');
        pick(pos.coords.latitude, pos.coords.longitude, 'gps');
      },
      () => setGps('error'),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  function validate(e: React.FormEvent<HTMLFormElement>) {
    setLocalError(null);
    const fd = new FormData(e.currentTarget);
    const photo = fd.get('photo');
    if (photo instanceof File && photo.size > 5 * 1024 * 1024) {
      e.preventDefault();
      setLocalError('photo');
      return;
    }
    if (pickupType === 'pickup') {
      if (tooSmall) {
        e.preventDefault();
        setLocalError('min_volume');
        return;
      }
      if (!coords && !address.trim()) {
        e.preventDefault();
        setLocalError('location');
      }
    }
  }

  if (state?.ok) {
    const point = points.find((p) => p.id === effectivePointId);
    const trackHref = `/${locale}/recycling/${state.token}`;
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6" role="status">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-600" />
          <div>
            <h2 className="text-xl font-bold text-emerald-900">{l.successTitle}</h2>
            <p className="mt-1 text-emerald-800">{l.successText}</p>
          </div>
        </div>
        {state.id > 0 && (
          <>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-white p-4">
                <dt className="text-sm text-slate-500">{l.requestNo}</dt>
                <dd className="text-2xl font-bold text-slate-900">#{state.id}</dd>
              </div>
              <div className="rounded-lg bg-white p-4">
                <dt className="text-sm text-slate-500">{l.successPoint}</dt>
                <dd className="font-semibold text-slate-900">{state.pointName || point?.name}</dd>
                {(state.pointAddress || point?.address) && <dd className="text-sm text-slate-600">{state.pointAddress || point?.address}</dd>}
              </div>
            </dl>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href={trackHref} className="btn-primary w-full sm:w-auto">
                <ExternalLink className="h-4 w-4" />
                {l.track}
              </a>
              {telegramBot && (
                <a href={`https://t.me/${telegramBot}`} target="_blank" rel="noopener" className="btn-ghost w-full sm:w-auto">
                  <Send className="h-4 w-4" />
                  {l.telegram}
                </a>
              )}
            </div>
            <p className="mt-3 break-all text-sm text-slate-600">
              {l.trackHint}
              <br />
              <a href={trackHref} className="font-mono text-brand-500 underline">{typeof window !== 'undefined' ? window.location.origin : ''}{trackHref}</a>
            </p>
          </>
        )}
        <a href={`/${locale}/recycling`} className="mt-4 inline-block text-sm text-brand-500 underline">{l.newRequest}</a>
      </div>
    );
  }

  const error = localError ?? (state && !state.ok ? state.error : null);
  const errorText = error ? fill(l.errors[error], pickupMinKg) : '';
  const submitMode: LocMode = coords ? coords.via : 'text';

  return (
    <form action={formAction} onSubmit={validate} className="space-y-6" noValidate={false}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="pointId" value={effectivePointId ?? ''} />
      <input type="hidden" name="pickupLocationMode" value={pickupType === 'pickup' ? submitMode : ''} />
      <input type="hidden" name="pickupLat" value={pickupType === 'pickup' && coords ? coords.lat.toFixed(6) : ''} />
      <input type="hidden" name="pickupLng" value={pickupType === 'pickup' && coords ? coords.lng.toFixed(6) : ''} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">{common.name} *</span>
          <input name="name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="input py-3 text-base" autoComplete="name" />
        </label>
        <label className="block">
          <span className="label">{common.phone} *</span>
          <input
            name="phone"
            type="tel"
            required
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            placeholder="+998 90 123 45 67"
            className="input py-3 text-base"
            autoComplete="tel"
          />
        </label>
        <label className="block">
          <span className="label">{l.material}</span>
          <select name="material" value={material} onChange={(e) => setMaterial(e.target.value as MaterialType)} className="input py-3 text-base">
            {MATERIALS.map((m) => (
              <option key={m} value={m}>{materialLabels[locale][m]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">{l.volume}</span>
          <input
            name="volume"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            step={1}
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            placeholder="100"
            className={`input py-3 text-base ${tooSmall ? 'border-accent-500' : ''}`}
          />
          {tooSmall && <span className="mt-1 block text-xs text-accent-600">{fill(l.errors.min_volume, pickupMinKg)}</span>}
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="label">{l.pickupType}</legend>
        {(['base', 'pickup'] as const).map((v) => (
          <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${pickupType === v ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}>
            <input type="radio" name="pickupType" value={v} checked={pickupType === v} onChange={() => setPickupType(v)} className="mt-1" />
            <span>
              <span className="block font-medium">{v === 'base' ? l.base : l.pickup}</span>
              <span className="block text-sm text-slate-500">{v === 'base' ? l.baseHint : fill(l.pickupHint, pickupMinKg)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {pickupType === 'pickup' && (
        <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <legend className="px-1 font-semibold">{l.locationTitle}</legend>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-white p-1" role="tablist">
            {(
              [
                ['gps', l.locGps, Crosshair],
                ['map', l.locMap, MapPin],
                ['text', l.locText, PenLine],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={mode === v}
                onClick={() => setMode(v)}
                className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-xs font-medium leading-tight transition sm:flex-row sm:gap-1.5 sm:text-sm ${mode === v ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-normal text-center">{label}</span>
              </button>
            ))}
          </div>

          {mode === 'gps' && (
            <div className="space-y-3">
              <button type="button" onClick={locate} disabled={gps === 'loading'} className="btn-primary w-full sm:w-auto">
                <Navigation className="h-4 w-4" />
                {gps === 'loading' ? l.gpsLoading : l.gpsButton}
              </button>
              {gps === 'error' && <p className="text-sm text-accent-600">{l.gpsError}</p>}
              {coords && gps === 'done' && (
                <p className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {l.gpsDone} ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})
                </p>
              )}
              {coords && <LeafletMap picked={coords} onPick={(lat, lng) => pick(lat, lng, 'map')} height={260} zoom={15} />}
            </div>
          )}

          {mode === 'map' && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">{l.mapHint}</p>
              <LeafletMap
                picked={coords}
                onPick={(lat, lng) => pick(lat, lng, 'map')}
                height={300}
                zoom={coords ? 15 : 12}
                points={mapPoints}
              />
              {coords && (
                <p className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {l.mapPicked} ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})
                </p>
              )}
            </div>
          )}

          <label className="block">
            <span className="label">{l.address}{mode === 'text' || !coords ? ' *' : ''}</span>
            <textarea
              name="address"
              rows={2}
              maxLength={500}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setAddressAuto(false);
              }}
              placeholder={l.addressPlaceholder}
              className="input py-3 text-base"
              autoComplete="street-address"
            />
            {addressAuto && <span className="mt-1 block text-xs text-slate-500">{l.addressAuto}</span>}
          </label>

          {near && (
            <p className="text-sm text-slate-600">
              {l.nearest}: <b>{near.point.name}</b> · {formatKm(near.km)} {l.km}
            </p>
          )}
        </fieldset>
      )}

      {selectable.length > 0 && (
        <label className="block">
          <span className="label">{l.point}</span>
          <select name="pointSelect" value={effectivePointId ?? ''} onChange={(e) => setPointId(Number(e.target.value) || null)} className="input py-3 text-base">
            {selectable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.address ? ` — ${p.address}` : ''} · {p.pricePerKg} {l.pricePerKg}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="label">{l.photo}</span>
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-brand-700" />
        <span className="mt-1 block text-xs text-slate-500">{l.photoHint}</span>
      </label>

      {errorText && <p className="rounded-lg bg-red-50 p-3 text-sm text-accent-600" role="alert">{errorText}</p>}

      <button type="submit" className="btn-accent w-full py-3.5 text-base sm:w-auto" disabled={pending}>
        {pending ? l.submitting : l.submit}
      </button>
    </form>
  );
}
