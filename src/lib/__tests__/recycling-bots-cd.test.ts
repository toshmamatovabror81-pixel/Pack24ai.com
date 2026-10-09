import { describe, expect, it } from 'vitest';
import { cardParts, chunk, commandArg, parseExpiry, parseNumber, stripMark, tgName } from '@/lib/telegram/bots/cdCommon';
import { BACK_TEXTS, CANCEL_TEXTS, isCustLang, menuTexts, prevStep, T } from '@/lib/telegram/bots/customerFlow';
import { D, DISCOUNT_OPTIONS, discountReasonLabel, M, prevDrvStep, REJECT_REASONS, rejectReasonLabel, weighPreview } from '@/lib/telegram/bots/driverFlow';

/** Mijoz va haydovchi botlari: sof yordamchilar (baza/Telegram'siz) */
describe('botlar: umumiy yordamchilar', () => {
  it('parseNumber: vergul, bo\'sh joy, birlik va belgilar', () => {
    expect(parseNumber('120,5')).toBe(120.5);
    expect(parseNumber('120 kg')).toBe(120);
    expect(parseNumber('💵 Hammasi: 141 250 so\'m')).toBe(141250);
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('0')).toBeNull();
    expect(parseNumber('-5')).toBeNull();
  });
  it('parseExpiry: OO/YY, OO.YYYY, 4 raqam; noto\'g\'ri oy/yil rad', () => {
    expect(parseExpiry('12/27')).toEqual({ month: 12, year: 2027 });
    expect(parseExpiry('01.2030')).toEqual({ month: 1, year: 2030 });
    expect(parseExpiry('1227')).toEqual({ month: 12, year: 2027 });
    expect(parseExpiry('13/27')).toBeNull();
    expect(parseExpiry('12/20')).toBeNull();
    expect(parseExpiry('12')).toBeNull();
  });
  it('cardParts: faqat 16 raqam; to\'liq raqam qaytmaydi', () => {
    expect(cardParts('8600 1234 5678 9012')).toEqual({ first4: '8600', last4: '9012' });
    expect(cardParts('8600 1234')).toBeNull();
    expect(JSON.stringify(cardParts('9860123456784321'))).not.toContain('12345678');
  });
  it('chunk, commandArg, tgName, stripMark', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(commandArg('/start abc123')).toBe('abc123');
    expect(commandArg('/start')).toBe('');
    expect(tgName({ first_name: 'Ali', last_name: 'Valiyev' })).toBe('Ali Valiyev');
    expect(tgName({ first_name: 'Ali' })).toBe('Ali');
    expect(stripMark('✅ Ali Valiyev')).toBe('Ali Valiyev');
    expect(stripMark('Olim')).toBe('Olim');
  });
});

describe('mijoz boti: matnlar va qadamlar', () => {
  it('ru lug\'ati uz bilan bir xil kalitlarga ega', () => {
    const keys = (o: object) => Object.keys(o).sort();
    expect(keys(T.ru)).toEqual(keys(T.uz));
    expect(keys(T.ru.menu)).toEqual(keys(T.uz.menu));
    expect(keys(T.ru.sum)).toEqual(keys(T.uz.sum));
    expect(keys(T.ru.errors)).toEqual(keys(T.uz.errors));
  });
  it('menyu tugmalari ikki tilda farqli; orqaga/bekor ikkala tilda', () => {
    expect(menuTexts('request')).toHaveLength(2);
    expect(new Set(menuTexts('request')).size).toBe(2);
    expect(BACK_TEXTS).toContain('⬅️ Orqaga');
    expect(CANCEL_TEXTS).toContain('❌ Отмена');
    expect(isCustLang('ru')).toBe(true);
    expect(isCustLang('en')).toBe(false);
  });
  it('orqaga: pickup turiga qarab rasm qadamidan joylashuv yoki turga qaytadi', () => {
    expect(prevStep('name', {})).toBe('phone');
    expect(prevStep('photo', { pickupType: 'pickup' })).toBe('location');
    expect(prevStep('photo', { pickupType: 'base' })).toBe('pickup');
    expect(prevStep('confirm', {})).toBe('photo');
    expect(prevStep('phone', {})).toBeNull();
    expect(prevStep('dispute', {})).toBeNull();
    expect(prevStep('sending', {})).toBeNull();
  });
  it('bekor qilish / eskirgan tugma matnlari ikki tilda mavjud', () => {
    for (const lang of ['uz', 'ru'] as const) {
      expect(T[lang].disputeCancelled).not.toBe(T[lang].flowCancelled);
      expect(T[lang].alreadyFinished).toBeTruthy();
      expect(T[lang].cantCancelWeighed).not.toBe(T[lang].cantCancel);
      expect(T[lang].linkedOther).toBeTruthy();
      expect(T[lang].pointPaused).toContain('⏸');
    }
  });
  it('funksiya matnlari foydalanuvchi qiymatini o\'z ichiga oladi', () => {
    expect(T.uz.created(12)).toContain('#12');
    expect(T.ru.pickupMinWarn(200, 120)).toContain('200');
    expect(T.ru.pickupMinWarn(200, 120)).toContain('120');
    expect(T.uz.errors.min_volume(250)).toContain('250');
  });
});

describe('haydovchi boti: kalkulyator va variantlar', () => {
  it('weighPreview collections.ts formulasi bilan bir xil', () => {
    expect(weighPreview(120.5, 10, 800, 100)).toEqual({ weight: 120.5, discount: 10, effective: 108.45, total: 86760, earning: 12050 });
    expect(weighPreview(130, 0, 800, 100)).toEqual({ weight: 130, discount: 0, effective: 130, total: 104000, earning: 13000 });
    expect(weighPreview(80, 5, 800, 100)).toEqual({ weight: 80, discount: 5, effective: 76, total: 60800, earning: 8000 });
    expect(weighPreview(-1, 150, 800, 100)).toMatchObject({ weight: 0, discount: 100, total: 0 });
  });
  it('rad etish va chegirma sabablari; chegirma variantlari', () => {
    expect(REJECT_REASONS.map((r) => r.key)).toEqual(['band', 'uzoq', 'mashina', 'boshqa']);
    expect(rejectReasonLabel('uzoq')).toBe('Juda uzoq');
    expect(rejectReasonLabel('x')).toBeNull();
    expect(discountReasonLabel('namlik')).toBe('Namlik');
    expect(DISCOUNT_OPTIONS[0]).toBe(0);
    expect(DISCOUNT_OPTIONS).toContain(30);
  });
  it('orqaga grafi: tortish, karta, kirish so\'rovi qadamlari; birinchi qadamda null', () => {
    expect(prevDrvStep('weigh_discount', {})).toBe('weigh_weight');
    expect(prevDrvStep('weigh_reason', {})).toBe('weigh_discount');
    expect(prevDrvStep('weigh_reason_text', {})).toBe('weigh_reason');
    expect(prevDrvStep('weigh_confirm', { weigh: { requestId: 1, discount: 10 } })).toBe('weigh_reason');
    expect(prevDrvStep('weigh_confirm', { weigh: { requestId: 1, discount: 0 } })).toBe('weigh_discount');
    expect(prevDrvStep('card_expiry', {})).toBe('card_holder');
    expect(prevDrvStep('card_holder', {})).toBe('card_number');
    expect(prevDrvStep('acc_vehicle', {})).toBe('acc_point');
    expect(prevDrvStep('reg_phone', {})).toBe('reg_code');
    for (const first of ['weigh_weight', 'card_number', 'acc_name', 'reg_code', 'wd_amount', 'reject_text'] as const) expect(prevDrvStep(first, {})).toBeNull();
  });
  it('menyu tugmalari takrorlanmaydi; kabinet matni parolsiz holatni ham qamraydi', () => {
    const texts = Object.values(M);
    expect(new Set(texts).size).toBe(texts.length);
    expect(D.cabinet('https://x/driver', '+998 90', 'Abc12345')).toContain('Abc12345');
    expect(D.cabinet('https://x/driver', '+998 90', null)).toContain('🔑 Parol');
    expect(D.regFail.code).toBeTruthy();
  });
});
