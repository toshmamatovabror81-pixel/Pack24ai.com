import 'server-only';
import type { BotAccessRequest, BotAccessRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { esc } from '@/lib/telegram/api';
import { notify, notifyHqAdmins } from '@/lib/telegram/notify';
import { logEvent } from './events';
import { createDriver, createSupervisor, findDriverByPhone, findSupervisorByPhone, phoneDigits, StaffError } from './staff';

/**
 * Botdan kirish so'rovi: noma'lum foydalanuvchi masul yoki haydovchi sifatida kirish so'raydi,
 * HQ admin (bot yoki admin panel) tasdiqlasa yozuv yaratiladi va Telegram darhol bog'lanadi (kod kerak emas).
 */

export async function createAccessRequest(input: {
  role: BotAccessRole;
  name: string;
  phone: string;
  telegramId: string;
  telegramName?: string | null;
  vehicleInfo?: string | null;
  requestedPointId?: number | null;
  requestedSupervisorId?: number | null;
}): Promise<BotAccessRequest & { existing?: boolean }> {
  const name = input.name.trim().slice(0, 100);
  if (name.length < 2) throw new StaffError('name', "Ism kamida 2 ta harf bo'lsin");
  const phone = phoneDigits(input.phone);
  if (!phone) throw new StaffError('phone', "Telefon noto'g'ri");
  const existing = await prisma.botAccessRequest.findFirst({ where: { role: input.role, status: 'pending', OR: [{ telegramId: input.telegramId }, { phone }] } });
  if (existing) {
    // Takroriy so'rov: yangi so'rov ochilmaydi, lekin oxirgi tanlovlar (ism, punkt, mashina) saqlanadi
    const updated = await prisma.botAccessRequest.update({
      where: { id: existing.id },
      data: { name, telegramName: input.telegramName?.slice(0, 100) ?? existing.telegramName, vehicleInfo: input.vehicleInfo?.trim().slice(0, 120) || existing.vehicleInfo, requestedPointId: input.requestedPointId ?? existing.requestedPointId, requestedSupervisorId: input.requestedSupervisorId ?? existing.requestedSupervisorId },
    });
    return Object.assign(updated, { existing: true as const });
  }
  if (input.role === 'supervisor' && (await findSupervisorByPhone(phone))) throw new StaffError('duplicate', "Bu telefon allaqachon masul sifatida ro'yxatda — kod bilan kiring");
  if (input.role === 'driver' && (await findDriverByPhone(phone))) throw new StaffError('duplicate', "Bu telefon allaqachon haydovchi sifatida ro'yxatda — kod bilan kiring");
  const req = await prisma.botAccessRequest.create({
    data: {
      role: input.role, name, phone, telegramId: input.telegramId, telegramName: input.telegramName?.slice(0, 100) ?? null,
      vehicleInfo: input.vehicleInfo?.trim().slice(0, 120) || null,
      requestedPointId: input.requestedPointId ?? null, requestedSupervisorId: input.requestedSupervisorId ?? null,
    },
    include: { requestedPoint: true },
  });
  const roleLabel = input.role === 'driver' ? 'Haydovchi' : 'Masul';
  await logEvent({ sourceBot: input.role, eventType: 'access_requested', severity: 'warning', title: `${roleLabel} kirish so'rovi: ${name}`, message: `${phone}${req.requestedPoint ? ` · ${req.requestedPoint.cityUz}` : ''}`, entityType: 'BotAccessRequest', entityId: req.id, pointId: req.requestedPointId });
  await notifyHqAdmins(
    `📝 <b>Kirish so'rovi — ${roleLabel}</b>\n👤 ${esc(name)}\n📞 +${esc(phone)}${req.requestedPoint ? `\n🏭 ${esc(req.requestedPoint.cityUz)}` : ''}${input.vehicleInfo ? `\n🚚 ${esc(input.vehicleInfo)}` : ''}`,
    [[{ text: '✅ Tasdiqlash', callback_data: `acc_ok_${req.id}` }, { text: '❌ Rad etish', callback_data: `acc_no_${req.id}` }]],
  );
  return req;
}

export const pendingAccessRequests = () => prisma.botAccessRequest.findMany({ where: { status: 'pending' }, include: { requestedPoint: true, requestedSupervisor: true }, orderBy: { createdAt: 'asc' } });

/** Tasdiqlash: masul/haydovchi yaratiladi, Telegram darhol bog'lanadi, so'rovchi o'z boti orqali xabar oladi */
export async function approveAccessRequest(id: number, by: { name: string; hqAdminId?: number | null; supervisorId?: number | null }, overrides: { pointId?: number | null; supervisorId?: number | null } = {}): Promise<BotAccessRequest> {
  const req = await prisma.botAccessRequest.findUnique({ where: { id } });
  if (!req) throw new StaffError('not_found', "So'rov topilmadi");
  if (req.status !== 'pending') throw new StaffError('duplicate', "So'rov allaqachon ko'rib chiqilgan");
  const pointId = overrides.pointId !== undefined ? overrides.pointId : req.requestedPointId;
  const tg = req.telegramId ? { telegramId: req.telegramId, telegramName: req.telegramName, registeredAt: new Date(), registrationCode: null } : {};
  let createdSupervisorId: number | null = null;
  let createdDriverId: number | null = null;
  if (req.role === 'supervisor') {
    const s = await createSupervisor({ name: req.name, phone: req.phone, pointId: pointId ?? null });
    if (req.telegramId) await prisma.supervisor.update({ where: { id: s.id }, data: tg });
    createdSupervisorId = s.id;
  } else {
    let supervisorId = overrides.supervisorId !== undefined ? overrides.supervisorId : req.requestedSupervisorId;
    if (!supervisorId && pointId) supervisorId = (await prisma.supervisor.findFirst({ where: { pointId, isActive: true }, orderBy: { id: 'asc' } }))?.id ?? null;
    const d = await createDriver({ name: req.name, phone: req.phone, pointId: pointId ?? null, supervisorId, vehicleInfo: req.vehicleInfo, invitedBySupervisorId: by.supervisorId ?? null });
    if (req.telegramId) await prisma.driver.update({ where: { id: d.id }, data: tg });
    createdDriverId = d.id;
  }
  const updated = await prisma.botAccessRequest.update({
    where: { id },
    data: { status: 'approved', approvedAt: new Date(), approvedByHqAdminId: by.hqAdminId ?? null, approvedBySupervisorId: by.supervisorId ?? null, createdSupervisorId, createdDriverId },
  });
  await logEvent({ sourceBot: 'pack24admin', eventType: 'access_approved', severity: 'success', title: `Kirish so'rovi tasdiqlandi: ${req.name}`, message: `${req.role} · ${by.name}`, entityType: 'BotAccessRequest', entityId: id, supervisorId: createdSupervisorId, driverId: createdDriverId, pointId });
  if (req.telegramId) {
    await notify(req.role === 'driver' ? 'driver' : 'supervisor', req.telegramId, "✅ <b>So'rovingiz tasdiqlandi!</b> Botdan foydalanish uchun /start bosing.");
  }
  return updated;
}

export async function rejectAccessRequest(id: number, by: { name: string; hqAdminId?: number | null }, reason?: string): Promise<BotAccessRequest> {
  const req = await prisma.botAccessRequest.findUnique({ where: { id } });
  if (!req) throw new StaffError('not_found', "So'rov topilmadi");
  if (req.status !== 'pending') throw new StaffError('duplicate', "So'rov allaqachon ko'rib chiqilgan");
  const updated = await prisma.botAccessRequest.update({ where: { id }, data: { status: 'rejected', rejectedAt: new Date(), rejectReason: reason?.trim().slice(0, 300) || null, approvedByHqAdminId: by.hqAdminId ?? null } });
  await logEvent({ sourceBot: 'pack24admin', eventType: 'access_rejected', severity: 'warning', title: `Kirish so'rovi rad etildi: ${req.name}`, message: `${req.role} · ${by.name}${reason ? `: ${reason}` : ''}`, entityType: 'BotAccessRequest', entityId: id });
  if (req.telegramId) await notify(req.role === 'driver' ? 'driver' : 'supervisor', req.telegramId, `❌ So'rovingiz rad etildi.${reason ? ` Sabab: ${esc(reason)}` : ''}`);
  return updated;
}
