import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ─── Volume discount tiers ───────────────────────────────────────────────────
interface VolumeTier {
    name: string;
    minQty: number;
    maxQty: number | null;
    discount: number;
}

const VOLUME_TIERS: VolumeTier[] = [
    { name: 'standard', minQty: 1, maxQty: 99, discount: 0 },
    { name: 'silver', minQty: 100, maxQty: 499, discount: 5 },
    { name: 'gold', minQty: 500, maxQty: 999, discount: 10 },
    { name: 'platinum', minQty: 1000, maxQty: 4999, discount: 15 },
    { name: 'diamond', minQty: 5000, maxQty: null, discount: 20 },
];

const LOYALTY_THRESHOLD = 3; // Minimum orders to qualify as returning customer
const LOYALTY_DISCOUNT = 3;
const SEASONAL_DISCOUNT = 2;
const BULK_BONUS_DISCOUNT = 5;
const BULK_BONUS_MIN_QTY = 1000;

// ─── Simple seasonal demand heuristic ────────────────────────────────────────
function isLowDemandSeason(): boolean {
    const month = new Date().getMonth(); // 0-indexed
    // Low demand: January (0), February (1), July (6), August (7)
    return [0, 1, 6, 7].includes(month);
}

function getTier(quantity: number): VolumeTier {
    for (let i = VOLUME_TIERS.length - 1; i >= 0; i--) {
        if (quantity >= VOLUME_TIERS[i].minQty) {
            return VOLUME_TIERS[i];
        }
    }
    return VOLUME_TIERS[0];
}

function getNextTier(currentTier: VolumeTier): VolumeTier | null {
    const idx = VOLUME_TIERS.findIndex((t) => t.name === currentTier.name);
    if (idx < VOLUME_TIERS.length - 1) {
        return VOLUME_TIERS[idx + 1];
    }
    return null;
}

// ─── Discount label translations ─────────────────────────────────────────────
interface DiscountLabels {
    uz: string;
    ru: string;
    en: string;
}

const DISCOUNT_LABELS: Record<string, DiscountLabels> = {
    volume: {
        uz: 'Optom chegirma',
        ru: 'Оптовая скидка',
        en: 'Volume discount',
    },
    loyalty: {
        uz: 'Sodiq mijoz',
        ru: 'Постоянный клиент',
        en: 'Loyalty discount',
    },
    seasonal: {
        uz: 'Mavsumiy chegirma',
        ru: 'Сезонная скидка',
        en: 'Seasonal discount',
    },
    bulk_bonus: {
        uz: 'Katta hajm bonusi',
        ru: 'Бонус за большой объём',
        en: 'Bulk bonus',
    },
};

// ─── Response types ──────────────────────────────────────────────────────────
interface DiscountItem {
    type: string;
    percent: number;
    label: DiscountLabels;
}

interface NextTierInfo {
    name: string;
    quantityNeeded: number;
    additionalDiscount: number;
}

interface PricingResponse {
    productId: number;
    productName: string;
    basePrice: number;
    quantity: number;
    discounts: DiscountItem[];
    totalDiscount: number;
    unitPrice: number;
    totalPrice: number;
    savings: number;
    tier: string;
    nextTier: NextTierInfo | null;
}

// ─── GET /api/pricing/dynamic ────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const productIdRaw = searchParams.get('productId');
        const quantityRaw = searchParams.get('quantity');

        // Validate params
        if (!productIdRaw) {
            return NextResponse.json(
                { error: 'productId parametri majburiy' },
                { status: 400 }
            );
        }

        const productId = parseInt(productIdRaw, 10);
        if (isNaN(productId) || productId <= 0) {
            return NextResponse.json(
                { error: "productId noto'g'ri" },
                { status: 400 }
            );
        }

        const quantity = Math.max(1, parseInt(quantityRaw || '1', 10) || 1);

        // Fetch product
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true, price: true, status: true },
        });

        if (!product || product.status !== 'active') {
            return NextResponse.json(
                { error: 'Mahsulot topilmadi' },
                { status: 404 }
            );
        }

        const basePrice = Number(product.price);
        const discounts: DiscountItem[] = [];

        // 1. Volume discount
        const tier = getTier(quantity);
        if (tier.discount > 0) {
            discounts.push({
                type: 'volume',
                percent: tier.discount,
                label: DISCOUNT_LABELS.volume,
            });
        }

        // 2. Loyalty discount — only for authenticated users
        let isReturningCustomer = false;
        const session = await getServerSession(authOptions).catch(() => null);

        if (session?.user) {
            const userId = parseInt(session.user.id, 10);
            if (!isNaN(userId)) {
                const orderCount = await prisma.order.count({
                    where: {
                        userId,
                        status: { in: ['delivered', 'shipping', 'processing'] },
                    },
                });
                if (orderCount >= LOYALTY_THRESHOLD) {
                    isReturningCustomer = true;
                    discounts.push({
                        type: 'loyalty',
                        percent: LOYALTY_DISCOUNT,
                        label: DISCOUNT_LABELS.loyalty,
                    });
                }
            }
        }

        // 3. Seasonal adjustment
        if (isLowDemandSeason()) {
            discounts.push({
                type: 'seasonal',
                percent: SEASONAL_DISCOUNT,
                label: DISCOUNT_LABELS.seasonal,
            });
        }

        // 4. Bulk bonus — quantity >= 1000 AND returning customer
        if (quantity >= BULK_BONUS_MIN_QTY && isReturningCustomer) {
            discounts.push({
                type: 'bulk_bonus',
                percent: BULK_BONUS_DISCOUNT,
                label: DISCOUNT_LABELS.bulk_bonus,
            });
        }

        // Calculate totals
        const totalDiscount = discounts.reduce((sum, d) => sum + d.percent, 0);
        const cappedDiscount = Math.min(totalDiscount, 40); // Cap at 40%
        const unitPrice = Math.round(basePrice * (1 - cappedDiscount / 100));
        const totalPrice = unitPrice * quantity;
        const savings = (basePrice * quantity) - totalPrice;

        // Next tier info
        const nextTierData = getNextTier(tier);
        let nextTier: NextTierInfo | null = null;
        if (nextTierData) {
            nextTier = {
                name: nextTierData.name,
                quantityNeeded: nextTierData.minQty,
                additionalDiscount: nextTierData.discount - tier.discount,
            };
        }

        const response: PricingResponse = {
            productId: product.id,
            productName: product.name,
            basePrice,
            quantity,
            discounts,
            totalDiscount: cappedDiscount,
            unitPrice,
            totalPrice,
            savings,
            tier: tier.name,
            nextTier,
        };

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
            },
        });
    } catch (error) {
        console.error('GET /api/pricing/dynamic error:', error);
        return NextResponse.json(
            { error: 'Server xatosi' },
            { status: 500 }
        );
    }
}
