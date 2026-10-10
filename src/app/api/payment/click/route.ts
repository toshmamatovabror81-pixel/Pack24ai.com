import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/format';
import { notifyAdmins } from '@/lib/telegram';
import { clickSignatureValid, type ClickParams } from '@/lib/payments/click';
import { recordPayment } from '@/lib/payments/record';

// Click Shop API: PREPARE (action=0) va COMPLETE (action=1). Kabinetda ikkala URL ham shu manzil.

const reply = (p: Partial<ClickParams>, error: number, note: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, error, error_note: note, ...extra });

async function handle(form: URLSearchParams) {
  const p = Object.fromEntries(form.entries()) as unknown as ClickParams;
  if (!clickSignatureValid(p)) return reply(p, -1, 'SIGN CHECK FAILED');
  if (p.action !== '0' && p.action !== '1') return reply(p, -3, 'Action not found');

  const orderId = Number(p.merchant_trans_id);
  const order = Number.isSafeInteger(orderId) ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
  if (!order || order.deletedAt) return reply(p, -5, 'User does not exist');
  if (order.status === 'cancelled') return reply(p, -9, 'Transaction cancelled');

  const amountOk = Math.round(Number(p.amount) * 100) === Math.round(toNumber(order.totalAmount) * 100);
  if (!amountOk) return reply(p, -2, 'Incorrect parameter amount');

  if (p.action === '0') {
    if (order.paymentStatus === 'paid') return reply(p, -4, 'Already paid');
    return reply(p, 0, 'Success', { merchant_prepare_id: order.id });
  }

  // COMPLETE
  if (p.merchant_prepare_id !== String(order.id)) return reply(p, -6, 'Transaction does not exist');
  if (order.paymentStatus === 'paid') return reply(p, -4, 'Already paid', { merchant_confirm_id: order.id });
  if (Number(p.error) < 0) {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'failed' } });
    // Takroriy "o'tmadi" signali tarixni ko'paytirmasin
    if (order.paymentStatus !== 'failed') await recordPayment({ ...order, paymentStatus: 'failed' }, order.paymentStatus, { name: 'Click', via: 'click' });
    return reply(p, -9, 'Transaction cancelled');
  }
  // Takroriy so'rovda ikki marta "to'landi" bo'lmasligi uchun shartli yangilash
  const updated = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: { not: 'paid' } },
    data: { paymentStatus: 'paid', paymentMethod: 'click', confirmedAt: new Date() },
  });
  if (updated.count === 1) {
    await notifyAdmins([`✅ Click: buyurtma #${order.id} to'landi (${p.amount} so'm)`]);
    await recordPayment({ ...order, paymentStatus: 'paid' }, order.paymentStatus, { name: 'Click', via: 'click' });
  }
  return reply(p, 0, 'Success', { merchant_confirm_id: order.id });
}

export async function POST(req: NextRequest) {
  const form = new URLSearchParams(await req.text());
  return handle(form);
}
