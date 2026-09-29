import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { toNumber } from '@/lib/money';

// ─── Payme (PayCom) to'lov integratsiyasi ───────────────────────────────────
// Hujjatlar: https://developer.paycom.uz/

const PAYME_MERCHANT_ID  = process.env.PAYME_MERCHANT_ID  ?? '';
const _PAYME_SECRET_KEY   = process.env.PAYME_SECRET_KEY   ?? '';
const _PAYME_TEST_SECRET  = process.env.PAYME_TEST_SECRET  ?? '';
const IS_TEST = process.env.NODE_ENV !== 'production';

const PAYME_URL = IS_TEST
    ? 'https://checkout.test.paycom.uz'
    : 'https://checkout.paycom.uz';

// ─── POST /api/payment/payme — Payme checkout URL yaratish ─────────────────
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Auth kerak' }, { status: 401 });
        }

        const body = await req.json();
        const { orderId } = body;

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

        // Summa faqat bazadan olinadi. Payme summani tiyinda kutadi (100x so'm)
        const amount = toNumber(order.totalAmount);
        const amountInTiyin = Math.round(amount * 100);

        // Payme GET checkout formati: base64("m=...;ac.order_id=...;a=...;l=uz")
        const params = Buffer.from(
            `m=${PAYME_MERCHANT_ID};ac.order_id=${order.id};a=${amountInTiyin};l=uz`
        ).toString('base64');

        const payUrl = `${PAYME_URL}/${params}`;

        return NextResponse.json({
            payUrl,
            orderId: order.id,
            amount,
            amountInTiyin,
        });
    } catch (error) {
        logger.error('[API/payment/payme]', {}, error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── POST /api/payment/payme/webhook — Payme server-to-server callback ──────
// Bu endpoint Payme serveridan kelgan to'lov tasdiqlash/bekor qilish so'rovlarini qabul qiladi
// Haqiqiy loyihada bu alohida route bo'lishi kerak: /api/payment/payme/webhook
export async function GET() {
    return NextResponse.json({ status: 'Payme payment endpoint active' });
}
