'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { isValidLat, isValidLng } from '@/lib/recycling/geo';

const Inner = dynamic(() => import('./PointPickerInner'), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-slate-100" />,
});

const parse = (v: string) => {
  const n = Number(v.replace(',', '.').trim());
  return v.trim() && Number.isFinite(n) ? n : null;
};

/**
 * Koordinata tanlash: xaritada bosilganda lat/lng input'lari to'ladi; qo'lda ham kiritish mumkin.
 * Input'lar har doim formada bo'ladi (xarita yuklanmasa ham yuboriladi).
 */
export function PointPicker({ lat, lng, hex = '#10b981', latName = 'lat', lngName = 'lng', hint }: { lat?: number | null; lng?: number | null; hex?: string; latName?: string; lngName?: string; hint?: string }) {
  const [latText, setLatText] = useState(lat != null ? String(lat) : '');
  const [lngText, setLngText] = useState(lng != null ? String(lng) : '');
  const la = parse(latText);
  const ln = parse(lngText);
  const valid = isValidLat(la) && isValidLng(ln);
  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="label">Kenglik (lat)</span>
          <input name={latName} value={latText} onChange={(e) => setLatText(e.target.value)} inputMode="decimal" placeholder="41.311081" className="input" />
        </label>
        <label className="block">
          <span className="label">Uzunlik (lng)</span>
          <input name={lngName} value={lngText} onChange={(e) => setLngText(e.target.value)} inputMode="decimal" placeholder="69.240562" className="input" />
        </label>
        <div className="flex items-end">
          <button type="button" onClick={() => { setLatText(''); setLngText(''); }} className="btn-ghost px-3 py-2 text-sm">Tozalash</button>
        </div>
      </div>
      <Inner lat={valid ? la : null} lng={valid ? ln : null} hex={hex} onPick={(a, b) => { setLatText(String(a)); setLngText(String(b)); }} />
      <p className="text-xs text-slate-500">{hint ?? 'Xaritada kerakli joyni bosing — koordinatalar avtomatik to‘ladi.'}{latText && !valid && <span className="text-accent-600"> Koordinata noto‘g‘ri.</span>}</p>
    </div>
  );
}
