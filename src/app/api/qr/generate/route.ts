import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        // ── Auth: session or mobile token ────────────────────────────────
        const session = await getServerSession(authOptions);
        let sessionUserId = Number(session?.user?.id);
        let isAdmin = session?.user?.role === 'admin';

        if (!Number.isFinite(sessionUserId)) {
            try {
                const { verifyMobileToken } = await import('@/lib/auth/verifyMobileToken');
                const authHeader = req.headers.get('authorization');
                const result = await verifyMobileToken(authHeader);
                if (result.ok) {
                    sessionUserId = result.userId;
                    isAdmin = result.user.role === 'admin';
                }
            } catch { /* noop */ }
        }

        if (!Number.isFinite(sessionUserId)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ── Parse body ──────────────────────────────────────────────────
        const body = await req.json();
        const { orderId, itemIndex } = body as { orderId?: number; itemIndex?: number };

        if (!orderId || itemIndex === undefined || itemIndex === null) {
            return NextResponse.json(
                { error: 'orderId and itemIndex are required' },
                { status: 400 }
            );
        }

        if (!Number.isFinite(orderId) || orderId <= 0) {
            return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
        }

        if (!Number.isFinite(itemIndex) || itemIndex < 0) {
            return NextResponse.json({ error: 'Invalid itemIndex' }, { status: 400 });
        }

        // ── Fetch order ─────────────────────────────────────────────────
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                userId: true,
                contactPhone: true,
                items: { select: { id: true } },
            },
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Check access
        if (!isAdmin) {
            const ownsOrder =
                order.userId === sessionUserId ||
                (session?.user?.phone && order.contactPhone === session.user.phone);
            if (!ownsOrder) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Validate itemIndex
        if (itemIndex >= order.items.length) {
            return NextResponse.json({ error: 'Item index out of range' }, { status: 400 });
        }

        const code = `P24-${orderId}-${itemIndex}`;
        const qrUrl = `https://pack24.uz/qr/${code}`;

        return NextResponse.json({ code, qrUrl });
    } catch (error) {
        console.error('POST /api/qr/generate error:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
