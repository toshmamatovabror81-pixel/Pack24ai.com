import 'server-only';
import { prisma } from '@/lib/db';
import { logEvent } from './events';
import { onDriverAccepted, onDriverProgress, onDriverRejected, type RequestWithRefs } from './notifications';
import { freeDriver, REQUEST_INCLUDE, RequestError, transition } from './requests';
import { DRIVER_TASK_STATUSES } from './statuses';

/** Haydovchi tomonidan bajariladigan qadamlar. Har birida ariza aynan shu haydovchiga tayinlanganligi tekshiriladi. */

async function ownTask(requestId: number, driverId: number) {
  const r = await prisma.recycleRequest.findUnique({ where: { id: requestId }, include: REQUEST_INCLUDE });
  if (!r) throw new RequestError('not_found', 'Ariza topilmadi');
  if (r.assignedDriverId !== driverId) throw new RequestError('driver', 'Bu topshiriq sizga tegishli emas');
  return r;
}

export async function driverTasks(driverId: number): Promise<RequestWithRefs[]> {
  return prisma.recycleRequest.findMany({ where: { assignedDriverId: driverId, status: { in: DRIVER_TASK_STATUSES } }, include: REQUEST_INCLUDE, orderBy: { assignedAt: 'asc' } });
}

export async function driverHistory(driverId: number, limit = 30): Promise<RequestWithRefs[]> {
  return prisma.recycleRequest.findMany({ where: { assignedDriverId: driverId, status: { in: ['collected', 'confirmed', 'disputed', 'completed'] } }, include: REQUEST_INCLUDE, orderBy: { updatedAt: 'desc' }, take: limit });
}

/** Qabul qilish: holat `assigned` ligicha qoladi, masulga xabar boradi */
export async function acceptTask(requestId: number, driverId: number): Promise<RequestWithRefs> {
  const r = await ownTask(requestId, driverId);
  if (r.status !== 'assigned') throw new RequestError('status', 'Topshiriq allaqachon boshlangan');
  await logEvent({ sourceBot: 'driver', eventType: 'driver_accepted', title: `Ariza #${r.id}: haydovchi qabul qildi`, message: r.assignedDriver?.name ?? '', requestId: r.id, driverId, supervisorId: r.supervisorId, pointId: r.pointId, dedupeKey: `driver_accepted:${r.id}:${driverId}` });
  await onDriverAccepted(r);
  return r;
}

/** Rad etish: ariza masulga (dispatched) yoki navbatga (new_) qaytadi, haydovchi bo'shaydi */
export async function rejectTask(requestId: number, driverId: number, reason?: string): Promise<RequestWithRefs> {
  const { updated, driver } = await prisma.$transaction(async (tx) => {
    const r = await tx.recycleRequest.findUnique({ where: { id: requestId }, include: { assignedDriver: true } });
    if (!r) throw new RequestError('not_found', 'Ariza topilmadi');
    if (r.assignedDriverId !== driverId || !r.assignedDriver) throw new RequestError('driver', 'Bu topshiriq sizga tegishli emas');
    if (!['assigned', 'en_route'].includes(r.status)) throw new RequestError('status', 'Bu bosqichda rad etib bo\'lmaydi');
    const updated = await transition(tx, requestId, r.supervisorId ? 'dispatched' : 'new_', { assignedDriverId: null, assignedAt: null, driverEnRouteAt: null });
    await freeDriver(tx, driverId, requestId);
    return { updated, driver: r.assignedDriver };
  });
  await logEvent({ sourceBot: 'driver', eventType: 'driver_rejected', severity: 'warning', title: `Ariza #${requestId}: haydovchi rad etdi`, message: `${driver.name}${reason ? `: ${reason}` : ''}`, requestId, driverId, supervisorId: updated.supervisorId, pointId: updated.pointId, notifyHq: !updated.supervisorId });
  await onDriverRejected(updated, driver, reason);
  return updated;
}

export async function startEnRoute(requestId: number, driverId: number): Promise<RequestWithRefs> {
  await ownTask(requestId, driverId);
  const updated = await prisma.$transaction(async (tx) => {
    const u = await transition(tx, requestId, 'en_route');
    await tx.driver.update({ where: { id: driverId }, data: { status: 'on_route', isOnline: true, lastSeenAt: new Date() } });
    return u;
  });
  await logEvent({ sourceBot: 'driver', eventType: 'driver_en_route', title: `Ariza #${requestId}: haydovchi yo'lga chiqdi`, message: updated.assignedDriver?.name ?? '', requestId, driverId, supervisorId: updated.supervisorId, pointId: updated.pointId });
  await onDriverProgress(updated);
  return updated;
}

export async function markArrived(requestId: number, driverId: number): Promise<RequestWithRefs> {
  await ownTask(requestId, driverId);
  const updated = await transition(prisma, requestId, 'arrived');
  await logEvent({ sourceBot: 'driver', eventType: 'driver_arrived', title: `Ariza #${requestId}: haydovchi yetib keldi`, message: updated.assignedDriver?.name ?? '', requestId, driverId, supervisorId: updated.supervisorId, pointId: updated.pointId });
  await onDriverProgress(updated);
  return updated;
}

export async function startCollecting(requestId: number, driverId: number): Promise<RequestWithRefs> {
  await ownTask(requestId, driverId);
  return transition(prisma, requestId, 'collecting');
}

export async function updateDriverLocation(driverId: number, lat: number, lng: number): Promise<void> {
  await prisma.driver.update({ where: { id: driverId }, data: { lastLat: lat, lastLng: lng, lastSeenAt: new Date(), isOnline: true } });
}

export async function setDriverOnline(driverId: number, online: boolean): Promise<void> {
  await prisma.driver.update({ where: { id: driverId }, data: { isOnline: online, lastSeenAt: new Date() } });
}
