import { NextResponse } from 'next/server';
import { KNOWLEDGE_BASE, FALLBACK_RESPONSES } from '@/lib/ai-knowledge';

interface ChatRequest {
    message: string;
    language?: string;
    context?: {
        modelName?: string;
        quantity?: number;
        totalPrice?: number;
        unitPrice?: number;
        material?: string;
        dims?: { l: number; w: number; h: number };
    };
    conversationStep?: string;
}

// Intent matching from message text + language (cross-language: checks ALL language keywords)
function matchIntent(text: string, lang: string): string {
    const lower = text.toLowerCase();

    // Greeting — check across all languages
    const greetingKeywords = ['salom', 'assalom', 'hello', 'hi', 'hey', 'привет', 'здравствуй', 'добрый', 'merhaba', 'selam', '你好', 'سلام', 'ni hao'];
    if (greetingKeywords.some(k => lower.includes(k))) return 'greeting';

    // Score-based matching against ALL keywords in KNOWLEDGE_BASE (all languages)
    let bestMatch = 'unknown';
    let maxScore = 0;

    for (const article of KNOWLEDGE_BASE) {
        const allKeywords = article.keywords as Record<string, string[]>;
        let score = 0;

        // Check keywords from ALL language variants for cross-language support
        for (const langKeys of Object.values(allKeywords)) {
            for (const kw of langKeys) {
                if (lower.includes(kw.toLowerCase())) {
                    score += kw.length;
                }
            }
        }

        if (score > maxScore) {
            maxScore = score;
            bestMatch = article.id;
        }
    }

    return maxScore > 0 ? bestMatch : 'unknown';
}

// Variable substitution in response templates
function substituteVars(template: string, ctx: ChatRequest['context'], lang: string): string {
    const fmt = (n: number) =>
        new Intl.NumberFormat(lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US', {
            style: 'currency',
            currency: 'UZS',
            maximumFractionDigits: 0,
        }).format(n);

    return template
        .replace(/{{totalPrice}}/g, ctx?.totalPrice ? fmt(ctx.totalPrice) : '—')
        .replace(/{{unitPrice}}/g, ctx?.unitPrice ? fmt(ctx.unitPrice) : '—')
        .replace(/{{length}}/g, String(ctx?.dims?.l ?? 0))
        .replace(/{{width}}/g, String(ctx?.dims?.w ?? 0))
        .replace(/{{height}}/g, String(ctx?.dims?.h ?? 0))
        .replace(/{{modelName}}/g, ctx?.modelName ?? 'Quticha')
        .replace(/{{materialName}}/g, ctx?.material ?? 'Karton')
        .replace(/{{quantity}}/g, String(ctx?.quantity ?? 0));
}

export async function POST(req: Request) {
    try {
        const body: ChatRequest = await req.json();
        const { message, language = 'uz', context } = body;

        if (!message?.trim()) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Simulate realistic AI processing delay (500-900ms)
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 400));

        const intent = matchIntent(message, language);

        let responseText: string;

        if (intent === 'unknown') {
            responseText =
                (FALLBACK_RESPONSES as Record<string, string>)[language] ??
                (FALLBACK_RESPONSES as Record<string, string>)['en'] ??
                "I'm sorry, I didn't understand. Please ask about price, delivery, or printing.";
        } else {
            const article = KNOWLEDGE_BASE.find(a => a.id === intent);
            if (article) {
                const responses = article.responses as Record<string, string>;
                const template = responses[language] ?? responses['en'] ?? responses['uz'] ?? '';
                responseText = substituteVars(template, context, language);
            } else {
                responseText =
                    (FALLBACK_RESPONSES as Record<string, string>)[language] ??
                    "Please ask me about pricing, delivery, printing, or materials.";
            }
        }

        return NextResponse.json({
            role: 'assistant',
            content: responseText,
            intent,
            language,
        });
    } catch (error) {
        console.error('[AI Chat API Error]', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
