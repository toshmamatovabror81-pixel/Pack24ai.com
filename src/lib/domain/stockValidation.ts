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

    // 2. Asosiy omborni topish
    const mainWarehouse = await tx.warehouse.findFirst({
        where: { isMain: true },
    });

    if (!mainWarehouse) {
        // Agar asosiy ombor yo'q bo'lsa — birinchi omborni ishlatamiz
        const anyWarehouse = await tx.warehouse.findFirst({
            orderBy: { createdAt: 'asc' },
        });

        if (!anyWarehouse) {
            // Ombor umuman yo'q — tekshiruvni o'tkazib yuboramiz
            return { ok: true };
        }

        return await reserveFromWarehouse(tx, items, anyWarehouse.id, orderId);
    }

    return await reserveFromWarehouse(tx, items, mainWarehouse.id, orderId);
}

/**
 * Berilgan ombordan mahsulotlarni reserve qiladi (chiqim).
 */
async function reserveFromWarehouse(
    tx: Tx,
    items: StockCheckItem[],
    warehouseId: number,
    orderId?: number,
): Promise<StockCheckResult> {
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
            const newQuantity = existing.quantity - item.quantity;
            if (newQuantity < 0) {
                // Bu omborda yetarli emas — boshqa omborlardan qidirish
                // (hozircha xatolik qaytaramiz, keyingi bosqichda multi-warehouse)
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
                        available: existing.quantity,
                    }],
                };
            }

            await tx.inventory.update({
                where: { id: existing.id },
                data: { quantity: newQuantity },
            });
        } else {
            // Bu omborda umuman yo'q
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
                    available: 0,
                }],
            };
        }

        // StockMovement yozuvi
        await tx.stockMovement.create({
            data: {
                type: 'OUT',
                productId: item.productId,
                fromWarehouseId: warehouseId,
                quantity: item.quantity,
                reason: orderId
                    ? `Buyurtma #${orderId} — avtomatik chiqim`
                    : 'Buyurtma — avtomatik chiqim',
            },
        });
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
                data: { quantity: existing.quantity + item.quantity },
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
