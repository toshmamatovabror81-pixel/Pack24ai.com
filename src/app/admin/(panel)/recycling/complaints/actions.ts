'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ComplaintStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { text } from '@/lib/formData';
import { onComplaint } from '@/lib/recycling/notifications';
import { REQUEST_INCLUDE } from '@/lib/recycling/requests';
import { esc } from '@/lib/telegram/api';
import { notifyCustomer } from '@/lib/telegram/notify';
import { adminEvent } from '../events/audit';

/** Shikoyatlar: javob (→ resolved, mijozga Telegram), direktorga ko'tarish, holat. Admin amallari hodisalarga «ko'rilgan» holatda yoziladi */

const BASE = '/admin/recycling/complaints';

class ComplaintError extends Error {}

const idOf = (fd: FormData): number => {
  const n = Number(fd.get('id'));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
};

async function run(fd: FormData, fn: (id: number, user: { id: number; name: string }) => Promise<string | void>) {
  const user = await requireStaff('recycling');
  const id = idOf(fd);
  if (!id) redirect(BASE);
  const page = `${BASE}/${id}`;
  let to = `${page}?saved=1`;
  try {
    const flag = await fn(id, user);
    if (flag) to = `${page}?${flag}=1`;
  } catch (e) {
    const msg = e instanceof ComplaintError ? e.message : "Xato yuz berdi. Qayta urinib ko'ring";
    if (!(e instanceof ComplaintError)) console.error('[admin/complaints]', e);
    to = `${page}?error=${encodeURIComponent(msg)}`;
  }
  revalidatePath(BASE);
  revalidatePath(page);
  redirect(to);
}

const load = async (id: number) => {
  const c = await prisma.recycleComplaint.findUnique({ where: { id }, include: { request: { include: REQUEST_INCLUDE } } });
  if (!c) throw new ComplaintError('Shikoyat topilmadi');
  return c;
};

/** Javob: response, respondedBy, status=resolved; mijoz Telegram'da bo'lsa javob matni yuboriladi */
export async function respondComplaintAction(fd: FormData) {
  await run(fd, async (id, user) => {
    const response = text(fd, 'response', 2000);
    if (response.length < 2) throw new ComplaintError('Javob matnini yozing');
    const c = await load(id);
    await prisma.recycleComplaint.update({ where: { id }, data: { response, respondedBy: user.name, status: 'resolved', resolvedAt: new Date() } });
    const sent = c.request.customerTgId ? await notifyCustomer(c.request.customerTgId, `💬 <b>Ariza #${c.requestId} bo'yicha shikoyatingizga javob</b>\n${esc(response)}\n\n— ${esc(user.name)}, Pack24`) : false;
    await adminEvent({ eventType: 'complaint_resolved', severity: sent || !c.request.customerTgId ? 'success' : 'warning', title: `Shikoyat #${id} hal qilindi (ariza #${c.requestId})`, message: `${user.name}: ${response}${sent ? '' : c.request.customerTgId ? ' · mijozga yuborilmadi' : ' · mijoz Telegramda emas'}`, requestId: c.requestId, supervisorId: c.request.supervisorId, driverId: c.request.assignedDriverId, pointId: c.request.pointId });
    // Mijoz Telegramda bor, lekin xabar ketmadi (bot bloklangan / token yo'q) — admin buni ko'rsin
    return sent ? 'sent' : c.request.customerTgId ? 'notsent' : undefined;
  });
}

/** Direktor darajasiga ko'tarish: level=director, masul va HQ adminlarga xabar */
export async function escalateComplaintAction(fd: FormData) {
  await run(fd, async (id, user) => {
    const c = await load(id);
    if (c.level === 'director') throw new ComplaintError("Shikoyat allaqachon direktor darajasida");
    await prisma.recycleComplaint.update({ where: { id }, data: { level: 'director', ...(c.status === 'open' ? { status: 'in_progress' } : {}) } });
    await onComplaint(c.request, 'director', `${c.message}\n\n⬆️ Direktorga ko'tarildi (${user.name}). Shikoyatchi: ${c.fromName}, +${c.fromPhone}`);
    await adminEvent({ eventType: 'complaint_escalated', severity: 'warning', title: `Shikoyat #${id} direktorga ko'tarildi (ariza #${c.requestId})`, message: `${user.name}: ${c.message.slice(0, 300)}`, requestId: c.requestId, supervisorId: c.request.supervisorId, driverId: c.request.assignedDriverId, pointId: c.request.pointId });
    return 'escalated';
  });
}

const STATUSES: ComplaintStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

/** Holatni qo'lda o'zgartirish (ko'rilmoqda / yopish / qayta ochish) */
export async function setComplaintStatusAction(fd: FormData) {
  await run(fd, async (id, user) => {
    const status = STATUSES.find((s) => s === fd.get('status'));
    if (!status) throw new ComplaintError("Holat noto'g'ri");
    const c = await load(id);
    await prisma.recycleComplaint.update({ where: { id }, data: { status, ...(status === 'open' ? { resolvedAt: null } : status === 'resolved' && !c.resolvedAt ? { resolvedAt: new Date(), respondedBy: c.respondedBy ?? user.name } : {}) } });
    await adminEvent({ eventType: 'complaint_status', title: `Shikoyat #${id}: holat → ${status}`, message: user.name, requestId: c.requestId, pointId: c.request.pointId });
  });
}
