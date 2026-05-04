import { useState, useCallback } from 'react';
import { KNOWLEDGE_BASE, FALLBACK_RESPONSES, CONVERSATION_PROMPTS, Intent } from '../ai-knowledge';
import { Language } from '../translations';
import { BoxModel, BoxDimensions, Material } from '../types';

interface AIContext {
    model?: BoxModel;
    dims?: BoxDimensions;
    totalPrice?: number;
    unitPrice?: number;
    language: Language;
    quantity?: number;
    material?: Material;
}

interface ConversationState {
    step: 'intro' | 'intent' | 'box_qty' | 'print_type' | 'delivery' | 'address' | 'phone' | 'payment' | 'deadline' | 'report' | 'finished';
    data: {
        intent?: string;
        confirmedQty?: boolean;
        printType?: 'offset' | 'flexo' | 'none';
        deliveryNeeded?: boolean;
        address?: string;
        phone?: string;
        paymentMethod?: string;
        deadline?: string;
    };
}

export function useAI() {
    const [isTyping, setIsTyping] = useState(false);
    const [conversation, setConversation] = useState<ConversationState>({ step: 'intro', data: {} });

    const matchIntent = (text: string, lang: Language): Intent => {
        const lowerText = text.toLowerCase();

        // 1. Check for specific flow keywords first
        if (lowerText.includes('offset') || lowerText.includes('ofset')) return 'printing';
        if (lowerText.includes('flexo') || lowerText.includes('flekso')) return 'printing';
        if (lowerText.includes('farqi') || lowerText.includes('nima')) return 'printing';

        if (lowerText.includes('ha') || lowerText.includes('yes') || lowerText.includes('da')) return 'affirmative';
        if (lowerText.includes('yo\'q') || lowerText.includes('no') || lowerText.includes('net')) return 'negative';

        // 2. Standard Knowledge Base Search
        let bestMatch: Intent = 'unknown';
        let maxScore = 0;

        for (const article of KNOWLEDGE_BASE) {
            const keywords = article.keywords[lang] ?? article.keywords['en'] ?? [];
            let score = 0;

            for (const kw of keywords) {
                const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (lowerText.includes(kw.toLowerCase())) {
                    score += kw.length;
                }
            }

            if (score > maxScore) {
                maxScore = score;
                bestMatch = article.id;
            }
        }

        return maxScore > 0 ? bestMatch : 'unknown';
    };

    const generateResponse = useCallback(async (text: string, context: AIContext): Promise<string> => {
        setIsTyping(true);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        let nextStep = conversation.step;
        const nextData = { ...conversation.data };
        let responseTemplate = "";
        const intent = matchIntent(text, context.language);
        const lang = context.language;
        const prompts = CONVERSATION_PROMPTS; // Alias for cleaner code

        // Helper to safely get prompt
        const getPrompt = (key: keyof typeof CONVERSATION_PROMPTS) => {
            return (prompts[key] as any)[lang] || (prompts[key] as any)['en'];
        };

        // State Machine Logic
        switch (conversation.step) {
            case 'intro':
                nextStep = 'intent';
                responseTemplate = getPrompt('intro');
                break;

            case 'intent':
                nextStep = 'box_qty';
                responseTemplate = getPrompt('intent_confirm');
                break;

            case 'box_qty':
                nextStep = 'print_type';
                responseTemplate = getPrompt('box_qty_ask');
                break;

            case 'print_type':
                if (intent === 'printing' && (text.toLowerCase().includes('farq') || text.toLowerCase().includes('what'))) {
                    nextStep = 'print_type';
                    responseTemplate = getPrompt('print_type_explain');
                } else {
                    nextStep = 'delivery';
                    nextData.printType = text.toLowerCase().includes('ofset') ? 'offset' : 'flexo';
                    responseTemplate = getPrompt('delivery_ask');
                }
                break;

            case 'delivery':
                if (intent === 'affirmative') {
                    nextStep = 'address';
                    nextData.deliveryNeeded = true;
                    responseTemplate = getPrompt('address_ask');
                } else {
                    nextStep = 'phone';
                    nextData.deliveryNeeded = false;
                    responseTemplate = getPrompt('phone_ask_pickup');
                }
                break;

            case 'address':
                nextStep = 'phone';
                nextData.address = text;
                responseTemplate = getPrompt('phone_ask_address');
                break;

            case 'phone':
                nextStep = 'payment';
                nextData.phone = text;
                responseTemplate = getPrompt('payment_ask');
                break;

            case 'payment':
                nextStep = 'deadline';
                nextData.paymentMethod = text;
                responseTemplate = getPrompt('deadline_ask');
                break;

            case 'deadline':
                nextStep = 'report';
                nextData.deadline = text;

                const title = getPrompt('report_title');
                const labels = (prompts.report_labels as any)[lang] || (prompts.report_labels as any)['en'];

                responseTemplate = `${title}\n\n` +
                    `📦 ${labels.product}: ${context.model?.name}\n` +
                    `🔢 ${labels.qty}: ${context.quantity}\n` +
                    `🧱 ${labels.material}: ${context.material?.name}\n` +
                    `🎨 ${labels.print}: ${nextData.printType === 'offset' ? (lang === 'uz' ? 'Ofset' : 'Offset') : (lang === 'uz' ? 'Flekso' : 'Flexo')} (TBD)\n` +
                    `🚚 ${labels.delivery}: ${nextData.deliveryNeeded ? (lang === 'uz' ? 'Ha' : 'Yes') + ` (${nextData.address})` : (lang === 'uz' ? "Yo'q" : "No")}\n` +
                    `📞 ${labels.phone}: ${nextData.phone}\n` +
                    `💳 ${labels.payment}: ${nextData.paymentMethod}\n` +
                    `⏱️ ${labels.deadline}: ${text}\n\n` +
                    `${labels.footer}`;
                break;

            case 'report':
                nextStep = 'finished';
                responseTemplate = getPrompt('finished_ask');
                break;

            default:
                if (intent === 'unknown') {
                    responseTemplate = FALLBACK_RESPONSES[context.language] ?? FALLBACK_RESPONSES['en'] ?? '';
                } else {
                    const article = KNOWLEDGE_BASE.find(a => a.id === intent);
                    if (article) {
                        responseTemplate = article.responses[context.language] ?? article.responses['en'] ?? '';
                    }
                }
                break;
        }

        setConversation({ step: nextStep, data: nextData });

        // Variable Substitution (Generic)
        const finalResponse = responseTemplate
            .replace(/{{totalPrice}}/g, new Intl.NumberFormat(context.language === 'uz' ? 'uz-UZ' : 'ru-RU', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(context.totalPrice || 0))
            .replace(/{{unitPrice}}/g, new Intl.NumberFormat(context.language === 'uz' ? 'uz-UZ' : 'ru-RU', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(context.unitPrice || 0))
            .replace(/{{length}}/g, (context.dims?.l || 0).toString())
            .replace(/{{width}}/g, (context.dims?.w || 0).toString())
            .replace(/{{height}}/g, (context.dims?.h || 0).toString())
            .replace(/{{modelName}}/g, context.model?.name || 'Box')
            .replace(/{{materialName}}/g, context.material?.name || 'Karton')
            .replace(/{{quantity}}/g, (context.quantity || 0).toString());

        setIsTyping(false);
        return finalResponse;

    }, [conversation.step, conversation.data]);

    return {
        generateResponse,
        isTyping
    };
}
