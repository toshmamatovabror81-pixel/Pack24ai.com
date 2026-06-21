import { NextResponse } from 'next/server';
import { RequestValidationError, isPlainObject, readOptionalEnum } from '@/lib/requestValidation';
import { updateRecycleRequest, deleteRecycleRequest } from '@/lib/domain/recycling/requestService';
import { RECYCLE_REQUEST_STATUSES } from '@/lib/domain/recycleRequestTypes';

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

        const data = {
            status: readOptionalEnum(body.status, 'status', RECYCLE_REQUEST_STATUSES) ?? (body.status === null ? null : undefined),
            supervisorId: readNullableInteger(body.supervisorId, 'supervisorId'),
            assignedDriverId: readNullableInteger(body.assignedDriverId, 'assignedDriverId'),
            address: readNullableString(body.address, 'address'),
            customerTgId: readNullableString(body.customerTgId, 'customerTgId'),
            completedNote: readNullableString(body.completedNote, 'completedNote'),
        };

        const req = await updateRecycleRequest(requestId, data);
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
        await deleteRecycleRequest(Number(id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Request DELETE]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
