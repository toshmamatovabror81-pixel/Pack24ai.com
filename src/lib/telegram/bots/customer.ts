import 'server-only';
import { createBot } from '../router';

/** customer boti: vaqtinchalik zaglushka — 4-bosqichda to'liq yoziladi */
export const bot = createBot('customer');

bot.command('start', (ctx) => ctx.reply("Bot hozircha sozlanmoqda. Tez orada ishga tushadi."));
bot.text((ctx) => ctx.reply('/start'));
