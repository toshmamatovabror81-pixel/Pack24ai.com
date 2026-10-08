import 'server-only';
import { randomBytes } from 'node:crypto';
import { Prisma, type CustomerLang, type Driver, type MaterialType, type PickupLocationMode, type PickupType, type RecycleRequestStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { normalizePhone } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { isValidLat, isValidLng, nearestPoint } from './geo';
import { logEvent } from './events';
import { onAssigned, onCancelled, onDispatched, onRequestCreated, type RequestWithRefs } from './notifications';
import { canTransition, STATUS_TIMESTAMP, TERMINAL_STATUSES, volumeSizeFromKg } from './statuses';

/**
 * Ariza hayot sikli: yaratish -> masulga yo'naltirish -> haydovchi tayinlash -> ... -> yakun/bekor.
 * Holat faqat `transition` orqali o'zgaradi (statuses.ts jadvali), vaqt maydonlari avtomatik to'ladi.
 */

export type Actor =
  | { kind: 'admin'; id: number; name: string }
  | { kind: 'supervisor'; id: number; name: string }
  | { kind: 'driver'; id: number; name: string }
  | { kind: 'customer'; name: string }
  | { kind: 'system'; name: string };

export const actorSource = (a: Actor) =>
  a.kind === 'admin' ? 'platform' : a.kind === 'supervisor' ? 'supervisor' : a.kind === 'driver' ? 'driver' : a.kind === 'customer' ? 'customer' : 'system';

export class RequestError extends Error {
  constructor(public code: 'phone' | 'name' | 'point' | 'min_volume' | 'location' | 'not_found' | 'status' | 'driver' | 'supervisor' | 'rate', message: string) {
    super(message);
  }
}

export const REQUEST_INCLUDE = { point: true, supervisor: true, assignedDriver: true } satisfies Prisma.RecycleRequestInclude;

export const newAccessToken = () => randomBytes(18).toString('base64url');

export type CreateRequestInput = {
  name: string;
  phone: string;
  pointId?: number | null;
  material?: MaterialType | null;
  volume?: number | null;
  pickupType: PickupType;
  pickupLocationMode?: PickupLocationMode | null;
  address?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  photoUrl?: string | null;
  customerTgId?: string | null;
  customerLang?: CustomerLang;
  userId?: number | null;
  source: 'web' | 'bot' | 'admin';
};

/** Mijoz uchun eng yaqin faol punkt (koordinata bo'lmasa — birinchi faol) */
export async function pickPoint(lat?: number | null, lng?: number | null): Promise<{ point: { id: number }; km: number | null } | null> {
  const points = await prisma.recyclePoint.findMany({ where: { status: 'active', isAccepting: true }, orderBy: { id: 'asc' } });
  const list = points.length ? points : await prisma.recyclePoint.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' } });
  if (!list.length) return null;
  if (lat != null && lng != null && isValidLat(lat) && isValidLng(lng)) {
    const near = nearestPoint(list, lat, lng);
    if (near) return { point: near.point, km: near.km };
  }
  return { point: list[0], km: null };
}

export async function createRequest(input: CreateRequestInput): Promise<{ request: RequestWithRefs; token: string }> {
  const name = input.name.trim().slice(0, 100);
  if (name.length < 2) throw new RequestError('name', "Ism kamida 2 ta harf bo'lsin");
  const phone = normalizePhone(input.phone);
  if (!phone) throw new RequestError('phone', "Telefon noto'g'ri");
  const settings = await getSettings();
  const volume = input.volume != null && Number.isFinite(input.volume) && input.volume > 0 ? Math.min(100_000, Math.round(input.volume)) : null;
  const hasCoords = input.pickupLat != null && input.pickupLng != null && isValidLat(input.pickupLat) && isValidLng(input.pickupLng);
  if (input.pickupType === 'pickup') {
    if (volume != null && volume < settings.recyclingPickupMinKg) throw new RequestError('min_volume', `Olib ketish uchun kamida ${settings.recyclingPickupMinKg} kg bo'lishi kerak`);
    if (!hasCoords && !input.address?.trim()) throw new RequestError('location', 'Manzil yoki joylashuv kerak');
  }
  let pointId = input.pointId ?? null;
  if (pointId && !(await prisma.recyclePoint.findFirst({ where: { id: pointId, status: 'active' }, select: { id: true } }))) pointId = null;
  if (!pointId) {
    const picked = await pickPoint(hasCoords ? input.pickupLat : null, hasCoords ? input.pickupLng : null);
    if (!picked) throw new RequestError('point', 'Hozircha faol qabul punkti yo\'q');
    pointId = picked.point.id;
  }
  // Punktga biriktirilgan faol, botda ro'yxatdan o'tgan masul bo'lsa darhol yo'naltiramiz
  const supervisor = await prisma.supervisor.findFirst({ where: { pointId, isActive: true }, orderBy: [{ registeredAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }] });
  const token = newAccessToken();
  const now = new Date();
  const request = await prisma.recycleRequest.create({
    data: {
      name, phone, pointId,
      material: input.material ?? null,
      volume,
      volumeSize: volumeSizeFromKg(volume),
      photoUrl: input.photoUrl ?? null,
      pickupType: input.pickupType,
      pickupLocationMode: input.pickupType === 'pickup' ? (input.pickupLocationMode ?? (hasCoords ? 'gps' : 'text')) : null,
      address: input.address?.trim().slice(0, 500) || null,
      pickupLat: hasCoords ? input.pickupLat : null,
      pickupLng: hasCoords ? input.pickupLng : null,
      customerTgId: input.customerTgId ?? null,
      customerLang: input.customerLang ?? 'uz',
      userId: input.userId ?? null,
      accessToken: token,
      status: supervisor ? 'dispatched' : 'new_',
      supervisorId: supervisor?.id ?? null,
      dispatchedAt: supervisor ? now : null,
    },
    include: REQUEST_INCLUDE,
  });
  await logEvent({
    sourceBot: input.source === 'bot' ? 'customer' : input.source === 'admin' ? 'platform' : 'system',
    eventType: 'request_created', severity: 'info',
    title: `Yangi ariza #${request.id}`,
    message: `${name}, ${phone}${volume ? `, ~${volume} kg` : ''}${supervisor ? ` → ${supervisor.name}` : ' (masul yo\'q)'}`,
    requestId: request.id, pointId, supervisorId: supervisor?.id ?? null, userId: input.userId ?? null,
    notifyHq: !supervisor,
  });
  await onRequestCreated(request);
  return { request, token };
}

/** Umumiy holat o'tishi (jadval bo'yicha tekshiradi, vaqtni to'ldiradi). Tranzaksiya ichida ham ishlaydi. */
export async function transition(
  tx: Prisma.TransactionClient | typeof prisma,
  requestId: number,
  to: RecycleRequestStatus,
  extra: Prisma.RecycleRequestUncheckedUpdateInput = {},
): Promise<RequestWithRefs> {
  const current = await tx.recycleRequest.findUnique({ where: { id: requestId }, select: { status: true } });
  if (!current) throw new RequestError('not_found', 'Ariza topilmadi');
  if (!canTransition(current.status, to)) throw new RequestError('status', `Holatni ${current.status} → ${to} ga o'tkazib bo'lmaydi`);
  const ts = STATUS_TIMESTAMP[to];
  return tx.recycleRequest.update({ where: { id: requestId }, data: { status: to, ...(ts ? { [ts]: new Date() } : {}), ...extra }, include: REQUEST_INCLUDE });
}

export async function getRequest(id: number): Promise<RequestWithRefs | null> {
  return prisma.recycleRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
}

/** Masulga yo'naltirish (admin yoki HQ). Tayinlangan haydovchi bo'lsa bo'shatiladi. */
export async function dispatchToSupervisor(requestId: number, supervisorId: number, actor: Actor, note?: string): Promise<RequestWithRefs> {
  const sup = await prisma.supervisor.findUnique({ where: { id: supervisorId } });
  if (!sup || !sup.isActive) throw new RequestError('supervisor', 'Masul topilmadi yoki faol emas');
  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.recycleRequest.findUnique({ where: { id: requestId }, select: { status: true, assignedDriverId: true } });
    if (!r) throw new RequestError('not_found', 'Ariza topilmadi');
    if (r.assignedDriverId) await freeDriver(tx, r.assignedDriverId, requestId);
    return transition(tx, requestId, 'dispatched', { supervisorId, assignedDriverId: null, assignedAt: null });
  });
  await logEvent({ sourceBot: actorSource(actor), eventType: 'request_dispatched', title: `Ariza #${requestId} masulga yo'naltirildi`, message: `${sup.name} ← ${actor.name}`, requestId, supervisorId, pointId: updated.pointId });
  await onDispatched(updated, note);
  return updated;
}

/** Haydovchi bo'shadi: boshqa faol topshirig'i bo'lmasa `active` */
export async function freeDriver(tx: Prisma.TransactionClient | typeof prisma, driverId: number, exceptRequestId?: number): Promise<void> {
  const busy = await tx.recycleRequest.count({
    where: { assignedDriverId: driverId, status: { in: ['assigned', 'en_route', 'arrived', 'collecting'] }, ...(exceptRequestId ? { id: { not: exceptRequestId } } : {}) },
  });
  if (!busy) await tx.driver.updateMany({ where: { id: driverId, status: { in: ['busy', 'on_route'] } }, data: { status: 'active' } });
}

/** Haydovchi tayinlash (masul, admin yoki HQ). Haydovchi faol va shu punkt/masulga tegishli bo'lishi kerak. */
export async function assignDriver(requestId: number, driverId: number, actor: Actor): Promise<RequestWithRefs> {
  const { updated, previous, driver } = await prisma.$transaction(async (tx) => {
    const r = await tx.recycleRequest.findUnique({ where: { id: requestId }, include: { assignedDriver: true } });
    if (!r) throw new RequestError('not_found', 'Ariza topilmadi');
    if (!['new_', 'dispatched', 'assigned'].includes(r.status)) throw new RequestError('status', 'Bu holatda haydovchi tayinlab bo\'lmaydi');
    const d = await tx.driver.findUnique({ where: { id: driverId } });
    if (!d || d.status === 'inactive') throw new RequestError('driver', 'Haydovchi topilmadi yoki faol emas');
    if (actor.kind === 'supervisor' && d.supervisorId !== actor.id && d.pointId !== r.pointId) throw new RequestError('driver', 'Bu haydovchi sizning punktingizga tegishli emas');
    if (r.assignedDriverId === driverId && r.status === 'assigned') return { updated: await transition(tx, requestId, 'assigned'), previous: null as Driver | null, driver: d };
    const previous = r.assignedDriver;
    if (previous && previous.id !== driverId) await freeDriver(tx, previous.id, requestId);
    const supervisorId = r.supervisorId ?? (actor.kind === 'supervisor' ? actor.id : d.supervisorId);
    const updated = await transition(tx, requestId, 'assigned', { assignedDriverId: driverId, supervisorId, ...(supervisorId && !r.dispatchedAt ? { dispatchedAt: new Date() } : {}) });
    await tx.driver.update({ where: { id: driverId }, data: { status: 'busy' } });
    return { updated, previous, driver: d };
  });
  await logEvent({ sourceBot: actorSource(actor), eventType: 'driver_assigned', title: `Ariza #${requestId}: haydovchi tayinlandi`, message: `${driver.name} ← ${actor.name}`, requestId, driverId, supervisorId: updated.supervisorId, pointId: updated.pointId });
  await onAssigned(updated, previous);
  return updated;
}

/** Bekor qilish: faol holatlardan. Mijoz faqat haydovchi yo'lga chiqmagan bo'lsa bekor qila oladi. */
export async function cancelRequest(requestId: number, actor: Actor, reason?: string): Promise<RequestWithRefs> {
  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.recycleRequest.findUnique({ where: { id: requestId }, select: { status: true, assignedDriverId: true } });
    if (!r) throw new RequestError('not_found', 'Ariza topilmadi');
    if (TERMINAL_STATUSES.includes(r.status)) throw new RequestError('status', 'Ariza allaqachon yakunlangan');
    if (actor.kind === 'customer' && !['new_', 'dispatched', 'assigned'].includes(r.status)) throw new RequestError('status', 'Haydovchi yo\'lga chiqqan — bekor qilish uchun operatorga murojaat qiling');
    if (r.assignedDriverId) await freeDriver(tx, r.assignedDriverId, requestId);
    const note = [reason?.trim().slice(0, 300), `Bekor qildi: ${actor.name}`].filter(Boolean).join(' · ');
    return transition(tx, requestId, 'cancelled', { completedNote: note });
  });
  await logEvent({ sourceBot: actorSource(actor), eventType: 'request_cancelled', severity: 'warning', title: `Ariza #${requestId} bekor qilindi`, message: `${actor.name}${reason ? `: ${reason}` : ''}`, requestId, pointId: updated.pointId, supervisorId: updated.supervisorId, driverId: updated.assignedDriverId });
  await onCancelled(updated, reason);
  return updated;
}

/** Mehmon kuzatuv havolasi orqali ariza (token bo'yicha) */
export async function requestByToken(token: string): Promise<(RequestWithRefs & { collections: Prisma.RecycleCollectionGetPayload<object>[] }) | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  return prisma.recycleRequest.findUnique({ where: { accessToken: token }, include: { ...REQUEST_INCLUDE, collections: { orderBy: { id: 'desc' } } } });
}

/** Mijozning arizaga egaligi: token, Telegram ID yoki sayt foydalanuvchisi */
export type Owner = { token: string } | { telegramId: string } | { userId: number };
export function ownsRequest(r: { accessToken: string | null; customerTgId: string | null; userId: number | null }, owner: Owner): boolean {
  if ('token' in owner) return !!owner.token && r.accessToken === owner.token;
  if ('telegramId' in owner) return !!owner.telegramId && r.customerTgId === owner.telegramId;
  return !!owner.userId && r.userId === owner.userId;
}
