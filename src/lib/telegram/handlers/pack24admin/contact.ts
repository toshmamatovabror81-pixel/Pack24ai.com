import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { normalizePhone, getHqAdminByPhone, sessions } from './helpers';
import { pack24AdminSharePhoneKeyboard, pack24AdminMainKeyboard } from '../../keyboards';
import { generateUniqueTelegramRegistrationCode } from '../../registrationCodes';
import { createBotEvent } from '../../botEvents';

export function registerContactHandler(bot: Telegraf) {
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

            // Telegram ID boshqa bo'lsa — yangilash (qurilma/akkaunt almashuvi)
            if (hqAdmin.telegramId && hqAdmin.telegramId.trim() !== tgId) {
                console.log(`[Pack24AdminBot] telegramId yangilanmoqda: ${hqAdmin.telegramId.trim()} → ${tgId}`);
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
}
