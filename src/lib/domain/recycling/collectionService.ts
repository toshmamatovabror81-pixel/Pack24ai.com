import { prisma } from '@/lib/prisma';
import {
    calculateCollectionAmounts,
    normalizeCreateCollectionInput,
} from '@/lib/domain/recycling/collections';
import {
    canTransitionRecycleRequestStatus,
    isRecycleCollectionPaymentStatus,
    type RecycleRequestStatus,
} from '@/lib/domain/recycling/statuses';
import { notifyCustomer, notifySalesChats } from '@/lib/telegram/notifier';

function fmtMoney(n: number) {
    return n.toLocaleString('ru-RU');
}

async function sendToTelegram(chatId: string, message: string) {
    try {
        if (!chatId) return;
        await notifyCustomer(chatId, message);
    } catch (e) {
        console.error('[Collections TG]', e);
    }
}

export async function createRecycleCollection(body: Record<string, unknown>) {
    const normalizedInput = normalizeCreateCollectionInput(body);
    if (!normalizedInput.ok) {
        throw new Error(`VALIDATION_ERROR: ${normalizedInput.error}`);
    }

    const {
        requestId,
        driverId,
        actualWeight,
        discountPercent,
        pricePerKg,
        materialType,
        notes,
        discountReason,
    } = normalizedInput.data;

    const {
        effectiveWeight,
        totalAmount,
        ecoPoints,
    } = calculateCollectionAmounts(actualWeight, discountPercent, pricePerKg);

    const collection = await prisma.$transaction(async (tx) => {
        const existingCollection = await tx.recycleCollection.findFirst({
            where: { requestId },
            select: { id: true },
        });

        if (existingCollection) {
            throw new Error('COLLECTION_ALREADY_EXISTS');
        }

        const request = await tx.recycleRequest.findUnique({
            where: { id: requestId },
            select: { id: true, status: true, userId: true },
        });

        if (!request) {
            throw new Error('REQUEST_NOT_FOUND');
        }

        if (!canTransitionRecycleRequestStatus(request.status as RecycleRequestStatus, 'collected')) {
            throw new Error('INVALID_REQUEST_STATUS');
        }

        const createdCollection = await tx.recycleCollection.create({
            data: {
                requestId,
                driverId,
                actualWeight,
                discountPercent,
                effectiveWeight,
                pricePerKg,
                totalAmount,
                discountReason: discountReason || null,
                materialType: materialType || null,
                notes: notes || null,
                collectedAt: new Date(),
            },
            include: {
                request: { include: { point: true } },
                driver: true,
            },
        }) as Awaited<ReturnType<typeof tx.recycleCollection.create>> & {
            request: { id: number; customerTgId: string | null; supervisorId: number | null } & Record<string, unknown>;
            driver: { name: string } & Record<string, unknown>;
        };

        const updatedRequest = await tx.recycleRequest.update({
            where: { id: requestId },
            data: {
                status: 'collected',
                collectedAt: new Date(),
            },
            select: { userId: true },
        });

        if (updatedRequest.userId) {
            await tx.user.update({
                where: { id: updatedRequest.userId },
                data: {
                    totalRecycledWeight: { increment: effectiveWeight },
                    ecoPoints: { increment: ecoPoints },
                },
            });
        }

        return createdCollection;
    });

    const request = collection.request;
    if (request.customerTgId) {
        const msg =
            `📦 <b>Makulatura yig'ildi! #${request.id}</b>\n\n` +
            `⚖️ Og'irlik: <b>${actualWeight} kg</b>\n` +
            `${discountPercent > 0 ? `🏷️ Chegirma: <b>${discountPercent}%</b> (${discountReason || 'sifat'})\n` : ''}` +
            `${discountPercent > 0 ? `📊 Hisoblangan og'irlik: <b>${effectiveWeight.toFixed(1)} kg</b>\n` : ''}` +
            `💰 Narx: <b>${fmtMoney(pricePerKg)} so'm/kg</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `💵 <b>Jami: ${fmtMoney(totalAmount)} so'm</b>\n\n` +
            `Ma'lumotlar to'g'rimi?\n` +
            `✅ Tasdiqlash yoki ❌ Inkor qilish`;
        await sendToTelegram(request.customerTgId, msg);
    }

    if (request.supervisorId) {
        const sup = await prisma.supervisor.findUnique({ where: { id: request.supervisorId } });
        if (sup?.telegramId) {
            await sendToTelegram(sup.telegramId,
                `📦 Ariza #${request.id} — yuk yig'ildi\n` +
                `⚖️ ${actualWeight} kg | 💵 ${fmtMoney(totalAmount)} so'm\n` +
                `🚚 Haydovchi: ${collection.driver.name}`
            );
        }
    }

    await notifySalesChats(
        `📦 Yig'ish #${collection.id} yaratildi\n` +
        `Ariza #${request.id} | ${actualWeight} kg | ${fmtMoney(totalAmount)} so'm`
    );

    return collection;
}

export async function getRecycleCollections(params: {
    driverId?: string | null;
    requestId?: string | null;
    paymentStatus?: string | null;
    period?: number;
}) {
    const { driverId, requestId, paymentStatus, period = 90 } = params;
    
    const from = new Date();
    from.setDate(from.getDate() - period);

    const where: Record<string, unknown> = {
        createdAt: { gte: from },
    };
    
    if (driverId) where.driverId = Number(driverId);
    if (requestId) where.requestId = Number(requestId);
    if (paymentStatus) {
        if (!isRecycleCollectionPaymentStatus(paymentStatus)) {
            throw new Error('INVALID_PAYMENT_STATUS');
        }
        where.paymentStatus = paymentStatus;
    }

    return prisma.recycleCollection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            request: { include: { point: true } },
            driver: true,
        },
    });
}
