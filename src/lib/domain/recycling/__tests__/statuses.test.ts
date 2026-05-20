import {
    canTransitionRecycleRequestStatus,
    isRecycleCollectionPaymentStatus,
} from '@/lib/domain/recycling/statuses';
import { RecycleRequestStatus } from '@prisma/client';

describe('recycling statuses', () => {
    it('new dan assigned ga otishga ruxsat beradi', () => {
        expect(canTransitionRecycleRequestStatus(RecycleRequestStatus.new_, RecycleRequestStatus.assigned)).toBe(true);
    });

    it('assigned dan collected ga toggridan-toggri otishga ruxsat bermaydi', () => {
        expect(canTransitionRecycleRequestStatus(RecycleRequestStatus.assigned, RecycleRequestStatus.collected)).toBe(false);
    });

    it('collecting dan collected ga otishga ruxsat beradi', () => {
        expect(canTransitionRecycleRequestStatus(RecycleRequestStatus.collecting, RecycleRequestStatus.collected)).toBe(true);
    });

    it('completed dan boshqa statusga otishga ruxsat bermaydi', () => {
        expect(canTransitionRecycleRequestStatus(RecycleRequestStatus.completed, RecycleRequestStatus.cancelled)).toBe(false);
    });

    it('toggri payment statusni taniydi', () => {
        expect(isRecycleCollectionPaymentStatus('pending')).toBe(true);
        expect(isRecycleCollectionPaymentStatus('paid_both')).toBe(true);
    });

    it('notoggri payment statusni rad etadi', () => {
        expect(isRecycleCollectionPaymentStatus('paid')).toBe(false);
        expect(isRecycleCollectionPaymentStatus('unknown')).toBe(false);
    });
});
