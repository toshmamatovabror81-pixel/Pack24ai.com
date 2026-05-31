/**
 * GET  /api/stories       — Foydalanuvchining o'z story'larini olish (auth kerak)
 * POST /api/stories       — Yangi story yaratish (auth kerak)
 * DELETE /api/stories?id=  — Story o'chirish (faqat egasi)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/auth/verifyMobileToken';

export const dynamic = 'force-dynamic';

// 5 MB limit (base64 encoded ≈ 5_242_880 chars)
const MAX_MEDIA_SIZE = 5 * 1024 * 1024;

/**
 * Auth helper — Authorization header'dan userId chiqaradi.
 * Muvaffaqiyatsiz bo'lsa NextResponse qaytaradi.
 */
async function requireMobileUser(req: NextRequest): Promise<
    | { ok: true; userId: number }
    | { ok: false; response: NextResponse }
> {
    const authHeader = req.headers.get('authorization');
    const result = await verifyMobileToken(authHeader);
    if (!result.ok) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: result.error },
                { status: 401 },
            ),
        };
    }
    return { ok: true, userId: result.userId };
}

// ─── GET — o'z story'larini olish ────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const auth = await requireMobileUser(req);
    if (!auth.ok) return auth.response;

    try {
        const stories = await prisma.story.findMany({
            where: { userId: auth.userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                mediaUrl: true,
                mediaType: true,
                caption: true,
                textOverlay: true,
                viewCount: true,
                expiresAt: true,
                createdAt: true,
            },
        });

        return NextResponse.json(stories);
    } catch (error) {
        console.error('[Stories GET]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── POST — yangi story yaratish ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const auth = await requireMobileUser(req);
    if (!auth.ok) return auth.response;

    try {
        const body = await req.json();

        // Validatsiya: mediaUrl majburiy
        if (!body.mediaUrl || typeof body.mediaUrl !== 'string') {
            return NextResponse.json(
                { error: 'mediaUrl majburiy (string)' },
                { status: 400 },
            );
        }

        // Hajm tekshiruvi — 5MB
        if (body.mediaUrl.length > MAX_MEDIA_SIZE) {
            return NextResponse.json(
                { error: `mediaUrl hajmi 5MB dan oshmasligi kerak` },
                { status: 400 },
            );
        }

        // mediaType validatsiyasi
        const allowedMediaTypes = ['image', 'video'];
        const mediaType = body.mediaType ?? 'image';
        if (!allowedMediaTypes.includes(mediaType)) {
            return NextResponse.json(
                { error: "mediaType faqat 'image' yoki 'video' bo'lishi mumkin" },
                { status: 400 },
            );
        }

        // caption — ixtiyoriy, string
        const caption = typeof body.caption === 'string' ? body.caption.trim() || null : null;

        // textOverlay — ixtiyoriy, object
        const textOverlay = body.textOverlay && typeof body.textOverlay === 'object'
            ? body.textOverlay
            : null;

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 soat

        const story = await prisma.story.create({
            data: {
                userId: auth.userId,
                mediaUrl: body.mediaUrl,
                mediaType,
                caption,
                textOverlay,
                expiresAt,
            },
            select: {
                id: true,
                mediaUrl: true,
                mediaType: true,
                caption: true,
                textOverlay: true,
                viewCount: true,
                expiresAt: true,
                createdAt: true,
            },
        });

        return NextResponse.json(story, { status: 201 });
    } catch (error) {
        console.error('[Stories POST]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── DELETE — story o'chirish (faqat egasi) ──────────────────────────────────
export async function DELETE(req: NextRequest) {
    const auth = await requireMobileUser(req);
    if (!auth.ok) return auth.response;

    try {
        const { searchParams } = new URL(req.url);
        const idStr = searchParams.get('id');

        if (!idStr) {
            return NextResponse.json(
                { error: 'id query parametri majburiy' },
                { status: 400 },
            );
        }

        const id = parseInt(idStr, 10);
        if (isNaN(id)) {
            return NextResponse.json(
                { error: "id raqam bo'lishi kerak" },
                { status: 400 },
            );
        }

        // Story'ni topish va egasini tekshirish
        const story = await prisma.story.findUnique({
            where: { id },
            select: { userId: true },
        });

        if (!story) {
            return NextResponse.json(
                { error: 'Story topilmadi' },
                { status: 404 },
            );
        }

        if (story.userId !== auth.userId) {
            return NextResponse.json(
                { error: "Faqat o'z story'ngizni o'chirishingiz mumkin" },
                { status: 403 },
            );
        }

        await prisma.story.delete({ where: { id } });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Stories DELETE]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
