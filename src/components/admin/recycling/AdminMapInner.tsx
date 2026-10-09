'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TASHKENT } from '@/lib/recycling/geo';
import { esc, pinIcon, truckIcon } from './leafletIcons';
import type { AdminMapData } from './mapTypes';

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const price = (n: number) => `${n.toLocaleString('ru-RU')} so'm/kg`;

/** Punktlar (10 km doira), faol arizalar (holat rangi) va onlayn haydovchilar — faqat brauzerda (ssr:false) */
export default function AdminMapInner({ data }: { data: AdminMapData }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, { center: TASHKENT, zoom: 11, scrollWheelZoom: true });
    L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngTuple[] = [];

    for (const p of data.points) {
      bounds.push([p.lat, p.lng]);
      L.circle([p.lat, p.lng], { radius: 10_000, color: p.hex, weight: 1.5, opacity: 0.6, fillColor: p.hex, fillOpacity: 0.06 }).addTo(layer);
      const sup = p.supervisors.length ? p.supervisors.map(esc).join(', ') : "<i>masul yo'q</i>";
      L.marker([p.lat, p.lng], { icon: pinIcon(p.hex), zIndexOffset: 500 })
        .bindPopup(
          `<b>🏭 ${esc(p.name)}</b>${p.status === 'planned' ? ' <span style="color:#64748b">(rejada)</span>' : ''}${p.isAccepting ? '' : ' <span style="color:#dc2626">· qabul to‘xtatilgan</span>'}` +
            `${p.address ? `<br>${esc(p.address)}` : ''}<br>💵 ${price(p.pricePerKg)} · 🚛 ${price(p.driverRatePerKg)}<br>🧑‍💼 ${sup}` +
            `<br><a href="/admin/recycling/points/${p.id}">Punktni ochish →</a>`,
        )
        .addTo(layer);
    }

    for (const r of data.requests) {
      bounds.push([r.lat, r.lng]);
      L.circleMarker([r.lat, r.lng], { radius: 9, color: '#fff', weight: 2, fillColor: r.hex, fillOpacity: 0.95 })
        .bindPopup(
          `<b>📦 Ariza #${r.id}</b> · ${esc(r.statusLabel)}<br>👤 ${esc(r.name)} · ${esc(r.phone)}` +
            `${r.volume ? `<br>⚖️ ~${r.volume} kg` : ''}${r.material ? ` · ${esc(r.material)}` : ''}<br>🏭 ${esc(r.point)}${r.driver ? `<br>🚛 ${esc(r.driver)}` : ''}` +
            `<br><a href="/admin/recycling/requests/${r.id}">Arizani ochish →</a>`,
        )
        .addTo(layer);
    }

    for (const d of data.drivers) {
      bounds.push([d.lat, d.lng]);
      L.marker([d.lat, d.lng], { icon: truckIcon(d.status !== 'active'), zIndexOffset: 1000 })
        .bindPopup(
          `<b>🚛 ${esc(d.name)}</b>${d.vehicle ? `<br>${esc(d.vehicle)}` : ''}<br>📞 <a href="tel:${esc(d.phone.replace(/\D/g, ''))}">${esc(d.phone)}</a><br>🕒 ${esc(d.lastSeen)}` +
            `<br><a href="/admin/recycling/drivers/${d.id}">Haydovchini ochish →</a>`,
        )
        .addTo(layer);
    }

    if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds).pad(0.15), { maxZoom: 13 });
    else if (bounds.length === 1) map.setView(bounds[0], 12);
    else map.setView(TASHKENT, 11);
  }, [data]);

  return <div ref={el} className="h-[70vh] min-h-[420px] w-full rounded-xl border border-slate-200" />;
}
