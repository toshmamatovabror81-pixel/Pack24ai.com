import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Public endpoint — bazalar ro'yxati (frontendda ko'rsatish uchun)
export async function GET() {
    try {
        const points = await prisma.recyclePoint.findMany({
            orderBy: { id: 'asc' },
            select: {
                id: true,
                regionUz: true,
                regionRu: true,
                cityUz: true,
                cityRu: true,
                phone: true,
                address: true,
                lat: true,
                lng: true,
                status: true,
                color: true,
            }
        });
        return NextResponse.json(points);
    } catch (_error) {
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
