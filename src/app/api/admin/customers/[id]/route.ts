import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface AdminCustomerDetail {
    id: number | string;
    source: 'registered' | 'guest';
    name: string;
    phone: string;
    email: string | null;
    telegramId?: string | null;
    isActive: boolean;
    role?: string;
    customerType: string | null;
    customerGroup: string | null;
    companyName: string | null;
    address: string | null;
    notes: string | null;
    createdAt: Date | null;
    updatedAt?: Date;
}

interface OrderItemProductName {
    product?: {
        name: string | null;
    } | null;
}

// ─── GET /api/admin/customers/[id] — Bir mijoz tafsilotlari + moliya ──────────
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = new URL(request.url);
        const mode = url.searchParams.get('mode'); // 'sverka' — akt sverka uchun

        // ID "guest-+998..." formatda bo'lishi mumkin
        const isGuest = id.startsWith('guest-');
        const phone = isGuest ? id.replace('guest-', '') : null;

        let customer: AdminCustomerDetail | null = null;

        if (isGuest && phone) {
            // Mehmon mijoz — faqat buyurtmalardan ma'lumot
            const firstOrder = await prisma.order.findFirst({
                where: { contactPhone: phone, status: { not: 'draft' } },
                orderBy: { createdAt: 'asc' },
                select: { customerName: true, contactPhone: true, createdAt: true },
            });
            customer = {
                id,
                source: 'guest',
                name: firstOrder?.customerName || 'Mehmon',
                phone,
                email: null,
                isActive: true,
                customerType: 'individual',
                customerGroup: 'new',
                companyName: null,
                address: null,
                notes: null,
                createdAt: firstOrder?.createdAt ?? null,
            };
        } else {
            // Ro'yxatdan o'tgan foydalanuvchi
            const user = await prisma.user.findUnique({
                where: { id: parseInt(id) },
                select: {
                    id: true, name: true, phone: true, email: true,
                    telegramId: true,
                    isActive: true, role: true, customerType: true,
                    customerGroup: true, companyName: true, address: true,
                    notes: true, createdAt: true, updatedAt: true,
                },
            });
            if (user) customer = { ...user, source: 'registered' };
        }

        if (!customer) {
            return NextResponse.json({ error: 'Mijoz topilmadi' }, { status: 404 });
        }

        // Buyurtmalar tarixi
        const customerPhone = isGuest ? phone : customer.phone;
        const orders = await prisma.order.findMany({
            where: { contactPhone: customerPhone!, status: { not: 'draft' } },
            include: {
                items: {
                    include: { product: { select: { name: true, image: true, price: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // ─── Moliyaviy hisob-kitob ──────────────────────────────────────────
        const financials = {
            totalOrders: orders.length,
            // Jami summa (bekor qilinganlar hisoblanmaydi)
            totalRevenue: 0,
            // To'langan
            totalPaid: 0,
            // Debitor (qarzdor — to'lanmagan)
            totalDebit: 0,
            // Kreditor (ortiqcha to'lov)
            totalCredit: 0,
            // Yetkazilgan
            deliveredCount: 0,
            // Faol
            activeCount: 0,
            // Bekor qilingan
            cancelledCount: 0,
        };

        // Har bir buyurtma uchun moliyaviy tahlil (akt sverka uchun)
        const ledger: {
            date: string;
            orderId: number;
            description: string;
            debit: number;    // Mijoz qarzi (buyurtma berildi)
            credit: number;   // To'lov qilindi
            balance: number;  // Qoldiq
            status: string;
            paymentStatus: string;
        }[] = [];

        let runningBalance = 0;

        // Buyurtmalarni sanasi bo'yicha tartiblash (eski → yangi)
        const sortedOrders = [...orders].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (const order of sortedOrders) {
            if (order.status === 'cancelled') {
                financials.cancelledCount++;
                // Bekor qilingan buyurtma — ledgerda ko'rsatamiz lekin hisoblmaymiz
                ledger.push({
                    date: order.createdAt.toISOString(),
                    orderId: order.id,
                    description: `Buyurtma #${order.id} — BEKOR QILINDI`,
                    debit: 0,
                    credit: 0,
                    balance: runningBalance,
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                });
                continue;
            }

            const amount = order.totalAmount ?? 0;

            if (['new', 'processing', 'shipping'].includes(order.status)) {
                financials.activeCount++;
            }
            if (order.status === 'delivered') {
                financials.deliveredCount++;
            }

            financials.totalRevenue += amount;

            // Buyurtma berildi — debit (mijoz qarzi oshdi)
            runningBalance += amount;
            ledger.push({
                date: order.createdAt.toISOString(),
                orderId: order.id,
                description: `Buyurtma #${order.id} — ${order.items.map((i: OrderItemProductName) => i.product?.name).filter(Boolean).join(', ') || 'Mahsulotlar'}`,
                debit: amount,
                credit: 0,
                balance: runningBalance,
                status: order.status,
                paymentStatus: order.paymentStatus,
            });

            // Agar to'langan bo'lsa — credit (to'lov)
            if (order.paymentStatus === 'paid') {
                financials.totalPaid += amount;
                runningBalance -= amount;
                ledger.push({
                    date: order.updatedAt.toISOString(),
                    orderId: order.id,
                    description: `To'lov — Buyurtma #${order.id} (${order.paymentMethod ?? 'noma\'lum'})`,
                    debit: 0,
                    credit: amount,
                    balance: runningBalance,
                    status: order.status,
                    paymentStatus: 'paid',
                });
            }
        }

        financials.totalDebit = Math.max(0, runningBalance);    // Mijoz qarzi
        financials.totalCredit = Math.max(0, -runningBalance);  // Biz qarz

        // Akt sverka mode
        if (mode === 'sverka') {
            return NextResponse.json({
                customer: {
                    name: customer.name,
                    phone: customerPhone,
                    companyName: customer.companyName,
                    address: customer.address,
                },
                period: {
                    from: sortedOrders[0]?.createdAt ?? null,
                    to: new Date().toISOString(),
                },
                ledger,
                summary: {
                    totalDebit: financials.totalRevenue,
                    totalCredit: financials.totalPaid,
                    balance: runningBalance,
                    balanceType: runningBalance > 0 ? 'debitor' : runningBalance < 0 ? 'kreditor' : 'nol',
                },
                generatedAt: new Date().toISOString(),
            });
        }

        return NextResponse.json({
            ...customer,
            orders,
            financials,
            ledger,
            currentBalance: runningBalance,
            balanceType: runningBalance > 0 ? 'debitor' : runningBalance < 0 ? 'kreditor' : 'nol',
        });

    } catch (error) {
        console.error('[Admin Customer GET]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ─── PATCH /api/admin/customers/[id] — Mijozni tahrirlash ─────────────────────
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (id.startsWith('guest-')) {
            return NextResponse.json({ error: 'Mehmon mijozni tahrirlash uchun avval ro\'yxatdan o\'tkazish kerak' }, { status: 400 });
        }

        const body = await request.json() as Record<string, string | boolean | null | undefined>;

        const allowedFields = [
            'name', 'email', 'customerType', 'customerGroup',
            'companyName', 'address', 'notes', 'isActive'
        ];

        const updateData: Record<string, string | boolean | null> = {};
        for (const key of allowedFields) {
            if (body[key] !== undefined) {
                updateData[key] = body[key];
            }
        }

        if (typeof updateData.customerType === 'string' && !['individual', 'corporate', 'wholesale', 'dealer'].includes(updateData.customerType)) {
            return NextResponse.json({ error: "Noto'g'ri mijoz turi" }, { status: 400 });
        }
        if (typeof updateData.customerGroup === 'string' && !['standard', 'vip', 'new', 'inactive', 'blocked'].includes(updateData.customerGroup)) {
            return NextResponse.json({ error: "Noto'g'ri mijoz guruhi" }, { status: 400 });
        }

        const updated = await prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData,
            select: {
                id: true, name: true, phone: true, email: true,
                isActive: true, customerType: true, customerGroup: true,
                companyName: true, address: true, notes: true,
                createdAt: true, updatedAt: true,
            },
        });

        return NextResponse.json(updated);

    } catch (error) {
        console.error('[Admin Customer PATCH]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ─── DELETE — Soft delete ──────────────────────────────────────────────────────
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (id.startsWith('guest-')) {
            return NextResponse.json({ error: 'Mehmon mijozni o\'chirish mumkin emas' }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: parseInt(id) },
            data: { isActive: false, customerGroup: 'blocked' },
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Admin Customer DELETE]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
