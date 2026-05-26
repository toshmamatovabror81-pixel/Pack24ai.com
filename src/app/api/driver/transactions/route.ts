/**
 * GET/POST /api/driver/transactions
 * Authorization: Bearer <driver-token>
 *
 * Tranzaksiyalar ro'yxati va withdrawal yaratish.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDriver } from '@/lib/auth/guards';
import { toDecimal, toNumber } from '@/lib/money';

export async function GET(req: NextRequest) {
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;
    const auth = { driverId: guard.driverId };

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
        toNumber(grouped.find(g => g.type === type && g.status === status)?._sum.amount);

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
    const guard = await requireDriver(req);
    if (!guard.ok) return guard.response;
    const auth = { driverId: guard.driverId };

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
                toNumber(earningsAgg._sum.amount) -
                toNumber(withdrawnAgg._sum.amount) -
                toNumber(pendingAgg._sum.amount);

            if (amount > balance) throw new Error('INSUFFICIENT_BALANCE');

            // Atomik withdrawal yaratish
            return await db.driverTransaction.create({
                data: {
                    driverId: auth.driverId,
                    type: 'withdrawal',
                    amount: toDecimal(amount),
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
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'CARD_NOT_FOUND') return NextResponse.json({ error: 'Karta topilmadi' }, { status: 400 });
        if (msg === 'INSUFFICIENT_BALANCE') return NextResponse.json({ error: 'Balans yetarli emas' }, { status: 400 });
        console.error('[transactions POST]', err);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
