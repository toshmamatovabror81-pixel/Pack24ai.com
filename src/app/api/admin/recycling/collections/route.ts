import { NextRequest, NextResponse } from 'next/server';
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

// Yordamchi
async function sendToTelegram(chatId: string, message: string) {
    try {
        if (!chatId) return;
        await notifyCustomer(chatId, message);
    } catch (e) { console.error('[Collections TG]', e); }
}

function fmtMoney(n: number) {
    return n.toLocaleString('ru-RU');
}

// GET /api/admin/recycling/collections — Yig'ishlar ro'yxati
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const driverId = searchParams.get('driverId');
        const requestId = searchParams.get('requestId');
        const paymentStatus = searchParams.get('paymentStatus');
        const period = parseInt(searchParams.get('period') ?? '90');

        const from = new Date();
        from.setDate(from.getDate() - period);

        const where: Record<string, unknown> = {
            createdAt: { gte: from },
        };
        if (driverId) where.driverId = Number(driverId);
        if (requestId) where.requestId = Number(requestId);
        if (paymentStatus) {
            if (!isRecycleCollectionPaymentStatus(paymentStatus)) {
                return NextResponse.json({ error: 'paymentStatus noto\'g\'ri' }, { status: 400 });
            }
            where.paymentStatus = paymentStatus;
        }

        const collections = await prisma.recycleCollection.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                request: { include: { point: true } },
                driver: true,
            },
        });
        return NextResponse.json(collections);
    } catch (error) {
        console.error('[Collections GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// POST /api/admin/recycling/collections — Yangi yig'ish hisob yaratish (kalkulator)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const normalizedInput = normalizeCreateCollectionInput(body as Record<string, unknown>);
        if (!normalizedInput.ok) {
            return NextResponse.json({ error: normalizedInput.error }, { status: 400 });
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
            });

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
                        totalRecycledWeight: {
                            increment: effectiveWeight,
                        },
                        ecoPoints: {
                            increment: ecoPoints,
                        },
                    },
                });
            }

            return createdCollection;
        });

        // Mijozga Telegram xabar (ixtiyoriy)
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

        // Masulga xabar
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


        // Adminga xabar
        await notifySalesChats(
            `📦 Yig'ish #${collection.id} yaratildi\n` +
            `Ariza #${request.id} | ${actualWeight} kg | ${fmtMoney(totalAmount)} so'm`
        );

        return NextResponse.json(collection, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'COLLECTION_ALREADY_EXISTS') {
            return NextResponse.json(
                { error: 'Bu ariza uchun yig\'ish hisobi allaqachon yaratilgan' },
                { status: 409 }
            );
        }

        if (error instanceof Error && error.message === 'REQUEST_NOT_FOUND') {
            return NextResponse.json(
                { error: 'Ariza topilmadi' },
                { status: 404 }
            );
        }

        if (error instanceof Error && error.message === 'INVALID_REQUEST_STATUS') {
            return NextResponse.json(
                { error: 'Ariza holati yig\'ish yaratish uchun mos emas' },
                { status: 409 }
            );
        }

        console.error('[Collections POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
