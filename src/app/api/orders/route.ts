import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OrderStatus, PaymentStatus } from '@prisma/client';
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
import { add, mul, roundUZS, serializeMoney, toDecimal, toNumber } from '@/lib/money';

const ORDER_STATUSES = ['draft', 'new', 'processing', 'shipping', 'delivered', 'cancelled'] as const;
const ORDER_DELIVERY_METHODS = ['courier', 'pickup'] as const;
const ORDER_PAYMENT_METHODS = ['cash', 'click', 'payme', 'bank_transfer'] as const;

// ─── POST /api/orders — Buyurtma yaratish ────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        let sessionUserId = Number(session?.user?.id);

        // Mobile token fallback
        if (!Number.isFinite(sessionUserId)) {
            try {
                const { verifyMobileToken } = await import('@/lib/auth/verifyMobileToken');
                const authHeader = req.headers.get('authorization');
                const result = await verifyMobileToken(authHeader);
                if (result.ok) {
                    sessionUserId = result.userId;
                }
            } catch { /* noop */ }
        }

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
            // Barcha mahsulotlarni birdaniga olish (N+1 query oldini olish)
            const productIds = items.map(i => i.productId);
            const products = await prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, price: true },
            });
            const productMap = new Map(products.map(p => [p.id, p]));

            let total = toNumber(0);
            const fItems: { productId: number; quantity: number; price: ReturnType<typeof toDecimal> }[] = [];
            for (const item of items) {
                const product = productMap.get(item.productId);
                if (product) {
                    total = toNumber(add(total, mul(product.price, item.quantity)));
                    fItems.push({ productId: item.productId, quantity: item.quantity, price: product.price });
                }
            }
            let order = await prisma.order.findFirst({ where: { telegramUserId: telegramUserId?.toString(), status: OrderStatus.draft } });
            if (order) {
                await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
                order = await prisma.order.update({ where: { id: order.id }, data: { totalAmount: roundUZS(total), items: { create: fItems } }, include: { items: { include: { product: true } } } });
            } else {
                order = await prisma.order.create({ data: { telegramUserId: telegramUserId?.toString(), status: OrderStatus.draft, totalAmount: roundUZS(total), items: { create: fItems } }, include: { items: { include: { product: true } } } });
            }
            return NextResponse.json(serializeMoney(order));
        }

        // Full checkout order
        let computedTotal = totalAmount ?? 0;
        const orderItems = items.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            price: toDecimal(i.price),
        }));

        if (!computedTotal) {
            computedTotal = orderItems.reduce(
                (sum, i) => toNumber(add(sum, mul(i.price, i.quantity))),
                0,
            );
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
                    paymentStatus:   (paymentMethod === 'cash' || !paymentMethod) ? PaymentStatus.pending : PaymentStatus.pending,
                    status:          status === 'new' ? OrderStatus.new_ : (status as OrderStatus),
                    totalAmount: roundUZS(computedTotal),
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
            totalAmount: toNumber(order.totalAmount),
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
                totalAmount: toNumber(order.totalAmount),
                status: order.status,
                paymentMethod: order.paymentMethod,
                deliveryMethod: order.deliveryMethod,
                items: order.items.map((i) => ({
                    quantity: i.quantity,
                    price: toNumber(i.price),
                    name: i.product?.name ?? 'Mahsulot',
                })),
            }),
        ]);
        for (const result of sideEffects) {
            if (result.status === 'rejected') {
                console.error('[POST /api/orders] side effect failed', result.reason);
            }
        }
        // ── Korporativ buyurtma → avtomatik faktura ────────────────────
        if (order.userId) {
            try {
                const activeContract = await prisma.contract.findFirst({
                    where: {
                        userId: order.userId,
                        status: 'active',
                    },
                    orderBy: { createdAt: 'desc' },
                });

                if (activeContract) {
                    const subtotal = toNumber(order.totalAmount);
                    const vatPercent = 12;
                    const vatAmount = Math.round(subtotal * vatPercent / 100);
                    const totalWithVat = subtotal + vatAmount;
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + activeContract.paymentTermDays);

                    // Faktura raqami generatsiya
                    const year = new Date().getFullYear();
                    const lastInvoice = await prisma.corporateInvoice.findFirst({
                        where: { invoiceNo: { startsWith: `INV-${year}-` } },
                        orderBy: { invoiceNo: 'desc' },
                    });
                    const nextNum = lastInvoice
                        ? String(parseInt(lastInvoice.invoiceNo.split('-').pop() || '0') + 1).padStart(4, '0')
                        : '0001';

                    await prisma.corporateInvoice.create({
                        data: {
                            invoiceNo: `INV-${year}-${nextNum}`,
                            contractId: activeContract.id,
                            orderId: order.id,
                            subtotal: toDecimal(subtotal),
                            vatPercent,
                            vatAmount: toDecimal(vatAmount),
                            totalAmount: toDecimal(totalWithVat),
                            dueDate,
                            status: 'issued',
                        },
                    });

                    console.log(`[Orders] Auto-invoice INV-${year}-${nextNum} yaratildi → buyurtma #${order.id}`);
                }
            } catch (invoiceErr) {
                console.error('[Orders] Auto-invoice xatosi:', invoiceErr);
            }
        }

        return NextResponse.json(serializeMoney(order));
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
        let sessionUserId = Number(session?.user?.id);
        let isAdmin = session?.user?.role === 'admin';

        // Mobile token fallback
        if (!Number.isFinite(sessionUserId)) {
            try {
                const { verifyMobileToken } = await import('@/lib/auth/verifyMobileToken');
                const authHeader = request.headers.get('authorization');
                const result = await verifyMobileToken(authHeader);
                if (result.ok) {
                    sessionUserId = result.userId;
                    isAdmin = result.user.role === 'admin';
                }
            } catch { /* noop */ }
        }

        const { searchParams } = new URL(request.url);
        const telegramUserId = searchParams.get('telegramUserId');
        const contactPhone   = searchParams.get('contactPhone');
        const paramUserId    = searchParams.get('userId');
        const paramStatus    = searchParams.get('status');
        const paramLimit     = parseInt(searchParams.get('limit') ?? '100');
        const paramSkip      = parseInt(searchParams.get('skip') ?? '0');

        const where: Record<string, unknown> = {};
        if (telegramUserId) where.telegramUserId = telegramUserId;
        if (contactPhone) {
            if (!isAdmin && session?.user?.phone !== contactPhone) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            where.contactPhone = contactPhone;
        }

        // userId parametri (mobile app uchun)
        if (paramUserId && Number.isFinite(Number(paramUserId))) {
            const uid = Number(paramUserId);
            // Faqat o'z buyurtmalarini ko'rish (yoki admin)
            if (!isAdmin && uid !== sessionUserId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            where.userId = uid;
        }

        if (!telegramUserId && !contactPhone && !paramUserId) {
            if (!Number.isFinite(sessionUserId)) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            where.OR = [
                { userId: sessionUserId },
                ...(session?.user?.phone ? [{ contactPhone: session.user.phone }] : []),
            ];
        }

        // Draft buyurtmalarni ko'rsatmaslik (telegramUserId bo'lmasa)
        if (!telegramUserId) {
            if (paramStatus) {
                where.status = paramStatus;
            } else {
                where.status = { not: OrderStatus.draft };
            }
        }

        const orders = await prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Math.min(paramLimit, 200),
            skip: paramSkip,
            include: { items: { include: { product: true } } },
        });
        return NextResponse.json(serializeMoney(orders));
    } catch (_error) {
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
