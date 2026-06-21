import { logger } from '@/lib/logger';

describe('structured logger', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('info darajasida JSON formatda yozadi', () => {
        logger.info('Test message', { key: 'value' });

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
        expect(output.level).toBe('info');
        expect(output.message).toBe('Test message');
        expect(output.context).toEqual({ key: 'value' });
        expect(output.timestamp).toBeTruthy();
    });

    it('error darajasida xato ma\'lumotlarini yozadi', () => {
        const err = new Error('Test error');
        logger.error('Xatolik', { route: '/api/test' }, err);

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
        expect(output.level).toBe('error');
        expect(output.error.name).toBe('Error');
        expect(output.error.message).toBe('Test error');
        expect(output.error.stack).toBeTruthy();
    });

    it('warn darajasi console.warn ga yozadi', () => {
        logger.warn('Ogohlantirish');

        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        const output = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
        expect(output.level).toBe('warn');
    });

    it('kontekstsiz ishlaydi', () => {
        logger.info('Simple message');

        const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
        expect(output.context).toBeUndefined();
        expect(output.error).toBeUndefined();
    });

    it('child logger bazaviy kontekstni saqlab qoladi', () => {
        const child = logger.child({ module: 'recycling', version: '1.0' });
        child.info('Collection created', { id: 42 });

        const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
        expect(output.context).toEqual({
            module: 'recycling',
            version: '1.0',
            id: 42,
        });
    });

    it('child logger xato bilan ishlaydi', () => {
        const child = logger.child({ route: '/api/admin' });
        const err = new TypeError('Type mismatch');
        child.error('Route failed', { status: 500 }, err);

        const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
        expect(output.error.name).toBe('TypeError');
        expect(output.context.route).toBe('/api/admin');
        expect(output.context.status).toBe(500);
    });

    it('string xatoni ham serialize qiladi', () => {
        logger.error('Unknown error', {}, 'Something went wrong');

        const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
        expect(output.error.name).toBe('UnknownError');
        expect(output.error.message).toBe('Something went wrong');
    });
});
