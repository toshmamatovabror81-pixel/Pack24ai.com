import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/format';
import { notifyAdmins } from '@/lib/telegram';
import { PAYME_TIMEOUT_MS, PaymeError, paymeAuthorized } from '@/lib/payments/payme';

// Payme Merchant API (JSON-RPC). Kassa sozlamasida endpoint: https://pack24.uz/api/payment/payme/webhook

type Rpc = { id?: number; method?: string; params?: Record<string, unknown> };

const err = (id: number | undefined, code: number, message: string, data?: string) =>
  NextResponse.json({ id: id ?? null, error: { code, message: { uz: message, ru: message, en: message }, data } });
const ok = (id: number | undefined, result: Record<string, unknown>) => NextResponse.json({ id: id ?? null, result });

function orderIdOf(params: Record<string, unknown>) {
  const acc = (params.account ?? {}) as Record<string, unknown>;
  const n = Number(acc.order_id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

type CheckErr = [number, string, string?];

async function checkOrder(params: Record<string, unknown>): Promise<{ error: CheckErr; order?: undefined } | { error?: undefined; order: NonNullable<Awaited<ReturnType<typeof prisma.order.findUnique>>> }> {
  const orderId = orderIdOf(params);
  if (!orderId) return { error: [PaymeError.orderNotFound, 'Buyurtma topilmadi', 'order_id'] };
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.deletedAt) return { error: [PaymeError.orderNotFound, 'Buyurtma topilmadi', 'order_id'] };
  if (order.paymentStatus === 'paid' || order.status === 'cancelled') return { error: [PaymeError.orderUnavailable, "Buyurtmani to'lab bo'lmaydi", 'order_id'] };
  const expected = Math.round(toNumber(order.totalAmount) * 100);
  if (Number(params.amount) !== expected) return { error: [PaymeError.amount, "Summa noto'g'ri"] };
  return { order };
}

export async function POST(req: NextRequest) {
  if (!paymeAuthorized(req.headers.get('authorization'))) return err(undefined, PaymeError.auth, 'Ruxsat yo\'q');
  let body: Rpc;
  try {
    body = (await req.json()) as Rpc;
  } catch {
    return err(undefined, PaymeError.parse, 'Parse error');
  }
  const { id, method } = body;
  const params = body.params ?? {};

  try {
    switch (method) {
      case 'CheckPerformTransaction': {
        const r = await checkOrder(params);
        if (r.error) return err(id, ...r.error);
        return ok(id, { allow: true });
      }

      case 'CreateTransaction': {
        const txId = String(params.id ?? '');
        if (!txId) return err(id, PaymeError.cannotPerform, 'Tranzaksiya ID yo\'q');
        const existing = await prisma.paymeTransaction.findUnique({ where: { id: txId } });
        if (existing) {
          if (existing.state !== 1) return err(id, PaymeError.cannotPerform, 'Tranzaksiya holati noto\'g\'ri');
          if (Date.now() - Number(existing.createTime) > PAYME_TIMEOUT_MS) {
            await prisma.paymeTransaction.update({ where: { id: txId }, data: { state: -1, reason: 4, cancelTime: BigInt(Date.now()) } });
            return err(id, PaymeError.cannotPerform, 'Tranzaksiya muddati o\'tgan');
          }
          return ok(id, { create_time: Number(existing.createTime), transaction: existing.id, state: 1 });
        }
        const r = await checkOrder(params);
        if (r.error) return err(id, ...r.error);
        // Bitta buyurtmaga faqat bitta ochiq tranzaksiya
        const pending = await prisma.paymeTransaction.findFirst({ where: { orderId: r.order.id, state: 1 } });
        if (pending) return err(id, PaymeError.orderUnavailable, 'Buyurtma uchun boshqa tranzaksiya kutilmoqda', 'order_id');
        const time = Number(params.time) || Date.now();
        await prisma.paymeTransaction.create({ data: { id: txId, orderId: r.order.id, amount: Number(params.amount), state: 1, createTime: BigInt(time) } });
        await prisma.order.update({ where: { id: r.order.id }, data: { paymentMethod: 'payme', paymentStatus: 'processing' } });
        return ok(id, { create_time: time, transaction: txId, state: 1 });
      }

      case 'PerformTransaction': {
        const txId = String(params.id ?? '');
        const tx = await prisma.paymeTransaction.findUnique({ where: { id: txId } });
        if (!tx) return err(id, PaymeError.txNotFound, 'Tranzaksiya topilmadi');
        if (tx.state === 2) return ok(id, { transaction: tx.id, perform_time: Number(tx.performTime), state: 2 });
        if (tx.state !== 1) return err(id, PaymeError.cannotPerform, 'Tranzaksiya bekor qilingan');
        if (Date.now() - Number(tx.createTime) > PAYME_TIMEOUT_MS) {
          await prisma.paymeTransaction.update({ where: { id: txId }, data: { state: -1, reason: 4, cancelTime: BigInt(Date.now()) } });
          return err(id, PaymeError.cannotPerform, 'Tranzaksiya muddati o\'tgan');
        }
        const performTime = BigInt(Date.now());
        await prisma.$transaction([
          prisma.paymeTransaction.update({ where: { id: txId }, data: { state: 2, performTime } }),
          prisma.order.update({ where: { id: tx.orderId }, data: { paymentStatus: 'paid', paymentMethod: 'payme', confirmedAt: new Date() } }),
        ]);
        await notifyAdmins([`✅ Payme: buyurtma #${tx.orderId} to'landi (${tx.amount / 100} so'm)`]);
        return ok(id, { transaction: txId, perform_time: Number(performTime), state: 2 });
      }

      case 'CancelTransaction': {
        const txId = String(params.id ?? '');
        const reason = Number(params.reason) || null;
        const tx = await prisma.paymeTransaction.findUnique({ where: { id: txId } });
        if (!tx) return err(id, PaymeError.txNotFound, 'Tranzaksiya topilmadi');
        if (tx.state < 0) return ok(id, { transaction: tx.id, cancel_time: Number(tx.cancelTime), state: tx.state });
        if (tx.state === 2) {
          const order = await prisma.order.findUnique({ where: { id: tx.orderId } });
          if (order?.status === 'delivered') return err(id, PaymeError.cannotCancel, 'Yetkazilgan buyurtma bekor qilinmaydi');
        }
        const newState = tx.state === 2 ? -2 : -1;
        const cancelTime = BigInt(Date.now());
        await prisma.$transaction([
          prisma.paymeTransaction.update({ where: { id: txId }, data: { state: newState, cancelTime, reason } }),
          prisma.order.update({ where: { id: tx.orderId }, data: { paymentStatus: newState === -2 ? 'refunded' : 'pending' } }),
        ]);
        return ok(id, { transaction: txId, cancel_time: Number(cancelTime), state: newState });
      }

      case 'CheckTransaction': {
        const tx = await prisma.paymeTransaction.findUnique({ where: { id: String(params.id ?? '') } });
        if (!tx) return err(id, PaymeError.txNotFound, 'Tranzaksiya topilmadi');
        return ok(id, {
          create_time: Number(tx.createTime),
          perform_time: tx.performTime ? Number(tx.performTime) : 0,
          cancel_time: tx.cancelTime ? Number(tx.cancelTime) : 0,
          transaction: tx.id,
          state: tx.state,
          reason: tx.reason,
        });
      }

      case 'GetStatement': {
        const from = BigInt(Number(params.from) || 0);
        const to = BigInt(Number(params.to) || 0);
        const txs = await prisma.paymeTransaction.findMany({ where: { createTime: { gte: from, lte: to } }, orderBy: { createTime: 'asc' } });
        return ok(id, {
          transactions: txs.map((tx) => ({
            id: tx.id,
            time: Number(tx.createTime),
            amount: tx.amount,
            account: { order_id: String(tx.orderId) },
            create_time: Number(tx.createTime),
            perform_time: tx.performTime ? Number(tx.performTime) : 0,
            cancel_time: tx.cancelTime ? Number(tx.cancelTime) : 0,
            transaction: tx.id,
            state: tx.state,
            reason: tx.reason,
          })),
        });
      }

      default:
        return err(id, PaymeError.method, 'Method not found');
    }
  } catch (e) {
    console.error('Payme webhook', method, e);
    return err(id, PaymeError.internal, 'Internal error');
  }
}
