import { describe, it, expect, jest } from '@jest/globals';

// Mock Prisma for DB polling
jest.mock('@/lib/prisma', () => ({
    prisma: {
        botEvent: {
            findMany: jest.fn().mockResolvedValue([] as never),
        },
    },
}));

import { eventBus, type RealtimeEvent } from '@/lib/platform/eventBus';

describe('EventBus', () => {
    const createTestEvent = (overrides?: Partial<RealtimeEvent>): RealtimeEvent => ({
        type: 'test.event',
        title: 'Test Event',
        message: 'Bu test event',
        severity: 'info',
        timestamp: new Date().toISOString(),
        source: 'test',
        ...overrides,
    });

    describe('subscribe va publish', () => {
        it('subscriber event oladi', () => {
            const received: RealtimeEvent[] = [];
            const unsubscribe = eventBus.subscribe((event) => {
                received.push(event);
            });

            const testEvent = createTestEvent();
            eventBus.publish(testEvent);

            expect(received).toHaveLength(1);
            expect(received[0].type).toBe('test.event');

            unsubscribe();
        });

        it('bir nechta subscriber ishlaydi', () => {
            let count1 = 0;
            let count2 = 0;

            const unsub1 = eventBus.subscribe(() => { count1++; });
            const unsub2 = eventBus.subscribe(() => { count2++; });

            eventBus.publish(createTestEvent());

            expect(count1).toBe(1);
            expect(count2).toBe(1);

            unsub1();
            unsub2();
        });
    });

    describe('unsubscribe', () => {
        it('unsubscribe qilingan subscriber event olmaydi', () => {
            let received = 0;
            const unsubscribe = eventBus.subscribe(() => { received++; });

            eventBus.publish(createTestEvent());
            expect(received).toBe(1);

            unsubscribe();

            eventBus.publish(createTestEvent());
            expect(received).toBe(1); // o'zgarmaydi
        });
    });

    describe('clientCount', () => {
        it('to\'g\'ri client sonini qaytaradi', () => {
            const initialCount = eventBus.clientCount;

            const unsub1 = eventBus.subscribe(() => {});
            expect(eventBus.clientCount).toBe(initialCount + 1);

            const unsub2 = eventBus.subscribe(() => {});
            expect(eventBus.clientCount).toBe(initialCount + 2);

            unsub1();
            expect(eventBus.clientCount).toBe(initialCount + 1);

            unsub2();
            expect(eventBus.clientCount).toBe(initialCount);
        });
    });

    describe('xato boshqaruvi', () => {
        it('xato chiqargan client olib tashlanadi', () => {
            const initialCount = eventBus.clientCount;

            eventBus.subscribe(() => {
                throw new Error('Test xatosi');
            });

            // Xato chiqargan client bor
            expect(eventBus.clientCount).toBe(initialCount + 1);

            // Publish xatoni tutadi va clientni olib tashlaydi
            eventBus.publish(createTestEvent());

            expect(eventBus.clientCount).toBe(initialCount);
        });
    });

    describe('event severity turlari', () => {
        it.each(['info', 'success', 'warning', 'error'] as const)(
            '%s severity qo\'llab-quvvatlanadi',
            (severity) => {
                const received: RealtimeEvent[] = [];
                const unsub = eventBus.subscribe((e) => received.push(e));

                eventBus.publish(createTestEvent({ severity }));

                expect(received[0].severity).toBe(severity);
                unsub();
            }
        );
    });
});
