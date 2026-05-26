import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { WorkOrderStatus } from '@prisma/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        const where: Prisma.WorkOrderWhereInput = {};

        if (status && status !== 'all' && (Object.values(WorkOrderStatus) as string[]).includes(status)) {
            where.status = status as WorkOrderStatus;
        }

        if (search) {
            where.OR = [
                { orderNo: { contains: search } },
                { clientName: { contains: search } },
                { productName: { contains: search } }
            ];
        }

        const orders = await prisma.workOrder.findMany({
            where,
            include: {
                stages: true
            },
            orderBy: { deadline: 'asc' }
        });

        return NextResponse.json(orders);
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to fetch production orders' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientName, productName, quantity, deadline, priority } = body;

        if (!clientName || !productName || !quantity || !deadline) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Create Work Order
        const orderNo = `ORD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const order = await prisma.workOrder.create({
            data: {
                orderNo,
                clientName,
                productName,
                quantity: parseInt(quantity),
                deadline: new Date(deadline),
                priority: priority || 'normal',
                status: 'planned',
                progress: 0,
                currentStage: 'gofra',
                stages: {
                    create: [
                        { stage: 'gofra', status: 'pending' },
                        { stage: 'pechat', status: 'pending' },
                        { stage: 'yiguv', status: 'pending' },
                        { stage: 'qc', status: 'pending' }
                    ]
                }
            },
            include: { stages: true }
        });

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        console.error('Work Order creation error:', error);
        return NextResponse.json({ error: 'Failed to create work order' }, { status: 500 });
    }
}
