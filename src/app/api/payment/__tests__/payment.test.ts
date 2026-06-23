/** @jest-environment node */

/* ── Mock funksiyalar ─────────────────────────────────────────────────────── */
const orderFindUniqueMock = jest.fn();
const orderUpdateMock = jest.fn();
const paymeTransactionFindUniqueMock = jest.fn();
const paymeTransactionCreateMock = jest.fn();
const paymeTransactionUpdateMock = jest.fn();
const transactionMock = jest.fn();
const getServerSessionMock = jest.fn();

/* ── jest.mock() chaqiruvlari ─────────────────────────────────────────────── */
jest.mock('@/lib/prisma', () => ({
    prisma: {
        order: {
            findUnique: (...args: unknown[]) => orderFindUniqueMock(...args),
            update: (...args: unknown[]) => orderUpdateMock(...args),
        },
        paymeTransaction: {
            findUnique: (...args: unknown[]) => paymeTransactionFindUniqueMock(...args),
            create: (...args: unknown[]) => paymeTransactionCreateMock(...args),
            update: (...args: unknown[]) => paymeTransactionUpdateMock(...args),
        },
        $transaction: (...args: unknown[]) => transactionMock(...args),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/money', () => ({
    toNumber: (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? '0'))),
}));

jest.mock('@/lib/auth', () => ({
    authOptions: {},
}));

jest.mock('next-auth/next', () => ({
    getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

/* ── Route importlar ──────────────────────────────────────────────────────── */
import { GET as clickGET } from '@/app/api/payment/click/route';
import { POST as paymeWebhookPOST } from '@/app/api/payment/payme/webhook/route';

/* ── Yordamchi funksiyalar ────────────────────────────────────────────────── */
import { createHash } from 'crypto';

const CLICK_SECRET_KEY = process.env.CLICK_SECRET_KEY ?? '';
const CLICK_SERVICE_ID = process.env.CLICK_SERVICE_ID ?? '';

function clickSign(parts: string[]): string {
    return createHash('md5').update(parts.join('')).digest('hex');
}

function makeClickUrl(params: Record<string, string>): string {
    const sp = new URLSearchParams(params);
    return `http://localhost/api/payment/click?${sp.toString()}`;
}

const TEST_PAYME_SECRET = 'test-payme-secret';

function paymeAuthHeader(secret = TEST_PAYME_SECRET) {
    const encoded = Buffer.from(`Paycom:${secret}`).toString('base64');
    return { authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' };
}

function paymeRpcRequest(method: string, params: Record<string, unknown>, id = 1) {
    return new Request('http://localhost/api/payment/payme/webhook', {
        method: 'POST',
        headers: paymeAuthHeader(),
        body: JSON.stringify({ id, method, params }),
    }) as never;
}

function paymeRpcRequestNoAuth(method: string, params: Record<string, unknown>, id = 1) {
    return new Request('http://localhost/api/payment/payme/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, method, params }),
    }) as never;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  CLICK PAYMENT TESTS                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */
describe('GET /api/payment/click (webhook)', () => {
    const signTime = '2026-06-01 12:00:00';
    const clickTransId = 'click-100';
    const merchantTransId = '42';
    const amount = 500;

    function buildValidClickParams(action: string, error = '0') {
        const sign = clickSign([
            clickTransId, CLICK_SERVICE_ID, CLICK_SECRET_KEY,
            merchantTransId, amount.toString(), action, signTime,
        ]);
        return {
            click_trans_id: clickTransId,
            service_id: CLICK_SERVICE_ID,
            click_paydoc_id: 'doc-1',
            merchant_trans_id: merchantTransId,
            amount: amount.toString(),
            action,
            error,
            error_note: '',
            sign_time: signTime,
            sign_string: sign,
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('noto\'g\'ri imzo bilan error -1 qaytaradi', async () => {
        const params = buildValidClickParams('0');
        params.sign_string = 'invalid_signature';

        const res = await clickGET(
            new Request(makeClickUrl(params)) as never,
        );
        const body = await res.json();
        expect(body.error).toBe(-1);
        expect(body.error_note).toBe('SIGN CHECK FAILED');
    });

    it('buyurtma topilmasa error -5 qaytaradi', async () => {
        orderFindUniqueMock.mockResolvedValue(null);

        const res = await clickGET(
            new Request(makeClickUrl(buildValidClickParams('0'))) as never,
        );
        const body = await res.json();
        expect(body.error).toBe(-5);
        expect(body.error_note).toBe('ORDER NOT FOUND');
    });

    it('PREPARE (action=0) muvaffaqiyatli javob qaytaradi', async () => {
        orderFindUniqueMock.mockResolvedValue({
            id: 42,
            paymentStatus: 'pending',
            totalAmount: 500,
        });

        const res = await clickGET(
            new Request(makeClickUrl(buildValidClickParams('0'))) as never,
        );
        const body = await res.json();
        expect(body.error).toBe(0);
        expect(body.merchant_prepare_id).toBe(42);
        expect(body.click_trans_id).toBe(clickTransId);
    });

    it('PREPARE allaqachon to\'langan buyurtma uchun error -4 qaytaradi', async () => {
        orderFindUniqueMock.mockResolvedValue({
            id: 42,
            paymentStatus: 'paid',
            totalAmount: 500,
        });

        const res = await clickGET(
            new Request(makeClickUrl(buildValidClickParams('0'))) as never,
        );
        const body = await res.json();
        expect(body.error).toBe(-4);
        expect(body.error_note).toBe('ALREADY PAID');
    });

    it('COMPLETE (action=1) muvaffaqiyatli to\'lovni belgilaydi', async () => {
        orderFindUniqueMock.mockResolvedValue({
            id: 42,
            paymentStatus: 'pending',
            totalAmount: 500, // 500 * 100 = 50000 tiyin
        });
        orderUpdateMock.mockResolvedValue({});

        const res = await clickGET(
            new Request(makeClickUrl(buildValidClickParams('1'))) as never,
        );
        const body = await res.json();
        expect(body.error).toBe(0);
        expect(body.merchant_confirm_id).toBe(42);
        expect(orderUpdateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { paymentStatus: 'paid', status: 'processing' },
            }),
        );
    });

    it('COMPLETE summa mos kelmasa error -2 qaytaradi', async () => {
        orderFindUniqueMock.mockResolvedValue({
            id: 42,
            paymentStatus: 'pending',
            totalAmount: 999, // mos kelmaydi
        });

        const res = await clickGET(
            new Request(makeClickUrl(buildValidClickParams('1'))) as never,
        );
        const body = await res.json();
        expect(body.error).toBe(-2);
        expect(body.error_note).toBe('AMOUNT MISMATCH');
    });

    it('COMPLETE xato bilan (error < 0) buyurtmani failed qiladi', async () => {
        orderFindUniqueMock.mockResolvedValue({
            id: 42,
            paymentStatus: 'pending',
            totalAmount: 500,
        });
        orderUpdateMock.mockResolvedValue({});

        const params = buildValidClickParams('1', '-1');
        const res = await clickGET(
            new Request(makeClickUrl(params)) as never,
        );
        const body = await res.json();
        expect(body.error).toBe(0);
        expect(orderUpdateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { paymentStatus: 'failed' },
            }),
        );
    });

    it('noma\'lum action uchun error -3 qaytaradi', async () => {
        orderFindUniqueMock.mockResolvedValue({
            id: 42,
            paymentStatus: 'pending',
            totalAmount: 500,
        });

        const res = await clickGET(
            new Request(makeClickUrl(buildValidClickParams('9'))) as never,
        );
        const body = await res.json();
        expect(body.error).toBe(-3);
        expect(body.error_note).toBe('ACTION NOT FOUND');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  PAYME WEBHOOK TESTS                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */
describe('POST /api/payment/payme/webhook', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.PAYME_TEST_SECRET = TEST_PAYME_SECRET;
        process.env.PAYME_SECRET_KEY = 'prod-secret';
        transactionMock.mockImplementation(async (ops: unknown[]) => {
            for (const op of ops) await op;
        });
    });

    it('autentifikatsiya muvaffaqiyatsiz bo\'lsa error -32504 qaytaradi', async () => {
        const res = await paymeWebhookPOST(
            paymeRpcRequestNoAuth('CheckPerformTransaction', {}),
        );
        const body = await res.json();
        expect(body.error.code).toBe(-32504);
        expect(body.error.message.en).toBe('Auth failed');
    });

    it('noto\'g\'ri secret bilan error -32504 qaytaradi', async () => {
        const req = new Request('http://localhost/api/payment/payme/webhook', {
            method: 'POST',
            headers: paymeAuthHeader('wrong-secret'),
            body: JSON.stringify({ id: 1, method: 'CheckPerformTransaction', params: {} }),
        }) as never;

        const res = await paymeWebhookPOST(req);
        const body = await res.json();
        expect(body.error.code).toBe(-32504);
    });

    it('CheckPerformTransaction mavjud buyurtma uchun allow:true qaytaradi', async () => {
        orderFindUniqueMock.mockResolvedValue({
            id: 10,
            paymentStatus: 'pending',
            totalAmount: 1000,
        });

        const res = await paymeWebhookPOST(
            paymeRpcRequest('CheckPerformTransaction', {
                amount: 100000, // 1000 * 100
                account: { order_id: '10' },
            }),
        );
        const body = await res.json();
        expect(body.result.allow).toBe(true);
    });

    it('CheckPerformTransaction buyurtma topilmasa error qaytaradi', async () => {
        orderFindUniqueMock.mockResolvedValue(null);

        const res = await paymeWebhookPOST(
            paymeRpcRequest('CheckPerformTransaction', {
                amount: 100000,
                account: { order_id: '999' },
            }),
        );
        const body = await res.json();
        expect(body.error.code).toBe(-31050);
    });

    it('CheckPerformTransaction allaqachon to\'langan buyurtma uchun error qaytaradi', async () => {
        orderFindUniqueMock.mockResolvedValue({
            id: 10,
            paymentStatus: 'paid',
            totalAmount: 1000,
        });

        const res = await paymeWebhookPOST(
            paymeRpcRequest('CheckPerformTransaction', {
                amount: 100000,
                account: { order_id: '10' },
            }),
        );
        const body = await res.json();
        expect(body.error.code).toBe(-31051);
    });

    it('CreateTransaction yangi tranzaksiya yaratadi', async () => {
        paymeTransactionFindUniqueMock.mockResolvedValue(null);
        orderFindUniqueMock.mockResolvedValue({
            id: 10,
            paymentStatus: 'pending',
            totalAmount: 1000,
        });

        const res = await paymeWebhookPOST(
            paymeRpcRequest('CreateTransaction', {
                id: 'payme-tx-1',
                amount: 100000,
                time: 5000,
                account: { order_id: '10' },
            }),
        );
        const body = await res.json();
        expect(body.result.state).toBe(1);
        expect(body.result.transaction).toBe('payme-tx-1');
        expect(body.result.create_time).toBe(5000);
        expect(transactionMock).toHaveBeenCalled();
    });

    it('PerformTransaction buyurtmani paid qiladi', async () => {
        paymeTransactionFindUniqueMock.mockResolvedValue({
            id: 'payme-tx-1',
            orderId: 10,
            amount: 100000,
            state: 1,
            createTime: BigInt(5000),
            performTime: null,
            cancelTime: null,
            reason: null,
        });

        const res = await paymeWebhookPOST(
            paymeRpcRequest('PerformTransaction', { id: 'payme-tx-1' }),
        );
        const body = await res.json();
        expect(body.result.state).toBe(2);
        expect(body.result.transaction).toBe('payme-tx-1');
        expect(transactionMock).toHaveBeenCalled();
    });

    it('PerformTransaction bekor qilingan tranzaksiya uchun error qaytaradi', async () => {
        paymeTransactionFindUniqueMock.mockResolvedValue({
            id: 'payme-tx-1',
            orderId: 10,
            amount: 100000,
            state: -1,
            createTime: BigInt(5000),
            performTime: null,
            cancelTime: BigInt(6000),
            reason: 1,
        });

        const res = await paymeWebhookPOST(
            paymeRpcRequest('PerformTransaction', { id: 'payme-tx-1' }),
        );
        const body = await res.json();
        expect(body.error.code).toBe(-31008);
    });

    it('CancelTransaction kutilayotgan tranzaksiyani bekor qiladi', async () => {
        paymeTransactionFindUniqueMock.mockResolvedValue({
            id: 'payme-tx-1',
            orderId: 10,
            amount: 100000,
            state: 1,
            createTime: BigInt(5000),
            performTime: null,
            cancelTime: null,
            reason: null,
        });

        const res = await paymeWebhookPOST(
            paymeRpcRequest('CancelTransaction', { id: 'payme-tx-1', reason: 1 }),
        );
        const body = await res.json();
        expect(body.result.state).toBe(-1);
        expect(body.result.transaction).toBe('payme-tx-1');
        expect(transactionMock).toHaveBeenCalled();
    });

    it('CancelTransaction allaqachon bajarilgan tranzaksiya uchun error qaytaradi', async () => {
        orderFindUniqueMock.mockResolvedValue({
            id: 10,
            status: 'delivered',
        });
        paymeTransactionFindUniqueMock.mockResolvedValue({
            id: 'payme-tx-1',
            orderId: 10,
            amount: 100000,
            state: 2,
            createTime: BigInt(5000),
            performTime: BigInt(6000),
            cancelTime: null,
            reason: null,
        });

        const res = await paymeWebhookPOST(
            paymeRpcRequest('CancelTransaction', { id: 'payme-tx-1', reason: 1 }),
        );
        const body = await res.json();
        expect(body.error.code).toBe(-31007);
    });

    it('CheckTransaction tranzaksiya holatini qaytaradi', async () => {
        paymeTransactionFindUniqueMock.mockResolvedValue({
            id: 'payme-tx-2',
            orderId: 7,
            amount: 50000,
            state: 2,
            createTime: BigInt(2000),
            performTime: BigInt(3000),
            cancelTime: null,
            reason: null,
        });

        const res = await paymeWebhookPOST(
            paymeRpcRequest('CheckTransaction', { id: 'payme-tx-2' }),
        );
        const body = await res.json();
        expect(body.result.state).toBe(2);
        expect(body.result.perform_time).toBe(3000);
        expect(body.result.cancel_time).toBe(0);
    });

    it('noma\'lum metod uchun error -32601 qaytaradi', async () => {
        const res = await paymeWebhookPOST(
            paymeRpcRequest('UnknownMethod', {}),
        );
        const body = await res.json();
        expect(body.error.code).toBe(-32601);
        expect(body.error.message.en).toBe('Method not found');
    });

    it('tranzaksiya topilmasa error -31003 qaytaradi', async () => {
        paymeTransactionFindUniqueMock.mockResolvedValue(null);

        const res = await paymeWebhookPOST(
            paymeRpcRequest('PerformTransaction', { id: 'nonexistent' }),
        );
        const body = await res.json();
        expect(body.error.code).toBe(-31003);
    });
});
