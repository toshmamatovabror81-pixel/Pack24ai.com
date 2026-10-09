import { describe, expect, it } from 'vitest';
import uz from '../i18n/dict/uz';
import ru from '../i18n/dict/ru';
import en from '../i18n/dict/en';
import { formatPhoneInput } from '@/components/recycling/phone';

/** Ob'ekt kalitlarini chuqur yig'ish: a.b.c */
function keysOf(o: unknown, prefix = ''): string[] {
  if (!o || typeof o !== 'object') return [prefix];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}

describe('makulatura lug\'ati', () => {
  it('recycling bo\'limi uchta tilda bir xil kalitlarga ega', () => {
    const base = keysOf(uz.recycling).sort();
    expect(keysOf(ru.recycling).sort()).toEqual(base);
    expect(keysOf(en.recycling).sort()).toEqual(base);
    expect(base.length).toBeGreaterThan(60);
  });
  it('barcha matnlar bo\'sh emas', () => {
    for (const d of [uz, ru, en]) {
      const walk = (o: unknown) => {
        if (typeof o === 'string') expect(o.trim().length).toBeGreaterThan(0);
        else if (o && typeof o === 'object') Object.values(o as Record<string, unknown>).forEach(walk);
      };
      walk(d.recycling);
    }
  });
  it('{kg} o\'rinbosari minimal kg matnlarida bor', () => {
    for (const d of [uz, ru, en]) {
      expect(d.recycling.minPickup).toContain('{kg}');
      expect(d.recycling.pickupHint).toContain('{kg}');
      expect(d.recycling.errors.min_volume).toContain('{kg}');
    }
  });
});

describe('telefon maydoni formati', () => {
  it('raqamlarni +998 XX XXX XX XX ko\'rinishiga keltiradi', () => {
    expect(formatPhoneInput('901234567')).toBe('+998 90 123 45 67');
    expect(formatPhoneInput('+998 (90) 123-45-67')).toBe('+998 90 123 45 67');
    expect(formatPhoneInput('998901234567')).toBe('+998 90 123 45 67');
    expect(formatPhoneInput('9012345678901')).toBe('+998 90 123 45 67');
    expect(formatPhoneInput('90')).toBe('+998 90');
    expect(formatPhoneInput('')).toBe('');
  });
});
