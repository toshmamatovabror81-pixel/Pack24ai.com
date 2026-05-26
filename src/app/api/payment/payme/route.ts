import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

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
        const { orderId, amount } = body;

        if (!orderId || !amount) {
            return NextResponse.json({ error: 'orderId va amount majburiy' }, { status: 400 });
        }

        // Buyurtma egasini tekshirish
        const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } });
        if (!order || order.userId !== parseInt(session.user.id)) {
            return NextResponse.json({ error: 'Buyurtma topilmadi yoki ruxsat yo\'q' }, { status: 403 });
        }

        // Payme amount tiyin (100x so'm)
        const amountInTiyin = Math.round(amount * 100);

        // Base64 encode: merchant_id + params
        const params = btoa(JSON.stringify({
            m:  PAYME_MERCHANT_ID,
            ac: { order_id: orderId.toString() },
            a:  amountInTiyin,
            l:  'uz',          // til: uz | ru | en
            ct: 7200,          // seconds to pay (2 hours)
            cr: 'UZS',
        }));

        const payUrl = `${PAYME_URL}/${params}`;

        return NextResponse.json({
            payUrl,
            orderId,
            amount,
            amountInTiyin,
        });
    } catch (error) {
        logger.error({ error }, '[API/payment/payme]');
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── POST /api/payment/payme/webhook — Payme server-to-server callback ──────
// Bu endpoint Payme serveridan kelgan to'lov tasdiqlash/bekor qilish so'rovlarini qabul qiladi
// Haqiqiy loyihada bu alohida route bo'lishi kerak: /api/payment/payme/webhook
export async function GET() {
    return NextResponse.json({ status: 'Payme payment endpoint active' });
}
