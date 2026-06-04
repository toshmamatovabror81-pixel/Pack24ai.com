import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

type StageStatus = 'pending' | 'in_progress' | 'completed';

interface StageInfo {
    stage: string;
    status: StageStatus;
    startedAt: string | null;
    completedAt: string | null;
    operator: string | null;
    notes: string | null;
}

interface ProductionResponse {
    orderId: number;
    orderStatus: string;
    currentStage: string;
    progress: number;
    stages: StageInfo[];
    workOrderId: number | null;
    workOrderStatus: string | null;
}

const PRODUCTION_STAGES = ['gofra', 'pechat', 'yiguv', 'qc'] as const;

function buildSimulatedStages(orderStatus: string): {
    stages: StageInfo[];
    currentStage: string;
    progress: number;
} {
    const now = new Date().toISOString();

    if (orderStatus === 'delivered' || orderStatus === 'shipping') {
        return {
            stages: PRODUCTION_STAGES.map((stage) => ({
                stage,
                status: 'completed' as StageStatus,
                startedAt: now,
                completedAt: now,
                operator: null,
                notes: null,
            })),
            currentStage: 'qc',
            progress: 100,
        };
    }

    if (orderStatus === 'processing') {
        return {
            stages: PRODUCTION_STAGES.map((stage) => {
                if (stage === 'gofra') {
                    return {
                        stage,
                        status: 'completed' as StageStatus,
                        startedAt: now,
                        completedAt: now,
                        operator: null,
                        notes: null,
                    };
                }
                if (stage === 'pechat') {
                    return {
                        stage,
                        status: 'in_progress' as StageStatus,
                        startedAt: now,
                        completedAt: null,
                        operator: null,
                        notes: null,
                    };
                }
                return {
                    stage,
                    status: 'pending' as StageStatus,
                    startedAt: null,
                    completedAt: null,
                    operator: null,
                    notes: null,
                };
            }),
            currentStage: 'pechat',
            progress: 35,
        };
    }

    // new, draft, or any other status → all pending
    return {
        stages: PRODUCTION_STAGES.map((stage) => ({
            stage,
            status: 'pending' as StageStatus,
            startedAt: null,
            completedAt: null,
            operator: null,
            notes: null,
        })),
        currentStage: 'gofra',
        progress: 0,
    };
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const orderId = parseInt(id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
        }

        // ── Auth: session or mobile token ────────────────────────────────
        const session = await getServerSession(authOptions);
        let sessionUserId = Number(session?.user?.id);
        let isAdmin = session?.user?.role === 'admin';

        if (!Number.isFinite(sessionUserId)) {
            try {
                const { verifyMobileToken } = await import('@/lib/auth/verifyMobileToken');
                const authHeader = _req.headers.get('authorization');
                const result = await verifyMobileToken(authHeader);
                if (result.ok) {
                    sessionUserId = result.userId;
                    isAdmin = result.user.role === 'admin';
                }
            } catch { /* noop */ }
        }

        if (!Number.isFinite(sessionUserId)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ── Fetch order ──────────────────────────────────────────────────
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                status: true,
                userId: true,
                contactPhone: true,
                createdAt: true,
            },
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Check access
        if (!isAdmin) {
            const ownsOrder =
                order.userId === sessionUserId ||
                (session?.user?.phone && order.contactPhone === session.user.phone);
            if (!ownsOrder) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // ── Try to find real WorkOrder ───────────────────────────────────
        const year = order.createdAt.getFullYear();
        const orderNoPattern = `ORD-${year}-${String(orderId).padStart(3, '0')}`;

        const workOrder = await prisma.workOrder.findFirst({
            where: {
                OR: [
                    { orderNo: orderNoPattern },
                    { orderNo: `ORD-${year}-${orderId}` },
                ],
            },
            include: {
                stages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        let response: ProductionResponse;

        if (workOrder && workOrder.stages.length > 0) {
            // Real work order found — use actual stage data
            const stages: StageInfo[] = PRODUCTION_STAGES.map((stageName) => {
                const found = workOrder.stages.find((s) => s.stage === stageName);
                return {
                    stage: stageName,
                    status: (found?.status ?? 'pending') as StageStatus,
                    startedAt: found?.startedAt?.toISOString() ?? null,
                    completedAt: found?.completedAt?.toISOString() ?? null,
                    operator: found?.operator ?? null,
                    notes: found?.notes ?? null,
                };
            });

            response = {
                orderId: order.id,
                orderStatus: order.status,
                currentStage: workOrder.currentStage,
                progress: workOrder.progress,
                stages,
                workOrderId: workOrder.id,
                workOrderStatus: workOrder.status,
            };
        } else {
            // No work order — simulate based on order status
            const simulated = buildSimulatedStages(order.status);
            response = {
                orderId: order.id,
                orderStatus: order.status,
                currentStage: simulated.currentStage,
                progress: simulated.progress,
                stages: simulated.stages,
                workOrderId: workOrder?.id ?? null,
                workOrderStatus: workOrder?.status ?? null,
            };
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('GET /api/orders/[id]/production error:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
