/**
 * POST /api/ai/chat
 * Gemini Flash LLM + Knowledge Base (RAG) + Keyword fallback
 * ─────────────────────────────────────────────────────────────
 * 1. Gemini API key mavjud bo'lsa → Gemini Flash 2.0 ishlatiladi
 * 2. Aks holda → eski keyword-matching fallback ishlaydi
 */
import { NextResponse } from 'next/server';
import { KNOWLEDGE_BASE, FALLBACK_RESPONSES } from '@/lib/ai-knowledge';

// ─── HTML Strip Helper ───────────────────────────────────────
function stripHtml(str: string): string {
    return str.replace(/<[^>]*>/g, '').trim();
}

// ─── Types ────────────────────────────────────────────────────
interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

interface ChatRequest {
    message: string;
    language?: string;
    history?: ChatMessage[];
    context?: {
        modelName?: string;
        quantity?: number;
        totalPrice?: number;
        unitPrice?: number;
        material?: string;
        dims?: { l: number; w: number; h: number };
        currentPage?: string;
    };
}

// ─── Rate Limiting (in-memory, per IP + per user) ────────────
interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_IP = 30;         // IP uchun max so'rovlar
const RATE_LIMIT_USER = 50;       // Autentifikatsiya qilingan foydalanuvchi uchun
const RATE_WINDOW = 60_000;       // per minute

/**
 * IP manzilni aniqlash — proxy, load balancer, CDN ortida ham to'g'ri ishlaydi
 */
function extractClientIP(req: Request): string {
    // Cloudflare
    const cfIP = req.headers.get('cf-connecting-ip');
    if (cfIP) return cfIP.trim();

    // Standard proxy headers
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
        // Birinchi IP — haqiqiy client IP
        const firstIP = forwarded.split(',')[0]?.trim();
        if (firstIP) return firstIP;
    }

    const realIP = req.headers.get('x-real-ip');
    if (realIP) return realIP.trim();

    // Vercel
    const vercelIP = req.headers.get('x-vercel-forwarded-for');
    if (vercelIP) return vercelIP.split(',')[0]?.trim() || 'unknown';

    return 'unknown';
}

function checkRateLimit(identifier: string, limit: number = RATE_LIMIT_IP): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(identifier);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_WINDOW });
        return true;
    }

    if (entry.count >= limit) return false;
    entry.count++;
    return true;
}

/**
 * Eskirgan yozuvlarni tozalash — memory leak oldini olish
 * Har 5 daqiqada bir marta
 */
if (typeof globalThis !== 'undefined') {
    const cleanup = () => {
        const now = Date.now();
        for (const [key, val] of rateLimitMap) {
            if (now > val.resetAt) rateLimitMap.delete(key);
        }
    };
    setInterval(cleanup, 300_000);
}

// ─── Analytics Tracker (shared module) ───────────────────────
import { trackAnalytics } from '@/lib/ai-analytics';

// ─── System Prompt Builder ───────────────────────────────────
function buildSystemPrompt(lang: string, ctx?: ChatRequest['context']): string {
    // Compile knowledge base into a concise reference block
    const knowledgeSections = KNOWLEDGE_BASE.map(article => {
        const response = (article.responses as Record<string, string>)[lang]
            ?? (article.responses as Record<string, string>)['uz']
            ?? '';
        return `[${article.id.toUpperCase()}]: ${response}`;
    }).join('\n');

    const langNames: Record<string, string> = {
        uz: "o'zbek", ru: 'русский', en: 'English', qr: 'Qaraqalpaq',
        zh: '中文', tr: 'Türkçe', tg: 'тоҷикӣ', kk: 'қазақ', tk: 'türkmen', fa: 'فارسی',
    };

    const langLabel = langNames[lang] ?? langNames['uz'];

    let contextBlock = '';
    if (ctx) {
        const parts: string[] = [];
        if (ctx.modelName) parts.push(`Model: ${ctx.modelName}`);
        if (ctx.dims) parts.push(`Dimensions: ${ctx.dims.l}×${ctx.dims.w}×${ctx.dims.h} mm`);
        if (ctx.material) parts.push(`Material: ${ctx.material}`);
        if (ctx.quantity) parts.push(`Quantity: ${ctx.quantity}`);
        if (ctx.totalPrice) parts.push(`Total price: ${ctx.totalPrice.toLocaleString()} UZS`);
        if (ctx.unitPrice) parts.push(`Unit price: ${ctx.unitPrice.toLocaleString()} UZS`);
        if (ctx.currentPage) parts.push(`Current page: ${ctx.currentPage}`);
        if (parts.length > 0) {
            contextBlock = `\n\n## CURRENT SESSION CONTEXT\n${parts.join('\n')}`;
        }
    }

    return `Sen Pack24 AI maslahatchisisan — O'zbekistondagi yetakchi qadoqlash (packaging) kompaniyasining aqlli yordamchisi.

## ROL VA XULQ-ATVOR
- Sen do'stona, professional va qisqa javob beruvchi AI maslahatchisan
- Foydalanuvchi bilan FAQAT ${langLabel} tilida gaplash
- Har doim qisqa va aniq javob ber (3-5 jumla). Ortiqcha ma'lumot berma
- Emoji ishlatish mumkin, lekin haddan tashqari ko'p emas (1-2 ta)
- Agar savol Pack24 ga tegishli bo'lmasa, muloyimlik bilan qadoqlash mavzusiga qaytargina
- Agar narx so'ralsa va kontekstda narx mavjud bo'lsa, aynan o'sha narxni ayt
- Agar savol noaniq bo'lsa, aniqlashtiruvchi savol ber

## PACK24 HAQIDA MA'LUMOTLAR
- Pack24 — O'zbekistondagi yetakchi qadoqlash kompaniyasi
- Manzil: Toshkent sh., Chilonzor tumani
- Telefon: +998 90 123-45-67
- Telegram: @pack24uz
- Sayt: pack24.uz
- Minimal buyurtma yo'q (Zero MOQ) — 72 donadan boshlash mumkin
- Materiallar: 3 qavatli va 5 qavatli gofrokarton (Kraft va Sellyuloza)
- Pechat turlari: Flekso (arzon), Ofset (premium), Raqamli (tezkor)
- To'lov usullari: Naqd, Pul o'tkazish, Payme/Click
- Toshkent ichida bepul yetkazib berish (katta buyurtmalar uchun)
- PQ-136 eksport imtiyozlari 2028 yilgacha amal qiladi
- AI dizayn xizmati mavjud — 3D modellashtirish va dizayn yaratish
- GLOBAL G.A.P standartlariga muvofiq ekologik qadoqlash

## BILIM BAZASI JAVOBLARI
${knowledgeSections}${contextBlock}

## BUYURTMA OQIMI (Order Flow)
Agar foydalanuvchi buyurtma bermoqchi bo'lsa, quyidagi tartibda savol ber:
1. Avval qanday mahsulot kerakligini aniqlash — Agar kontekstda modelName bo'lsa, tasdiqlash: "Sizga [modelName] kerak ekan, to'g'rimi?"
2. Pechat turini so'rash: "Ofset (premium, aniq rasmlar) yoki Flekso (arzon, tezkor) bosma kerakmi?"
3. Yetkazib berish kerakligini so'rash: "Yetkazib berish xizmati kerakmi yoki olib ketasizmi?"
4. Agar yetkazish kerak bo'lsa — manzilni so'rash: "Manzilingizni yozib yuboring (Tuman, ko'cha, mo'ljal)"
5. Telefon raqamini so'rash: "Telefon raqamingizni qoldiring"
6. To'lov usulini so'rash: "Naqd, Pul o'tkazish yoki Click/Payme?"
7. Muddatni so'rash: "Buyurtma qachonga tayyor bo'lishi kerak?"
8. Yakuniy hisobot chiqarish — barcha ma'lumotlarni yig'ib, chiroyli xulosa yoz

MUHIM: Har bir qadamda FAQAT bitta savol ber. Barcha savollarni bir vaqtda BERMA.
Agar foydalanuvchi bir nechta ma'lumotni birdaniga bersa, qabul qilib keyingi savolga o't.

## MUHIM QOIDALAR
1. FAQAT ${langLabel} tilida javob ber
2. Markdown formatini ISHLATMA — oddiy matn yoz
3. Narx so'ralganda va kontekstda totalPrice/unitPrice bo'lsa, o'sha raqamlarni ber
4. Raqobatchilar haqida salbiy gapirma
5. Bilmagan narsani to'qima — "Bu haqda menejerimiz batafsil ma'lumot beradi" de
6. Javob 300 so'zdan oshmasin
7. Buyurtma oqimida har safar foydalanuvchining oldingi javoblarini eslash va takrorlamaslik`;
}

// ─── Legacy Keyword Matcher (fallback) ───────────────────────
function matchIntent(text: string): string {
    const lower = text.toLowerCase();

    const greetingKeywords = ['salom', 'assalom', 'hello', 'hi', 'hey', 'привет', 'здравствуй', 'добрый', 'merhaba', '你好', 'سلام'];
    if (greetingKeywords.some(k => lower.includes(k))) return 'greeting';

    let bestMatch = 'unknown';
    let maxScore = 0;

    for (const article of KNOWLEDGE_BASE) {
        const allKeywords = article.keywords as Record<string, string[]>;
        let score = 0;
        for (const langKeys of Object.values(allKeywords)) {
            for (const kw of langKeys) {
                if (lower.includes(kw.toLowerCase())) score += kw.length;
            }
        }
        if (score > maxScore) { maxScore = score; bestMatch = article.id; }
    }

    return maxScore > 0 ? bestMatch : 'unknown';
}

function substituteVars(template: string, ctx: ChatRequest['context'], lang: string): string {
    const fmt = (n: number) =>
        new Intl.NumberFormat(lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US', {
            style: 'currency', currency: 'UZS', maximumFractionDigits: 0,
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

function legacyResponse(message: string, language: string, context?: ChatRequest['context']): string {
    const intent = matchIntent(message);

    if (intent === 'unknown') {
        return (FALLBACK_RESPONSES as Record<string, string>)[language]
            ?? (FALLBACK_RESPONSES as Record<string, string>)['en']
            ?? "I'm sorry, I didn't understand.";
    }

    const article = KNOWLEDGE_BASE.find(a => a.id === intent);
    if (article) {
        const responses = article.responses as Record<string, string>;
        const template = responses[language] ?? responses['en'] ?? responses['uz'] ?? '';
        return substituteVars(template, context, language);
    }

    return (FALLBACK_RESPONSES as Record<string, string>)[language]
        ?? "Please ask me about pricing, delivery, or materials.";
}

// ─── Gemini AI Response ──────────────────────────────────────
async function geminiResponse(
    message: string,
    language: string,
    history: ChatMessage[],
    context?: ChatRequest['context']
): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const systemPrompt = buildSystemPrompt(language, context);

    // Build conversation content for Gemini
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add history (last 10 messages max for token efficiency)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        });
    }

    // Add current message
    contents.push({
        role: 'user',
        parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 500,
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
        },
    });

    const text = response.text?.trim();
    if (!text) throw new Error('Empty Gemini response');

    return text;
}

// ─── POST Handler ────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        // Rate limiting — IP + user token
        const ip = extractClientIP(req);

        if (!checkRateLimit(`ip:${ip}`, RATE_LIMIT_IP)) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429 }
            );
        }

        const body: ChatRequest = await req.json();
        const { message, language = 'uz', context, history = [] } = body;
        const startTime = Date.now();

        // Input validation
        if (!message?.trim()) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Sanitize & limit message length
        const sanitizedMessage = message.trim().slice(0, 500);

        // Sanitize context fields — strip HTML from user-provided strings
        if (context) {
            if (context.modelName) context.modelName = stripHtml(context.modelName).slice(0, 200);
            if (context.material) context.material = stripHtml(context.material).slice(0, 200);
        }

        // Cap history to max 10 entries server-side (don't trust client)
        const safeHistory = Array.isArray(history) ? history.slice(-10) : [];

        let responseText: string;
        let engine: 'gemini' | 'legacy' = 'legacy';

        // Try Gemini first, fallback to keyword matcher
        const geminiKey = process.env.GEMINI_API_KEY?.trim();
        if (geminiKey && geminiKey.length > 10) {
            try {
                responseText = await geminiResponse(sanitizedMessage, language, safeHistory, context);
                engine = 'gemini';
            } catch (err) {
                console.warn('[AI Chat] Gemini failed, using legacy fallback:', err);
                responseText = legacyResponse(sanitizedMessage, language, context);
            }
        } else {
            responseText = legacyResponse(sanitizedMessage, language, context);
        }

        // Track analytics
        trackAnalytics({
            timestamp: Date.now(),
            language,
            engine,
            responseTimeMs: Date.now() - startTime,
            messageLength: sanitizedMessage.length,
        });

        return NextResponse.json({
            role: 'assistant',
            content: responseText,
            engine,
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
