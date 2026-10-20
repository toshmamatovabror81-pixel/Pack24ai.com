import { createHash, timingSafeEqual } from 'node:crypto';

export function clickConfigured() {
  return !!process.env.CLICK_SERVICE_ID && !!process.env.CLICK_MERCHANT_ID && !!process.env.CLICK_SECRET_KEY;
}

export function clickUrl(orderId: number, amountSum: number, returnUrl: string): string {
  const params = new URLSearchParams({
    service_id: process.env.CLICK_SERVICE_ID ?? '',
    merchant_id: process.env.CLICK_MERCHANT_ID ?? '',
    amount: amountSum.toFixed(2),
    transaction_param: String(orderId),
    return_url: returnUrl,
  });
  return `https://my.click.uz/services/pay?${params.toString()}`;
}

export type ClickParams = {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: string;
  amount: string;
  action: string;
  error: string;
  sign_time: string;
  sign_string: string;
};

export function clickSignature(p: ClickParams, secret: string): string {
  const parts =
    p.action === '1'
      ? [p.click_trans_id, p.service_id, secret, p.merchant_trans_id, p.merchant_prepare_id ?? '', p.amount, p.action, p.sign_time]
      : [p.click_trans_id, p.service_id, secret, p.merchant_trans_id, p.amount, p.action, p.sign_time];
  return createHash('md5').update(parts.join('')).digest('hex');
}

export function clickSignatureValid(p: ClickParams): boolean {
  const secret = process.env.CLICK_SECRET_KEY ?? '';
  const serviceId = process.env.CLICK_SERVICE_ID ?? '';
  if (!secret || !serviceId || p.service_id !== serviceId || !p.sign_string) return false;
  const a = Buffer.from(clickSignature(p, secret));
  const b = Buffer.from(p.sign_string.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
