/**
 * GET /api/eco/leaderboard — Global reyting (Litterati uslubida)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const period = req.nextUrl.searchParams.get('period') || 'month';
        const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 100);
        const currentUserId = parseInt(req.nextUrl.searchParams.get('userId') || '0');

        const users = await prisma.user.findMany({
            where: { totalRecycledWeight: { gt: 0 } },
            orderBy: { totalRecycledWeight: 'desc' },
            take: limit,
            select: {
                id: true,
                name: true,
                ecoLevel: true,
                ecoPoints: true,
                totalRecycledWeight: true,
                totalCO2Saved: true,
                treesEquivalent: true,
                ecoStreak: true,
                achievements: { select: { badgeKey: true } },
            },
        });

        const leaderboard = users.map((u, idx) => ({
            rank: idx + 1,
            id: u.id,
            name: u.name.length > 2
                ? u.name[0] + '***' + u.name[u.name.length - 1]
                : u.name,
            ecoLevel: u.ecoLevel,
            ecoPoints: u.ecoPoints,
            totalKg: Math.round(u.totalRecycledWeight),
            co2Saved: u.totalCO2Saved,
            trees: u.treesEquivalent,
            streak: u.ecoStreak,
            badgeCount: u.achievements.length,
            isCurrentUser: u.id === currentUserId,
        }));

        // Joriy foydalanuvchining o'rni (top da bo'lmasa)
        let currentUserRank: number | null = null;
        if (currentUserId && !leaderboard.find(u => u.isCurrentUser)) {
            const me = await prisma.user.findUnique({
                where: { id: currentUserId },
                select: { totalRecycledWeight: true },
            });
            if (me) {
                const betterCount = await prisma.user.count({
                    where: { totalRecycledWeight: { gt: me.totalRecycledWeight } },
                });
                currentUserRank = betterCount + 1;
            }
        }

        const total = await prisma.user.count({ where: { totalRecycledWeight: { gt: 0 } } });

        return NextResponse.json({ leaderboard, period, currentUserRank, total });
    } catch (error) {
        console.error('[leaderboard]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
