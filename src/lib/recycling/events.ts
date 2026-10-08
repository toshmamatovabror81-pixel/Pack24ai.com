import 'server-only';
import { Prisma, type BotEvent, type BotEventSource, type EventSeverity } from '@prisma/client';
import { prisma } from '@/lib/db';
import { esc } from '@/lib/telegram/api';
import { notifyHqAdmins } from '@/lib/telegram/notify';

export type EventInput = {
  sourceBot: BotEventSource;
  eventType: string;
  title: string;
  message: string;
  severity?: EventSeverity;
  entityType?: string;
  entityId?: number;
  requestId?: number | null;
  collectionId?: number | null;
  supervisorId?: number | null;
  driverId?: number | null;
  pointId?: number | null;
  userId?: number | null;
  payload?: Prisma.InputJsonValue;
  /** Berilsa bir xil kalitli hodisa ikki marta yozilmaydi */
  dedupeKey?: string;
  /** HQ adminlarga (HQ boti) ham yuborilsinmi */
  notifyHq?: boolean;
};

/** Hodisalar jurnali (admin /admin/recycling/events + HQ boti). Xato bo'lsa biznes jarayonni to'xtatmaydi. */
export async function logEvent(input: EventInput): Promise<BotEvent | null> {
  const data = {
    sourceBot: input.sourceBot,
    eventType: input.eventType.slice(0, 60),
    title: input.title.slice(0, 200),
    message: input.message.slice(0, 2000),
    severity: input.severity ?? 'info',
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    requestId: input.requestId ?? null,
    collectionId: input.collectionId ?? null,
    supervisorId: input.supervisorId ?? null,
    driverId: input.driverId ?? null,
    pointId: input.pointId ?? null,
    userId: input.userId ?? null,
    payload: input.payload ?? Prisma.JsonNull,
  };
  let row: BotEvent | null = null;
  try {
    if (input.dedupeKey) {
      const existing = await prisma.botEvent.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return existing;
      row = await prisma.botEvent.create({ data: { ...data, dedupeKey: input.dedupeKey } });
    } else {
      row = await prisma.botEvent.create({ data });
    }
  } catch (e) {
    console.error('[events] yozilmadi', e instanceof Error ? e.message : e);
  }
  if (input.notifyHq) {
    const icon = input.severity === 'error' ? '🚨' : input.severity === 'warning' ? '⚠️' : input.severity === 'success' ? '✅' : 'ℹ️';
    await notifyHqAdmins(`${icon} <b>${esc(input.title)}</b>\n${esc(input.message)}`);
  }
  return row;
}

export async function markEventProcessed(id: number): Promise<void> {
  await prisma.botEvent.update({ where: { id }, data: { status: 'processed', processedAt: new Date() } }).catch(() => undefined);
}

export const newEventCount = () => prisma.botEvent.count({ where: { status: 'new_' } }).catch(() => 0);
