import { Telegraf, Context } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { Lang, getText, formatText } from './i18n';
import { notifyCustomer, notifyAdmin } from './notifier';
import { createBotEvent } from './botEvents';
import { createOrReuseBotAccessRequest } from './botAccessRequests';
import { applyBotDefaults } from './botInit';
import { getDriverBotToken } from './botTokens';
import {
    btn,
    driverMainKeyboard,
    driverSharePhoneKeyboard,
    taskActionKeyboard,
    calcConfirmKeyboard,
    customerConfirmKeyboard,
} from './keyboards';
import { generateUniqueTelegramRegistrationCode } from './registrationCodes';
import { createTelegramSessionStore } from './sessionStore';

// ─── Session types ────────────────────────────────────────────────────────────
interface DriverSession {
    step: 'phone' | 'menu' | 'weight' | 'discount';
    lang: Lang;
    driverId?: number;
    activeRequestId?: number;
    weight?: number;
    discount?: number;
}

const sessions = createTelegramSessionStore<DriverSession>('driver-bot-sessions');
const fmtN = (n: number) => n.toLocaleString('ru-RU');

// ─── Yagona 5 raqamli kod generatsiya ────────────────────────────────────────
async function generateUniqueDriverCode(): Promise<string> {
    return generateUniqueTelegramRegistrationCode();
}

// ─── Haydovchini bazadan olish ────────────────────────────────────────────────
async function getDriver(tgId: string) {
    return prisma.driver.findFirst({ where: { telegramId: tgId } });
}


// ─── Driver Bot init ──────────────────────────────────────────────────────────
let driverBotInstance: Telegraf | null = null;

export async function initDriverBot(): Promise<Telegraf | null> {
    if (driverBotInstance) return driverBotInstance;

    const token = getDriverBotToken();
    if (!token) {
        console.warn('[DriverBot] DRIVER_BOT_TOKEN topilmadi');
        return null;
    }

    const bot = new Telegraf(token);
    await applyBotDefaults(bot, 'DriverBot');

    // ══════════════════════════════════════════════════════════════════════
    // /start — Telefon orqali ro'yxatdan o'tish yoki bosh menyu
    // ══════════════════════════════════════════════════════════════════════
    bot.start(async (ctx) => {
        const tgId = ctx.from.id.toString();
        const driver = await getDriver(tgId);

        if (driver) {
            const lang: Lang = 'uz';
            await ctx.reply(
                formatText('drv_registered', lang, { name: driver.name }),
                { parse_mode: 'HTML', reply_markup: driverMainKeyboard(driver.isOnline, lang) }
            );
            return;
        }

        // Yangi foydalanuvchi — telefon so'rash
        sessions.set(tgId, { step: 'phone', lang: 'uz' });
        await ctx.reply(getText('drv_welcome', 'uz'), {
            parse_mode: 'HTML',
            reply_markup: driverSharePhoneKeyboard(),
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // /help
    // ══════════════════════════════════════════════════════════════════════
    bot.help(async (ctx) => {
        await ctx.reply(
            '🚚 <b>Pack24 — Haydovchi boti</b>\n\n' +
            '📋 Topshiriqlar — tayinlangan arizalar\n' +
            '✅ Qabul / ❌ Rad — qabul yoki rad qilish\n' +
            '🚚 Yo\'lga chiqdim — harakat boshlanishi\n' +
            '📍 Yetib keldim — yetib kelganingiz\n' +
            '⚖️ Kalkulyator — og\'irlik hisob-kitobi\n' +
            '📊 Kunlik hisobot — bugungi natijalar\n\n' +
            '/start — Bosh menyu',
            { parse_mode: 'HTML' }
        );
    });

    // ══════════════════════════════════════════════════════════════════════
    // CALLBACK QUERY HANDLER
    // ══════════════════════════════════════════════════════════════════════
    bot.on('callback_query', async (ctx) => {
        const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
        if (!data) return;
        const tgId = ctx.from.id.toString();

        try {
            const driver = await getDriver(tgId);
            if (!driver) {
                await ctx.answerCbQuery('❌ Ro\'yxatdan o\'tmagan');
                return;
            }

            // ── TOPSHIRIQNI QABUL QILISH ────────────────────────────────
            if (data.startsWith('accept_')) {
                const reqId = parseInt(data.replace('accept_', ''));
                const request = await prisma.recycleRequest.findUnique({
                    where: { id: reqId },
                    include: { point: true },
                });
                if (!request || request.assignedDriverId !== driver.id) {
                    await ctx.answerCbQuery('❌ Topshiriq topilmadi');
                    return;
                }

                // Status yangilash
                await prisma.recycleRequest.update({
                    where: { id: reqId },
                    data: { status: 'assigned', assignedAt: new Date() },
                });

                await prisma.driver.update({
                    where: { id: driver.id },
                    data: { status: 'busy' },
                });

                await createBotEvent({
                    sourceBot: 'driver',
                    eventType: 'request.accepted',
                    entityType: 'recycle_request',
                    entityId: reqId,
                    severity: 'success',
                    title: 'Haydovchi topshiriqni qabul qildi',
                    message: `${driver.name} ariza #${reqId} ni qabul qildi.`,
                    requestId: reqId,
                    driverId: driver.id,
                    pointId: request.point?.id ?? request.regionId,
                });

                await ctx.answerCbQuery('✅');
                await ctx.editMessageText(
                    formatText('drv_accepted', 'uz', { id: String(reqId) }),
                    { parse_mode: 'HTML' }
                );

                // Mijozga xabar
                if (request.customerTgId) {
                    const lang = (request.customerLang as Lang) || 'uz';
                    await notifyCustomer(
                        request.customerTgId,
                        formatText('notif_driver_assigned', lang, {
                            driver: driver.name,
                            phone: driver.phone,
                        })
                    );
                }
                return;
            }

            // ── TOPSHIRIQNI RAD ETISH ───────────────────────────────────
            if (data.startsWith('reject_')) {
                const reqId = parseInt(data.replace('reject_', ''));
                const request = await prisma.recycleRequest.findUnique({
                    where: { id: reqId },
                    include: { point: { include: { supervisors: { where: { isActive: true }, take: 1 } } } },
                });
                if (!request || request.assignedDriverId !== driver.id) {
                    await ctx.answerCbQuery('❌');
                    return;
                }

                // Haydovchini bo'shatish, arizani qaytarish
                await prisma.recycleRequest.update({
                    where: { id: reqId },
                    data: { status: 'new', assignedDriverId: null, assignedAt: null },
                });
                await prisma.driver.update({
                    where: { id: driver.id },
                    data: { status: 'active' },
                });

                await createBotEvent({
                    sourceBot: 'driver',
                    eventType: 'request.rejected',
                    entityType: 'recycle_request',
                    entityId: reqId,
                    severity: 'warning',
                    title: 'Haydovchi topshiriqni rad etdi',
                    message: `${driver.name} ariza #${reqId} ni rad etdi.`,
                    requestId: reqId,
                    driverId: driver.id,
                    pointId: request.point?.id ?? request.regionId,
                });

                await ctx.answerCbQuery('❌');
                await ctx.editMessageText(
                    formatText('drv_rejected', 'uz', { id: String(reqId) }),
                    { parse_mode: 'HTML' }
                );

                // Masulga xabar
                const sup = request.point?.supervisors?.[0];
                if (sup?.telegramId) {
                    await notifyAdmin(
                        sup.telegramId,
                        `⚠️ Haydovchi <b>${driver.name}</b> topshiriq <b>#${reqId}</b> ni rad etdi.\n\nQayta tayinlang.`
                    );
                }
                return;
            }

            // ── YO'LGA CHIQDIM ──────────────────────────────────────────
            if (data.startsWith('enroute_')) {
                const reqId = parseInt(data.replace('enroute_', ''));
                const request = await prisma.recycleRequest.findUnique({ where: { id: reqId } });
                if (!request || request.assignedDriverId !== driver.id) {
                    await ctx.answerCbQuery('❌');
                    return;
                }

                await prisma.recycleRequest.update({
                    where: { id: reqId },
                    data: { status: 'en_route', driverEnRouteAt: new Date() },
                });

                await createBotEvent({
                    sourceBot: 'driver',
                    eventType: 'request.en_route',
                    entityType: 'recycle_request',
                    entityId: reqId,
                    title: 'Haydovchi yo\'lga chiqdi',
                    message: `${driver.name} ariza #${reqId} uchun yo'lga chiqdi.`,
                    requestId: reqId,
                    driverId: driver.id,
                    pointId: request.regionId,
                });

                await ctx.answerCbQuery('🚚');
                await ctx.editMessageText(getText('drv_en_route', 'uz'), {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [btn('📍 Yetib keldim', `arrived_${reqId}`)],
                        ],
                    },
                });

                // Mijozga xabar
                if (request.customerTgId) {
                    const lang = (request.customerLang as Lang) || 'uz';
                    await notifyCustomer(
                        request.customerTgId,
                        formatText('notif_en_route', lang, { driver: driver.name })
                    );
                }
                return;
            }

            // ── YETIB KELDIM ────────────────────────────────────────────
            if (data.startsWith('arrived_')) {
                const reqId = parseInt(data.replace('arrived_', ''));
                const request = await prisma.recycleRequest.findUnique({ where: { id: reqId } });
                if (!request || request.assignedDriverId !== driver.id) {
                    await ctx.answerCbQuery('❌');
                    return;
                }

                await prisma.recycleRequest.update({
                    where: { id: reqId },
                    data: { status: 'arrived', driverArrivedAt: new Date() },
                });

                await createBotEvent({
                    sourceBot: 'driver',
                    eventType: 'request.arrived',
                    entityType: 'recycle_request',
                    entityId: reqId,
                    title: 'Haydovchi manzilga yetib keldi',
                    message: `${driver.name} ariza #${reqId} joyiga yetib keldi.`,
                    requestId: reqId,
                    driverId: driver.id,
                    pointId: request.regionId,
                });

                await ctx.answerCbQuery('📍');
                await ctx.editMessageText(getText('drv_arrived', 'uz'), {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [btn('⚖️ Kalkulyator', `calc_${reqId}`)],
                        ],
                    },
                });

                // Mijozga xabar
                if (request.customerTgId) {
                    const lang = (request.customerLang as Lang) || 'uz';
                    await notifyCustomer(
                        request.customerTgId,
                        formatText('notif_arrived', lang, { driver: driver.name })
                    );
                }
                return;
            }

            // ── KALKULYATOR BOSHLASH ────────────────────────────────────
            if (data.startsWith('calc_')) {
                const reqId = parseInt(data.replace('calc_', ''));
                const ses = sessions.get(tgId) || { step: 'menu' as const, lang: 'uz' as Lang };
                ses.step = 'weight';
                ses.activeRequestId = reqId;
                ses.driverId = driver.id;
                sessions.set(tgId, ses);

                await ctx.answerCbQuery('⚖️');
                await ctx.editMessageText(getText('drv_enter_weight', 'uz'), { parse_mode: 'HTML' });
                return;
            }

            // ── HISOB-KITOB TASDIQLASH ──────────────────────────────────
            if (data.startsWith('confirm_calc_')) {
                const reqId = parseInt(data.replace('confirm_calc_', ''));
                const ses = sessions.get(tgId);
                if (!ses || !ses.weight) return;

                const request = await prisma.recycleRequest.findUnique({
                    where: { id: reqId },
                    include: { point: true },
                });
                if (!request) return;

                const discount = ses.discount ?? 0;
                const pricePerKg = request.point?.pricePerKg || 800;
                const effectiveWeight = ses.weight * (1 - (discount / 100));
                const totalAmount = effectiveWeight * pricePerKg;

                // Yig'ish hisob-kitobini saqlash
                const collection = await prisma.recycleCollection.create({
                    data: {
                        requestId: reqId,
                        driverId: driver.id,
                        actualWeight: ses.weight,
                        discountPercent: discount,
                        effectiveWeight: Math.round(effectiveWeight * 100) / 100,
                        pricePerKg,
                        totalAmount: Math.round(totalAmount),
                        collectedAt: new Date(),
                    },
                });

                // Request statusini yangilash
                await prisma.recycleRequest.update({
                    where: { id: reqId },
                    data: { status: 'collecting', collectedAt: new Date() },
                });

                await createBotEvent({
                    sourceBot: 'driver',
                    eventType: 'collection.created',
                    entityType: 'recycle_collection',
                    entityId: collection.id,
                    severity: 'success',
                    title: 'Haydovchi hisob-kitobni saqladi',
                    message:
                        `${driver.name} ariza #${reqId} uchun yig'ish hisob-kitobini saqladi: ` +
                        `${Math.round(totalAmount).toLocaleString('ru-RU')} so'm.`,
                    requestId: reqId,
                    collectionId: collection.id,
                    driverId: driver.id,
                    pointId: request.point?.id ?? request.regionId,
                    payload: {
                        actualWeight: ses.weight,
                        discountPercent: discount,
                        effectiveWeight: Math.round(effectiveWeight * 100) / 100,
                        totalAmount: Math.round(totalAmount),
                    },
                });

                await ctx.answerCbQuery('✅');
                await ctx.editMessageText(getText('drv_collection_saved', 'uz'), { parse_mode: 'HTML' });

                // Mijozga hisob-kitob tasdiqini yuborish
                if (request.customerTgId) {
                    const lang = (request.customerLang as Lang) || 'uz';
                    await notifyCustomer(
                        request.customerTgId,
                        formatText('notif_calc_confirm', lang, {
                            weight: String(ses.weight),
                            discount: String(discount),
                            total: fmtN(Math.round(totalAmount)),
                        }),
                        { reply_markup: customerConfirmKeyboard(collection.id, lang as Lang) }
                    );
                }

                sessions.delete(tgId);
                return;
            }

            // ── BEKOR QILISH ────────────────────────────────────────────
            if (data === 'calc_cancel') {
                sessions.delete(tgId);
                await ctx.answerCbQuery('❌');
                await ctx.editMessageText('❌ Bekor qilindi.');
                return;
            }

        } catch (err) {
            console.error('[DriverBot] Callback error:', err);
            await ctx.answerCbQuery('❌ Xatolik').catch(() => {});
        }
    });

    // ══════════════════════════════════════════════════════════════════════
    // CONTACT HANDLER — Telefon raqami ulashilganda
    // ══════════════════════════════════════════════════════════════════════
    bot.on('contact', async (ctx) => {
        const tgId = ctx.from.id.toString();

        // Faqat o'z kontaktini qabul qilish
        if (ctx.message.contact.user_id && ctx.message.contact.user_id !== ctx.from.id) {
            await ctx.reply('❌ Iltimos, faqat o\'z telefon raqamingizni ulashing.', {
                reply_markup: driverSharePhoneKeyboard(),
            });
            return;
        }

        let phone = ctx.message.contact.phone_number.replace(/[^0-9+]/g, '');
        if (!phone.startsWith('+')) phone = '+' + phone;

        try {
            // Haydovchini telefon raqami bilan topish
            const driver = await prisma.driver.findFirst({
                where: {
                    OR: [
                        { phone },
                        { phone: phone.replace('+', '') },
                        { phone: phone.replace('+998', '0') },
                        { phone: phone.slice(-9) },
                    ],
                },
                include: { point: true, supervisor: true },
            });

            if (!driver) {
                const result = await createOrReuseBotAccessRequest({
                    role: 'driver',
                    name: ctx.from.first_name || ctx.from.username || 'Driver nomzod',
                    phone,
                    telegramId: tgId,
                    telegramName: ctx.from.username || ctx.from.first_name || null,
                    sourceBot: 'driver',
                });

                if (result.kind === 'pending') {
                    await ctx.reply(
                        `⏳ <b>Arizangiz allaqachon ko'rib chiqilmoqda.</b>\n\n` +
                        `📱 Telefon: <code>${phone}</code>\n` +
                        `Admin tasdiqlagandan keyin sizga xabar beriladi.`,
                        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } },
                    );
                    sessions.delete(tgId);
                    return;
                }

                await ctx.reply(
                    `✅ <b>Driver bo'lish uchun ariza qabul qilindi.</b>\n\n` +
                    `📱 Telefon: <code>${phone}</code>\n\n` +
                    `Admin arizangizni tasdiqlagandan keyin ushbu bot orqali ishlashingiz mumkin bo'ladi.`,
                    { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
                );
                sessions.delete(tgId);
                return;
            }

            // Boshqa akkauntga ulanganmi?
            if (driver.telegramId && driver.telegramId !== tgId) {
                await ctx.reply(getText('drv_already_registered', 'uz'), {
                    parse_mode: 'HTML',
                    reply_markup: { remove_keyboard: true },
                });
                return;
            }

            // Yangi 5-raqamli kod generatsiya
            const code = await generateUniqueDriverCode();

            // Bazaga saqlash
            await prisma.driver.update({
                where: { id: driver.id },
                data: {
                    telegramId: tgId,
                    telegramName: ctx.from.username || ctx.from.first_name || null,
                    registeredAt: new Date(),
                    registrationCode: code,
                    isOnline: true,
                    lastSeenAt: new Date(),
                    status: 'active',
                },
            });

            await createBotEvent({
                sourceBot: 'driver',
                eventType: 'driver.registered',
                entityType: 'driver',
                entityId: driver.id,
                severity: 'success',
                title: 'Haydovchi botga ro\'yxatdan o\'tdi',
                message: `${driver.name} driver botga ulandi.`,
                driverId: driver.id,
                supervisorId: driver.supervisorId ?? undefined,
                pointId: driver.pointId ?? undefined,
                payload: {
                    phone: driver.phone,
                    registrationCode: code,
                },
            });

            sessions.delete(tgId);

            // Foydalanuvchiga kod yuborish
            await ctx.reply(
                formatText('drv_code_sent', 'uz', { name: driver.name, code }),
                {
                    parse_mode: 'HTML',
                    reply_markup: driverMainKeyboard(true, 'uz'),
                }
            );

            // Masulga xabar yuborish (agar bog'langan bo'lsa)
            if (driver.supervisor?.telegramId) {
                await notifyAdmin(
                    driver.supervisor.telegramId,
                    `🆕 <b>Haydovchi ro'yxatdan o'tdi!</b>\n\n` +
                    `👤 ${driver.name}\n` +
                    `📞 ${driver.phone}\n` +
                    `🏭 Punkt: ${driver.point?.regionUz || '—'}\n` +
                    `🔑 Verifikatsion kod: <code>${code}</code>\n` +
                    `🕐 ${new Date().toLocaleString('ru-RU')}`
                );
            }

            console.log(`[DriverBot] ✅ Haydovchi ro'yxatdan o'tdi: ${driver.name} | Kod: ${code}`);

        } catch (err) {
            console.error('[DriverBot] Contact handler xatolik:', err);
            await ctx.reply('❌ Xatolik yuz berdi. Qayta urinib ko\'ring.', {
                reply_markup: { remove_keyboard: true },
            });
        }
    });

    // ══════════════════════════════════════════════════════════════════════
    // TEXT HANDLER
    // ══════════════════════════════════════════════════════════════════════
    bot.on('text', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const text = ctx.message.text;

        if (text.startsWith('/')) return;

        const ses = sessions.get(tgId);

        // Ro'yxatdan o'tmagan foydalanuvchi — /start ga yo'naltirish
        const driver = await getDriver(tgId);
        if (!driver) {
            await ctx.reply(
                '❌ Siz haydovchi sifatida ro\'yxatdan o\'tmagansiz.\n\n/start bosing va telefon raqamingizni ulashing.',
                { parse_mode: 'HTML' }
            );
            return;
        }

        // ── OG'IRLIK KIRITISH ──────────────────────────────────────────
        if (ses?.step === 'weight') {
            const weight = parseFloat(text.replace(',', '.'));
            if (isNaN(weight) || weight <= 0 || weight > 99999) {
                await ctx.reply('❌ Noto\'g\'ri og\'irlik! Musbat son kiriting.\n<i>Masalan: 45.5</i>', { parse_mode: 'HTML' });
                return;
            }
            ses.weight = weight;
            ses.step = 'discount';
            await ctx.reply(getText('drv_enter_discount', 'uz'), { parse_mode: 'HTML' });
            return;
        }

        // ── CHEGIRMA KIRITISH ──────────────────────────────────────────
        if (ses?.step === 'discount') {
            const discount = parseFloat(text.replace(',', '.'));
            if (isNaN(discount) || discount < 0 || discount > 100) {
                await ctx.reply('❌ 0-100 orasida raqam kiriting!');
                return;
            }

            const reqId = ses.activeRequestId!;
            const request = await prisma.recycleRequest.findUnique({
                where: { id: reqId },
                include: { point: true },
            });
            if (!request) {
                sessions.delete(tgId);
                await ctx.reply('❌ Ariza topilmadi.');
                return;
            }

            const pricePerKg = request.point?.pricePerKg || 800;
            const effectiveWeight = ses.weight! * (1 - (discount / 100));
            const totalAmount = effectiveWeight * pricePerKg;

            // Hisob-kitob natijasini ko'rsatish
            await ctx.reply(
                formatText('drv_calc_result', 'uz', {
                    weight: String(ses.weight),
                    discount: String(discount),
                    effective: String(Math.round(effectiveWeight * 100) / 100),
                    price: fmtN(pricePerKg),
                    total: fmtN(Math.round(totalAmount)),
                }),
                { parse_mode: 'HTML', reply_markup: calcConfirmKeyboard(reqId) }
            );

            // Sessionga discount saqlash (confirm_calc da ishlatiladi)
            ses.discount = discount;
            return;
        }

        // ── MENYU TUGMALARI ────────────────────────────────────────────
        const lang: Lang = 'uz';

        // 📋 Topshiriqlar
        if (text === getText('drv_btn_tasks', lang) || text === getText('drv_btn_tasks', 'ru') || text === getText('drv_btn_tasks', 'en')) {
            const tasks = await prisma.recycleRequest.findMany({
                where: {
                    assignedDriverId: driver.id,
                    status: { in: ['assigned', 'en_route', 'arrived'] },
                },
                include: { point: true },
                orderBy: { createdAt: 'desc' },
                take: 10,
            });

            if (tasks.length === 0) {
                await ctx.reply(getText('drv_no_tasks', lang));
                return;
            }

            for (const task of tasks) {
                const volLabel = task.volumeSize === 'small' ? '📦 Kichik' :
                    task.volumeSize === 'medium' ? '📦📦 O\'rta' : '📦📦📦 Katta';
                const info = formatText('drv_task_info', lang, {
                    id: String(task.id),
                    name: task.name,
                    phone: task.phone,
                    region: task.point?.regionUz || '—',
                    volume: volLabel,
                    photo: task.photoUrl ? 'Bor ✅' : 'Yo\'q',
                    time: new Date(task.createdAt).toLocaleString('ru-RU'),
                });

                const buttons: any[][] = [];
                if (task.status === 'assigned') {
                    buttons.push([
                        btn('✅ Qabul', `accept_${task.id}`),
                        btn('❌ Rad', `reject_${task.id}`),
                    ]);
                    buttons.push([btn('🚚 Yo\'lga chiqdim', `enroute_${task.id}`)]);
                } else if (task.status === 'en_route') {
                    buttons.push([btn('📍 Yetib keldim', `arrived_${task.id}`)]);
                } else if (task.status === 'arrived') {
                    buttons.push([btn('⚖️ Kalkulyator', `calc_${task.id}`)]);
                }

                await ctx.reply(info, {
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: buttons },
                });
            }
            return;
        }

        // 🟢/🔴 Online/Offline
        if (text === getText('drv_btn_online', lang) || text === getText('drv_btn_online', 'ru') || text === getText('drv_btn_online', 'en')) {
            await prisma.driver.update({
                where: { id: driver.id },
                data: { isOnline: true, lastSeenAt: new Date(), status: 'active' },
            });
            await createBotEvent({
                sourceBot: 'driver',
                eventType: 'driver.online',
                entityType: 'driver',
                entityId: driver.id,
                title: 'Haydovchi online holatga o\'tdi',
                message: `${driver.name} online holatga o'tdi.`,
                driverId: driver.id,
                supervisorId: driver.supervisorId ?? undefined,
                pointId: driver.pointId ?? undefined,
            });
            await ctx.reply('🟢 Siz endi <b>online</b>siz!', {
                parse_mode: 'HTML',
                reply_markup: driverMainKeyboard(true, lang),
            });
            return;
        }

        if (text === getText('drv_btn_offline', lang) || text === getText('drv_btn_offline', 'ru') || text === getText('drv_btn_offline', 'en')) {
            await prisma.driver.update({
                where: { id: driver.id },
                data: { isOnline: false, lastSeenAt: new Date(), status: 'inactive' },
            });
            await createBotEvent({
                sourceBot: 'driver',
                eventType: 'driver.offline',
                entityType: 'driver',
                entityId: driver.id,
                severity: 'warning',
                title: 'Haydovchi offline holatga o\'tdi',
                message: `${driver.name} offline holatga o'tdi.`,
                driverId: driver.id,
                supervisorId: driver.supervisorId ?? undefined,
                pointId: driver.pointId ?? undefined,
            });
            await ctx.reply('🔴 Siz endi <b>offline</b>siz.', {
                parse_mode: 'HTML',
                reply_markup: driverMainKeyboard(false, lang),
            });
            return;
        }

        // 📊 Kunlik hisobot
        if (text === getText('drv_btn_report', lang) || text === getText('drv_btn_report', 'ru') || text === getText('drv_btn_report', 'en')) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const todayTasks = await prisma.recycleRequest.count({
                where: {
                    assignedDriverId: driver.id,
                    assignedAt: { gte: today },
                },
            });

            const todayCompleted = await prisma.recycleRequest.count({
                where: {
                    assignedDriverId: driver.id,
                    status: { in: ['completed', 'collecting'] },
                    completedAt: { gte: today },
                },
            });

            const collections = await prisma.recycleCollection.findMany({
                where: {
                    driverId: driver.id,
                    createdAt: { gte: today },
                },
            });

            const totalWeight = collections.reduce((s, c) => s + c.actualWeight, 0);
            const totalAmount = collections.reduce((s, c) => s + c.totalAmount, 0);

            await ctx.reply(
                formatText('drv_report', lang, {
                    date: new Date().toLocaleDateString('ru-RU'),
                    tasks: String(todayTasks),
                    completed: String(todayCompleted),
                    weight: String(Math.round(totalWeight * 10) / 10),
                    amount: fmtN(Math.round(totalAmount)),
                }),
                { parse_mode: 'HTML' }
            );
            return;
        }

        // 👤 Profil
        if (text === getText('drv_btn_profile', lang) || text === getText('drv_btn_profile', 'ru') || text === getText('drv_btn_profile', 'en')) {
            const totalCollections = await prisma.recycleCollection.count({
                where: { driverId: driver.id },
            });
            const totalWeight = await prisma.recycleCollection.aggregate({
                where: { driverId: driver.id },
                _sum: { actualWeight: true },
            });

            await ctx.reply(
                `👤 <b>Profilingiz</b>\n\n` +
                `📛 Ism: <b>${driver.name}</b>\n` +
                `📞 Telefon: ${driver.phone}\n` +
                `🚗 Mashina: ${driver.vehicleInfo || 'Ko\'rsatilmagan'}\n` +
                `📊 Holat: ${driver.isOnline ? '🟢 Online' : '🔴 Offline'}\n\n` +
                `📈 <b>Statistika:</b>\n` +
                `🔢 Jami yig\'ishlar: ${totalCollections}\n` +
                `⚖️ Jami og\'irlik: ${fmtN(Math.round((totalWeight._sum.actualWeight || 0) * 10) / 10)} kg\n` +
                `📅 Ro\'yxatdan: ${driver.registeredAt ? new Date(driver.registeredAt).toLocaleDateString('ru-RU') : '—'}`,
                { parse_mode: 'HTML' }
            );
            return;
        }
    });

    driverBotInstance = bot;
    return bot;
}
