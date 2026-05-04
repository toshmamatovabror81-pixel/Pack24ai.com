import { Telegraf, Context } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { Lang, getText, formatText } from './i18n';
import { haversineDistance } from './geo';
import { notifyAdmin } from './notifier';
import { createBotEvent } from './botEvents';
import { applyBotDefaults } from './botInit';
import { getCustomerBotToken } from './botTokens';
import {
    btn,
    customerMainKeyboard,
    langSelectKeyboard,
    sharePhoneKeyboard,
    shareLocationKeyboard,
    recycleMethodKeyboard,
    volumeKeyboard,
    photoOrSkipKeyboard,
    customerConfirmKeyboard,
    cabinetMenuKeyboard,
} from './keyboards';
import bcrypt from 'bcryptjs';

// ─── Extracted modules ────────────────────────────────────────────────────────
import { MAT, fmtN } from './handlers/customer/types';
import type { CustomerSession } from './handlers/customer/types';
import {
    sessions,
    registrationSessions,
    generateOtp,
    getUserLang,
    getUserByTgId,
    generateUniqueUserCode,
    normalizePhone,
} from './handlers/customer/helpers';
import { submitTruckRequest, handleRegistrationCode } from './handlers/customer/truckRequest';



// ─── Customer Bot init ────────────────────────────────────────────────────────
let customerBotInstance: Telegraf | null = null;

export function resetInitializedCustomerBot() {
    if (customerBotInstance) {
        try {
            customerBotInstance.stop('reset');
        } catch {}
    }

    customerBotInstance = null;
}

export async function initCustomerBot(): Promise<Telegraf | null> {
    if (customerBotInstance) return customerBotInstance;

    const token = await getCustomerBotToken();
    if (!token) {
        console.warn('[CustomerBot] CUSTOMER_BOT_TOKEN topilmadi (.env yoki TelegramConfig)');
        return null;
    }

    const bot = new Telegraf(token);
    await applyBotDefaults(bot, 'CustomerBot');

    // ══════════════════════════════════════════════════════════════════════
    // /start — Shaxsiy kabinet yoki ro'yxatdan o'tish
    // ══════════════════════════════════════════════════════════════════════
    bot.start(async (ctx) => {
        const tgId = ctx.from.id.toString();

        // 1. Telegram ID bilan ro'yxatdan o'tgan foydalanuvchi
        const user = await getUserByTgId(tgId);
        if (user) {
            const lang = (sessions.get(tgId)?.lang || 'uz') as Lang;
            sessions.set(tgId, { step: 'menu', lang });
            await ctx.reply(
                formatText('cabinet_menu', lang, {
                    name: user.name,
                    phone: user.phone,
                    points: String(user.ecoPoints),
                }),
                { parse_mode: 'HTML', reply_markup: cabinetMenuKeyboard(lang) }
            );
            await ctx.reply(
                lang === 'uz' ? '⬇️ Yoki quyidagi xizmatlardan foydalaning:' :
                lang === 'ru' ? '⬇️ Или воспользуйтесь услугами:' :
                '⬇️ Or use our services below:',
                { reply_markup: customerMainKeyboard(lang) }
            );
            return;
        }

        // 2. Yangi foydalanuvchi — til tanlash
        sessions.set(tgId, { step: 'lang', lang: 'uz' });
        await ctx.reply(
            getText('welcome', 'uz'),
            { parse_mode: 'HTML', reply_markup: langSelectKeyboard() }
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
            // ── TIL TANLASH → Telefon so'rash ────────────────────────────
            if (data.startsWith('lang_')) {
                const lang = data.replace('lang_', '') as Lang;
                const existingSession = sessions.get(tgId);
                const user = await getUserByTgId(tgId);

                await ctx.answerCbQuery('✅');

                if (user || existingSession?.step === 'menu') {
                    sessions.set(tgId, { step: 'menu', lang, name: user?.name });
                    await ctx.editMessageText(
                        lang === 'uz'
                            ? '✅ Til yangilandi.'
                            : lang === 'ru'
                            ? '✅ Язык обновлен.'
                            : '✅ Language updated.',
                        { parse_mode: 'HTML' }
                    );
                    await ctx.reply(
                        user
                            ? formatText('cabinet_menu', lang, {
                                name: user.name,
                                phone: user.phone,
                                points: String(user.ecoPoints),
                            })
                            : getText('register_success', lang),
                        {
                            parse_mode: 'HTML',
                            reply_markup: user ? cabinetMenuKeyboard(lang) : undefined,
                        }
                    );
                    await ctx.reply(
                        lang === 'uz'
                            ? '⬇️ Yoki quyidagi xizmatlardan foydalaning:'
                            : lang === 'ru'
                            ? '⬇️ Или воспользуйтесь услугами:'
                            : '⬇️ Or use our services below:',
                        { reply_markup: customerMainKeyboard(lang) }
                    );
                    return;
                }

                const ses: CustomerSession = { step: 'reg_phone', lang };
                sessions.set(tgId, ses);
                await ctx.editMessageText(getText('reg_ask_phone', lang), { parse_mode: 'HTML' });
                await ctx.reply('👇', { reply_markup: sharePhoneKeyboard(lang) });
                return;
            }

            // ── KABINET TUGMALARI ────────────────────────────────────────
            if (data.startsWith('cab_')) {
                const user = await getUserByTgId(tgId);
                const lang = (sessions.get(tgId)?.lang || 'uz') as Lang;

                if (!user) {
                    await ctx.answerCbQuery('❌');
                    return;
                }

                if (data === 'cab_show_code') {
                    await ctx.answerCbQuery('🔑');
                    await ctx.reply(
                        lang === 'uz'
                            ? `🔑 <b>Kirish kodingiz:</b> <code>${user.telegramCode || '—'}</code>\n\n📱 Telefon: <b>${user.phone}</b>\n\n🌐 <b>pack24.ai</b> saytida ushbu kod va telefon bilan kiring.`
                            : lang === 'ru'
                            ? `🔑 <b>Ваш код входа:</b> <code>${user.telegramCode || '—'}</code>\n\n📱 Телефон: <b>${user.phone}</b>\n\n🌐 Войдите на <b>pack24.ai</b> с этим кодом и телефоном.`
                            : `🔑 <b>Your login code:</b> <code>${user.telegramCode || '—'}</code>\n\n📱 Phone: <b>${user.phone}</b>\n\n🌐 Use this code at <b>pack24.ai</b> to login.`,
                        { parse_mode: 'HTML' }
                    );
                    return;
                }

                if (data === 'cab_recycling') {
                    await ctx.answerCbQuery('♻️');
                    const reqs = await prisma.recycleRequest.findMany({
                        where: { customerTgId: tgId },
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                        include: { point: true },
                    });
                    if (reqs.length === 0) {
                        await ctx.reply(lang === 'uz' ? '♻️ Hali makulatura topshirmadingiz.' : '♻️ Нет истории сдачи макулатуры.');
                        return;
                    }
                    const stMap: Record<string, string> = { new: '🔵', dispatched: '📋', assigned: '🚚', en_route: '🚚', arrived: '📍', collecting: '⚖️', completed: '✅', cancelled: '❌' };
                    const list = reqs.map(r => `${stMap[r.status] || '⚪'} <b>#${r.id}</b> — ${r.point?.regionUz || '—'} — ${new Date(r.createdAt).toLocaleDateString('ru-RU')}`).join('\n');
                    await ctx.reply(`♻️ <b>${lang === 'uz' ? 'Makulatura tarixi' : 'История макулатуры'}:</b>\n\n${list}`, { parse_mode: 'HTML' });
                    return;
                }

                if (data === 'cab_orders') {
                    await ctx.answerCbQuery('📦');
                    const orders = await prisma.order.findMany({
                        where: { userId: user.id },
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                    });
                    if (orders.length === 0) {
                        await ctx.reply(lang === 'uz' ? '📦 Hali buyurtma bermagansiz.' : '📦 Нет заказов.');
                        return;
                    }
                    const list = orders.map(o => `📦 <b>#${o.id}</b> — ${o.status} — ${o.totalAmount.toLocaleString('ru-RU')} so'm — ${new Date(o.createdAt).toLocaleDateString('ru-RU')}`).join('\n');
                    await ctx.reply(`📦 <b>${lang === 'uz' ? 'Buyurtmalaringiz' : 'Ваши заказы'}:</b>\n\n${list}`, { parse_mode: 'HTML' });
                    return;
                }

                if (data === 'cab_referral') {
                    await ctx.answerCbQuery('👥');
                    const refCount = await prisma.user.count({ where: { referredById: user.id } });
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pack24.ai';
                    await ctx.reply(
                        lang === 'uz'
                            ? `👥 <b>Referral dastur</b>\n\nSizning kod: <code>${user.referralCode || '—'}</code>\nTaklif qilganlar: <b>${refCount} kishi</b>\n\n🔗 Havola: ${appUrl}/referral?ref=${user.referralCode || ''}`
                            : `👥 <b>Реферальная программа</b>\n\nВаш код: <code>${user.referralCode || '—'}</code>\nПриглашено: <b>${refCount} чел.</b>\n\n🔗 Ссылка: ${appUrl}/referral?ref=${user.referralCode || ''}`,
                        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
                    );
                    return;
                }

                if (data === 'cab_settings') {
                    await ctx.answerCbQuery('⚙️');
                    await ctx.reply(
                        lang === 'uz'
                            ? `⚙️ <b>Sozlamalar</b>\n\n👤 Ism: <b>${user.name}</b>\n📱 Telefon: <b>${user.phone}</b>\n🌐 Til: O\'zbek\n\n✏️ O\'zgartirish uchun <b>pack24.ai</b> saytiga kiring.`
                            : `⚙️ <b>Настройки</b>\n\n👤 Имя: <b>${user.name}</b>\n📱 Телефон: <b>${user.phone}</b>\n\n✏️ Для изменений войдите на <b>pack24.ai</b>`,
                        { parse_mode: 'HTML' }
                    );
                    return;
                }

                await ctx.answerCbQuery();
                return;
            }

            // ── BEKOR QILISH ─────────────────────────────────────────────
            if (data === 'reg_cancel' || data === 'register_cancel') {
                registrationSessions.delete(tgId);
                sessions.delete(tgId);
                await ctx.answerCbQuery('❌');
                const lang = (sessions.get(tgId)?.lang || 'uz') as Lang;
                await ctx.editMessageText(
                    lang === 'ru' ? '❌ Отменено. Нажмите /start чтобы начать заново.' : '❌ Bekor qilindi. Qayta boshlash uchun /start bosing.'
                );
                return;
            }

            // ── MAKULATURA XIZMATI: usul tanlash ────────────────────────
            if (data === 'recycle_self') {
                const ses = sessions.get(tgId);
                if (!ses || ses.lat === undefined || ses.lng === undefined) return;
                ses.pickupType = 'base';
                ses.step = 'done';

                await ctx.answerCbQuery('🏭');

                // Eng yaqin punkt hisoblash
                const points = await prisma.recyclePoint.findMany({
                    where: { status: 'active' },
                    include: { supervisors: { where: { isActive: true }, take: 1 } },
                });

                if (points.length === 0) {
                    const lang = ses.lang;
                    await ctx.editMessageText(
                        lang === 'uz' ? '❌ Hozircha aktiv yig\'ish punktlari yo\'q.' :
                        lang === 'ru' ? '❌ Пока нет активных пунктов приёма.' :
                        '❌ No active collection points available.',
                        { parse_mode: 'HTML' }
                    );
                    sessions.delete(tgId);
                    return;
                }

                const pointsWithDist = points.map(p => ({
                    ...p,
                    distance: (p.lat && p.lng) ? haversineDistance(ses.lat!, ses.lng!, p.lat, p.lng) : 9999,
                })).sort((a, b) => a.distance - b.distance);

                const nearest = pointsWithDist[0];
                const sup = nearest.supervisors[0];
                const lang = ses.lang;

                const statusText = nearest.isAccepting
                    ? getText('point_open', lang)
                    : getText('point_closed', lang);

                const pricesText = Object.entries(MAT).map(([, m]) =>
                    `  ${m.emoji} ${m.label[lang]}: <b>${fmtN(m.price)} so'm/kg</b>`
                ).join('\n');

                const info = formatText('nearest_point', lang, {
                    name: nearest.regionUz,
                    distance: String(nearest.distance),
                    schedule: nearest.workingHours || '08:00-18:00',
                    status: statusText,
                    prices: pricesText,
                    supervisor: sup?.name || '—',
                    phone: sup?.phone || '—',
                    telegram: sup?.telegramName || '—',
                });

                await ctx.editMessageText(info, { parse_mode: 'HTML' });

                // Lokatsiyani yuborish
                if (nearest.lat && nearest.lng) {
                    await ctx.reply('📍', {
                        reply_markup: { remove_keyboard: true },
                    });
                    await bot.telegram.sendLocation(ctx.chat!.id, nearest.lat, nearest.lng);
                }

                // Agar yopiq bo'lsa — keyingi eng yaqinini taklif qilish
                if (!nearest.isAccepting && pointsWithDist.length > 1) {
                    const next = pointsWithDist.find(p => p.id !== nearest.id && p.isAccepting);
                    if (next) {
                        const nextMsg = lang === 'uz'
                            ? `💡 Eng yaqin <b>ochiq</b> punkt: <b>${next.regionUz}</b> (~${next.distance} km)`
                            : lang === 'ru'
                            ? `💡 Ближайший <b>открытый</b> пункт: <b>${next.regionUz}</b> (~${next.distance} км)`
                            : `💡 Nearest <b>open</b> point: <b>${next.regionUz}</b> (~${next.distance} km)`;
                        await ctx.reply(nextMsg, { parse_mode: 'HTML' });
                    }
                }

                sessions.delete(tgId);
                return;
            }

            // ── MASHINA CHAQIRISH: boshlash ─────────────────────────────
            if (data === 'recycle_truck') {
                const ses = sessions.get(tgId);
                if (!ses || ses.lat === undefined || ses.lng === undefined) return;
                ses.pickupType = 'pickup';
                ses.step = 'volume';

                await ctx.answerCbQuery('🚛');
                const lang = ses.lang;
                await ctx.editMessageText(
                    getText('truck_volume', lang),
                    { parse_mode: 'HTML', reply_markup: volumeKeyboard(lang) }
                );
                return;
            }

            // ── HAJM TANLASH ────────────────────────────────────────────
            if (data.startsWith('vol_')) {
                const ses = sessions.get(tgId);
                if (!ses || ses.step !== 'volume') return;
                ses.volumeSize = data.replace('vol_', '');
                ses.step = 'photo';
                const lang = ses.lang;

                await ctx.answerCbQuery('✅');
                await ctx.editMessageText(
                    getText('truck_photo', lang),
                    { parse_mode: 'HTML', reply_markup: photoOrSkipKeyboard(lang) }
                );
                return;
            }

            // ── RASMNI O'TKAZIB YUBORISH ────────────────────────────────
            if (data === 'skip_photo') {
                const ses = sessions.get(tgId);
                if (!ses) return;
                await submitTruckRequest(ctx, bot, ses, tgId);
                return;
            }

            // ── BEKOR QILISH ────────────────────────────────────────────
            if (data === 'recycle_cancel') {
                sessions.delete(tgId);
                const lang = await getUserLang(tgId);
                await ctx.answerCbQuery('❌');
                await ctx.editMessageText(
                    lang === 'uz' ? '❌ Bekor qilindi.' : lang === 'ru' ? '❌ Отменено.' : '❌ Cancelled.'
                );
                return;
            }

            // ── MIJOZ: HISOB-KITOBNI TASDIQLASH ────────────────────────
            if (data.startsWith('cust_confirm_')) {
                const collId = parseInt(data.replace('cust_confirm_', ''));
                const collection = await prisma.recycleCollection.findUnique({
                    where: { id: collId },
                    include: { request: true, driver: true },
                });
                if (!collection) {
                    await ctx.answerCbQuery('❌ Topilmadi');
                    return;
                }

                const lang = (collection.request.customerLang as Lang) || 'uz';

                await prisma.recycleCollection.update({
                    where: { id: collId },
                    data: { customerConfirmed: true },
                });

                await prisma.recycleRequest.update({
                    where: { id: collection.requestId },
                    data: { status: 'confirmed', confirmedAt: new Date() },
                });

                await createBotEvent({
                    sourceBot: 'customer',
                    eventType: 'collection.confirmed',
                    entityType: 'recycle_collection',
                    entityId: collId,
                    severity: 'success',
                    title: 'Mijoz hisob-kitobni tasdiqladi',
                    message: `${collection.request.name} ariza #${collection.requestId} hisob-kitobini tasdiqladi.`,
                    requestId: collection.requestId,
                    collectionId: collection.id,
                    driverId: collection.driverId,
                    supervisorId: collection.request.supervisorId ?? undefined,
                });

                await ctx.answerCbQuery('✅');
                await ctx.editMessageText(
                    lang === 'uz'
                        ? `✅ <b>Tasdiqlandi!</b>\n\n⚖️ Og'irlik: <b>${collection.actualWeight} kg</b>\n💰 Jami: <b>${collection.totalAmount.toLocaleString('ru-RU')} so'm</b>\n\nTo'lov masul tomonidan amalga oshiriladi. ♻️`
                        : lang === 'ru'
                        ? `✅ <b>Подтверждено!</b>\n\n⚖️ Вес: <b>${collection.actualWeight} кг</b>\n💰 Итого: <b>${collection.totalAmount.toLocaleString('ru-RU')} сум</b>\n\nОплата будет произведена ответственным. ♻️`
                        : `✅ <b>Confirmed!</b>\n\n⚖️ Weight: <b>${collection.actualWeight} kg</b>\n💰 Total: <b>${collection.totalAmount.toLocaleString('ru-RU')} UZS</b>\n\nPayment will be made by the supervisor. ♻️`,
                    { parse_mode: 'HTML' }
                );

                // Masulga xabar yuborish (customerTgId bo'yicha supervisor topish)
                if (collection.request.supervisorId) {
                    const sup = await prisma.supervisor.findUnique({
                        where: { id: collection.request.supervisorId },
                    });
                    if (sup?.telegramId) {
                        await notifyAdmin(
                            sup.telegramId,
                            `✅ <b>Mijoz tasdiqladi — Ariza #${collection.requestId}</b>\n\n` +
                            `👤 ${collection.request.name}\n` +
                            `⚖️ ${collection.actualWeight} kg → ${collection.effectiveWeight} kg\n` +
                            `💰 ${collection.totalAmount.toLocaleString('ru-RU')} so'm\n\n` +
                            `To'lovni tasdiqlang 👇`,
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '✅ To\'lovni tasdiqlash', callback_data: `approve_payment_${collId}` }],
                                    ],
                                },
                            }
                        );
                    }
                }
                return;
            }

            // ── MIJOZ: HISOB-KITOBNI INKOR QILISH ──────────────────────
            if (data.startsWith('cust_reject_')) {
                const collId = parseInt(data.replace('cust_reject_', ''));
                const collection = await prisma.recycleCollection.findUnique({
                    where: { id: collId },
                    include: { request: true, driver: true },
                });
                if (!collection) {
                    await ctx.answerCbQuery('❌ Topilmadi');
                    return;
                }

                const lang = (collection.request.customerLang as Lang) || 'uz';

                await prisma.recycleCollection.update({
                    where: { id: collId },
                    data: { customerConfirmed: false },
                });

                await prisma.recycleRequest.update({
                    where: { id: collection.requestId },
                    data: { status: 'disputed' },
                });

                await createBotEvent({
                    sourceBot: 'customer',
                    eventType: 'collection.disputed',
                    entityType: 'recycle_collection',
                    entityId: collId,
                    severity: 'warning',
                    title: 'Mijoz hisob-kitobni inkor qildi',
                    message: `${collection.request.name} ariza #${collection.requestId} bo'yicha hisob-kitobni inkor qildi.`,
                    requestId: collection.requestId,
                    collectionId: collection.id,
                    driverId: collection.driverId,
                    supervisorId: collection.request.supervisorId ?? undefined,
                });

                await ctx.answerCbQuery('❌');
                await ctx.editMessageText(
                    lang === 'uz'
                        ? `❌ <b>Inkor qildingiz.</b>\n\nMasul bilan bog'lanib muammoni hal qiladi. Tez orada siz bilan aloqaga chiqiladi.`
                        : lang === 'ru'
                        ? `❌ <b>Вы отклонили.</b>\n\nОтветственный свяжется с вами для решения вопроса.`
                        : `❌ <b>Rejected.</b>\n\nThe supervisor will contact you to resolve the issue.`,
                    { parse_mode: 'HTML' }
                );

                // Masulga xabar
                if (collection.request.supervisorId) {
                    const sup = await prisma.supervisor.findUnique({
                        where: { id: collection.request.supervisorId },
                    });
                    if (sup?.telegramId) {
                        await notifyAdmin(
                            sup.telegramId,
                            `⚠️ <b>Mijoz inkor qildi — Ariza #${collection.requestId}</b>\n\n` +
                            `👤 ${collection.request.name} (${collection.request.phone})\n` +
                            `🚚 Haydovchi: ${collection.driver?.name || '—'}\n` +
                            `⚖️ ${collection.actualWeight} kg → ${collection.effectiveWeight} kg\n` +
                            `💰 ${collection.totalAmount.toLocaleString('ru-RU')} so'm\n\n` +
                            `Mijoz bilan bog'laning va muammoni hal qiling.`
                        );
                    }
                }
                return;
            }

        } catch (err) {
            console.error('[CustomerBot] Callback error:', err);
            await ctx.answerCbQuery('❌ Xatolik').catch(() => {});
        }
    });

    // ══════════════════════════════════════════════════════════════════════
    // CONTACT HANDLER
    // ══════════════════════════════════════════════════════════════════════
    // CONTACT HANDLER — Telefon raqami
    // ══════════════════════════════════════════════════════════════════════
    bot.on('contact', async (ctx) => {
        const tgId = ctx.from.id.toString();
        let ses = sessions.get(tgId);

        // Session yo'q yoki noto'g'ri step — session tiklash
        if (!ses || !['reg_phone', 'menu'].includes(ses.step)) {
            // Ro'yxatdan o'tgan foydalanuvchi tekshirish
            const existingUser = await getUserByTgId(tgId);
            if (existingUser) {
                const lang: Lang = 'uz';
                sessions.set(tgId, { step: 'menu', lang });
                await ctx.reply(
                    formatText('cabinet_menu', lang, {
                        name: existingUser.name,
                        phone: existingUser.phone,
                        points: String(existingUser.ecoPoints),
                    }),
                    { parse_mode: 'HTML', reply_markup: customerMainKeyboard(lang) }
                );
                return;
            }
            // Yangi foydalanuvchi — reg_phone stepiga o'tkazish
            const lang: Lang = 'uz';
            ses = { step: 'reg_phone', lang };
            sessions.set(tgId, ses);
        }

        // ── Ro'yxatdan o'tish: telefon qabul qilish ──────────────────────
        if (ses?.step === 'reg_phone') {
            const phone = normalizePhone(ctx.message.contact.phone_number);
            const lang = ses.lang;

            // Faqat o'z raqami bo'lishi kerak
            if (
                ctx.message.contact.user_id &&
                ctx.message.contact.user_id !== ctx.from.id
            ) {
                await ctx.reply(
                    lang === 'ru' ? '❌ Пожалуйста, отправьте только свой номер телефона.' : '❌ Iltimos, faqat o\'z raqamingizni yuboring.',
                    { reply_markup: sharePhoneKeyboard(lang) }
                );
                return;
            }

            // Telefon allaqachon ro'yxatdan o'tganmi?
            const existing = await prisma.user.findFirst({ where: { phone } });
            if (existing) {
                if (existing.telegramId && existing.telegramId !== tgId) {
                    await ctx.reply(getText('reg_phone_taken', lang), {
                        parse_mode: 'HTML',
                        reply_markup: { remove_keyboard: true },
                    });
                    sessions.delete(tgId);
                    return;
                }
                // Xuddi shu odam qayta ulanmoqda — telegramId yangilash
                if (!existing.telegramId) {
                    await prisma.user.update({ where: { id: existing.id }, data: { telegramId: tgId } });
                }
                ses.step = 'menu';
                sessions.set(tgId, { ...ses, phone });
                await ctx.reply(
                    formatText('reg_already_exists', lang, {
                        name: existing.name,
                        phone,
                        code: existing.telegramCode || '—',
                    }),
                    { parse_mode: 'HTML', reply_markup: customerMainKeyboard(lang) }
                );
                return;
            }

            // ── OTP generatsiya va Telegram orqali yuborish ──────────────
            const otp = generateOtp();
            const expiry = Date.now() + 5 * 60 * 1000; // 5 daqiqa

            ses.phone = phone;
            ses.step = 'reg_otp';
            ses.otpCode = otp;
            ses.otpExpiry = expiry;
            ses.otpAttempts = 0;
            sessions.set(tgId, ses);

            // Klaviaturani olib tashlash
            await ctx.reply(
                lang === 'ru' ? '⏳ Отправляю код подтверждения...' : '⏳ Tasdiqlash kodi yuborilmoqda...',
                { reply_markup: { remove_keyboard: true } }
            );

            // OTP xabar
            await ctx.reply(
                `🔐 <b>${lang === 'ru' ? 'Код подтверждения' : lang === 'en' ? 'Verification Code' : 'Tasdiqlash kodi'}</b>\n\n` +
                `${lang === 'ru' ? 'Ваш код:' : lang === 'en' ? 'Your code:' : 'Sizning kodingiz:'}\n\n` +
                `<code>${otp}</code>\n\n` +
                `${lang === 'ru' ? '⏱ Действует 5 минут' : lang === 'en' ? '⏱ Valid for 5 minutes' : '⏱ 5 daqiqa amal qiladi'}\n\n` +
                `${lang === 'ru' ? '✏️ Введите этот код:' : lang === 'en' ? '✏️ Enter this code:' : '✏️ Ushbu kodni kiriting:'}`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: lang === 'ru' ? '❌ Отмена' : '❌ Bekor qilish', callback_data: 'reg_cancel' },
                        ]],
                    },
                }
            );
            return;
        }
    });

    // ══════════════════════════════════════════════════════════════════════
    // LOCATION HANDLER
    // ══════════════════════════════════════════════════════════════════════
    bot.on('location', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const ses = sessions.get(tgId);
        if (!ses || ses.step !== 'location') return;

        ses.lat = ctx.message.location.latitude;
        ses.lng = ctx.message.location.longitude;
        ses.step = 'choose_method';
        const lang = ses.lang;

        await ctx.reply(
            getText('recycle_choose', lang),
            { parse_mode: 'HTML', reply_markup: recycleMethodKeyboard(lang) }
        );
    });

    // ══════════════════════════════════════════════════════════════════════
    // PHOTO HANDLER (mashina chaqirishda rasm)
    // ══════════════════════════════════════════════════════════════════════
    bot.on('photo', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const ses = sessions.get(tgId);
        if (!ses || ses.step !== 'photo') return;

        // Eng katta o'lchamdagi rasmni olish
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileLink = await bot.telegram.getFileLink(photo.file_id);

        await submitTruckRequest(ctx, bot, ses, tgId, fileLink.href);
    });

    // ══════════════════════════════════════════════════════════════════════
    // TEXT HANDLER
    // ══════════════════════════════════════════════════════════════════════
    bot.on('text', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const text = ctx.message.text;

        if (text.startsWith('/')) return;

        // ── Ro'yxatdan o'tish: OTP kodi tekshirish ───────────────────
        const ses = sessions.get(tgId);

        if (ses?.step === 'reg_otp') {
            const lang = ses.lang;
            const input = text.trim();

            // Faqat 6 raqam
            if (!/^\d{6}$/.test(input)) {
                await ctx.reply(
                    lang === 'ru' ? '❌ Код должен состоять из 6 цифр. Попробуйте ещё раз:' : '❌ Kod 6 raqamdan iborat bo\'lishi kerak. Qayta kiriting:'
                );
                return;
            }

            // Muddati tugaganmi?
            if (!ses.otpCode || !ses.otpExpiry || Date.now() > ses.otpExpiry) {
                sessions.delete(tgId);
                await ctx.reply(
                    lang === 'ru'
                        ? '❌ Код истёк. Нажмите /start и попробуйте снова.'
                        : '❌ Kod muddati tugadi. /start ni bosib qayta urinib ko\'ring.',
                    { reply_markup: { remove_keyboard: true } }
                );
                return;
            }

            // Urinishlar chegarasi
            const attempts = (ses.otpAttempts || 0) + 1;
            if (input !== ses.otpCode) {
                if (attempts >= 5) {
                    sessions.delete(tgId);
                    await ctx.reply(
                        lang === 'ru'
                            ? '❌ Слишком много попыток. Нажмите /start и начните заново.'
                            : '❌ Juda ko\'p noto\'g\'ri urinish. /start ni bosib qayta boshlang.',
                        { reply_markup: { remove_keyboard: true } }
                    );
                    return;
                }
                ses.otpAttempts = attempts;
                sessions.set(tgId, ses);
                await ctx.reply(
                    lang === 'ru'
                        ? `❌ Неверный код. Осталось попыток: ${5 - attempts}`
                        : `❌ Noto'g'ri kod. Qolgan urinish: ${5 - attempts}`
                );
                return;
            }

            // ✅ OTP to'g'ri — ism so'rash
            ses.step = 'reg_name';
            ses.otpCode = undefined;
            ses.otpExpiry = undefined;
            ses.otpAttempts = 0;
            sessions.set(tgId, ses);

            await ctx.reply(
                `✅ <b>${lang === 'ru' ? 'Телефон подтверждён!' : lang === 'en' ? 'Phone verified!' : 'Telefon tasdiqlandi!'}</b>\n\n` +
                getText('reg_ask_name', lang),
                { parse_mode: 'HTML' }
            );
            return;
        }

        // ── Ro'yxatdan o'tish: F.I.Sh. kiritish ─────────────────────
        if (ses?.step === 'reg_name') {
            const name = text.trim();
            const lang = ses.lang;

            if (name.length < 3) {
                await ctx.reply(getText('reg_name_too_short', lang), { parse_mode: 'HTML' });
                return;
            }

            if (!ses.phone) {
                // Ism bosqichida telefon yo'q — qayta so'rash
                ses.step = 'reg_phone';
                sessions.set(tgId, ses);
                await ctx.reply(getText('reg_ask_phone', lang), {
                    parse_mode: 'HTML',
                    reply_markup: sharePhoneKeyboard(lang),
                });
                return;
            }

            // ── Hisob yaratish ────────────────────────────────────────
            try {
                const code = await generateUniqueUserCode();
                const passwordHash = await bcrypt.hash(code, 10);
                const referralCode = `P${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

                await prisma.user.create({
                    data: {
                        name,
                        phone: ses.phone,
                        passwordHash,
                        telegramId: tgId,
                        telegramCode: code,
                        telegramVerifiedAt: new Date(),
                        referralCode,
                        role: 'user',
                    },
                });

                ses.step = 'menu';
                sessions.set(tgId, { ...ses, name });

                // Kod yuborish
                await ctx.reply(
                    formatText('reg_code_sent', lang, { name, code, phone: ses.phone }),
                    { parse_mode: 'HTML', reply_markup: customerMainKeyboard(lang) }
                );

                console.log(`[CustomerBot] ✅ Yangi foydalanuvchi: ${name} | ${ses.phone} | Kod: ${code}`);
            } catch (err: any) {
                if (err?.code === 'P2002') {
                    // Unique constraint — telefon allaqachon bor
                    await ctx.reply(getText('reg_phone_taken', lang), { parse_mode: 'HTML' });
                } else {
                    console.error('[CustomerBot] Hisob yaratish xatosi:', err);
                    await ctx.reply(lang === 'uz' ? '❌ Xatolik yuz berdi. Qayta urinib ko\'ring.' : '❌ Ошибка. Попробуйте ещё раз.');
                }
            }
            return;
        }

        // ── Menyu tugmalari ─────────────────────────────────────────
        const lang = await getUserLang(tgId);

        // ♻️ Makulatura xizmati
        if (text === getText('btn_recycle', lang) || text === getText('btn_recycle', 'uz') || text === getText('btn_recycle', 'ru') || text === getText('btn_recycle', 'en')) {
            sessions.set(tgId, { step: 'location', lang });
            await ctx.reply(
                getText('recycle_start', lang),
                { parse_mode: 'HTML', reply_markup: shareLocationKeyboard(lang) }
            );
            return;
        }

        // 📦 Katalog
        if (text === getText('btn_catalog', lang) || text === getText('btn_catalog', 'uz') || text === getText('btn_catalog', 'ru') || text === getText('btn_catalog', 'en')) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pack24.uz';
            await ctx.reply(
                lang === 'uz' ? '📦 Mahsulotlar katalogi:' : lang === 'ru' ? '📦 Каталог продукции:' : '📦 Product catalog:',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: lang === 'uz' ? '🛒 Katalogni ochish' : lang === 'ru' ? '🛒 Открыть каталог' : '🛒 Open catalog', url: appUrl }],
                            [{ text: lang === 'uz' ? '🤖 @Pack24uzbot' : '🤖 @Pack24uzbot', url: 'https://t.me/Pack24uzbot' }],
                        ],
                    },
                }
            );
            return;
        }

        // 📞 Bog'lanish
        if (text === getText('btn_contact', lang) || text === getText('btn_contact', 'uz') || text === getText('btn_contact', 'ru') || text === getText('btn_contact', 'en')) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pack24.ai';
            const domain = appUrl.replace('https://', '').replace('http://', '');
            await ctx.reply(
                lang === 'uz'
                    ? `📞 <b>Bog'lanish</b>\n\n☎️ Telefon: <a href="tel:+998880557888">+998 88 055-78-88</a>\n☎️ Telefon: <a href="tel:+998951050052">+998 95 105-00-52</a>\n✉️ Email: sales@pack24.uz\n💬 Telegram: @pack24uz\n🌐 Sayt: ${domain}`
                    : lang === 'ru'
                    ? `📞 <b>Контакты</b>\n\n☎️ Телефон: <a href="tel:+998880557888">+998 88 055-78-88</a>\n☎️ Телефон: <a href="tel:+998951050052">+998 95 105-00-52</a>\n✉️ Email: sales@pack24.uz\n💬 Telegram: @pack24uz\n🌐 Сайт: ${domain}`
                    : `📞 <b>Contact Us</b>\n\n☎️ Phone: <a href="tel:+998880557888">+998 88 055-78-88</a>\n☎️ Phone: <a href="tel:+998951050052">+998 95 105-00-52</a>\n✉️ Email: sales@pack24.uz\n💬 Telegram: @pack24uz\n🌐 Website: ${domain}`,
                { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
            );
            return;
        }

        // 📋 Arizalarim
        if (text === getText('btn_my_requests', lang) || text === getText('btn_my_requests', 'uz') || text === getText('btn_my_requests', 'ru') || text === getText('btn_my_requests', 'en')) {
            const myReqs = await prisma.recycleRequest.findMany({
                where: { customerTgId: tgId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { point: true },
            });
            if (myReqs.length === 0) {
                await ctx.reply(lang === 'uz' ? '📋 Sizda hali ariza yo\'q.' : lang === 'ru' ? '📋 У вас пока нет заявок.' : '📋 You have no requests yet.');
                return;
            }
            const statusMap: Record<string, string> = {
                new: '🔵', dispatched: '📋', assigned: '🚚', en_route: '🚚', arrived: '📍',
                collecting: '⚖️', completed: '✅', cancelled: '❌',
            };
            const list = myReqs.map(r =>
                `${statusMap[r.status] || '⚪'} <b>#${r.id}</b> — ${r.point?.regionUz || '—'} — ${new Date(r.createdAt).toLocaleDateString('ru-RU')}`
            ).join('\n');
            await ctx.reply(`📋 <b>${lang === 'uz' ? 'Arizalaringiz' : lang === 'ru' ? 'Ваши заявки' : 'Your requests'}:</b>\n\n${list}`, { parse_mode: 'HTML' });
            return;
        }

        // 🤖 AI Assistent (placeholder — Gemini keyinroq)
        if (text === getText('btn_ai', lang) || text === getText('btn_ai', 'uz') || text === getText('btn_ai', 'ru') || text === getText('btn_ai', 'en')) {
            await ctx.reply(
                lang === 'uz' ? '🤖 AI Assistent tez orada ishga tushadi!' :
                lang === 'ru' ? '🤖 AI Ассистент скоро будет доступен!' :
                '🤖 AI Assistant coming soon!'
            );
            return;
        }

        // ⚙️ Sozlamalar
        if (text === getText('btn_settings', lang) || text === getText('btn_settings', 'uz') || text === getText('btn_settings', 'ru') || text === getText('btn_settings', 'en')) {
            await ctx.reply(
                lang === 'uz' ? '⚙️ <b>Sozlamalar</b>\n\nTilni o\'zgartiring:' :
                lang === 'ru' ? '⚙️ <b>Настройки</b>\n\nИзмените язык:' :
                '⚙️ <b>Settings</b>\n\nChange language:',
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [btn('🇺🇿 O\'zbekcha', 'lang_uz'), btn('🇷🇺 Русский', 'lang_ru'), btn('🇬🇧 English', 'lang_en')],
                        ],
                    },
                }
            );
            return;
        }

        // ── Lokatsiya matn ko'rinishida ─────────────────────────────
        if (ses?.step === 'location' && !text.startsWith('/')) {
            // Matn manzili — GPS yo'q, lekin davom etamiz
            ses.lat = 0;
            ses.lng = 0;
            ses.step = 'choose_method';
            const l = ses.lang;

            await ctx.reply(
                getText('recycle_choose', l),
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [btn(getText('btn_self_delivery', l), 'recycle_self')],
                            [btn(getText('btn_call_truck', l), 'recycle_truck')],
                            [btn(getText('cancel', l), 'recycle_cancel')],
                        ],
                    },
                }
            );
            return;
        }
    });

    // ══════════════════════════════════════════════════════════════════════
    // YORDAMCHI FUNKSIYALAR
    // ══════════════════════════════════════════════════════════════════════

    // Mashina chaqirish arizasini yuborish
    async function submitTruckRequest(ctx: Context, _bot: Telegraf, ses: CustomerSession, tgId: string, photoUrl?: string) {
        const lang = ses.lang;

        // Eng yaqin bazani topish
        const points = await prisma.recyclePoint.findMany({
            where: { status: 'active' },
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
                regionId: nearestPoint.id,
                pickupType: 'pickup',
                pickupLat: ses.lat || null,
                pickupLng: ses.lng || null,
                customerTgId: tgId,
                customerLang: lang,
                volumeSize: ses.volumeSize || null,
                photoUrl: photoUrl || null,
                status: supervisorForPoint ? 'dispatched' : 'new',
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

    // Xodim kodi bilan ro'yxatdan o'tish
    async function handleRegistrationCode(ctx: Context, tgId: string, code: string) {
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

    customerBotInstance = bot;
    return bot;
};
