import { prisma } from '@/lib/prisma';
import { publishPlatformEvent } from '@/lib/platform/events';
import { notifyCustomer, notifySalesChats } from '@/lib/telegram/notifier';

export const DISPATCH_ACTIONS = [
    'dispatch_to_supervisor',
    'assign_driver',
    'driver_en_route',
    'driver_arrived',
    'start_collecting',
    'mark_completed',
    'cancel_request',
] as const;

export type DispatchAction = (typeof DISPATCH_ACTIONS)[number];

function buildDispatchEventMeta(action: DispatchAction) {
    switch (action) {
        case 'dispatch_to_supervisor':
            return { type: 'recycling.request.dispatched', severity: 'info' as const, title: 'Ariza masulga yo\'naltirildi' };
        case 'assign_driver':
            return { type: 'recycling.driver.assigned', severity: 'info' as const, title: 'Arizaga haydovchi biriktirildi' };
        case 'driver_en_route':
            return { type: 'recycling.driver.en_route', severity: 'info' as const, title: 'Haydovchi yo\'lga chiqdi' };
        case 'driver_arrived':
            return { type: 'recycling.driver.arrived', severity: 'info' as const, title: 'Haydovchi manzilga yetib keldi' };
        case 'start_collecting':
            return { type: 'recycling.collection.started', severity: 'info' as const, title: 'Yig\'ish jarayoni boshlandi' };
        case 'mark_completed':
            return { type: 'recycling.request.completed', severity: 'success' as const, title: 'Ariza yakunlandi' };
        case 'cancel_request':
            return { type: 'recycling.request.cancelled', severity: 'warning' as const, title: 'Ariza bekor qilindi' };
    }
}

async function publishDispatchEvent(params: {
    action: DispatchAction;
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

async function sendToTelegram(chatId: string, message: string, extra?: Record<string, unknown>) {
    try {
        if (!chatId) return false;
        await notifyCustomer(chatId, message, extra as Record<string, unknown>);
        return true;
    } catch (e) {
        console.error('[Dispatch TG]', e);
    }
    return false;
}

export async function dispatchToSupervisor(requestId: number, supervisorId: number) {
    const request = await prisma.recycleRequest.findUnique({ where: { id: requestId }, include: { point: true } });
    if (!request) throw new Error('REQUEST_NOT_FOUND');

    const supervisor = await prisma.supervisor.findUnique({ where: { id: supervisorId } });
    if (!supervisor) throw new Error('SUPERVISOR_NOT_FOUND');

    const updated = await prisma.recycleRequest.update({
        where: { id: requestId },
        data: {
            supervisorId: supervisor.id,
            status: 'dispatched',
            dispatchedAt: new Date(),
        },
        include: { point: true },
    });

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

        await sendToTelegram(supervisor.telegramId, msg, { reply_markup: { inline_keyboard: keyboard } });
    }

    await notifySalesChats(`📤 Ariza #${request.id} → <b>${supervisor.name}</b> ga yo'naltirildi`);
    await publishDispatchEvent({
        action: 'dispatch_to_supervisor',
        requestId: updated.id,
        status: updated.status,
        supervisorId: updated.supervisorId,
        driverId: updated.assignedDriverId,
        pointId: updated.pointId,
    });

    return updated;
}

export async function assignDriver(requestId: number, driverId: number) {
    const request = await prisma.recycleRequest.findUnique({ where: { id: requestId }, include: { point: true } });
    if (!request) throw new Error('REQUEST_NOT_FOUND');

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new Error('DRIVER_NOT_FOUND');

    const updated = await prisma.recycleRequest.update({
        where: { id: requestId },
        data: {
            assignedDriverId: driver.id,
            status: 'assigned',
            assignedAt: new Date(),
        },
        include: { point: true, assignedDriver: true },
    });

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
        action: 'assign_driver',
        requestId: updated.id,
        status: updated.status,
        supervisorId: updated.supervisorId,
        driverId: updated.assignedDriverId,
        pointId: updated.pointId,
    });
    return updated;
}

export async function driverEnRoute(requestId: number) {
    const request = await prisma.recycleRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('REQUEST_NOT_FOUND');

    const updated = await prisma.recycleRequest.update({
        where: { id: requestId },
        data: {
            status: 'en_route',
            driverEnRouteAt: new Date(),
        },
        include: { assignedDriver: true, point: true },
    });

    if (request.customerTgId) {
        await sendToTelegram(
            request.customerTgId,
            `🚚 <b>Haydovchi yo'lga chiqdi!</b>\n\n` +
            `Ariza #${request.id}\n` +
            `Haydovchi: ${updated.assignedDriver?.name || 'Noma\'lum'}\n` +
            `Tez orada yetib boradi!`
        );
    }

    if (request.supervisorId) {
        const sup = await prisma.supervisor.findUnique({ where: { id: request.supervisorId } });
        if (sup?.telegramId) {
            await sendToTelegram(sup.telegramId, `🚚 Ariza #${request.id} — haydovchi yo'lga chiqdi`);
        }
    }

    await publishDispatchEvent({
        action: 'driver_en_route',
        requestId: updated.id,
        status: updated.status,
        supervisorId: request.supervisorId,
        driverId: updated.assignedDriverId,
        pointId: updated.pointId,
    });
    return updated;
}

export async function driverArrived(requestId: number) {
    const request = await prisma.recycleRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('REQUEST_NOT_FOUND');

    const updated = await prisma.recycleRequest.update({
        where: { id: requestId },
        data: {
            status: 'arrived',
            driverArrivedAt: new Date(),
        },
        include: { assignedDriver: true },
    });

    if (request.customerTgId) {
        await sendToTelegram(
            request.customerTgId,
            `📍 <b>Haydovchi yetib keldi!</b>\n\n` +
            `Ariza #${request.id}\n` +
            `Iltimos, chiqing! Haydovchi sizni kutmoqda.`
        );
    }

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
        action: 'driver_arrived',
        requestId: updated.id,
        status: updated.status,
        supervisorId: request.supervisorId,
        driverId: updated.assignedDriverId,
        pointId: request.pointId,
    });
    return updated;
}

export async function startCollecting(requestId: number) {
    const updated = await prisma.recycleRequest.update({
        where: { id: requestId },
        data: { status: 'collecting' },
    });
    await publishDispatchEvent({
        action: 'start_collecting',
        requestId: updated.id,
        status: updated.status,
        supervisorId: updated.supervisorId,
        driverId: updated.assignedDriverId,
        pointId: updated.pointId,
    });
    return updated;
}

export async function markCompleted(requestId: number, note?: string) {
    const request = await prisma.recycleRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('REQUEST_NOT_FOUND');

    const updated = await prisma.recycleRequest.update({
        where: { id: requestId },
        data: {
            status: 'completed',
            completedAt: new Date(),
            completedNote: note ?? null,
        },
        include: { assignedDriver: true, supervisor: true },
    });

    if (updated.assignedDriverId) {
        await prisma.driver.update({
            where: { id: updated.assignedDriverId },
            data: { status: 'active' },
        });
    }

    if (request.customerTgId) {
        await sendToTelegram(
            request.customerTgId,
            `🟢 <b>Ariza #${request.id} to'liq yakunlandi!</b>\n\n` +
            `Rahmat! Makulatura muvaffaqiyatli qabul qilindi.\n` +
            `Qayta murojaat qilish uchun /ariza yuboring! ♻️`
        );
    }

    if (updated.supervisor?.telegramId) {
        await sendToTelegram(updated.supervisor.telegramId, `🟢 Ariza #${request.id} — <b>TO'LIQ YAKUNLANDI</b> ✅`);
    }

    await notifySalesChats(`🟢 Ariza #${request.id} yakunlandi — ${request.name} | ${request.volume ? request.volume + ' kg' : ''}`);
    
    await publishDispatchEvent({
        action: 'mark_completed',
        requestId: updated.id,
        status: updated.status,
        supervisorId: updated.supervisorId,
        driverId: updated.assignedDriverId,
        pointId: updated.pointId,
        note,
    });

    return updated;
}

export async function cancelRequest(requestId: number, note?: string) {
    const request = await prisma.recycleRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('REQUEST_NOT_FOUND');

    const updated = await prisma.recycleRequest.update({
        where: { id: requestId },
        data: {
            status: 'cancelled',
            completedNote: note || 'Bekor qilindi',
        },
    });

    if (request.assignedDriverId) {
        await prisma.driver.update({
            where: { id: request.assignedDriverId },
            data: { status: 'active' },
        });
    }

    if (request.customerTgId) {
        await sendToTelegram(
            request.customerTgId,
            `🔴 <b>Ariza #${request.id} bekor qilindi.</b>\n\n` +
            `${note ? `Sabab: ${note}\n\n` : ''}` +
            `Savollar uchun: /help`
        );
    }

    await publishDispatchEvent({
        action: 'cancel_request',
        requestId: updated.id,
        status: updated.status,
        supervisorId: updated.supervisorId,
        driverId: updated.assignedDriverId,
        pointId: updated.pointId,
        note,
    });
    return updated;
}
