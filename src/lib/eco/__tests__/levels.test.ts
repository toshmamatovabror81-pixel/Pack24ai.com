import {
  ECO_LEVELS,
  MATERIAL_POINTS,
  getLevelByWeight,
  kgToNextLevel,
  levelProgress,
  calcEcoPoints,
} from '@/lib/eco/levels';import type { EcoLevelKey } from '@/lib/eco/levels';

// ─── ECO_LEVELS constant ────────────────────────────────────────────
describe('ECO_LEVELS', () => {
  it('contains exactly 7 levels', () => {
    expect(ECO_LEVELS).toHaveLength(7);
  });

  it('has keys in the correct order', () => {
    const keys = ECO_LEVELS.map((l) => l.key);
    expect(keys).toEqual([
      'seed', 'sprout', 'sapling', 'tree', 'forest', 'guardian', 'legend',
    ]);
  });

  it('has ascending minKg values', () => {
    for (let i = 1; i < ECO_LEVELS.length; i++) {
      expect(ECO_LEVELS[i].minKg).toBeGreaterThan(ECO_LEVELS[i - 1].minKg);
    }
  });

  it('has ascending pointsMultiplier values', () => {
    for (let i = 1; i < ECO_LEVELS.length; i++) {
      expect(ECO_LEVELS[i].pointsMultiplier).toBeGreaterThanOrEqual(
        ECO_LEVELS[i - 1].pointsMultiplier,
      );
    }
  });

  it('only the last level (legend) has maxKg === null', () => {
    const withNullMax = ECO_LEVELS.filter((l) => l.maxKg === null);
    expect(withNullMax).toHaveLength(1);
    expect(withNullMax[0].key).toBe('legend');
  });

  it('each level has required fields', () => {
    ECO_LEVELS.forEach((level) => {
      expect(level).toEqual(
        expect.objectContaining({
          key: expect.any(String),
          nameUz: expect.any(String),
          nameRu: expect.any(String),
          emoji: expect.any(String),
          color: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
          minKg: expect.any(Number),
          pointsMultiplier: expect.any(Number),
          description: expect.any(String),
        }),
      );
    });
  });
});

// ─── getLevelByWeight ────────────────────────────────────────────────
describe('getLevelByWeight', () => {
  it('returns seed for 0 kg', () => {
    expect(getLevelByWeight(0).key).toBe('seed');
  });

  it('returns seed for negative value', () => {
    expect(getLevelByWeight(-5).key).toBe('seed');
  });

  it.each<[number, EcoLevelKey]>([
    [10, 'sprout'],
    [50, 'sapling'],
    [150, 'tree'],
    [500, 'forest'],
    [1500, 'guardian'],
    [5000, 'legend'],
  ])('exact boundary %d kg → %s', (kg, expectedKey) => {
    expect(getLevelByWeight(kg).key).toBe(expectedKey);
  });

  it.each<[number, EcoLevelKey]>([
    [5, 'seed'],
    [25, 'sprout'],
    [100, 'sapling'],
    [300, 'tree'],
    [1000, 'forest'],
    [3000, 'guardian'],
  ])('mid-range %d kg → %s', (kg, expectedKey) => {
    expect(getLevelByWeight(kg).key).toBe(expectedKey);
  });

  it('returns legend for very large values', () => {
    expect(getLevelByWeight(10_000).key).toBe('legend');
    expect(getLevelByWeight(999_999).key).toBe('legend');
  });

  it('returns a full EcoLevel object (not just key)', () => {
    const level = getLevelByWeight(0);
    expect(level.nameUz).toBeDefined();
    expect(level.emoji).toBeDefined();
    expect(level.pointsMultiplier).toBe(1.0);
  });
});

// ─── kgToNextLevel ──────────────────────────────────────────────────
describe('kgToNextLevel', () => {
  it.each<[number, number]>([
    [0, 10],    // seed  → maxKg 10, remaining 10
    [5, 5],     // seed  → remaining 5
    [10, 40],   // sprout → maxKg 50, remaining 40
    [50, 100],  // sapling → maxKg 150, remaining 100
    [150, 350], // tree → maxKg 500, remaining 350
    [500, 1000],// forest → maxKg 1500, remaining 1000
    [1500, 3500], // guardian → maxKg 5000, remaining 3500
  ])('at %d kg returns %d kg remaining', (kg, expected) => {
    expect(kgToNextLevel(kg)).toBe(expected);
  });

  it('returns null for legend level (5000+ kg)', () => {
    expect(kgToNextLevel(5000)).toBeNull();
    expect(kgToNextLevel(10_000)).toBeNull();
  });

  it('returns correct value at exact boundary (sprout at 10)', () => {
    // 10 kg = sprout, maxKg = 50 → remaining = 40
    expect(kgToNextLevel(10)).toBe(40);
  });

  it('returns correct value just below boundary', () => {
    // 9.9 kg = still seed, maxKg = 10 → remaining = 0.1
    const result = kgToNextLevel(9.9);
    expect(result).toBeCloseTo(0.1, 5);
  });
});

// ─── levelProgress ──────────────────────────────────────────────────
describe('levelProgress', () => {
  it('returns 0 for 0 kg', () => {
    expect(levelProgress(0)).toBe(0);
  });

  it('returns 100 for legend level', () => {
    expect(levelProgress(5000)).toBe(100);
    expect(levelProgress(50_000)).toBe(100);
  });

  it('returns 50% at midpoint of seed level (5 kg, range 0-10)', () => {
    expect(levelProgress(5)).toBe(50);
  });

  it('returns 0% at start of sprout level (10 kg, range 10-50)', () => {
    expect(levelProgress(10)).toBe(0);
  });

  it.each<[number, number]>([
    [0, 0],     // seed: (0-0)/(10-0) = 0%
    [5, 50],    // seed: (5-0)/(10-0) = 50%
    [9, 90],    // seed: (9-0)/(10-0) = 90%
    [10, 0],    // sprout: (10-10)/(50-10) = 0%
    [30, 50],   // sprout: (30-10)/(50-10) = 50%
    [50, 0],    // sapling: (50-50)/(150-50) = 0%
    [100, 50],  // sapling: (100-50)/(150-50) = 50%
    [150, 0],   // tree: (150-150)/(500-150) = 0%
    [325, 50],  // tree: (325-150)/(500-150) = 50%
  ])('at %d kg returns %d%%', (kg, expected) => {
    expect(levelProgress(kg)).toBe(expected);
  });

  it('never exceeds 100', () => {
    // Edge: even if somehow within range, Math.min(100, ...) caps it
    expect(levelProgress(9999999)).toBeLessThanOrEqual(100);
  });
});

// ─── MATERIAL_POINTS constant ───────────────────────────────────────
describe('MATERIAL_POINTS', () => {
  it('contains known materials', () => {
    expect(MATERIAL_POINTS['Makulatura']).toBe(8);
    expect(MATERIAL_POINTS['Karton']).toBe(6);
    expect(MATERIAL_POINTS['Plastik']).toBe(12);
    expect(MATERIAL_POINTS['Shisha']).toBe(5);
    expect(MATERIAL_POINTS['Metall']).toBe(15);
  });

  it('has a default value', () => {
    expect(MATERIAL_POINTS['default']).toBe(8);
  });
});

// ─── calcEcoPoints ──────────────────────────────────────────────────
describe('calcEcoPoints', () => {
  it.each<[string, number, number]>([
    ['Makulatura', 10, 80],  // 8 * 10 * 1.0
    ['Karton', 10, 60],      // 6 * 10 * 1.0
    ['Plastik', 10, 120],    // 12 * 10 * 1.0
    ['Shisha', 10, 50],      // 5 * 10 * 1.0
    ['Metall', 10, 150],     // 15 * 10 * 1.0
  ])('known material %s × %d kg → %d points', (material, kg, expected) => {
    expect(calcEcoPoints(material, kg)).toBe(expected);
  });

  it('uses default (8) for unknown material', () => {
    expect(calcEcoPoints('UnknownMaterial', 10)).toBe(80); // 8 * 10
    expect(calcEcoPoints('', 10)).toBe(80);
  });

  it('applies levelMultiplier', () => {
    // Makulatura: 8 * 10 * 2.0 = 160
    expect(calcEcoPoints('Makulatura', 10, 2.0)).toBe(160);
    // Plastik: 12 * 5 * 1.5 = 90
    expect(calcEcoPoints('Plastik', 5, 1.5)).toBe(90);
  });

  it('returns 0 for 0 kg', () => {
    expect(calcEcoPoints('Makulatura', 0)).toBe(0);
    expect(calcEcoPoints('Plastik', 0, 2.5)).toBe(0);
  });

  it('rounds result to nearest integer', () => {
    // Makulatura: 8 * 3 * 1.1 = 26.4 → 26
    expect(calcEcoPoints('Makulatura', 3, 1.1)).toBe(26);
    // Karton: 6 * 7 * 1.3 = 54.6 → 55
    expect(calcEcoPoints('Karton', 7, 1.3)).toBe(55);
  });

  it('defaults levelMultiplier to 1.0 when omitted', () => {
    const withDefault = calcEcoPoints('Metall', 5);
    const withExplicit = calcEcoPoints('Metall', 5, 1.0);
    expect(withDefault).toBe(withExplicit);
    expect(withDefault).toBe(75); // 15 * 5 * 1.0
  });
});
