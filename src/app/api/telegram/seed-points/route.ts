import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedTelegramOpsRequest } from '@/lib/telegram/security';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    try {
        const authorized = await isAuthorizedTelegramOpsRequest(request);
        if (!authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const count = await prisma.recyclePoint.count();
        if (count > 0) {
            // Update the first one to be 'active' just in case
            const p = await prisma.recyclePoint.findFirst();
            if (p) {
                await prisma.recyclePoint.update({ where: { id: p.id }, data: { status: 'active' } });
                return NextResponse.json({ ok: true, message: 'Existing point activated' });
            }
        }
        
        await prisma.recyclePoint.create({
            data: {
                regionUz: 'Toshkent',
                regionRu: 'Ташкент',
                cityUz: 'Toshkent sh.',
                cityRu: 'г. Ташкент',
                phone: '+998 71 234-56-78',
                address: 'Qoratosh ko\'chasi, 1A',
                lat: 41.3111,
                lng: 69.2401,
                status: 'active',
                color: 'bg-emerald-500'
            }
        });

        return NextResponse.json({ ok: true, message: 'Seeded initial point' });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
