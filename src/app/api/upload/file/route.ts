import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { uploadBufferToSupabase } from '@/lib/supabase-storage';
import { requireAdminOrUser } from '@/lib/auth/guards';

// P0.4 audit: SVG va boshqa xavfli MIME tiplarni rad etish
const ALLOWED_IMAGE_MIMES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
]);

const ALLOWED_VIDEO_MIMES = new Set([
    'video/mp4',
    'video/webm',
    'video/quicktime',
]);

const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif',
    '.mp4', '.webm', '.mov',
]);

/**
 * POST /api/upload/file
 * multipart/form-data: field "file"
 * Qaytaradi: { success: true, url: "https://..." }
 *
 * Xavfsizlik:
 *  - MIME allowlist: faqat oddiy rasm va video
 *  - SVG va shunga o'xshash skript ishga tushiruvchi tiplar rad etiladi (XSS)
 *  - Extension whitelist
 */
export async function POST(request: NextRequest) {
    const auth = await requireAdminOrUser(request);
    if (!auth.ok) return auth.response;

    try {
        const data = await request.formData();
        const file = data.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'Fayl yuklanmadi' }, { status: 400 });
        }

        const mime = (file.type || '').toLowerCase().split(';')[0].trim();
        const isImage = ALLOWED_IMAGE_MIMES.has(mime);
        const isVideo = ALLOWED_VIDEO_MIMES.has(mime);

        if (!isImage && !isVideo) {
            return NextResponse.json(
                {
                    error: 'Bu fayl turi qo\'llab-quvvatlanmaydi',
                    detail: `MIME=${mime || 'unknown'}. Ruxsat: JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV. SVG yuklash rad etiladi.`,
                },
                { status: 415 }
            );
        }

        const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: `Fayl hajmi oshib ketdi (max ${maxSize / 1024 / 1024} MB)` },
                { status: 413 }
            );
        }

        const rawExt = path.extname(file.name || '').toLowerCase();
        const extension = ALLOWED_EXTENSIONS.has(rawExt)
            ? rawExt
            : (isVideo ? '.mp4' : '.jpg');
        const filename = `${uuidv4()}${extension}`;

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const publicUrl = await uploadBufferToSupabase(buffer, filename, file.type || 'application/octet-stream');

        return NextResponse.json({ success: true, url: publicUrl });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server xatosi';
        console.error('[upload/file]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
