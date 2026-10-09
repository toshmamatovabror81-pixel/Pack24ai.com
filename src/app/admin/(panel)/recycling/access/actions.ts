'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { optText } from '@/lib/formData';
import { approveAccessRequest, rejectAccessRequest } from '@/lib/recycling/access';
import { StaffError } from '@/lib/recycling/staff';
import { markOwnEventsProcessed } from '../events/audit';

/** Botdan kelgan kirish so'rovlari: tasdiqlash (punkt/masul tanlash bilan) va rad etish */

const BASE = '/admin/recycling/access';

const idOf = (fd: FormData, name: string): number => {
  const n = Number(fd.get(name));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
};

function errMsg(e: unknown): string {
  if (e instanceof StaffError) return e.message;
  console.error('[admin/access]', e);
  return "Xato yuz berdi. Qayta urinib ko'ring";
}

export async function approveAccessAction(fd: FormData) {
  const user = await requireStaff('recycling');
  const id = idOf(fd, 'id');
  const role = fd.get('role') === 'supervisor' ? 'supervisor' : 'driver';
  let to = BASE;
  try {
    if (!id) throw new StaffError('not_found', "So'rov topilmadi");
    const pointId = idOf(fd, 'pointId') || null;
    // Masul so'rovida masul tanlanmaydi; haydovchida bo'sh qoldirilsa punktning birinchi faol masuli biriktiriladi
    const supervisorId = role === 'driver' ? idOf(fd, 'supervisorId') || null : undefined;
    const r = await approveAccessRequest(id, { name: user.name }, { pointId, supervisorId });
    // Adminning o'z amali — hodisa «ko'rilgan» (nav hisoblagichi shishmasin)
    await markOwnEventsProcessed({ entityType: 'BotAccessRequest', entityId: id, eventType: ['access_approved'] });
    const created = r.createdDriverId ? `driver:${r.createdDriverId}` : r.createdSupervisorId ? `supervisor:${r.createdSupervisorId}` : '';
    to = `${BASE}?approved=${encodeURIComponent(created || '1')}`;
  } catch (e) {
    to = `${BASE}?error=${encodeURIComponent(errMsg(e))}`;
  }
  revalidatePath(BASE);
  revalidatePath('/admin/recycling/drivers');
  revalidatePath('/admin/recycling/supervisors');
  redirect(to);
}

export async function rejectAccessAction(fd: FormData) {
  const user = await requireStaff('recycling');
  const id = idOf(fd, 'id');
  let to = `${BASE}?rejected=1`;
  try {
    if (!id) throw new StaffError('not_found', "So'rov topilmadi");
    await rejectAccessRequest(id, { name: user.name }, optText(fd, 'reason', 300) ?? undefined);
    await markOwnEventsProcessed({ entityType: 'BotAccessRequest', entityId: id, eventType: ['access_rejected'] });
  } catch (e) {
    to = `${BASE}?error=${encodeURIComponent(errMsg(e))}`;
  }
  revalidatePath(BASE);
  redirect(to);
}
