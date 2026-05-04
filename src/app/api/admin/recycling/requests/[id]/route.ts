import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishPlatformEvent } from '@/lib/platform/events';
import { RequestValidationError, isPlainObject } from '@/lib/requestValidation';

function readNullableInteger(value: unknown, fieldName: string): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new RequestValidationError(`${fieldName} butun son bo'lishi kerak`);
    }
    return value;
}

function readNullableString(value: unknown, fieldName: string): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') {
        throw new RequestValidationError(`${fieldName} matn bo'lishi kerak`);
    }
    return value;
}

function getRequestStatusEventMeta(status: string) {
    switch (status) {
        case 'dispatched':
            return { type: 'recycling.request.dispatched', severity: 'info' as const, title: 'Ariza dispatch qilindi' };
        case 'assigned':
            return { type: 'recycling.driver.assigned', severity: 'info' as const, title: 'Arizaga haydovchi tayinlandi' };
        case 'en_route':
            return { type: 'recycling.driver.en_route', severity: 'info' as const, title: 'Haydovchi yo\'lga chiqdi' };
        case 'arrived':
            return { type: 'recycling.driver.arrived', severity: 'info' as const, title: 'Haydovchi yetib keldi' };
        case 'collected':
            return { type: 'recycling.collection.collected', severity: 'info' as const, title: 'Yig\'ish bajarildi' };
        case 'confirmed':
            return { type: 'recycling.request.confirmed', severity: 'success' as const, title: 'Ariza tasdiqlandi' };
        case 'completed':
            return { type: 'recycling.request.completed', severity: 'success' as const, title: 'Ariza yakunlandi' };
        case 'disputed':
            return { type: 'recycling.request.disputed', severity: 'warning' as const, title: 'Ariza bo\'yicha e\'tiroz tushdi' };
        case 'cancelled':
            return { type: 'recycling.request.cancelled', severity: 'warning' as const, title: 'Ariza bekor qilindi' };
        default:
            return { type: 'recycling.request.status_updated', severity: 'info' as const, title: 'Ariza statusi yangilandi' };
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const requestId = Number(id);
        if (!Number.isInteger(requestId) || requestId <= 0) {
            throw new RequestValidationError('id musbat butun son bo\'lishi kerak');
        }

        const body = await request.json();
        if (!isPlainObject(body)) {
            throw new RequestValidationError('JSON object kutilgan');
        }

        const updateData: Record<string, unknown> = {};
        const status = readNullableString(body.status, 'status');
        const supervisorId = readNullableInteger(body.supervisorId, 'supervisorId');
        const assignedDriverId = readNullableInteger(body.assignedDriverId, 'assignedDriverId');
        const address = readNullableString(body.address, 'address');
        const customerTgId = readNullableString(body.customerTgId, 'customerTgId');
        const completedNote = readNullableString(body.completedNote, 'completedNote');

        // Status yangilash
        if (status) updateData.status = status;

        // Dispatch ma'lumotlari
        if (supervisorId !== undefined) updateData.supervisorId = supervisorId;
        if (assignedDriverId !== undefined) updateData.assignedDriverId = assignedDriverId;
        if (address !== undefined) updateData.address = address;
        if (customerTgId !== undefined) updateData.customerTgId = customerTgId;
        if (completedNote !== undefined) updateData.completedNote = completedNote;

        // Vaqt tamg'alari
        if (status === 'dispatched') updateData.dispatchedAt = new Date();
        if (status === 'assigned') updateData.assignedAt = new Date();
        if (status === 'en_route') updateData.driverEnRouteAt = new Date();
        if (status === 'arrived') updateData.driverArrivedAt = new Date();
        if (status === 'collected') updateData.collectedAt = new Date();
        if (status === 'confirmed') updateData.confirmedAt = new Date();
        if (status === 'completed') updateData.completedAt = new Date();

        const req = await prisma.recycleRequest.update({
            where: { id: requestId },
            data: updateData,
            include: {
                point: true,
                supervisor: true,
                assignedDriver: true,
            },
        });

        if (status) {
            const meta = getRequestStatusEventMeta(status);
            await publishPlatformEvent({
                source: 'platform',
                type: meta.type,
                entityType: 'recycle_request',
                entityId: req.id,
                severity: meta.severity,
                title: meta.title,
                message: `Ariza #${req.id} statusi ${status} ga o'zgartirildi.`,
                requestId: req.id,
                driverId: req.assignedDriverId ?? undefined,
                supervisorId: req.supervisorId ?? undefined,
                pointId: req.regionId,
                payload: {
                    status,
                    completedNote: completedNote ?? null,
                },
                notifyAdmins: false,
            });
        }

        return NextResponse.json(req);
    } catch (error) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('[Request PUT]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.recycleRequest.delete({ where: { id: Number(id) } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Request DELETE]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
