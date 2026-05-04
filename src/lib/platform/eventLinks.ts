export type AdminEventLinkInput = {
    eventType?: string | null;
    entityType?: string | null;
    entityId?: number | null;
    requestId?: number | null;
    /** Arizalar yorog‘i `requestStatus=…` (ariza holati, masalan `completed`) */
    requestStatus?: string | null;
    collectionId?: number | null;
    supervisorId?: number | null;
    driverId?: number | null;
    pointId?: number | null;
};

const JOURNAL_ENTITY_TYPES = new Set([
    'recycle_manual_intake',
    'recycle_press_log',
    'recycle_expense_log',
    'recycle_daily_cash',
    'recycle_sales_log',
]);

export function getAdminRequestHref(
    requestId?: number | null,
    options?: { requestStatus?: string | null },
): string | null {
    if (!requestId) return null;
    const q = new URLSearchParams();
    q.set('tab', 'requests');
    q.set('requestId', String(requestId));
    if (options?.requestStatus) {
        q.set('requestStatus', String(options.requestStatus));
    }
    return `/admin/recycling?${q.toString()}`;
}

export function getAdminCollectionHref(collectionId?: number | null): string | null {
    if (!collectionId) return null;
    return `/admin/recycling?tab=collections&collectionId=${collectionId}`;
}

export function getAdminSupervisorHref(supervisorId?: number | null): string | null {
    if (!supervisorId) return null;
    return `/admin/recycling?tab=supervisors&supervisorId=${supervisorId}`;
}

export function getAdminDriverHref(driverId?: number | null): string | null {
    if (!driverId) return null;
    return `/admin/recycling?tab=drivers&driverId=${driverId}`;
}

export function getAdminPointHref(pointId?: number | null): string | null {
    if (!pointId) return null;
    return `/admin/recycling?tab=points&pointId=${pointId}`;
}

export function getAdminEventHref(event: AdminEventLinkInput): string | null {
    if (event.entityType === 'order' && event.entityId) {
        return `/admin/orders?search=${event.entityId}`;
    }

    if (
        (event.eventType && event.eventType.startsWith('journal.')) ||
        (event.entityType && JOURNAL_ENTITY_TYPES.has(event.entityType))
    ) {
        const q = new URLSearchParams();
        q.set('tab', 'journal');
        if (event.pointId) q.set('pointId', String(event.pointId));
        if (event.supervisorId) q.set('supervisorId', String(event.supervisorId));
        return `/admin/recycling?${q.toString()}`;
    }

    if (event.eventType?.startsWith('complaint.') || event.entityType === 'recycle_complaint') {
        const q = new URLSearchParams();
        q.set('tab', 'complaints');
        if (event.requestId) q.set('requestId', String(event.requestId));
        if (event.pointId) q.set('pointId', String(event.pointId));
        return `/admin/recycling?${q.toString()}`;
    }

    if (event.entityType === 'recycle_request' && event.entityId) {
        return getAdminRequestHref(event.entityId, { requestStatus: event.requestStatus });
    }

    if (event.entityType === 'recycle_collection') {
        if (event.requestId) {
            return getAdminRequestHref(event.requestId, { requestStatus: event.requestStatus });
        }
        if (event.entityId) {
            return getAdminCollectionHref(event.entityId);
        }
    }

    if (event.entityType === 'inventory') {
        return '/admin/products/warehouse';
    }

    if (event.requestId) {
        return getAdminRequestHref(event.requestId, { requestStatus: event.requestStatus });
    }

    if (event.collectionId) {
        return getAdminCollectionHref(event.collectionId);
    }

    if (event.driverId) {
        return getAdminDriverHref(event.driverId);
    }

    if (event.supervisorId) {
        return getAdminSupervisorHref(event.supervisorId);
    }

    if (event.pointId) {
        return getAdminPointHref(event.pointId);
    }

    return null;
}
