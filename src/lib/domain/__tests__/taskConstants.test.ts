import {
    TASK_DEPARTMENTS,
    TASK_PRIORITIES,
    TASK_STATUSES,
    DEPARTMENT_LABELS,
    PRIORITY_LABELS,
    STATUS_LABELS,
    canTransitionTaskStatus,
    type TaskStatus,
} from '../taskConstants';

describe('TASK_DEPARTMENTS', () => {
    it('has 5 departments', () => {
        expect(TASK_DEPARTMENTS).toHaveLength(5);
        expect(TASK_DEPARTMENTS).toContain('warehouse');
        expect(TASK_DEPARTMENTS).toContain('logistics');
        expect(TASK_DEPARTMENTS).toContain('production');
        expect(TASK_DEPARTMENTS).toContain('household');
        expect(TASK_DEPARTMENTS).toContain('general');
    });

    it('has labels for all departments', () => {
        for (const d of TASK_DEPARTMENTS) {
            expect(DEPARTMENT_LABELS[d]).toBeDefined();
            expect(typeof DEPARTMENT_LABELS[d]).toBe('string');
        }
    });
});

describe('TASK_PRIORITIES', () => {
    it('has 4 priorities in correct order', () => {
        expect(TASK_PRIORITIES).toEqual(['low', 'normal', 'high', 'urgent']);
    });

    it('has labels for all priorities', () => {
        for (const p of TASK_PRIORITIES) {
            expect(PRIORITY_LABELS[p]).toBeDefined();
        }
    });
});

describe('TASK_STATUSES', () => {
    it('has 5 statuses', () => {
        expect(TASK_STATUSES).toEqual([
            'pending', 'in_progress', 'review', 'completed', 'cancelled',
        ]);
    });

    it('has labels for all statuses', () => {
        for (const s of TASK_STATUSES) {
            expect(STATUS_LABELS[s]).toBeDefined();
        }
    });
});

describe('canTransitionTaskStatus', () => {
    const allowed: [TaskStatus, TaskStatus][] = [
        ['pending', 'in_progress'],
        ['pending', 'cancelled'],
        ['in_progress', 'review'],
        ['in_progress', 'completed'],
        ['in_progress', 'cancelled'],
        ['review', 'completed'],
        ['review', 'in_progress'],
    ];

    it.each(allowed)('%s → %s is allowed', (from, to) => {
        expect(canTransitionTaskStatus(from, to)).toBe(true);
    });

    const forbidden: [TaskStatus, TaskStatus][] = [
        ['pending', 'review'],
        ['pending', 'completed'],
        ['in_progress', 'pending'],
        ['review', 'pending'],
        ['review', 'cancelled'],
        ['completed', 'pending'],
        ['completed', 'in_progress'],
        ['completed', 'review'],
        ['completed', 'cancelled'],
        ['cancelled', 'pending'],
        ['cancelled', 'in_progress'],
        ['cancelled', 'review'],
        ['cancelled', 'completed'],
    ];

    it.each(forbidden)('%s → %s is forbidden', (from, to) => {
        expect(canTransitionTaskStatus(from, to)).toBe(false);
    });

    it('completed is a terminal state', () => {
        for (const target of TASK_STATUSES) {
            expect(canTransitionTaskStatus('completed', target)).toBe(false);
        }
    });

    it('cancelled is a terminal state', () => {
        for (const target of TASK_STATUSES) {
            expect(canTransitionTaskStatus('cancelled', target)).toBe(false);
        }
    });
});
