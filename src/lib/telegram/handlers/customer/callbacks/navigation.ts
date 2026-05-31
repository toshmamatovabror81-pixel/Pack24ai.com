import { Telegraf } from 'telegraf';
import { sessions, registrationSessions, getUserByTgId } from '../helpers';
import { Lang, getText } from '../../../i18n';
import { customerMainKeyboard, sharePhoneKeyboard } from '../../../keyboards';
import type { CustomerSession } from '../types';

export function registerNavigationCallbacks(bot: Telegraf) {
    bot.on('callback_query', async (ctx, next) => {
        const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
        if (!data) return next();
        const tgId = ctx.from.id.toString();

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

        // BEKOR QILISH
        if (data === 'reg_cancel' || data === 'register_cancel') {
            const lang = (sessions.get(tgId)?.lang || 'uz') as Lang;
            registrationSessions.delete(tgId);
            sessions.delete(tgId);
            await ctx.answerCbQuery('❌');
            await ctx.editMessageText(
                lang === 'ru' ? '❌ Отменено. Нажмите /start чтобы начать заново.' : '❌ Bekor qilindi. Qayta boshlash uchun /start bosing.'
            );
            return;
        }

        return next();
    });
}
