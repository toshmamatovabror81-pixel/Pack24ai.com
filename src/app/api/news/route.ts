import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/guards';

// ─── GET /api/news — yangiliklar ro'yxati ─────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') ?? '10');
        const page  = parseInt(searchParams.get('page') ?? '1');
        const skip  = (page - 1) * limit;

        const [news, total] = await prisma.$transaction([
            prisma.news.findMany({
                orderBy: { publishedAt: 'desc' },
                take: limit,
                skip,
            }),
            prisma.news.count(),
        ]);

        return NextResponse.json({ news, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('[API/news GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── POST /api/news — yangilik qo'shish (admin) ───────────────────────────────
export async function POST(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (!admin.ok) return admin.response;

    try {
        const body = await req.json();
        const { titleUz, titleRu, descUz, descRu, emoji, badge, publishedAt } = body;

        if (!titleRu) {
            return NextResponse.json({ error: 'titleRu majburiy' }, { status: 400 });
        }

        const news = await prisma.news.create({
            data: {
                titleUz: titleUz || titleRu,
                titleRu,
                descUz: descUz || descRu || '',
                descRu: descRu || '',
                emoji: emoji || '📰',
                badge: badge || 'Yangilik',
                publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
            },
        });

        return NextResponse.json(news, { status: 201 });
    } catch (error) {
        console.error('[API/news POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
