/** Quti o'lchamlari (mm) */
export type BoxDimensionsMm = {
    l: number;
    w: number;
    h: number;
};

export type PaperLayerProfileId = 'e-flute' | 'b-flute' | 'eb-flute' | 'bc-flute';

export type PaperLayerProfile = {
    id: PaperLayerProfileId;
    layers: 3 | 5;
    thicknessMm: number;
    label: { uz: string; ru: string; en: string };
};

/** Gofrokarton profillari — qog'oz qatlamlari */
export const PAPER_LAYER_PROFILES: PaperLayerProfile[] = [
    {
        id: 'e-flute',
        layers: 3,
        thicknessMm: 1.5,
        label: { uz: 'E-Flute (3 qavat, ~1.5 mm)', ru: 'E-Flute (3 слоя, ~1.5 мм)', en: 'E-Flute (3 ply, ~1.5 mm)' },
    },
    {
        id: 'b-flute',
        layers: 3,
        thicknessMm: 3,
        label: { uz: 'B-Flute (3 qavat, ~3 mm)', ru: 'B-Flute (3 слоя, ~3 мм)', en: 'B-Flute (3 ply, ~3 mm)' },
    },
    {
        id: 'eb-flute',
        layers: 5,
        thicknessMm: 4.5,
        label: { uz: 'EB-Flute (5 qavat, ~4.5 mm)', ru: 'EB-Flute (5 слоёв, ~4.5 мм)', en: 'EB-Flute (5 ply, ~4.5 mm)' },
    },
    {
        id: 'bc-flute',
        layers: 5,
        thicknessMm: 6.5,
        label: { uz: 'BC-Flute (5 qavat, ~6.5 mm)', ru: 'BC-Flute (5 слоёв, ~6.5 мм)', en: 'BC-Flute (5 ply, ~6.5 mm)' },
    },
];

export function getPaperLayerProfile(id: PaperLayerProfileId): PaperLayerProfile {
    return PAPER_LAYER_PROFILES.find(p => p.id === id) ?? PAPER_LAYER_PROFILES[0];
}

export type BoxMetrics = {
    volume: number;
    volumeL: number;
    surfaceArea: number;
    surfaceCm2: number;
    dielineW: number;
    dielineL: number;
    sheetArea: number;
    sheetCm2: number;
    perimeter: number;
};

/** Tuck end box uchun taxminiy dieline va asosiy geometrik ko'rsatkichlar */
export function computeBoxMetrics(dims: BoxDimensionsMm): BoxMetrics | null {
    const { l, w, h } = dims;
    if (l <= 0 || w <= 0 || h <= 0) return null;

    const surfaceArea = 2 * (l * w + l * h + w * h);
    const volume = l * w * h;
    const dielineW = w + h + w + h + 15;
    const dielineL = l + h + h + 20;
    const sheetArea = dielineW * dielineL;
    const perimeter = 4 * (l + w + h);

    return {
        volume,
        volumeL: volume / 1e6,
        surfaceArea,
        surfaceCm2: surfaceArea / 100,
        dielineW,
        dielineL,
        sheetArea,
        sheetCm2: sheetArea / 100,
        perimeter,
    };
}

export const FLEXO_MIN_QTY = 1000;

export function isFlexoQtyValid(qty: number): boolean {
    return qty === 0 || qty >= FLEXO_MIN_QTY;
}

/** mm → m²: S = 2(lw + wh + lh) */
export function computeSurfaceAreaSqM(dims: BoxDimensionsMm): number | null {
    const { l, w, h } = dims;
    if (l <= 0 || w <= 0 || h <= 0) return null;
    const a = l / 1000;
    const b = w / 1000;
    const c = h / 1000;
    return 2 * (a * b + b * c + a * c);
}

/** Kesish chiqindisi — 10% zaxira */
export const WASTE_FACTOR = 1.1;

/** Gofrokarton narxi (so'm / m²) — profil bo'yicha */
export const PROFILE_PRICE_PER_SQM: Record<PaperLayerProfileId, number> = {
    'e-flute': 7000,
    'b-flute': 7000,
    'eb-flute': 11000,
    'bc-flute': 11000,
};

export const DEFAULT_PRINT_GLUE_UZS = 500;
export const DEFAULT_LABOR_UZS = 800;
export const DEFAULT_FIXED_UZS = 700;
export const DEFAULT_MARKUP_PERCENT = 30; // Ichki ustama — faqat server/formula; mijoz UI da ko'rinmaydi

/** Ofset: bir martalik sozlama xarajatlari */
export const OFFSET_ONE_TIME_PRINT_UZS = 450_000;
export const OFFSET_ONE_TIME_DESIGN_UZS = 450_000;

export type BoxPricingOptions = {
    profileId: PaperLayerProfileId;
    includePrintGlue?: boolean;
    pricePerSqM?: number;
    wasteFactor?: number;
    printGlueUzs?: number;
    laborUzs?: number;
    fixedUzs?: number;
    markupPercent?: number;
};

export type BoxPricingResult = {
    surfaceSqM: number;
    withWasteSqM: number;
    pricePerSqM: number;
    materialCost: number;
    printGlue: number;
    labor: number;
    fixed: number;
    totalCost: number;
    markupPercent: number;
    markupAmount: number;
    salePricePerUnit: number;
};

/**
 * Karobka narxini hisoblash (5 bosqich):
 * 1. Sirt yuzasi (m²)
 * 2. +10% chiqindi
 * 3. Material tannarx
 * 4. Pechat/yelim + ishchi + doimiy xarajat
 * 5. Ustama (foyda) %
 */
export function computeBoxPricing(
    dims: BoxDimensionsMm,
    options: BoxPricingOptions,
): BoxPricingResult | null {
    const surfaceSqM = computeSurfaceAreaSqM(dims);
    if (surfaceSqM === null) return null;

    const wasteFactor = options.wasteFactor ?? WASTE_FACTOR;
    const pricePerSqM = options.pricePerSqM ?? PROFILE_PRICE_PER_SQM[options.profileId];
    const printGlue = options.includePrintGlue === false ? 0 : (options.printGlueUzs ?? DEFAULT_PRINT_GLUE_UZS);
    const labor = options.laborUzs ?? DEFAULT_LABOR_UZS;
    const fixed = options.fixedUzs ?? DEFAULT_FIXED_UZS;
    const markupPercent = options.markupPercent ?? DEFAULT_MARKUP_PERCENT;

    const withWasteSqM = surfaceSqM * wasteFactor;
    const materialCost = Math.round(withWasteSqM * pricePerSqM);
    const totalCost = materialCost + printGlue + labor + fixed;
    const markupAmount = Math.round(totalCost * (markupPercent / 100));
    const salePricePerUnit = totalCost + markupAmount;

    return {
        surfaceSqM,
        withWasteSqM,
        pricePerSqM,
        materialCost,
        printGlue,
        labor,
        fixed,
        totalCost,
        markupPercent,
        markupAmount,
        salePricePerUnit,
    };
}

export function roundSalePrice(price: number): number {
    return Math.round(price / 100) * 100;
}
