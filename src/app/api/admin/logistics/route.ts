import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
    try {
        const authError = await verifyAdminAuth(request);
        if (authError) {
            return authError;
        }

        // Tizimdagi faol, tugallanmagan va xaritada ko'rinishi kerak bo'lgan arizalar.
        const requests = await prisma.recycleRequest.findMany({
            where: {
                status: {
                    in: ["new", "dispatched", "assigned", "en_route", "arrived", "collecting"]
                },
                pickupLat: { not: null },
                pickupLng: { not: null }
            },
            include: {
                assignedDriver: {
                   select: { name: true, phone: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Haydovchilar lokatsiyasi (GPS tracking agar kiritilgan bo'lsa)
        const drivers = await prisma.driver.findMany({
            where: {
                isOnline: true
            },
            select: {
                id: true,
                name: true,
                phone: true,
                status: true,
                lastLat: true,
                lastLng: true,
                lastSeenAt: true,
            }
        });

        return NextResponse.json({
            success: true,
            requests,
            drivers,
        });

    } catch (error) {
        console.error('[logistics] GET xatosi:', error);
         return NextResponse.json(
            { error: "Server xatosi" },
            { status: 500 }
        );
    }
}
