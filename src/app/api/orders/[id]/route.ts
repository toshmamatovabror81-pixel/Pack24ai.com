import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyCustomer, notifySalesChats } from '@/lib/telegram/notifier';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

async function canAccessOrder(order: {
    userId: number | null;
    contactPhone: string | null;
}) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return false;
    }

    if (session.user.role === 'admin') {
        return true;
    }

    const sessionUserId = Number(session.user.id);
    if (Number.isFinite(sessionUserId) && order.userId === sessionUserId) {
        return true;
    }

    return Boolean(session.user.phone && order.contactPhone === session.user.phone);
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

        if (!(await canAccessOrder(order))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // gallery endi Prisma Json tipida — parse kerak emas
        return NextResponse.json(order);
    } catch (error) {
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

        // Update order
        const updatedOrder = await prisma.order.update({
            where: { id: parseInt(id) },
            data: body,
            include: { items: { include: { product: true } } }
        });

        // If status changed to 'new', send telegram notification
        if (body.status === 'new' && updatedOrder.status === 'new') {
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

        if (!(await canAccessOrder(order))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (action === 'cancel') {
            // Faqat 'new' yoki 'processing' statusdagi buyurtmalarni bekor qilish mumkin
            if (!['new', 'processing'].includes(order.status)) {
                return NextResponse.json(
                    { error: 'Bu buyurtmani bekor qilib bo\'lmaydi. Faqat yangi yoki jarayondagi buyurtmalarni bekor qilish mumkin.' },
                    { status: 400 }
                );
            }

            const cancelled = await prisma.order.update({
                where: { id: parseInt(id) },
                data: { status: 'cancelled' },
                include: { items: { include: { product: true } } },
            });

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
