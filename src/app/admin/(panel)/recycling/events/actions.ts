'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { BotEventSource, EventSeverity, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { text } from '@/lib/formData';
import { markEventProcessed } from '@/lib/recycling/events';
import { eventsUrl, parseEventFilters } from './filters';

/** Hodisalar: bittasini yoki filtrga mos hammasini «ko'rildi» qilish */

const BASE = '/admin/recycling/events';

function filtersOf(fd: FormData) {
  return parseEventFilters({ status: text(fd, 'status', 20), source: text(fd, 'source', 20), severity: text(fd, 'severity', 20), q: text(fd, 'q', 100), page: text(fd, 'page', 6) });
}

export async function markEventAction(fd: FormData) {
  await requireStaff('recycling');
  const id = Number(fd.get('id'));
  if (Number.isSafeInteger(id) && id > 0) await markEventProcessed(id);
  revalidatePath(BASE);
  redirect(eventsUrl(filtersOf(fd)));
}

export async function markAllEventsAction(fd: FormData) {
  await requireStaff('recycling');
  const f = filtersOf(fd);
  const where: Prisma.BotEventWhereInput = { status: 'new_' };
  if (f.source) where.sourceBot = f.source as BotEventSource;
  if (f.severity) where.severity = f.severity as EventSeverity;
  if (f.q) where.OR = [{ title: { contains: f.q, mode: 'insensitive' } }, { message: { contains: f.q, mode: 'insensitive' } }, { eventType: { contains: f.q, mode: 'insensitive' } }];
  const res = await prisma.botEvent.updateMany({ where, data: { status: 'processed', processedAt: new Date() } }).catch(() => ({ count: 0 }));
  revalidatePath(BASE);
  redirect(eventsUrl({ ...f, page: 1 }, { done: String(res.count) }));
}
