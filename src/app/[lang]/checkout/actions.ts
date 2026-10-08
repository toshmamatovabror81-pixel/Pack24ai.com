'use server';

import { z } from 'zod';
import { isLocale } from '@/lib/i18n/config';
import { normalizePhone } from '@/lib/format';
import { sanitizeCart } from '@/lib/quote';
import { createOrder, CheckoutError } from '@/lib/orders';
import { currentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

const schema = z.object({
  locale: z.string().refine(isLocale),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30),
  company: z.string().trim().max(150).optional().default(''),
  deliveryMethod: z.enum(['courier', 'pickup']),
  address: z.string().trim().max(500).optional().default(''),
  comment: z.string().trim().max(1000).optional().default(''),
  paymentMethod: z.enum(['cash', 'payme', 'click', 'bank_transfer']),
  promoCode: z.string().trim().max(40).optional().default(''),
  items: z.array(z.object({ productId: z.number(), qty: z.number() })).max(100),
});

export type CheckoutResult =
  | { ok: true; redirect: string; orderId: number; total: number }
  | { ok: false; error: 'validation' | 'phone' | 'address' | 'empty' | 'promo' | 'payment' | 'rate' | 'server' };

export async function placeOrder(raw: unknown): Promise<CheckoutResult> {
  if (!(await rateLimit('checkout', 10, 10 * 60_000))) return { ok: false, error: 'rate' };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { ok: false, error: 'phone' };
  if (d.deliveryMethod === 'courier' && d.address.length < 5) return { ok: false, error: 'address' };
  const user = await currentUser().catch(() => null);
  try {
    const { order, payUrl, viewUrl } = await createOrder({
      locale: d.locale as 'uz' | 'ru' | 'en',
      items: sanitizeCart(d.items),
      name: d.name,
      phone,
      company: d.company || undefined,
      deliveryMethod: d.deliveryMethod,
      address: d.address,
      comment: d.comment,
      paymentMethod: d.paymentMethod,
      promoCode: d.promoCode || undefined,
      userId: user && user.role === 'user' ? user.id : null,
    });
    return { ok: true, redirect: payUrl ?? viewUrl, orderId: order.id, total: Number(order.totalAmount) };
  } catch (err) {
    if (err instanceof CheckoutError) return { ok: false, error: err.code };
    console.error('placeOrder', err);
    return { ok: false, error: 'server' };
  }
}
