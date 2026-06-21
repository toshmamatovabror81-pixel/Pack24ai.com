import {
    computeReportFromDate,
    ReportPeriod,
} from '@/lib/domain/recycling/supervisorReports';

describe('supervisorReports domain', () => {
    const now = new Date('2026-05-21T12:30:00');

    describe('computeReportFromDate', () => {
        it('today — kun boshiga qaytaradi', () => {
            const from = computeReportFromDate('today', now);
            expect(from.getFullYear()).toBe(2026);
            expect(from.getMonth()).toBe(4); // May = 4
            expect(from.getDate()).toBe(21);
            expect(from.getHours()).toBe(0);
            expect(from.getMinutes()).toBe(0);
            expect(from.getSeconds()).toBe(0);
        });

        it('week — 7 kun oldingi sanani qaytaradi', () => {
            const from = computeReportFromDate('week', now);
            expect(from.getDate()).toBe(14);
        });

        it('month — 1 oy oldingi sanani qaytaradi', () => {
            const from = computeReportFromDate('month', now);
            expect(from.getMonth()).toBe(3); // April = 3
            expect(from.getDate()).toBe(21);
        });

        it('turli period qiymatlarini qabul qiladi', () => {
            const periods: ReportPeriod[] = ['today', 'week', 'month'];
            for (const period of periods) {
                expect(() => computeReportFromDate(period, now)).not.toThrow();
            }
        });

        it('now parametrsiz hozirgi vaqtni ishlatadi', () => {
            const from = computeReportFromDate('today');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            expect(from.getTime()).toBe(today.getTime());
        });
    });
});
