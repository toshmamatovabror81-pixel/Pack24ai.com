import { sessions, getUserLang } from '../helpers';
import { customerMainKeyboard } from '../../../keyboards';
import { askAI } from '../../../aiChat';

/**
 * Handle AI chat mode in text handler.
 * Returns true if this handler consumed the message.
 */
export async function handleAiChat(ctx: any, tgId: string, text: string): Promise<boolean> {
    const ses = sessions.get(tgId);
    if (ses?.step !== 'ai_chat') return false;

    const lang = await getUserLang(tgId);

    // ─── AI Chat mode ─────────────────────────────────────────────────
    // Menyuga qaytish
    if (text === '◀️ Menyu' || text === '◀️ Меню' || text === '◀️ Menu') {
        ses.step = 'menu';
        ses.aiHistory = [];
        sessions.set(tgId, ses);
        await ctx.reply(
            lang === 'uz' ? '🏠 Asosiy menyu:' : lang === 'ru' ? '🏠 Главное меню:' : '🏠 Main menu:',
            { reply_markup: customerMainKeyboard(lang) }
        );
        return true;
    }

    // Typing indikator ko'rsatish
    await ctx.sendChatAction('typing');

    // AI ga so'rov yuborish
    const history = ses.aiHistory || [];
    const result = await askAI({
        message: text,
        language: lang,
        history,
    });

    // Tarixni yangilash (oxirgi 20 ta xabar)
    history.push({ role: 'user', text });
    history.push({ role: 'assistant', text: result.content });
    if (history.length > 20) history.splice(0, history.length - 20);
    ses.aiHistory = history;
    sessions.set(tgId, ses);

    // Javobni yuborish
    const engineBadge = result.engine === 'gemini' ? '✨' : '📋';
    await ctx.reply(
        `${engineBadge} ${result.content}`,
        {
            reply_markup: {
                keyboard: [
                    [{ text: lang === 'uz' ? '◀️ Menyu' : lang === 'ru' ? '◀️ Меню' : '◀️ Menu' }],
                ],
                resize_keyboard: true,
            },
        }
    );
    return true;
}
