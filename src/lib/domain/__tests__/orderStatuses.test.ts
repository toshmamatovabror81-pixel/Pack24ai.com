import {
    orderStatuses,
    orderStatusLabels,
    canTransitionOrderStatus,
    isOrderStatus,
    paymentStatuses,
    isPaymentStatus,
    productStatuses,
    isProductStatus,
    workOrderStatuses,
    canTransitionWorkOrderStatus,
    isWorkOrderStatus,
    workOrderStageStatuses,
    workOrderPriorities,
    productionStages,
    customerTypes,
    customerGroups,
    taskStatuses,
    campaignStatuses,
    complaintStatuses,
    recycleRequestStatuses,
    recycleRequestStatusLabels,
    isRecycleRequestStatus,
    recycleCollectionStatuses,
    type OrderStatus,
    type WorkOrderStatus,
    type RecycleRequestStatus,
} from '../orderStatuses';

// ─── Order Status ────────────────────────────────────────────────────────

describe('orderStatuses', () => {
    it('contains all 6 statuses', () => {
        expect(orderStatuses).toHaveLength(6);
        expect(orderStatuses).toEqual([
            'draft', 'new', 'processing', 'shipping', 'delivered', 'cancelled',
        ]);
    });

    it('has Uzbek labels for every status', () => {
        for (const s of orderStatuses) {
            expect(orderStatusLabels[s]).toBeDefined();
            expect(typeof orderStatusLabels[s]).toBe('string');
        }
    });
});

describe('canTransitionOrderStatus', () => {
    const allowed: [OrderStatus, OrderStatus][] = [
        ['draft', 'new'],
        ['draft', 'cancelled'],
        ['new', 'processing'],
        ['new', 'cancelled'],
        ['processing', 'shipping'],
        ['processing', 'cancelled'],
        ['shipping', 'delivered'],
        ['shipping', 'cancelled'],
    ];

    it.each(allowed)('%s → %s is allowed', (from, to) => {
        expect(canTransitionOrderStatus(from, to)).toBe(true);
    });

    const forbidden: [OrderStatus, OrderStatus][] = [
        ['draft', 'processing'],
        ['draft', 'shipping'],
        ['draft', 'delivered'],
        ['new', 'draft'],
        ['new', 'delivered'],
        ['processing', 'draft'],
        ['processing', 'new'],
        ['shipping', 'draft'],
        ['shipping', 'processing'],
        ['delivered', 'cancelled'],
        ['delivered', 'new'],
        ['delivered', 'draft'],
        ['cancelled', 'new'],
        ['cancelled', 'draft'],
        ['cancelled', 'processing'],
    ];

    it.each(forbidden)('%s → %s is forbidden', (from, to) => {
        expect(canTransitionOrderStatus(from, to)).toBe(false);
    });

    it('terminal states have no transitions', () => {
        for (const target of orderStatuses) {
            expect(canTransitionOrderStatus('delivered', target)).toBe(false);
            expect(canTransitionOrderStatus('cancelled', target)).toBe(false);
        }
    });
});

describe('isOrderStatus', () => {
    it.each(orderStatuses)('"%s" is valid', (s: OrderStatus) => {
        expect(isOrderStatus(s)).toBe(true);
    });

    it.each(['invalid', '', 'DRAFT', 'New', 'unknown', '123'])(
        '"%s" is invalid',
        (s) => {
            expect(isOrderStatus(s)).toBe(false);
        },
    );
});

// ─── Payment Status ──────────────────────────────────────────────────────

describe('isPaymentStatus', () => {
    it.each(paymentStatuses)('"%s" is valid', (s) => {
        expect(isPaymentStatus(s)).toBe(true);
    });

    it('rejects invalid values', () => {
        expect(isPaymentStatus('invalid')).toBe(false);
        expect(isPaymentStatus('')).toBe(false);
    });
});

// ─── Product Status ──────────────────────────────────────────────────────

describe('isProductStatus', () => {
    it.each(productStatuses)('"%s" is valid', (s) => {
        expect(isProductStatus(s)).toBe(true);
    });

    it('rejects invalid values', () => {
        expect(isProductStatus('deleted')).toBe(false);
    });
});

// ─── Work Order Status ───────────────────────────────────────────────────

describe('canTransitionWorkOrderStatus', () => {
    const allowed: [WorkOrderStatus, WorkOrderStatus][] = [
        ['planned', 'in_progress'],
        ['planned', 'cancelled'],
        ['in_progress', 'completed'],
        ['in_progress', 'paused'],
        ['in_progress', 'cancelled'],
        ['paused', 'in_progress'],
        ['paused', 'cancelled'],
    ];

    it.each(allowed)('%s → %s is allowed', (from, to) => {
        expect(canTransitionWorkOrderStatus(from, to)).toBe(true);
    });

    const forbidden: [WorkOrderStatus, WorkOrderStatus][] = [
        ['planned', 'completed'],
        ['planned', 'paused'],
        ['in_progress', 'planned'],
        ['paused', 'completed'],
        ['completed', 'planned'],
        ['completed', 'in_progress'],
        ['cancelled', 'planned'],
        ['cancelled', 'in_progress'],
    ];

    it.each(forbidden)('%s → %s is forbidden', (from, to) => {
        expect(canTransitionWorkOrderStatus(from, to)).toBe(false);
    });

    it('terminal states have no transitions', () => {
        for (const target of workOrderStatuses) {
            expect(canTransitionWorkOrderStatus('completed', target)).toBe(false);
            expect(canTransitionWorkOrderStatus('cancelled', target)).toBe(false);
        }
    });
});

describe('isWorkOrderStatus', () => {
    it.each(workOrderStatuses)('"%s" is valid', (s) => {
        expect(isWorkOrderStatus(s)).toBe(true);
    });

    it('rejects invalid values', () => {
        expect(isWorkOrderStatus('running')).toBe(false);
    });
});

// ─── Recycle Request Status ──────────────────────────────────────────────

describe('recycleRequestStatuses', () => {
    it('contains all 11 statuses', () => {
        expect(recycleRequestStatuses).toHaveLength(11);
    });

    it('has labels for every status', () => {
        for (const s of recycleRequestStatuses) {
            expect(recycleRequestStatusLabels[s]).toBeDefined();
            expect(typeof recycleRequestStatusLabels[s]).toBe('string');
        }
    });
});

describe('isRecycleRequestStatus', () => {
    it.each(recycleRequestStatuses)('"%s" is valid', (s: RecycleRequestStatus) => {
        expect(isRecycleRequestStatus(s)).toBe(true);
    });

    it('rejects invalid values', () => {
        expect(isRecycleRequestStatus('pending')).toBe(false);
        expect(isRecycleRequestStatus('CANCELLED')).toBe(false);
    });
});

// ─── Const arrays completeness ──────────────────────────────────────────

describe('const arrays integrity', () => {
    it('paymentStatuses has 5 entries', () => {
        expect(paymentStatuses).toHaveLength(5);
    });

    it('productStatuses has 3 entries', () => {
        expect(productStatuses).toHaveLength(3);
    });

    it('workOrderStatuses has 5 entries', () => {
        expect(workOrderStatuses).toHaveLength(5);
    });

    it('workOrderStageStatuses has 3 entries', () => {
        expect(workOrderStageStatuses).toHaveLength(3);
    });

    it('workOrderPriorities has 4 entries', () => {
        expect(workOrderPriorities).toHaveLength(4);
    });

    it('productionStages has 4 entries', () => {
        expect(productionStages).toHaveLength(4);
        expect(productionStages).toContain('gofra');
        expect(productionStages).toContain('qc');
    });

    it('customerTypes has 4 entries', () => {
        expect(customerTypes).toHaveLength(4);
    });

    it('customerGroups has 5 entries', () => {
        expect(customerGroups).toHaveLength(5);
    });

    it('taskStatuses has 5 entries', () => {
        expect(taskStatuses).toHaveLength(5);
    });

    it('campaignStatuses has 3 entries', () => {
        expect(campaignStatuses).toHaveLength(3);
    });

    it('complaintStatuses has 4 entries', () => {
        expect(complaintStatuses).toHaveLength(4);
    });

    it('recycleCollectionStatuses has 3 entries', () => {
        expect(recycleCollectionStatuses).toHaveLength(3);
    });
});
