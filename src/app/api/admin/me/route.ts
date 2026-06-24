import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

/**
 * GET /api/admin/me
 * Admin token validatsiyasi — client-side auth guard uchun.
 * Token HMAC imzosi server-side tekshiriladi.
 */
export async function GET(req: NextRequest) {
    const result = await requireAdmin(req);
    if (!result.ok) return result.response;
    return NextResponse.json({ ok: true });
}
