import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { getDriver, sessions } from '../helpers';
import { getText, formatText } from '../../../i18n';
import { calcConfirmKeyboard } from '../../../keyboards';
import { fmtN } from '../types';
import { toNumber } from '@/lib/money';

export function registerCalculatorMessageHandlers(bot: Telegraf) {
    bot.on('text', async (ctx, next) => {
        const tgId = ctx.from.id.toString();
        const text = ctx.message.text;

        if (text.startsWith('/')) return next();

        const ses = sessions.get(tgId);
        if (!ses || (ses.step !== 'weight' && ses.step !== 'discount')) return next();

        const driver = await getDriver(tgId);
        if (!driver) {
            await ctx.reply(
                '❌ Siz haydovchi sifatida ro\'yxatdan o\'tmagansiz.\n\n/start bosing va telefon raqamingizni ulashing.',
                { parse_mode: 'HTML' }
            );
            return;
        }

        if (ses.step === 'weight') {
            const weight = parseFloat(text.replace(',', '.'));
            if (isNaN(weight) || weight <= 0 || weight > 99999) {
                await ctx.reply('❌ Noto\'g\'ri og\'irlik! Musbat son kiriting.\n<i>Masalan: 45.5</i>', { parse_mode: 'HTML' });
                return;
            }
            ses.weight = weight;
            ses.step = 'discount';
            await ctx.reply(getText('drv_enter_discount', 'uz'), { parse_mode: 'HTML' });
            return;
        }

        if (ses.step === 'discount') {
            const discount = parseFloat(text.replace(',', '.'));
            if (isNaN(discount) || discount < 0 || discount > 100) {
                await ctx.reply('❌ 0-100 orasida raqam kiriting!');
                return;
            }

            const reqId = ses.activeRequestId!;
            const request = await prisma.recycleRequest.findUnique({
                where: { id: reqId },
                include: { point: true },
            });
            if (!request) {
                sessions.delete(tgId);
                await ctx.reply('❌ Ariza topilmadi.');
                return;
            }

            const pricePerKg = toNumber(request.point?.pricePerKg) || 800;
            const effectiveWeight = ses.weight! * (1 - (discount / 100));
            const totalAmount = effectiveWeight * pricePerKg;

            await ctx.reply(
                formatText('drv_calc_result', 'uz', {
                    weight: String(ses.weight),
                    discount: String(discount),
                    effective: String(Math.round(effectiveWeight * 100) / 100),
                    price: fmtN(pricePerKg),
                    total: fmtN(Math.round(totalAmount)),
                }),
                { parse_mode: 'HTML', reply_markup: calcConfirmKeyboard(reqId) }
            );

            ses.discount = discount;
            return;
        }
    });
}
