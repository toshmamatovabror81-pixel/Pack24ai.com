/**
 * POST /api/stories/[id]/view
 *
 * Story'ni ko'rilgan deb belgilash. Auth kerak.
 * StoryView jadvaliga upsert qilinadi (duplikatdan himoya).
 * viewCount ham oshiriladi.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/auth/verifyMobileToken';

export const dynamic = 'force-dynamic';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    // Auth tekshiruvi
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyMobileToken(authHeader);
    if (!authResult.ok) {
        return NextResponse.json(
            { error: authResult.error },
            { status: 401 },
        );
    }

    const { id: idStr } = await params;
    const storyId = parseInt(idStr, 10);

    if (isNaN(storyId)) {
        return NextResponse.json(
            { error: "Story ID raqam bo'lishi kerak" },
            { status: 400 },
        );
    }

    try {
        // Story mavjudligini tekshirish
        const story = await prisma.story.findUnique({
            where: { id: storyId },
            select: { id: true, expiresAt: true, userId: true },
        });

        if (!story) {
            return NextResponse.json(
                { error: 'Story topilmadi' },
                { status: 404 },
            );
        }

        // Muddati o'tganligini tekshirish
        if (new Date() > story.expiresAt) {
            return NextResponse.json(
                { error: 'Story muddati tugagan' },
                { status: 410 },
            );
        }

        // O'z story'sini ko'rsa, viewCount oshirmaymiz
        if (story.userId === authResult.userId) {
            return NextResponse.json({ ok: true, selfView: true });
        }

        // Upsert — duplikatdan himoya, va viewCount oshirish
        // Transaction ichida bajaramiz
        await prisma.$transaction([
            prisma.storyView.upsert({
                where: {
                    storyId_viewerId: {
                        storyId,
                        viewerId: authResult.userId,
                    },
                },
                create: {
                    storyId,
                    viewerId: authResult.userId,
                },
                update: {
                    viewedAt: new Date(),
                },
            }),
            prisma.story.update({
                where: { id: storyId },
                data: { viewCount: { increment: 1 } },
            }),
        ]);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Story View POST]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
