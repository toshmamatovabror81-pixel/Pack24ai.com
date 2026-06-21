import { prisma } from '@/lib/prisma';
import { createBotEvent } from '@/lib/telegram/botEvents';

export interface DriverAssignmentResult {
    request: {
        id: number;
        name: string;
        phone: string;
        volumeSize: string | null;
        photoUrl: string | null;
        createdAt: Date;
        customerTgId: string | null;
        customerLang: string | null;
        point: { id: number; regionUz: string } | null;
    };
    driver: {
        id: number;
        name: string;
        phone: string;
        telegramId: string | null;
    };
}

/**
 * Assign a driver to a recycle request.
 *
 * - Updates the request status to 'assigned' with the given driver
 * - Sets the driver status to 'busy'
 * - Creates a bot event recording the assignment
 *
 * Returns the updated request and driver data as plain objects.
 * Does NOT send Telegram messages or format UI text.
 */
export async function assignDriverToRequest(
    requestId: number,
    driverId: number,
    supervisorId: number,
    supervisorName: string,
): Promise<DriverAssignmentResult | null> {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    const request = await prisma.recycleRequest.findUnique({
        where: { id: requestId },
        include: { point: true },
    });

    if (!driver || !request) {
        return null;
    }

    await prisma.recycleRequest.update({
        where: { id: requestId },
        data: {
            assignedDriverId: driverId,
            assignedAt: new Date(),
            status: 'assigned',
            supervisorId,
            dispatchedAt: new Date(),
        },
    });

    await prisma.driver.update({
        where: { id: driverId },
        data: { status: 'busy' },
    });

    await createBotEvent({
        sourceBot: 'supervisor',
        eventType: 'request.assigned',
        entityType: 'recycle_request',
        entityId: requestId,
        severity: 'success',
        title: 'Haydovchi tayinlandi',
        message: `${supervisorName} ariza #${requestId} uchun ${driver.name} ni tayinladi.`,
        requestId,
        driverId,
        supervisorId,
        pointId: request.point?.id ?? request.regionId,
    });

    return {
        request: {
            id: request.id,
            name: request.name,
            phone: request.phone,
            volumeSize: request.volumeSize,
            photoUrl: request.photoUrl,
            createdAt: request.createdAt,
            customerTgId: request.customerTgId,
            customerLang: request.customerLang,
            point: request.point
                ? { id: request.point.id, regionUz: request.point.regionUz }
                : null,
        },
        driver: {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            telegramId: driver.telegramId,
        },
    };
}
