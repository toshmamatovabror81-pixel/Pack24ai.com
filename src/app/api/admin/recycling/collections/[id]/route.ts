import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toDecimal, toNumber, type MoneyInput } from '@/lib/money';
import { publishPlatformEvent } from '@/lib/platform/events';
import { RequestValidationError, isPlainObject } from '@/lib/requestValidation';
import { notifyCustomer, notifySalesChats } from '@/lib/telegram/notifier';

async function sendToTelegram(chatId: string, message: string) {
    try {
        if (!chatId) return;
        await notifyCustomer(chatId, message);
    } catch (e) { console.error('[Collection TG]', e); }
}

function readNullableBoolean(value: unknown, fieldName: string): boolean | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') {
        throw new RequestValidationError(`${fieldName} true/false bo'lishi kerak`);
    }
    return value;
}

function readNullableString(value: unknown, fieldName: string): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') {
        throw new RequestValidationError(`${fieldName} matn bo'lishi kerak`);
    }
    return value;
}

async function publishCollectionEvent(params: {
    type: string;
    severity: 'info' | 'success' | 'warning';
    title: string;
    message: string;
    existing: {
        id: number;
        requestId: number;
        driverId: number;
        request: { supervisorId: number | null; pointId: number | null };
    };
    payload: Record<string, unknown>;
}) {
    await publishPlatformEvent({
        source: 'platform',
        type: params.type,
        entityType: 'recycle_collection',
        entityId: params.existing.id,
        severity: params.severity,
        title: params.title,
        message: params.message,
        requestId: params.existing.requestId,
        collectionId: params.existing.id,
        driverId: params.existing.driverId,
        supervisorId: params.existing.request.supervisorId ?? undefined,
        pointId: params.existing.request.pointId ?? undefined,
        payload: params.payload as Prisma.InputJsonValue,
        notifyAdmins: false,
    });
}

// PUT /api/admin/recycling/collections/[id] — yangilash, to'lov
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const collectionId = Number(id);
        if (!Number.isInteger(collectionId) || collectionId <= 0) {
            throw new RequestValidationError('id musbat butun son bo\'lishi kerak');
        }

        const body = await req.json();
        if (!isPlainObject(body)) {
            throw new RequestValidationError('JSON object kutilgan');
        }

        const existing = await prisma.recycleCollection.findUnique({
            where: { id: collectionId },
            include: { request: true, driver: true },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Yig\'ish topilmadi' }, { status: 404 });
        }

        const updateData: Record<string, unknown> = {};
        const customerConfirmed = readNullableBoolean(body.customerConfirmed, 'customerConfirmed');
        const customerComment = readNullableString(body.customerComment, 'customerComment');
        const deliveredToPoint = readNullableBoolean(body.deliveredToPoint, 'deliveredToPoint');
        const paymentStatus = readNullableString(body.paymentStatus, 'paymentStatus');
        const paymentNote = readNullableString(body.paymentNote, 'paymentNote');
        const paidBy = readNullableString(body.paidBy, 'paidBy');
        const notes = readNullableString(body.notes, 'notes');

        // Mijoz tasdiqlashi
        if (customerConfirmed !== undefined) {
            updateData.customerConfirmed = customerConfirmed;
            updateData.customerComment = customerComment || null;

            if (customerConfirmed) {
                // Ariza statusini yangilash
                await prisma.recycleRequest.update({
                    where: { id: existing.requestId },
                    data: { status: 'confirmed', confirmedAt: new Date() },
                });
            } else {
                // Inkor — ariza disputed
                await prisma.recycleRequest.update({
                    where: { id: existing.requestId },
                    data: { status: 'disputed' },
                });
            }

            await publishCollectionEvent({
                type: customerConfirmed ? 'recycling.request.confirmed' : 'recycling.request.disputed',
                severity: customerConfirmed ? 'success' : 'warning',
                title: customerConfirmed ? 'Mijoz yig\'ishni tasdiqladi' : 'Mijoz yig\'ishga e\'tiroz bildirdi',
                message: `Ariza #${existing.requestId} bo'yicha mijoz tasdiqlash holati yangilandi.`,
                existing,
                payload: {
                    customerConfirmed,
                    customerComment: customerComment ?? null,
                },
            });
        }

        // Punkt'ga topshirish
        if (deliveredToPoint !== undefined) {
            updateData.deliveredToPoint = deliveredToPoint;
            if (deliveredToPoint) {
                updateData.deliveredAt = new Date();
            }

            // Masulga va adminga xabar
            if (deliveredToPoint && existing.request.supervisorId) {
                const sup = await prisma.supervisor.findUnique({ where: { id: existing.request.supervisorId } });
                if (sup?.telegramId) {
                    await sendToTelegram(sup.telegramId,
                        `✅ Ariza #${existing.requestId} — yuk bazaga topshirildi\n` +
                        `⚖️ ${existing.actualWeight} kg | 🚚 ${existing.driver.name}`
                    );
                }
            }

            await publishCollectionEvent({
                type: deliveredToPoint ? 'recycling.collection.delivered' : 'recycling.collection.delivery_updated',
                severity: deliveredToPoint ? 'success' : 'info',
                title: deliveredToPoint ? 'Yuk bazaga topshirildi' : 'Topshirish holati yangilandi',
                message: `Ariza #${existing.requestId} bo'yicha topshirish holati yangilandi.`,
                existing,
                payload: {
                    deliveredToPoint,
                },
            });
        }

        // To'lov amalga oshirish
        if (paymentStatus) {
            updateData.paymentStatus = paymentStatus;
            updateData.paymentToDriver = body.paymentToDriver ? toDecimal(body.paymentToDriver as MoneyInput) : null;
            updateData.paymentToCustomer = body.paymentToCustomer ? toDecimal(body.paymentToCustomer as MoneyInput) : null;
            updateData.paymentNote = paymentNote || null;
            updateData.paidBy = paidBy || null;

            if (['paid_to_driver', 'paid_to_customer', 'paid_both', 'completed'].includes(paymentStatus)) {
                updateData.paidAt = new Date();

                // Ariza yakunlash
                await prisma.recycleRequest.update({
                    where: { id: existing.requestId },
                    data: { status: 'completed', completedAt: new Date() },
                });

                // Haydovchiga xabar
                if (existing.driver.telegramId && body.paymentToDriver) {
                    await sendToTelegram(existing.driver.telegramId,
                        `💰 Sizga ${parseFloat(String(body.paymentToDriver)).toLocaleString('ru-RU')} so'm to'landi ✅\n` +
                        `Ariza #${existing.requestId}`
                    );
                }

                // Mijozga xabar
                if (existing.request.customerTgId && body.paymentToCustomer) {
                    await sendToTelegram(existing.request.customerTgId,
                        `💰 Sizga ${parseFloat(String(body.paymentToCustomer)).toLocaleString('ru-RU')} so'm to'landi ✅\n` +
                        `Ariza #${existing.requestId}\n\nRahmat! ♻️`
                    );
                }

                // Adminga xabar
                await notifySalesChats(
                    `✅ Ariza #${existing.requestId} to'liq yakunlandi\n` +
                    `💵 ${toNumber(existing.totalAmount).toLocaleString('ru-RU')} so'm`
                );
            }

            await publishCollectionEvent({
                type: 'recycling.payment.updated',
                severity: ['paid_to_driver', 'paid_to_customer', 'paid_both', 'completed'].includes(paymentStatus) ? 'success' : 'info',
                title: 'To\'lov holati yangilandi',
                message: `Ariza #${existing.requestId} bo'yicha to'lov holati ${paymentStatus} ga o'zgardi.`,
                existing,
                payload: {
                    paymentStatus,
                    paymentToDriver: updateData.paymentToDriver != null ? toNumber(updateData.paymentToDriver as MoneyInput) : null,
                    paymentToCustomer: updateData.paymentToCustomer != null ? toNumber(updateData.paymentToCustomer as MoneyInput) : null,
                    paidBy: paidBy || null,
                },
            });
        }

        // Eslatma
        if (notes !== undefined) updateData.notes = notes;

        const updated = await prisma.recycleCollection.update({
            where: { id: collectionId },
            data: updateData,
            include: { request: { include: { point: true } }, driver: true },
        });

        return NextResponse.json(updated);
    } catch (error) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('[Collection PUT]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
