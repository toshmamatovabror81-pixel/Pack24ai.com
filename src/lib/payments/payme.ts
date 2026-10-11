import { timingSafeEqual } from 'node:crypto';

export function paymeConfigured() {
  return !!process.env.PAYME_MERCHANT_ID && !!process.env.PAYME_SECRET_KEY;
}

function checkoutBase() {
  return process.env.PAYME_TEST_MODE === 'true' ? 'https://checkout.test.paycom.uz' : 'https://checkout.paycom.uz';
}

/** Payme checkout havolasi. Summa tiyinda (so'm * 100) */
export function paymeUrl(orderId: number, amountSum: number, returnUrl: string): string {
  const params = [
    `m=${process.env.PAYME_MERCHANT_ID}`,
    `ac.order_id=${orderId}`,
    `a=${Math.round(amountSum * 100)}`,
    `c=${returnUrl}`,
  ].join(';');
  return `${checkoutBase()}/${Buffer.from(params).toString('base64')}`;
}

/** Payme so'rovidagi Basic auth: login "Paycom", parol = kassa kaliti */
export function paymeAuthorized(header: string | null): boolean {
  const key = process.env.PAYME_SECRET_KEY ?? '';
  if (!key || !header?.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const idx = decoded.indexOf(':');
  if (idx < 0 || decoded.slice(0, idx) !== 'Paycom') return false;
  const a = Buffer.from(decoded.slice(idx + 1));
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const PaymeError = {
  auth: -32504,
  method: -32601,
  parse: -32700,
  internal: -32400,
  amount: -31001,
  txNotFound: -31003,
  cannotCancel: -31007,
  cannotPerform: -31008,
  orderNotFound: -31050,
  orderUnavailable: -31051,
} as const;

/** Payme tranzaksiya 12 soatdan keyin eskiradi */
export const PAYME_TIMEOUT_MS = 12 * 60 * 60 * 1000;
