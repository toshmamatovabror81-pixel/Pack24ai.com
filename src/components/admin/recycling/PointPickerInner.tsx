'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isValidLat, isValidLng, TASHKENT } from '@/lib/recycling/geo';
import { pinIcon } from './leafletIcons';

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Xaritada bosib koordinata tanlash (faqat brauzerda) */
export default function PointPickerInner({ lat, lng, hex, onPick }: { lat: number | null; lng: number | null; hex: string; onPick: (lat: number, lng: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const pickRef = useRef(onPick);

  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const has = isValidLat(lat) && isValidLng(lng);
    const map = L.map(el.current, { center: has ? [lat, lng] : TASHKENT, zoom: has ? 14 : 11 });
    L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => pickRef.current(Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Boshlang'ich markaz faqat bir marta — keyingi o'zgarishlar pastdagi effektda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!isValidLat(lat) || !isValidLng(lng)) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]).setIcon(pinIcon(hex));
    } else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon(hex) }).addTo(map);
    }
    if (!map.getBounds().contains([lat, lng])) map.panTo([lat, lng]);
  }, [lat, lng, hex]);

  return <div ref={el} className="h-72 w-full rounded-lg border border-slate-200" />;
}
