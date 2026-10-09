import { describe, expect, it } from 'vitest';
import { cardTypeFromDigits, formatCardInput, weighPreview } from '@/components/driver/calc';
import { confirmState, discountReasonLabel, rejectReasonLabel, SAVED_MESSAGES } from '@/components/driver/labels';

/** Haydovchi kabineti: client kalkulyator collections.ts formulasi bilan bir xil bo'lishi kerak */
describe('haydovchi kabineti: tortish kalkulyatori', () => {
  it('chegirmasiz: jami = og\'irlik × narx, daromad = og\'irlik × stavka', () => {
    expect(weighPreview(100, 0, 800, 100)).toEqual({ weight: 100, discount: 0, effective: 100, total: 80000, earning: 10000 });
  });
  it('chegirma bilan: effektiv 2 xonagacha, jami butun', () => {
    expect(weighPreview(120.5, 10, 800, 100)).toEqual({ weight: 120.5, discount: 10, effective: 108.45, total: 86760, earning: 12050 });
    expect(weighPreview(33.33, 15, 800, 100).effective).toBe(28.33);
  });
  it('noto\'g\'ri qiymatlar: manfiy va NaN nolga, chegirma 100% dan oshmaydi', () => {
    expect(weighPreview(-5, 0, 800, 100).total).toBe(0);
    expect(weighPreview(NaN, 0, 800, 100).weight).toBe(0);
    expect(weighPreview(10, 150, 800, 100)).toMatchObject({ discount: 100, effective: 0, total: 0, earning: 1000 });
  });
});

describe('haydovchi kabineti: karta', () => {
  it('raqamni 4 talab guruhlaydi va 16 ta bilan cheklaydi', () => {
    expect(formatCardInput('8600123412341234')).toBe('8600 1234 1234 1234');
    expect(formatCardInput('8600-1234 12')).toBe('8600 1234 12');
    expect(formatCardInput('86001234123412349999')).toBe('8600 1234 1234 1234');
  });
  it('karta turini prefiksdan aniqlaydi (wallet.ts bilan bir xil)', () => {
    expect(cardTypeFromDigits('8600')).toBe('uzcard');
    expect(cardTypeFromDigits('5614')).toBe('uzcard');
    expect(cardTypeFromDigits('9860')).toBe('humo');
    expect(cardTypeFromDigits('4111')).toBe('visa');
    expect(cardTypeFromDigits('5399')).toBe('mastercard');
    expect(cardTypeFromDigits('2300')).toBe('mastercard');
    expect(cardTypeFromDigits('1234')).toBe('other');
    expect(cardTypeFromDigits('86')).toBeNull();
  });
});

describe('haydovchi kabineti: yorliqlar', () => {
  it('rad etish va chegirma sabablari', () => {
    expect(rejectReasonLabel('uzoq')).toBe('Juda uzoq');
    expect(rejectReasonLabel('yoq')).toBeNull();
    expect(discountReasonLabel('namlik')).toBe('Namlik');
  });
  it("mijoz tasdig'i qatori: yakunlangan arizada 'kutilmoqda' chiqmaydi", () => {
    expect(confirmState(null, 'collected', 'pending').kind).toBe('waiting');
    expect(confirmState(true, 'confirmed', 'pending').kind).toBe('confirmed');
    expect(confirmState(false, 'disputed', 'pending').kind).toBe('disputed');
    expect(confirmState(null, 'completed', 'paid_both').kind).toBe('closed');
    expect(confirmState(null, 'collected', 'paid_to_driver').kind).toBe('closed');
    expect(confirmState(false, 'completed', 'paid_both').kind).toBe('disputed');
  });
  it('har bir saved kaliti bo\'sh bo\'lmagan matnga ega', () => {
    for (const k of ['accept', 'reject', 'en_route', 'arrived', 'weighed', 'withdraw', 'card', 'card_removed', 'online', 'offline', 'profile']) {
      expect(SAVED_MESSAGES[k]?.trim().length).toBeGreaterThan(0);
    }
  });
});
