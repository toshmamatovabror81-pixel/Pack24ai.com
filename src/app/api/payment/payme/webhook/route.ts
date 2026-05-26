import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/money';
import { logger } from '@/lib/logger';

function getPaymeKey(): string {
    const isTest = process.env.NODE_ENV !== 'production';
    return isTest
        ? (process.env.PAYME_TEST_SECRET ?? '')
        : (process.env.PAYME_SECRET_KEY ?? '');
}

function verifyAuth(req: NextRequest): boolean {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Basic ')) return false;
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [, key] = decoded.split(':');
    return key === getPaymeKey();
}

interface PaymeRpcRequest {
    id: number;
    method: string;
    params: Record<string, unknown>;
}

function rpcError(id: number, code: number, message: string) {
    return NextResponse.json({ id, error: { code, message: { uz: message, ru: message, en: message } } });
}

function rpcResult(id: number, result: Record<string, unknown>) {
    return NextResponse.json({ id, result });
}

function accountOrderId(params: Record<string, unknown>): number {
    return parseInt(String((params.account as Record<string, unknown>)?.order_id ?? '0'), 10);
}

export async function POST(req: NextRequest) {
    if (!verifyAuth(req)) {
        return rpcError(0, -32504, 'Auth failed');
    }

    const body: PaymeRpcRequest = await req.json();
    const { id, method, params } = body;

    try {
        switch (method) {
            case 'CheckPerformTransaction': {
                const orderId = accountOrderId(params);
                const amount = Number(params.amount ?? 0);
                const order = await prisma.order.findUnique({ where: { id: orderId } });
                if (!order) return rpcError(id, -31050, 'Buyurtma topilmadi');
                if (order.paymentStatus === 'paid') return rpcError(id, -31051, 'Allaqachon tolangan');
                const expectedAmount = Math.round(toNumber(order.totalAmount) * 100);
                if (Math.abs(expectedAmount - amount) > 1) return rpcError(id, -31001, 'Summa mos kelmaydi');
                return rpcResult(id, { allow: true });
            }
            case 'CreateTransaction': {
                const orderId = accountOrderId(params);
                const paymeTransId = String(params.id ?? '');
                const amount = Number(params.amount ?? 0);
                const time = Number(params.time ?? Date.now());

                if (!paymeTransId) return rpcError(id, -31008, 'Transaction ID kerak');

                const existingTx = await prisma.paymeTransaction.findUnique({ where: { id: paymeTransId } });
                if (existingTx) {
                    if (existingTx.state !== 1) {
                        return rpcError(id, -31008, 'Transaction holati noto\'g\'ri');
                    }
                    return rpcResult(id, {
                        create_time: Number(existingTx.createTime),
                        transaction: paymeTransId,
                        state: existingTx.state,
                    });
                }

                const order = await prisma.order.findUnique({ where: { id: orderId } });
                if (!order) return rpcError(id, -31050, 'Buyurtma topilmadi');
                if (order.paymentStatus === 'paid') return rpcError(id, -31051, 'Allaqachon tolangan');

                const expectedAmount = Math.round(toNumber(order.totalAmount) * 100);
                if (Math.abs(expectedAmount - amount) > 1) return rpcError(id, -31001, 'Summa mos kelmaydi');

                const createTime = BigInt(time);
                await prisma.$transaction([
                    prisma.paymeTransaction.create({
                        data: {
                            id: paymeTransId,
                            orderId,
                            amount,
                            state: 1,
                            createTime,
                        },
                    }),
                    prisma.order.update({
                        where: { id: orderId },
                        data: { paymentStatus: 'pending', paymentMethod: 'payme' },
                    }),
                ]);

                return rpcResult(id, {
                    create_time: time,
                    transaction: paymeTransId,
                    state: 1,
                });
            }
            case 'PerformTransaction': {
                const paymeTransId = String(params.id ?? '');
                const tx = await prisma.paymeTransaction.findUnique({ where: { id: paymeTransId } });
                if (!tx) return rpcError(id, -31003, 'Transaction topilmadi');

                if (tx.state === 2) {
                    return rpcResult(id, {
                        transaction: paymeTransId,
                        perform_time: Number(tx.performTime ?? tx.createTime),
                        state: 2,
                    });
                }
                if (tx.state < 0) {
                    return rpcError(id, -31008, 'Transaction bekor qilingan');
                }

                const performTime = BigInt(Date.now());
                await prisma.$transaction([
                    prisma.paymeTransaction.update({
                        where: { id: paymeTransId },
                        data: { state: 2, performTime },
                    }),
                    prisma.order.update({
                        where: { id: tx.orderId },
                        data: { paymentStatus: 'paid', paymentMethod: 'payme' },
                    }),
                ]);

                logger.info({ method: 'PerformTransaction', transId: paymeTransId, orderId: tx.orderId }, 'Payme paid');
                return rpcResult(id, {
                    transaction: paymeTransId,
                    perform_time: Number(performTime),
                    state: 2,
                });
            }
            case 'CancelTransaction': {
                const paymeTransId = String(params.id ?? '');
                const reason = Number(params.reason ?? 0);
                const tx = await prisma.paymeTransaction.findUnique({ where: { id: paymeTransId } });
                if (!tx) return rpcError(id, -31003, 'Transaction topilmadi');

                if (tx.state === 2) {
                    return rpcError(id, -31007, 'Transaction allaqachon bajarilgan');
                }
                if (tx.state < 0) {
                    return rpcResult(id, {
                        transaction: paymeTransId,
                        cancel_time: Number(tx.cancelTime ?? tx.createTime),
                        state: tx.state,
                    });
                }

                const cancelTime = BigInt(Date.now());
                await prisma.$transaction([
                    prisma.paymeTransaction.update({
                        where: { id: paymeTransId },
                        data: { state: -1, cancelTime, reason },
                    }),
                    prisma.order.update({
                        where: { id: tx.orderId },
                        data: { paymentStatus: 'pending' },
                    }),
                ]);

                logger.info({ method: 'CancelTransaction', transId: paymeTransId, reason }, 'Payme cancel');
                return rpcResult(id, {
                    transaction: paymeTransId,
                    cancel_time: Number(cancelTime),
                    state: -1,
                });
            }
            case 'CheckTransaction': {
                const paymeTransId = String(params.id ?? '');
                const tx = await prisma.paymeTransaction.findUnique({ where: { id: paymeTransId } });
                if (!tx) return rpcError(id, -31003, 'Transaction topilmadi');

                return rpcResult(id, {
                    transaction: paymeTransId,
                    create_time: Number(tx.createTime),
                    perform_time: tx.performTime != null ? Number(tx.performTime) : 0,
                    cancel_time: tx.cancelTime != null ? Number(tx.cancelTime) : 0,
                    state: tx.state,
                    reason: tx.reason,
                });
            }
            default:
                return rpcError(id, -32601, 'Method not found');
        }
    } catch (error) {
        logger.error({ error, method }, 'Payme webhook error');
        return rpcError(id, -32400, 'Internal error');
    }
}
