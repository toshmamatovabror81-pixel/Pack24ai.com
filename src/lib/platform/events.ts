import { BotEvent } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notifyPack24Admin } from '@/lib/telegram/notifier';
import {
    PlatformEventSeverity,
    PlatformEventSource,
    PublishPlatformEventInput,
} from './contracts';

function sourceLabel(source: PlatformEventSource): string {
    switch (source) {
        case 'customer':
            return 'Customer Bot';
        case 'driver':
            return 'Driver Bot';
        case 'supervisor':
            return 'Supervisor Bot';
        case 'pack24admin':
            return 'Pack24Admin Bot';
        default:
            return 'Platform';
    }
}

function severityIcon(severity: PlatformEventSeverity): string {
    switch (severity) {
        case 'success':
            return '✅';
        case 'warning':
            return '⚠️';
        case 'error':
            return '🚨';
        default:
            return 'ℹ️';
    }
}

export function buildPlatformTelegramAlert(
    event: Pick<
        BotEvent,
        | 'sourceBot'
        | 'severity'
        | 'title'
        | 'message'
        | 'requestId'
        | 'collectionId'
        | 'driverId'
        | 'supervisorId'
        | 'pointId'
    >,
): string {
    const details: string[] = [];

    if (event.requestId) details.push(`📋 Ariza: #${event.requestId}`);
    if (event.collectionId) details.push(`⚖️ Yig'ish: #${event.collectionId}`);
    if (event.driverId) details.push(`🚚 Haydovchi ID: #${event.driverId}`);
    if (event.supervisorId) details.push(`👷 Masul ID: #${event.supervisorId}`);
    if (event.pointId) details.push(`🏭 Baza ID: #${event.pointId}`);

    return [
        `${severityIcon((event.severity as PlatformEventSeverity) ?? 'info')} <b>${event.title}</b>`,
        `🤖 Manba: ${sourceLabel((event.sourceBot as PlatformEventSource) ?? 'platform')}`,
        '',
        event.message,
        details.length > 0 ? `\n${details.join('\n')}` : '',
    ].join('\n').trim();
}

export async function publishPlatformEvent(input: PublishPlatformEventInput): Promise<BotEvent> {
    if (input.dedupeKey) {
        const existing = await prisma.botEvent.findUnique({
            where: { dedupeKey: input.dedupeKey },
        });
        if (existing) {
            return existing;
        }
    }

    const event = await prisma.botEvent.create({
        data: {
            sourceBot: input.source,
            eventType: input.type,
            entityType: input.entityType,
            entityId: input.entityId,
            severity: input.severity ?? 'info',
            title: input.title,
            message: input.message,
            status: input.status ?? 'new',
            dedupeKey: input.dedupeKey,
            payload: input.payload,
            requestId: input.requestId,
            collectionId: input.collectionId,
            supervisorId: input.supervisorId,
            driverId: input.driverId,
            pointId: input.pointId,
            userId: input.userId,
        },
    });

    if (input.notifyAdmins !== false) {
        const hqAdmins = await prisma.telegramHqAdmin.findMany({
            where: {
                isActive: true,
                telegramId: { not: null },
            },
            select: { telegramId: true },
        });

        const alertText = input.telegramText ?? buildPlatformTelegramAlert(event);
        await Promise.all(
            hqAdmins
                .map((row) => row.telegramId)
                .filter((telegramId): telegramId is string => Boolean(telegramId))
                .map((telegramId) => notifyPack24Admin(telegramId, alertText)),
        );
    }

    return event;
}
