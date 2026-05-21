import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { v4 as uuidv4 } from 'uuid';
import { uploadBufferToSupabase } from '@/lib/supabase-storage';
import { requireAdminOrUser } from '@/lib/auth/guards';

const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg':  '.jpg',
    'image/png':  '.png',
    'image/webp': '.webp',
    'image/gif':  '.gif',
    'image/avif': '.avif',
};

/**
 * POST /api/upload/url
 * Body: { url: "https://..." }
 * Rasmni URL dan yuklab olib, Supabase Storage ga saqlaydi.
 * Qaytaradi: { success: true, url: "https://supabase.../..." }
 */
export async function POST(req: NextRequest) {
    const auth = await requireAdminOrUser(req);
    if (!auth.ok) return auth.response;

    let url = '';
    try {
        const body = await req.json();
        url = body.url;

        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'URL kiritilmadi' }, { status: 400 });
        }

        // Rasmni olib kelish
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8',
                Referer: 'https://pack24.ru/',
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Rasm yuklab bo'lmadi: ${response.statusText}` },
                { status: 422 }
            );
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.startsWith('image/')) {
            return NextResponse.json(
                { error: 'URL rasm emas' },
                { status: 400 }
            );
        }

        const extension = MIME_TO_EXT[contentType.split(';')[0].trim()] ?? '.jpg';
        const filename = `${uuidv4()}${extension}`;

        const buffer = Buffer.from(await response.arrayBuffer());
        const publicUrl = await uploadBufferToSupabase(buffer, filename, contentType);

        return NextResponse.json({ success: true, url: publicUrl });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server xatosi';
        if (message === 'fetch failed') {
            return NextResponse.json({
                success: true,
                url,
                warning: 'Server tashqi URLni yuklab ololmadi, original URL saqlandi',
            });
        }
        console.error('[upload/url]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
