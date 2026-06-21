/**
 * POST /api/user/eco-progress
 * RecycleRequest yakunlanganda foydalanuvchining eco profilini yangilash
 * 
 * Body: { userId: number, material: string, kg: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { processEcoProgress } from '@/lib/eco/ecoProgressService';
import { rateLimit, getClientIp, getRateLimitResponse } from '@/lib/rateLimit';

const ecoProgressLimiter = rateLimit({ windowMs: 60_000, max: 10 });
const ecoProgressReadLimiter = rateLimit({ windowMs: 60_000, max: 30 });

const ALLOWED_MATERIALS = ['Makulatura', 'Karton', 'Plastik', 'Shisha', 'Metall'] as const;

export async function POST(req: NextRequest) {
    try {
        // Authentication
        const session = await getServerSession(authOptions);
        const sessionUserId = Number(session?.user?.id);
        if (!Number.isFinite(sessionUserId)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Rate limiting
        const ip = getClientIp(req);
        const rl = ecoProgressLimiter.check(`eco-progress:${ip}`);
        if (!rl.allowed) return getRateLimitResponse(rl.retryAfterMs);

        const { userId, material, kg } = await req.json();

        if (!userId || !kg || kg <= 0) {
            return NextResponse.json({ error: 'userId va kg talab qilinadi' }, { status: 400 });
        }

        // Ensure authenticated user can only update their own progress
        if (Number(userId) !== sessionUserId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Validate material against allowed list
        const validMaterial = ALLOWED_MATERIALS.includes(material) ? material : 'Makulatura';

        // Cap kg to max 10000
        const validKg = Math.min(Number(kg), 10000);

        const result = await processEcoProgress(userId, validMaterial, validKg);
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
        // Rate limiting
        const ip = getClientIp(req);
        const rl = ecoProgressReadLimiter.check(`eco-progress-read:${ip}`);
        if (!rl.allowed) return getRateLimitResponse(rl.retryAfterMs);

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
