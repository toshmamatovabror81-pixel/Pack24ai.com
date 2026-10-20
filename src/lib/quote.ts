import 'server-only';
import { prisma } from './db';
import { toNumber } from './format';
import { pickText, type Locale } from './i18n/config';
import { deliveryFee, parseTiers, promoDiscount, unitPrice, type Promo } from './pricing';
import { getSettings } from './settings';

export type CartInput = { productId: number; qty: number }[];

export type QuoteLine = {
  productId: number;
  name: string;
  image: string;
  qty: number;
  minQuantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Quote = {
  lines: QuoteLine[];
  missing: number[]; // sotuvda yo'q mahsulotlar
  subtotal: number;
  discount: number;
  promo: Promo | null;
  promoError: boolean;
  delivery: number;
  total: number;
};

export function sanitizeCart(raw: unknown): CartInput {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<number, number>();
  for (const item of raw.slice(0, 100)) {
    const o = (item ?? {}) as Record<string, unknown>;
    const id = Math.floor(Number(o.productId));
    const qty = Math.floor(Number(o.qty));
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(qty) || qty <= 0) continue;
    merged.set(id, Math.min(1_000_000, (merged.get(id) ?? 0) + qty));
  }
  return [...merged].map(([productId, qty]) => ({ productId, qty }));
}

export async function findPromo(code: string | undefined | null): Promise<Promo | null> {
  const c = code?.trim().toUpperCase();
  if (!c) return null;
  const now = new Date();
  const p = await prisma.promoCode.findUnique({ where: { code: c } });
  if (!p || !p.isActive) return null;
  if (p.startsAt && p.startsAt > now) return null;
  if (p.endsAt && p.endsAt < now) return null;
  if (p.maxUses != null && p.usedCount >= p.maxUses) return null;
  return { code: p.code, type: p.type, value: toNumber(p.value), minSubtotal: toNumber(p.minSubtotal) };
}

/** Narxlar faqat bazadan hisoblanadi: brauzer yuborgan narxga hech qachon ishonilmaydi */
export async function buildQuote(
  items: CartInput,
  opts: { locale: Locale; promoCode?: string | null; deliveryMethod?: 'courier' | 'pickup' },
): Promise<Quote> {
  const ids = items.map((i) => i.productId);
  const products = ids.length
    ? await prisma.product.findMany({ where: { id: { in: ids }, status: 'active' } })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: QuoteLine[] = [];
  const missing: number[] = [];
  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) {
      missing.push(item.productId);
      continue;
    }
    const qty = Math.max(item.qty, p.minQuantity);
    const price = unitPrice(toNumber(p.price), parseTiers(p.priceTiers), qty);
    lines.push({
      productId: p.id,
      name: pickText(p.nameI18n, opts.locale, p.name),
      image: p.image || '/images/no-image.svg',
      qty,
      minQuantity: p.minQuantity,
      unitPrice: price,
      lineTotal: Math.round(price * qty * 100) / 100,
    });
  }
  const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  const promo = await findPromo(opts.promoCode);
  const promoError = !!opts.promoCode?.trim() && (!promo || subtotal < promo.minSubtotal);
  const discount = promoDiscount(subtotal, promo);
  const settings = await getSettings();
  const delivery = lines.length
    ? deliveryFee(subtotal - discount, opts.deliveryMethod ?? 'courier', settings.deliveryFee, settings.freeDeliveryFrom)
    : 0;
  return {
    lines,
    missing,
    subtotal,
    discount,
    promo: promoError ? null : promo,
    promoError,
    delivery,
    total: Math.max(0, subtotal - discount + delivery),
  };
}
