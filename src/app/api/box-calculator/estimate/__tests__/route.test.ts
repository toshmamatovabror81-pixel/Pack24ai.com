/** @jest-environment node */

const readConfigMock = jest.fn();

jest.mock('@/lib/domain/boxCalculatorConfigStore', () => ({
    readBoxCalculatorConfig: (...args: unknown[]) => readConfigMock(...args),
}));

import { POST } from '@/app/api/box-calculator/estimate/route';
import { DEFAULT_BOX_CALCULATOR_CONFIG } from '@/lib/domain/boxCalculatorConfig';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/box-calculator/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/box-calculator/estimate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        readConfigMock.mockResolvedValue({ ...DEFAULT_BOX_CALCULATOR_CONFIG });
    });

    it('noto\'g\'ri o\'lchamda 400 qaytaradi', async () => {
        const res = await POST(makeRequest({ l: 0, w: 0, h: 0 }));
        expect(res.status).toBe(400);
    });

    it('taxminiy narxni qaytaradi, ustama ko\'rinmaydi', async () => {
        const res = await POST(makeRequest({
            l: 200, w: 150, h: 100,
            profileId: 'e-flute',
            printType: 'offset',
            needsPrint: true,
            qty: 500,
        }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(typeof data.roundedPrice).toBe('number');
        expect(data.roundedPrice).toBeGreaterThan(0);
        expect(data).not.toHaveProperty('markupPercent');
        expect(data).not.toHaveProperty('salePricePerUnit');
        expect(data.offsetPrintUzs).toBe(DEFAULT_BOX_CALCULATOR_CONFIG.offsetOneTimePrintUzs);
        expect(data.orderGrandTotal).toBeGreaterThan(data.orderSubtotal);
    });

    it('flexo uchun qtyValid tekshiradi', async () => {
        const low = await POST(makeRequest({
            l: 200, w: 150, h: 100, printType: 'flexo', qty: 500,
        }));
        const ok = await POST(makeRequest({
            l: 200, w: 150, h: 100, printType: 'flexo', qty: 1000,
        }));
        expect((await low.json()).qtyValid).toBe(false);
        expect((await ok.json()).qtyValid).toBe(true);
    });
});
