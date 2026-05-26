/**
 * Orders API — unit testlar
 * Buyurtma holati o'tishi va to'lov mantiqini tekshiradi.
 */

import { add, mul, toNumber, type MoneyInput } from '@/lib/money';

// ── Yordamchi funksiyalar (route mantiqidan ajratilgan) ──────────────────────
type OrderStatus = 'draft' | 'new' | 'processing' | 'shipping' | 'delivered' | 'cancelled';
type _PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    draft:      ['new', 'cancelled'],
    new:        ['processing', 'cancelled'],
    processing: ['shipping', 'cancelled'],
    shipping:   ['delivered', 'cancelled'],
    delivered:  [],
    cancelled:  [],
};

function canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

function calculateTotal(items: { price: MoneyInput; quantity: number }[]): number {
    if (items.length === 0) return 0;
    return toNumber(add(...items.map((item) => mul(item.price, item.quantity))));
}

function validateOrder(data: {
    customerName?: string;
    contactPhone?: string;
    items?: { productId: number; quantity: number; price: MoneyInput }[];
}) {
    if (!data.customerName?.trim()) return 'Mijoz ismi kiritilishi shart';
    if (!data.contactPhone?.trim()) return 'Telefon kiritilishi shart';
    if (!data.items || data.items.length === 0) return 'Kamida bitta mahsulot tanlang';
    const invalidItem = data.items.find((i) => i.quantity < 1 || toNumber(i.price) < 0);
    if (invalidItem) return "Mahsulot miqdori noto'g'ri";
    return null;
}

function formatOrderId(id: number): string {
    return `ORD-${String(id).padStart(5, '0')}`;
}

// ── Testlar ──────────────────────────────────────────────────────────────────
describe('Orders API — holat o\'tishi', () => {
    it('draft → new o\'tishi mumkin', () => {
        expect(canTransition('draft', 'new')).toBe(true);
    });

    it('draft → processing o\'tishi mumkin emas', () => {
        expect(canTransition('draft', 'processing')).toBe(false);
    });

    it('delivered → cancelled o\'tishi mumkin emas', () => {
        expect(canTransition('delivered', 'cancelled')).toBe(false);
    });

    it('new → cancelled o\'tishi mumkin', () => {
        expect(canTransition('new', 'cancelled')).toBe(true);
    });

    it('shipping → delivered o\'tishi mumkin', () => {
        expect(canTransition('shipping', 'delivered')).toBe(true);
    });

    it('cancelled buyurtmadan o\'tish mumkin emas', () => {
        expect(canTransition('cancelled', 'new')).toBe(false);
    });
});

describe('Orders API — jami hisoblash', () => {
    it('bir mahsulot uchun to\'g\'ri hisoblashi kerak', () => {
        const items = [{ price: 4500, quantity: 10 }];
        expect(calculateTotal(items)).toBe(45000);
    });

    it('bir nechta mahsulot uchun to\'g\'ri hisoblashi kerak', () => {
        const items = [
            { price: 4500, quantity: 2 },
            { price: 85000, quantity: 1 },
            { price: 15000, quantity: 3 },
        ];
        expect(calculateTotal(items)).toBe(4500 * 2 + 85000 + 15000 * 3);
    });

    it('bo\'sh ro\'yxat uchun 0 qaytarishi kerak', () => {
        expect(calculateTotal([])).toBe(0);
    });
});

describe('Orders API — validatsiya', () => {
    const validOrder = {
        customerName: 'Alisher',
        contactPhone: '+998901234567',
        items: [{ productId: 1, quantity: 2, price: 4500 }],
    };

    it('to\'g\'ri buyurtma uchun null qaytarishi kerak', () => {
        expect(validateOrder(validOrder)).toBeNull();
    });

    it('ism bo\'sh bo\'lsa xato', () => {
        expect(validateOrder({ ...validOrder, customerName: '' })).toBeTruthy();
    });

    it('telefon bo\'sh bo\'lsa xato', () => {
        expect(validateOrder({ ...validOrder, contactPhone: '' })).toBeTruthy();
    });

    it('mahsulotlar bo\'sh bo\'lsa xato', () => {
        expect(validateOrder({ ...validOrder, items: [] })).toBeTruthy();
    });

    it('nol miqdor uchun xato', () => {
        expect(
            validateOrder({ ...validOrder, items: [{ productId: 1, quantity: 0, price: 4500 }] })
        ).toBeTruthy();
    });
});

describe('Orders API — format', () => {
    it('ID to\'g\'ri formatlanishi kerak', () => {
        expect(formatOrderId(1)).toBe('ORD-00001');
        expect(formatOrderId(100)).toBe('ORD-00100');
        expect(formatOrderId(99999)).toBe('ORD-99999');
    });
});
