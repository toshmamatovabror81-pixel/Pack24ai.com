/** @jest-environment node */

import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { POST as estimatePost } from '@/app/api/box-calculator/estimate/route';
import { DEFAULT_BOX_CALCULATOR_CONFIG } from '@/lib/domain/boxCalculatorConfig';
import { clearBoxCalculatorConfigCache } from '@/lib/domain/boxCalculatorConfigStore';
import { NextRequest } from 'next/server';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'box-calculator.json');

function makeEstimateRequest(body: unknown) {
    return new NextRequest('http://localhost/api/box-calculator/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('box calculator pricing integration', () => {
    const body = {
        l: 200, w: 150, h: 100,
        profileId: 'e-flute',
        printType: 'offset',
        needsPrint: true,
        qty: 500,
    };

    afterEach(async () => {
        clearBoxCalculatorConfigCache();
        try {
            await rm(CONFIG_PATH, { force: true });
        } catch { /* ignore */ }
    });

    it('admin config o\'zgarishi estimate narxiga ta\'sir qiladi', async () => {
        await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
        await writeFile(
            CONFIG_PATH,
            JSON.stringify({ ...DEFAULT_BOX_CALCULATOR_CONFIG, markupPercent: 30 }),
        );
        clearBoxCalculatorConfigCache();

        const res30 = await estimatePost(makeEstimateRequest(body));
        const price30 = (await res30.json()).roundedPrice;

        await writeFile(
            CONFIG_PATH,
            JSON.stringify({ ...DEFAULT_BOX_CALCULATOR_CONFIG, markupPercent: 40 }),
        );
        clearBoxCalculatorConfigCache();

        const res40 = await estimatePost(makeEstimateRequest(body));
        const price40 = (await res40.json()).roundedPrice;

        expect(price40).toBeGreaterThan(price30);
    });

    it('estimate javobida ichki ustama ko\'rinmaydi', async () => {
        const res = await estimatePost(makeEstimateRequest(body));
        const data = await res.json();
        expect(data).not.toHaveProperty('markupPercent');
        expect(data).not.toHaveProperty('salePricePerUnit');
        expect(data.offsetPrintUzs).toBe(DEFAULT_BOX_CALCULATOR_CONFIG.offsetOneTimePrintUzs);
        expect(data.offsetDesignUzs).toBe(DEFAULT_BOX_CALCULATOR_CONFIG.offsetOneTimeDesignUzs);
    });
});
