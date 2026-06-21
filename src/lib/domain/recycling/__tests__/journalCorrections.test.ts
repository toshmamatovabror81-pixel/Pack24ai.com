import {
    sanitizeCorrectionDraft,
} from '@/lib/domain/recycling/journalCorrections';

describe('journalCorrections domain helpers', () => {
    describe('sanitizeCorrectionDraft', () => {
        it('manual_intake draft ni tozalaydi', () => {
            const result = sanitizeCorrectionDraft('manual_intake', {
                date: '2026-05-01T00:00:00.000Z',
                weightKg: '150.5',
                pricePerKg: '2000',
                note: 'Test izoh',
                _id: 42, // tashlanishi kerak
                extraField: true, // tashlanishi kerak
            });

            expect(result).toEqual({
                date: '2026-05-01T00:00:00.000Z',
                weightKg: 150.5,
                pricePerKg: 2000,
                note: 'Test izoh',
            });
            expect(result).not.toHaveProperty('_id');
            expect(result).not.toHaveProperty('extraField');
        });

        it('press_log draft ni tozalaydi', () => {
            const result = sanitizeCorrectionDraft('press_log', {
                date: '2026-05-01T00:00:00.000Z',
                pressedKg: '200',
                baleCount: '7.8',
                operators: 'Ali',
                note: null,
            });

            expect(result).toEqual({
                date: '2026-05-01T00:00:00.000Z',
                pressedKg: 200,
                baleCount: 8, // Math.round
                operators: 'Ali',
                note: null,
            });
        });

        it('expense_log draft — nollik qiymatlar', () => {
            const result = sanitizeCorrectionDraft('expense_log', {
                date: '2026-05-01T00:00:00.000Z',
                expenseAmount: undefined,
                advanceAmount: 0,
                comment: undefined,
            });

            expect(result).toEqual({
                date: '2026-05-01T00:00:00.000Z',
                expenseAmount: 0, // undefined → NaN → 0 (|| 0)
                advanceAmount: 0,
                comment: null, // undefined ?? null
            });
        });

        it('daily_cash draft ni tozalaydi', () => {
            const result = sanitizeCorrectionDraft('daily_cash', {
                date: '2026-05-01T00:00:00.000Z',
                openingBalance: '500000',
                note: 'Ochilish',
            });

            expect(result).toEqual({
                date: '2026-05-01T00:00:00.000Z',
                openingBalance: 500000,
                note: 'Ochilish',
            });
        });

        it('sales_log draft ni tozalaydi', () => {
            const result = sanitizeCorrectionDraft('sales_log', {
                date: '2026-05-01T00:00:00.000Z',
                customerName: 123, // String() orqali
                weightKg: '500',
                baleCount: '3.2',
                pricePerKg: '1500',
                vehicleType: null,
                plateNumber: undefined,
                note: 'Sotuv',
            });

            expect(result).toEqual({
                date: '2026-05-01T00:00:00.000Z',
                customerName: '123',
                weightKg: 500,
                baleCount: 3, // Math.round
                pricePerKg: 1500,
                vehicleType: null,
                plateNumber: null, // undefined ?? null
                note: 'Sotuv',
            });
        });

        it('noma\'lum entity uchun draft ni o\'zgartirmaydi', () => {
            const draft = { date: '2026-01-01', foo: 'bar' };
            const result = sanitizeCorrectionDraft('unknown_type' as any, draft);
            expect(result).toBe(draft);
        });
    });
});
