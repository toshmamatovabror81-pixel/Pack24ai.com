import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const warehouses = await prisma.warehouse.findMany({
            include: {
                _count: {
                    select: { inventory: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        // If no warehouses exist, create default "Asosiy Ombor"
        if (warehouses.length === 0) {
            const mainWarehouse = await prisma.warehouse.create({
                data: {
                    name: 'Asosiy Ombor',
                    isMain: true,
                    location: 'Bosh ofis'
                }
            });
            return NextResponse.json([mainWarehouse]);
        }

        return NextResponse.json(warehouses);
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, location } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const warehouse = await prisma.warehouse.create({
            data: {
                name,
                location
            }
        });

        return NextResponse.json(warehouse, { status: 201 });
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to create warehouse' }, { status: 500 });
    }
}
