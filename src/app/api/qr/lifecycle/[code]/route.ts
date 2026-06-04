import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface LifecycleStage {
    stage: string;
    label: string;
    date: string | null;
    status: 'completed' | 'in_progress' | 'pending';
    detail?: string;
}

interface LifecycleResponse {
    code: string;
    product: {
        name: string;
        image: string | null;
    };
    lifecycle: LifecycleStage[];
    ecoImpact: {
        recycledContent: number;
        recyclable: boolean;
        co2Saved: number;
    };
}

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function buildLifecycleStages(
    order: { status: string; createdAt: Date; confirmedAt: Date | null; shippedAt: Date | null; deliveredAt: Date | null }
): LifecycleStage[] {
    const created = order.createdAt;
    const isProcessing = ['processing', 'shipping', 'delivered'].includes(order.status);
    const isShipped = ['shipping', 'delivered'].includes(order.status);
    const isDelivered = order.status === 'delivered';

    // Material stage: completed once order is confirmed/processing
    const materialDate = new Date(created);
    materialDate.setDate(materialDate.getDate() + 1);

    // Production stage: 3-5 days after material
    const productionDate = new Date(materialDate);
    productionDate.setDate(productionDate.getDate() + 4);

    // QC stage: 1 day after production
    const qcDate = new Date(productionDate);
    qcDate.setDate(qcDate.getDate() + 1);

    // Delivery date
    const deliveryDate = order.shippedAt ?? new Date(qcDate);
    if (!order.shippedAt) deliveryDate.setDate(deliveryDate.getDate() + 2);

    return [
        {
            stage: 'material',
            label: 'Xom ashyo',
            date: isProcessing ? formatDate(materialDate) : null,
            status: isProcessing ? 'completed' : 'pending',
            detail: "Qayta ishlangan karton",
        },
        {
            stage: 'production',
            label: 'Ishlab chiqarish',
            date: isProcessing ? formatDate(productionDate) : null,
            status: isProcessing ? 'completed' : 'pending',
        },
        {
            stage: 'quality',
            label: 'Sifat nazorati',
            date: isProcessing ? formatDate(qcDate) : null,
            status: isShipped || isDelivered ? 'completed' : isProcessing ? 'in_progress' : 'pending',
        },
        {
            stage: 'delivery',
            label: 'Yetkazish',
            date: isShipped ? formatDate(deliveryDate) : null,
            status: isDelivered ? 'completed' : isShipped ? 'in_progress' : 'pending',
        },
        {
            stage: 'usage',
            label: 'Foydalanish',
            date: isDelivered && order.deliveredAt ? formatDate(order.deliveredAt) : null,
            status: isDelivered ? 'in_progress' : 'pending',
        },
        {
            stage: 'recycle',
            label: 'Qayta ishlash',
            date: null,
            status: 'pending',
            detail: 'Topshirish uchun: pack24.uz/recycling',
        },
    ];
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;

        // Parse code format: P24-{orderId}-{itemIdx}
        const match = code.match(/^P24-(\d+)-(\d+)$/);
        if (!match) {
            return NextResponse.json(
                { error: 'Invalid lifecycle code format. Expected: P24-{orderId}-{itemIndex}' },
                { status: 400 }
            );
        }

        const orderId = parseInt(match[1]);
        const itemIdx = parseInt(match[2]);

        if (!Number.isFinite(orderId) || orderId <= 0) {
            return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
        }

        // Fetch order with items and products
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                status: true,
                createdAt: true,
                confirmedAt: true,
                shippedAt: true,
                deliveredAt: true,
                items: {
                    select: {
                        id: true,
                        quantity: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                            },
                        },
                    },
                },
            },
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Find the specific item by index (0-based)
        const item = order.items[itemIdx];
        if (!item) {
            return NextResponse.json({ error: 'Item not found in order' }, { status: 404 });
        }

        const lifecycle = buildLifecycleStages(order);

        // Eco impact — simulated based on product quantity
        const co2Saved = parseFloat((item.quantity * 0.8).toFixed(1));

        const response: LifecycleResponse = {
            code,
            product: {
                name: item.product?.name ?? 'Gofro quti',
                image: item.product?.image ?? null,
            },
            lifecycle,
            ecoImpact: {
                recycledContent: 85,
                recyclable: true,
                co2Saved,
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('GET /api/qr/lifecycle/[code] error:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
