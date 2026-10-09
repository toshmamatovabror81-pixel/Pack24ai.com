import 'server-only';
import { prisma } from '@/lib/db';
import { logEvent, markEventProcessed, type EventInput } from '@/lib/recycling/events';

/**
 * Admin panelning O'Z amallari uchun hodisalar: jurnalga yoziladi (tarix/audit), lekin darhol «ko'rilgan» holatda —
 * admin o'zi qilgan ishni RecyclingNav «Hodisalar» hisoblagichida «yangi» deb ko'rmaydi. Botlardan kelgan hodisalar o'zgarmaydi.
 */
export async function adminEvent(input: Omit<EventInput, 'sourceBot'> & { sourceBot?: EventInput['sourceBot'] }) {
  const row = await logEvent({ sourceBot: 'platform', ...input });
  if (row && row.status === 'new_') await markEventProcessed(row.id);
  return row;
}

/** Poydevor funksiyasi (approveAccessRequest, settleWithdrawal va h.k.) admin nomidan yozgan yangi hodisalarni «ko'rilgan» qilish */
export async function markOwnEventsProcessed(where: { entityType?: string; entityId?: number; driverId?: number; eventType: string[] }) {
  await prisma.botEvent
    .updateMany({
      where: { status: 'new_', eventType: { in: where.eventType }, ...(where.entityType ? { entityType: where.entityType } : {}), ...(where.entityId ? { entityId: where.entityId } : {}), ...(where.driverId ? { driverId: where.driverId } : {}), createdAt: { gte: new Date(Date.now() - 60_000) } },
      data: { status: 'processed', processedAt: new Date() },
    })
    .catch(() => undefined);
}
