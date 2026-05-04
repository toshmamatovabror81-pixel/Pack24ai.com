import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const status = body.status;

        if (!status || !['new', 'read', 'archived'].includes(status)) {
            return NextResponse.json({ error: 'Noto\'g\'ri status' }, { status: 400 });
        }

        const updated = await prisma.botEvent.update({
            where: { id: Number(id) },
            data: {
                status,
                processedAt: status === 'new' ? null : new Date(),
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('[BotEvents PUT]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
