import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MoneyInput, toNumber } from '@/lib/money';

// ─── Yordamchi interface ──────────────────────────────────────────────────────
interface CustomerRecord {
    id: number | string;
    source: 'registered' | 'guest'; // Ro'yxatdan o'tganmi yoki mehmon
    name: string;
    phone: string;
    email: string | null;
    isActive: boolean;
    customerType: string;
    customerGroup: string;
    companyName: string | null;
    address: string | null;
    notes: string | null;
    createdAt: string;
    // Moliyaviy statistika
    totalOrders: number;
    totalRevenue: number;      // Jami buyurtmalar summasi
    totalPaid: number;         // To'langan summa (delivered + paid)
    totalDebit: number;        // Debitor qarzdorlik (mijoz bizga qarzdor)
    totalCredit: number;       // Kreditor (biz mijozga qarzdor)
    lastOrderDate: string | null;
    // Buyurtma statuslar bo'yicha
    deliveredOrders: number;
    activeOrders: number;
    cancelledOrders: number;
}

// ─── GET /api/admin/customers ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const search = url.searchParams.get('search') || '';
        const type = url.searchParams.get('type') || '';
        const group = url.searchParams.get('group') || '';
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '50');

        // ─── 1. Barcha buyurtma bergan telefon raqamlarini yig'ish ──────────
        const allOrders = await prisma.order.findMany({
            where: { status: { not: 'draft' } },
            select: {
                id: true,
                contactPhone: true,
                customerName: true,
                totalAmount: true,
                status: true,
                paymentStatus: true,
                paymentMethod: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // Telefon raqami bo'yicha buyurtmalarni guruhlash
        const ordersByPhone = new Map<string, typeof allOrders>();
        for (const order of allOrders) {
            const phone = order.contactPhone?.trim();
            if (!phone) continue;
            if (!ordersByPhone.has(phone)) ordersByPhone.set(phone, []);
            ordersByPhone.get(phone)!.push(order);
        }

        // ─── 2. Ro'yxatdan o'tgan foydalanuvchilarni olish ─────────────────
        const registeredUsers = await prisma.user.findMany({
            where: { role: 'user' },
            select: {
                id: true, name: true, phone: true, email: true,
                isActive: true, customerType: true, customerGroup: true,
                companyName: true, address: true, notes: true, createdAt: true,
            },
        });

        const registeredPhones = new Set(registeredUsers.map(u => u.phone));

        // ─── 3. Barcha mijozlarni birlashtirish (registered + guest) ────────
        const allCustomers: CustomerRecord[] = [];

        // 3a. Ro'yxatdan o'tgan foydalanuvchilar
        for (const user of registeredUsers) {
            const orders = ordersByPhone.get(user.phone) || [];
            const stats = calcFinancials(orders);
            allCustomers.push({
                id: user.id,
                source: 'registered',
                name: user.name,
                phone: user.phone,
                email: user.email,
                isActive: user.isActive,
                customerType: user.customerType ?? 'individual',
                customerGroup: user.customerGroup ?? 'standard',
                companyName: user.companyName,
                address: user.address,
                notes: user.notes,
                createdAt: user.createdAt.toISOString(),
                ...stats,
            });
        }

        // 3b. Ro'yxatdan o'TMAGAN lekin buyurtma bergan "mehmon" mijozlar
        for (const [phone, orders] of ordersByPhone.entries()) {
            if (registeredPhones.has(phone)) continue; // Allaqachon qo'shilgan
            const firstOrder = orders[orders.length - 1]; // eng eski
            const stats = calcFinancials(orders);
            allCustomers.push({
                id: `guest-${phone}`,
                source: 'guest',
                name: firstOrder.customerName || 'Mehmon',
                phone,
                email: null,
                isActive: true,
                customerType: 'individual',
                customerGroup: 'new',
                companyName: null,
                address: null,
                notes: null,
                createdAt: firstOrder.createdAt.toISOString(),
                ...stats,
            });
        }

        // ─── 4. Filtrlar ────────────────────────────────────────────────────
        let filtered = allCustomers;

        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.phone.includes(q) ||
                c.companyName?.toLowerCase().includes(q)
            );
        }

        if (type && type !== 'all') {
            filtered = filtered.filter(c => c.customerType === type);
        }

        if (group && group !== 'all') {
            if (group === 'debtor') {
                filtered = filtered.filter(c => c.totalDebit > 0);
            } else if (group === 'active') {
                filtered = filtered.filter(c => c.activeOrders > 0);
            } else {
                filtered = filtered.filter(c => c.customerGroup === group);
            }
        }

        // Saralash: eng ko'p xarid qilgan birinchi
        filtered.sort((a, b) => b.totalRevenue - a.totalRevenue || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // ─── 5. Pagination ───────────────────────────────────────────────────
        const total = filtered.length;
        const skip = (page - 1) * limit;
        const paginated = filtered.slice(skip, skip + limit);
        const totalPages = Math.ceil(total / limit);

        // ─── 6. Umumiy statistika ────────────────────────────────────────────
        const thisMonth = new Date();
        thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);

        const stats = {
            total: allCustomers.length,
            registered: allCustomers.filter(c => c.source === 'registered').length,
            guests: allCustomers.filter(c => c.source === 'guest').length,
            corporate: allCustomers.filter(c => c.customerType === 'corporate').length,
            wholesale: allCustomers.filter(c => c.customerType === 'wholesale').length,
            dealer: allCustomers.filter(c => c.customerType === 'dealer').length,
            vip: allCustomers.filter(c => c.customerGroup === 'vip').length,
            newThisMonth: allCustomers.filter(c => new Date(c.createdAt) >= thisMonth).length,
            inactive: allCustomers.filter(c => !c.isActive || c.customerGroup === 'inactive').length,
            blocked: allCustomers.filter(c => c.customerGroup === 'blocked').length,
            // Moliyaviy
            totalRevenue: allCustomers.reduce((s, c) => s + c.totalRevenue, 0),
            totalDebit: allCustomers.reduce((s, c) => s + c.totalDebit, 0),
            totalPaid: allCustomers.reduce((s, c) => s + c.totalPaid, 0),
            debtors: allCustomers.filter(c => c.totalDebit > 0).length,
            activeWithOrders: allCustomers.filter(c => c.activeOrders > 0).length,
        };

        return NextResponse.json({ customers: paginated, total, page, limit, totalPages, stats });

    } catch (error) {
        console.error('[Admin Customers GET]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ─── Moliyaviy hisob-kitob ────────────────────────────────────────────────────
function calcFinancials(orders: {
    totalAmount: MoneyInput;
    status: string;
    paymentStatus: string;
    createdAt: Date;
}[]) {
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
    const activeOrders = orders.filter(o => ['new', 'processing', 'shipping'].includes(o.status)).length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;

    // Jami tushumga kirgan summa (bekor qilinganlar hisoblanmaydi)
    const totalRevenue = orders
        .filter(o => o.status !== 'cancelled' && o.status !== 'draft')
        .reduce((s, o) => s + toNumber(o.totalAmount), 0);

    // To'langan summa (paymentStatus === 'paid')
    const totalPaid = orders
        .filter(o => o.paymentStatus === 'paid' && o.status !== 'cancelled')
        .reduce((s, o) => s + toNumber(o.totalAmount), 0);

    // Debitor = mijoz bizga qarzdor (buyurtma bor, to'lanmagan)
    const totalDebit = orders
        .filter(o => o.paymentStatus !== 'paid' && o.status !== 'cancelled' && o.status !== 'draft')
        .reduce((s, o) => s + toNumber(o.totalAmount), 0);

    // Kreditor = biz mijozga qarzdor (ortiqcha to'lov yoki qaytarish)
    // Hozircha 0 — kelajakda refund tizimi qo'shilganda hisoblanadi
    const totalCredit = 0;

    const lastOrderDate = orders.length > 0 ? orders[0].createdAt.toISOString() : null;

    return {
        totalOrders, totalRevenue, totalPaid, totalDebit, totalCredit,
        lastOrderDate, deliveredOrders, activeOrders, cancelledOrders,
    };
}
