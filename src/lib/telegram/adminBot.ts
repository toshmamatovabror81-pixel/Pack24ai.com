import { Telegraf } from 'telegraf';
import { Lang, formatText, getText } from './i18n';
import { adminSessions, getSupervisor } from './adminBot.shared';
import {
    supervisorMainKeyboard,
    supervisorSharePhoneKeyboard,
} from './keyboards';
import { applyBotDefaults } from './botInit';
import { getAdminBotToken } from './botTokens';
import { registerAdminCallbackHandler } from './adminBot.callback';
import { registerAdminContactHandler } from './adminBot.contact';
import { registerAdminTextHandler } from './adminBot.text';

let adminBotInstance: Telegraf | null = null;

export async function initAdminBot(): Promise<Telegraf | null> {
    if (adminBotInstance) return adminBotInstance;

    const token = getAdminBotToken();
    if (!token) {
        console.warn('[AdminBot] ADMIN_BOT_TOKEN topilmadi');
        return null;
    }

    const bot = new Telegraf(token);
    await applyBotDefaults(bot, 'AdminBot');

    bot.start(async (ctx) => {
        const tgId = ctx.from.id.toString();
        const supervisor = await getSupervisor(tgId);

        if (supervisor) {
            const lang: Lang = 'uz';
            await ctx.reply(
                formatText('adm_registered', lang, {
                    name: supervisor.name,
                    point: supervisor.point?.regionUz || '—',
                }),
                { parse_mode: 'HTML', reply_markup: supervisorMainKeyboard() }
            );
            return;
        }

        adminSessions.set(tgId, { step: 'phone', lang: 'uz' });
        await ctx.reply(getText('adm_welcome', 'uz'), {
            parse_mode: 'HTML',
            reply_markup: supervisorSharePhoneKeyboard(),
        });
    });

    bot.help(async (ctx) => {
        await ctx.reply(
            '👷 <b>Pack24 — Masul boti</b>\n\n' +
            '📋 Arizalar — yangi va jarayondagi arizalar\n' +
            '🚚 Haydovchi tayinlash — ariza uchun haydovchi tanlash\n' +
            '💰 To\'lovlar — hisob-kitob tasdiqlash\n' +
            '🏭 Punkt boshqarish — ochiq/yopiq almashtirish\n' +
            '📥 Qabul — sana: tugmalar (bugun/kecha/qo\'lda) yoki matn, kg, narx\n' +
            '🏭 Press — sana tugmalari, kg, toylar, bajaruvchilar\n' +
            '💸 Xarajat — sana tugmalari, xarajat, avans, komment\n' +
            '💼 Kassa — sana tugmalari, boshlang\'ich summa\n' +
            '🚛 Sotuv — sana tugmalari, mijoz, kg, narx, mashina, raqam\n' +
            '✏️ Jurnal tahriri (HQ) — eski yozuvni o\'zgartirish (HQ tasdig\'i)\n' +
            '📊 Hisobotlar — kunlik/haftalik/oylik statistika\n\n' +
            '/start — Bosh menyu',
            { parse_mode: 'HTML' }
        );
    });

    registerAdminCallbackHandler(bot);
    registerAdminContactHandler(bot);
    registerAdminTextHandler(bot);

    adminBotInstance = bot;
    return bot;
}
