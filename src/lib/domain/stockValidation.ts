// ═══════════════════════════════════════════════════════════════════════════════
// Pack24 — Ombor zahira tekshiruvi (Stock Validation & Reservation)
// Buyurtma yaratishdan oldin omborda yetarli mahsulot borligini tekshiradi
// va muvaffaqiyatli bo'lsa zaxirani kamaytiradi (reserve qiladi).
// ═══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

export interface StockCheckItem {
    productId: number;
    quantity: number;
}

export type StockCheckResult = {
    ok: true;
} | {
    ok: false;
    errors: StockError[];
};

export interface StockError {
    productId: number;
    productName: string;
    requested: number;
    available: number;
}

/**
 * Har bir mahsulot uchun ombordagi jami zaxirani tekshiradi.
 * Yetarli bo'lmasa — xatolik qaytaradi (reserve qilmaydi).
 */
export async function checkStock(
    tx: Tx,
    items: StockCheckItem[],
): Promise<StockCheckResult> {
    const errors: StockError[] = [];

    for (const item of items) {
        const totalStock = await tx.inventory.aggregate({
            where: { productId: item.productId },
            _sum: { quantity: true },
        });

        const available = totalStock._sum.quantity ?? 0;

        if (available < item.quantity) {
            const product = await tx.product.findUnique({
                where: { id: item.productId },
                select: { name: true },
            });

            errors.push({
                productId: item.productId,
                productName: product?.name ?? `ID:${item.productId}`,
                requested: item.quantity,
                available,
            });
        }
    }

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    return { ok: true };
}

/**
 * Ombordagi zaxirani tekshiradi va muvaffaqiyatli bo'lsa:
 * 1. Asosiy ombordan chiqim qiladi (inventory kamaytiradi)
 * 2. StockMovement yaratadi (type=OUT, reason: Buyurtma)
 *
 * Bu funksiya faqat $transaction ichida ishlatilishi kerak!
 */
export async function validateAndReserveStock(
    tx: Tx,
    items: StockCheckItem[],
    orderId?: number,
): Promise<StockCheckResult> {
    // 1. Avval tekshirish
    const checkResult = await checkStock(tx, items);
    if (!checkResult.ok) {
        return checkResult;
    }

    // 2. Multi-warehouse logikasi orqali yechib olish
    return await reserveFromMultipleWarehouses(tx, items, orderId);
}

/**
 * Barcha omborlardan mahsulotlarni kaskad usulida reserve qiladi.
 * Avval asosiy ombordan, yetmasa boshqa omborlardan qidiradi.
 */
async function reserveFromMultipleWarehouses(
    tx: Tx,
    items: StockCheckItem[],
    orderId?: number,
): Promise<StockCheckResult> {
    // Omborlarni ustuvorlik (Asosiy > Boshqalar) va yaratilgan vaqti bo'yicha olish
    const warehouses = await tx.warehouse.findMany({
        orderBy: [
            { isMain: 'desc' },
            { createdAt: 'asc' }
        ]
    });

    if (warehouses.length === 0) {
        return { ok: true }; // Hech qanday ombor yo'q bo'lsa tekshiruvdan o'tadi
    }

    for (const item of items) {
        let remainingToDeduct = item.quantity;

        for (const warehouse of warehouses) {
            if (remainingToDeduct <= 0) break;

            const existing = await tx.inventory.findUnique({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: warehouse.id,
                    },
                },
            });

            if (existing && existing.quantity > 0) {
                const take = Math.min(existing.quantity, remainingToDeduct);

                // Atomic decrement — concurrent tranzaksiyalarda xavfsiz
                const updated = await tx.inventory.update({
                    where: { id: existing.id },
                    data: { quantity: { decrement: take } },
                });

                // Manfiy qoldiq — race condition yuz berdi, tranzaksiya bekor qilinadi
                if (updated.quantity < 0) {
                    throw new Error(`STOCK_RACE: productId=${item.productId}, warehouseId=${warehouse.id}`);
                }

                // StockMovement (OUT) yozuvi
                await tx.stockMovement.create({
                    data: {
                        type: 'OUT',
                        productId: item.productId,
                        fromWarehouseId: warehouse.id,
                        quantity: take,
                        reason: orderId
                            ? `Buyurtma #${orderId} — kaskad chiqim (ID:${warehouse.id})`
                            : `Buyurtma — kaskad chiqim (ID:${warehouse.id})`,
                    },
                });

                remainingToDeduct -= take;
            }
        }

        // Agar barcha omborlarni ko'rib ham yetarlicha yig'a olmasa
        if (remainingToDeduct > 0) {
            const product = await tx.product.findUnique({
                where: { id: item.productId },
                select: { name: true },
            });
            return {
                ok: false,
                errors: [{
                    productId: item.productId,
                    productName: product?.name ?? `ID:${item.productId}`,
                    requested: item.quantity,
                    available: item.quantity - remainingToDeduct, // Aslida tranzaksiya bekor qilinadi
                }],
            };
        }
    }

    return { ok: true };
}

/**
 * Buyurtma bekor qilinganda ombordagi zaxirani tiklaydi.
 * Asosiy omborga qaytaradi (IN movement).
 */
export async function restoreStockForOrder(
    tx: Tx,
    orderId: number,
): Promise<void> {
    // Buyurtma mahsulotlarini olish
    const orderItems = await tx.orderItem.findMany({
        where: { orderId },
        select: { productId: true, quantity: true },
    });

    if (!orderItems.length) return;

    // Asosiy omborni topish
    const mainWarehouse = await tx.warehouse.findFirst({
        where: { isMain: true },
    });

    const warehouseId = mainWarehouse?.id;
    if (!warehouseId) {
        const anyWarehouse = await tx.warehouse.findFirst({
            orderBy: { createdAt: 'asc' },
        });
        if (!anyWarehouse) return;
        await restoreToWarehouse(tx, orderItems, anyWarehouse.id, orderId);
        return;
    }

    await restoreToWarehouse(tx, orderItems, warehouseId, orderId);
}

async function restoreToWarehouse(
    tx: Tx,
    items: { productId: number; quantity: number }[],
    warehouseId: number,
    orderId: number,
): Promise<void> {
    for (const item of items) {
        // Inventory yangilash
        const existing = await tx.inventory.findUnique({
            where: {
                productId_warehouseId: {
                    productId: item.productId,
                    warehouseId,
                },
            },
        });

        if (existing) {
            await tx.inventory.update({
                where: { id: existing.id },
                data: { quantity: { increment: item.quantity } },
            });
        } else {
            await tx.inventory.create({
                data: {
                    productId: item.productId,
                    warehouseId,
                    quantity: item.quantity,
                },
            });
        }

        // StockMovement yozuvi
        await tx.stockMovement.create({
            data: {
                type: 'IN',
                productId: item.productId,
                toWarehouseId: warehouseId,
                quantity: item.quantity,
                reason: `Buyurtma #${orderId} bekor — ombor qaytarish`,
            },
        });
    }
}

/**
 * Ombordagi xatoliklarni o'zbek tilidagi matnga aylantiradi.
 */
export function formatStockErrors(errors: StockError[]): string {
    return errors.map(e =>
        `"${e.productName}" — omborda ${e.available} ta bor, ${e.requested} ta so'ralgan`
    ).join('; ');
}
