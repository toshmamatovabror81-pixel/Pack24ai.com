import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { sessions, getUserLang } from '../helpers';
import { getText, formatText } from '../../../i18n';
import { volumeKeyboard, photoOrSkipKeyboard } from '../../../keyboards';
import { submitTruckRequest } from '../truckRequest';
import { MAT, fmtN } from '../types';
import { haversineDistance } from '../../../geo';

export function registerRecyclingCallbacks(bot: Telegraf) {
    bot.on('callback_query', async (ctx, next) => {
        const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
        if (!data) return next();
        const tgId = ctx.from.id.toString();

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

        return next();
    });
}
