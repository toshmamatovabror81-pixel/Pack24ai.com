/** Geografiya: masofa, eng yaqin punkt, xarita havolalari. Server va client'da ishlaydi. */

const R = 6371; // km

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function isValidLat(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90 && v !== 0;
}
export function isValidLng(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180 && v !== 0;
}

/** Koordinatali faol punktlar ichidan eng yaqini (masofa km bilan) */
export function nearestPoint<T extends { lat: number | null; lng: number | null }>(points: T[], lat: number, lng: number): { point: T; km: number } | null {
  let best: { point: T; km: number } | null = null;
  for (const p of points) {
    if (!isValidLat(p.lat) || !isValidLng(p.lng)) continue;
    const km = haversineKm(lat, lng, p.lat, p.lng);
    if (!best || km < best.km) best = { point: p, km };
  }
  return best;
}

export const formatKm = (km: number) => (km < 10 ? km.toFixed(1) : Math.round(km).toString());

/** Google xaritasi (masul, admin) */
export const googleMapsUrl = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
/** Yandex xaritasi (haydovchilar ko'proq ishlatadi; Yandex lng,lat tartibida) */
export const yandexMapsUrl = (lat: number, lng: number) => `https://yandex.com/maps/?pt=${lng.toFixed(6)},${lat.toFixed(6)}&z=16&l=map`;

/** Toshkent markazi: xarita boshlang'ich nuqtasi */
export const TASHKENT: [number, number] = [41.311081, 69.240562];
