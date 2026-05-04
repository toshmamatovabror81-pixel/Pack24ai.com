/** @jest-environment node */

import {
    readEnum,
    readJsonObject,
    readOptionalEnum,
    readOptionalString,
    readPositiveIntegerQueryParam,
    readUrlString,
    RequestValidationError,
} from '@/lib/requestValidation';

describe('requestValidation helpers', () => {
    describe('readJsonObject', () => {
        it('json objectni qabul qiladi', async () => {
            const request = {
                json: jest.fn().mockResolvedValue({ mode: 'webhook' }),
            } as unknown as Request;

            await expect(readJsonObject(request)).resolves.toEqual({ mode: 'webhook' });
        });

        it('yaroqsiz json uchun xato qaytaradi', async () => {
            const request = {
                json: jest.fn().mockRejectedValue(new Error('invalid json')),
            } as unknown as Request;

            await expect(readJsonObject(request)).rejects.toThrow(RequestValidationError);
            await expect(readJsonObject(request)).rejects.toThrow('Yaroqsiz JSON body');
        });

        it('array body uchun xato qaytaradi', async () => {
            const request = {
                json: jest.fn().mockResolvedValue(['bad']),
            } as unknown as Request;

            await expect(readJsonObject(request)).rejects.toThrow('JSON object kutilgan');
        });
    });

    describe('readOptionalString', () => {
        it('stringni trim qiladi', () => {
            expect(readOptionalString('  salom  ', 'field')).toBe('salom');
        });

        it('bo\'sh stringni undefined qiladi', () => {
            expect(readOptionalString('   ', 'field')).toBeUndefined();
        });
    });

    describe('enum readers', () => {
        it('ruxsat etilgan qiymatni qabul qiladi', () => {
            expect(readEnum('polling', 'mode', ['webhook', 'polling'] as const)).toBe('polling');
            expect(readOptionalEnum('cash', 'paymentMethod', ['cash', 'click', 'payme'] as const)).toBe('cash');
        });

        it('noto\'g\'ri qiymatni rad etadi', () => {
            expect(() => readEnum('ftp', 'mode', ['webhook', 'polling'] as const)).toThrow(
                "mode quyidagilardan biri bo'lishi kerak: webhook, polling",
            );
        });
    });

    describe('readUrlString', () => {
        it('http/https urlni normalizatsiya qiladi', () => {
            expect(readUrlString('https://pack24.uz/', 'baseUrl')).toBe('https://pack24.uz');
        });

        it('noto\'g\'ri urlni rad etadi', () => {
            expect(() => readUrlString('javascript:alert(1)', 'baseUrl')).toThrow(
                "baseUrl to'g'ri URL bo'lishi kerak",
            );
        });
    });

    describe('readPositiveIntegerQueryParam', () => {
        it('musbat butun sonni qabul qiladi', () => {
            expect(readPositiveIntegerQueryParam('25', 'threshold', 10)).toBe(25);
        });

        it('bo\'sh qiymatda fallback qaytaradi', () => {
            expect(readPositiveIntegerQueryParam(null, 'threshold', 10)).toBe(10);
        });

        it('manfiy yoki kasr qiymatni rad etadi', () => {
            expect(() => readPositiveIntegerQueryParam('-1', 'threshold', 10)).toThrow(
                "threshold musbat butun son bo'lishi kerak",
            );
            expect(() => readPositiveIntegerQueryParam('3.5', 'threshold', 10)).toThrow(
                "threshold musbat butun son bo'lishi kerak",
            );
        });
    });
});
