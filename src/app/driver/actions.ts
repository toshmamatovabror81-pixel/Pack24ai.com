'use server';

import { redirect } from 'next/navigation';
import { endDriverSession, requireDriver, startDriverSession } from '@/lib/auth/driver';
import { checkSecret, findDriverByPhone, StaffError, updateDriver } from '@/lib/recycling/staff';
import { acceptTask, markArrived, rejectTask, setDriverOnline, startCollecting, startEnRoute, updateDriverLocation } from '@/lib/recycling/driverTasks';
import { recordWeighing } from '@/lib/recycling/collections';
import { RequestError } from '@/lib/recycling/requests';
import { addCard, removeCard, requestWithdrawal, WalletError } from '@/lib/recycling/wallet';
import { isMaterial } from '@/lib/recycling/statuses';
import { isValidLat, isValidLng } from '@/lib/recycling/geo';
import { normalizePhone } from '@/lib/format';
import { num, optText, text } from '@/lib/formData';
import { rateLimit } from '@/lib/rateLimit';
import { discountReasonLabel, rejectReasonLabel } from '@/components/driver/labels';
import { isTaskAccepted } from './accepted';

/**
 * Haydovchi kabineti action'lari. Har birida haydovchi id'si FAQAT requireDriver() dan olinadi —
 * formadan kelgan id'ga ishonilmaydi. Topshiriq egaligini poydevor (driverTasks.ts) tekshiradi.
 * Xatolar ?error=<qisqa matn> orqali sahifada ko'rsatiladi; redirect() try ichida chaqirilmaydi.
 */

// ─── Yordamchilar ────────────────────────────────────────────────────────────

function errorMessage(e: unknown): string {
  if (e instanceof RequestError || e instanceof WalletError || e instanceof StaffError) return e.message;
  console.error('driver action', e);
  return "Xatolik yuz berdi. Qayta urinib ko'ring";
}

const withError = (path: string, msg: string) => `${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg.slice(0, 160))}`;
const withSaved = (path: string, key: string) => `${path}${path.includes('?') ? '&' : '?'}saved=${key}`;

function requestId(fd: FormData): number {
  const id = Number(fd.get('id'));
  if (!Number.isSafeInteger(id) || id <= 0) redirect('/driver');
  return id;
}

/** Qaytish manzili: ro'yxat yoki topshiriq sahifasi (hidden back=task) */
const backPath = (fd: FormData, id: number) => (text(fd, 'back', 10) === 'task' ? `/driver/tasks/${id}` : '/driver');

// ─── Kirish / chiqish ────────────────────────────────────────────────────────

export type DriverLoginState = { error?: 'invalid' | 'rate' } | null;

export async function driverLogin(_: DriverLoginState, fd: FormData): Promise<DriverLoginState> {
  if (!(await rateLimit('driver-login', 10, 15 * 60_000))) return { error: 'rate' };
  const phone = normalizePhone(text(fd, 'phone', 30));
  const password = String(fd.get('password') ?? '');
  if (!phone || !password) return { error: 'invalid' };
  const driver = await findDriverByPhone(phone);
  // Telefon yoki parol — qaysi biri noto'g'riligi aytilmaydi
  if (!driver || driver.status === 'inactive' || !(await checkSecret(password, driver.passwordHash))) return { error: 'invalid' };
  await startDriverSession(driver.id);
  redirect('/driver');
}

export async function driverLogout() {
  await endDriverSession();
  redirect('/driver/login');
}

// ─── Onlayn holat va GPS ─────────────────────────────────────────────────────

export async function setOnlineAction(fd: FormData) {
  const d = await requireDriver();
  const online = fd.get('online') === '1';
  await setDriverOnline(d.id, online);
  redirect(withSaved('/driver', online ? 'online' : 'offline'));
}

/** Client (DriverLocation) 60 soniyada bir chaqiradi */
export async function reportLocation(lat: number, lng: number): Promise<{ ok: boolean }> {
  const d = await requireDriver();
  if (!isValidLat(lat) || !isValidLng(lng)) return { ok: false };
  await updateDriverLocation(d.id, lat, lng);
  return { ok: true };
}

// ─── Topshiriq qadamlari ─────────────────────────────────────────────────────

export async function acceptTaskAction(fd: FormData) {
  const d = await requireDriver();
  const id = requestId(fd);
  // Allaqachon qabul qilingan (eskirgan sahifadan takroriy bosish) — masulga qayta xabar yubormaymiz
  if (await isTaskAccepted(d.id, id)) redirect(withSaved(backPath(fd, id), 'accept'));
  let error: string | null = null;
  try {
    await acceptTask(id, d.id);
  } catch (e) {
    error = errorMessage(e);
  }
  redirect(error ? withError(backPath(fd, id), error) : withSaved(backPath(fd, id), 'accept'));
}

export async function rejectTaskAction(fd: FormData) {
  const d = await requireDriver();
  const id = requestId(fd);
  const code = text(fd, 'reason', 20);
  const extra = optText(fd, 'reasonText', 200);
  const reason = [rejectReasonLabel(code), extra].filter(Boolean).join(': ') || undefined;
  let error: string | null = null;
  try {
    await rejectTask(id, d.id, reason);
  } catch (e) {
    error = errorMessage(e);
  }
  redirect(error ? withError(backPath(fd, id), error) : withSaved('/driver', 'reject'));
}

export async function enRouteAction(fd: FormData) {
  const d = await requireDriver();
  const id = requestId(fd);
  let error: string | null = null;
  try {
    await startEnRoute(id, d.id);
  } catch (e) {
    error = errorMessage(e);
  }
  redirect(error ? withError(backPath(fd, id), error) : withSaved(backPath(fd, id), 'en_route'));
}

export async function arrivedAction(fd: FormData) {
  const d = await requireDriver();
  const id = requestId(fd);
  let error: string | null = null;
  try {
    await markArrived(id, d.id);
  } catch (e) {
    error = errorMessage(e);
  }
  redirect(error ? withError(backPath(fd, id), error) : withSaved(backPath(fd, id), 'arrived'));
}

export async function collectingAction(fd: FormData) {
  const d = await requireDriver();
  const id = requestId(fd);
  let error: string | null = null;
  try {
    await startCollecting(id, d.id);
  } catch (e) {
    error = errorMessage(e);
  }
  redirect(error ? withError(backPath(fd, id), error) : withSaved(backPath(fd, id), 'collecting'));
}

/** Tortish: narx punktdan, daromad avtomatik (collections.ts). Chegirma 0–50%. */
export async function weighAction(fd: FormData) {
  const d = await requireDriver();
  const id = requestId(fd);
  const path = `/driver/tasks/${id}`;
  const weight = num(fd, 'actualWeight');
  if (weight == null || !(weight > 0)) redirect(withError(path, "Og'irlikni kiriting (kg)"));
  const discountPercent = Math.min(50, Math.max(0, num(fd, 'discountPercent') ?? 0));
  const reasonCode = text(fd, 'discountReason', 20);
  const reasonText = optText(fd, 'discountReasonText', 200);
  const discountReason = discountPercent > 0 ? (reasonCode === 'boshqa' ? reasonText ?? 'Boshqa' : discountReasonLabel(reasonCode)) : null;
  const material = text(fd, 'materialType', 20);
  let error: string | null = null;
  try {
    await recordWeighing({
      requestId: id,
      actualWeight: weight,
      discountPercent,
      discountReason,
      materialType: isMaterial(material) ? material : null,
      notes: optText(fd, 'notes', 500),
      actor: { kind: 'driver', id: d.id, name: d.name },
    });
  } catch (e) {
    error = errorMessage(e);
  }
  redirect(error ? withError(path, error) : withSaved(path, 'weighed'));
}

// ─── Hamyon ──────────────────────────────────────────────────────────────────

export async function withdrawAction(fd: FormData) {
  const d = await requireDriver();
  const amount = num(fd, 'amount') ?? 0;
  const cardId = num(fd, 'cardId');
  let error: string | null = null;
  try {
    await requestWithdrawal(d.id, amount, cardId && cardId > 0 ? cardId : null);
  } catch (e) {
    error = errorMessage(e);
  }
  redirect(error ? withError('/driver/wallet', error) : withSaved('/driver/wallet', 'withdraw'));
}

export async function addCardAction(fd: FormData) {
  const d = await requireDriver();
  let error: string | null = null;
  try {
    await addCard(d.id, {
      number: text(fd, 'number', 30),
      holder: text(fd, 'holder', 100),
      expiryMonth: num(fd, 'expiryMonth') ?? 0,
      expiryYear: num(fd, 'expiryYear') ?? 0,
      isDefault: fd.get('isDefault') === 'on',
    });
  } catch (e) {
    error = errorMessage(e);
  }
  redirect(error ? withError('/driver/wallet', error) : withSaved('/driver/wallet', 'card'));
}

export async function removeCardAction(fd: FormData) {
  const d = await requireDriver();
  const cardId = num(fd, 'cardId');
  if (cardId && cardId > 0) await removeCard(d.id, cardId);
  redirect(withSaved('/driver/wallet', 'card_removed'));
}

// ─── Profil ──────────────────────────────────────────────────────────────────

export async function updateVehicleAction(fd: FormData) {
  const d = await requireDriver();
  let error: string | null = null;
  try {
    await updateDriver(d.id, { vehicleInfo: optText(fd, 'vehicleInfo', 120) });
  } catch (e) {
    error = errorMessage(e);
  }
  redirect(error ? withError('/driver/profile', error) : withSaved('/driver/profile', 'profile'));
}
