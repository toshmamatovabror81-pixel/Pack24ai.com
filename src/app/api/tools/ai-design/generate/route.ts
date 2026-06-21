/**
 * POST /api/tools/ai-design/generate
 * Dual engine: Pollinations.ai (primary) + Gemini Imagen (fallback)
 * ─────────────────────────────────────────────────────────────
 * - 4 ta parallel rasm yaratish
 * - 768x768 HD sifat
 * - 8 ta uslub (style) qo'llab-quvvatlash
 * - Rate limiting (10 req/min)
 */
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp, getRateLimitResponse } from '@/lib/rateLimit';

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

const STYLE_SUFFIXES: Record<string, string> = {
    minimalist:  'minimalist flat design, clean white background, thin lines, swiss design',
    luxury:      'luxury premium packaging, gold foil accents, dark background, elegant serif font',
    eco:         'eco-friendly natural kraft paper packaging, earthy green tones, leaf textures',
    bold:        'bold colorful packaging, vibrant gradients, modern strong typography, pop art',
    vintage:     'vintage retro packaging design, antique label, aged texture, sepia tones',
    playful:     'playful fun packaging, bright colors, cartoon elements, kids friendly design',
    corporate:   'corporate professional packaging, navy blue, structured grid layout, minimal',
    modern:      'modern sleek packaging, geometric shapes, sans-serif, monochromatic palette',
};

// Rate limiting (shared library)
const designLimiter = rateLimit({ windowMs: 60_000, max: 10 });

function buildPrompt(userPrompt: string, styleId: string): string {
    const styleSuffix = STYLE_SUFFIXES[styleId] ?? STYLE_SUFFIXES.minimalist;
    return `product packaging design mockup, ${userPrompt}, ${styleSuffix}, professional product photo, studio lighting, isolated on white, high quality render, 4K`;
}

export async function POST(req: NextRequest) {
    try {
        // Rate limiting
        const ip = getClientIp(req);
        const rl = designLimiter.check(`ai-design:${ip}`);
        if (!rl.allowed) return getRateLimitResponse(rl.retryAfterMs);

        const { prompt, style, count = 4, width = 768, height = 768 } = await req.json();

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
            return NextResponse.json({ error: 'Prompt kerak (min 3 belgi)' }, { status: 400 });
        }

        const fullPrompt = buildPrompt(prompt.trim().slice(0, 300), style || 'minimalist');
        const encoded = encodeURIComponent(fullPrompt);

        // Generate random seeds
        const seeds: number[] = Array.from(
            { length: Math.min(count, 6) },
            () => Math.floor(Math.random() * 99999)
        );

        // Fetch all variants in parallel
        const results = await Promise.allSettled(
            seeds.map(async (seed, idx) => {
                const url = `${POLLINATIONS_BASE}/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;

                const response = await fetch(url, {
                    signal: AbortSignal.timeout(45_000), // 45s timeout for HD
                    headers: { 'User-Agent': 'Pack24-AI-Design/2.0' },
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const imageBuffer = await response.arrayBuffer();
                const base64 = Buffer.from(imageBuffer).toString('base64');
                const contentType = response.headers.get('content-type') ?? 'image/jpeg';

                return {
                    index: idx + 1,
                    seed,
                    dataUrl: `data:${contentType};base64,${base64}`,
                    width,
                    height,
                };
            })
        );

        const images = results
            .filter((r): r is PromiseFulfilledResult<{
                index: number; seed: number; dataUrl: string; width: number; height: number
            }> => r.status === 'fulfilled')
            .map(r => r.value);

        if (images.length === 0) {
            return NextResponse.json(
                { error: 'Rasmlar yuklanmadi. Qayta urining.' },
                { status: 503 }
            );
        }

        return NextResponse.json({
            images,
            total: seeds.length,
            loaded: images.length,
            resolution: `${width}x${height}`,
            style: style || 'minimalist',
        });
    } catch (error) {
        console.error('[AI Design API]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// GET — available styles list
export async function GET() {
    return NextResponse.json({
        styles: Object.keys(STYLE_SUFFIXES).map(id => ({
            id,
            name: id.charAt(0).toUpperCase() + id.slice(1),
        })),
        maxPromptLength: 300,
        maxVariants: 6,
        defaultResolution: '768x768',
    });
}
