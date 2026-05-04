import { BotEvent, Prisma } from '@prisma/client';
import {
    PlatformEventSeverity as BotEventSeverity,
    PlatformEventSource as BotEventSource,
    PlatformEventStatus as BotEventStatus,
} from '@/lib/platform/contracts';
import { publishPlatformEvent } from '@/lib/platform/events';

export interface CreateBotEventInput {
    sourceBot: BotEventSource;
    eventType: string;
    entityType?: string;
    entityId?: number;
    severity?: BotEventSeverity;
    title: string;
    message: string;
    status?: BotEventStatus;
    dedupeKey?: string;
    payload?: Prisma.InputJsonValue;
    requestId?: number;
    collectionId?: number;
    supervisorId?: number;
    driverId?: number;
    pointId?: number;
    userId?: number;
    notifyAdmins?: boolean;
    telegramText?: string;
}

export async function createBotEvent(input: CreateBotEventInput): Promise<BotEvent> {
    return publishPlatformEvent({
        source: input.sourceBot,
        type: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        severity: input.severity,
        title: input.title,
        message: input.message,
        status: input.status,
        dedupeKey: input.dedupeKey,
        payload: input.payload,
        requestId: input.requestId,
        collectionId: input.collectionId,
        supervisorId: input.supervisorId,
        driverId: input.driverId,
        pointId: input.pointId,
        userId: input.userId,
        notifyAdmins: input.notifyAdmins,
        telegramText: input.telegramText,
    });
}
