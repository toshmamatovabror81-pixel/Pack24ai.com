import { Context } from 'telegraf';
import { Lang, getText } from '../../../i18n';
import { reportPeriodKeyboard, supervisorMainKeyboard } from '../../../keyboards';
import {
    adminSessions,
    getSupervisor,
    setMenuSession,
} from '../../../adminBot.shared';
import { journalCorrectionSessions } from '../journalCorrection';
import { isSupervisorReplyMenuText } from '../../../adminBot.menuNav';
import { handleJournalFlow } from '../../../adminBot.text.flows';

export async function authenticateAndPrepare(
    ctx: Context,
    tgId: string,
    _text: string,
) {
    const sup = await getSupervisor(tgId);
    if (!sup) {
        await ctx.reply(
            '❌ Siz masul sifatida ro\'yxatdan o\'tmagansiz.\n\n/start bosing va telefon raqamingizni ulashing.',
            { parse_mode: 'HTML' }
        );
        return null;
    }
    return sup;
}

export function handleMenuReset(tgId: string, text: string, lang: Lang, supId: number) {
    if (isSupervisorReplyMenuText(text)) {
        journalCorrectionSessions.delete(tgId);
        const preMenu = adminSessions.get(tgId);
        if (preMenu?.step === 'journal') {
            setMenuSession(tgId, lang, supId);
        }
    }
}

export async function handleHelp(ctx: Context, text: string): Promise<boolean> {
    if (text === '❓ Yordam') {
        await ctx.reply(
            '👷 <b>Pack24 – Masul boti</b>\n\n' +
            '📋 Arizalar – yangi va jarayondagi arizalar\n' +
            '🚚 Haydovchi tayinlash – ariza uchun haydovchi tanlash\n' +
            '💰 To\'lovlar – hisob-kitob tasdiqlash\n' +
            '🏭 Punkt holati – ochiq/yopiq almashtirish\n' +
            '✏️ Jurnal tahriri (HQ) – eski yozuvni o\'zgartirish uchun so\'rov (HQ tasdig\'i bilan)\n' +
            '📥 Qabul / 🏭 Press / 💸 … – sana: <b>Bugun</b> / <b>Kecha</b> / qo\'lda\n' +
            '📊 Hisobotlar – kunlik/haftalik/oylik statistika\n\n' +
            '/start – Bosh menyu',
            { parse_mode: 'HTML' }
        );
        return true;
    }
    return false;
}

export async function handleJournalCancel(
    ctx: Context,
    tgId: string,
    text: string,
    lang: Lang,
    supId: number,
): Promise<boolean> {
    const ses = adminSessions.get(tgId);
    if (ses?.step === 'journal' && ses.flow) {
        if (['bekor', 'cancel', '/cancel', '❌'].includes(text.trim().toLowerCase())) {
            setMenuSession(tgId, lang, supId);
            await ctx.reply('❌ Amal bekor qilindi.', {
                parse_mode: 'HTML',
                reply_markup: supervisorMainKeyboard(),
            });
            return true;
        }
        return false;
    }
    return false;
}

export async function handleJournalFlowText(
    ctx: Context,
    tgId: string,
    text: string,
    sup: { id: number; name: string; pointId: number | null },
    lang: Lang,
): Promise<boolean> {
    const ses = adminSessions.get(tgId);
    if (ses?.step === 'journal' && ses.flow) {
        const handled = await handleJournalFlow(ctx, tgId, text, ses, sup, lang);
        return handled;
    }
    return false;
}

export async function handleReportButton(ctx: Context, text: string, lang: Lang): Promise<boolean> {
    if (text === getText('adm_btn_report', lang) || text === getText('adm_btn_report', 'ru') || text === getText('adm_btn_report', 'en')) {
        await ctx.reply(
            '📊 <b>Hisobot davrini tanlang:</b>',
            { parse_mode: 'HTML', reply_markup: reportPeriodKeyboard() }
        );
        return true;
    }
    return false;
}
