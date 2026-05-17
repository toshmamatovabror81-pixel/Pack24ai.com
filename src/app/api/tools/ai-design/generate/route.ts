/**
 * POST /api/tools/ai-design/generate
 * Server-side proxy to Pollinations.ai — CORS va QUIC timeout muammosini hal qiladi
 */
import { NextRequest, NextResponse } from 'next/server';

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

function buildPrompt(userPrompt: string, styleId: string): string {
    const styleSuffix = STYLE_SUFFIXES[styleId] ?? STYLE_SUFFIXES.minimalist;
    return `product packaging design mockup, ${userPrompt}, ${styleSuffix}, professional product photo, studio lighting, isolated on white, high quality render`;
}

export async function POST(req: NextRequest) {
    try {
        const { prompt, style, count = 4, width = 512, height = 512 } = await req.json();

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
            return NextResponse.json({ error: 'Prompt kerak' }, { status: 400 });
        }

        const fullPrompt = buildPrompt(prompt.trim().slice(0, 300), style || 'minimalist');
        const encoded = encodeURIComponent(fullPrompt);

        // 4 ta random seed generatsiya qilish
        const seeds: number[] = Array.from(
            { length: Math.min(count, 6) },
            () => Math.floor(Math.random() * 99999)
        );

        // Hamma variantlarni parallel yuklash
        const results = await Promise.allSettled(
            seeds.map(async (seed, idx) => {
                const url = `${POLLINATIONS_BASE}/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;

                const response = await fetch(url, {
                    signal: AbortSignal.timeout(30_000), // 30 soniya timeout
                    headers: {
                        'User-Agent': 'Pack24-AI-Design/1.0',
                    },
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
            .filter((r): r is PromiseFulfilledResult<{ index: number; seed: number; dataUrl: string; width: number; height: number }> => r.status === 'fulfilled')
            .map(r => r.value);

        if (images.length === 0) {
            return NextResponse.json({ error: 'Rasmlar yuklanmadi. Qayta urining.' }, { status: 503 });
        }

        return NextResponse.json({ images, total: seeds.length, loaded: images.length });
    } catch (error) {
        console.error('[AI Design API]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// Styles list uchun GET
export async function GET() {
    return NextResponse.json({
        styles: Object.keys(STYLE_SUFFIXES).map(id => ({ id })),
        maxPromptLength: 300,
        maxVariants: 6,
    });
}
