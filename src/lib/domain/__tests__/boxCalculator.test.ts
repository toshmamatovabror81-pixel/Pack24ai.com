import {
    computeBoxMetrics,
    isFlexoQtyValid,
    FLEXO_MIN_QTY,
    getPaperLayerProfile,
    computeSurfaceAreaSqM,
    computeBoxPricing,
    roundSalePrice,
} from '../boxCalculator';

describe('computeBoxMetrics', () => {
    it('returns null for invalid dimensions', () => {
        expect(computeBoxMetrics({ l: 0, w: 100, h: 50 })).toBeNull();
        expect(computeBoxMetrics({ l: -1, w: 100, h: 50 })).toBeNull();
    });

    it('computes volume and surface area', () => {
        const m = computeBoxMetrics({ l: 100, w: 80, h: 60 });
        expect(m).not.toBeNull();
        expect(m!.volume).toBe(100 * 80 * 60);
        expect(m!.volumeL).toBeCloseTo(0.48, 5);
        expect(m!.surfaceArea).toBe(2 * (100 * 80 + 100 * 60 + 80 * 60));
        expect(m!.surfaceCm2).toBe(m!.surfaceArea / 100);
    });

    it('computes tuck-end dieline sheet size', () => {
        const m = computeBoxMetrics({ l: 200, w: 150, h: 100 })!;
        expect(m.dielineW).toBe(150 + 100 + 150 + 100 + 15);
        expect(m.dielineL).toBe(200 + 100 + 100 + 20);
        expect(m.sheetArea).toBe(m.dielineW * m.dielineL);
        expect(m.sheetCm2).toBe(m.sheetArea / 100);
    });

    it('computes perimeter', () => {
        const m = computeBoxMetrics({ l: 100, w: 50, h: 30 })!;
        expect(m.perimeter).toBe(4 * (100 + 50 + 30));
    });
});

describe('isFlexoQtyValid', () => {
    it('allows empty qty or >= minimum', () => {
        expect(FLEXO_MIN_QTY).toBe(1000);
        expect(isFlexoQtyValid(0)).toBe(true);
        expect(isFlexoQtyValid(1000)).toBe(true);
        expect(isFlexoQtyValid(999)).toBe(false);
    });
});

describe('getPaperLayerProfile', () => {
    it('returns profile by id', () => {
        const p = getPaperLayerProfile('eb-flute');
        expect(p.layers).toBe(5);
        expect(p.thicknessMm).toBe(4.5);
    });

    it('falls back to e-flute for unknown id', () => {
        expect(getPaperLayerProfile('e-flute').id).toBe('e-flute');
    });
});

describe('computeSurfaceAreaSqM', () => {
    it('computes 0.94 m² for 500×400×300 mm box', () => {
        const s = computeSurfaceAreaSqM({ l: 500, w: 400, h: 300 });
        expect(s).toBeCloseTo(0.94, 4);
    });
});

describe('computeBoxPricing', () => {
    it('matches textbook example (50×40×30 cm, 5000 so\'m/m², 30% markup)', () => {
        const p = computeBoxPricing(
            { l: 500, w: 400, h: 300 },
            { profileId: 'e-flute', pricePerSqM: 5000, markupPercent: 30 },
        );
        expect(p).not.toBeNull();
        expect(p!.surfaceSqM).toBeCloseTo(0.94, 4);
        expect(p!.withWasteSqM).toBeCloseTo(1.034, 4);
        expect(p!.materialCost).toBe(5170);
        expect(p!.totalCost).toBe(7170);
        expect(p!.markupAmount).toBe(2151);
        expect(p!.salePricePerUnit).toBe(9321);
    });

    it('excludes print/glue when includePrintGlue is false', () => {
        const p = computeBoxPricing(
            { l: 500, w: 400, h: 300 },
            { profileId: 'e-flute', pricePerSqM: 5000, includePrintGlue: false, markupPercent: 0 },
        )!;
        expect(p.printGlue).toBe(0);
        expect(p.totalCost).toBe(5170 + 800 + 700);
    });

    it('uses profile default price when pricePerSqM omitted', () => {
        const p = computeBoxPricing({ l: 100, w: 100, h: 100 }, { profileId: 'eb-flute', markupPercent: 0 })!;
        expect(p.pricePerSqM).toBe(11000);
    });
});

describe('roundSalePrice', () => {
    it('rounds to nearest 100', () => {
        expect(roundSalePrice(9321)).toBe(9300);
        expect(roundSalePrice(9350)).toBe(9400);
    });
});
