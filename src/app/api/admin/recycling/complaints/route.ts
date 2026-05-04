import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyCustomer, notifySalesChats } from '@/lib/telegram/notifier';
import { createBotEvent } from '@/lib/telegram/botEvents';

async function sendToTelegram(chatId: string, message: string) {
    try {
        if (!chatId) return;
        await notifyCustomer(chatId, message);
    } catch (e) { console.error('[Complaints TG]', e); }
}

// GET /api/admin/recycling/complaints — Shikoyatlar ro'yxati
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const level = searchParams.get('level');

        const where: Record<string, unknown> = {};
        if (status) where.status = status;
        if (level) where.level = level;

        const complaints = await prisma.recycleComplaint.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                request: { include: { point: true, assignedDriver: true } },
            },
        });
        return NextResponse.json(complaints);
    } catch (error) {
        console.error('[Complaints GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// POST /api/admin/recycling/complaints — Yangi shikoyat (mijozdan)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { requestId, fromPhone, fromName, message, level } = body;

        if (!requestId || !fromPhone || !message) {
            return NextResponse.json({ error: 'requestId, telefon va xabar majburiy' }, { status: 400 });
        }

        const complaint = await prisma.recycleComplaint.create({
            data: {
                requestId: Number(requestId),
                fromPhone,
                fromName: fromName || 'Mijoz',
                level: level || 'supervisor',
                message,
            },
            include: { request: { include: { point: true } } },
        });

        await createBotEvent({
            sourceBot: 'platform',
            eventType: 'complaint.created',
            entityType: 'recycle_complaint',
            entityId: complaint.id,
            severity: complaint.level === 'director' ? 'error' : 'warning',
            title: complaint.level === 'director' ? 'Direktor darajasiga eskalatsiya' : 'Yangi shikoyat yaratildi',
            message: `${complaint.fromName} ariza #${complaint.requestId} bo'yicha shikoyat qoldirdi.`,
            requestId: complaint.requestId,
            supervisorId: complaint.request.supervisorId ?? undefined,
            pointId: complaint.request.point?.id ?? complaint.request.regionId,
            payload: {
                level: complaint.level,
                message: complaint.message,
                fromPhone: complaint.fromPhone,
            },
        });

        // Xabar yuborish
        if (complaint.level === 'supervisor' && complaint.request.supervisorId) {
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
        if (complaint.level === 'director') {
            await notifySalesChats(
                `🚨 <b>ESKALATSIYA! Ariza #${complaint.requestId}</b>\n\n` +
                `👤 ${complaint.fromName} | 📞 ${complaint.fromPhone}\n` +
                `📍 ${complaint.request.point?.regionUz || ''}\n\n` +
                `💬 "${complaint.message}"\n\n` +
                `Mijoz masul bilan hal qila olmadi — sizga murojaat qildi!`
            );
        }

        return NextResponse.json(complaint, { status: 201 });
    } catch (error) {
        console.error('[Complaints POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// PUT /api/admin/recycling/complaints — Javob berish
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, status, response, respondedBy } = body;

        if (!id) {
            return NextResponse.json({ error: 'id majburiy' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (status) updateData.status = status;
        if (response) updateData.response = response;
        if (respondedBy) updateData.respondedBy = respondedBy;
        if (status === 'resolved' || status === 'closed') {
            updateData.resolvedAt = new Date();
        }

        const complaint = await prisma.recycleComplaint.update({
            where: { id: Number(id) },
            data: updateData,
            include: { request: true },
        });

        await createBotEvent({
            sourceBot: 'platform',
            eventType: 'complaint.updated',
            entityType: 'recycle_complaint',
            entityId: complaint.id,
            severity: status === 'resolved' || status === 'closed' ? 'success' : 'info',
            title: 'Shikoyat holati yangilandi',
            message: `Shikoyat #${complaint.id} holati ${status || complaint.status} ga o'zgartirildi.`,
            requestId: complaint.requestId,
            supervisorId: complaint.request.supervisorId ?? undefined,
            pointId: complaint.request.regionId,
            payload: {
                status: status || complaint.status,
                response: response || null,
                respondedBy: respondedBy || null,
            },
        });

        // Mijozga javob xabari
        if (response && complaint.request.customerTgId) {
            await sendToTelegram(complaint.request.customerTgId,
                `📋 <b>Shikoyatingizga javob berildi</b>\n\n` +
                `Ariza #${complaint.requestId}\n\n` +
                `💬 "${response}"\n\n` +
                `${status === 'resolved' ? '✅ Masala hal qilindi' : '🔄 Ko\'rib chiqilmoqda'}`
            );
        }

        return NextResponse.json(complaint);
    } catch (error) {
        console.error('[Complaints PUT]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
