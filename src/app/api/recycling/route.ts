import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RecycleRequestStatus, DriverStatus } from '@prisma/client';
import { notifyCustomer, notifySalesChats } from '@/lib/telegram/notifier';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createBotEvent } from '@/lib/telegram/botEvents';
import { verifyMobileToken } from '@/lib/auth/verifyMobileToken';

// Telegraf inline keyboard tipi
type IKBtn = { text: string; callback_data: string };

// Telefon regex — server tomoni validatsiya
const PHONE_REGEX = /^\+998[0-9]{9}$/;

// ─── Yordamchi: shaxsiy chatga xabar + inline tugmalar ───────────────────────
async function sendToChat(chatId: string, message: string, inlineKeyboard?: IKBtn[][]) {
    try {
        if (!chatId) return false;
        await notifyCustomer(chatId, message, inlineKeyboard ? {
            reply_markup: { inline_keyboard: inlineKeyboard },
        } : undefined);
        return true;
    } catch (e) {
        console.error('[AutoDispatch TG]', e);
        return false;
    }
}

// ─── GET /api/recycling — Foydalanuvchi arizalarini olish ────────────────────
export async function GET(req: NextRequest) {
    try {
        // Auth — NextAuth session yoki Mobile token
        let userId: number | null = null;

        const session = await getServerSession(authOptions);
        if (session?.user?.id) {
            userId = Number(session.user.id);
        } else {
            const authResult = await verifyMobileToken(req.headers.get('authorization'));
            if (authResult.ok) {
                userId = authResult.userId;
            }
        }

        // URL params dan userId olish (fallback)
        const { searchParams } = new URL(req.url);
        const paramUserId = searchParams.get('userId');
        if (!userId && paramUserId) {
            userId = Number(paramUserId);
        }

        if (!userId || !Number.isFinite(userId)) {
            return NextResponse.json([]);
        }

        const requests = await prisma.recycleRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                point: {
                    select: { regionUz: true, cityUz: true },
                },
            },
        });

        return NextResponse.json(requests);
    } catch (error) {
        console.error('[GET /api/recycling]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}



export async function POST(request: Request) {
    try {
        const body = await request.json();
        const session = await getServerSession(authOptions);
        const userId = Number(session?.user?.id);

        // ─── Majburiy maydonlar tekshiruvi ───────────────────────────────
        if (!body.name?.trim()) {
            return NextResponse.json({ error: 'Ism Familiyani kiriting' }, { status: 400 });
        }
        if (!body.phone?.trim()) {
            return NextResponse.json({ error: 'Telefon raqamini kiriting' }, { status: 400 });
        }
        if (!PHONE_REGEX.test(body.phone.replace(/\s/g, ''))) {
            return NextResponse.json({ error: '+998XXXXXXXXX formatida kiriting' }, { status: 400 });
        }
        // P2.5: yangi nom `pointId`, eski klient `regionId` ham qabul qilinadi
        const rawPointId = body.pointId ?? body.regionId;
        if (!rawPointId) {
            return NextResponse.json({ error: 'Viloyatni tanlang' }, { status: 400 });
        }

        // ─── Kuryer uchun manzil majburiy ────────────────────────────────
        const pickupType = body.pickupType || 'base';
        if (pickupType === 'pickup' && !body.address?.trim()) {
            return NextResponse.json({ error: 'Kuryer uchun manzilni kiriting' }, { status: 400 });
        }

        // ─── DB ga yozish ─────────────────────────────────────────────────
        const pointId = Number(rawPointId);

        // Nuqtani VA uning masul shaxsini bir vaqtda olish
        const point = await prisma.recyclePoint.findUnique({
            where: { id: pointId },
            include: {
                supervisors: {
                    where: { isActive: true },
                    take: 1,
                    orderBy: { id: 'asc' },
                },
            },
        });

        const supervisor = point?.supervisors?.[0] ?? null;

        // Agar supervisor topilsa — ariza darhol 'dispatched' bo'ladi
        const req = await prisma.recycleRequest.create({
            data: {
                name:              body.name.trim(),
                phone:             body.phone.trim(),
                pointId,
                material:          body.material || null,
                volume:            body.volume ? Number(body.volume) : null,
                pickupType,
                pickupLocationMode: body.pickupLocationMode || null,
                address:           body.address?.trim() || null,
                pickupLat:         body.pickupLat ? Number(body.pickupLat) : null,
                pickupLng:         body.pickupLng ? Number(body.pickupLng) : null,
                customerTgId:      body.customerTgId || null,
                userId:            Number.isFinite(userId) ? userId : null,
                // Avto-dispatch
                ...(supervisor ? {
                    supervisorId: supervisor.id,
                    status:       RecycleRequestStatus.dispatched,
                    dispatchedAt: new Date(),
                } : {
                    status: RecycleRequestStatus.new_,
                }),
            },
        });

        await createBotEvent({
            sourceBot: 'platform',
            eventType: 'request.created',
            entityType: 'recycle_request',
            entityId: req.id,
            severity: 'success',
            title: 'Platformada yangi recycle request yaratildi',
            message: `${req.name} tomonidan yangi ariza #${req.id} yaratildi.`,
            requestId: req.id,
            supervisorId: supervisor?.id ?? undefined,
            pointId,
            userId: Number.isFinite(userId) ? userId : undefined,
            payload: {
                pickupType,
                material: req.material,
                volume: req.volume,
                autoDispatched: Boolean(supervisor),
            },
        });

        // ─── Telegram bildirish ───────────────────────────────────────────
        const pickupLabel   = pickupType === 'pickup' ? '🚛 Kuryer chiqishi' : '🏭 O\'zi olib keladi';
        const volumeLine    = req.volume   ? `📦 Hajmi: ${req.volume} kg\n`   : '';
        const materialLine  = req.material ? `📄 Material: ${req.material}\n` : '';

        // Manzil qismi — rejimga qarab
        const lat = (req as typeof req & { pickupLat?: number | null }).pickupLat;
        const lng = (req as typeof req & { pickupLng?: number | null }).pickupLng;
        const locMode = (req as typeof req & { pickupLocationMode?: string | null }).pickupLocationMode;
        const modeLabel = locMode === 'gps' ? '📡 GPS' : locMode === 'map' ? '🗺️ Xaritadan' : '✍️ Matn';
        const mapsLink = lat && lng ? `\n🗺️ <a href="https://maps.google.com/?q=${lat},${lng}">Xaritada ko'rish (${lat?.toFixed(4)}, ${lng?.toFixed(4)})</a>` : '';
        const addressLine = req.address
            ? `🏠 Manzil [${modeLabel}]: ${req.address}${mapsLink}\n`
            : lat && lng
            ? `📍 Koordinatlar: ${lat?.toFixed(5)}, ${lng?.toFixed(5)}${mapsLink}\n`
            : '';

        const baseMsg =
            `♻️ <b>Yangi Makulatura So'rovi #${req.id}</b>\n\n` +
            `👤 Mijoz: <b>${req.name}</b>\n` +
            `📞 Telefon: <a href="tel:${req.phone}">${req.phone}</a>\n` +
            `📍 Viloyat: ${point?.regionUz ?? pointId}\n` +
            `🚚 Usul: ${pickupLabel}\n` +
            addressLine + volumeLine + materialLine;

        try {
            if (supervisor?.telegramId) {
                // ══ AVTO-DISPATCH: Masulga to'g'ridan-to'g'ri ══
                const supMsg =
                    baseMsg +
                    `\n─────────────────────\n` +
                    `📤 <b>Ariza avtomatik sizga yo'naltirildi!</b>\n` +
                    `Iltimos, haydovchi tayinlang 👇`;

                // Masulga inline tayinlash tugmalari bilan yuklaymiz
                const drivers = await prisma.driver.findMany({
                    where: { supervisorId: supervisor.id, status: DriverStatus.active, isOnline: true },
                    take: 5,
                    orderBy: { id: 'asc' },
                });

                const keyboard = drivers.length > 0
                    ? drivers.map(d => [{ text: `🚚 ${d.name}`, callback_data: `assign_${req.id}_${d.id}` }])
                    : [[{ text: '📋 Arizani ko\'rish', callback_data: `view_req_${req.id}` }]];

                await sendToChat(supervisor.telegramId, supMsg, keyboard);

                // Admin chatiga qisqa log
                await notifySalesChats(
                    `✅ Ariza <b>#${req.id}</b> → <b>${supervisor.name}</b> ga avtomatik yo'naltirildi\n` +
                    `📍 ${point?.regionUz ?? pointId} | ${pickupLabel}`
                );
            } else {
                // ══ FALLBACK: Supervisor yo'q — barchasi admin chatga ══
                const adminMsg =
                    baseMsg +
                    `\n─────────────────────\n` +
                    `⚠️ <b>${point?.regionUz ?? pointId}</b> uchun masul shaxs biriktirilmagan!\n` +
                    `Admin paneldan qo'lda yo'naltiring.`;

                await notifySalesChats(adminMsg);
            }
        } catch (botErr) {
            console.error('Telegramga yuborib bo\'lmadi:', botErr);
        }

        return NextResponse.json({ success: true, req, autoDispatched: !!supervisor }, { status: 201 });
    } catch (error) {
        console.error('[Recycling POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

