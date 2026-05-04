import { Telegraf } from 'telegraf';

type TelegramCommand = {
    command: string;
    description: string;
};

export const DEFAULT_BOT_COMMANDS: TelegramCommand[] = [
    { command: 'start', description: '🏠 Bosh menyu / Главное меню / Main menu' },
    { command: 'help', description: '❓ Yordam / Помощь / Help' },
];

export async function applyBotDefaults(
    bot: Telegraf,
    logPrefix: string,
    commands: TelegramCommand[] = DEFAULT_BOT_COMMANDS,
) {
    await bot.telegram.setMyCommands(commands).catch(() => {});

    bot.use(async (ctx, next) => {
        const startedAt = Date.now();
        await next();
        console.log(`[${logPrefix}] ${ctx.updateType} in ${Date.now() - startedAt}ms`);
    });
}
