import { Telegraf } from 'telegraf';
import { applyBotDefaults } from './botInit';
import { getPack24AdminBotToken } from './botTokens';
import { registerPack24AdminHandlers } from './handlers/pack24admin';

let pack24AdminBotInstance: Telegraf | null = null;

export async function initPack24AdminBot(): Promise<Telegraf | null> {
    if (pack24AdminBotInstance) return pack24AdminBotInstance;

    const token = getPack24AdminBotToken();
    if (!token) {
        console.warn('[Pack24AdminBot] PACK24ADMIN_BOT_TOKEN topilmadi');
        return null;
    }

    const bot = new Telegraf(token);
    await applyBotDefaults(bot, 'Pack24AdminBot', [
        { command: 'start', description: 'Bosh menyu' },
        { command: 'help', description: 'Yordam' },
        { command: 'link', description: 'Telegram hisobni ulash' },
        { command: 'tasks', description: 'Mening vazifalarim' },
    ]);

    registerPack24AdminHandlers(bot);

    pack24AdminBotInstance = bot;
    return bot;
}
