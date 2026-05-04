import { Context, Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { createBotEvent } from './botEvents';
import { applyBotDefaults } from './botInit';
import { getPack24AdminBotToken } from './botTokens';
import { pack24AdminMainKeyboard, pack24AdminSharePhoneKeyboard } from './keyboards';
import { generateUniqueTelegramRegistrationCode } from './registrationCodes';
import { createTelegramSessionStore } from './sessionStore';
import { approveBotAccessRequest, rejectBotAccessRequest } from './botAccessRequests';
import {
    approveJournalCorrectionRequest,
    rejectJournalCorrectionRequest,
} from '@/lib/domain/recycling/journalCorrections';

type Pack24AdminSession = {
    step: 'phone' | 'menu';
};

const sessions = createTelegramSessionStore<Pack24AdminSession>('pack24admin-bot-sessions');

let pack24AdminBotInstance: Telegraf | null = null;

type AccessIdentity =
    | { kind: 'db'; id: number; name: string; phone: string; telegramId: string | null; registrationCode: string | null; isActive: boolean }
    | { kind: 'static'; id: null; name: string; phone: null; telegramId: string; registrationCode: null; isActive: true };

function normalizePhone(phone: string): string {
    let normalized = phone.replace(/[^0-9+]/g, '');
    if (!normalized.startsWith('+')) normalized = `+${normalized}`;
    return normalized;
}

async function getHqAdminByTelegramId(tgId: string) {
    return prisma.telegramHqAdmin.findFirst({
        where: { telegramId: tgId, isActive: true },
    });
}

async function getHqAdminByPhone(phone: string) {
    return prisma.telegramHqAdmin.findFirst({
        where: {
            OR: [
                { phone },
                { phone: phone.replace('+', '') },
                { phone: phone.replace('+998', '0') },
                { phone: phone.slice(-9) },
            ],
        },
    });
}

function getStaticAllowedIds(): string[] {
    return (process.env.PACK24ADMIN_ALLOWED_TELEGRAM_IDS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

async function getAccessIdentity(tgId: string): Promise<AccessIdentity | null> {
    const dbAdmin = await getHqAdminByTelegramId(tgId);
    if (dbAdmin) {
        return {
            kind: 'db',
            id: dbAdmin.id,
            name: dbAdmin.name,
            phone: dbAdmin.phone,
            telegramId: dbAdmin.telegramId,
            registrationCode: dbAdmin.registrationCode,
            isActive: dbAdmin.isActive,
        };
    }

    if (getStaticAllowedIds().includes(tgId)) {
        return {
            kind: 'static',
            id: null,
            name: 'System Admin',
            phone: null,
            telegramId: tgId,
            registrationCode: null,
            isActive: true,
        };
    }

    return null;
}

function formatEventRows(events: Array<{
    id: number;
    title: string;
    message: string;
    sourceBot: string;
    severity: string;
    createdAt: Date;
    requestId: number | null;
}>): string {
    if (events.length === 0) {
        return 'Hozircha hodisalar yo\'q.';
    }

    return events.map((event, index) => {
        const icon = event.severity === 'error'
            ? '🚨'
            : event.severity === 'warning'
            ? '⚠️'
            : event.severity === 'success'
            ? '✅'
            : 'ℹ️';

        return (
            `${index + 1}. ${icon} <b>${event.title}</b>\n` +
            `🤖 ${event.sourceBot} • ${event.createdAt.toLocaleString('ru-RU')}\n` +
            `${event.requestId ? `📋 Ariza #${event.requestId}\n` : ''}` +
            `${event.message}`
        );
    }).join('\n\n');
}

async function replyWithMenu(ctx: Context, hqAdminName: string) {
    const unreadCount = await prisma.botEvent.count({
        where: { status: 'new' },
    });

    await ctx.reply(
        `🏢 <b>Pack24 Admin botiga xush kelibsiz</b>\n\n` +
        `👤 ${hqAdminName}\n` +
        `📨 Yangi hodisalar: <b>${unreadCount}</b>\n\n` +
        `Kerakli bo'limni tanlang.`,
        {
            parse_mode: 'HTML',
            reply_markup: pack24AdminMainKeyboard(),
        },
    );
}

async function touchDbAdmin(identity: AccessIdentity) {
    if (identity.kind !== 'db') return;

    await prisma.telegramHqAdmin.update({
        where: { id: identity.id },
        data: { lastSeenAt: new Date() },
    });
}

async function renderSupervisorsList(ctx: Context) {
    const supervisors = await prisma.supervisor.findMany({
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        take: 12,
        include: { point: true },
    });

    if (supervisors.length === 0) {
        await ctx.reply('👷 Masullar ro\'yxati bo\'sh.', {
            reply_markup: pack24AdminMainKeyboard(),
        });
        return;
    }

    await ctx.reply(
        '👷 <b>Masullar ro\'yxati</b>\nKerakli xodimni tanlang:',
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    ...supervisors.map((sup) => [{
                        text: `${sup.isActive ? '🟢' : '🔴'} ${sup.name}`,
                        callback_data: `pa_sup_${sup.id}`,
                    }]),
                ],
            },
        },
    );
}

async function renderDriversList(ctx: Context) {
    const drivers = await prisma.driver.findMany({
        orderBy: [{ isOnline: 'desc' }, { createdAt: 'desc' }],
        take: 12,
        include: { point: true, supervisor: true },
    });

    if (drivers.length === 0) {
        await ctx.reply('🚚 Haydovchilar ro\'yxati bo\'sh.', {
            reply_markup: pack24AdminMainKeyboard(),
        });
        return;
    }

    await ctx.reply(
        '🚚 <b>Haydovchilar ro\'yxati</b>\nKerakli xodimni tanlang:',
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    ...drivers.map((driver) => [{
                        text: `${driver.isOnline ? '🟢' : driver.status === 'inactive' ? '⛔' : '⚪'} ${driver.name}`,
                        callback_data: `pa_drv_${driver.id}`,
                    }]),
                ],
            },
        },
    );
}

async function renderSupervisorAccessRequests(ctx: Context) {
    const requests = await prisma.botAccessRequest.findMany({
        where: { role: 'supervisor', status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 10,
    });

    if (requests.length === 0) {
        await ctx.reply('📝 Hozircha pending admin arizalari yo\'q.', {
            reply_markup: pack24AdminMainKeyboard(),
        });
        return;
    }

    await ctx.reply('📝 <b>Admin arizalari</b>\nTasdiqlash yoki rad etish uchun tanlang:', {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: requests.flatMap((request) => [
                [{
                    text: `${request.name} • ${request.phone}`,
                    callback_data: `pa_req_sup_${request.id}`,
                }],
                [
                    { text: '✅ Tasdiqlash', callback_data: `pa_req_sup_ok_${request.id}` },
                    { text: '❌ Rad etish', callback_data: `pa_req_sup_no_${request.id}` },
                ],
            ]),
        },
    });
}

async function renderSupervisorAccessRequestCard(ctx: Context, requestId: number) {
    const request = await prisma.botAccessRequest.findUnique({
        where: { id: requestId },
        include: { requestedPoint: true },
    });

    if (!request || request.role !== 'supervisor') {
        if ('answerCbQuery' in ctx) await ctx.answerCbQuery('Topilmadi');
        return;
    }

    const text =
        `📝 <b>Admin arizasi #${request.id}</b>\n\n` +
        `👤 ${request.name}\n` +
        `📞 <code>${request.phone}</code>\n` +
        `📨 Telegram: <code>${request.telegramId || '—'}</code>\n` +
        `🏭 Baza: ${request.requestedPoint?.regionUz || 'tanlanmagan'}\n` +
        `Holat: <b>${request.status}</b>\n` +
        `Sana: ${request.createdAt.toLocaleString('ru-RU')}`;

    const reply_markup = {
        inline_keyboard: [
            [
                { text: '✅ Tasdiqlash', callback_data: `pa_req_sup_ok_${request.id}` },
                { text: '❌ Rad etish', callback_data: `pa_req_sup_no_${request.id}` },
            ],
            [{ text: '⬅️ Arizalar', callback_data: 'pa_req_sup_list' }],
        ],
    };

    if (ctx.callbackQuery && 'editMessageText' in ctx) {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup });
        return;
    }

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup });
}

async function renderSupervisorCard(ctx: Context, supervisorId: number) {
    const supervisor = await prisma.supervisor.findUnique({
        where: { id: supervisorId },
        include: {
            point: true,
            _count: { select: { drivers: true, requests: true } },
        },
    });

    if (!supervisor) {
        if ('answerCbQuery' in ctx) await ctx.answerCbQuery('Topilmadi');
        return;
    }

    const text =
        `👷 <b>${supervisor.name}</b>\n\n` +
        `📞 ${supervisor.phone}\n` +
        `🏭 Baza: ${supervisor.point?.regionUz || '—'}\n` +
        `📨 Telegram: ${supervisor.telegramId || 'ulanmagan'}\n` +
        `🔑 Kod: <code>${supervisor.registrationCode || '—'}</code>\n` +
        `📊 Haydovchilar: ${supervisor._count.drivers} | Arizalar: ${supervisor._count.requests}\n` +
        `🔐 Holat: ${supervisor.isActive ? 'faol' : 'bloklangan'}`;

    if ('editMessageText' in ctx) {
        await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: supervisor.isActive ? '⛔ Bloklash' : '✅ Faollashtirish', callback_data: `pa_sup_toggle_${supervisor.id}` }],
                    [{ text: '🔁 Kodni yangilash', callback_data: `pa_sup_code_${supervisor.id}` }],
                    [{ text: '⬅️ Ortga', callback_data: 'pa_list_sup' }],
                ],
            },
        });
        return;
    }

    await (ctx as Context).reply(text, { parse_mode: 'HTML' });
}

async function renderDriverCard(ctx: Context, driverId: number) {
    const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        include: {
            point: true,
            supervisor: true,
            _count: { select: { collections: true, assignedRequests: true } },
        },
    });

    if (!driver) {
        if ('answerCbQuery' in ctx) await ctx.answerCbQuery('Topilmadi');
        return;
    }

    const text =
        `🚚 <b>${driver.name}</b>\n\n` +
        `📞 ${driver.phone}\n` +
        `🏭 Baza: ${driver.point?.regionUz || '—'}\n` +
        `👷 Masul: ${driver.supervisor?.name || '—'}\n` +
        `📨 Telegram: ${driver.telegramId || 'ulanmagan'}\n` +
        `🔑 Kod: <code>${driver.registrationCode || '—'}</code>\n` +
        `📊 Yig'ishlar: ${driver._count.collections} | Tayinlangan: ${driver._count.assignedRequests}\n` +
        `🔐 Status: ${driver.status} | ${driver.isOnline ? 'online' : 'offline'}`;

    if ('editMessageText' in ctx) {
        await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: driver.status === 'inactive' ? '✅ Faollashtirish' : '⛔ Bloklash', callback_data: `pa_drv_toggle_${driver.id}` }],
                    [{ text: '🔁 Kodni yangilash', callback_data: `pa_drv_code_${driver.id}` }],
                    [{ text: '⬅️ Ortga', callback_data: 'pa_list_drv' }],
                ],
            },
        });
        return;
    }

    await (ctx as Context).reply(text, { parse_mode: 'HTML' });
}

export async function initPack24AdminBot(): Promise<Telegraf | null> {
    if (pack24AdminBotInstance) return pack24AdminBotInstance;

    const token = getPack24AdminBotToken();
    if (!token) {
        console.warn('[Pack24AdminBot] PACK24ADMIN_BOT_TOKEN topilmadi');
        return null;
    }

    const bot = new Telegraf(token);
    await applyBotDefaults(bot, 'Pack24AdminBot', [
        { command: 'start', description: 'Bosh menyu' },
        { command: 'help', description: 'Yordam' },
    ]);

    bot.start(async (ctx) => {
        const tgId = ctx.from.id.toString();
        const hqAdmin = await getAccessIdentity(tgId);

        if (hqAdmin) {
            await touchDbAdmin(hqAdmin);
            sessions.set(tgId, { step: 'menu' });
            await replyWithMenu(ctx, hqAdmin.name);
            return;
        }

        sessions.set(tgId, { step: 'phone' });
        await ctx.reply(
            '🔐 <b>Pack24 HQ admin bot</b>\n\nTelefon raqamingizni ulashing. Tizim sizni ro\'yxatdan o\'tgan HQ admin sifatida tekshiradi.',
            {
                parse_mode: 'HTML',
                reply_markup: pack24AdminSharePhoneKeyboard(),
            },
        );
    });

    bot.help(async (ctx) => {
        await ctx.reply(
            '🏢 <b>Pack24 HQ Admin Bot</b>\n\n' +
            '👷 Masullar — masul shaxslarni boshqarish\n' +
            '🚚 Haydovchilar — haydovchilarni boshqarish\n' +
            '📋 Jurnal tahrirlari — masul so\'rovlari (tasdiq/rad)\n' +
            '📡 Hodisalar — oxirgi platforma eventlari\n' +
            '🚨 Ogohlantirishlar — yangi va muhim eventlar\n' +
            '📊 Statistika — 24 soatlik qisqa kesim\n' +
            '✅ Barchasini o\'qildi — event feedni tozalash\n' +
            '👤 Profil — admin ma\'lumotlari\n\n' +
            '/start — bosh menyu',
            { parse_mode: 'HTML' },
        );
    });

    bot.on('contact', async (ctx) => {
        const tgId = ctx.from.id.toString();

        if (ctx.message.contact.user_id && ctx.message.contact.user_id !== ctx.from.id) {
            await ctx.reply('❌ Iltimos, o\'z telefon raqamingizni ulashing.', {
                reply_markup: pack24AdminSharePhoneKeyboard(),
            });
            return;
        }

        try {
            const phone = normalizePhone(ctx.message.contact.phone_number);
            const hqAdmin = await getHqAdminByPhone(phone);

            if (!hqAdmin) {
                await ctx.reply(
                    `❌ <b>Raqamingiz HQ admin ro'yxatida topilmadi.</b>\n\n` +
                    `📱 Telefon: <code>${phone}</code>\n\n` +
                    `Avval platformada sizni HQ admin sifatida ro'yxatdan o'tkazing.`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: { remove_keyboard: true },
                    },
                );
                sessions.delete(tgId);
                return;
            }

            if (hqAdmin.telegramId && hqAdmin.telegramId !== tgId) {
                await ctx.reply(
                    '❌ Bu telefon boshqa Telegram аккаунтга bog\'langan.',
                    { reply_markup: { remove_keyboard: true } },
                );
                return;
            }

            const registrationCode = hqAdmin.registrationCode ?? await generateUniqueTelegramRegistrationCode();

            const updated = await prisma.telegramHqAdmin.update({
                where: { id: hqAdmin.id },
                data: {
                    telegramId: tgId,
                    telegramName: ctx.from.username || ctx.from.first_name || null,
                    registeredAt: hqAdmin.registeredAt ?? new Date(),
                    lastSeenAt: new Date(),
                    registrationCode,
                },
            });

            sessions.set(tgId, { step: 'menu' });

            await createBotEvent({
                sourceBot: 'pack24admin',
                eventType: 'hq_admin.registered',
                entityType: 'telegram_hq_admin',
                entityId: updated.id,
                severity: 'success',
                title: 'HQ admin botga ulandi',
                message: `${updated.name} yangi HQ admin sifatida botga ulandi.`,
                payload: {
                    name: updated.name,
                    phone: updated.phone,
                },
                notifyAdmins: false,
            });

            await ctx.reply(
                `✅ <b>Ro'yxatdan o'tish yakunlandi</b>\n\n` +
                `👤 ${updated.name}\n` +
                `📞 ${updated.phone}\n` +
                `🔑 Kod: <code>${registrationCode}</code>`,
                {
                    parse_mode: 'HTML',
                    reply_markup: pack24AdminMainKeyboard(),
                },
            );
        } catch (error) {
            console.error('[Pack24AdminBot] Contact xatolik:', error);
            await ctx.reply('❌ Xatolik yuz berdi. Qayta urinib ko\'ring.', {
                reply_markup: { remove_keyboard: true },
            });
        }
    });

    bot.on('callback_query', async (ctx) => {
        const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
        if (!data) return;

        const identity = await getAccessIdentity(ctx.from.id.toString());
        if (!identity) {
            await ctx.answerCbQuery('Ruxsat yo\'q');
            return;
        }

        await touchDbAdmin(identity);

        try {
            if (data.startsWith('pa_jcorr_ok_')) {
                const correctionId = Number(data.replace('pa_jcorr_ok_', ''));
                try {
                    await approveJournalCorrectionRequest(
                        correctionId,
                        identity.kind === 'db' ? identity.id : null,
                    );
                    await ctx.answerCbQuery('Tasdiqlandi');
                    if ('editMessageText' in ctx) {
                        await ctx.editMessageText(
                            `✅ Tahrir so\'rovi <b>#${correctionId}</b> qo\'llandi. Hisobotda yangilanadi.`,
                            { parse_mode: 'HTML' },
                        );
                    }
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Xatolik';
                    await ctx.answerCbQuery(msg.slice(0, 180));
                }
                return;
            }

            if (data.startsWith('pa_jcorr_no_')) {
                const correctionId = Number(data.replace('pa_jcorr_no_', ''));
                try {
                    await rejectJournalCorrectionRequest(
                        correctionId,
                        identity.kind === 'db' ? identity.id : null,
                    );
                    await ctx.answerCbQuery('Rad etildi');
                    if ('editMessageText' in ctx) {
                        await ctx.editMessageText(`❌ Tahrir so\'rovi <b>#${correctionId}</b> rad etildi.`, {
                            parse_mode: 'HTML',
                        });
                    }
                } catch {
                    await ctx.answerCbQuery('Xatolik');
                }
                return;
            }

            if (data === 'pa_list_sup') {
                await ctx.answerCbQuery('👷');
                await renderSupervisorsList(ctx);
                return;
            }

            if (data === 'pa_list_drv') {
                await ctx.answerCbQuery('🚚');
                await renderDriversList(ctx);
                return;
            }

            if (data === 'pa_req_sup_list') {
                await ctx.answerCbQuery('📝');
                await renderSupervisorAccessRequests(ctx);
                return;
            }

            if (data.startsWith('pa_req_sup_ok_')) {
                const requestId = Number(data.replace('pa_req_sup_ok_', ''));
                const result = await approveBotAccessRequest(requestId, {
                    approvedByHqAdminId: identity.kind === 'db' ? identity.id : null,
                });
                if (!('supervisor' in result)) {
                    throw new Error('Admin arizasi tasdiqlanmadi');
                }
                await ctx.answerCbQuery('Tasdiqlandi');
                await ctx.editMessageText(
                    `✅ <b>Admin arizasi tasdiqlandi</b>\n\n` +
                    `👤 ${result.supervisor.name}\n` +
                    `📞 <code>${result.supervisor.phone}</code>\n` +
                    `🔑 Kod: <code>${result.supervisor.registrationCode || '—'}</code>`,
                    { parse_mode: 'HTML' },
                );
                return;
            }

            if (data.startsWith('pa_req_sup_no_')) {
                const requestId = Number(data.replace('pa_req_sup_no_', ''));
                await rejectBotAccessRequest(requestId, {
                    rejectedByHqAdminId: identity.kind === 'db' ? identity.id : null,
                    reason: 'HQ admin tomonidan rad etildi',
                });
                await ctx.answerCbQuery('Rad etildi');
                await ctx.editMessageText('❌ Admin arizasi rad etildi.');
                return;
            }

            if (data.startsWith('pa_req_sup_')) {
                const requestId = Number(data.replace('pa_req_sup_', ''));
                await ctx.answerCbQuery('📝');
                await renderSupervisorAccessRequestCard(ctx, requestId);
                return;
            }

            if (data.startsWith('pa_sup_') && !data.startsWith('pa_sup_toggle_') && !data.startsWith('pa_sup_code_')) {
                const supervisorId = Number(data.replace('pa_sup_', ''));
                await ctx.answerCbQuery('👷');
                await renderSupervisorCard(ctx, supervisorId);
                return;
            }

            if (data.startsWith('pa_drv_') && !data.startsWith('pa_drv_toggle_') && !data.startsWith('pa_drv_code_')) {
                const driverId = Number(data.replace('pa_drv_', ''));
                await ctx.answerCbQuery('🚚');
                await renderDriverCard(ctx, driverId);
                return;
            }

            if (data.startsWith('pa_sup_toggle_')) {
                const supervisorId = Number(data.replace('pa_sup_toggle_', ''));
                const supervisor = await prisma.supervisor.findUnique({ where: { id: supervisorId } });
                if (!supervisor) {
                    await ctx.answerCbQuery('Topilmadi');
                    return;
                }

                const updated = await prisma.supervisor.update({
                    where: { id: supervisorId },
                    data: { isActive: !supervisor.isActive },
                });

                await createBotEvent({
                    sourceBot: 'pack24admin',
                    eventType: updated.isActive ? 'supervisor.activated' : 'supervisor.blocked',
                    entityType: 'supervisor',
                    entityId: updated.id,
                    severity: updated.isActive ? 'success' : 'warning',
                    title: updated.isActive ? 'Masul faollashtirildi' : 'Masul bloklandi',
                    message: `${identity.name} ${updated.name} uchun ruxsat holatini o'zgartirdi.`,
                    supervisorId: updated.id,
                    notifyAdmins: false,
                });

                await ctx.answerCbQuery(updated.isActive ? 'Faollashtirildi' : 'Bloklandi');
                await renderSupervisorCard(ctx, supervisorId);
                return;
            }

            if (data.startsWith('pa_sup_code_')) {
                const supervisorId = Number(data.replace('pa_sup_code_', ''));
                const supervisor = await prisma.supervisor.findUnique({ where: { id: supervisorId } });
                if (!supervisor) {
                    await ctx.answerCbQuery('Topilmadi');
                    return;
                }

                const code = await generateUniqueTelegramRegistrationCode();
                await prisma.supervisor.update({
                    where: { id: supervisorId },
                    data: { registrationCode: code },
                });

                await createBotEvent({
                    sourceBot: 'pack24admin',
                    eventType: 'supervisor.code_reset',
                    entityType: 'supervisor',
                    entityId: supervisorId,
                    severity: 'info',
                    title: 'Masul uchun yangi kod berildi',
                    message: `${identity.name} ${supervisor.name} uchun yangi kirish kodi yaratdi.`,
                    supervisorId,
                    payload: { registrationCode: code },
                    notifyAdmins: false,
                });

                await ctx.answerCbQuery(`Yangi kod: ${code}`);
                await renderSupervisorCard(ctx, supervisorId);
                return;
            }

            if (data.startsWith('pa_drv_toggle_')) {
                const driverId = Number(data.replace('pa_drv_toggle_', ''));
                const driver = await prisma.driver.findUnique({ where: { id: driverId } });
                if (!driver) {
                    await ctx.answerCbQuery('Topilmadi');
                    return;
                }

                const nextStatus = driver.status === 'inactive' ? 'active' : 'inactive';
                await prisma.driver.update({
                    where: { id: driverId },
                    data: {
                        status: nextStatus,
                        isOnline: nextStatus === 'active' ? driver.isOnline : false,
                    },
                });

                await createBotEvent({
                    sourceBot: 'pack24admin',
                    eventType: nextStatus === 'active' ? 'driver.activated' : 'driver.blocked',
                    entityType: 'driver',
                    entityId: driver.id,
                    severity: nextStatus === 'active' ? 'success' : 'warning',
                    title: nextStatus === 'active' ? 'Haydovchi faollashtirildi' : 'Haydovchi bloklandi',
                    message: `${identity.name} ${driver.name} uchun ruxsat holatini o'zgartirdi.`,
                    driverId: driver.id,
                    supervisorId: driver.supervisorId ?? undefined,
                    pointId: driver.pointId ?? undefined,
                    notifyAdmins: false,
                });

                await ctx.answerCbQuery(nextStatus === 'active' ? 'Faollashtirildi' : 'Bloklandi');
                await renderDriverCard(ctx, driverId);
                return;
            }

            if (data.startsWith('pa_drv_code_')) {
                const driverId = Number(data.replace('pa_drv_code_', ''));
                const driver = await prisma.driver.findUnique({ where: { id: driverId } });
                if (!driver) {
                    await ctx.answerCbQuery('Topilmadi');
                    return;
                }

                const code = await generateUniqueTelegramRegistrationCode();
                await prisma.driver.update({
                    where: { id: driverId },
                    data: { registrationCode: code },
                });

                await createBotEvent({
                    sourceBot: 'pack24admin',
                    eventType: 'driver.code_reset',
                    entityType: 'driver',
                    entityId: driver.id,
                    severity: 'info',
                    title: 'Haydovchi uchun yangi kod berildi',
                    message: `${identity.name} ${driver.name} uchun yangi kirish kodi yaratdi.`,
                    driverId: driver.id,
                    supervisorId: driver.supervisorId ?? undefined,
                    pointId: driver.pointId ?? undefined,
                    payload: { registrationCode: code },
                    notifyAdmins: false,
                });

                await ctx.answerCbQuery(`Yangi kod: ${code}`);
                await renderDriverCard(ctx, driverId);
                return;
            }
        } catch (error) {
            console.error('[Pack24AdminBot] Callback xatolik:', error);
            await ctx.answerCbQuery('Xatolik');
        }
    });

    bot.on('text', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const text = ctx.message.text;

        if (text.startsWith('/')) return;

        const hqAdmin = await getAccessIdentity(tgId);
        if (!hqAdmin) {
            await ctx.reply('❌ Siz HQ admin sifatida ulanmagansiz. /start ni bosing.');
            return;
        }

        await touchDbAdmin(hqAdmin);

        if (text === '👷 Masullar') {
            await renderSupervisorsList(ctx);
            return;
        }

        if (text === '🚚 Haydovchilar') {
            await renderDriversList(ctx);
            return;
        }

        if (text === '📝 Admin arizalari') {
            await renderSupervisorAccessRequests(ctx);
            return;
        }

        if (text === '📋 Jurnal tahrirlari') {
            const pending = await prisma.journalCorrectionRequest.findMany({
                where: { status: 'pending' },
                orderBy: { createdAt: 'asc' },
                take: 14,
                include: { supervisor: { select: { name: true } } },
            });

            if (pending.length === 0) {
                await ctx.reply('📋 Kutilayotgan jurnal tahrirlari yo\'q.', {
                    reply_markup: pack24AdminMainKeyboard(),
                });
                return;
            }

            const summary = pending
                .map((row) => `• <b>#${row.id}</b> ${row.supervisor.name}: ${row.summaryLine}`)
                .join('\n');

            await ctx.reply(
                `📋 <b>Jurnal tahrirlari (kutilmoqda)</b>\n\n${summary}\n\nTasdiqlash yoki rad — pastdagi tugmalar:`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: pending.map((row) => [
                            { text: `✅ #${row.id}`, callback_data: `pa_jcorr_ok_${row.id}` },
                            { text: `❌ #${row.id}`, callback_data: `pa_jcorr_no_${row.id}` },
                        ]),
                    },
                },
            );
            return;
        }

        if (text === '📡 Hodisalar') {
            const events = await prisma.botEvent.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    title: true,
                    message: true,
                    sourceBot: true,
                    severity: true,
                    createdAt: true,
                    requestId: true,
                },
            });

            await ctx.reply(
                `📡 <b>So'nggi hodisalar</b>\n\n${formatEventRows(events)}`,
                { parse_mode: 'HTML', reply_markup: pack24AdminMainKeyboard() },
            );
            return;
        }

        if (text === '🚨 Ogohlantirishlar') {
            const events = await prisma.botEvent.findMany({
                where: {
                    OR: [
                        { status: 'new' },
                        { severity: { in: ['warning', 'error'] } },
                    ],
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    title: true,
                    message: true,
                    sourceBot: true,
                    severity: true,
                    createdAt: true,
                    requestId: true,
                },
            });

            await ctx.reply(
                `🚨 <b>Yangi va muhim ogohlantirishlar</b>\n\n${formatEventRows(events)}`,
                { parse_mode: 'HTML', reply_markup: pack24AdminMainKeyboard() },
            );
            return;
        }

        if (text === '📊 Statistika') {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const [all, unread, critical, grouped] = await Promise.all([
                prisma.botEvent.count({ where: { createdAt: { gte: since } } }),
                prisma.botEvent.count({ where: { status: 'new' } }),
                prisma.botEvent.count({
                    where: {
                        createdAt: { gte: since },
                        severity: { in: ['warning', 'error'] },
                    },
                }),
                prisma.botEvent.groupBy({
                    by: ['sourceBot'],
                    _count: { _all: true },
                    where: { createdAt: { gte: since } },
                }),
            ]);

            const lines = grouped
                .map((row) => `• ${row.sourceBot}: ${row._count._all}`)
                .join('\n') || '• Hali event yo\'q';

            await ctx.reply(
                `📊 <b>So'nggi 24 soat statistikasi</b>\n\n` +
                `Jami eventlar: <b>${all}</b>\n` +
                `Yangi eventlar: <b>${unread}</b>\n` +
                `Muhim alertlar: <b>${critical}</b>\n\n` +
                `${lines}`,
                { parse_mode: 'HTML', reply_markup: pack24AdminMainKeyboard() },
            );
            return;
        }

        if (text === '✅ Barchasini o\'qildi') {
            const result = await prisma.botEvent.updateMany({
                where: { status: 'new' },
                data: {
                    status: 'read',
                    processedAt: new Date(),
                },
            });

            await ctx.reply(
                `✅ ${result.count} ta hodisa o'qilgan deb belgilandi.`,
                { reply_markup: pack24AdminMainKeyboard() },
            );
            return;
        }

        if (text === '👤 Profil') {
            const unreadCount = await prisma.botEvent.count({ where: { status: 'new' } });
            await ctx.reply(
                `👤 <b>HQ admin profili</b>\n\n` +
                `Ism: <b>${hqAdmin.name}</b>\n` +
                `Telefon: <code>${hqAdmin.phone || '—'}</code>\n` +
                `Telegram: <code>${hqAdmin.telegramId || 'ulanmagan'}</code>\n` +
                `Kod: <code>${hqAdmin.registrationCode || '—'}</code>\n` +
                `Faol: ${hqAdmin.isActive ? 'ha' : 'yo\'q'}\n` +
                `Yangi hodisalar: <b>${unreadCount}</b>`,
                { parse_mode: 'HTML', reply_markup: pack24AdminMainKeyboard() },
            );
            return;
        }

        await replyWithMenu(ctx, hqAdmin.name);
    });

    pack24AdminBotInstance = bot;
    return bot;
}
