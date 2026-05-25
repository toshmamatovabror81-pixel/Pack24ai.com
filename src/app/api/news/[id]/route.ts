import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ─── GET /api/news/[id] ───────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const news = await prisma.news.findUnique({ where: { id: Number(id) } });
        if (!news) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });
        return NextResponse.json(news);
    } catch (_error) {
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── PUT /api/news/[id] — yangilash ──────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const { titleUz, titleRu, descUz, descRu, emoji, badge, publishedAt } = body;

        const news = await prisma.news.update({
            where: { id: Number(id) },
            data: {
                ...(titleUz   !== undefined && { titleUz }),
                ...(titleRu   !== undefined && { titleRu }),
                ...(descUz    !== undefined && { descUz }),
                ...(descRu    !== undefined && { descRu }),
                ...(emoji     !== undefined && { emoji }),
                ...(badge     !== undefined && { badge }),
                ...(publishedAt !== undefined && { publishedAt: new Date(publishedAt) }),
            },
        });
        return NextResponse.json(news);
    } catch (_error) {
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── DELETE /api/news/[id] — o'chirish ────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        await prisma.news.delete({ where: { id: Number(id) } });
        return NextResponse.json({ success: true });
    } catch (_error) {
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
