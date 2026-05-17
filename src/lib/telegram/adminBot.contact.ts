import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { formatText } from './i18n';
import { supervisorMainKeyboard, supervisorSharePhoneKeyboard } from './keyboards';
import {
    adminSessions,
    generateUniqueSupCode,
} from './adminBot.shared';
import { createOrReuseBotAccessRequest } from './botAccessRequests';

export function registerAdminContactHandler(bot: Telegraf) {
    bot.on('contact', async (ctx) => {
        const tgId = ctx.from.id.toString();

        if (ctx.message.contact.user_id && ctx.message.contact.user_id !== ctx.from.id) {
            await ctx.reply('❌ Iltimos, faqat o\'z telefon raqamingizni ulashing.', {
                reply_markup: supervisorSharePhoneKeyboard(),
            });
            return;
        }

        let phone = ctx.message.contact.phone_number.replace(/[^0-9+]/g, '');
        if (!phone.startsWith('+')) phone = `+${phone}`;

        try {
            const supervisor = await prisma.supervisor.findFirst({
                where: {
                    OR: [
                        { phone },
                        { phone: phone.replace('+', '') },
                        { phone: phone.replace('+998', '0') },
                        { phone: phone.slice(-9) },
                    ],
                },
                include: { point: true },
            });

            if (!supervisor) {
                const result = await createOrReuseBotAccessRequest({
                    role: 'supervisor',
                    name: ctx.from.first_name || ctx.from.username || 'Admin nomzod',
                    phone,
                    telegramId: tgId,
                    telegramName: ctx.from.username || ctx.from.first_name || null,
                    sourceBot: 'supervisor',
                });

                if (result.kind === 'pending') {
                    await ctx.reply(
                        `⏳ <b>Arizangiz allaqachon ko'rib chiqilmoqda.</b>\n\n` +
                        `📱 Telefon: <code>${phone}</code>\n` +
                        `HQ admin tasdiqlagandan keyin sizga xabar beriladi.`,
                        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } },
                    );
                    adminSessions.delete(tgId);
                    return;
                }

                await ctx.reply(
                    `✅ <b>Admin bo'lish uchun ariza qabul qilindi.</b>\n\n` +
                    `📱 Telefon: <code>${phone}</code>\n\n` +
                    `HQ admin arizangizni tasdiqlagandan keyin ushbu bot orqali ishlashingiz mumkin bo'ladi.`,
                    { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
                );
                adminSessions.delete(tgId);
                return;
            }

            // Telegram ID boshqa bo'lsa — yangilash (qurilma/akkaunt almashuvi)
            if (supervisor.telegramId && supervisor.telegramId.trim() !== tgId) {
                console.log(`[AdminBot] telegramId yangilanmoqda: ${supervisor.telegramId.trim()} → ${tgId}`);
            }

            const code = await generateUniqueSupCode();

            await prisma.supervisor.update({
                where: { id: supervisor.id },
                data: {
                    telegramId: tgId,
                    telegramName: ctx.from.username || ctx.from.first_name || null,
                    registeredAt: new Date(),
                    registrationCode: code,
                },
            });

            adminSessions.delete(tgId);

            await ctx.reply(
                formatText('adm_code_sent', 'uz', {
                    name: supervisor.name,
                    point: supervisor.point?.regionUz || '—',
                    code,
                }),
                {
                    parse_mode: 'HTML',
                    reply_markup: supervisorMainKeyboard(),
                }
            );

            try {
                const config = await prisma.telegramConfig.findFirst();
                if (config?.salesChatId) {
                    const adminBot = await import('./botManager').then((module) => module.getAdminBot());
                    if (adminBot) {
                        const chatIds = config.salesChatId.split(',').map((value) => value.trim()).filter(Boolean);
                        for (const chatId of chatIds) {
                            await adminBot.telegram.sendMessage(
                                chatId,
                                `🆕 <b>Masul shaxs ro'yxatdan o'tdi!</b>\n\n` +
                                `👤 ${supervisor.name}\n` +
                                `📞 ${supervisor.phone}\n` +
                                `🏭 Punkt: ${supervisor.point?.regionUz || '—'}\n` +
                                `🔑 Verifikatsion kod: <code>${code}</code>\n` +
                                `🕐 ${new Date().toLocaleString('ru-RU')}`,
                                { parse_mode: 'HTML' }
                            );
                        }
                    }
                }
            } catch {
                // salesChatId sozlanmagan bo'lishi mumkin
            }

            console.log(`[AdminBot] ✅ Masul ro'yxatdan o'tdi: ${supervisor.name} | Kod: ${code}`);
        } catch (err) {
            console.error('[AdminBot] Contact handler xatolik:', err);
            await ctx.reply('❌ Xatolik yuz berdi. Qayta urinib ko\'ring.', {
                reply_markup: { remove_keyboard: true },
            });
        }
    });
}
