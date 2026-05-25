import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ... (existing code)

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const warehouseId = searchParams.get('warehouseId');
        const search = searchParams.get('search');

        const where: any = {};

        if (warehouseId && warehouseId !== 'all') {
            where.warehouseId = parseInt(warehouseId);
        }

        if (search) {
            where.product = {
                name: { contains: search }
            };
        }

        const inventory = await prisma.inventory.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        image: true,
                        price: true,
                        // Add cost if available in model properly, assuming price for now
                    }
                },
                warehouse: {
                    select: { name: true }
                }
            },
            orderBy: { quantity: 'asc' } // Show low stock first
        });

        return NextResponse.json(inventory);
    } catch (error) {
        console.error('Inventory error:', error);
        return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, productId, fromWarehouseId, toWarehouseId, quantity, reason } = body;

        if (!productId || !quantity || quantity <= 0) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        // Transaction to ensure data integrity
        await prisma.$transaction(async (tx) => {
            // 1. Create Stock Movement Record
            await tx.stockMovement.create({
                data: {
                    type, // 'IN', 'OUT', 'TRANSFER'
                    productId: parseInt(productId),
                    fromWarehouseId: fromWarehouseId ? parseInt(fromWarehouseId) : null,
                    toWarehouseId: toWarehouseId ? parseInt(toWarehouseId) : null,
                    quantity: parseInt(quantity),
                    reason
                }
            });

            // 2. Update Inventory
            if (type === 'IN' && toWarehouseId) {
                // Add to destination
                await upsertInventory(tx, parseInt(productId), parseInt(toWarehouseId), parseInt(quantity));
            } else if (type === 'OUT' && fromWarehouseId) {
                // Remove from source
                await upsertInventory(tx, parseInt(productId), parseInt(fromWarehouseId), -parseInt(quantity));
            } else if (type === 'TRANSFER' && fromWarehouseId && toWarehouseId) {
                // Move from source to destination
                await upsertInventory(tx, parseInt(productId), parseInt(fromWarehouseId), -parseInt(quantity));
                await upsertInventory(tx, parseInt(productId), parseInt(toWarehouseId), parseInt(quantity));
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Stock movement error:', error);
        return NextResponse.json({ error: 'Failed to process movement' }, { status: 500 });
    }
}

async function upsertInventory(tx: any, productId: number, warehouseId: number, change: number) {
    const existing = await tx.inventory.findUnique({
        where: {
            productId_warehouseId: {
                productId,
                warehouseId
            }
        }
    });

    if (existing) {
        const newQuantity = existing.quantity + change;
        if (newQuantity < 0) throw new Error(`Insufficient stock in warehouse ${warehouseId}`);

        await tx.inventory.update({
            where: { id: existing.id },
            data: { quantity: newQuantity }
        });
    } else {
        if (change < 0) throw new Error(`Insufficient stock in warehouse ${warehouseId}`);

        await tx.inventory.create({
            data: {
                productId,
                warehouseId,
                quantity: change
            }
        });
    }
}
