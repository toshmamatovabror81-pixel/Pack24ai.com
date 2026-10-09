'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { CircleMarker, Map as LeafletMapInstance, Marker } from 'leaflet';
import { TASHKENT } from '@/lib/recycling/geo';

/**
 * Leaflet xarita (faqat brauzerda chiziladi: `leaflet` useEffect ichida yuklanadi, SSR yo'q).
 * Punktlar — doira markerlar (rasm fayllarga tayanmaymiz), tanlangan nuqta — divIcon "pin".
 * onPick berilsa xarita bosilganda nuqta belgilanadi.
 */

export type MapPoint = { id: number; lat: number; lng: number; title: string; subtitle?: string; muted?: boolean };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const PIN_HTML =
  '<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 35c6-9 12-15 12-21A12 12 0 0 0 2 14c0 6 6 12 12 21z" fill="#e33326" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="4.5" fill="#fff"/></svg>';

export function LeafletMap({
  points = [],
  picked,
  onPick,
  center,
  zoom = 11,
  height = 300,
  className = '',
  fitPoints = false,
}: {
  points?: MapPoint[];
  picked?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  center?: [number, number];
  zoom?: number;
  height?: number;
  className?: string;
  /** Barcha punktlar ko'rinadigan qilib masshtablash */
  fitPoints?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const pointLayers = useRef<CircleMarker[]>([]);
  const pinRef = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const pointsRef = useRef(points);
  pointsRef.current = points;

  // Xaritani yaratish (bir marta)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || mapRef.current) return;
      const start = center ?? (pickedRef.current ? [pickedRef.current.lat, pickedRef.current.lng] : TASHKENT);
      const map = L.map(el.current, { center: start, zoom, scrollWheelZoom: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(map);
      map.on('click', (e) => {
        if (onPickRef.current) onPickRef.current(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = map;
      // Punkt va pin qatlamlarini birinchi chizish
      drawPoints(L, map);
      drawPin(L, map, true);
      // Konteyner o'lchami keyin o'zgarsa (tab ochilganda) xaritani yangilash
      setTimeout(() => map.invalidateSize(), 50);
    })();
    return () => {
      cancelled = true;
      pointLayers.current = [];
      pinRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawPoints(L: typeof import('leaflet'), map: LeafletMapInstance) {
    for (const l of pointLayers.current) l.remove();
    pointLayers.current = [];
    const list = pointsRef.current;
    for (const p of list) {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: p.muted ? '#94a3b8' : '#1a4a7c',
        fillOpacity: 0.95,
      }).addTo(map);
      m.bindPopup(`<b>${esc(p.title)}</b>${p.subtitle ? `<br>${esc(p.subtitle)}` : ''}`);
      pointLayers.current.push(m);
    }
    if (fitPoints && list.length > 1) {
      map.fitBounds(L.latLngBounds(list.map((p) => [p.lat, p.lng] as [number, number])), { padding: [24, 24], maxZoom: 14 });
    } else if (fitPoints && list.length === 1) {
      map.setView([list[0].lat, list[0].lng], 13);
    }
  }

  function drawPin(L: typeof import('leaflet'), map: LeafletMapInstance, initial = false) {
    const p = pickedRef.current;
    if (!p) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }
    if (pinRef.current) {
      pinRef.current.setLatLng([p.lat, p.lng]);
    } else {
      pinRef.current = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: 'p24-pin', html: PIN_HTML, iconSize: [28, 36], iconAnchor: [14, 35] }),
        interactive: false,
        keyboard: false,
      }).addTo(map);
    }
    if (!initial) map.panTo([p.lat, p.lng]);
    else map.setView([p.lat, p.lng], Math.max(map.getZoom(), 15));
  }

  // Punktlar haqiqatan o'zgarganda (id/koordinata/holat bo'yicha kalit — ota komponent yangi massiv bersa ham qayta chizilmaydi)
  const pointsKey = points.map((p) => `${p.id}:${p.lat}:${p.lng}:${p.muted ? 1 : 0}`).join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    import('leaflet').then((m) => mapRef.current && drawPoints(m.default, mapRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  // Tanlangan nuqta o'zgarganda
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    import('leaflet').then((m) => mapRef.current && drawPin(m.default, mapRef.current, false));
  }, [picked?.lat, picked?.lng]);

  return <div ref={el} className={`w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${className}`} style={{ height }} aria-label="map" />;
}
