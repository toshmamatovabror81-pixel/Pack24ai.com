import type { PaperLayerProfileId } from './boxCalculator';
import {
    DEFAULT_FIXED_UZS,
    DEFAULT_LABOR_UZS,
    DEFAULT_MARKUP_PERCENT,
    DEFAULT_PRINT_GLUE_UZS,
    OFFSET_ONE_TIME_DESIGN_UZS,
    OFFSET_ONE_TIME_PRINT_UZS,
    PROFILE_PRICE_PER_SQM,
    WASTE_FACTOR,
} from './boxCalculator';

export type BoxCalculatorConfig = {
    markupPercent: number;
    wasteFactor: number;
    printGlueUzs: number;
    laborUzs: number;
    fixedUzs: number;
    profilePricePerSqM: Record<PaperLayerProfileId, number>;
    offsetOneTimePrintUzs: number;
    offsetOneTimeDesignUzs: number;
};

export const DEFAULT_BOX_CALCULATOR_CONFIG: BoxCalculatorConfig = {
    markupPercent: DEFAULT_MARKUP_PERCENT,
    wasteFactor: WASTE_FACTOR,
    printGlueUzs: DEFAULT_PRINT_GLUE_UZS,
    laborUzs: DEFAULT_LABOR_UZS,
    fixedUzs: DEFAULT_FIXED_UZS,
    profilePricePerSqM: { ...PROFILE_PRICE_PER_SQM },
    offsetOneTimePrintUzs: OFFSET_ONE_TIME_PRINT_UZS,
    offsetOneTimeDesignUzs: OFFSET_ONE_TIME_DESIGN_UZS,
};

function clampPositive(n: number, fallback: number): number {
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Admin/API dan kelgan qismiy config ni default bilan birlashtiradi */
export function mergeBoxCalculatorConfig(partial?: Partial<BoxCalculatorConfig> | null): BoxCalculatorConfig {
    if (!partial) return { ...DEFAULT_BOX_CALCULATOR_CONFIG, profilePricePerSqM: { ...DEFAULT_BOX_CALCULATOR_CONFIG.profilePricePerSqM } };

    const profiles = { ...DEFAULT_BOX_CALCULATOR_CONFIG.profilePricePerSqM };
    if (partial.profilePricePerSqM) {
        for (const id of Object.keys(profiles) as PaperLayerProfileId[]) {
            if (partial.profilePricePerSqM[id] != null) {
                profiles[id] = clampPositive(partial.profilePricePerSqM[id], profiles[id]);
            }
        }
    }

    return {
        markupPercent: clampPositive(partial.markupPercent ?? DEFAULT_BOX_CALCULATOR_CONFIG.markupPercent, DEFAULT_BOX_CALCULATOR_CONFIG.markupPercent),
        wasteFactor: partial.wasteFactor != null && partial.wasteFactor >= 1
            ? partial.wasteFactor
            : DEFAULT_BOX_CALCULATOR_CONFIG.wasteFactor,
        printGlueUzs: clampPositive(partial.printGlueUzs ?? DEFAULT_BOX_CALCULATOR_CONFIG.printGlueUzs, DEFAULT_BOX_CALCULATOR_CONFIG.printGlueUzs),
        laborUzs: clampPositive(partial.laborUzs ?? DEFAULT_BOX_CALCULATOR_CONFIG.laborUzs, DEFAULT_BOX_CALCULATOR_CONFIG.laborUzs),
        fixedUzs: clampPositive(partial.fixedUzs ?? DEFAULT_BOX_CALCULATOR_CONFIG.fixedUzs, DEFAULT_BOX_CALCULATOR_CONFIG.fixedUzs),
        profilePricePerSqM: profiles,
        offsetOneTimePrintUzs: clampPositive(partial.offsetOneTimePrintUzs ?? DEFAULT_BOX_CALCULATOR_CONFIG.offsetOneTimePrintUzs, DEFAULT_BOX_CALCULATOR_CONFIG.offsetOneTimePrintUzs),
        offsetOneTimeDesignUzs: clampPositive(partial.offsetOneTimeDesignUzs ?? DEFAULT_BOX_CALCULATOR_CONFIG.offsetOneTimeDesignUzs, DEFAULT_BOX_CALCULATOR_CONFIG.offsetOneTimeDesignUzs),
    };
}
