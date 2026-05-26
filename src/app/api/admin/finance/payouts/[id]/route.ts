import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: rawId } = await params;
        const id = parseInt(rawId, 10);
        if (isNaN(id)) return NextResponse.json({ error: 'Noto\'g\'ri ID' }, { status: 400 });

        const body = await req.json().catch(() => ({}));
        const { status } = body;

        if (!['completed', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'Noto\'g\'ri status' }, { status: 400 });
        }

        const tx = await prisma.driverTransaction.findUnique({
            where: { id }
        });

        if (!tx || tx.type !== 'withdrawal') {
            return NextResponse.json({ error: 'Ariza topilmadi' }, { status: 404 });
        }

        if (tx.status !== 'pending') {
            return NextResponse.json({ error: 'Faqat kutilayotgan arizalarni o\'zgartirish mumkin' }, { status: 400 });
        }

        const updated = await prisma.driverTransaction.update({
            where: { id },
            data: { status }
        });

        return NextResponse.json(updated);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
