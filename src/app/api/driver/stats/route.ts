/**
 * GET /api/driver/stats
 * Authorization: Bearer <driver-token>
 *
 * Haydovchi statistikasi: bugun, umumiy, haftalik
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/auth/guards';

export async function GET(req: NextRequest) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;
    const driverId = guard.driverId;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Bugungi yig'ishlar
    const todayCollections = await prisma.recycleCollection.findMany({
        where: {
            driverId,
            createdAt: { gte: todayStart, lt: todayEnd },
        },
        select: { actualWeight: true, totalAmount: true },
    });

    // Umumiy statistika
    const allCollections = await prisma.recycleCollection.findMany({
        where: { driverId },
        select: { actualWeight: true, totalAmount: true, createdAt: true },
    });

    // Haftalik (oxirgi 7 kun kg)
    const weekly: number[] = Array(7).fill(0);
    const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);

    allCollections.forEach(c => {
        const d = new Date(c.createdAt);
        if (d >= weekStart) {
            const dayIdx = Math.floor((d.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
            if (dayIdx >= 0 && dayIdx < 7) weekly[dayIdx] += c.actualWeight;
        }
    });

    // Ish kunlari (unique dates)
    const workDays = new Set(
        allCollections.map(c => new Date(c.createdAt).toDateString())
    ).size;

    return NextResponse.json({
        today: {
            collections: todayCollections.length,
            totalWeight: Math.round(todayCollections.reduce((s, c) => s + c.actualWeight, 0)),
            totalAmount: Math.round(todayCollections.reduce((s, c) => s + c.totalAmount, 0)),
        },
        total: {
            collections: allCollections.length,
            totalWeight: Math.round(allCollections.reduce((s, c) => s + c.actualWeight, 0)),
            workDays,
        },
        weekly: weekly.map(w => Math.round(w)),
    });
}
