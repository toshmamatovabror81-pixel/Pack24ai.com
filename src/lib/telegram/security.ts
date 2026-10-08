import 'server-only';
import { timingSafeEqual } from 'node:crypto';

/** Webhook so'rovi haqiqatan Telegram'dan kelganini tekshirish: secret_token sarlavhasi .env dagi bilan bir xil bo'lishi shart */
export function webhookSecret(): string | null {
  const s = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  return s.length >= 16 ? s : null;
}

export function verifyWebhook(req: Request): boolean {
  const secret = webhookSecret();
  if (!secret) return false; // sozlanmagan bo'lsa hech qachon qabul qilmaymiz
  const got = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Webhook o'rnatish kabi texnik amallar: admin sessiyasi yoki Bearer TELEGRAM_OPS_SECRET */
export function verifyOpsBearer(req: Request): boolean {
  const s = (process.env.TELEGRAM_OPS_SECRET ?? '').trim();
  if (s.length < 16) return false;
  const h = req.headers.get('authorization') ?? '';
  if (!h.startsWith('Bearer ')) return false;
  const a = Buffer.from(h.slice(7).trim());
  const b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b);
}
