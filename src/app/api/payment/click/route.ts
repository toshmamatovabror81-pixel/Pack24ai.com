import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/money';
import { logger } from '@/lib/logger';
import { createHash, timingSafeEqual } from 'crypto';

// ─── Click Uzbekistan to'lov integratsiyasi ─────────────────────────────────
// Hujjatlar: https://docs.click.uz/

// Sozlamalar so'rov vaqtida o'qiladi: bo'sh kalit bilan imzo soxtalashtirilmasin
function clickConfig() {
    return {
        serviceId:  process.env.CLICK_SERVICE_ID  ?? '',
        merchantId: process.env.CLICK_MERCHANT_ID ?? '',
        secretKey:  process.env.CLICK_SECRET_KEY  ?? '',
    };
}

/** Click MD5 imzosi */
function clickSign(parts: string[]): string {
    return createHash('md5').update(parts.join('')).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// ─── POST /api/payment/click — to'lov URL yaratish ───────────────────────────
export async function POST(req: NextRequest) {
    // Click Shop API PREPARE/COMPLETE so'rovlarini form-urlencoded POST qilib yuboradi
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
        const form = new URLSearchParams(await req.text());
        return handleClickCallback(form);
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Auth kerak' }, { status: 401 });
        }

        const body = await req.json();
        const { orderId, returnUrl } = body;

        if (!orderId) {
            return NextResponse.json({ error: 'orderId majburiy' }, { status: 400 });
        }

        // Buyurtma egasini tekshirish
        const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } });
        if (!order || order.userId !== parseInt(session.user.id)) {
            return NextResponse.json({ error: 'Buyurtma topilmadi yoki ruxsat yo\'q' }, { status: 403 });
        }
        if (order.paymentStatus === 'paid') {
            return NextResponse.json({ error: 'Buyurtma allaqachon to\'langan' }, { status: 409 });
        }

        // Summa faqat bazadan olinadi (mijoz yuborgan summaga ishonilmaydi).
        // Click pay sahifasi summani so'mda qabul qiladi.
        const amount = toNumber(order.totalAmount);
        const { serviceId, merchantId } = clickConfig();

        const params = new URLSearchParams({
            service_id:        serviceId,
            merchant_id:       merchantId,
            amount:            amount.toFixed(2),
            transaction_param: String(order.id),
            return_url:        returnUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
        });

        const clickPayUrl = `https://my.click.uz/services/pay?${params.toString()}`;

        return NextResponse.json({ payUrl: clickPayUrl, orderId: order.id, amount });
    } catch (error) {
        logger.error('[API/payment/click POST]', {}, error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── GET /api/payment/click — Click PREPARE & COMPLETE webhook ───────────────
// Click bu endpointga PREPARE (action=0) va COMPLETE (action=1) so'rovlar yuboradi
export async function GET(req: NextRequest) {
    return handleClickCallback(new URL(req.url).searchParams);
}

async function handleClickCallback(searchParams: URLSearchParams) {
    const { serviceId: expectedServiceId, secretKey } = clickConfig();

    const clickTransId      = searchParams.get('click_trans_id') ?? '';
    const serviceId         = searchParams.get('service_id') ?? '';
    const merchantTransId   = searchParams.get('merchant_trans_id') ?? ''; // orderId
    const merchantPrepareId = searchParams.get('merchant_prepare_id') ?? '';
    const rawAmount         = searchParams.get('amount') ?? '0';
    const amount            = parseFloat(rawAmount);
    const action            = searchParams.get('action') ?? '0'; // '0' = PREPARE, '1' = COMPLETE
    const error             = searchParams.get('error') ?? '0';
    const signTime          = searchParams.get('sign_time') ?? '';
    const signString        = searchParams.get('sign_string') ?? '';

    const orderId = parseInt(merchantTransId);

    // ── Imzoni tekshirish ────────────────────────────────────────────────────
    // COMPLETE imzosiga merchant_prepare_id ham kiradi (Click hujjati)
    const signParts = action === '1'
        ? [clickTransId, serviceId, secretKey, merchantTransId, merchantPrepareId, rawAmount, action, signTime]
        : [clickTransId, serviceId, secretKey, merchantTransId, rawAmount, action, signTime];
    if (
        !secretKey ||
        !expectedServiceId ||
        serviceId !== expectedServiceId ||
        !safeEqual(clickSign(signParts), signString)
    ) {
        return NextResponse.json({
            error: -1,
            error_note: 'SIGN CHECK FAILED',
        });
    }

    if (!Number.isFinite(orderId)) {
        return NextResponse.json({ error: -5, error_note: 'ORDER NOT FOUND' });
    }

    // ── Orderni topish ───────────────────────────────────────────────────────
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
        return NextResponse.json({ error: -5, error_note: 'ORDER NOT FOUND' });
    }

    const amountMatches = Math.abs(toNumber(order.totalAmount) * 100 - amount * 100) <= 1;

    // ── PREPARE (action=0) ───────────────────────────────────────────────────
    if (action === '0') {
        if (order.paymentStatus === 'paid') {
            return NextResponse.json({ error: -4, error_note: 'ALREADY PAID' });
        }
        if (!amountMatches) {
            return NextResponse.json({ error: -2, error_note: 'AMOUNT MISMATCH' });
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
        if (merchantPrepareId !== String(order.id)) {
            return NextResponse.json({ error: -6, error_note: 'TRANSACTION NOT FOUND' });
        }

        // Takroriy callback: holatni qayta o'zgartirmaymiz
        if (order.paymentStatus === 'paid') {
            return NextResponse.json({ error: -4, error_note: 'ALREADY PAID' });
        }

        // Summa tekshirish
        if (!amountMatches) {
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
