import { NextResponse } from 'next/server';
import { ADMIN_AUTH_COOKIE } from '@/lib/adminAuthShared';

export async function POST() {
    const res = NextResponse.json({ ok: true });

    res.cookies.set(ADMIN_AUTH_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
    });

    return res;
}
