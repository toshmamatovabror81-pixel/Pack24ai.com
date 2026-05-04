import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishPlatformEvent } from '@/lib/platform/events';
import {
    readEnum,
    readJsonObject,
    readNumber,
    readOptionalNumber,
    readOptionalString,
    RequestValidationError,
} from '@/lib/requestValidation';
import { notifyCustomer, notifySalesChats } from '@/lib/telegram/notifier';

const DISPATCH_ACTIONS = [
    'dispatch_to_supervisor',
    'assign_driver',
    'driver_en_route',
    'driver_arrived',
    'start_collecting',
    'mark_completed',
    'cancel_request',
] as const;

function buildDispatchEventMeta(action: (typeof DISPATCH_ACTIONS)[number]) {
    switch (action) {
        case 'dispatch_to_supervisor':
            return {
                type: 'recycling.request.dispatched',
                severity: 'info' as const,
                title: 'Ariza masulga yo\'naltirildi',
            };
        case 'assign_driver':
            return {
                type: 'recycling.driver.assigned',
                severity: 'info' as const,
                title: 'Arizaga haydovchi biriktirildi',
            };
        case 'driver_en_route':
            return {
                type: 'recycling.driver.en_route',
                severity: 'info' as const,
                title: 'Haydovchi yo\'lga chiqdi',
            };
        case 'driver_arrived':
            return {
                type: 'recycling.driver.arrived',
                severity: 'info' as const,
                title: 'Haydovchi manzilga yetib keldi',
            };
        case 'start_collecting':
            return {
                type: 'recycling.collection.started',
                severity: 'info' as const,
                title: 'Yig\'ish jarayoni boshlandi',
            };
        case 'mark_completed':
            return {
                type: 'recycling.request.completed',
                severity: 'success' as const,
                title: 'Ariza yakunlandi',
            };
        case 'cancel_request':
            return {
                type: 'recycling.request.cancelled',
                severity: 'warning' as const,
                title: 'Ariza bekor qilindi',
            };
    }
}

async function publishDispatchEvent(params: {
    action: (typeof DISPATCH_ACTIONS)[number];
    requestId: number;
    status: string;
    supervisorId?: number | null;
    driverId?: number | null;
    pointId?: number | null;
    note?: string | null;
}) {
    const meta = buildDispatchEventMeta(params.action);
    await publishPlatformEvent({
        source: 'platform',
        type: meta.type,
        entityType: 'recycle_request',
        entityId: params.requestId,
        severity: meta.severity,
        title: meta.title,
        message: `Ariza #${params.requestId} holati ${params.status} ga o'zgardi.`,
        requestId: params.requestId,
        supervisorId: params.supervisorId ?? undefined,
        driverId: params.driverId ?? undefined,
        pointId: params.pointId ?? undefined,
        payload: {
            action: params.action,
            status: params.status,
            note: params.note ?? null,
        },
        notifyAdmins: false,
    });
}

// ─── Yordamchi: Telegram xabar yuborish (shaxsiy chat_id ga) ─────────────────
async function sendToTelegram(chatId: string, message: string, extra?: Record<string, unknown>) {
    try {
        if (!chatId) return false;
        await notifyCustomer(chatId, message, extra as { parse_mode?: 'HTML' | 'Markdown'; reply_markup?: unknown } | undefined);
        return true;
    } catch (e) {
        console.error('[Dispatch TG]', e);
    }
    return false;
}

// POST /api/admin/recycling/dispatch — Dispetcherlash amallari
export async function POST(req: NextRequest) {
    try {
        const body = await readJsonObject(req);
        const action = readEnum(body.action, 'action', DISPATCH_ACTIONS);
        const requestId = readNumber(body.requestId, 'requestId');
        const supervisorId = readOptionalNumber(body.supervisorId, 'supervisorId');
        const driverId = readOptionalNumber(body.driverId, 'driverId');
        const note = readOptionalString(body.note, 'note');

        if (!Number.isInteger(requestId) || requestId <= 0) {
            throw new RequestValidationError('requestId musbat butun son bo\'lishi kerak');
        }

        const request = await prisma.recycleRequest.findUnique({
            where: { id: requestId },
            include: { point: true },
        });

        if (!request) {
            return NextResponse.json({ error: 'Ariza topilmadi' }, { status: 404 });
        }

        // ─── ACTION: Admin → Masulga yo'naltirish ────────────────────────
        if (action === 'dispatch_to_supervisor') {
            if (!supervisorId) {
                return NextResponse.json({ error: 'supervisorId majburiy' }, { status: 400 });
            }

            const supervisor = await prisma.supervisor.findUnique({ where: { id: supervisorId } });
            if (!supervisor) {
                return NextResponse.json({ error: 'Masul topilmadi' }, { status: 404 });
            }

            const updated = await prisma.recycleRequest.update({
                where: { id: requestId },
                data: {
                    supervisorId: supervisor.id,
                    status: 'dispatched',
                    dispatchedAt: new Date(),
                },
                include: { point: true },
            });

            // Masulga Telegram xabar — inline tugmalar bilan
            if (supervisor.telegramId) {
                const pickupLabel = request.pickupType === 'pickup' ? '🚛 Kuryer chiqishi' : '🏭 O\'zi olib keladi';
                const msg =
                    `📋 <b>Yangi ariza yo'naltirildi #${request.id}</b>\n\n` +
                    `👤 Mijoz: ${request.name}\n` +
                    `📞 Tel: ${request.phone}\n` +
                    `📍 Hudud: ${request.point?.regionUz || ''}\n` +
                    `${request.address ? `🏠 Manzil: ${request.address}\n` : ''}` +
                    `📦 Material: ${request.material || 'Ko\'rsatilmagan'}\n` +
                    `⚖️ Taxminiy: ${request.volume ? request.volume + ' kg' : 'Noma\'lum'}\n` +
                    `🚚 Usul: ${pickupLabel}\n\n` +
                    `👇 Haydovchi tayinlash uchun tugmani bosing:`;

                // Hududdagi haydovchilar ro'yxatini olish
                const drivers = await prisma.driver.findMany({
                    where: { supervisorId: supervisor.id, status: 'active' },
                    orderBy: [{ isOnline: 'desc' }, { name: 'asc' }],
                    take: 8,
                });

                const keyboard = drivers.length > 0
                    ? [
                        ...drivers.map(d => [{
                            text: `${d.isOnline ? '🟢' : '⚫'} ${d.name}`,
                            callback_data: `assign_${request.id}_${d.id}`,
                        }]),
                        [{ text: '📋 Batafsil ko\'rish', callback_data: `view_req_${request.id}` }],
                    ]
                    : [[{ text: '📋 Batafsil ko\'rish', callback_data: `view_req_${request.id}` }]];

                await sendToTelegram(supervisor.telegramId, msg, {
                    reply_markup: { inline_keyboard: keyboard },
                });
            }

            // Adminga Telegram xabar
            await notifySalesChats(
                `📤 Ariza #${request.id} → <b>${supervisor.name}</b> ga yo'naltirildi`
            );
            await publishDispatchEvent({
                action,
                requestId: updated.id,
                status: updated.status,
                supervisorId: updated.supervisorId,
                driverId: updated.assignedDriverId,
                pointId: updated.regionId,
            });

            return NextResponse.json(updated);
        }

        // ─── ACTION: Masul → Haydovchiga tayinlash ───────────────────────
        if (action === 'assign_driver') {
            if (!driverId) {
                return NextResponse.json({ error: 'driverId majburiy' }, { status: 400 });
            }

            const driver = await prisma.driver.findUnique({ where: { id: driverId } });
            if (!driver) {
                return NextResponse.json({ error: 'Haydovchi topilmadi' }, { status: 404 });
            }

            const updated = await prisma.recycleRequest.update({
                where: { id: requestId },
                data: {
                    assignedDriverId: driver.id,
                    status: 'assigned',
                    assignedAt: new Date(),
                },
                include: { point: true, assignedDriver: true },
            });

            // Haydovchiga Telegram xabar — inline tugmalar bilan
            if (driver.telegramId) {
                const msg =
                    `🚚 <b>Yangi ish tayinlandi! #${request.id}</b>\n\n` +
                    `👤 Mijoz: ${request.name}\n` +
                    `📞 Tel: ${request.phone}\n` +
                    `📍 Hudud: ${request.point?.regionUz || ''}\n` +
                    `${request.address ? `🏠 Manzil: ${request.address}\n` : ''}` +
                    `📦 Material: ${request.material || 'Noma\'lum'}\n` +
                    `⚖️ Taxminiy: ${request.volume ? request.volume + ' kg' : 'Noma\'lum'}\n\n` +
                    `Qabul qilasizmi?`;
                await sendToTelegram(driver.telegramId, msg, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Qabul — yo\'lga chiqaman', callback_data: `enroute_${request.id}` }],
                            [{ text: '❌ Rad etish', callback_data: `reject_${request.id}` }],
                        ],
                    },
                });
            }

            await publishDispatchEvent({
                action,
                requestId: updated.id,
                status: updated.status,
                supervisorId: updated.supervisorId,
                driverId: updated.assignedDriverId,
                pointId: updated.regionId,
            });
            return NextResponse.json(updated);
        }

        // ─── ACTION: Haydovchi yo'lga chiqdi ─────────────────────────────
        if (action === 'driver_en_route') {
            const updated = await prisma.recycleRequest.update({
                where: { id: requestId },
                data: {
                    status: 'en_route',
                    driverEnRouteAt: new Date(),
                },
                include: { assignedDriver: true, point: true },
            });

            // Mijozga xabar (Telegram bo'lsa)
            if (request.customerTgId) {
                await sendToTelegram(
                    request.customerTgId,
                    `🚚 <b>Haydovchi yo'lga chiqdi!</b>\n\n` +
                    `Ariza #${request.id}\n` +
                    `Haydovchi: ${updated.assignedDriver?.name || 'Noma\'lum'}\n` +
                    `Tez orada yetib boradi!`
                );
            }

            // Masulga xabar
            if (request.supervisorId) {
                const sup = await prisma.supervisor.findUnique({ where: { id: request.supervisorId } });
                if (sup?.telegramId) {
                    await sendToTelegram(sup.telegramId,
                        `🚚 Ariza #${request.id} — haydovchi yo'lga chiqdi`
                    );
                }
            }

            await publishDispatchEvent({
                action,
                requestId: updated.id,
                status: updated.status,
                supervisorId: request.supervisorId,
                driverId: updated.assignedDriverId,
                pointId: updated.regionId,
            });
            return NextResponse.json(updated);
        }

        // ─── ACTION: Haydovchi yetib keldi ───────────────────────────────
        if (action === 'driver_arrived') {
            const updated = await prisma.recycleRequest.update({
                where: { id: requestId },
                data: {
                    status: 'arrived',
                    driverArrivedAt: new Date(),
                },
                include: { assignedDriver: true },
            });

            // Mijozga xabar
            if (request.customerTgId) {
                await sendToTelegram(
                    request.customerTgId,
                    `📍 <b>Haydovchi yetib keldi!</b>\n\n` +
                    `Ariza #${request.id}\n` +
                    `Iltimos, chiqing! Haydovchi sizni kutmoqda.`
                );
            }

            // Masulga xabar
            if (request.supervisorId) {
                const sup = await prisma.supervisor.findUnique({ where: { id: request.supervisorId } });
                if (sup?.telegramId) {
                    await sendToTelegram(sup.telegramId,
                        `📍 Ariza #${request.id} — haydovchi yetib bordi\n` +
                        `👤 Mijoz: ${request.name} | 📞 ${request.phone}`
                    );
                }
            }

            await publishDispatchEvent({
                action,
                requestId: updated.id,
                status: updated.status,
                supervisorId: request.supervisorId,
                driverId: updated.assignedDriverId,
                pointId: request.regionId,
            });
            return NextResponse.json(updated);
        }

        // ─── ACTION: Yuk yig'ish boshlandi ───────────────────────────────
        if (action === 'start_collecting') {
            const updated = await prisma.recycleRequest.update({
                where: { id: requestId },
                data: { status: 'collecting' },
            });
            await publishDispatchEvent({
                action,
                requestId: updated.id,
                status: updated.status,
                supervisorId: updated.supervisorId,
                driverId: updated.assignedDriverId,
                pointId: updated.regionId,
            });
            return NextResponse.json(updated);
        }

        // ─── ACTION: Arizani yakunlash (confirmed → completed) ──────────
        if (action === 'mark_completed') {
            const updated = await prisma.recycleRequest.update({
                where: { id: requestId },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                    completedNote: note ?? null,
                },
                include: { assignedDriver: true, supervisor: true },
            });

            // Haydovchini bo'shatish
            if (updated.assignedDriverId) {
                await prisma.driver.update({
                    where: { id: updated.assignedDriverId },
                    data: { status: 'active' },
                });
            }

            // Mijozga xabar
            if (request.customerTgId) {
                await sendToTelegram(
                    request.customerTgId,
                    `🟢 <b>Ariza #${request.id} to'liq yakunlandi!</b>\n\n` +
                    `Rahmat! Makulatura muvaffaqiyatli qabul qilindi.\n` +
                    `Qayta murojaat qilish uchun /ariza yuboring! ♻️`
                );
            }

            // Masulga xabar
            if (updated.supervisor?.telegramId) {
                await sendToTelegram(updated.supervisor.telegramId,
                    `🟢 Ariza #${request.id} — <b>TO'LIQ YAKUNLANDI</b> ✅`
                );
            }

            // Admin guruhga
            await notifySalesChats(
                `🟢 Ariza #${request.id} yakunlandi — ${request.name} | ${request.volume ? request.volume + ' kg' : ''}`
            );
            await publishDispatchEvent({
                action,
                requestId: updated.id,
                status: updated.status,
                supervisorId: updated.supervisorId,
                driverId: updated.assignedDriverId,
                pointId: updated.regionId,
                note,
            });

            return NextResponse.json(updated);
        }

        // ─── ACTION: Arizani bekor qilish ───────────────────────────────
        if (action === 'cancel_request') {
            const updated = await prisma.recycleRequest.update({
                where: { id: requestId },
                data: {
                    status: 'cancelled',
                    completedNote: note || 'Bekor qilindi',
                },
            });

            // Haydovchini bo'shatish
            if (request.assignedDriverId) {
                await prisma.driver.update({
                    where: { id: request.assignedDriverId },
                    data: { status: 'active' },
                });
            }

            // Mijozga xabar
            if (request.customerTgId) {
                await sendToTelegram(
                    request.customerTgId,
                    `🔴 <b>Ariza #${request.id} bekor qilindi.</b>\n\n` +
                    `${note ? `Sabab: ${note}\n\n` : ''}` +
                    `Savollar uchun: /help`
                );
            }

            await publishDispatchEvent({
                action,
                requestId: updated.id,
                status: updated.status,
                supervisorId: updated.supervisorId,
                driverId: updated.assignedDriverId,
                pointId: updated.regionId,
                note,
            });
            return NextResponse.json(updated);
        }

        return NextResponse.json({ error: 'Noto\'g\'ri action' }, { status: 400 });
    } catch (error) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('[Dispatch POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
