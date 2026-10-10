import 'server-only';
import { removeKeyboard } from '../api';
import { createBot, type Ctx } from '../router';

/**
 * Boshqaruv boti (@pack24AUP_bot) — xodimlar uchun. Makulatura (masul/rahbariyat) oqimlari olib tashlangan;
 * yangi buyurtma xabarlari va holatni o'zgartirish keyingi yangilanishda qo'shiladi.
 * Hozircha kim yozganini tekshirmaydi, shuning uchun javobda ichki ma'lumot yo'q.
 */
export const bot = createBot('staff');

async function welcome(ctx: Ctx): Promise<void> {
  await ctx.clearSession();
  await ctx.reply(
    [
      '👋 Bu <b>Pack24</b> xodimlari uchun boshqaruv boti.',
      '',
      '🛠 Bot yangilanmoqda: tez orada yangi buyurtmalar haqidagi xabarlar shu yerga keladi.',
      'Makulatura bo\'limi (arizalar, haydovchilar, jurnal) yopilgan.',
    ].join('\n'),
    { reply_markup: removeKeyboard },
  );
}

bot.command('start', welcome);
bot.command('help', welcome);
bot.text(welcome);
