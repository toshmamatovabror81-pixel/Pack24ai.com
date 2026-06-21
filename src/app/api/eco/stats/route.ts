import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp, getRateLimitResponse } from '@/lib/rateLimit';

const ecoStatsLimiter = rateLimit({ windowMs: 60_000, max: 30 });

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    const rl = ecoStatsLimiter.check(`eco-stats:${ip}`);
    if (!rl.allowed) return getRateLimitResponse(rl.retryAfterMs);

    const session = await getServerSession(authOptions);
    const userId = Number(session?.user?.id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        recycleRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const totalWeight = user.totalRecycledWeight || 0;
    const stats = {
      points: user.ecoPoints || 0,
      totalWeight: totalWeight,
      treesSaved: (totalWeight * 0.017).toFixed(1),
      co2Offset: (totalWeight * 2.5).toFixed(1),
      waterSaved: (totalWeight * 26).toFixed(0),
      recentRequests: user.recycleRequests
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Eco stats API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
