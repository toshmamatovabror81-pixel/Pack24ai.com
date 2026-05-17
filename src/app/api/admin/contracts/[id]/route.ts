import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ─── GET /api/admin/contracts/[id] — Shartnoma tafsiloti ─────────────────────
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const contract = await prisma.contract.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: { select: { id: true, name: true, phone: true, email: true, customerType: true, address: true } },
                invoices: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        order: { select: { id: true, status: true, totalAmount: true, createdAt: true } },
                    },
                },
            },
        });

        if (!contract) {
            return NextResponse.json({ error: 'Shartnoma topilmadi' }, { status: 404 });
        }

        // Qarz va kredit hisoblash
        const totalInvoiced = contract.invoices
            .filter(i => i.status !== 'cancelled')
            .reduce((s, i) => s + i.totalAmount, 0);
        const totalPaid = contract.invoices
            .filter(i => i.status !== 'cancelled')
            .reduce((s, i) => s + i.paidAmount, 0);

        const outstandingDebt = Math.round(totalInvoiced - totalPaid);
        const creditUsagePercent = contract.creditLimit > 0
            ? Math.round((outstandingDebt / contract.creditLimit) * 100)
            : 0;

        return NextResponse.json({
            ...contract,
            totalInvoiced: Math.round(totalInvoiced),
            totalPaid: Math.round(totalPaid),
            outstandingDebt,
            creditUsagePercent,
            _count: { invoices: contract.invoices.length },
        });
    } catch (error) {
        console.error('[Contract GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── PATCH /api/admin/contracts/[id] — Shartnomani tahrirlash ────────────────
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const body = await req.json();

        const allowedFields = [
            'companyName', 'inn', 'mfo', 'bankAccount', 'bankName',
            'directorName', 'creditLimit', 'paymentTermDays', 'status',
            'endDate', 'notes',
        ];

        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        if (updateData.creditLimit !== undefined) {
            updateData.creditLimit = Number(updateData.creditLimit);
        }
        if (updateData.paymentTermDays !== undefined) {
            updateData.paymentTermDays = Number(updateData.paymentTermDays);
        }
        if (updateData.endDate) {
            updateData.endDate = new Date(updateData.endDate as string);
        }

        const contract = await prisma.contract.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                user: { select: { id: true, name: true, phone: true } },
            },
        });

        return NextResponse.json(contract);
    } catch (error) {
        console.error('[Contract PATCH]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── DELETE /api/admin/contracts/[id] — Shartnomani o'chirish ────────────────
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;

        // Fakturalar borligini tekshirish
        const invoiceCount = await prisma.corporateInvoice.count({
            where: { contractId: parseInt(id) },
        });

        if (invoiceCount > 0) {
            return NextResponse.json(
                { error: `Bu shartnomaga ${invoiceCount} ta faktura bog'langan. Avval ularni o'chiring.` },
                { status: 400 },
            );
        }

        await prisma.contract.delete({ where: { id: parseInt(id) } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Contract DELETE]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
