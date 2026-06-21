import { NextRequest, NextResponse } from 'next/server';
import { getStaff, createStaff, getStaffStats } from '@/lib/domain/staffService';
import type { StaffDepartment } from '@/lib/domain/staffService';
import { USER_ROLES } from '@/lib/domain/userRoles';
import { readOptionalEnum, RequestValidationError } from '@/lib/requestValidation';

/** GET /api/admin/staff — Xodimlar ro'yxati */
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const search = url.searchParams.get('search');
        const department = url.searchParams.get('department') as StaffDepartment | null;
        const role = url.searchParams.get('role');
        const isActive = url.searchParams.get('isActive');
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const withStats = url.searchParams.get('withStats') === 'true';

        const result = await getStaff({
            search: search || undefined,
            department: department || undefined,
            role: role || undefined,
            isActive: isActive !== null ? isActive === 'true' : undefined,
            page,
            limit,
        });

        const stats = withStats ? await getStaffStats() : undefined;

        return NextResponse.json({ ...result, stats });
    } catch (err) {
        console.error('[API Staff GET]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** POST /api/admin/staff — Yangi xodim yaratish */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!body.name?.trim() || !body.phone?.trim()) {
            return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
        }

        const staff = await createStaff({
            name: body.name.trim(),
            phone: body.phone.trim(),
            email: body.email?.trim() || undefined,
            role: readOptionalEnum(body.role, 'role', USER_ROLES) || 'staff',
            department: body.department || undefined,
            position: body.position?.trim() || undefined,
            password: body.password || Math.random().toString(36).slice(2, 10),
        });

        return NextResponse.json(staff, { status: 201 });
    } catch (err: unknown) {
        if (err instanceof RequestValidationError) {
            return NextResponse.json({ error: err.message }, { status: err.status });
        }
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Unique constraint')) {
            return NextResponse.json({ error: 'Bu telefon raqam allaqachon mavjud' }, { status: 409 });
        }
        console.error('[API Staff POST]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
