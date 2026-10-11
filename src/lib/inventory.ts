import 'server-only';
import type { Prisma, StockMovementType } from '@prisma/client';
import { prisma } from './db';

/**
 * Ombor qoldig'i: hamma harakat asosiy ombor (isMain) orqali yuritiladi,
 * har bir o'zgarish StockMovement jurnaliga yoziladi.
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** Qoldiq yetarli emas: chiqim qoldiqdan katta */
export class StockError extends Error {
  constructor(current: number, out: number) {
    super(`Omborda yetarli qoldiq yo'q: ${current} dona bor, ${out} dona chiqarilmoqchi`);
    this.name = 'StockError';
  }
}

async function findMainWarehouse(db: Db) {
  return (await db.warehouse.findFirst({ where: { isMain: true } })) ?? (await db.warehouse.findFirst({ orderBy: { id: 'asc' } }));
}

/** Asosiy ombor: isMain, bo'lmasa birinchisi, u ham bo'lmasa yaratamiz */
export async function getMainWarehouse() {
  return (await findMainWarehouse(prisma)) ?? prisma.warehouse.create({ data: { name: 'Asosiy ombor', location: 'Toshkent', isMain: true } });
}

/** Asosiy ombordagi qoldiq (yozuv bo'lmasa 0) */
export async function getStock(productId: number): Promise<number> {
  const main = await getMainWarehouse();
  const row = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId, warehouseId: main.id } }, select: { quantity: true } });
  return row?.quantity ?? 0;
}

type MovementInput = { productId: number; delta: number; reason: string; createdBy: string; type?: StockMovementType };

/** Jurnal yozuvi: delta > 0 → IN (toWarehouse), delta < 0 → OUT (fromWarehouse) */
function logMovement(tx: Prisma.TransactionClient, warehouseId: number, { productId, delta, reason, createdBy, type }: MovementInput) {
  return tx.stockMovement.create({
    data: {
      type: type ?? (delta > 0 ? 'IN' : 'OUT'),
      productId,
      quantity: Math.abs(delta),
      reason,
      createdBy,
      ...(delta > 0 ? { toWarehouseId: warehouseId } : { fromWarehouseId: warehouseId }),
    },
  });
}

/**
 * Joriy qoldiqni qator qulfi bilan o'qish (yozuv bo'lmasa 0 bilan yaratiladi).
 * `increment: 0` UPDATE sifatida bajariladi: qator tranzaksiya tugaguncha qulflanadi,
 * parallel o'zgarishlar kutib turadi — shuning uchun qiymat eskirmaydi.
 */
async function lockStock(tx: Prisma.TransactionClient, productId: number, warehouseId: number) {
  const row = await tx.inventory.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    create: { productId, warehouseId, quantity: 0 },
    update: { quantity: { increment: 0 } },
    select: { quantity: true },
  });
  return row.quantity;
}

export type AdjustStockInput = MovementInput & {
  delta: number; // + kirim, − chiqim
  clamp?: boolean; // true: qoldiq yetmasa xato o'rniga faqat borini chiqaradi (0 gacha)
};

/**
 * Qoldiqni o'zgartirish + jurnal yozuvi (bitta tranzaksiyada).
 * Yozish atomar increment orqali, natija manfiy bo'lsa tranzaksiya bekor qilinadi — qoldiq 0 dan pastga tushmaydi.
 */
export async function adjustStock({ productId, delta, reason, createdBy, type, clamp }: AdjustStockInput) {
  const wanted = Math.trunc(delta);
  if (!Number.isFinite(wanted)) throw new Error("Miqdor noto'g'ri");
  const main = await getMainWarehouse();
  return prisma.$transaction(async (tx) => {
    const where = { productId_warehouseId: { productId, warehouseId: main.id } };
    const d = clamp && wanted < 0 ? Math.max(wanted, -(await lockStock(tx, productId, main.id))) : wanted;
    const row = await tx.inventory.upsert({ where, create: { productId, warehouseId: main.id, quantity: d }, update: { quantity: { increment: d } } });
    if (row.quantity < 0) throw new StockError(row.quantity - d, -d);
    if (d !== 0) await logMovement(tx, main.id, { productId, delta: d, reason, createdBy, type });
    return row;
  });
}

export type SetStockInput = { productId: number; quantity: number; reason: string; createdBy: string };

/** Qoldiqni aniq qiymatga o'rnatish (inventarizatsiya): farq tranzaksiya ichida, qulflangan qatordan hisoblanadi */
export async function setStock({ productId, quantity, reason, createdBy }: SetStockInput) {
  const q = Math.trunc(quantity);
  if (!Number.isFinite(q) || q < 0) throw new Error("Miqdor noto'g'ri");
  const main = await getMainWarehouse();
  return prisma.$transaction(async (tx) => {
    const current = await lockStock(tx, productId, main.id);
    const d = q - current;
    if (d === 0) return { changed: false, quantity: current };
    await tx.inventory.update({ where: { productId_warehouseId: { productId, warehouseId: main.id } }, data: { quantity: q } });
    await logMovement(tx, main.id, { productId, delta: d, reason, createdBy });
    return { changed: true, quantity: q };
  });
}

/** Kam qolgan faol mahsulotlar sharti: asosiy omborda yozuvi yo'q (0) yoki qoldig'i chegaradan kam/teng */
export function lowStockWhere(warehouseId: number, threshold: number): Prisma.ProductWhereInput {
  return {
    status: 'active',
    OR: [{ inventory: { none: { warehouseId } } }, { inventory: { some: { warehouseId, quantity: { lte: threshold } } } }],
  };
}

/** Qoldig'i chegaradan kam yoki teng bo'lgan faol mahsulotlar (yozuvi yo'qlar 0 deb olinadi) */
export async function lowStockProducts(threshold: number) {
  const main = await getMainWarehouse();
  const products = await prisma.product.findMany({
    where: lowStockWhere(main.id, threshold),
    select: { id: true, name: true, sku: true, inStock: true, inventory: { where: { warehouseId: main.id }, select: { quantity: true } } },
    orderBy: { name: 'asc' },
  });
  return products.map(({ inventory, ...p }) => ({ ...p, quantity: inventory[0]?.quantity ?? 0 }));
}

/**
 * Yetkazilgan buyurtma uchun qoldiqni kamaytirish.
 * Yetarli bo'lmasa 0 gacha kamaytiradi (xato bermaydi); qayta chaqirilsa takrorlamaydi;
 * bitta mahsulotdagi xato qolganlarini to'xtatmaydi.
 */
export async function deductForOrder(orderId: number, createdBy: string) {
  const reason = `Buyurtma #${orderId}`;
  const items = await prisma.orderItem.findMany({ where: { orderId }, select: { productId: true, quantity: true } });
  const perProduct = new Map<number, number>();
  for (const it of items) perProduct.set(it.productId, (perProduct.get(it.productId) ?? 0) + it.quantity);
  for (const [productId, qty] of perProduct) {
    try {
      const done = await prisma.stockMovement.findFirst({ where: { productId, reason, type: 'OUT' }, select: { id: true } });
      if (done) continue;
      await adjustStock({ productId, delta: -qty, reason, createdBy, type: 'OUT', clamp: true });
    } catch (e) {
      console.error('deductForOrder', orderId, productId, e);
    }
  }
}
