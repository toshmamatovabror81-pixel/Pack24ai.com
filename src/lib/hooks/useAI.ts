import { useState, useCallback, useRef } from 'react';
import { Language } from '../translations';
import { BoxModel, BoxDimensions, Material } from '../types';

// ─── Types ────────────────────────────────────────────────────
interface AIContext {
    model?: BoxModel;
    dims?: BoxDimensions;
    totalPrice?: number;
    unitPrice?: number;
    language: Language;
    quantity?: number;
    material?: Material;
    currentPage?: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

interface UseAIReturn {
    generateResponse: (userMessage: string, context: AIContext) => Promise<string>;
    isTyping: boolean;
    error: string | null;
    history: ChatMessage[];
    clearHistory: () => void;
    abort: () => void;
}

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // ms

const ERROR_MESSAGES: Record<string, string> = {
    uz: "Ulanish xatosi. Iltimos, qayta urinib ko'ring.",
    ru: 'Ошибка соединения. Попробуйте снова.',
    en: 'Connection error. Please try again.',
    qr: "Baylanıs qáteligi. Qayta urınıp kóriń.",
    zh: '连接错误。请重试。',
    tr: 'Bağlantı hatası. Tekrar deneyin.',
    tg: 'Хатои пайвастшавӣ. Лутфан аз нав кӯшиш кунед.',
    kk: 'Қосылу қатесі. Қайта көріңіз.',
    tk: 'Baglanyşyk ýalňyşlygy. Gaýtadan synanyşyň.',
    fa: 'خطای اتصال. لطفاً دوباره امتحان کنید.',
};

// ─── Persistence helpers ─────────────────────────────────────
const STORAGE_KEY = 'pack24_ai_chat_history';

function loadHistory(): ChatMessage[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        // Keep only last 30 messages to prevent bloat
        return Array.isArray(parsed) ? parsed.slice(-30) : [];
    } catch { return []; }
}

function saveHistory(messages: ChatMessage[]) {
    if (typeof window === 'undefined') return;
    try {
        // Keep only last 30
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch { /* storage full — ignore */ }
}

// ─── Hook ─────────────────────────────────────────────────────
export function useAI(): UseAIReturn {
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<ChatMessage[]>(loadHistory);

    const abortRef = useRef<AbortController | null>(null);

    const abort = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
            setIsTyping(false);
        }
    }, []);

    const clearHistory = useCallback(() => {
        setHistory([]);
        if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    const generateResponse = useCallback(
        async (userMessage: string, context: AIContext): Promise<string> => {
            // Abort any in-flight request
            if (abortRef.current) abortRef.current.abort();

            const controller = new AbortController();
            abortRef.current = controller;

            setIsTyping(true);
            setError(null);

            // Sanitize input
            const sanitized = userMessage.trim().slice(0, 500);
            if (!sanitized) {
                setIsTyping(false);
                return '';
            }

            // Add user message to history immediately
            const userMsg: ChatMessage = { role: 'user', text: sanitized };
            const currentHistory = [...history, userMsg];

            let lastError: string = '';

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

                    // Wait before retry
                    if (attempt > 0) {
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
                    }

                    const res = await fetch('/api/ai/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        signal: controller.signal,
                        body: JSON.stringify({
                            message: sanitized,
                            language: context.language,
                            history: history.slice(-10), // send last 10 for context
                            context: {
                                modelName: context.model?.name,
                                quantity: context.quantity,
                                totalPrice: context.totalPrice,
                                unitPrice: context.unitPrice,
                                material: context.material?.name,
                                currentPage: context.currentPage,
                                dims: context.dims
                                    ? { l: context.dims.l, w: context.dims.w, h: context.dims.h }
                                    : undefined,
                            },
                        }),
                    });

                    if (!res.ok) {
                        if (res.status === 429) {
                            const lang = context.language ?? 'uz';
                            const limitMsg: Record<string, string> = {
                                uz: "Juda ko'p so'rov. Biroz kuting va qayta urinib ko'ring.",
                                ru: 'Слишком много запросов. Подождите немного.',
                                en: 'Too many requests. Please wait a moment.',
                            };
                            const msg = limitMsg[lang] ?? limitMsg['uz'];
                            setError(msg);
                            setIsTyping(false);
                            return msg;
                        }
                        throw new Error(`HTTP ${res.status}`);
                    }

                    const data = await res.json();
                    const responseText = data.content ?? "...";

                    // Update history with both user + assistant messages
                    const assistantMsg: ChatMessage = { role: 'assistant', text: responseText };
                    const newHistory = [...currentHistory, assistantMsg];
                    setHistory(newHistory);
                    saveHistory(newHistory);

                    setIsTyping(false);
                    abortRef.current = null;
                    return responseText;
                } catch (err) {
                    if (err instanceof DOMException && err.name === 'AbortError') {
                        setIsTyping(false);
                        return '';
                    }
                    lastError = (err as Error).message ?? 'Unknown';
                    // Continue to next retry attempt
                }
            }

            // All retries exhausted
            const errorMsg = ERROR_MESSAGES[context.language] ?? ERROR_MESSAGES['uz'];
            setError(errorMsg);
            setIsTyping(false);
            abortRef.current = null;
            console.warn('[useAI] All retries failed:', lastError);
            return errorMsg;
        },
        [history]
    );

    return {
        generateResponse,
        isTyping,
        error,
        history,
        clearHistory,
        abort,
    };
}
