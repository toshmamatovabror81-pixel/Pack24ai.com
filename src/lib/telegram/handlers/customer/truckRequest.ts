import type { Context, Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { RecyclePointStatus, RecycleRequestStatus } from '@prisma/client';

import { getText } from '../../i18n';
import { haversineDistance } from '../../geo';
import { notifyAdmin } from '../../notifier';
import { createBotEvent } from '../../botEvents';
import type { CustomerSession } from './types';

import { sessions, registrationSessions } from './helpers';

// ─── Mashina chaqirish arizasini yuborish ─────────────────────────────────────
export async function submitTruckRequest(
    ctx: Context,
    _bot: Telegraf,
    ses: CustomerSession,
    tgId: string,
    photoUrl?: string,
) {
    const lang = ses.lang;

    // Eng yaqin bazani topish
    const points = await prisma.recyclePoint.findMany({
        where: { status: RecyclePointStatus.active },
        include: { supervisors: { where: { isActive: true }, take: 1 } },
    });

    let nearestPoint = points[0];
    if (ses.lat && ses.lng && ses.lat !== 0) {
        const sorted = points
            .filter(p => p.lat && p.lng)
            .map(p => ({ ...p, dist: haversineDistance(ses.lat!, ses.lng!, p.lat!, p.lng!) }))
            .sort((a, b) => a.dist - b.dist);
        if (sorted.length > 0) nearestPoint = sorted[0];
    }

    if (!nearestPoint) {
        await ctx.reply(lang === 'uz' ? '❌ Aktiv punkt topilmadi.' : '❌ No active point found.');
        sessions.delete(tgId);
        return;
    }

    // Eng yaqin punktning birinchi aktiv masulini topish
    const supervisorForPoint = nearestPoint.supervisors[0] ?? null;

    // Arizani bazaga yozish
    const request = await prisma.recycleRequest.create({
        data: {
            name: ses.name || ctx.from!.first_name || 'Nomalum',
            phone: ses.phone || '',
            pointId: nearestPoint.id,
            pickupType: 'pickup',
            pickupLat: ses.lat || null,
            pickupLng: ses.lng || null,
            customerTgId: tgId,
            customerLang: lang,
            volumeSize: ses.volumeSize || null,
            photoUrl: photoUrl || null,
            status: supervisorForPoint ? RecycleRequestStatus.dispatched : RecycleRequestStatus.new_,
            supervisorId: supervisorForPoint?.id ?? null,
            dispatchedAt: supervisorForPoint ? new Date() : null,
        },
    });

    await createBotEvent({
        sourceBot: 'customer',
        eventType: 'request.created',
        entityType: 'recycle_request',
        entityId: request.id,
        severity: 'success',
        title: 'Yangi recycle request yaratildi',
        message: `${request.name} tomonidan yangi pickup ariza #${request.id} yaratildi.`,
        requestId: request.id,
        supervisorId: supervisorForPoint?.id ?? undefined,
        pointId: nearestPoint.id,
        payload: {
            pickupType: request.pickupType,
            volumeSize: request.volumeSize,
            photoAttached: Boolean(photoUrl),
        },
    });

    await ctx.reply(getText('truck_request_sent', lang), { parse_mode: 'HTML' });

    // Masulga xabar
    const sup = supervisorForPoint;
    if (sup?.telegramId) {
        const volLabel = ses.volumeSize === 'small' ? '📦 Kichik' : ses.volumeSize === 'medium' ? '📦📦 O\'rta' : '📦📦📦 Katta';
        const adminMsg =
            `🆕 <b>Yangi ariza #${request.id}</b>\n\n` +
            `👤 ${request.name}\n` +
            `📞 ${request.phone}\n` +
            `📍 ${nearestPoint.regionUz}\n` +
            `⚖️ Hajm: ${volLabel}\n` +
            `📸 Rasm: ${photoUrl ? 'Bor' : 'Yo\'q'}\n\n` +
            `Haydovchi tayinlang 👇`;

        await notifyAdmin(sup.telegramId, adminMsg);
    }

    sessions.delete(tgId);
}

// ─── Xodim kodi bilan ro'yxatdan o'tish ────────────────────────────────────
export async function handleRegistrationCode(ctx: Context, tgId: string, code: string) {
    if (!/^\d{5}$/.test(code)) {
        await ctx.reply('❌ 5 ta raqam kiriting! <i>Masalan: 48271</i>', { parse_mode: 'HTML' });
        return;
    }

    // Haydovchi
    const driver = await prisma.driver.findFirst({ where: { registrationCode: code } });
    if (driver) {
        if (driver.telegramId && driver.telegramId !== tgId) {
            await ctx.reply('❌ Bu kod boshqa foydalanuvchiga ulangan.');
            registrationSessions.delete(tgId);
            return;
        }
        await prisma.driver.update({
            where: { id: driver.id },
            data: {
                telegramId: tgId,
                telegramName: ctx.from!.username || ctx.from!.first_name || null,
                registeredAt: new Date(),
                isOnline: true,
                lastSeenAt: new Date(),
            },
        });
        registrationSessions.delete(tgId);
        await ctx.reply(
            `✅ <b>Muvaffaqiyatli!</b>\n\n🚚 Siz <b>Haydovchi</b> sifatida ulangingiz.\n👤 ${driver.name}\n\n` +
            `⚠️ Endi <b>@pack24MX_bot</b> ga o'ting — u yerda ishlaringiz ko'rinadi.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    // Masul
    const supervisor = await prisma.supervisor.findFirst({ where: { registrationCode: code } });
    if (supervisor) {
        if (supervisor.telegramId && supervisor.telegramId !== tgId) {
            await ctx.reply('❌ Bu kod boshqa foydalanuvchiga ulangan.');
            registrationSessions.delete(tgId);
            return;
        }
        await prisma.supervisor.update({
            where: { id: supervisor.id },
            data: {
                telegramId: tgId,
                telegramName: ctx.from!.username || ctx.from!.first_name || null,
                registeredAt: new Date(),
            },
        });
        registrationSessions.delete(tgId);
        await ctx.reply(
            `✅ <b>Muvaffaqiyatli!</b>\n\n👷 Siz <b>Masul shaxs</b> sifatida ulangingiz.\n👤 ${supervisor.name}\n\n` +
            `⚠️ Endi <b>@pack24AUP_bot</b> ga o'ting — u yerda arizalar va to'lovlar ko'rinadi.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    await ctx.reply(`❌ <b>Kod topilmadi!</b>\n<code>${code}</code> — bazada yo'q.\n\nBekor: /start`, { parse_mode: 'HTML' });
}
