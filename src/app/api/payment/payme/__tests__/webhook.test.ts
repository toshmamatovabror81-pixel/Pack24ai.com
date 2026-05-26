/** @jest-environment node */

const paymeTransactionFindUniqueMock = jest.fn();
const paymeTransactionCreateMock = jest.fn();
const orderFindUniqueMock = jest.fn();
const orderUpdateMock = jest.fn();
const transactionMock = jest.fn();

const paymeTransactionUpdateMock = jest.fn();

jest.mock('@/lib/prisma', () => ({
    prisma: {
        paymeTransaction: {
            findUnique: (...args: unknown[]) => paymeTransactionFindUniqueMock(...args),
            create: (...args: unknown[]) => paymeTransactionCreateMock(...args),
            update: (...args: unknown[]) => paymeTransactionUpdateMock(...args),
        },
        order: {
            findUnique: (...args: unknown[]) => orderFindUniqueMock(...args),
            update: (...args: unknown[]) => orderUpdateMock(...args),
        },
        $transaction: (...args: unknown[]) => transactionMock(...args),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn() },
}));

import { POST } from '@/app/api/payment/payme/webhook/route';

const TEST_SECRET = 'test-payme-secret';

function authHeader(secret = TEST_SECRET) {
    const encoded = Buffer.from(`Paycom:${secret}`).toString('base64');
    return { authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' };
}

function rpcRequest(method: string, params: Record<string, unknown>, id = 1) {
    return new Request('http://localhost/api/payment/payme/webhook', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ id, method, params }),
    }) as never;
}

describe('Payme webhook', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.PAYME_TEST_SECRET = TEST_SECRET;
        process.env.PAYME_SECRET_KEY = 'prod-secret-not-used-in-test';
        transactionMock.mockImplementation(async (ops: unknown[]) => {
            for (const op of ops) await op;
        });
    });

    it('PerformTransaction buyurtmani paid qiladi', async () => {
        paymeTransactionFindUniqueMock.mockResolvedValue({
            id: 'trans-1',
            orderId: 42,
            amount: 100000,
            state: 1,
            createTime: BigInt(1000),
            performTime: null,
            cancelTime: null,
            reason: null,
        });

        const res = await POST(rpcRequest('PerformTransaction', { id: 'trans-1' }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.result.state).toBe(2);
        expect(transactionMock).toHaveBeenCalled();
    });

    it('CheckTransaction mavjud transaction holatini qaytaradi', async () => {
        paymeTransactionFindUniqueMock.mockResolvedValue({
            id: 'trans-2',
            orderId: 7,
            amount: 50000,
            state: 2,
            createTime: BigInt(2000),
            performTime: BigInt(3000),
            cancelTime: null,
            reason: null,
        });

        const res = await POST(rpcRequest('CheckTransaction', { id: 'trans-2' }));
        const body = await res.json();
        expect(body.result.state).toBe(2);
        expect(body.result.perform_time).toBe(3000);
    });

    it('CreateTransaction yangi mapping yaratadi', async () => {
        paymeTransactionFindUniqueMock.mockResolvedValue(null);
        orderFindUniqueMock.mockResolvedValue({
            id: 10,
            paymentStatus: 'pending',
            totalAmount: 1000,
        });

        const res = await POST(rpcRequest('CreateTransaction', {
            id: 'trans-new',
            amount: 100000,
            time: 5000,
            account: { order_id: '10' },
        }));
        const body = await res.json();
        expect(body.result.state).toBe(1);
        expect(body.result.transaction).toBe('trans-new');
    });
});
