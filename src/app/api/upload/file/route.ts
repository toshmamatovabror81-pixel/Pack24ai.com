import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { uploadBufferToSupabase } from '@/lib/supabase-storage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ADMIN_AUTH_COOKIE, ADMIN_AUTH_HEADER, validateAdminToken } from '@/lib/adminAuthShared';

async function isAuthorized(request: NextRequest): Promise<boolean> {
    // 1) NextAuth session (foydalanuvchi yoki admin)
    const session = await getServerSession(authOptions);
    if (session?.user?.id) return true;

    // 2) Admin HMAC token (cookie yoki header)
    const adminSecret = process.env.ADMIN_SECRET;
    if (adminSecret) {
        const cookie = request.cookies.get(ADMIN_AUTH_COOKIE)?.value;
        if (cookie) {
            const v = await validateAdminToken(cookie, adminSecret);
            if (v.valid) return true;
        }
        const header = request.headers.get(ADMIN_AUTH_HEADER);
        if (header) {
            const v = await validateAdminToken(header, adminSecret);
            if (v.valid) return true;
        }
    }

    return false;
}

/** Allowed MIME types for file upload */
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
]);

/**
 * POST /api/upload/file
 * multipart/form-data: field "file"
 * Qaytaradi: { success: true, url: "https://..." }
 */
export async function POST(request: NextRequest) {
    if (!(await isAuthorized(request))) {
        return NextResponse.json({ error: 'Avtorizatsiya talab etiladi' }, { status: 401 });
    }

    try {
        const data = await request.formData();
        const file = data.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'Fayl yuklanmadi' }, { status: 400 });
        }

        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return NextResponse.json(
                { error: `Ruxsat etilmagan fayl turi: ${file.type}` },
                { status: 415 }
            );
        }

        const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: `Fayl hajmi oshib ketdi (max ${maxSize / 1024 / 1024} MB)` },
                { status: 413 }
            );
        }

        const extension = path.extname(file.name) || (file.type.startsWith('video/') ? '.mp4' : '.jpg');
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
