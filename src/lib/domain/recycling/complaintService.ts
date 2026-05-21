import { prisma } from '@/lib/prisma';
import { ComplaintLevel, ComplaintStatus } from '@prisma/client';
import { notifyCustomer, notifySalesChats } from '@/lib/telegram/notifier';
import { createBotEvent } from '@/lib/telegram/botEvents';

async function sendToTelegram(chatId: string, message: string) {
    try {
        if (!chatId) return;
        await notifyCustomer(chatId, message);
    } catch (e) { console.error('[Complaints TG]', e); }
}

export async function getComplaints(params: { status?: string | null; level?: string | null }) {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.level) where.level = params.level;

    return prisma.recycleComplaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            request: { include: { point: true, assignedDriver: true } },
        },
    });
}

export async function createComplaint(data: {
    requestId: number | string;
    fromPhone: string;
    fromName?: string;
    message: string;
    level?: string;
}) {
    if (!data.requestId || !data.fromPhone || !data.message) {
        throw new Error('VALIDATION_ERROR: requestId, telefon va xabar majburiy');
    }

    const complaint = await prisma.recycleComplaint.create({
        data: {
            requestId: Number(data.requestId),
            fromPhone: data.fromPhone,
            fromName: data.fromName || 'Mijoz',
            level: (data.level as ComplaintLevel) || ComplaintLevel.supervisor,
            message: data.message,
        },
        include: { request: { include: { point: true } } },
    });

    await createBotEvent({
        sourceBot: 'platform',
        eventType: 'complaint.created',
        entityType: 'recycle_complaint',
        entityId: complaint.id,
        severity: complaint.level === ComplaintLevel.director ? 'error' : 'warning',
        title: complaint.level === ComplaintLevel.director ? 'Direktor darajasiga eskalatsiya' : 'Yangi shikoyat yaratildi',
        message: `${complaint.fromName} ariza #${complaint.requestId} bo'yicha shikoyat qoldirdi.`,
        requestId: complaint.requestId,
        supervisorId: complaint.request.supervisorId ?? undefined,
        pointId: complaint.request.point?.id ?? complaint.request.pointId,
        payload: {
            level: complaint.level,
            message: complaint.message,
            fromPhone: complaint.fromPhone,
        },
    });

    // Xabar yuborish
    if (complaint.level === ComplaintLevel.supervisor && complaint.request.supervisorId) {
        const sup = await prisma.supervisor.findUnique({
            where: { id: complaint.request.supervisorId },
        });
        if (sup?.telegramId) {
            await sendToTelegram(sup.telegramId,
                `⚠️ <b>Shikoyat! Ariza #${complaint.requestId}</b>\n\n` +
                `👤 ${complaint.fromName}\n📞 ${complaint.fromPhone}\n\n` +
                `💬 "${complaint.message}"\n\n` +
                `Iltimos, tezda hal qiling!`
            );
        }
    }

    // Director (=Admin) darajasidagi shikoyat
    if (complaint.level === ComplaintLevel.director) {
        await notifySalesChats(
            `🚨 <b>ESKALATSIYA! Ariza #${complaint.requestId}</b>\n\n` +
            `👤 ${complaint.fromName} | 📞 ${complaint.fromPhone}\n` +
            `📍 ${complaint.request.point?.regionUz || ''}\n\n` +
            `💬 "${complaint.message}"\n\n` +
            `Mijoz masul bilan hal qila olmadi — sizga murojaat qildi!`
        );
    }

    return complaint;
}

export async function updateComplaint(data: {
    id: number | string;
    status?: string;
    response?: string;
    respondedBy?: string;
}) {
    if (!data.id) {
        throw new Error('VALIDATION_ERROR: id majburiy');
    }

    const updateData: Record<string, unknown> = {};
    if (data.status) updateData.status = data.status;
    if (data.response) updateData.response = data.response;
    if (data.respondedBy) updateData.respondedBy = data.respondedBy;
    if (data.status === ComplaintStatus.resolved || data.status === ComplaintStatus.closed) {
        updateData.resolvedAt = new Date();
    }

    const complaint = await prisma.recycleComplaint.update({
        where: { id: Number(data.id) },
        data: updateData,
        include: { request: true },
    });

    await createBotEvent({
        sourceBot: 'platform',
        eventType: 'complaint.updated',
        entityType: 'recycle_complaint',
        entityId: complaint.id,
        severity: data.status === ComplaintStatus.resolved || data.status === ComplaintStatus.closed ? 'success' : 'info',
        title: 'Shikoyat holati yangilandi',
        message: `Shikoyat #${complaint.id} holati ${data.status || complaint.status} ga o'zgartirildi.`,
        requestId: complaint.requestId,
        supervisorId: complaint.request.supervisorId ?? undefined,
        pointId: complaint.request.pointId,
        payload: {
            status: data.status || complaint.status,
            response: data.response || null,
            respondedBy: data.respondedBy || null,
        },
    });

    // Mijozga javob xabari
    if (data.response && complaint.request.customerTgId) {
        await sendToTelegram(complaint.request.customerTgId,
            `📋 <b>Shikoyatingizga javob berildi</b>\n\n` +
            `Ariza #${complaint.requestId}\n\n` +
            `💬 "${data.response}"\n\n` +
            `${data.status === ComplaintStatus.resolved ? '✅ Masala hal qilindi' : '🔄 Ko\'rib chiqilmoqda'}`
        );
    }

    return complaint;
}
