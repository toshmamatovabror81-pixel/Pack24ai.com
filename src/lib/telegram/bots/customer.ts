import 'server-only';
import { displayPhone } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import { esc, removeKeyboard } from '../api';
import { createBot, type Ctx } from '../router';

/**
 * Mijoz boti (@Pack24AI_bot). Makulatura oqimlari olib tashlangan; buyurtma holati, balans va rekvizitlar
 * keyingi yangilanishda qo'shiladi. Hozircha har qanday xabarga sayt va aloqa ma'lumotlari bilan javob beradi.
 * Javob `removeKeyboard` bilan ketadi: eski (makulatura) tugmalar mijoz ekranida osilib qolmasin.
 */
export const bot = createBot('customer');

async function welcome(ctx: Ctx): Promise<void> {
  await ctx.clearSession();
  const s = await getSettings();
  const phone = s.phone ? displayPhone(s.phone) : '';
  await ctx.reply(
    [
      `👋 Assalomu alaykum! Bu <b>${esc(s.companyName)}</b> boti.`,
      '',
      "🛠 Bot yangilanmoqda: tez orada shu yerda buyurtmangiz holati va hisob-kitobingizni ko'rishingiz mumkin bo'ladi.",
      'Makulatura bo\'yicha arizalar endi bot orqali qabul qilinmaydi.',
      '',
      `🛒 Buyurtma berish: ${siteUrl()}`,
      phone ? `📞 Telefon: ${esc(phone)}` : null,
      '',
      '🇷🇺 Бот обновляется: скоро здесь можно будет узнать статус заказа и взаиморасчёты. Заявки на макулатуру через бот больше не принимаются.',
    ].filter((l) => l !== null).join('\n'),
    { reply_markup: removeKeyboard },
  );
}

bot.command('start', welcome);
bot.command('help', welcome);
bot.text(welcome);
