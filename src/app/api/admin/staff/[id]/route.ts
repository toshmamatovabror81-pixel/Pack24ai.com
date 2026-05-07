import { NextRequest, NextResponse } from 'next/server';
import { getStaffById, updateStaff, deleteStaff } from '@/lib/domain/staffService';

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/admin/staff/:id */
export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const staff = await getStaffById(parseInt(id, 10));
        if (!staff) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(staff);
    } catch (err) {
        console.error('[API Staff GET]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** PATCH /api/admin/staff/:id */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await req.json();
        const staff = await updateStaff(parseInt(id, 10), body);
        return NextResponse.json(staff);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Unique constraint')) {
            return NextResponse.json({ error: 'Bu telefon raqam allaqachon mavjud' }, { status: 409 });
        }
        console.error('[API Staff PATCH]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** DELETE /api/admin/staff/:id */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        await deleteStaff(parseInt(id, 10));
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[API Staff DELETE]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
