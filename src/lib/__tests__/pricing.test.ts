import { describe, expect, it } from 'vitest';
import { deliveryFee, parseTiers, promoDiscount, unitPrice } from '../pricing';

describe('pricing', () => {
  it('ulgurji pog\'ona: eng katta mos pog\'ona narxi', () => {
    const tiers = parseTiers([{ minQty: 100, price: '900' }, { minQty: 500, price: 800 }, { minQty: 1, price: 1 }, 'x']);
    expect(tiers).toEqual([{ minQty: 100, price: 900 }, { minQty: 500, price: 800 }]);
    expect(unitPrice(1000, tiers, 99)).toBe(1000);
    expect(unitPrice(1000, tiers, 100)).toBe(900);
    expect(unitPrice(1000, tiers, 5000)).toBe(800);
  });

  it('promokod: foiz, qat\'iy summa, minimal summa', () => {
    expect(promoDiscount(200_000, { code: 'A', type: 'percent', value: 10, minSubtotal: 0 })).toBe(20_000);
    expect(promoDiscount(200_000, { code: 'A', type: 'percent', value: 150, minSubtotal: 0 })).toBe(200_000);
    expect(promoDiscount(50_000, { code: 'B', type: 'fixed', value: 80_000, minSubtotal: 0 })).toBe(50_000);
    expect(promoDiscount(50_000, { code: 'C', type: 'fixed', value: 10_000, minSubtotal: 100_000 })).toBe(0);
    expect(promoDiscount(50_000, null)).toBe(0);
  });

  it('yetkazib berish: olib ketish bepul, chegaradan yuqori bepul', () => {
    expect(deliveryFee(10_000, 'pickup', 30_000, 1_000_000)).toBe(0);
    expect(deliveryFee(10_000, 'courier', 30_000, 1_000_000)).toBe(30_000);
    expect(deliveryFee(1_000_000, 'courier', 30_000, 1_000_000)).toBe(0);
    expect(deliveryFee(1_000_000, 'courier', 30_000, 0)).toBe(30_000);
  });
});
