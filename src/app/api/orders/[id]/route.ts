import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { notifyCustomer, notifySalesChats } from '@/lib/telegram/notifier';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { restoreStockForOrder } from '@/lib/domain/stockValidation';
import { requireAdmin } from '@/lib/auth/guards';

type OrderAccess = 'admin' | 'owner' | 'draft' | null;

// Mijoz PUT orqali o'zgartira oladigan maydonlar (mobil checkout oqimi)
const CUSTOMER_EDITABLE_FIELDS = ['shippingAddress', 'shippingLocation', 'contactPhone', 'customerName', 'comment', 'deliveryMethod', 'paymentMethod'] as const;
// Admin qo'shimcha ravishda statuslarni o'zgartira oladi
const ADMIN_EDITABLE_FIELDS = [...CUSTOMER_EDITABLE_FIELDS, 'status', 'paymentStatus'] as const;

async function getOrderAccess(order: {
    userId: number | null;
    contactPhone: string | null;
    status: OrderStatus;
}, request: Request): Promise<OrderAccess> {
    // 1. next-auth session
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
        if (session.user.role === 'admin') {
            return 'admin';
        }

        const sessionUserId = Number(session.user.id);
        if (Number.isFinite(sessionUserId) && order.userId === sessionUserId) {
            return 'owner';
        }

        if (session.user.phone && order.contactPhone === session.user.phone) {
            return 'owner';
        }
    }

    // 2. Admin token (cookie yoki header). requireAdmin xato tashlamaydi —
    //    natijaning `ok` maydonini tekshirish shart.
    const adminCheck = await requireAdmin(request as NextRequest);
    if (adminCheck.ok) {
        return 'admin';
    }

    // 3. Telegram Mini App mehmon oqimi: faqat hali yakunlanmagan draft buyurtma
    if (order.status === OrderStatus.draft) {
        return 'draft';
    }

    return null;
}

function pickFields(body: Record<string, unknown>, fields: readonly string[]) {
    const data: Record<string, unknown> = {};
    for (const key of fields) {
        if (body[key] !== undefined) data[key] = body[key];
    }
    return data;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const order = await prisma.order.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        if (!order) {
            return NextResponse.json({ error: 'Not Found' }, { status: 404 });
        }

        if (!(await getOrderAccess(order, request))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // gallery endi Prisma Json tipida — parse kerak emas
        return NextResponse.json(order);
    } catch (_error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // ── Auth: faqat egasi yoki admin yangilashi mumkin ───────────────
        const existing = await prisma.order.findUnique({
            where: { id: parseInt(id) },
            select: { userId: true, contactPhone: true, status: true },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Buyurtma topilmadi' }, { status: 404 });
        }

        const access = await getOrderAccess(existing, request);
        if (!access) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
            return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 });
        }

        const data = pickFields(body, access === 'admin' ? ADMIN_EDITABLE_FIELDS : CUSTOMER_EDITABLE_FIELDS);

        if (access === 'admin') {
            if (data.status === 'new') data.status = OrderStatus.new_;
            if (data.status !== undefined && !Object.values(OrderStatus).includes(data.status as OrderStatus)) {
                return NextResponse.json({ error: "Noto'g'ri status" }, { status: 400 });
            }
            if (data.paymentStatus !== undefined && !Object.values(PaymentStatus).includes(data.paymentStatus as PaymentStatus)) {
                return NextResponse.json({ error: "Noto'g'ri to'lov statusi" }, { status: 400 });
            }
        } else if (body.status !== undefined) {
            // Mijoz faqat o'z draft buyurtmasini yakunlay oladi (draft → new)
            if (body.status !== 'new' || existing.status !== OrderStatus.draft) {
                return NextResponse.json({ error: 'Statusni o\'zgartirish mumkin emas' }, { status: 403 });
            }
            data.status = OrderStatus.new_;
        }

        // Update order
        const updatedOrder = await prisma.order.update({
            where: { id: parseInt(id) },
            data,
            include: { items: { include: { product: true } } }
        });

        // If status changed to 'new', send telegram notification
        if (body.status === 'new' && updatedOrder.status === OrderStatus.new_) {
            try {
                if (updatedOrder.telegramUserId) {
                    await notifyCustomer(
                        updatedOrder.telegramUserId,
                        `✅ Buyurtmangiz qabul qilindi! ID: #${updatedOrder.id}\nTez orada aloqaga chiqamiz.`
                    );
                }
            } catch (tgError) {
                console.error('Failed to send telegram notification:', tgError);
            }
        }

        return NextResponse.json(updatedOrder);
    } catch (error) {
        console.error('Error updating order:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ─── PATCH /api/orders/[id] — Buyurtmani bekor qilish ─────────────────────────
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { action } = body;

        const order = await prisma.order.findUnique({ where: { id: parseInt(id) } });
        if (!order) {
            return NextResponse.json({ error: 'Buyurtma topilmadi' }, { status: 404 });
        }

        if (!(await getOrderAccess(order, request))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (action === 'cancel') {
            // Faqat 'new' yoki 'processing' statusdagi buyurtmalarni bekor qilish mumkin
            if (order.status !== OrderStatus.new_ && order.status !== OrderStatus.processing) {
                return NextResponse.json(
                    { error: 'Bu buyurtmani bekor qilib bo\'lmaydi. Faqat yangi yoki jarayondagi buyurtmalarni bekor qilish mumkin.' },
                    { status: 400 }
                );
            }

            const cancelled = await prisma.$transaction(async (tx) => {
                // 1. Ombor zaxirasini tiklash
                await restoreStockForOrder(tx, parseInt(id));

                // 2. Buyurtma statusini yangilash
                return tx.order.update({
                    where: { id: parseInt(id) },
                    data: { status: OrderStatus.cancelled },
                    include: { items: { include: { product: true } } },
                });
            }, { maxWait: 10000, timeout: 30000 });

            // Telegram xabar
            try {
                await notifySalesChats(
                    `❌ <b>Buyurtma #${cancelled.id} bekor qilindi</b>\n` +
                    `👤 ${cancelled.customerName ?? 'Noma\'lum'}\n` +
                    `📞 ${cancelled.contactPhone ?? '-'}`
                );
            } catch (e) { console.error('[Telegram cancel]', e); }

            return NextResponse.json(cancelled);
        }

        return NextResponse.json({ error: 'Noto\'g\'ri amal' }, { status: 400 });
    } catch (error) {
        console.error('Error patching order:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
