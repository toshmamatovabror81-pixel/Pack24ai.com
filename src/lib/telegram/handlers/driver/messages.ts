import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { getDriver, generateUniqueDriverCode, sessions } from './helpers';
import { Lang, getText, formatText } from '../../i18n';
import { btn, driverMainKeyboard, driverSharePhoneKeyboard, calcConfirmKeyboard } from '../../keyboards';
import { notifyAdmin } from '../../notifier';
import { createBotEvent } from '../../botEvents';
import { createOrReuseBotAccessRequest } from '../../botAccessRequests';
import { fmtN } from './types';

export function registerMessageHandlers(bot: Telegraf) {
    // LOCATION HANDLER — GPS tracking
    bot.on('location', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const { latitude, longitude } = ctx.message.location;
        const driver = await getDriver(tgId);
        if (!driver) return;

        await prisma.driver.update({
            where: { id: driver.id },
            data: {
                lastLat: latitude,
                lastLng: longitude,
                lastSeenAt: new Date(),
            },
        });

        await ctx.reply(
            `📍 Joylashuvingiz yangilandi\n` +
            `🕐 ${new Date().toLocaleTimeString('ru-RU')}`,
            { reply_markup: driverMainKeyboard(driver.isOnline, 'uz') }
        );
    });

    // CONTACT HANDLER
    bot.on('contact', async (ctx) => {
        const tgId = ctx.from.id.toString();

        if (ctx.message.contact.user_id && ctx.message.contact.user_id !== ctx.from.id) {
            await ctx.reply('❌ Iltimos, faqat o\'z telefon raqamingizni ulashing.', {
                reply_markup: driverSharePhoneKeyboard(),
            });
            return;
        }

        let phone = ctx.message.contact.phone_number.replace(/[^0-9+]/g, '');
        if (!phone.startsWith('+')) phone = '+' + phone;

        try {
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

            // Telegram ID boshqa bo'lsa — yangilash (qurilma/akkaunt almashuvi)
            if (driver.telegramId && driver.telegramId.trim() !== tgId) {
                console.log(`[DriverBot] telegramId yangilanmoqda: ${driver.telegramId.trim()} → ${tgId}`);
            }

            const code = await generateUniqueDriverCode();

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

            await ctx.reply(
                formatText('drv_code_sent', 'uz', { name: driver.name, code }),
                {
                    parse_mode: 'HTML',
                    reply_markup: driverMainKeyboard(true, 'uz'),
                }
            );

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

    // TEXT HANDLER
    bot.on('text', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const text = ctx.message.text;

        if (text.startsWith('/')) return;

        const ses = sessions.get(tgId);
        const driver = await getDriver(tgId);
        if (!driver) {
            await ctx.reply(
                '❌ Siz haydovchi sifatida ro\'yxatdan o\'tmagansiz.\n\n/start bosing va telefon raqamingizni ulashing.',
                { parse_mode: 'HTML' }
            );
            return;
        }

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

            ses.discount = discount;
            return;
        }

        const lang: Lang = 'uz';

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
}
