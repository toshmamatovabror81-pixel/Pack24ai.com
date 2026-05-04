import { Context } from 'telegraf';
import { Supervisor } from '@prisma/client';
import { Lang } from './i18n';
import { JournalFlow, setJournalSession } from './adminBot.shared';
import { startOfDay, startOfYesterday } from '@/lib/domain/recycling/journal';

/** Jurnal boshida sana tanlash tugmalari (Bugun / Kecha / Qo'lda) */
export function journalEntryDateKeyboard(flow: JournalFlow) {
    return {
        inline_keyboard: [
            [
                { text: '📅 Bugun', callback_data: `jd_${flow}_t` },
                { text: '📅 Kecha', callback_data: `jd_${flow}_y` },
            ],
            [{ text: '✏️ Qo\'lda sana', callback_data: `jd_${flow}_m` }],
        ],
    };
}

export async function advanceJournalAfterDateChosen(
    ctx: Context,
    tgId: string,
    lang: Lang,
    supId: number,
    flow: JournalFlow,
    date: Date,
) {
    const iso = date.toISOString();
    switch (flow) {
        case 'intake':
            setJournalSession(tgId, lang, supId, 'intake', 'weight', { journalDate: iso });
            await ctx.reply(
                `⚖️ Qabul qilingan makulatura og\'irligini kiriting (kg).\n\nMasalan: <code>1500</code>`,
                { parse_mode: 'HTML' },
            );
            break;
        case 'press':
            setJournalSession(tgId, lang, supId, 'press', 'weight', { journalDate: iso });
            await ctx.reply('⚖️ Presslangan og\'irlikni kiriting (kg).');
            break;
        case 'expense':
            setJournalSession(tgId, lang, supId, 'expense', 'expense', { journalDate: iso });
            await ctx.reply(
                '💸 Xarajat summasini kiriting. Agar bo\'lmasa <code>0</code> yozing.',
                { parse_mode: 'HTML' },
            );
            break;
        case 'cash':
            setJournalSession(tgId, lang, supId, 'cash', 'openingBalance', { journalDate: iso });
            await ctx.reply('🏦 Boshlang\'ich kassa summasini kiriting.');
            break;
        case 'sale':
            setJournalSession(tgId, lang, supId, 'sale', 'customer', { journalDate: iso });
            await ctx.reply('🏢 Mijoz nomini kiriting.');
            break;
        default:
            await ctx.reply('❌ Noma\'lum jurnal.');
    }
}

/** @returns true agar callback qayta ishlangan bo'lsa */
export async function tryHandleJournalDateCallback(
    ctx: Context,
    data: string,
    supervisor: Supervisor,
    tgId: string,
    lang: Lang,
): Promise<boolean> {
    const match = /^jd_(intake|press|expense|cash|sale)_(t|y|m)$/.exec(data);
    if (!match) return false;

    const flow = match[1] as JournalFlow;
    const kind = match[2];

    if (kind === 'm') {
        setJournalSession(tgId, lang, supervisor.id, flow, 'date', {});
        await ctx.reply(
            `Sanani yuboring.\n<i>Namuna:</i> <code>2026-04-01</code> yoki <code>bugun</code>\n\n` +
                `<i>Bekor:</i> <code>cancel</code>`,
            { parse_mode: 'HTML' },
        );
        await ctx.answerCbQuery('✏️');
        return true;
    }

    const date = kind === 't' ? startOfDay(new Date()) : startOfYesterday();
    await advanceJournalAfterDateChosen(ctx, tgId, lang, supervisor.id, flow, date);
    await ctx.answerCbQuery('📅');
    return true;
}
