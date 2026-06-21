import {
    isValidPickupType,
    isValidPickupLocationMode,
    canTransition,
    assertTransition,
    PICKUP_TYPES,
    PICKUP_LOCATION_MODES,
    RECYCLE_REQUEST_STATUSES,
    RECYCLE_REQUEST_TRANSITIONS,
} from '@/lib/domain/recycleRequestTypes';

describe('recycleRequestTypes domain', () => {
    describe('isValidPickupType', () => {
        it.each(PICKUP_TYPES as unknown as string[])('"%s" ni qabul qiladi', (type) => {
            expect(isValidPickupType(type)).toBe(true);
        });

        it('noto\'g\'ri qiymatni rad etadi', () => {
            expect(isValidPickupType('drone')).toBe(false);
            expect(isValidPickupType('')).toBe(false);
            expect(isValidPickupType(null)).toBe(false);
            expect(isValidPickupType(123)).toBe(false);
        });
    });

    describe('isValidPickupLocationMode', () => {
        it.each(PICKUP_LOCATION_MODES as unknown as string[])('"%s" ni qabul qiladi', (mode) => {
            expect(isValidPickupLocationMode(mode)).toBe(true);
        });

        it('noto\'g\'ri qiymatni rad etadi', () => {
            expect(isValidPickupLocationMode('manual')).toBe(false);
        });
    });

    describe('canTransition', () => {
        it('ruxsat etilgan o\'tishni tasdiqlaydi', () => {
            expect(canTransition('new', 'dispatched')).toBe(true);
            expect(canTransition('dispatched', 'assigned')).toBe(true);
            expect(canTransition('assigned', 'en_route')).toBe(true);
            expect(canTransition('collecting', 'collected')).toBe(true);
            expect(canTransition('confirmed', 'completed')).toBe(true);
        });

        it('taqiqlangan o\'tishni rad etadi', () => {
            expect(canTransition('new', 'completed')).toBe(false);
            expect(canTransition('completed', 'new')).toBe(false);
            expect(canTransition('cancelled', 'assigned')).toBe(false);
        });

        it('terminal statuslardan o\'tish mumkin emas', () => {
            expect(RECYCLE_REQUEST_TRANSITIONS.completed).toEqual([]);
            expect(RECYCLE_REQUEST_TRANSITIONS.cancelled).toEqual([]);
            expect(canTransition('completed', 'cancelled')).toBe(false);
            expect(canTransition('cancelled', 'completed')).toBe(false);
        });

        it('disputed dan qayta ko\'rib chiqish mumkin', () => {
            expect(canTransition('disputed', 'collecting')).toBe(true);
            expect(canTransition('disputed', 'cancelled')).toBe(true);
            expect(canTransition('disputed', 'completed')).toBe(true);
        });

        it('har qanday faol statusdan bekor qilish mumkin', () => {
            const cancellable = RECYCLE_REQUEST_STATUSES.filter(
                (s) => RECYCLE_REQUEST_TRANSITIONS[s].includes('cancelled')
            );
            expect(cancellable.length).toBeGreaterThan(5);
        });
    });

    describe('assertTransition', () => {
        it('ruxsat etilgan o\'tishda yangi statusni qaytaradi', () => {
            expect(assertTransition('new', 'dispatched')).toBe('dispatched');
        });

        it('taqiqlangan o\'tishda xato tashlaydi', () => {
            expect(() => assertTransition('completed', 'new')).toThrow(
                /Status o'tishi taqiqlangan/
            );
        });

        it('xato xabarida ruxsat etilgan statuslar ko\'rsatiladi', () => {
            try {
                assertTransition('new', 'completed');
            } catch (e) {
                expect((e as Error).message).toContain('dispatched');
                expect((e as Error).message).toContain('cancelled');
            }
        });
    });
});
