/**
 * POST /api/ai/design
 * AI Packaging Designer — Gemini Flash orqali qadoqlash dizayni tavsiyalari
 * ─────────────────────────────────────────────────────────────
 * 1. Gemini API key mavjud → AI tavsiyalar generatsiya qilinadi
 * 2. Aks holda → mock (lekin realistik) tavsiyalar qaytariladi
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

// ─── Types ────────────────────────────────────────────────────
interface DesignRequest {
    productType: string;
    dimensions: { length: number; width: number; height: number };
    material: string;
    style: string;
    targetAudience: string;
    budget: string;
}

interface EstimatedCost {
    min: number;
    max: number;
    currency: string;
}

interface DesignSuggestion {
    title: string;
    description: string;
    material: string;
    printType: string;
    estimatedCost: EstimatedCost;
    ecoScore: number;
    features: string[];
}

interface DesignResponse {
    suggestions: DesignSuggestion[];
    aiInsight: string;
}

// ─── Rate limit ───────────────────────────────────────────────
const DESIGN_RATE_LIMIT = 10;
const DESIGN_RATE_WINDOW_MS = 60_000;

// ─── System Prompt Builder ───────────────────────────────────
function buildDesignPrompt(data: DesignRequest): string {
    return `You are a professional packaging design consultant for Pack24, an Uzbekistan-based packaging company.

Based on the following requirements, generate exactly 3 packaging design suggestions in JSON format.

Requirements:
- Product type: ${data.productType}
- Dimensions: ${data.dimensions.length}mm × ${data.dimensions.width}mm × ${data.dimensions.height}mm
- Preferred material: ${data.material}
- Design style: ${data.style}
- Target audience: ${data.targetAudience}
- Budget level: ${data.budget}

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "suggestions": [
    {
      "title": "Design name in Uzbek",
      "description": "Detailed description in Uzbek (2-3 sentences)",
      "material": "Material recommendation in Uzbek",
      "printType": "Print type in Uzbek (Ofset/Flekso/Raqamli)",
      "estimatedCost": { "min": 2000, "max": 4000, "currency": "UZS" },
      "ecoScore": 85,
      "features": ["Feature 1 in Uzbek", "Feature 2", "Feature 3"]
    }
  ],
  "aiInsight": "Professional insight about the best approach for this product type in Uzbek (2-3 sentences)"
}

Rules:
- All text must be in Uzbek language
- Prices should be realistic per-unit UZS costs for Uzbekistan market
- ecoScore should be 0-100
- Each suggestion should have a different approach (e.g., budget, premium, eco-friendly)
- Features should include material qualities, certifications, and unique selling points
- Print types: Flekso (budget), Ofset (premium quality), Raqamli (small batches)`;
}

// ─── Gemini AI Response ──────────────────────────────────────
async function geminiDesignResponse(data: DesignRequest): Promise<DesignResponse> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const prompt = buildDesignPrompt(data);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            maxOutputTokens: 2000,
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
        },
    });

    const text = response.text?.trim();
    if (!text) throw new Error('Empty Gemini response');

    // Parse JSON from response (handle possible markdown fences)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as DesignResponse;

    // Validate structure
    if (!parsed.suggestions || !Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
        throw new Error('Invalid AI response structure');
    }

    return parsed;
}

// ─── Mock Fallback ───────────────────────────────────────────
function getMockSuggestions(data: DesignRequest): DesignResponse {
    const materialMap: Record<string, string> = {
        '1-qatlamli': '1 qatlamli karton',
        '3-qatlamli': '3 qatlamli gofra karton',
        '5-qatlamli': '5 qatlamli gofra karton',
        'karton': 'Yuqori sifatli karton',
        'kraft': 'Kraft qog\'oz',
    };

    const baseMaterial = materialMap[data.material] || data.material;

    const budgetMultiplier = data.budget === 'low' ? 0.7 : data.budget === 'high' ? 1.5 : 1;

    const baseMin = Math.round(1500 * budgetMultiplier);
    const baseMax = Math.round(3000 * budgetMultiplier);

    return {
        suggestions: [
            {
                title: 'Premium Minimalist',
                description: `Oq fonda qora minimalist dizayn. ${data.productType} mahsuloti uchun zamonaviy va nafis ko'rinish. Yuqori sifatli bosma texnologiyasi bilan brend qiymatini oshiradi.`,
                material: baseMaterial,
                printType: 'Ofset',
                estimatedCost: {
                    min: Math.round(baseMin * 1.3),
                    max: Math.round(baseMax * 1.3),
                    currency: 'UZS',
                },
                ecoScore: 85,
                features: [
                    'Qayta ishlanadigan',
                    'FSC sertifikati',
                    'Soy siyohi',
                    'UV lak',
                ],
            },
            {
                title: 'Eko-Do\'stona',
                description: `Kraft qog'oz asosidagi tabiiy dizayn. ${data.targetAudience || 'Keng auditoriya'} uchun ekologik yondashuv. Minimal kimyoviy ishlov bilan tabiatga zarar kamaytiriladi.`,
                material: 'Kraft gofra karton',
                printType: 'Flekso',
                estimatedCost: {
                    min: baseMin,
                    max: baseMax,
                    currency: 'UZS',
                },
                ecoScore: 95,
                features: [
                    '100% qayta ishlanadigan',
                    'Biologik parchalanuvchi',
                    'Zamonaviy eko-dizayn',
                    'Kam karbon iz',
                ],
            },
            {
                title: 'Rang-Barang Premium',
                description: `To'liq rangli CMYK bosma bilan yorqin dizayn. ${data.style || 'Zamonaviy'} uslubda e'tiborni tortuvchi vizual. Raqobatchilarga nisbatan javonda ajralib turish kafolati.`,
                material: baseMaterial,
                printType: 'Raqamli',
                estimatedCost: {
                    min: Math.round(baseMin * 1.1),
                    max: Math.round(baseMax * 1.1),
                    currency: 'UZS',
                },
                ecoScore: 75,
                features: [
                    'To\'liq CMYK rang',
                    'Glossy yoki matt laminatsiya',
                    'Embossing imkoniyati',
                    'Kichik partiya uchun ideal',
                ],
            },
        ],
        aiInsight: `${data.productType} mahsulot turi uchun ${baseMaterial} eng samarali yechim hisoblanadi. ${data.dimensions.length}x${data.dimensions.width}x${data.dimensions.height}mm o'lchamlar uchun material sarfi optimal darajada. ${data.style === 'Eko' ? 'Ekologik materiallarga talab ortib bormoqda, bu strategik qaror.' : 'Sifatli bosma texnologiyasi brend qiymatini sezilarli oshiradi.'}`,
    };
}

// ─── POST Handler ────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        // Rate limit
        const rl = await rateLimit(req, {
            bucket: 'ai-design',
            limit: DESIGN_RATE_LIMIT,
            windowMs: DESIGN_RATE_WINDOW_MS,
        });
        if (!rl.ok) return rl.response;

        // Auth check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Avtorizatsiya talab qilinadi' },
                { status: 401 }
            );
        }

        const body: DesignRequest = await req.json();

        // Input validation
        if (!body.productType || !body.dimensions || !body.material) {
            return NextResponse.json(
                { error: 'productType, dimensions va material majburiy' },
                { status: 400 }
            );
        }

        let result: DesignResponse;
        let engine: 'gemini' | 'mock' = 'mock';

        // Try Gemini first, fallback to mock
        const geminiKey = process.env.GEMINI_API_KEY?.trim();
        if (geminiKey && geminiKey.length > 10) {
            try {
                result = await geminiDesignResponse(body);
                engine = 'gemini';
            } catch (err) {
                console.warn('[AI Design] Gemini failed, using mock fallback:', err);
                result = getMockSuggestions(body);
            }
        } else {
            result = getMockSuggestions(body);
        }

        return NextResponse.json({
            ...result,
            engine,
        });
    } catch (error) {
        console.error('[AI Design API Error]', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
