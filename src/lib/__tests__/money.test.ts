import { Prisma } from '@prisma/client';
import {
    toDecimal,
    toNumber,
    mul,
    add,
    roundUZS,
    fmtMoneyUZS,
    serializeMoney,
} from '@/lib/money';

describe('money helpers', () => {
    it('toDecimal converts numbers and strings', () => {
        expect(toDecimal(100).equals(new Prisma.Decimal(100))).toBe(true);
        expect(toDecimal('250.5').equals(new Prisma.Decimal('250.5'))).toBe(true);
        expect(toDecimal(null).equals(new Prisma.Decimal(0))).toBe(true);
    });

    it('toNumber converts Decimal back', () => {
        expect(toNumber(new Prisma.Decimal('1234.56'))).toBe(1234.56);
        expect(toNumber(undefined)).toBe(0);
    });

    it('mul and add work with Decimal', () => {
        expect(mul(800, 12.5).toNumber()).toBe(10000);
        expect(add(100, 200, 300).toNumber()).toBe(600);
    });

    it('roundUZS rounds to integer som', () => {
        expect(roundUZS(1234.7).toNumber()).toBe(1235);
    });

    it('fmtMoneyUZS formats for display', () => {
        expect(fmtMoneyUZS(1000)).toMatch(/1/);
    });

    it('serializeMoney converts Decimal fields to number', () => {
        const input = {
            id: 1,
            price: new Prisma.Decimal('15000.50'),
            name: 'Test',
            nested: { totalAmount: new Prisma.Decimal(500) },
        };
        const out = serializeMoney(input);
        expect(out.price).toBe(15000.5);
        expect(out.nested.totalAmount).toBe(500);
        expect(typeof out.price).toBe('number');
    });
});
