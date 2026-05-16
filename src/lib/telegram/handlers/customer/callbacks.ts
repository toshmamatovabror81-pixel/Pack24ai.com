import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { sessions, registrationSessions, getUserByTgId, getUserLang } from './helpers';
import { Lang, getText, formatText } from '../../i18n';
import { customerMainKeyboard, sharePhoneKeyboard, cabinetMenuKeyboard, volumeKeyboard, photoOrSkipKeyboard } from '../../keyboards';
import { submitTruckRequest } from './truckRequest';
import { MAT, fmtN } from './types';
import { haversineDistance } from '../../geo';
import { notifyAdmin } from '../../notifier';
import { createBotEvent } from '../../botEvents';
import type { CustomerSession } from './types';

export function registerCallbackHandlers(bot: Telegraf) {
    bot.on('callback_query', async (ctx) => {
        const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
        if (!data) return;
        const tgId = ctx.from.id.toString();

        try {
            // ─── ORTGA / ASOSIY MENYU ──────────────────────────────────
            if (data === 'back_main') {
                const lang = (sessions.get(tgId)?.lang || 'uz') as Lang;
                await ctx.answerCbQuery('🏠');
                await ctx.reply(
                    lang === 'uz' ? '🏠 Asosiy menyu' : lang === 'ru' ? '🏠 Главное меню' : '🏠 Main menu',
                    { reply_markup: customerMainKeyboard(lang) }
                );
                return;
            }

            // TIL TANLASH
            if (data.startsWith('lang_')) {
                const lang = data.replace('lang_', '') as Lang;
                const existingSession = sessions.get(tgId);
                const user = await getUserByTgId(tgId);

                await ctx.answerCbQuery('✅');

                if (user || existingSession?.step === 'menu') {
                    sessions.set(tgId, { step: 'menu', lang, name: user?.name });
                    await ctx.editMessageText(
                        lang === 'uz' ? '✅ Til yangilandi.' : lang === 'ru' ? '✅ Язык обновлен.' : '✅ Language updated.',
                        { parse_mode: 'HTML' }
                    );
                    await ctx.reply(
                        lang === 'uz' ? '🏠 Asosiy menyu' : lang === 'ru' ? '🏠 Главное меню' : '🏠 Main menu',
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

            // KABINET TUGMALARI
            if (data.startsWith('cab_')) {
                const user = await getUserByTgId(tgId);
                const lang = (sessions.get(tgId)?.lang || 'uz') as Lang;

                if (!user) {
                    await ctx.answerCbQuery('❌');
                    return;
                }

                // ─── PRTS Dashboard ───────────────────────────────────────
                if (data === 'cab_prts') {
                    await ctx.answerCbQuery('🌿');
                    const totalWeight = user.totalRecycledWeight || 0;
                    await ctx.reply(
                        formatText('prts_dashboard', lang, {
                            name: user.name,
                            weight: String(totalWeight),
                            co2: (totalWeight * 2.5).toFixed(1),
                            trees: (totalWeight * 0.017).toFixed(1),
                            water: (totalWeight * 26).toFixed(0),
                            points: String(user.ecoPoints || 0),
                        }),
                        {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: '🎁 Mukofotlar', callback_data: 'prts_rewards' },
                                        { text: '♻️ Topshirish', callback_data: 'cab_recycling' },
                                    ],
                                    [
                                        { text: '🏆 Reyting', callback_data: 'prts_leaderboard' },
                                        { text: 'ℹ️ PRTS nima?', callback_data: 'prts_info' },
                                    ],
                                    [{ text: '◀️ Asosiy menyu', callback_data: 'back_main' }],
                                ],
                            },
                        }
                    );
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
                        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '◀️ Asosiy menyu', callback_data: 'back_main' }]] } }
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
                    await ctx.reply(`♻️ <b>${lang === 'uz' ? 'Makulatura tarixi' : 'История макулатуры'}:</b>\n\n${list}`, {
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: [[{ text: '◀️ Asosiy menyu', callback_data: 'back_main' }]] },
                    });
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
                    await ctx.reply(`📦 <b>${lang === 'uz' ? 'Buyurtmalaringiz' : 'Ваши заказы'}:</b>\n\n${list}`, {
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: [[{ text: '◀️ Asosiy menyu', callback_data: 'back_main' }]] },
                    });
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
                        { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: [[{ text: '◀️ Asosiy menyu', callback_data: 'back_main' }]] } }
                    );
                    return;
                }

                if (data === 'cab_settings') {
                    await ctx.answerCbQuery('⚙️');
                    await ctx.reply(
                        lang === 'uz'
                            ? `⚙️ <b>Sozlamalar</b>\n\n👤 Ism: <b>${user.name}</b>\n📱 Telefon: <b>${user.phone}</b>\n🌐 Til: O'zbek\n\n🔑 <b>Kirish kodi:</b> <code>${user.telegramCode || '—'}</code>\n🌐 <b>pack24.ai</b> saytida shu kod va telefon bilan kiring.\n\n✏️ O'zgartirish uchun <b>pack24.ai</b> saytiga kiring.`
                            : lang === 'ru'
                            ? `⚙️ <b>Настройки</b>\n\n👤 Имя: <b>${user.name}</b>\n📱 Телефон: <b>${user.phone}</b>\n\n🔑 <b>Код входа:</b> <code>${user.telegramCode || '—'}</code>\n🌐 Войдите на <b>pack24.ai</b> с этим кодом.\n\n✏️ Для изменений войдите на <b>pack24.ai</b>`
                            : `⚙️ <b>Settings</b>\n\n👤 Name: <b>${user.name}</b>\n📱 Phone: <b>${user.phone}</b>\n\n🔑 <b>Login code:</b> <code>${user.telegramCode || '—'}</code>\n🌐 Use this code at <b>pack24.ai</b> to login.`,
                        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '◀️ Asosiy menyu', callback_data: 'back_main' }]] } }
                    );
                    return;
                }

                await ctx.answerCbQuery();
                return;
            }

            // ─── PRTS INFO ───────────────────────────────────────────────
            if (data === 'prts_info') {
                const lang = (sessions.get(tgId)?.lang || 'uz') as Lang;
                await ctx.answerCbQuery('🌿');
                await ctx.reply(getText('prts_info', lang), {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '◀️ Ortga', callback_data: 'cab_prts' }, { text: '🏠 Asosiy menyu', callback_data: 'back_main' }],
                        ],
                    },
                });
                return;
            }

            // ─── PRTS MUKOFOTLAR ────────────────────────────────────────────
            if (data === 'prts_rewards') {
                const user = await getUserByTgId(tgId);
                const lang = (sessions.get(tgId)?.lang || 'uz') as Lang;
                if (!user) { await ctx.answerCbQuery('❌'); return; }

                await ctx.answerCbQuery('🎁');
                await ctx.reply(
                    formatText('prts_rewards_list', lang, { points: String(user.ecoPoints || 0) }),
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '☕ Kofe (150)', callback_data: 'prts_redeem_coffee_150' }],
                                [{ text: '🚌 Transport (300)', callback_data: 'prts_redeem_transport_300' }],
                                [{ text: '🎬 Kino (500)', callback_data: 'prts_redeem_cinema_500' }],
                                [{ text: '🌳 Daraxt (1000)', callback_data: 'prts_redeem_tree_1000' }],
                                [{ text: '◀️ Ortga', callback_data: 'cab_prts' }],
                            ],
                        },
                    }
                );
                return;
            }

            // ─── PRTS REDEEM ───────────────────────────────────────────────
            if (data.startsWith('prts_redeem_')) {
                const user = await getUserByTgId(tgId);
                const lang = (sessions.get(tgId)?.lang || 'uz') as Lang;
                if (!user) { await ctx.answerCbQuery('❌'); return; }

                const parts = data.replace('prts_redeem_', '').split('_');
                const rewardName = parts[0];
                const cost = parseInt(parts[1]);

                const rewardLabels: Record<string, Record<Lang, string>> = {
                    coffee: { uz: '☕ Kofe 50% chegirma', ru: '☕ 50% скидка на кофе', en: '☕ 50% coffee discount' },
                    transport: { uz: '🚌 Bepul transport', ru: '🚌 Бесплатный проезд', en: '🚌 Free transport' },
                    cinema: { uz: '🎬 Kino chipta', ru: '🎬 Билет в кино', en: '🎬 Cinema ticket' },
                    tree: { uz: '🌳 Daraxt ekish', ru: '🌳 Посадка дерева', en: '🌳 Plant a tree' },
                };

                if (user.ecoPoints < cost) {
                    await ctx.answerCbQuery('❌');
                    await ctx.reply(
                        formatText('prts_insufficient', lang, {
                            required: String(cost),
                            current: String(user.ecoPoints),
                            diff: String(cost - user.ecoPoints),
                        }),
                        { parse_mode: 'HTML' }
                    );
                    return;
                }

                await prisma.user.update({
                    where: { id: user.id },
                    data: { ecoPoints: { decrement: cost } },
                });

                await ctx.answerCbQuery('🎉');
                await ctx.reply(
                    formatText('prts_reward_success', lang, {
                        reward: rewardLabels[rewardName]?.[lang] || rewardName,
                        spent: String(cost),
                        remaining: String(user.ecoPoints - cost),
                    }),
                    { parse_mode: 'HTML' }
                );
                return;
            }

            // ─── PRTS LEADERBOARD ───────────────────────────────────────────
            if (data === 'prts_leaderboard') {
                await ctx.answerCbQuery('🏆');
                const lang = (sessions.get(tgId)?.lang || 'uz') as Lang;

                // Top 10 foydalanuvchilar
                const top = await prisma.user.findMany({
                    where: { totalRecycledWeight: { gt: 0 } },
                    orderBy: { ecoPoints: 'desc' },
                    take: 10,
                    select: { name: true, ecoPoints: true, totalRecycledWeight: true, ecoLevel: true },
                });

                // Joriy foydalanuvchi
                const me = await getUserByTgId(tgId);
                const meRankResult = me ? await prisma.user.count({
                    where: { ecoPoints: { gt: me.ecoPoints } },
                }) : null;
                const meRank = meRankResult !== null ? meRankResult + 1 : null;

                const medals = ['🥇', '🥈', '🥉'];
                const levelEmoji: Record<string, string> = {
                    seed: '🌱', sprout: '🌿', tree: '🌳', forest: '🌲', guardian: '🌍',
                };

                const topList = top.length === 0
                    ? (lang === 'uz' ? 'Hali hech kim ro\'yxatda yo\'q' : 'Список пуст')
                    : top.map((u, i) => {
                        const m = medals[i] || `${i + 1}.`;
                        const lv = levelEmoji[u.ecoLevel] || '🌱';
                        return `${m} ${lv} <b>${u.name}</b> — ${u.ecoPoints} ball (${Math.round(u.totalRecycledWeight)} kg)`;
                    }).join('\n');

                const myLine = me && meRank
                    ? `\n\n📍 <b>Sizning o'rningiz: #${meRank}</b> — ${me.ecoPoints} ball`
                    : '';

                await ctx.reply(
                    `🏆 <b>${lang === 'uz' ? 'Global Reyting — Top 10' : 'Глобальный Рейтинг — Топ 10'}</b>\n\n${topList}${myLine}`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Yangilash', callback_data: 'prts_leaderboard' }],
                                [{ text: '◀️ Ortga', callback_data: 'cab_prts' }],
                            ],
                        },
                    }
                );
                return;
            }

            // BEKOR QILISH
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

            // MAKULATURA XIZMATI: usul tanlash
            if (data === 'recycle_self') {
                const ses = sessions.get(tgId);
                if (!ses || ses.lat === undefined || ses.lng === undefined) return;
                ses.pickupType = 'base';
                ses.step = 'done';

                await ctx.answerCbQuery('🏭');

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

                const statusText = nearest.isAccepting ? getText('point_open', lang) : getText('point_closed', lang);
                const pricesText = Object.entries(MAT).map(([, m]) => `  ${m.emoji} ${m.label[lang]}: <b>${fmtN(m.price)} so'm/kg</b>`).join('\n');

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

                if (nearest.lat && nearest.lng) {
                    await ctx.reply('📍', { reply_markup: { remove_keyboard: true } });
                    await bot.telegram.sendLocation(ctx.chat!.id, nearest.lat, nearest.lng);
                }

                if (!nearest.isAccepting && pointsWithDist.length > 1) {
                    const next = pointsWithDist.find(p => p.id !== nearest.id && p.isAccepting);
                    if (next) {
                        const nextMsg = lang === 'uz' ? `💡 Eng yaqin <b>ochiq</b> punkt: <b>${next.regionUz}</b> (~${next.distance} km)` : lang === 'ru' ? `💡 Ближайший <b>открытый</b> пункт: <b>${next.regionUz}</b> (~${next.distance} км)` : `💡 Nearest <b>open</b> point: <b>${next.regionUz}</b> (~${next.distance} km)`;
                        await ctx.reply(nextMsg, { parse_mode: 'HTML' });
                    }
                }

                sessions.delete(tgId);
                return;
            }

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

            if (data === 'skip_photo') {
                const ses = sessions.get(tgId);
                if (!ses) return;
                await submitTruckRequest(ctx, bot, ses, tgId);
                return;
            }

            if (data === 'recycle_cancel') {
                sessions.delete(tgId);
                const lang = await getUserLang(tgId);
                await ctx.answerCbQuery('❌');
                await ctx.editMessageText(
                    lang === 'uz' ? '❌ Bekor qilindi.' : lang === 'ru' ? '❌ Отменено.' : '❌ Cancelled.'
                );
                return;
            }

            // MIJOZ: HISOB-KITOBNI TASDIQLASH
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
                                    inline_keyboard: [[{ text: '✅ To\'lovni tasdiqlash', callback_data: `approve_payment_${collId}` }]],
                                },
                            }
                        );
                    }
                }
                return;
            }

            // MIJOZ: HISOB-KITOBNI INKOR QILISH
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
}
