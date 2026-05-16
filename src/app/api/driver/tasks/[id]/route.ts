import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const taskId = parseInt(params.id, 10);
        if (isNaN(taskId)) return NextResponse.json({ error: 'Noto\'g\'ri ID' }, { status: 400 });

        const task = await prisma.recycleRequest.findUnique({
            where: { id: taskId },
            include: {
                point: true,
                customer: { select: { id: true, name: true, phone: true } },
            }
        });

        if (!task) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

        return NextResponse.json(task);
    } catch (error: any) {
        return NextResponse.json({ error: 'Server xatosi', detail: error.message }, { status: 500 });
    }
}
