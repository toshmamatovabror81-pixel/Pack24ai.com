import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DriverStatus } from '@prisma/client';
import { readOptionalEnum, RequestValidationError } from '@/lib/requestValidation';

// PUT /api/admin/recycling/drivers/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        const driver = await prisma.driver.update({
            where: { id: Number(id) },
            data: {
                ...(body.name && { name: body.name.trim() }),
                ...(body.phone && { phone: body.phone.trim() }),
                ...(body.telegramId !== undefined && { telegramId: body.telegramId || null }),
                ...(body.telegramName !== undefined && { telegramName: body.telegramName || null }),
                ...(body.supervisorId !== undefined && { supervisorId: body.supervisorId ? Number(body.supervisorId) : null }),
                ...(body.pointId !== undefined && { pointId: body.pointId ? Number(body.pointId) : null }),
                ...(body.vehicleInfo !== undefined && { vehicleInfo: body.vehicleInfo || null }),
                ...(body.status && { status: readOptionalEnum(body.status, 'status', Object.values(DriverStatus)) }),
                ...(body.isOnline !== undefined && { isOnline: body.isOnline }),
            },
            include: { supervisor: true, point: true },
        });

        return NextResponse.json(driver);
    } catch (error) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('[Driver PUT]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// DELETE /api/admin/recycling/drivers/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.driver.delete({ where: { id: Number(id) } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Driver DELETE]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
