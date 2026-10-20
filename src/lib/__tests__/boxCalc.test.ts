import { describe, expect, it } from 'vitest';
import {
  blank0201,
  boxSummary,
  calcBox,
  minEctByWeight,
  parseNum,
  perimeter,
  requiredEctKnM,
  requiredLoadN,
  validateBox,
  type BoxInput,
  type BoxResult,
  type SummaryLabels,
} from '../boxCalc';

/**
 * Quti kalkulyatori: skildagi (SKILL.md 7-bo'lim, mustahkamlik.md 4.3) ishlangan misollar bilan solishtiriladi.
 * McKee perimetri skildagidek ichki o'lchamdan: Z = 2(L+W). Qalinlik ehtiyotkor: B 3, C 3,5, BE 4,4, BC 6 mm
 * (skil misollarida C 4, BC 7) — shuning uchun kerakli ECT skildagidan biroz yuqori, marka hech qachon past emas.
 */
const base: BoxInput = { length: 300, width: 250, height: 330, weightKg: 12, tiers: 5, storage: 'dry', quantity: 1000 };

function ok(input: BoxInput): BoxResult {
  const out = calcBox(input);
  if (!out.ok) throw new Error(`kutilmagan xato: ${JSON.stringify(out.errors)}`);
  return out.result;
}

const labels: SummaryLabels = {
  title: 'T', size: 'S', weight: 'W', tiers: 'N', storage: 'St', storageValue: 'dry', quantity: 'Q',
  construction: 'C', layers: '{n} qatlamli', consult: 'X', review: 'R', blank: 'B', area: 'A', load: 'P', ect: 'E',
  units: { mm: 'mm', m2: 'm²', n: 'N', knm: 'kN/m' },
};

describe('boxCalc: 300 × 250 × 330, 12 kg, 5 qator', () => {
  it('quruq ombor: P = 9,8·3·12·4 = 1411 N → B da Т-23 (≥ 3,8) yetmaydi, C da ham 3,88 → Т-24 B', () => {
    const r = ok(base);
    expect(requiredLoadN(12, 5, 'dry')).toBeCloseTo(1411.2, 6);
    expect(r.loadN).toBe(1411);
    // Z = 2(300+250) = 1100; B: 1411,2 / (5,87·√(3·1100)) ≈ 4,185 → yuqoriga 4,19
    expect(perimeter(300, 250)).toBe(1100);
    expect(requiredEctKnM(1411.2, 3.5, 1100)).toBeCloseTo(3.875, 3);
    expect(r.requiredEct).toBe(4.19);
    expect(r.construction).toMatchObject({ layers: 3, flute: 'B', grade: 'Т-24', ectMin: 4.6, thicknessMm: 3 });
    // Zagotovka: 2(L+W) + 35 + 24 = 1159; eni W + H + 8 = 588 (Pack24 maketida 590)
    expect(r.blank).toEqual({ lengthMm: 1159, widthMm: 588 });
    expect(r.areaM2).toBeCloseTo(0.681, 3);
    expect(r.netAreaM2).toBeCloseTo(681.49, 2);
    expect(r.totalAreaM2).toBeCloseTo(749.64, 2);
    expect(r.wastePct).toBe(10);
    expect(r.outer).toEqual({ length: 306, width: 256, height: 342 });
    expect(r.notes).toEqual([]);
  });

  it('nam ombor: K₀ = 1,86 → P ≈ 2625 N; 3 qatlam va BE П-31/32 yetmaydi → BC П-32 (ECT ≈ 5,51)', () => {
    const r = ok({ ...base, storage: 'humid' });
    expect(r.loadN).toBe(2625);
    expect(r.requiredEct).toBe(5.51);
    expect(r.construction).toMatchObject({ layers: 5, flute: 'BC', grade: 'П-32' });
    expect(r.notes).toContain('humid');
  });
});

describe('boxCalc: skil misoli 400 × 300 × 300, 6 qator (mustahkamlik.md 4.3, SKILL.md 7.3)', () => {
  const box = { ...base, length: 400, width: 300, height: 300, tiers: 6 };

  it('12 kg quruq: P ≈ 1764 N (skil 1 760), B yetmaydi, C (3,5 mm) da ECT ≈ 4,3 → Т-24 C (skil ham Т-24)', () => {
    const r = ok(box);
    expect(r.loadN).toBe(1764);
    expect(r.requiredEct).toBe(4.3);
    expect(r.construction).toMatchObject({ flute: 'C', grade: 'Т-24' });
    expect(r.blank).toEqual({ lengthMm: 1459, widthMm: 608 });
    expect(r.areaM2).toBeCloseTo(0.887, 3);
  });

  it('12 kg nam: P ≈ 3281 N; BC 6 mm da П-32 uchun 6,10 > 6 → П-33 BE (skil t = 7 bilan BC П-32)', () => {
    const r = ok({ ...box, storage: 'humid' });
    expect(r.loadN).toBe(3281);
    expect(requiredEctKnM(3281.04, 6, 1400)).toBeGreaterThan(6);
    expect(r.construction).toMatchObject({ layers: 5, flute: 'BE', grade: 'П-33', ectMin: 8 });
    expect(r.requiredEct).toBe(7.13);
    // 5 qatlam zagotovkasi: 2(L+W) + 35 + 34; eni W + H + 16
    expect(r.blank).toEqual({ lengthMm: 1469, widthMm: 616 });
  });

  it('SKILL.md 7.3 retsepti 10 kg: B da 3,86 > 3,8 → Т-23 faqat C da (3,5 mm: 3,58; skil 4 mm: 3,35)', () => {
    const r = ok({ ...box, weightKg: 10 });
    expect(r.loadN).toBe(1470);
    expect(requiredEctKnM(1470, 3, 1400)).toBeCloseTo(3.86, 2);
    expect(requiredEctKnM(1470, 4, 1400)).toBeCloseTo(3.35, 2);
    expect(r.requiredEct).toBe(3.58);
    expect(r.construction).toMatchObject({ flute: 'C', grade: 'Т-23' });
  });

  it('chegara: 11,4 kg → skil retsepti (C, 4 mm) 3,815 > 3,8 → Т-24 (Т-23 emas)', () => {
    const r = ok({ ...box, weightKg: 11.4 });
    expect(requiredEctKnM(1675.8, 4, 1400)).toBeGreaterThan(3.8);
    expect(r.construction?.grade).toBe('Т-24');
  });

  it('ko\'rsatilgan kerakli ECT yuqoriga yaxlitlanadi va tanlangan marka minimumidan oshmaydi', () => {
    for (const weightKg of [9, 10, 11, 11.4, 11.49, 12, 15]) {
      const r = ok({ ...box, weightKg });
      expect(r.construction).not.toBeNull();
      expect(r.requiredEct).toBeLessThanOrEqual(r.construction!.ectMin);
      const raw = requiredEctKnM(requiredLoadN(weightKg, 6, 'dry'), r.construction!.thicknessMm, 1400);
      expect(r.requiredEct).toBeGreaterThanOrEqual(raw);
      expect(r.requiredEct - raw).toBeLessThan(0.01);
    }
  });
});

describe('boxCalc: og\'irlik bo\'yicha minimal marka (GWP)', () => {
  it('jadval chegaralari', () => {
    expect(minEctByWeight(3, 5)).toBe(3.0);
    expect(minEctByWeight(3, 12)).toBe(3.8);
    expect(minEctByWeight(3, 17)).toBe(3.8);
    expect(minEctByWeight(3, 25)).toBe(5.4);
    expect(minEctByWeight(3, 35)).toBe(7.0);
    expect(minEctByWeight(3, 35.1)).toBe(Infinity);
    expect(minEctByWeight(5, 15)).toBe(5.0);
    expect(minEctByWeight(5, 40)).toBe(10.0);
  });

  it('n = 1: yuk 0, lekin marka og\'irlikdan (12 kg → Т-23, 5 kg → Т-22; 1-sinf tara ECT ≥ 3,0 — Т-21 hech qachon emas)', () => {
    const r = ok({ ...base, tiers: 1 });
    expect(r.loadN).toBe(0);
    expect(r.requiredEct).toBe(0);
    expect(r.construction).toMatchObject({ layers: 3, grade: 'Т-23' });
    expect(r.notes).toContain('noStacking');
    expect(ok({ ...base, weightKg: 5, tiers: 1 }).construction?.grade).toBe('Т-22');
    expect(ok({ ...base, weightKg: 0.5, tiers: 1 }).construction?.grade).toBe('Т-22');
  });

  it('30 kg, taxtsiz — eng kuchli 3 qatlam (Т-27), eng yengili emas', () => {
    const r = ok({ ...base, length: 400, width: 300, height: 300, weightKg: 30, tiers: 1 });
    expect(r.construction).toMatchObject({ layers: 3, grade: 'Т-27' });
    // Kichik taxt yuki ham og'irlik minimumidan pastga tushirmaydi
    expect(ok({ ...base, weightKg: 30, tiers: 2 }).construction?.grade).toBe('Т-27');
  });

  it('35 kg dan og\'ir: taxtsiz ham faqat 5 qatlam, 40 kg → П-34', () => {
    const r = ok({ ...base, weightKg: 40, tiers: 1 });
    expect(r.construction).toMatchObject({ layers: 5, grade: 'П-34' });
    expect(r.notes).toContain('heavy');
    expect(r.notes).not.toContain('consult');
  });

  it('45 kg dan og\'ir: jadval yo\'q — marka ko\'rsatiladi, lekin "tooHeavy" + "consult"', () => {
    const r = ok({ ...base, length: 600, width: 400, height: 400, weightKg: 100, tiers: 1 });
    expect(r.construction).toMatchObject({ layers: 5, grade: 'П-34' });
    expect(r.notes).toEqual(expect.arrayContaining(['heavy', 'tooHeavy', 'consult']));
  });
});

describe('boxCalc: maxsus holatlar', () => {
  it('L < W bo\'lsa almashtiriladi va eslatma qo\'shiladi', () => {
    const swapped = ok({ ...base, length: 250, width: 300 });
    const normal = ok(base);
    expect(swapped.input.length).toBe(300);
    expect(swapped.input.width).toBe(250);
    expect(swapped.notes).toContain('swapped');
    expect(swapped.blank).toEqual(normal.blank);
    expect(swapped.construction).toEqual(normal.construction);
  });

  it('hech bir marka yetmasa — "consult", zagotovka BC bo\'yicha', () => {
    const r = ok({ length: 200, width: 150, height: 100, weightKg: 100, tiers: 20, storage: 'humid', quantity: 1 });
    expect(r.construction).toBeNull();
    expect(r.notes).toContain('consult');
    expect(r.loadN).toBe(103900);
    expect(r.blank).toEqual({ lengthMm: 2 * 350 + 69, widthMm: 150 + 100 + 16 });
  });

  it('zagotovka gofroagregatga sig\'masa — "oversize" + "consult", marka ko\'rinadi', () => {
    const r = ok({ ...base, length: 1200, width: 800, height: 1800, weightKg: 20, tiers: 2 });
    expect(r.blank).toEqual({ lengthMm: 4059, widthMm: 2608 });
    expect(r.construction).not.toBeNull();
    expect(r.notes).toEqual(expect.arrayContaining(['oversize', 'consult']));
    // Eni 2400 dan oshmasa va uzunligi 3000 gacha — oddiy natija
    const fit = ok({ ...base, length: 800, width: 600, height: 600 });
    expect(fit.blank).toEqual({ lengthMm: 2859, widthMm: 1208 });
    expect(fit.notes).not.toContain('oversize');
  });

  it('GOST nisbatlari va past quti eslatmalari (Z/7 ichki perimetrdan)', () => {
    const r = ok({ ...base, length: 900, width: 200, height: 60 });
    expect(r.notes).toEqual(expect.arrayContaining(['ratioLW', 'ratioHW', 'mckeeShort']));
    // 2(300+250)/7 ≈ 157 — 157 mm baland quti chegarada emas
    expect(ok({ ...base, height: 158 }).notes).not.toContain('mckeeShort');
    expect(ok({ ...base, height: 156 }).notes).toContain('mckeeShort');
  });

  it('zagotovka formulasi', () => {
    expect(blank0201(400, 300, 300, 3)).toEqual({ lengthMm: 1459, widthMm: 608 });
    expect(blank0201(400, 300, 300, 5)).toEqual({ lengthMm: 1469, widthMm: 616 });
  });
});

describe('boxCalc: tekshiruv', () => {
  it('to\'g\'ri kirishda xato yo\'q', () => {
    expect(validateBox(base)).toEqual([]);
  });

  it('chegaradan tashqari, butun bo\'lmagan va raqam bo\'lmagan qiymatlar xato qaytaradi (istisno otmaydi)', () => {
    const out = calcBox({ length: 40, width: 3000, height: Number.NaN, weightKg: 0, tiers: 2.5, storage: 'wet' as never, quantity: 10_000_001 });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.errors).toEqual(
      expect.arrayContaining([
        { field: 'length', code: 'range' },
        { field: 'width', code: 'range' },
        { field: 'height', code: 'invalid' },
        { field: 'weightKg', code: 'range' },
        { field: 'tiers', code: 'integer' },
        { field: 'storage', code: 'invalid' },
        { field: 'quantity', code: 'range' },
      ]),
    );
    expect(out.errors).toHaveLength(7);
  });

  it('chegaraviy qiymatlar qabul qilinadi', () => {
    expect(validateBox({ length: 2500, width: 50, height: 50, weightKg: 100, tiers: 20, storage: 'humid', quantity: 10_000_000 })).toEqual([]);
    expect(validateBox({ ...base, weightKg: 100.01 })).toEqual([{ field: 'weightKg', code: 'range' }]);
    expect(validateBox({ ...base, tiers: 21 })).toEqual([{ field: 'tiers', code: 'range' }]);
  });

  it('parseNum: vergulli kasr, bo\'shliqlar, bo\'sh qator', () => {
    expect(parseNum('12,5')).toBe(12.5);
    expect(parseNum('12.5')).toBe(12.5);
    expect(parseNum(' 400 ')).toBe(400);
    expect(parseNum('')).toBeNaN();
    expect(parseNum('   ')).toBeNaN();
    expect(parseNum('12a')).toBeNaN();
  });

  it('parseNum: butun maydonda minglik ajratgich ("10,000", "10.000", "10 000") o\'qiladi, kasr maydonida vergul — kasr', () => {
    expect(parseNum('10,000', { integer: true })).toBe(10000);
    expect(parseNum('10.000', { integer: true })).toBe(10000);
    expect(parseNum('10 000', { integer: true })).toBe(10000);
    expect(parseNum('1,000,000', { integer: true })).toBe(1000000);
    // Guruhlanmagan vergul butun maydonda ham kasr bo'lib qoladi → "butun son kiriting" xatosi
    expect(parseNum('12,5', { integer: true })).toBe(12.5);
    expect(parseNum('1,5', { integer: true })).toBe(1.5);
    expect(parseNum('10,000')).toBe(10);
    expect(parseNum('1,250')).toBe(1.25);
  });

  it('ingliz sahifasidagi "10,000" tiraj 10 emas, 10 000 deb hisoblanadi', () => {
    const r = ok({ ...base, quantity: parseNum('10,000', { integer: true }) });
    expect(r.input.quantity).toBe(10000);
    expect(r.netAreaM2).toBeCloseTo(0.681 * 10000, -1);
  });
});

describe('boxCalc: ariza matni', () => {
  it('ajratuvchilar "; " bilan, birliklar tarjimadan', () => {
    const r = ok(base);
    const text = boxSummary(r, labels);
    expect(text).toContain('W: 12; N: 5; St: dry');
    expect(text).toContain('300 × 250 × 330 mm');
    const ru = boxSummary(r, { ...labels, units: { mm: 'мм', m2: 'м²', n: 'Н', knm: 'кН/м' } });
    expect(ru).toContain('300 × 250 × 330 мм');
    expect(ru).toContain('1159 × 588 мм');
    expect(ru).toContain('0.681 м²');
    expect(ru).toContain('1411 Н');
    expect(ru).toContain('4.19 кН/м');
    expect(ru).not.toMatch(/\b(mm|kN)\b/);
  });

  it('marka bor, lekin maslahat kerak — "review" qatori qo\'shiladi', () => {
    const r = ok({ ...base, length: 1200, width: 800, height: 1800, weightKg: 20, tiers: 2 });
    const lines = boxSummary(r, labels).split('\n');
    expect(lines).toContain('R');
    expect(boxSummary(ok(base), labels).split('\n')).not.toContain('R');
  });
});

describe('boxCalc: narx yo\'q', () => {
  it('natijada narx maydoni ham, so\'m ham yo\'q', () => {
    for (const storage of ['dry', 'humid'] as const) {
      const r = ok({ ...base, storage });
      const json = JSON.stringify(r).toLowerCase();
      expect(json).not.toMatch(/price|narx|cost|so'm|sum|uzs/);
      const text = boxSummary(r, labels);
      expect(text).toMatch(/\d qatlamli, (B|C|BE|BC), [ТП]-/);
      expect(text).toContain('300 × 250 × 330 mm');
      expect(text.toLowerCase()).not.toMatch(/so'm|narx|uzs/);
    }
  });
});
