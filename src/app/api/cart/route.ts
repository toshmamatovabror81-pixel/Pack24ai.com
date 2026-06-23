/**
 * GET/POST /api/cart — Mobil ilova uchun savat API
 * 
 * GET  — auth token bilan user'ning draft buyurtmasidagi items qaytarish
 * POST — savatni saqlash/sync (items array → draft order yaratish/yangilash)
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';
import { verifyMobileToken } from '@/lib/auth/verifyMobileToken';
import { add, mul, roundUZS, toDecimal, toNumber } from '@/lib/money';

// ─── GET /api/cart — Savatni olish ──────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyMobileToken(req.headers.get('authorization'));
        if (!authResult.ok) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        // Draft buyurtma — savatdagi itemlar
        const draftOrder = await prisma.order.findFirst({
            where: {
                userId: authResult.userId,
                status: OrderStatus.draft,
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                price: true,
                                image: true,
                                category: true,
                                inStock: true,
                            },
                        },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        if (!draftOrder) {
            return NextResponse.json({ items: [], total: 0 });
        }

        const items = draftOrder.items.map(item => ({
            productId: item.productId,
            name: item.product.name,
            price: toNumber(item.price),
            qty: item.quantity,
            unit: 'dona',
            emoji: '📦',
            image: item.product.image || null,
            inStock: item.product.inStock,
        }));

        const total = draftOrder.items.reduce(
            (sum, i) => toNumber(add(sum, mul(i.price, i.quantity))),
            0,
        );

        return NextResponse.json({ items, total, orderId: draftOrder.id });
    } catch (error) {
        logger.error('GET /api/cart', {}, error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── POST /api/cart — Savatni saqlash ───────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const authResult = await verifyMobileToken(req.headers.get('authorization'));
        if (!authResult.ok) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const body = await req.json();
        const { items } = body as {
            items: Array<{ productId: number; quantity: number; price: number }>;
        };

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'items majburiy (array)' }, { status: 400 });
        }

        if (items.length > 50) {
            return NextResponse.json({ error: 'Savatda 50 dan ortiq mahsulot bo\'lishi mumkin emas' }, { status: 400 });
        }

        // Validatsiya: productId va quantity tekshirish
        for (const item of items) {
            if (!item.productId || !Number.isInteger(item.productId) || item.productId <= 0) {
                return NextResponse.json({ error: 'Noto\'g\'ri productId' }, { status: 400 });
            }
            if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
                return NextResponse.json({ error: 'Noto\'g\'ri quantity' }, { status: 400 });
            }
        }

        // Narxlarni bazadan olish (user manipulation oldini olish)
        const productIds = items.map(i => i.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, price: true, name: true },
        });
        const priceMap = new Map(products.map(p => [p.id, p.price]));

        const orderItems = items
            .filter(i => priceMap.has(i.productId))
            .map(i => ({
                productId: i.productId,
                quantity: i.quantity,
                price: priceMap.get(i.productId)!,
            }));

        const total = roundUZS(
            orderItems.reduce(
                (sum, i) => toNumber(add(sum, mul(i.price, i.quantity))),
                0,
            ),
        );

        // Mavjud draft ni yangilash yoki yangi yaratish
        const existingDraft = await prisma.order.findFirst({
            where: {
                userId: authResult.userId,
                status: OrderStatus.draft,
            },
        });

        let order;
        if (existingDraft) {
            // Mavjud draft — eski items tozalab, yangilarini qo'shish
            order = await prisma.$transaction(async (tx) => {
                await tx.orderItem.deleteMany({ where: { orderId: existingDraft.id } });
                return tx.order.update({
                    where: { id: existingDraft.id },
                    data: {
                        totalAmount: total,
                        items: { create: orderItems },
                    },
                    include: {
                        items: { include: { product: { select: { name: true } } } },
                    },
                });
            });
        } else {
            // Yangi draft yaratish
            order = await prisma.order.create({
                data: {
                    userId: authResult.userId,
                    status: OrderStatus.draft,
                    totalAmount: total,
                    items: { create: orderItems },
                },
                include: {
                    items: { include: { product: { select: { name: true } } } },
                },
            });
        }

        return NextResponse.json({
            ok: true,
            orderId: order.id,
            total: toNumber(total),
            itemCount: order.items.length,
        });
    } catch (error) {
        logger.error('POST /api/cart', {}, error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
