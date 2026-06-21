import { prisma } from '@/lib/prisma';
import { createBotEvent } from '@/lib/telegram/botEvents';

export interface PaymentApprovalResult {
    collection: {
        id: number;
        requestId: number;
        totalAmount: number;
        driverId: number | null;
    };
    request: {
        id: number;
        customerTgId: string | null;
        customerLang: string | null;
    };
}

/**
 * Approve payment for a recycle collection.
 *
 * - Marks collection payment as 'completed'
 * - Marks the parent request as 'completed'
 * - Releases the driver back to 'active' status
 * - Creates a bot event recording the payment
 *
 * Returns collection and request data as plain objects.
 * Does NOT send Telegram messages or format UI text.
 */
export async function approveCollectionPayment(
    collectionId: number,
    approverName: string,
    supervisorId: number,
): Promise<PaymentApprovalResult | null> {
    const collection = await prisma.recycleCollection.findUnique({
        where: { id: collectionId },
        include: { request: true, driver: true },
    });

    if (!collection) {
        return null;
    }

    await prisma.recycleCollection.update({
        where: { id: collectionId },
        data: {
            paymentStatus: 'completed',
            paidAt: new Date(),
            paidBy: approverName,
        },
    });

    await prisma.recycleRequest.update({
        where: { id: collection.requestId },
        data: { status: 'completed', completedAt: new Date() },
    });

    if (collection.driverId) {
        await prisma.driver.update({
            where: { id: collection.driverId },
            data: { status: 'active' },
        });
    }

    await createBotEvent({
        sourceBot: 'supervisor',
        eventType: 'payment.completed',
        entityType: 'recycle_collection',
        entityId: collectionId,
        severity: 'success',
        title: 'To\'lov tasdiqlandi',
        message:
            `${approverName} ariza #${collection.requestId} bo'yicha ` +
            `${Math.round(collection.totalAmount)} so'm to'lovni tasdiqladi.`,
        requestId: collection.requestId,
        collectionId: collection.id,
        driverId: collection.driverId,
        supervisorId,
    });

    return {
        collection: {
            id: collection.id,
            requestId: collection.requestId,
            totalAmount: collection.totalAmount,
            driverId: collection.driverId,
        },
        request: {
            id: collection.request.id,
            customerTgId: collection.request.customerTgId,
            customerLang: collection.request.customerLang,
        },
    };
}
