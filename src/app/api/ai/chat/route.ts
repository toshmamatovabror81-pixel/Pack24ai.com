/**
 * POST /api/ai/chat
 * Gemini Flash LLM + Knowledge Base (RAG) + Keyword fallback
 * ─────────────────────────────────────────────────────────────
 * 1. Gemini API key mavjud bo'lsa → Gemini Flash 2.0 ishlatiladi
 * 2. Aks holda → eski keyword-matching fallback ishlaydi
 */
import { NextResponse } from 'next/server';
import { KNOWLEDGE_BASE, FALLBACK_RESPONSES } from '@/lib/ai-knowledge';
import { rateLimit } from '@/lib/rateLimit';

// ─── Types ────────────────────────────────────────────────────
interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

interface ChatRequest {
    message: string;
    inlineData?: { data: string; mimeType: string };
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

// Rate limit konfiguratsiyasi shared `rateLimit` helper'iga ko'chirildi (P1.4)
const AI_RATE_LIMIT = 30;          // IP bo'yicha max so'rov
const AI_RATE_WINDOW_MS = 60_000;  // per minute

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

    return `Siz Pack24 kompaniyasining professional, xushmuomala va tajribali B2B savdo menejerisiz (AI yordamchi).

## ASOSIY QOIDALAR (CRITICAL):
1. Foydalanuvchi bilan FAQAT ${langLabel} tilida gaplashishingiz shart.
2. Mijozga yordam berish, savollariga aniq va professional javob berish sizning vazifangiz.
3. MUHIM: Yozuvda HECH QACHON yulduzcha (*) belgisini ishlatmang (na ro'yxat uchun, na qalin yozish uchun, na matematika uchun). Matematik ko'paytirish uchun faqatgina nuqta (.) ishlating (masalan: 100 . 200). Ro'yxatlar uchun faqat tire (-) yoki raqam ishlating.
4. Javoblaringiz konkret bo'lsin. Juda uzun doston yozmang.
5. Mijozga buyurtma berish majburiyatini qo'ymang. Faqat u xohlasagina yordam bering.
6. Agar kontekstda narx mavjud bo'lsa (totalPrice yoki unitPrice), doimo o'sha narxni ishlating.
7. O'zingizdan Pack24 da yo'q xizmatlarni yoki narxlarni to'qimang. Agar aniq ma'lumot bo'lmasa: "Bu bo'yicha aniq ma'lumotni menejerlarimizdan bilib olishingiz mumkin" deb javob bering.
8. Boshqa kompaniyalar (raqobatchilar) haqida yomon gapirmang.

## PACK24 HAQIDA MA'LUMOTLAR
- Pack24 — O'zbekistondagi yetakchi qadoqlash kompaniyasi
- Manzil: Toshkent sh., Chilonzor tumani
- Telefon: +998 88 055 78 88
- Telegram: [@pack24ai](https://t.me/pack24ai) (Telegram manzilini berayotganda faqtgina [@pack24ai](https://t.me/pack24ai) shaklida yozing, bu mijozga link bo'lib ko'rinadi)
- Sayt: pack24.uz
- Minimal buyurtma yo'q (Zero MOQ) — 72 donadan boshlash mumkin
- Materiallar: 3 qavatli va 5 qavatli gofrokarton (Kraft va Sellyuloza)
- Pechat turlari: Flekso (arzon), Ofset (premium), Raqamli (tezkor)
- To'lov usullari: Naqd, Pul o'tkazish, Payme/Click
- Toshkent ichida bepul yetkazib berish (katta buyurtmalar uchun)
- PQ-136 eksport imtiyozlari 2028 yilgacha amal qiladi
- AI dizayn xizmati mavjud — 3D modellashtirish va dizayn yaratish
- GLOBAL G.A.P standartlariga muvofiq ekologik qadoqlash

## NARX HISOBLASH FORMULASI (KALKULYATOR)
Agar mijoz qutining o'lchamlarini (Uzunlik x Kenglik x Balandlik) aytib narxini so'rasa va u hozirgi kontekstda bo'lmasa, quyidagi formula bo'yicha hisoblab bering:
1. Material narxlari:
   - 3 qavatli karton (E-Flute, B-Flute): 7000 so'm / 1 m²
   - 5 qavatli karton (EB-Flute): 11000 so'm / 1 m²
2. Kvadrat metrni hisoblash (FEFCO 0201 standart quti):
   Uzunlik (L), Kenglik (W), Balandlik (H) (millimetrda).
   - List Uzunligi = (L . 2) + (W . 2) + 35
   - List Balandligi = H + W
   - Yuzasi (m²) = (List Uzunligi / 1000) . (List Balandligi / 1000)
3. 1 dona quti narxi = Yuzasi (m²) . Material Narxi.
Hisobni aniq ko'rsatib, 1 dona va 100 dona quti narxini aytib bering. Mantiqan xato qilmang, matematikani to'g'ri ishlating!

## RASM VA CHIZMALARNI TAHLIL QILISH (VISION)
Agar mijoz sizga rasm yuborsa (quti chizmasi, blueprint yoki shunga o'xshash), uni diqqat bilan o'rganib chiqing:
1. Rasmda qanday o'lchamlar ko'rsatilganini (Uzunlik, Kenglik, Balandlik) aniqlang.
2. Agar hamma o'lchamlar mavjud bo'lsa, mijozdan material turini (masalan: 3 qavatli yoki 5 qavatli) so'rang, keyin narx hisoblab bering.
3. Agar o'lchamlar to'liq bo'lmasa, mijozga aynan qaysi o'lcham yetishmayotganini ayting.
4. Har doim rasmga mos tarzda qisqa va aniq javob bering.

## TASHQI 3D AI Dvigatel (GENERATIVE 3D)
Mijoz quti (pitsa qutisi, pochta qutisi va hk) so'rasa, endi bizning ichki bazamizdan foydalanmaysiz!
Sizning vazifangiz tashqi 3D AI tarmog'iga (Meshy/Tripo3D kabi) murojaat qilib, qutining 3D modelini yasatishdir.
Buning uchun javobingizda doimo quyidagi maxsus kodni qoldiring:
'[GENERATE_3D: "Detailed description of the box in english for 3D AI generation"]'

Misollar:
Mijoz: "Menga oq fonli pitsa qutisi kerak"
Sizning javobingizda qatnashishi kerak: '[GENERATE_3D: "A clean white cardboard pizza box with closed lid"]'

Mijoz: "Sovg'a uchun yurak shaklidagi qizil quti"
Sizning javobingizda qatnashishi kerak: '[GENERATE_3D: "A beautiful red heart-shaped gift box"]'

Bu teglarni doimo matningiz oxiriga probel tashlab qo'ying. Hech qachon mijozga [GENERATE_3D:...] kodini tushuntirmang, bu tizim uchun yashirin buyruq.

## FAQ (BILIM BAZASI JAVOBLARI)
Quyidagi ma'lumotlardan foydalanib mijoz savollariga javob bering:
${knowledgeSections}
${contextBlock}

## MULOQOT USLUBI
Mijozga doim yordam berishga tayyor, erkin, lekin rasmiy menejer kabi muloqot qiling. Tabiiy ko'ring. Bitta savolga bir nechta variantlar taklif qilishingiz mumkin. Emoji ishlating (lekin me'yorida, har gapga emas).`;
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
    context?: ChatRequest['context'],
    inlineData?: { data: string; mimeType: string }
): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const systemPrompt = buildSystemPrompt(language, context);

    // Build conversation content for Gemini
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add history (last 10 messages max for token efficiency)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
        // If the historical message contains an image, we should theoretically pass it if supported.
        // For simplicity, we just pass the text of history here to avoid bloating tokens too much,
        // unless you specifically store inlineData in history. 
        // We'll pass the current message's inlineData below.
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        });
    }

    // Add current message
    const currentParts: any[] = [];
    if (message) currentParts.push({ text: message });
    if (inlineData) {
        currentParts.push({ inlineData });
    }
    
    if (currentParts.length === 0) currentParts.push({ text: "Hello" }); // Fallback

    contents.push({
        role: 'user',
        parts: currentParts,
    });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 1500,
            temperature: 0.3,
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
        const rl = await rateLimit(req, {
            bucket: 'ai-chat',
            limit: AI_RATE_LIMIT,
            windowMs: AI_RATE_WINDOW_MS,
        });
        if (!rl.ok) return rl.response;

        const body: ChatRequest = await req.json();
        const { message, inlineData, language = 'uz', context, history = [] } = body;
        const startTime = Date.now();

        // Input validation
        if (!message?.trim() && !inlineData) {
            return NextResponse.json({ error: 'Message or image is required' }, { status: 400 });
        }

        // Sanitize & limit message length
        const sanitizedMessage = message.trim().slice(0, 500);

        let responseText: string;
        let engine: 'gemini' | 'legacy' = 'legacy';

        // Try Gemini first, fallback to keyword matcher
        const geminiKey = process.env.GEMINI_API_KEY?.trim();
        if (geminiKey && geminiKey.length > 10) {
            try {
                responseText = await geminiResponse(sanitizedMessage, language, history, context, inlineData);
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
