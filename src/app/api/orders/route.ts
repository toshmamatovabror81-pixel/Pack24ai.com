import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
    readArray,
    readJsonObject,
    readOptionalEnum,
    readOptionalNumber,
    readOptionalString,
    RequestValidationError,
} from '@/lib/requestValidation';
import { publishPlatformEvent } from '@/lib/platform/events';
import { sendWebsiteOrderCreatedToAdminChats } from '@/lib/platform/telegramCommands';
import { validateAndReserveStock, formatStockErrors } from '@/lib/domain/stockValidation';

const ORDER_STATUSES = ['draft', 'new', 'processing', 'shipping', 'delivered', 'cancelled'] as const;
const ORDER_DELIVERY_METHODS = ['courier', 'pickup'] as const;
const ORDER_PAYMENT_METHODS = ['cash', 'click', 'payme', 'bank_transfer'] as const;

// ─── POST /api/orders — Buyurtma yaratish ────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const sessionUserId = Number(session?.user?.id);
        const body = await readJsonObject(req);
        const telegramUserId = readOptionalString(body.telegramUserId, 'telegramUserId');
        const customerName = readOptionalString(body.customerName, 'customerName');
        const contactPhone = readOptionalString(body.contactPhone, 'contactPhone');
        const shippingAddress = readOptionalString(body.shippingAddress, 'shippingAddress');
        const shippingLocation = readOptionalString(body.shippingLocation, 'shippingLocation');
        const comment = readOptionalString(body.comment, 'comment');
        const deliveryMethod = readOptionalEnum(
            body.deliveryMethod,
            'deliveryMethod',
            ORDER_DELIVERY_METHODS,
        );
        const paymentMethod = readOptionalEnum(
            body.paymentMethod,
            'paymentMethod',
            ORDER_PAYMENT_METHODS,
        );
        const status = readOptionalEnum(body.status, 'status', ORDER_STATUSES) || 'new';
        const totalAmount = readOptionalNumber(body.totalAmount, 'totalAmount');
        const items = readArray(body.items, 'items').map((item, index) => {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                throw new RequestValidationError(`items[${index}] object bo'lishi kerak`);
            }

            const itemRecord = item as Record<string, unknown>;
            const productId = readOptionalNumber(itemRecord.productId, `items[${index}].productId`);
            const quantity = readOptionalNumber(itemRecord.quantity, `items[${index}].quantity`);
            const price = readOptionalNumber(itemRecord.price, `items[${index}].price`);

            if (!productId || !Number.isInteger(productId) || productId <= 0) {
                throw new RequestValidationError(`items[${index}].productId musbat butun son bo'lishi kerak`);
            }

            if (!quantity || !Number.isInteger(quantity) || quantity <= 0) {
                throw new RequestValidationError(`items[${index}].quantity musbat butun son bo'lishi kerak`);
            }

            if (price !== undefined && price < 0) {
                throw new RequestValidationError(`items[${index}].price manfiy bo'lmasligi kerak`);
            }

            return {
                productId,
                quantity,
                price: price ?? 0,
            };
        });

        if (!items.length) {
            return NextResponse.json({ error: 'items majburiy' }, { status: 400 });
        }

        // Draft mode (old cart flow)
        if (telegramUserId && !customerName) {
            let total = 0;
            const fItems: { productId: number; quantity: number; price: number }[] = [];
            for (const item of items) {
                const product = await prisma.product.findUnique({ where: { id: item.productId } });
                if (product) {
                    total += product.price * item.quantity;
                    fItems.push({ productId: item.productId, quantity: item.quantity, price: product.price });
                }
            }
            let order = await prisma.order.findFirst({ where: { telegramUserId: telegramUserId?.toString(), status: 'draft' } });
            if (order) {
                await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
                order = await prisma.order.update({ where: { id: order.id }, data: { totalAmount: total, items: { create: fItems } }, include: { items: { include: { product: true } } } });
            } else {
                order = await prisma.order.create({ data: { telegramUserId: telegramUserId?.toString(), status: 'draft', totalAmount: total, items: { create: fItems } }, include: { items: { include: { product: true } } } });
            }
            return NextResponse.json(order);
        }

        // Full checkout order
        let computedTotal = totalAmount ?? 0;
        const orderItems = items.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
        }));

        if (!computedTotal) {
            computedTotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        }

        // ─── Ombor tekshiruv + buyurtma yaratish (tranzaksiya) ───────────
        const order = await prisma.$transaction(async (tx) => {
            // 1. Omborda zaxira tekshirish va reserve qilish
            const stockResult = await validateAndReserveStock(tx, orderItems.map(i => ({
                productId: i.productId,
                quantity: i.quantity,
            })));

            if (!stockResult.ok) {
                throw new Error(`STOCK_ERROR:${formatStockErrors(stockResult.errors)}`);
            }

            // 2. Buyurtma yaratish
            return tx.order.create({
                data: {
                    telegramUserId: telegramUserId?.toString() ?? null,
                    userId:          Number.isFinite(sessionUserId) ? sessionUserId : null,
                    customerName:    customerName ?? session?.user?.name ?? null,
                    contactPhone:    contactPhone ?? session?.user?.phone ?? null,
                    shippingAddress: shippingAddress ?? null,
                    shippingLocation: shippingLocation ?? null,
                    comment:         comment ?? null,
                    deliveryMethod:  deliveryMethod ?? 'courier',
                    paymentMethod:   paymentMethod ?? 'cash',
                    paymentStatus:   (paymentMethod === 'cash' || !paymentMethod) ? 'pending' : 'awaiting',
                    status,
                    totalAmount: computedTotal,
                    items: { create: orderItems },
                },
                include: { items: { include: { product: { select: { name: true } } } } },
            });
        }, { maxWait: 10000, timeout: 30000 });

        const eventPayload = {
            orderId: order.id,
            userId: order.userId,
            telegramUserId: order.telegramUserId,
            customerName: order.customerName,
            contactPhone: order.contactPhone,
            totalAmount: order.totalAmount,
            itemCount: order.items.length,
            paymentMethod: order.paymentMethod,
            deliveryMethod: order.deliveryMethod,
        };

        const sideEffects = await Promise.allSettled([
            publishPlatformEvent({
                source: 'platform',
                type: 'order.created',
                entityType: 'order',
                entityId: order.id,
                severity: 'success',
                title: 'Yangi buyurtma yaratildi',
                message: `Buyurtma #${order.id} web sahifa orqali yaratildi.`,
                payload: eventPayload,
                userId: order.userId ?? undefined,
            }),
            sendWebsiteOrderCreatedToAdminChats({
                id: order.id,
                customerName: order.customerName,
                contactPhone: order.contactPhone,
                shippingAddress: order.shippingAddress,
                shippingLocation: order.shippingLocation,
                totalAmount: order.totalAmount,
                status: order.status,
                paymentMethod: order.paymentMethod,
                deliveryMethod: order.deliveryMethod,
                items: order.items.map((i: { quantity: number; price: number; product: { name: string } | null }) => ({
                    quantity: i.quantity,
                    price: i.price,
                    name: i.product?.name ?? 'Mahsulot',
                })),
            }),
        ]);
        for (const result of sideEffects) {
            if (result.status === 'rejected') {
                console.error('[POST /api/orders] side effect failed', result.reason);
            }
        }

        return NextResponse.json(order);
    } catch (error) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        // Ombor zaxira yetarli emas
        if (error instanceof Error && error.message.startsWith('STOCK_ERROR:')) {
            const detail = error.message.replace('STOCK_ERROR:', '');
            return NextResponse.json({
                error: `Omborda yetarli mahsulot yo'q: ${detail}`,
                code: 'INSUFFICIENT_STOCK',
            }, { status: 400 });
        }

        console.error('[POST /api/orders]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── GET /api/orders — Buyurtmalarni olish ───────────────────────────────────
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const sessionUserId = Number(session?.user?.id);
        const isAdmin = session?.user?.role === 'admin';
        const { searchParams } = new URL(request.url);
        const telegramUserId = searchParams.get('telegramUserId');
        const contactPhone   = searchParams.get('contactPhone');
        const where: Record<string, unknown> = {};
        if (telegramUserId) where.telegramUserId = telegramUserId;
        if (contactPhone) {
            if (!isAdmin && session?.user?.phone !== contactPhone) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            where.contactPhone = contactPhone;
        }

        if (!telegramUserId && !contactPhone) {
            if (!Number.isFinite(sessionUserId)) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            where.OR = [
                { userId: sessionUserId },
                ...(session?.user?.phone ? [{ contactPhone: session.user.phone }] : []),
            ];
        }

        // Draft buyurtmalarni ko'rsatmaslik
        if (!telegramUserId) {
            where.status = { not: 'draft' };
        }

        const orders = await prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { items: { include: { product: true } } },
        });
        return NextResponse.json(orders);
    } catch (error) {
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
