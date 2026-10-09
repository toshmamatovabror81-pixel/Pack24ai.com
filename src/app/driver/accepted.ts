import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Qabul belgisi. Poydevor (acceptTask) holatni o'zgartirmaydi, lekin BotEvent'ga
 * dedupeKey = driver_accepted:<ariza>:<haydovchi> yozadi — shundan o'qiymiz.
 * Rad etilib qayta tayinlangan arizada (assignedAt yangi) eski belgi hisobga olinmaydi.
 */
export async function acceptedTaskIds(driverId: number, tasks: { id: number; status: string; assignedAt: Date | null }[]): Promise<Set<number>> {
  const pending = tasks.filter((t) => t.status === 'assigned');
  const out = new Set<number>();
  if (pending.length === 0) return out;
  const events = await prisma.botEvent.findMany({
    where: { dedupeKey: { in: pending.map((t) => `driver_accepted:${t.id}:${driverId}`) } },
    select: { dedupeKey: true, createdAt: true },
  });
  const assignedAt = new Map(pending.map((t) => [t.id, t.assignedAt]));
  for (const e of events) {
    const id = Number(e.dedupeKey?.split(':')[1]);
    if (!assignedAt.has(id)) continue;
    const at = assignedAt.get(id);
    if (!at || e.createdAt >= at) out.add(id);
  }
  return out;
}

export async function isTaskAccepted(driverId: number, requestId: number): Promise<boolean> {
  const r = await prisma.recycleRequest.findFirst({ where: { id: requestId, assignedDriverId: driverId }, select: { id: true, status: true, assignedAt: true } });
  if (!r) return false;
  return (await acceptedTaskIds(driverId, [r])).has(requestId);
}
