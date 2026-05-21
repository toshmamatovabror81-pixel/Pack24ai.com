import { prisma } from '@/lib/prisma';
import { publishPlatformEvent } from '@/lib/platform/events';
import { getLevelByWeight, calcEcoPoints } from '@/lib/eco/levels';
import { calcEcoImpact } from '@/lib/eco/co2Calculator';
import { checkAndAwardBadges } from '@/lib/eco/achievements';
import { notifyDriver } from '@/lib/telegram/notifier';

function getRequestStatusEventMeta(status: string) {
    switch (status) {
        case 'dispatched': return { type: 'recycling.request.dispatched', severity: 'info' as const, title: 'Ariza dispatch qilindi' };
        case 'assigned': return { type: 'recycling.driver.assigned', severity: 'info' as const, title: 'Arizaga haydovchi tayinlandi' };
        case 'en_route': return { type: 'recycling.driver.en_route', severity: 'info' as const, title: 'Haydovchi yo\'lga chiqdi' };
        case 'arrived': return { type: 'recycling.driver.arrived', severity: 'info' as const, title: 'Haydovchi yetib keldi' };
        case 'collected': return { type: 'recycling.collection.collected', severity: 'info' as const, title: 'Yig\'ish bajarildi' };
        case 'confirmed': return { type: 'recycling.request.confirmed', severity: 'success' as const, title: 'Ariza tasdiqlandi' };
        case 'completed': return { type: 'recycling.request.completed', severity: 'success' as const, title: 'Ariza yakunlandi' };
        case 'disputed': return { type: 'recycling.request.disputed', severity: 'warning' as const, title: 'Ariza bo\'yicha e\'tiroz tushdi' };
        case 'cancelled': return { type: 'recycling.request.cancelled', severity: 'warning' as const, title: 'Ariza bekor qilindi' };
        default: return { type: 'recycling.request.status_updated', severity: 'info' as const, title: 'Ariza statusi yangilandi' };
    }
}

export async function updateRecycleRequest(
    requestId: number,
    data: {
        status?: string | null;
        supervisorId?: number | null;
        assignedDriverId?: number | null;
        address?: string | null;
        customerTgId?: string | null;
        completedNote?: string | null;
    }
) {
    const updateData: Record<string, unknown> = {};

    if (data.status) updateData.status = data.status;
    if (data.supervisorId !== undefined) updateData.supervisorId = data.supervisorId;
    if (data.assignedDriverId !== undefined) updateData.assignedDriverId = data.assignedDriverId;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.customerTgId !== undefined) updateData.customerTgId = data.customerTgId;
    if (data.completedNote !== undefined) updateData.completedNote = data.completedNote;

    if (data.status === 'dispatched') updateData.dispatchedAt = new Date();
    if (data.status === 'assigned') updateData.assignedAt = new Date();
    if (data.status === 'en_route') updateData.driverEnRouteAt = new Date();
    if (data.status === 'arrived') updateData.driverArrivedAt = new Date();
    if (data.status === 'collected') updateData.collectedAt = new Date();
    if (data.status === 'confirmed') updateData.confirmedAt = new Date();
    if (data.status === 'completed') updateData.completedAt = new Date();

    const req = await prisma.recycleRequest.update({
        where: { id: requestId },
        data: updateData,
        include: {
            point: true,
            supervisor: true,
            assignedDriver: true,
        },
    });

    if (data.status) {
        const meta = getRequestStatusEventMeta(data.status);
        await publishPlatformEvent({
            source: 'platform',
            type: meta.type,
            entityType: 'recycle_request',
            entityId: req.id,
            severity: meta.severity,
            title: meta.title,
            message: `Ariza #${req.id} statusi ${data.status} ga o'zgartirildi.`,
            requestId: req.id,
            driverId: req.assignedDriverId ?? undefined,
            supervisorId: req.supervisorId ?? undefined,
            pointId: req.pointId,
            payload: {
                status: data.status,
                completedNote: data.completedNote ?? null,
            },
            notifyAdmins: false,
        });

        // 🔔 Telegram Push Notification: Haydovchiga xabar yuborish
        if (data.status === 'assigned' && req.assignedDriver?.telegramId) {
            const msg = `🔔 <b>Sizga yangi ariza biriktirildi!</b>\n\n` +
                        `📋 Ariza: #${req.id}\n` +
                        `👤 Mijoz: ${req.name}\n` +
                        `📞 Tel: ${req.phone}\n` +
                        `📍 Manzil: ${req.address || req.point.regionUz}\n` +
                        `📦 Hajm: ${req.volumeSize || (req.volume ? req.volume + ' kg' : 'Noma\'lum')}\n\n` +
                        `Iltimos, ilovaga kirib statusni "Yo'lga chiqish" ga o'zgartiring.`;
            notifyDriver(req.assignedDriver.telegramId, msg).catch(console.error);
        }
    }

    // ♻️ Eco Progress — ariza yig'ilganda/yakunlanganda avtomatik yangilash
    if (
        (data.status === 'collected' || data.status === 'completed') &&
        req.userId && req.volume && req.volume > 0
    ) {
        try {
            const user = await prisma.user.findUnique({ where: { id: req.userId } });
            if (user) {
                const newTotalKg = user.totalRecycledWeight + req.volume;
                const newLevel = getLevelByWeight(newTotalKg);
                const impact = calcEcoImpact(req.material || 'Makulatura', req.volume);
                const newCO2 = Math.round((user.totalCO2Saved + impact.co2SavedKg) * 10) / 10;
                const newTrees = Math.floor(newCO2 / 60);
                const earnedPoints = calcEcoPoints(
                    req.material || 'Makulatura',
                    req.volume,
                    newLevel.pointsMultiplier
                );

                const today = new Date(); today.setHours(0, 0, 0, 0);
                const lastActivity = user.lastEcoActivity ? new Date(user.lastEcoActivity) : null;
                lastActivity?.setHours(0, 0, 0, 0);
                const diffDays = lastActivity
                    ? Math.floor((today.getTime() - lastActivity.getTime()) / 86400000)
                    : -1;
                const newStreak = diffDays === 1 ? user.ecoStreak + 1
                    : diffDays === 0 ? user.ecoStreak : 1;

                await prisma.user.update({
                    where: { id: req.userId },
                    data: {
                        totalRecycledWeight: newTotalKg,
                        ecoLevel: newLevel.key,
                        ecoPoints: { increment: earnedPoints },
                        totalCO2Saved: newCO2,
                        treesEquivalent: newTrees,
                        ecoStreak: newStreak,
                        lastEcoActivity: new Date(),
                    },
                });

                // Badge tekshirish (background — asosiy jarayonni to'sib qo'ymasin)
                checkAndAwardBadges(req.userId).catch(console.error);
            }
        } catch (ecoErr) {
            console.error('[eco-progress trigger]', ecoErr);
        }
    }

    return req;
}

export async function deleteRecycleRequest(requestId: number) {
    return prisma.recycleRequest.delete({ where: { id: requestId } });
}

export async function getRecycleRequests() {
    return prisma.recycleRequest.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            point: true,
            supervisor: true,
            assignedDriver: true,
            collections: true,
            complaints: true,
        },
    });
}
