/** @jest-environment node */

const getServerSessionMock = jest.fn();
const requireAdminMock = jest.fn();
const orderFindUniqueMock = jest.fn();
const orderUpdateMock = jest.fn();

jest.mock('next-auth', () => ({
    __esModule: true,
    default: jest.fn(),
    getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('@/lib/auth/guards', () => ({
    requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

jest.mock('@/lib/telegram/notifier', () => ({
    notifyCustomer: jest.fn(),
    notifySalesChats: jest.fn(),
}));

jest.mock('@/lib/domain/stockValidation', () => ({
    restoreStockForOrder: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
    prisma: {
        order: {
            findUnique: (...args: unknown[]) => orderFindUniqueMock(...args),
            update: (...args: unknown[]) => orderUpdateMock(...args),
        },
    },
}));

import { GET, PUT } from '@/app/api/orders/[id]/route';

const params = { params: Promise.resolve({ id: '5' }) };

function putRequest(body: unknown) {
    return new Request('http://localhost/api/orders/5', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('/api/orders/[id] access control', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getServerSessionMock.mockResolvedValue(null);
        // requireAdmin xato tashlamaydi, { ok: false } qaytaradi
        requireAdminMock.mockResolvedValue({ ok: false, reason: 'no_admin_token', response: null });
        orderFindUniqueMock.mockResolvedValue({ id: 5, userId: 7, contactPhone: '+998901112233', status: 'new_' });
        orderUpdateMock.mockImplementation(({ data }) => Promise.resolve({ id: 5, ...data }));
    });

    it('login qilmagan foydalanuvchiga boshqa buyurtmani ko\'rsatmaydi', async () => {
        const res = await GET(new Request('http://localhost/api/orders/5'), params);
        expect(res.status).toBe(403);
    });

    it('login qilmagan foydalanuvchi yakunlangan buyurtmani o\'zgartira olmaydi', async () => {
        const res = await PUT(putRequest({ paymentStatus: 'paid', totalAmount: 1 }), params);
        expect(res.status).toBe(403);
        expect(orderUpdateMock).not.toHaveBeenCalled();
    });

    it('admin faqat ruxsat etilgan maydonlarni yangilaydi', async () => {
        requireAdminMock.mockResolvedValue({ ok: true, source: 'cookie' });
        const res = await PUT(putRequest({ status: 'processing', totalAmount: 1, userId: 99 }), params);
        expect(res.status).toBe(200);
        expect(orderUpdateMock.mock.calls[0][0].data).toEqual({ status: 'processing' });
    });

    it('mehmon draft buyurtmani yakunlay oladi, lekin to\'lov statusini o\'zgartira olmaydi', async () => {
        orderFindUniqueMock.mockResolvedValue({ id: 5, userId: null, contactPhone: null, status: 'draft' });
        const res = await PUT(putRequest({ paymentMethod: 'cash', status: 'new', paymentStatus: 'paid' }), params);
        expect(res.status).toBe(200);
        expect(orderUpdateMock.mock.calls[0][0].data).toEqual({ paymentMethod: 'cash', status: 'new_' });
    });

    it('buyurtma egasi statusni "delivered" ga o\'zgartira olmaydi', async () => {
        getServerSessionMock.mockResolvedValue({ user: { id: '7', role: 'user' } });
        const res = await PUT(putRequest({ status: 'delivered' }), params);
        expect(res.status).toBe(403);
        expect(orderUpdateMock).not.toHaveBeenCalled();
    });
});
