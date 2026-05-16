/**
 * GET /api/driver/transactions — Tranzaksiyalar ro'yxati
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const TOKEN_SECRET = process.env.ADMIN_SECRET || 'pack24-driver-secret';

function parseToken(authHeader: string | null): { driverId: number } | null {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const parts = authHeader.slice(7).split('.');
    if (parts.length !== 2) return null;
    try {
        const payload = JSON.parse(Buffer.from(parts[0], 'base64').toString());
        const hmac = crypto.createHmac('sha256', TOKEN_SECRET)
            .update(JSON.stringify({ driverId: payload.driverId, identifier: payload.identifier, role: payload.role, ts: payload.ts }))
            .digest('hex');
        return parts[1] === hmac ? { driverId: payload.driverId } : null;
    } catch { return null; }
}

export async function GET(req: NextRequest) {
    const auth = parseToken(req.headers.get('authorization'));
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1 ta query bilan barcha aggregatlarni olish (N+1 optimizatsiya)
    const [transactions, grouped] = await Promise.all([
        prisma.driverTransaction.findMany({
            where: { driverId: auth.driverId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { card: { select: { cardType: true, cardNumber: true } } },
        }),
        prisma.driverTransaction.groupBy({
            by: ['type', 'status'],
            where: { driverId: auth.driverId },
            _sum: { amount: true },
        }),
    ]);

    // Aggregatlarni map'dan olish
    const get = (type: string, status: string) =>
        grouped.find(g => g.type === type && g.status === status)?._sum.amount || 0;

    const totalEarnings = get('earning', 'completed');
    const totalWithdrawals = get('withdrawal', 'completed');
    const pendingWithdrawals = get('withdrawal', 'pending');
    const balance = totalEarnings - totalWithdrawals - pendingWithdrawals;

    return NextResponse.json({
        balance,
        totalEarnings,
        totalWithdrawals,
        pendingWithdrawals,
        transactions,
    });
}

export async function POST(req: NextRequest) {
    const auth = parseToken(req.headers.get('authorization'));
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { amount, cardId } = body;

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Noto\'g\'ri summa' }, { status: 400 });
    if (!cardId) return NextResponse.json({ error: 'Karta tanlanmagan' }, { status: 400 });

    try {
        const tx = await prisma.$transaction(async (db) => {
            // Kartani tekshirish
            const card = await db.driverCard.findFirst({
                where: { id: cardId, driverId: auth.driverId, isActive: true },
            });
            if (!card) throw new Error('CARD_NOT_FOUND');

            // Balansni atomik hisoblash (transaction ichida — race condition yo'q)
            const [earningsAgg, withdrawnAgg, pendingAgg] = await Promise.all([
                db.driverTransaction.aggregate({
                    where: { driverId: auth.driverId, type: 'earning', status: 'completed' },
                    _sum: { amount: true },
                }),
                db.driverTransaction.aggregate({
                    where: { driverId: auth.driverId, type: 'withdrawal', status: 'completed' },
                    _sum: { amount: true },
                }),
                db.driverTransaction.aggregate({
                    where: { driverId: auth.driverId, type: 'withdrawal', status: 'pending' },
                    _sum: { amount: true },
                }),
            ]);

            const balance =
                (earningsAgg._sum.amount || 0) -
                (withdrawnAgg._sum.amount || 0) -
                (pendingAgg._sum.amount || 0);

            if (amount > balance) throw new Error('INSUFFICIENT_BALANCE');

            // Atomik withdrawal yaratish
            return await db.driverTransaction.create({
                data: {
                    driverId: auth.driverId,
                    type: 'withdrawal',
                    amount,
                    status: 'pending',
                    cardId,
                    description: `Yechib olish (${card.cardNumber.slice(-4)}) - ${card.cardHolder}`,
                },
            });
        }, {
            isolationLevel: 'Serializable', // Race condition himoyasi
            timeout: 10000,
        });

        return NextResponse.json(tx);
    } catch (err: any) {
        if (err.message === 'CARD_NOT_FOUND') return NextResponse.json({ error: 'Karta topilmadi' }, { status: 400 });
        if (err.message === 'INSUFFICIENT_BALANCE') return NextResponse.json({ error: 'Balans yetarli emas' }, { status: 400 });
        console.error('[transactions POST]', err);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
