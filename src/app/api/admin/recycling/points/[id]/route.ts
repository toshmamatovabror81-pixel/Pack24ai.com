import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const point = await prisma.recyclePoint.update({
            where: { id: Number(id) },
            data: {
                regionUz: body.regionUz,
                regionRu: body.regionRu,
                cityUz: body.cityUz,
                cityRu: body.cityRu,
                phone: body.phone,
                address: body.address ?? undefined,
                lat: body.lat !== undefined ? (body.lat ? Number(body.lat) : null) : undefined,
                lng: body.lng !== undefined ? (body.lng ? Number(body.lng) : null) : undefined,
                status: body.status,
                color: body.color,
            }
        });
        return NextResponse.json(point);
    } catch (_error) {
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.recyclePoint.delete({
            where: { id: Number(id) }
        });
        return NextResponse.json({ success: true });
    } catch (_error) {
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
