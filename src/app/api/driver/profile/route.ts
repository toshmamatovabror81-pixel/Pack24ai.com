/**
 * GET/PUT /api/driver/profile
 *
 * Haydovchi o'z profilini ko'rish va yangilash.
 * `requireDriver` guard orqali Bearer token tekshiriladi.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/auth/guards';

export async function GET(req: NextRequest) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;

    const driver = await prisma.driver.findUnique({
        where: { id: guard.driverId },
        select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            isOnline: true,
            vehicleInfo: true,
            registrationCode: true,
            registeredAt: true,
            lastSeenAt: true,
            lastLat: true,
            lastLng: true,
            createdAt: true,
            supervisor: { select: { id: true, name: true, phone: true } },
            point: { select: { id: true, regionUz: true, cityUz: true } },
            _count: { select: { collections: true, assignedRequests: true } },
        },
    });

    if (!driver) {
        return NextResponse.json({ error: 'Haydovchi topilmadi' }, { status: 404 });
    }

    return NextResponse.json(driver);
}

export async function PUT(req: NextRequest) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;

    try {
        const body = await req.json();
        const updateData: any = {};

        if (body.name?.trim()) updateData.name = body.name.trim();
        if (body.vehicleInfo !== undefined) updateData.vehicleInfo = body.vehicleInfo?.trim() || null;
        if (body.isOnline !== undefined) updateData.isOnline = !!body.isOnline;
        if (body.lastLat !== undefined) updateData.lastLat = body.lastLat;
        if (body.lastLng !== undefined) updateData.lastLng = body.lastLng;
        if (body.isOnline !== undefined || body.lastLat !== undefined) {
            updateData.lastSeenAt = new Date();
        }

        const driver = await prisma.driver.update({
            where: { id: guard.driverId },
            data: updateData,
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                status: true,
                isOnline: true,
                vehicleInfo: true,
                lastSeenAt: true,
                supervisor: { select: { id: true, name: true, phone: true } },
                point: { select: { id: true, regionUz: true, cityUz: true } },
            },
        });

        return NextResponse.json(driver);
    } catch (error) {
        console.error('[Driver Profile PUT]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
