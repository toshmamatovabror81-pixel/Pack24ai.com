import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { buildQuote, type CartInput } from './quote';
import type { Locale } from './i18n/config';
import { parseAttribution, UTM_COOKIE } from './utm';
import { notifyAdmins } from './telegram';
import { displayPhone, formatPrice } from './format';
import { siteUrl } from './site';
import { paymeConfigured, paymeUrl } from './payments/payme';
import { clickConfigured, clickUrl } from './payments/click';

export type CheckoutInput = {
  locale: Locale;
  items: CartInput;
  name: string;
  phone: string; // normallashtirilgan, 998XXXXXXXXX
  company?: string;
  deliveryMethod: 'courier' | 'pickup';
  address?: string;
  comment?: string;
  paymentMethod: 'cash' | 'payme' | 'click' | 'bank_transfer';
  promoCode?: string;
  userId?: number | null;
};

export function availablePaymentMethods() {
  const methods: CheckoutInput['paymentMethod'][] = ['cash', 'bank_transfer'];
  if (paymeConfigured()) methods.unshift('payme');
  if (clickConfigured()) methods.splice(paymeConfigured() ? 1 : 0, 0, 'click');
  return methods;
}

export function orderUrl(locale: Locale, token: string) {
  return `${siteUrl()}/${locale}/orders/${token}`;
}

export function paymentUrl(order: { id: number; totalAmount: Prisma.Decimal | number; paymentMethod: string | null; accessToken: string | null }, locale: Locale) {
  const amount = Number(order.totalAmount.toString());
  const back = orderUrl(locale, order.accessToken ?? '');
  if (order.paymentMethod === 'payme' && paymeConfigured()) return paymeUrl(order.id, amount, back);
  if (order.paymentMethod === 'click' && clickConfigured()) return clickUrl(order.id, amount, back);
  return null;
}

export class CheckoutError extends Error {
  constructor(public code: 'empty' | 'promo' | 'payment') {
    super(code);
  }
}

export async function createOrder(input: CheckoutInput) {
  if (!availablePaymentMethods().includes(input.paymentMethod)) throw new CheckoutError('payment');
  const quote = await buildQuote(input.items, { locale: input.locale, promoCode: input.promoCode, deliveryMethod: input.deliveryMethod });
  if (!quote.lines.length) throw new CheckoutError('empty');
  if (quote.promoError) throw new CheckoutError('promo');

  const attribution = parseAttribution((await cookies()).get(UTM_COOKIE)?.value);
  const token = randomBytes(18).toString('base64url');

  const order = await prisma.$transaction(async (tx) => {
    if (quote.promo) {
      // Foydalanish soni chegarasidan oshmasligi uchun shartli yangilash
      const updated = await tx.$executeRaw`UPDATE "PromoCode" SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
        WHERE "code" = ${quote.promo.code} AND "isActive" = true AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;
      if (updated !== 1) throw new CheckoutError('promo');
    }
    return tx.order.create({
      data: {
        userId: input.userId ?? null,
        customerName: input.company ? `${input.name} (${input.company})` : input.name,
        contactPhone: input.phone,
        status: 'new_',
        paymentStatus: 'pending',
        paymentMethod: input.paymentMethod,
        deliveryMethod: input.deliveryMethod,
        shippingAddress: input.deliveryMethod === 'courier' ? input.address : null,
        comment: input.comment || null,
        subtotal: quote.subtotal,
        discountAmount: quote.discount,
        deliveryFee: quote.delivery,
        totalAmount: quote.total,
        promoCode: quote.promo?.code ?? null,
        accessToken: token,
        source: 'web',
        ...attribution,
        items: { create: quote.lines.map((l) => ({ productId: l.productId, quantity: l.qty, price: l.unitPrice })) },
      },
    });
  });

  await notifyAdmins([
    `🛒 Yangi buyurtma #${order.id}`,
    `${input.name}${input.company ? `, ${input.company}` : ''}`,
    displayPhone(input.phone),
    `Summa: ${formatPrice(quote.total, "so'm")} (${input.paymentMethod})`,
    input.deliveryMethod === 'courier' ? `Manzil: ${input.address}` : 'Olib ketish',
    ...quote.lines.map((l) => `• ${l.name} × ${l.qty}`),
    attribution.utmSource ? `Manba: ${attribution.utmSource}/${attribution.utmMedium ?? ''}` : null,
    `${siteUrl()}/admin/orders/${order.id}`,
  ]);

  return { order, payUrl: paymentUrl(order, input.locale), viewUrl: `/${input.locale}/orders/${token}` };
}
