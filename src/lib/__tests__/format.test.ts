import { describe, expect, it } from 'vitest';
import { displayPhone, formatPrice, normalizePhone } from '../format';
import { idFromParam, slugify } from '../slug';
import { pickText } from '../i18n/config';

describe('format', () => {
  it('telefon raqamini normallashtirish', () => {
    expect(normalizePhone('+998 (90) 123-45-67')).toBe('998901234567');
    expect(normalizePhone('90 123 45 67')).toBe('998901234567');
    expect(normalizePhone('12345')).toBeNull();
    expect(displayPhone('998880557888')).toBe('+998 88 055 78 88');
  });

  it('narx formati', () => {
    expect(formatPrice(1234567.5, "so'm")).toBe("1 234 567,5 so'm");
    expect(formatPrice('1000.00', 'UZS')).toBe('1 000 UZS');
  });

  it('slug va ID', () => {
    expect(slugify("Karton quti 300×200 mm (o'rta)")).toBe('karton-quti-300-200-mm-orta');
    expect(slugify('Картонная коробка')).toBe('kartonnaya-korobka');
    expect(idFromParam('12-karton-quti')).toBe(12);
    expect(idFromParam('12')).toBe(12);
    expect(idFromParam('abc')).toBeNull();
    expect(idFromParam('0')).toBeNull();
  });

  it('tarjima tanlash', () => {
    expect(pickText({ uz: 'Quti', ru: 'Коробка' }, 'ru')).toBe('Коробка');
    expect(pickText({ uz: 'Quti', ru: '' }, 'ru')).toBe('Quti');
    expect(pickText({}, 'en', 'fallback')).toBe('fallback');
    expect(pickText(null, 'uz', 'x')).toBe('x');
  });
});
