import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ─── GET /api/admin/invoices — Barcha hisob-fakturalar ───────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const contractId = searchParams.get('contractId');
        const period = parseInt(searchParams.get('period') ?? '90');

        const from = new Date();
        from.setDate(from.getDate() - period);

        const where: Record<string, unknown> = {
            createdAt: { gte: from },
        };
        if (status && status !== 'all') where.status = status;
        if (contractId) where.contractId = Number(contractId);

        const invoices = await prisma.corporateInvoice.findMany({
            where,
            include: {
                contract: {
                    select: { contractNo: true, companyName: true, inn: true },
                },
                order: {
                    select: { id: true, status: true, customerName: true, totalAmount: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Statistikalar
        const all = await prisma.corporateInvoice.findMany({
            where: { createdAt: { gte: from } },
            select: { status: true, totalAmount: true, paidAmount: true },
        });

        const stats = {
            total: all.length,
            totalAmount: Math.round(all.reduce((s, i) => s + i.totalAmount, 0)),
            totalPaid: Math.round(all.reduce((s, i) => s + i.paidAmount, 0)),
            issued: all.filter(i => i.status === 'issued').length,
            paid: all.filter(i => i.status === 'paid').length,
            overdue: all.filter(i => i.status === 'overdue').length,
            partial: all.filter(i => i.status === 'partial').length,
        };

        return NextResponse.json({ invoices, stats });
    } catch (error) {
        console.error('[Invoices GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── POST /api/admin/invoices — Yangi faktura yaratish ───────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { contractId, orderId, vatPercent = 12 } = body;

        if (!contractId || !orderId) {
            return NextResponse.json(
                { error: 'contractId va orderId majburiy' },
                { status: 400 },
            );
        }

        // Shartnomani tekshirish
        const contract = await prisma.contract.findUnique({
            where: { id: Number(contractId) },
        });

        if (!contract) {
            return NextResponse.json({ error: 'Shartnoma topilmadi' }, { status: 404 });
        }

        if (contract.status !== 'active') {
            return NextResponse.json({ error: 'Shartnoma faol emas' }, { status: 400 });
        }

        // Buyurtmani tekshirish
        const order = await prisma.order.findUnique({
            where: { id: Number(orderId) },
            select: { id: true, totalAmount: true, status: true },
        });

        if (!order) {
            return NextResponse.json({ error: 'Buyurtma topilmadi' }, { status: 404 });
        }

        // Allaqachon faktura bormi?
        const existing = await prisma.corporateInvoice.findFirst({
            where: { orderId: order.id, status: { not: 'cancelled' } },
        });

        if (existing) {
            return NextResponse.json(
                { error: `Bu buyurtmaga allaqachon faktura yaratilgan: ${existing.invoiceNo}` },
                { status: 400 },
            );
        }

        // Kredit limitni tekshirish
        const outstandingDebt = await prisma.corporateInvoice.aggregate({
            where: {
                contractId: contract.id,
                status: { in: ['issued', 'partial', 'overdue'] },
            },
            _sum: { totalAmount: true, paidAmount: true },
        });

        const currentDebt = (outstandingDebt._sum.totalAmount ?? 0) - (outstandingDebt._sum.paidAmount ?? 0);
        const newDebt = currentDebt + order.totalAmount;

        if (contract.creditLimit > 0 && newDebt > contract.creditLimit) {
            return NextResponse.json({
                error: `Kredit limiti oshib ketadi. Limit: ${contract.creditLimit.toLocaleString()}, Joriy qarz: ${Math.round(currentDebt).toLocaleString()}, Yangi buyurtma: ${order.totalAmount.toLocaleString()}`,
                code: 'CREDIT_LIMIT_EXCEEDED',
            }, { status: 400 });
        }

        // Faktura raqamini generatsiya qilish: INV-2026-0001
        const year = new Date().getFullYear();
        const lastInvoice = await prisma.corporateInvoice.findFirst({
            where: { invoiceNo: { startsWith: `INV-${year}` } },
            orderBy: { invoiceNo: 'desc' },
        });

        let nextNum = 1;
        if (lastInvoice) {
            const parts = lastInvoice.invoiceNo.split('-');
            nextNum = parseInt(parts[2] || '0') + 1;
        }
        const invoiceNo = `INV-${year}-${String(nextNum).padStart(4, '0')}`;

        // QQS hisoblash
        const subtotal = order.totalAmount;
        const vat = Number(vatPercent);
        const vatAmount = Math.round(subtotal * vat / 100);
        const totalAmount = subtotal + vatAmount;

        // To'lov muddati
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + contract.paymentTermDays);

        const invoice = await prisma.corporateInvoice.create({
            data: {
                invoiceNo,
                contractId: contract.id,
                orderId: order.id,
                subtotal,
                vatPercent: vat,
                vatAmount,
                totalAmount,
                dueDate,
            },
            include: {
                contract: { select: { contractNo: true, companyName: true } },
                order: { select: { id: true, status: true } },
            },
        });

        return NextResponse.json(invoice, { status: 201 });
    } catch (error) {
        console.error('[Invoices POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
