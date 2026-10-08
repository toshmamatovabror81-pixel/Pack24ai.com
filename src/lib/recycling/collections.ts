import 'server-only';
import { Prisma, type MaterialType, type RecycleCollection } from '@prisma/client';
import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/format';
import { logEvent } from './events';
import { onCollected, onCompleted, onCustomerDecision, onPaymentRecorded, type RequestWithRefs } from './notifications';
import { actorSource, freeDriver, ownsRequest, REQUEST_INCLUDE, RequestError, transition, type Actor, type Owner } from './requests';

/**
 * Tortish va hisob-kitob. Narx HAR DOIM punktning pricePerKg dan olinadi (haydovchi narxni o'zgartira olmaydi).
 * effectiveWeight = actualWeight − actualWeight × chegirma%; totalAmount = effectiveWeight × narx.
 * Haydovchi daromadi = actualWeight × punkt.driverRatePerKg (DriverTransaction, type=earning).
 * Bitta arizaga bitta hisob: qayta tortilsa (disputed) mavjud yozuv yangilanadi.
 */

export type CalcInput = { actualWeight: number; discountPercent?: number; pricePerKg: number };
export function calcCollection(i: CalcInput): { effectiveWeight: number; totalAmount: number; discountPercent: number } {
  const w = Math.max(0, Number(i.actualWeight) || 0);
  const d = Math.min(100, Math.max(0, Number(i.discountPercent) || 0));
  const effectiveWeight = Math.round(w * (1 - d / 100) * 100) / 100;
  const totalAmount = Math.round(effectiveWeight * (Number(i.pricePerKg) || 0));
  return { effectiveWeight, totalAmount, discountPercent: d };
}

export type WeighInput = {
  requestId: number;
  actualWeight: number;
  discountPercent?: number;
  discountReason?: string | null;
  materialType?: MaterialType | null;
  notes?: string | null;
  actor: Actor;
};

/** Haydovchi (yoki masul/admin uning nomidan) tortish natijasini kiritadi → ariza `collected` */
export async function recordWeighing(input: WeighInput): Promise<{ request: RequestWithRefs; collection: RecycleCollection }> {
  const weight = Math.round((Number(input.actualWeight) || 0) * 100) / 100;
  if (!(weight > 0) || weight > 100_000) throw new RequestError('status', "Og'irlik 0 dan katta bo'lsin");
  const result = await prisma.$transaction(async (tx) => {
    const r = await tx.recycleRequest.findUnique({ where: { id: input.requestId }, include: { ...REQUEST_INCLUDE, collections: true } });
    if (!r) throw new RequestError('not_found', 'Ariza topilmadi');
    if (!['arrived', 'collecting', 'collected', 'disputed'].includes(r.status)) throw new RequestError('status', 'Bu holatda tortish kiritib bo\'lmaydi');
    if (input.actor.kind === 'driver' && r.assignedDriverId !== input.actor.id) throw new RequestError('driver', 'Bu topshiriq sizga tegishli emas');
    if (!r.assignedDriverId) throw new RequestError('driver', 'Arizaga haydovchi tayinlanmagan');
    const pricePerKg = toNumber(r.point.pricePerKg);
    const calc = calcCollection({ actualWeight: weight, discountPercent: input.discountPercent, pricePerKg });
    const data = {
      driverId: r.assignedDriverId,
      actualWeight: weight,
      discountPercent: calc.discountPercent,
      effectiveWeight: calc.effectiveWeight,
      pricePerKg,
      totalAmount: calc.totalAmount,
      discountReason: input.discountReason?.trim().slice(0, 200) || null,
      materialType: input.materialType ?? r.material ?? null,
      notes: input.notes?.trim().slice(0, 500) || null,
      customerConfirmed: null,
      customerComment: null,
      collectedAt: new Date(),
    };
    const existing = r.collections[0];
    const collection = existing
      ? await tx.recycleCollection.update({ where: { id: existing.id }, data })
      : await tx.recycleCollection.create({ data: { ...data, requestId: r.id } });
    // Haydovchi daromadi: punkt stavkasi × haqiqiy og'irlik
    const earning = Math.round(weight * toNumber(r.point.driverRatePerKg));
    const prevTx = await tx.driverTransaction.findFirst({ where: { collectionId: collection.id, type: 'earning' } });
    if (prevTx) await tx.driverTransaction.update({ where: { id: prevTx.id }, data: { amount: earning, driverId: r.assignedDriverId } });
    else if (earning > 0) await tx.driverTransaction.create({ data: { driverId: r.assignedDriverId, type: 'earning', amount: earning, status: 'completed', collectionId: collection.id, description: `Ariza #${r.id}: ${weight} kg` } });
    const request = r.status === 'collected' ? await tx.recycleRequest.update({ where: { id: r.id }, data: { collectedAt: new Date() }, include: REQUEST_INCLUDE }) : await transition(tx, r.id, 'collected');
    return { request, collection };
  });
  await logEvent({ sourceBot: actorSource(input.actor), eventType: 'weighed', severity: 'success', title: `Ariza #${input.requestId} tortildi`, message: `${weight} kg → ${result.collection.totalAmount} so'm (${input.actor.name})`, requestId: input.requestId, collectionId: result.collection.id, driverId: result.collection.driverId, supervisorId: result.request.supervisorId, pointId: result.request.pointId });
  await onCollected(result.request, result.collection);
  return result;
}

/** Mijoz bazaga o'zi olib kelgan (pickupType=base): masul tortadi, jurnalga qabul yozuvi tushadi, ariza yakunlanadi */
export async function acceptAtBase(input: { requestId: number; weightKg: number; pricePerKg?: number | null; note?: string | null; actor: Actor; supervisorId: number }): Promise<RequestWithRefs> {
  const weight = Math.round((Number(input.weightKg) || 0) * 100) / 100;
  if (!(weight > 0)) throw new RequestError('status', "Og'irlik 0 dan katta bo'lsin");
  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.recycleRequest.findUnique({ where: { id: input.requestId }, include: REQUEST_INCLUDE });
    if (!r) throw new RequestError('not_found', 'Ariza topilmadi');
    if (['completed', 'cancelled'].includes(r.status)) throw new RequestError('status', 'Ariza allaqachon yakunlangan');
    const price = input.pricePerKg && input.pricePerKg > 0 ? input.pricePerKg : toNumber(r.point.pricePerKg);
    const total = Math.round(weight * price);
    await tx.recycleManualIntake.create({ data: { supervisorId: input.supervisorId, pointId: r.pointId, date: new Date(), weightKg: weight, pricePerKg: price, totalAmount: total, note: `Ariza #${r.id}, ${r.name}${input.note ? ` — ${input.note.slice(0, 200)}` : ''}` } });
    if (r.assignedDriverId) await freeDriver(tx, r.assignedDriverId, r.id);
    // Holat jadvalidan o'tish: faol holatlar → collected → completed
    const toCollected = ['new_', 'dispatched', 'assigned', 'en_route', 'arrived', 'collecting', 'disputed'].includes(r.status);
    const mid = toCollected ? await tx.recycleRequest.update({ where: { id: r.id }, data: { status: 'collected', collectedAt: new Date() } }) : r;
    void mid;
    return transition(tx, r.id, 'completed', { completedNote: `Bazada qabul qilindi: ${weight} kg × ${price} = ${total} so'm (${input.actor.name})` });
  });
  await logEvent({ sourceBot: actorSource(input.actor), eventType: 'accepted_at_base', severity: 'success', title: `Ariza #${input.requestId} bazada qabul qilindi`, message: `${weight} kg (${input.actor.name})`, requestId: input.requestId, supervisorId: input.supervisorId, pointId: updated.pointId });
  await onCompleted(updated, null);
  return updated;
}

/** Mijoz tasdiqlashi / inkor qilishi — egalik tekshiriladi */
export async function customerDecision(requestId: number, owner: Owner, confirmed: boolean, comment?: string): Promise<RequestWithRefs> {
  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.recycleRequest.findUnique({ where: { id: requestId }, include: { collections: true } });
    if (!r) throw new RequestError('not_found', 'Ariza topilmadi');
    if (!ownsRequest(r, owner)) throw new RequestError('not_found', 'Ariza topilmadi');
    if (r.status !== 'collected') throw new RequestError('status', 'Hozir tasdiqlash mumkin emas');
    const c = r.collections[0];
    if (c) await tx.recycleCollection.update({ where: { id: c.id }, data: { customerConfirmed: confirmed, customerComment: comment?.trim().slice(0, 500) || null } });
    if (!confirmed) {
      await tx.recycleComplaint.create({ data: { requestId, fromPhone: r.phone, fromName: r.name, level: 'supervisor', message: comment?.trim().slice(0, 1000) || 'Mijoz tortish natijasiga rozi emas' } });
    }
    return transition(tx, requestId, confirmed ? 'confirmed' : 'disputed');
  });
  await logEvent({ sourceBot: 'customer', eventType: confirmed ? 'customer_confirmed' : 'customer_disputed', severity: confirmed ? 'success' : 'warning', title: `Ariza #${requestId}: mijoz ${confirmed ? 'tasdiqladi' : 'rozi emas'}`, message: comment ?? '', requestId, supervisorId: updated.supervisorId, driverId: updated.assignedDriverId, pointId: updated.pointId, notifyHq: !confirmed });
  await onCustomerDecision(updated, confirmed, comment);
  return updated;
}

export type PaymentInput = { collectionId: number; paymentToCustomer?: number | null; paymentToDriver?: number | null; note?: string | null; actor: Actor };

/** Masul to'lovni belgilaydi → ariza `completed`, haydovchi bo'shaydi */
export async function recordPayment(input: PaymentInput): Promise<{ request: RequestWithRefs; collection: RecycleCollection }> {
  const toCustomer = input.paymentToCustomer != null && input.paymentToCustomer >= 0 ? Math.round(input.paymentToCustomer) : null;
  const toDriver = input.paymentToDriver != null && input.paymentToDriver >= 0 ? Math.round(input.paymentToDriver) : null;
  const result = await prisma.$transaction(async (tx) => {
    const c = await tx.recycleCollection.findUnique({ where: { id: input.collectionId }, include: { request: true } });
    if (!c) throw new RequestError('not_found', 'Hisob topilmadi');
    if (input.actor.kind === 'supervisor' && c.request.supervisorId !== input.actor.id) throw new RequestError('supervisor', 'Bu ariza sizning punktingizga tegishli emas');
    if (!['collected', 'confirmed', 'disputed', 'completed'].includes(c.request.status)) throw new RequestError('status', 'Avval tortish kiritilishi kerak');
    const paymentStatus: RecycleCollection['paymentStatus'] = toCustomer != null && toDriver != null ? 'paid_both' : toDriver != null ? 'paid_to_driver' : toCustomer != null ? 'paid_to_customer' : 'completed';
    const collection = await tx.recycleCollection.update({
      where: { id: c.id },
      data: { paymentStatus, paymentToCustomer: toCustomer, paymentToDriver: toDriver, paymentNote: input.note?.trim().slice(0, 300) || null, paidAt: new Date(), paidBy: input.actor.name, deliveredToPoint: true, deliveredAt: c.deliveredAt ?? new Date() },
    });
    const request = c.request.status === 'completed'
      ? await tx.recycleRequest.findUniqueOrThrow({ where: { id: c.requestId }, include: REQUEST_INCLUDE })
      : await transition(tx, c.requestId, 'completed', { completedNote: `To'landi: mijozga ${toCustomer ?? 0}, haydovchiga ${toDriver ?? 0} (${input.actor.name})` });
    await freeDriver(tx, c.driverId, c.requestId);
    return { request, collection };
  });
  await logEvent({ sourceBot: actorSource(input.actor), eventType: 'payment_recorded', severity: 'success', title: `Ariza #${result.request.id} yakunlandi`, message: `Mijozga ${toCustomer ?? 0}, haydovchiga ${toDriver ?? 0} so'm (${input.actor.name})`, requestId: result.request.id, collectionId: result.collection.id, driverId: result.collection.driverId, supervisorId: result.request.supervisorId, pointId: result.request.pointId });
  await onPaymentRecorded(result.request, result.collection);
  await onCompleted(result.request, result.collection);
  return result;
}

/** Admin: hisobni to'g'rilash (og'irlik/chegirma) — narx punktdan qayta olinmaydi, mavjud narx saqlanadi */
export async function adminFixCollection(collectionId: number, patch: { actualWeight?: number; discountPercent?: number; discountReason?: string | null; notes?: string | null }, actor: Actor): Promise<RecycleCollection> {
  const c = await prisma.recycleCollection.findUnique({ where: { id: collectionId }, include: { request: { include: { point: true } } } });
  if (!c) throw new RequestError('not_found', 'Hisob topilmadi');
  const calc = calcCollection({ actualWeight: patch.actualWeight ?? c.actualWeight, discountPercent: patch.discountPercent ?? c.discountPercent, pricePerKg: toNumber(c.pricePerKg) });
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.recycleCollection.update({ where: { id: collectionId }, data: { actualWeight: patch.actualWeight ?? c.actualWeight, discountPercent: calc.discountPercent, effectiveWeight: calc.effectiveWeight, totalAmount: calc.totalAmount, discountReason: patch.discountReason === undefined ? c.discountReason : patch.discountReason, notes: patch.notes === undefined ? c.notes : patch.notes } });
    const earning = Math.round(u.actualWeight * toNumber(c.request.point.driverRatePerKg));
    await tx.driverTransaction.updateMany({ where: { collectionId, type: 'earning' }, data: { amount: earning } });
    return u;
  });
  await logEvent({ sourceBot: 'platform', eventType: 'collection_fixed', severity: 'warning', title: `Hisob #${collectionId} to'g'rilandi`, message: `${actor.name}: ${updated.actualWeight} kg, ${calc.totalAmount} so'm`, requestId: c.requestId, collectionId, driverId: c.driverId });
  return updated;
}

export const decimalToNumber = (v: Prisma.Decimal | number | null | undefined) => toNumber(v as number);
