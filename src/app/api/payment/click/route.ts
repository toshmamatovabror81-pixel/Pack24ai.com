import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/money';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';

// ─── Click Uzbekistan to'lov integratsiyasi ─────────────────────────────────
// Hujjatlar: https://docs.click.uz/

const CLICK_SERVICE_ID       = process.env.CLICK_SERVICE_ID       ?? '';
const CLICK_MERCHANT_ID      = process.env.CLICK_MERCHANT_ID      ?? '';
const CLICK_SECRET_KEY       = process.env.CLICK_SECRET_KEY       ?? '';
const _CLICK_MERCHANT_USER_ID = process.env.CLICK_MERCHANT_USER_ID ?? '';

/** Click MD5 imzosi */
function clickSign(parts: string[]): string {
    return createHash('md5').update(parts.join('')).digest('hex');
}

// ─── POST /api/payment/click — to'lov URL yaratish ───────────────────────────
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Auth kerak' }, { status: 401 });
        }

        const body = await req.json();
        const { orderId, amount, returnUrl } = body;

        if (!orderId || !amount) {
            return NextResponse.json({ error: 'orderId va amount majburiy' }, { status: 400 });
        }

        // Buyurtma egasini tekshirish
        const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } });
        if (!order || order.userId !== parseInt(session.user.id)) {
            return NextResponse.json({ error: 'Buyurtma topilmadi yoki ruxsat yo\'q' }, { status: 403 });
        }

        // Summani tiyin ga o'tkazish (1 so'm = 100 tiyin)
        const amountInTiyin = Math.round(amount * 100);

        const params = new URLSearchParams({
            service_id:        CLICK_SERVICE_ID,
            merchant_id:       CLICK_MERCHANT_ID,
            amount:            amountInTiyin.toString(),
            transaction_param: orderId.toString(),
            return_url:        returnUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
        });

        const clickPayUrl = `https://my.click.uz/services/pay?${params.toString()}`;

        return NextResponse.json({ payUrl: clickPayUrl, orderId, amount });
    } catch (error) {
        logger.error('[API/payment/click POST]', {}, error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── GET /api/payment/click — Click PREPARE & COMPLETE webhook ───────────────
// Click bu endpointga PREPARE (action=0) va COMPLETE (action=1) so'rovlar yuboradi
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const clickTransId    = searchParams.get('click_trans_id') ?? '';
    const serviceId       = searchParams.get('service_id') ?? '';
    const _clickPaydocId   = searchParams.get('click_paydoc_id') ?? '';
    const merchantTransId = searchParams.get('merchant_trans_id') ?? ''; // orderId
    const rawAmount        = searchParams.get('amount') ?? '0';
    const amount          = parseFloat(rawAmount);
    const action          = searchParams.get('action') ?? '0'; // '0' = PREPARE, '1' = COMPLETE
    const error           = searchParams.get('error') ?? '0';
    const _errorNote       = searchParams.get('error_note') ?? '';
    const signTime        = searchParams.get('sign_time') ?? '';
    const signString      = searchParams.get('sign_string') ?? '';

    const orderId = parseInt(merchantTransId);

    // ── Imzoni tekshirish ────────────────────────────────────────────────────
    const expectedSign = clickSign([
        clickTransId, serviceId, CLICK_SECRET_KEY, merchantTransId,
        rawAmount, action, signTime,
    ]);
    if (expectedSign !== signString) {
        return NextResponse.json({
            error: -1,
            error_note: 'SIGN CHECK FAILED',
        });
    }

    // ── Orderni topish ───────────────────────────────────────────────────────
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
        return NextResponse.json({ error: -5, error_note: 'ORDER NOT FOUND' });
    }

    // ── PREPARE (action=0) ───────────────────────────────────────────────────
    if (action === '0') {
        if (order.paymentStatus === 'paid') {
            return NextResponse.json({ error: -4, error_note: 'ALREADY PAID' });
        }
        return NextResponse.json({
            click_trans_id:    clickTransId,
            merchant_trans_id: merchantTransId,
            merchant_prepare_id: order.id,
            error: 0,
            error_note: 'Success',
        });
    }

    // ── COMPLETE (action=1) ──────────────────────────────────────────────────
    if (action === '1') {
        // Summa tekshirish
        if (Math.abs(toNumber(order.totalAmount) * 100 - amount * 100) > 1) {
            return NextResponse.json({ error: -2, error_note: 'AMOUNT MISMATCH' });
        }

        if (parseInt(error) < 0) {
            // To'lov bekor qilindi
            await prisma.order.update({
                where: { id: orderId },
                data: { paymentStatus: 'failed' },
            });
            return NextResponse.json({
                click_trans_id:    clickTransId,
                merchant_trans_id: merchantTransId,
                merchant_confirm_id: order.id,
                error: 0,
                error_note: 'Success',
            });
        }

        // To'lov muvaffaqiyatli
        await prisma.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: 'paid',
                status: 'processing',
            },
        });

        return NextResponse.json({
            click_trans_id:    clickTransId,
            merchant_trans_id: merchantTransId,
            merchant_confirm_id: order.id,
            error: 0,
            error_note: 'Success',
        });
    }

    return NextResponse.json({ error: -3, error_note: 'ACTION NOT FOUND' });
}
