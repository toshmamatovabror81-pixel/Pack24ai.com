/**
 * GET /api/eco/leaderboard/city — Shaharlar bo'yicha ekologik reyting
 * Public endpoint — autentifikatsiya talab qilinmaydi
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface CityLeaderboardEntry {
  rank: number;
  cityUz: string;
  cityRu: string;
  regionUz: string;
  regionRu: string;
  totalWeight: number;
  co2Saved: number;
  treesEquivalent: number;
  activeUsers: number;
  requestCount: number;
}

interface TotalStats {
  totalWeight: number;
  co2Saved: number;
  treesEquivalent: number;
  totalActiveCities: number;
  totalActiveUsers: number;
  totalRequests: number;
}

export async function GET() {
  try {
    // 1. Get all active recycle points
    const points = await prisma.recyclePoint.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        cityUz: true,
        cityRu: true,
        regionUz: true,
        regionRu: true,
      },
    });

    if (points.length === 0) {
      return NextResponse.json({
        leaderboard: [],
        totalStats: {
          totalWeight: 0,
          co2Saved: 0,
          treesEquivalent: 0,
          totalActiveCities: 0,
          totalActiveUsers: 0,
          totalRequests: 0,
        },
      });
    }

    // 2. Build a map of pointId -> city key
    const pointCityMap = new Map<number, string>();
    const cityInfoMap = new Map<string, { cityUz: string; cityRu: string; regionUz: string; regionRu: string }>();

    for (const p of points) {
      const key = `${p.cityUz}__${p.regionUz}`;
      pointCityMap.set(p.id, key);
      if (!cityInfoMap.has(key)) {
        cityInfoMap.set(key, {
          cityUz: p.cityUz,
          cityRu: p.cityRu,
          regionUz: p.regionUz,
          regionRu: p.regionRu,
        });
      }
    }

    const pointIds = points.map((p) => p.id);

    // 3. Get all completed RecycleRequests with their collections
    const requests = await prisma.recycleRequest.findMany({
      where: {
        pointId: { in: pointIds },
        status: 'completed',
      },
      select: {
        id: true,
        pointId: true,
        userId: true,
        collections: {
          select: {
            effectiveWeight: true,
          },
        },
      },
    });

    // 4. Aggregate by city
    const cityAggregation = new Map<
      string,
      { totalWeight: number; userIds: Set<number>; requestCount: number }
    >();

    for (const req of requests) {
      const cityKey = pointCityMap.get(req.pointId);
      if (!cityKey) continue;

      if (!cityAggregation.has(cityKey)) {
        cityAggregation.set(cityKey, {
          totalWeight: 0,
          userIds: new Set<number>(),
          requestCount: 0,
        });
      }

      const agg = cityAggregation.get(cityKey)!;
      agg.requestCount += 1;

      if (req.userId) {
        agg.userIds.add(req.userId);
      }

      for (const col of req.collections) {
        agg.totalWeight += col.effectiveWeight;
      }
    }

    // 5. Build leaderboard entries
    const entries: Omit<CityLeaderboardEntry, 'rank'>[] = [];

    for (const [cityKey, agg] of cityAggregation.entries()) {
      const info = cityInfoMap.get(cityKey);
      if (!info) continue;

      const totalWeight = Math.round(agg.totalWeight * 100) / 100;
      entries.push({
        cityUz: info.cityUz,
        cityRu: info.cityRu,
        regionUz: info.regionUz,
        regionRu: info.regionRu,
        totalWeight,
        co2Saved: Math.round(totalWeight * 1.2 * 100) / 100,
        treesEquivalent: Math.floor(totalWeight / 70),
        activeUsers: agg.userIds.size,
        requestCount: agg.requestCount,
      });
    }

    // Also include cities with points but no data yet (weight=0)
    for (const [cityKey, info] of cityInfoMap.entries()) {
      if (!cityAggregation.has(cityKey)) {
        entries.push({
          cityUz: info.cityUz,
          cityRu: info.cityRu,
          regionUz: info.regionUz,
          regionRu: info.regionRu,
          totalWeight: 0,
          co2Saved: 0,
          treesEquivalent: 0,
          activeUsers: 0,
          requestCount: 0,
        });
      }
    }

    // 6. Sort by totalWeight descending and assign ranks
    entries.sort((a, b) => b.totalWeight - a.totalWeight);

    const leaderboard: CityLeaderboardEntry[] = entries.map((entry, idx) => ({
      rank: idx + 1,
      ...entry,
    }));

    // 7. Calculate total stats
    const totalStats: TotalStats = {
      totalWeight: Math.round(entries.reduce((sum, e) => sum + e.totalWeight, 0) * 100) / 100,
      co2Saved: Math.round(entries.reduce((sum, e) => sum + e.co2Saved, 0) * 100) / 100,
      treesEquivalent: entries.reduce((sum, e) => sum + e.treesEquivalent, 0),
      totalActiveCities: entries.filter((e) => e.totalWeight > 0).length,
      totalActiveUsers: new Set(requests.filter((r) => r.userId).map((r) => r.userId!)).size,
      totalRequests: requests.length,
    };

    return NextResponse.json({ leaderboard, totalStats });
  } catch (error) {
    console.error('[eco/leaderboard/city]', error);
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
  }
}
