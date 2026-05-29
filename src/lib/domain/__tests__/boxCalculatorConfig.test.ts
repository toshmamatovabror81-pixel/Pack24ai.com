import { mergeBoxCalculatorConfig, DEFAULT_BOX_CALCULATOR_CONFIG } from '../boxCalculatorConfig';

describe('mergeBoxCalculatorConfig', () => {
    it('returns defaults when partial is null', () => {
        const c = mergeBoxCalculatorConfig(null);
        expect(c.markupPercent).toBe(DEFAULT_BOX_CALCULATOR_CONFIG.markupPercent);
        expect(c.profilePricePerSqM['e-flute']).toBe(7000);
    });

    it('merges profile prices', () => {
        const c = mergeBoxCalculatorConfig({
            profilePricePerSqM: { 'e-flute': 5000 },
        } as Partial<import('../boxCalculatorConfig').BoxCalculatorConfig>);
        expect(c.profilePricePerSqM['e-flute']).toBe(5000);
        expect(c.profilePricePerSqM['b-flute']).toBe(7000);
    });

    it('clamps invalid markup to default', () => {
        const c = mergeBoxCalculatorConfig({ markupPercent: -5 });
        expect(c.markupPercent).toBe(DEFAULT_BOX_CALCULATOR_CONFIG.markupPercent);
    });
});
