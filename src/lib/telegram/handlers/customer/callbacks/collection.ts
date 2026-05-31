import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { Lang } from '../../../i18n';
import { notifyAdmin } from '../../../notifier';
import { createBotEvent } from '../../../botEvents';
import { toNumber } from '@/lib/money';

export function registerCollectionCallbacks(bot: Telegraf) {
    bot.on('callback_query', async (ctx, next) => {
        const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
        if (!data) return next();
        const _tgId = ctx.from.id.toString();

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
                    ? `✅ <b>Tasdiqlandi!</b>\n\n⚖️ Og'irlik: <b>${collection.actualWeight} kg</b>\n💰 Jami: <b>${toNumber(collection.totalAmount).toLocaleString('ru-RU')} so'm</b>\n\nTo'lov masul tomonidan amalga oshiriladi. ♻️`
                    : lang === 'ru'
                    ? `✅ <b>Подтверждено!</b>\n\n⚖️ Вес: <b>${collection.actualWeight} кг</b>\n💰 Итого: <b>${toNumber(collection.totalAmount).toLocaleString('ru-RU')} сум</b>\n\nОплата будет произведена ответственным. ♻️`
                    : `✅ <b>Confirmed!</b>\n\n⚖️ Weight: <b>${collection.actualWeight} kg</b>\n💰 Total: <b>${toNumber(collection.totalAmount).toLocaleString('ru-RU')} UZS</b>\n\nPayment will be made by the supervisor. ♻️`,
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
                        `💰 ${toNumber(collection.totalAmount).toLocaleString('ru-RU')} so'm\n\n` +
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
                        `💰 ${toNumber(collection.totalAmount).toLocaleString('ru-RU')} so'm\n\n` +
                        `Mijoz bilan bog'laning va muammoni hal qiling.`
                    );
                }
            }
            return;
        }

        return next();
    });
}
