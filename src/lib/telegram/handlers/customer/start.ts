import { Telegraf } from 'telegraf';
import { sessions, getUserByTgId } from './helpers';
import { Lang, getText, formatText } from '../../i18n';
import { cabinetMenuKeyboard, customerMainKeyboard, langSelectKeyboard } from '../../keyboards';
import type { CustomerSession } from './types';

export function registerStartHandler(bot: Telegraf) {
    bot.start(async (ctx) => {
        const tgId = ctx.from.id.toString();

        // 1. Telegram ID bilan ro'yxatdan o'tgan foydalanuvchi
        const user = await getUserByTgId(tgId);
        if (user) {
            const lang = (sessions.get(tgId)?.lang || 'uz') as Lang;
            sessions.set(tgId, { step: 'menu', lang });
            await ctx.reply(
                lang === 'uz' ? `👋 Xush kelibsiz, <b>${user.name}</b>!` :
                lang === 'ru' ? `👋 Добро пожаловать, <b>${user.name}</b>!` :
                `👋 Welcome, <b>${user.name}</b>!`,
                { parse_mode: 'HTML', reply_markup: customerMainKeyboard(lang) }
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
}
