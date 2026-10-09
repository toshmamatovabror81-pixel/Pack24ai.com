'use server';

import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { redirect } from 'next/navigation';
import type { PickupLocationMode } from '@prisma/client';
import { currentUser } from '@/lib/auth';
import { normalizePhone } from '@/lib/format';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { rateLimit } from '@/lib/rateLimit';
import { getSettings } from '@/lib/settings';
import { uploadDir, uploadImage } from '@/lib/storage';
import { cancelRequest, createRequest, RequestError, requestByToken } from './requests';
import { customerDecision } from './collections';
import { isValidLat, isValidLng } from './geo';
import { isMaterial } from './statuses';

/**
 * Mijoz veb-sahifasi uchun server action'lar: ariza yuborish, token orqali bekor qilish va tortishni tasdiqlash.
 * Token — kuzatuv havolasidagi maxfiy kalit; tokensiz hech qanday amal bajarilmaydi.
 * Tartib: honeypot → arzon tekshiruvlar (ism, telefon, kg, manzil, rasm turi/hajmi) → rate limit → rasm yuklash → ariza.
 */

export type RecyclingErrorCode = 'phone' | 'name' | 'point' | 'min_volume' | 'location' | 'rate' | 'server' | 'photo';

export type RecyclingState =
  | { ok: true; id: number; token: string; pointName: string; pointAddress: string | null; pickupType: 'base' | 'pickup' }
  | { ok: false; error: RecyclingErrorCode }
  | null;

const str = (fd: FormData, name: string, max = 500) => String(fd.get(name) ?? '').trim().slice(0, max);
const numOrNull = (fd: FormData, name: string) => {
  const raw = String(fd.get(name) ?? '').replace(/\s/g, '').replace(',', '.');
  const n = Number(raw);
  return raw && Number.isFinite(n) ? n : null;
};
const localeOf = (v: unknown): Locale => (typeof v === 'string' && isLocale(v) ? v : 'uz');
const LOCATION_MODES: PickupLocationMode[] = ['gps', 'map', 'text'];
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Ariza yaratilmay qolsa lokal diskka yozilgan rasmni o'chiramiz (yetim fayl qolmasin) */
async function removeLocalUpload(url: string | null) {
  if (!url) return;
  const m = /^\/uploads\/recycling\/([0-9a-f-]{36}\.(?:jpg|png|webp|avif))$/.exec(url);
  if (!m) return; // Supabase yoki noma'lum URL — tegmaymiz
  await unlink(path.join(uploadDir(), 'recycling', m[1])).catch(() => undefined);
}

/** Ariza formasi (useActionState) */
export async function submitRecyclingRequest(_: RecyclingState, fd: FormData): Promise<RecyclingState> {
  // Botlar uchun yashirin maydon: to'ldirilgan bo'lsa jim "qabul qilgandek" qaytamiz
  if (str(fd, 'website')) return { ok: true, id: 0, token: '', pointName: '', pointAddress: null, pickupType: 'base' };

  const locale = localeOf(fd.get('locale'));
  const name = str(fd, 'name', 100);
  const phoneRaw = str(fd, 'phone', 30);
  const pickupType = fd.get('pickupType') === 'pickup' ? 'pickup' : 'base';
  const materialRaw = str(fd, 'material', 30);
  const modeRaw = str(fd, 'pickupLocationMode', 10);
  const pointIdRaw = numOrNull(fd, 'pointId');
  const lat = numOrNull(fd, 'pickupLat');
  const lng = numOrNull(fd, 'pickupLng');
  const volumeRaw = numOrNull(fd, 'volume');
  const address = pickupType === 'pickup' ? str(fd, 'address', 500) || null : null;
  const photo = fd.get('photo');
  const hasPhoto = photo instanceof File && photo.size > 0;

  // Arzon tekshiruvlar — rasm yuklash va rate limit'dan OLDIN (poydevor createRequest bilan bir xil qoidalar)
  if (name.length < 2) return { ok: false, error: 'name' };
  if (!normalizePhone(phoneRaw)) return { ok: false, error: 'phone' };
  if (pickupType === 'pickup') {
    const settings = await getSettings();
    const volume = volumeRaw != null && volumeRaw > 0 ? Math.min(100_000, Math.round(volumeRaw)) : null;
    const hasCoords = lat != null && lng != null && isValidLat(lat) && isValidLng(lng);
    if (volume != null && volume < settings.recyclingPickupMinKg) return { ok: false, error: 'min_volume' };
    if (!hasCoords && !address) return { ok: false, error: 'location' };
  }
  if (hasPhoto && (!PHOTO_TYPES.includes(photo.type) || photo.size > PHOTO_MAX_BYTES)) return { ok: false, error: 'photo' };

  // Faqat to'g'ri to'ldirilgan urinishlar limitga kiradi
  if (!(await rateLimit('recycling', 5, 60 * 60_000))) return { ok: false, error: 'rate' };

  // Rasm ixtiyoriy: saqlab bo'lmasa foydalanuvchiga aytamiz, ariza yaratilmaydi
  let photoUrl: string | null = null;
  if (hasPhoto) {
    try {
      photoUrl = await uploadImage(photo, 'recycling');
    } catch {
      return { ok: false, error: 'photo' };
    }
  }

  const user = await currentUser().catch(() => null);
  try {
    const { request, token } = await createRequest({
      name,
      phone: phoneRaw,
      pointId: pointIdRaw && pointIdRaw > 0 ? Math.round(pointIdRaw) : null,
      material: isMaterial(materialRaw) ? materialRaw : null,
      volume: volumeRaw,
      pickupType,
      pickupLocationMode: pickupType === 'pickup' && (LOCATION_MODES as string[]).includes(modeRaw) ? (modeRaw as PickupLocationMode) : null,
      address,
      pickupLat: pickupType === 'pickup' ? lat : null,
      pickupLng: pickupType === 'pickup' ? lng : null,
      photoUrl,
      customerLang: locale,
      userId: user?.id ?? null,
      source: 'web',
    });
    const point = request.point;
    const pointName = point ? (locale === 'ru' ? point.cityRu : point.cityUz) : '';
    return { ok: true, id: request.id, token, pointName, pointAddress: point?.address ?? null, pickupType: request.pickupType };
  } catch (e) {
    await removeLocalUpload(photoUrl);
    if (e instanceof RequestError) {
      const code = e.code;
      if (code === 'phone' || code === 'name' || code === 'point' || code === 'min_volume' || code === 'location' || code === 'rate') return { ok: false, error: code };
      return { ok: false, error: 'server' };
    }
    console.error('submitRecyclingRequest', e);
    return { ok: false, error: 'server' };
  }
}

export type TokenActionResult = { ok: true } | { ok: false; error: 'not_found' | 'status' | 'rate' | 'server' };

/** Mijoz arizani bekor qiladi (faqat haydovchi yo'lga chiqmagan bo'lsa — poydevor tekshiradi) */
export async function cancelByToken(token: string, reason?: string): Promise<TokenActionResult> {
  if (!(await rateLimit('recycling-token', 30, 10 * 60_000))) return { ok: false, error: 'rate' };
  const r = await requestByToken(String(token ?? ''));
  if (!r) return { ok: false, error: 'not_found' };
  try {
    await cancelRequest(r.id, { kind: 'customer', name: r.name }, reason?.trim().slice(0, 300) || undefined);
    return { ok: true };
  } catch (e) {
    if (e instanceof RequestError) return { ok: false, error: e.code === 'status' ? 'status' : 'not_found' };
    console.error('cancelByToken', e);
    return { ok: false, error: 'server' };
  }
}

/** Mijoz tortish natijasini tasdiqlaydi yoki inkor qiladi (collected holatida) */
export async function confirmByToken(token: string, confirmed: boolean, comment?: string): Promise<TokenActionResult> {
  if (!(await rateLimit('recycling-token', 30, 10 * 60_000))) return { ok: false, error: 'rate' };
  const r = await requestByToken(String(token ?? ''));
  if (!r) return { ok: false, error: 'not_found' };
  try {
    await customerDecision(r.id, { token: r.accessToken! }, !!confirmed, comment?.trim().slice(0, 500) || undefined);
    return { ok: true };
  } catch (e) {
    if (e instanceof RequestError) return { ok: false, error: e.code === 'status' ? 'status' : 'not_found' };
    console.error('confirmByToken', e);
    return { ok: false, error: 'server' };
  }
}

/** Kuzatuv sahifasidagi "Bekor qilish" formasi: natija ?notice= bilan sahifaga qaytadi */
export async function cancelFormAction(token: string, locale: Locale, _fd: FormData): Promise<void> {
  const l = localeOf(locale);
  const res = await cancelByToken(token);
  if (!res.ok && res.error === 'not_found') redirect(`/${l}/recycling`);
  redirect(`/${l}/recycling/${encodeURIComponent(token)}?notice=${res.ok ? 'cancelled' : 'error'}`);
}

/** Kuzatuv sahifasidagi "Tasdiqlayman / Rozi emasman" formasi */
export async function decisionFormAction(token: string, locale: Locale, fd: FormData): Promise<void> {
  const l = localeOf(locale);
  const decision = fd.get('decision');
  // Qaror aniq bo'lmasa (maydon yo'q yoki noma'lum) — hech narsa qilmaymiz; "inkor" eng qimmat amal, uni taxmin qilmaymiz
  if (decision !== 'yes' && decision !== 'no') redirect(`/${l}/recycling/${encodeURIComponent(token)}?notice=error`);
  const confirmed = decision === 'yes';
  const res = await confirmByToken(token, confirmed, str(fd, 'comment', 500));
  if (!res.ok && res.error === 'not_found') redirect(`/${l}/recycling`);
  redirect(`/${l}/recycling/${encodeURIComponent(token)}?notice=${res.ok ? (confirmed ? 'confirmed' : 'disputed') : 'error'}`);
}
