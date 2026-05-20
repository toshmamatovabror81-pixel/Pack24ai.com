/**
 * Pack24 Telegram Bot → AI Chat Bridge
 * Gemini AI ga HTTP orqali so'rov yuboradi
 * ───────────────────────────────────────
 */

interface AIChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

interface AskAIOptions {
    message: string;
    language?: string;
    history?: AIChatMessage[];
    context?: Record<string, unknown>;
}

interface AskAIResult {
    content: string;
    engine: 'gemini' | 'legacy';
}

const AI_CHAT_URL = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/chat`;

/**
 * AI Chat API ga so'rov yuborish (Telegram bot uchun)
 */
export async function askAI(opts: AskAIOptions): Promise<AskAIResult> {
    const { message, language = 'uz', history = [], context } = opts;

    try {
        const res = await fetch(AI_CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, language, history, context }),
        });

        if (!res.ok) {
            throw new Error(`AI API xatosi: ${res.status}`);
        }

        const data = await res.json();
        return {
            content: data.content || 'Javob olinmadi.',
            engine: data.engine || 'legacy',
        };
    } catch (err) {
        console.error('[askAI] Error:', err);
        // Fallback javob
        const fallbacks: Record<string, string> = {
            uz: '⚠️ AI xizmati vaqtinchalik ishlamayapti. Iltimos, keyinroq urinib ko\'ring yoki +998 88 055-78-88 ga qo\'ng\'iroq qiling.',
            ru: '⚠️ AI сервис временно недоступен. Позвоните: +998 88 055-78-88',
            en: '⚠️ AI service temporarily unavailable. Call: +998 88 055-78-88',
        };
        return {
            content: fallbacks[language] || fallbacks['uz'],
            engine: 'legacy',
        };
    }
}
