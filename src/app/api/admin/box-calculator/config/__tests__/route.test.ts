/** @jest-environment node */

const verifyAdminAuthMock = jest.fn();
const readConfigMock = jest.fn();
const writeConfigMock = jest.fn();

jest.mock('@/lib/adminAuth', () => ({
    verifyAdminAuth: (...args: unknown[]) => verifyAdminAuthMock(...args),
}));

jest.mock('@/lib/domain/boxCalculatorConfigStore', () => ({
    readBoxCalculatorConfig: (...args: unknown[]) => readConfigMock(...args),
    writeBoxCalculatorConfig: (...args: unknown[]) => writeConfigMock(...args),
}));

import { GET, PUT } from '@/app/api/admin/box-calculator/config/route';
import { DEFAULT_BOX_CALCULATOR_CONFIG } from '@/lib/domain/boxCalculatorConfig';
import { NextRequest, NextResponse } from 'next/server';

function makeRequest(method: string, body?: unknown) {
    return new NextRequest('http://localhost/api/admin/box-calculator/config', {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
}

describe('/api/admin/box-calculator/config', () => {
    const savedConfig = { ...DEFAULT_BOX_CALCULATOR_CONFIG, markupPercent: 40 };

    beforeEach(() => {
        jest.clearAllMocks();
        verifyAdminAuthMock.mockResolvedValue(null);
        readConfigMock.mockResolvedValue(DEFAULT_BOX_CALCULATOR_CONFIG);
        writeConfigMock.mockResolvedValue(savedConfig);
    });

    it('GET authsiz 401 qaytaradi', async () => {
        verifyAdminAuthMock.mockResolvedValue(
            NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        );

        const res = await GET(makeRequest('GET'));
        expect(res.status).toBe(401);
        expect(readConfigMock).not.toHaveBeenCalled();
    });

    it('GET admin config qaytaradi', async () => {
        const res = await GET(makeRequest('GET'));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.markupPercent).toBe(DEFAULT_BOX_CALCULATOR_CONFIG.markupPercent);
        expect(readConfigMock).toHaveBeenCalled();
    });

    it('PUT authsiz 401 qaytaradi', async () => {
        verifyAdminAuthMock.mockResolvedValue(
            NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        );

        const res = await PUT(makeRequest('PUT', { markupPercent: 40 }));
        expect(res.status).toBe(401);
        expect(writeConfigMock).not.toHaveBeenCalled();
    });

    it('PUT config saqlaydi va markup qaytaradi', async () => {
        const res = await PUT(makeRequest('PUT', { markupPercent: 40 }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.markupPercent).toBe(40);
        expect(writeConfigMock).toHaveBeenCalled();
    });
});
