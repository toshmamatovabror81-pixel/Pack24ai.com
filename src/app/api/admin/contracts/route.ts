import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeMoney, toDecimal, toNumber } from '@/lib/money';

// ─── GET /api/admin/contracts — Barcha shartnomalar ──────────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        const where: Record<string, unknown> = {};
        if (status && status !== 'all') where.status = status;
        if (search) {
            where.OR = [
                { companyName: { contains: search, mode: 'insensitive' } },
                { contractNo: { contains: search, mode: 'insensitive' } },
                { inn: { contains: search } },
            ];
        }

        const contracts = await prisma.contract.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, phone: true, customerType: true } },
                _count: { select: { invoices: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Har bir shartnoma uchun qarz qoldig'ini hisoblash
        const enriched = await Promise.all(contracts.map(async (c) => {
            const invoiceAgg = await prisma.corporateInvoice.aggregate({
                where: { contractId: c.id, status: { not: 'cancelled' } },
                _sum: { totalAmount: true, paidAmount: true },
            });

            const totalInvoiced = toNumber(invoiceAgg._sum.totalAmount);
            const totalPaid = toNumber(invoiceAgg._sum.paidAmount);
            const outstandingDebt = totalInvoiced - totalPaid;
            const creditLimit = toNumber(c.creditLimit);

            return serializeMoney({
                ...c,
                totalInvoiced: Math.round(totalInvoiced),
                totalPaid: Math.round(totalPaid),
                outstandingDebt: Math.round(outstandingDebt),
                creditUsagePercent: creditLimit > 0
                    ? Math.round((outstandingDebt / creditLimit) * 100)
                    : 0,
            });
        }));

        return NextResponse.json(enriched);
    } catch (error) {
        console.error('[Contracts GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── POST /api/admin/contracts — Yangi shartnoma yaratish ────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            userId, companyName, inn, mfo, bankAccount, bankName,
            directorName, creditLimit, paymentTermDays, notes,
        } = body;

        if (!userId || !companyName) {
            return NextResponse.json(
                { error: 'userId va companyName majburiy' },
                { status: 400 },
            );
        }

        // Shartnoma raqamini generatsiya qilish: SH-2026-001
        const year = new Date().getFullYear();
        const lastContract = await prisma.contract.findFirst({
            where: { contractNo: { startsWith: `SH-${year}` } },
            orderBy: { contractNo: 'desc' },
        });

        let nextNum = 1;
        if (lastContract) {
            const parts = lastContract.contractNo.split('-');
            nextNum = parseInt(parts[2] || '0') + 1;
        }
        const contractNo = `SH-${year}-${String(nextNum).padStart(3, '0')}`;

        // Mijozni korporativ qilish
        await prisma.user.update({
            where: { id: Number(userId) },
            data: {
                customerType: 'corporate',
                companyName: companyName,
            },
        });

        const contract = await prisma.contract.create({
            data: {
                contractNo,
                userId: Number(userId),
                companyName,
                inn: inn || null,
                mfo: mfo || null,
                bankAccount: bankAccount || null,
                bankName: bankName || null,
                directorName: directorName || null,
                creditLimit: toDecimal(Number(creditLimit) || 0),
                paymentTermDays: Number(paymentTermDays) || 15,
                notes: notes || null,
            },
            include: {
                user: { select: { id: true, name: true, phone: true } },
            },
        });

        return NextResponse.json(serializeMoney(contract), { status: 201 });
    } catch (error) {
        console.error('[Contracts POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
