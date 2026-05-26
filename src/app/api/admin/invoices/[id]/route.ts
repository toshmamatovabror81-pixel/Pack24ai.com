import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toDecimal, toNumber, serializeMoney } from '@/lib/money';

// ─── GET /api/admin/invoices/[id] — Faktura tafsiloti ────────────────────────
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const invoice = await prisma.corporateInvoice.findUnique({
            where: { id: parseInt(id) },
            include: {
                contract: {
                    select: {
                        contractNo: true, companyName: true, inn: true, mfo: true,
                        bankAccount: true, bankName: true, directorName: true,
                        user: { select: { name: true, phone: true } },
                    },
                },
                order: {
                    include: {
                        items: { include: { product: { select: { name: true, sku: true } } } },
                    },
                },
            },
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Faktura topilmadi' }, { status: 404 });
        }

        return NextResponse.json(serializeMoney(invoice));
    } catch (error) {
        console.error('[Invoice GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── PATCH /api/admin/invoices/[id] — To'lov kiritish / status yangilash ─────
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { action, amount, status: newStatus } = body;

        const invoice = await prisma.corporateInvoice.findUnique({
            where: { id: parseInt(id) },
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Faktura topilmadi' }, { status: 404 });
        }

        // To'lov qo'shish
        if (action === 'add_payment') {
            if (!amount || amount <= 0) {
                return NextResponse.json({ error: "To'lov summasi musbat bo'lishi kerak" }, { status: 400 });
            }

            const newPaidAmount = toNumber(invoice.paidAmount) + Number(amount);
            const totalAmount = toNumber(invoice.totalAmount);
            let updatedStatus = invoice.status;

            if (newPaidAmount >= totalAmount) {
                updatedStatus = 'paid';
            } else if (newPaidAmount > 0) {
                updatedStatus = 'partial';
            }

            const updated = await prisma.corporateInvoice.update({
                where: { id: parseInt(id) },
                data: {
                    paidAmount: toDecimal(newPaidAmount),
                    status: updatedStatus,
                    paidAt: updatedStatus === 'paid' ? new Date() : null,
                },
            });

            return NextResponse.json(serializeMoney(updated));
        }

        // Status o'zgartirish
        if (newStatus) {
            const validStatuses = ['issued', 'paid', 'partial', 'overdue', 'cancelled'];
            if (!validStatuses.includes(newStatus)) {
                return NextResponse.json({ error: "Noto'g'ri status" }, { status: 400 });
            }

            const updated = await prisma.corporateInvoice.update({
                where: { id: parseInt(id) },
                data: { status: newStatus },
            });

            return NextResponse.json(serializeMoney(updated));
        }

        return NextResponse.json({ error: "Noto'g'ri amal" }, { status: 400 });
    } catch (error) {
        console.error('[Invoice PATCH]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
