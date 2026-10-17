import type { Prisma } from '@prisma/client';

export type PriceTier = { minQty: number; price: number };

export function parseTiers(value: Prisma.JsonValue | unknown): PriceTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      return { minQty: Math.floor(Number(o.minQty)), price: Number(o.price) };
    })
    .filter((t) => Number.isFinite(t.minQty) && t.minQty > 1 && Number.isFinite(t.price) && t.price > 0)
    .sort((a, b) => a.minQty - b.minQty);
}

/** Miqdorga qarab dona narxi: eng katta mos pog'ona */
export function unitPrice(basePrice: number, tiers: PriceTier[], qty: number): number {
  let price = basePrice;
  for (const t of tiers) if (qty >= t.minQty && t.price < price) price = t.price;
  return price;
}

export type Promo = {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal: number;
};

export function promoDiscount(subtotal: number, promo: Promo | null): number {
  if (!promo || subtotal < promo.minSubtotal) return 0;
  const raw = promo.type === 'percent' ? (subtotal * Math.min(promo.value, 100)) / 100 : promo.value;
  return Math.max(0, Math.min(subtotal, Math.round(raw)));
}

export function deliveryFee(subtotalAfterDiscount: number, method: 'courier' | 'pickup', fee: number, freeFrom: number): number {
  if (method === 'pickup') return 0;
  if (freeFrom > 0 && subtotalAfterDiscount >= freeFrom) return 0;
  return Math.max(0, fee);
}
