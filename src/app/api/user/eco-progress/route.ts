/**
 * POST /api/user/eco-progress
 * RecycleRequest yakunlanganda foydalanuvchining eco profilini yangilash
 * 
 * Body: { userId: number, material: string, kg: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processEcoProgress } from '@/lib/eco/ecoProgressService';

export async function POST(req: NextRequest) {
    try {
        const { userId, material, kg } = await req.json();

        if (!userId || !kg || kg <= 0) {
            return NextResponse.json({ error: 'userId va kg talab qilinadi' }, { status: 400 });
        }

        const result = await processEcoProgress(userId, material, kg);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[eco-progress] Error:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

/**
 * GET /api/user/eco-progress?userId=X
 * Foydalanuvchining to'liq eco profilini olish
 */
export async function GET(req: NextRequest) {
    try {
        const userId = parseInt(req.nextUrl.searchParams.get('userId') || '0');
        if (!userId) return NextResponse.json({ error: 'userId talab qilinadi' }, { status: 400 });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                ecoPoints: true,
                ecoLevel: true,
                totalRecycledWeight: true,
                totalCO2Saved: true,
                treesEquivalent: true,
                ecoStreak: true,
                lastEcoActivity: true,
                achievements: {
                    orderBy: { earnedAt: 'desc' },
                    select: { badgeKey: true, earnedAt: true },
                },
            },
        });

        if (!user) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

        return NextResponse.json(user);
    } catch (_error) {
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
