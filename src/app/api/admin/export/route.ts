import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ─── CSV Helper ──────────────────────────────────────────────────────────────
function toCSV(headers: string[], rows: string[][]): string {
    const escape = (v: string) => {
        if (v.includes(',') || v.includes('"') || v.includes('\n')) {
            return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
    };
    const lines = [headers.map(escape).join(',')];
    for (const row of rows) {
        lines.push(row.map(escape).join(','));
    }
    return '\uFEFF' + lines.join('\r\n'); // BOM for Excel UTF-8
}

function csvResponse(csv: string, filename: string) {
    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}

// ─── GET /api/admin/export?type=orders&period=30 ─────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type   = searchParams.get('type') ?? 'orders';
        const period = parseInt(searchParams.get('period') ?? '30');
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        const from   = fromParam ? new Date(fromParam) : new Date();
        if (!fromParam) from.setDate(from.getDate() - period);
        if (Number.isNaN(from.getTime())) {
            return NextResponse.json({ error: 'Noto\'g\'ri from sana' }, { status: 400 });
        }
        from.setHours(0, 0, 0, 0);

        const toExclusive = toParam ? new Date(toParam) : new Date();
        if (Number.isNaN(toExclusive.getTime())) {
            return NextResponse.json({ error: 'Noto\'g\'ri to sana' }, { status: 400 });
        }
        toExclusive.setHours(0, 0, 0, 0);
        toExclusive.setDate(toExclusive.getDate() + 1);

        if (toExclusive <= from) {
            return NextResponse.json({ error: '`to` sanasi `from` dan katta bo\'lishi kerak' }, { status: 400 });
        }

        const now = new Date().toISOString().slice(0, 10);

        switch (type) {
            // ═════════════════════════════════════════════════════════════
            case 'orders': {
                const orders = await prisma.order.findMany({
                    where: { createdAt: { gte: from, lt: toExclusive } },
                    include: { items: { include: { product: { select: { name: true } } } } },
                    orderBy: { createdAt: 'desc' },
                });

                const headers = [
                    'ID', 'Mijoz', 'Telefon', 'Status', 'Summa',
                    'To\'lov usuli', 'Yetkazish', 'Manzil', 'Izoh',
                    'Mahsulotlar', 'Sana'
                ];

                const rows = orders.map(o => [
                    String(o.id),
                    o.customerName ?? '',
                    o.contactPhone ?? '',
                    o.status,
                    String(o.totalAmount),
                    o.paymentMethod ?? '',
                    o.deliveryMethod ?? '',
                    o.shippingAddress ?? '',
                    o.comment ?? '',
                    o.items.map(i => `${i.product.name} x${i.quantity}`).join('; '),
                    o.createdAt.toISOString().slice(0, 19).replace('T', ' '),
                ]);

                return csvResponse(toCSV(headers, rows), `orders_${now}.csv`);
            }

            // ═════════════════════════════════════════════════════════════
            case 'products': {
                const products = await prisma.product.findMany({
                    orderBy: { id: 'asc' },
                    select: {
                        id: true, name: true, sku: true, category: true,
                        price: true, originalPrice: true, inStock: true,
                        rating: true, reviews: true, status: true,
                        createdAt: true,
                    },
                });

                const headers = [
                    'ID', 'Nomi', 'SKU', 'Kategoriya', 'Narx',
                    'Asl narx', 'Mavjud', 'Reyting', 'Sharhlar',
                    'Status', 'Yaratilgan'
                ];

                const rows = products.map(p => [
                    String(p.id),
                    p.name,
                    p.sku ?? '',
                    p.category ?? '',
                    String(p.price),
                    String(p.originalPrice ?? ''),
                    p.inStock ? 'Ha' : 'Yo\'q',
                    String(p.rating),
                    String(p.reviews),
                    p.status,
                    p.createdAt.toISOString().slice(0, 10),
                ]);

                return csvResponse(toCSV(headers, rows), `products_${now}.csv`);
            }

            // ═════════════════════════════════════════════════════════════
            case 'customers': {
                const customers = await prisma.user.findMany({
                    where: { role: 'user' },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true, name: true, email: true, phone: true,
                        customerType: true, customerGroup: true,
                        companyName: true, address: true,
                        isActive: true, createdAt: true,
                    },
                });

                const headers = [
                    'ID', 'Ism', 'Email', 'Telefon', 'Turi',
                    'Guruh', 'Kompaniya', 'Manzil', 'Faol', 'Ro\'yxatdan o\'tgan'
                ];

                const rows = customers.map(c => [
                    String(c.id),
                    c.name,
                    c.email ?? '',
                    c.phone,
                    c.customerType,
                    c.customerGroup,
                    c.companyName ?? '',
                    c.address ?? '',
                    c.isActive ? 'Ha' : 'Yo\'q',
                    c.createdAt.toISOString().slice(0, 10),
                ]);

                return csvResponse(toCSV(headers, rows), `customers_${now}.csv`);
            }

            // ═════════════════════════════════════════════════════════════
            case 'recycling': {
                const requests = await prisma.recycleRequest.findMany({
                    where: { createdAt: { gte: from, lt: toExclusive } },
                    orderBy: { createdAt: 'desc' },
                    include: { point: true },
                });

                const headers = [
                    'ID', 'Ism', 'Telefon', 'Viloyat', 'Material',
                    'Hajm (kg)', 'Usul', 'Status', 'Sana'
                ];

                const rows = requests.map(r => [
                    String(r.id),
                    r.name,
                    r.phone,
                    r.point?.regionUz ?? String(r.pointId),
                    r.material ?? '',
                    String(r.volume ?? ''),
                    r.pickupType === 'pickup' ? 'Kuryer' : 'Baza',
                    r.status,
                    r.createdAt.toISOString().slice(0, 19).replace('T', ' '),
                ]);

                return csvResponse(toCSV(headers, rows), `recycling_${now}.csv`);
            }

            // ═════════════════════════════════════════════════════════════
            case 'bot_drivers': {
                const grouped = await prisma.recycleCollection.groupBy({
                    by: ['driverId'],
                    _count: { _all: true },
                    _sum: { actualWeight: true, totalAmount: true },
                    where: { createdAt: { gte: from, lt: toExclusive } },
                    orderBy: { _sum: { totalAmount: 'desc' } },
                    take: 100,
                });

                const driverIds = grouped.map(g => g.driverId).filter(Boolean) as number[];
                const drivers = driverIds.length > 0
                    ? await prisma.driver.findMany({
                        where: { id: { in: driverIds } },
                        select: { id: true, name: true, phone: true, isOnline: true, status: true },
                    })
                    : [];
                const driverMap = new Map(drivers.map(d => [d.id, d]));

                const headers = [
                    'Driver ID', 'Ism', 'Telefon', 'Online', 'Status',
                    'Yig\'ishlar soni', 'Jami og\'irlik (kg)', 'Jami summa (so\'m)'
                ];

                const rows = grouped.map(g => {
                    const driver = driverMap.get(g.driverId);
                    return [
                        String(g.driverId),
                        driver?.name ?? `Haydovchi #${g.driverId}`,
                        driver?.phone ?? '',
                        driver?.isOnline ? 'Ha' : 'Yo\'q',
                        driver?.status ?? '',
                        String(g._count._all),
                        String(Number(g._sum.actualWeight ?? 0)),
                        String(Number(g._sum.totalAmount ?? 0)),
                    ];
                });

                return csvResponse(toCSV(headers, rows), `bot_drivers_${now}.csv`);
            }

            // ═════════════════════════════════════════════════════════════
            case 'bot_supervisors': {
                const assignedBySup = await prisma.recycleRequest.groupBy({
                    by: ['supervisorId'],
                    _count: { _all: true },
                    where: { createdAt: { gte: from, lt: toExclusive }, supervisorId: { not: null } },
                });
                const completedBySup = await prisma.recycleRequest.groupBy({
                    by: ['supervisorId'],
                    _count: { _all: true },
                    where: {
                        supervisorId: { not: null },
                        status: 'completed',
                        completedAt: { gte: from, lt: toExclusive },
                    },
                });
                const approvedPayments = await prisma.recycleCollection.groupBy({
                    by: ['paidBy'],
                    _count: { _all: true },
                    _sum: { totalAmount: true },
                    where: {
                        paidBy: { not: null },
                        paidAt: { gte: from, lt: toExclusive },
                        paymentStatus: { in: ['paid_to_customer', 'paid_to_driver', 'paid_both', 'completed'] },
                    },
                });

                const supIds = Array.from(new Set([
                    ...assignedBySup.map(s => s.supervisorId),
                    ...completedBySup.map(s => s.supervisorId),
                ].filter(Boolean))) as number[];

                const supervisors = supIds.length > 0
                    ? await prisma.supervisor.findMany({
                        where: { id: { in: supIds } },
                        select: { id: true, name: true, phone: true },
                    })
                    : [];

                const assignedMap = new Map(assignedBySup.map(s => [s.supervisorId as number, s._count._all]));
                const completedMap = new Map(completedBySup.map(s => [s.supervisorId as number, s._count._all]));
                const paymentByName = new Map(approvedPayments.map(p => [p.paidBy ?? '', p]));

                const headers = [
                    'Supervisor ID', 'Ism', 'Telefon',
                    'Tayinlangan arizalar', 'Yakunlangan arizalar',
                    'Tasdiqlangan to\'lovlar soni', 'Tasdiqlangan to\'lovlar summasi (so\'m)'
                ];

                const rows = supervisors
                    .map(sup => {
                        const payment = paymentByName.get(sup.name);
                        return [
                            String(sup.id),
                            sup.name,
                            sup.phone,
                            String(assignedMap.get(sup.id) ?? 0),
                            String(completedMap.get(sup.id) ?? 0),
                            String(payment?._count._all ?? 0),
                            String(Number(payment?._sum.totalAmount ?? 0)),
                        ];
                    })
                    .sort((a, b) => Number(b[4]) - Number(a[4]));

                return csvResponse(toCSV(headers, rows), `bot_supervisors_${now}.csv`);
            }

            default:
                return NextResponse.json(
                    { error: `Noma'lum type: ${type}. Foydalaning: orders, products, customers, recycling, bot_drivers, bot_supervisors` },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('[API/admin/export]', error);
        return NextResponse.json({ error: 'Export xatosi' }, { status: 500 });
    }
}
