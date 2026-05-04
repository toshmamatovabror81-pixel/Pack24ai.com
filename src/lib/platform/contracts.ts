import type { Prisma } from '@prisma/client';

export type PlatformEventSource =
    | 'customer'
    | 'driver'
    | 'supervisor'
    | 'pack24admin'
    | 'platform';

export type PlatformEventSeverity = 'info' | 'success' | 'warning' | 'error';
export type PlatformEventStatus = 'new' | 'read' | 'archived';

/**
 * Tanilgan `eventType` roʻyxati: buyurtmalar, qayta ishlash (admin + botlar), ombor, jurnal, shikoyat.
 * `PublishPlatformEventInput.type` hali ham `| (string & {})` — yangi eventlar tiplarsiz ham berilishi mumkin.
 */
export type PlatformEventType =
    | 'order.created'
    | 'order.notification_requested'
    | 'inventory.low_stock_alert_sent'
    | 'inventory.low_stock_detected'
    // Website / public API: qayta ishlash arizasi
    | 'request.created'
    // Customer bot: yig‘im / ariza
    | 'collection.confirmed'
    | 'collection.disputed'
    // Driver / supervisor (Telegram): ariza va yig‘im hayoti
    | 'request.accepted'
    | 'request.rejected'
    | 'request.en_route'
    | 'request.arrived'
    | 'request.assigned'
    | 'collection.created'
    | 'driver.registered'
    | 'driver.online'
    | 'driver.offline'
    // Pack24 admin bot: haydovchi / masul / HQ
    | 'driver.activated'
    | 'driver.blocked'
    | 'driver.code_reset'
    | 'supervisor.activated'
    | 'supervisor.blocked'
    | 'supervisor.code_reset'
    | 'hq_admin.registered'
    // Masul jurnali
    | 'journal.intake.created'
    | 'journal.press.created'
    | 'journal.expense.created'
    | 'journal.sale.created'
    | 'journal.cash.created'
    | 'journal.cash.updated'
    // Callback (masul)
    | 'payment.completed'
    | 'point.accepting_toggled'
    // Platform admin API: ariza va yig‘im
    | 'recycling.request.dispatched'
    | 'recycling.request.cancelled'
    | 'recycling.request.completed'
    | 'recycling.request.confirmed'
    | 'recycling.request.disputed'
    | 'recycling.request.status_updated'
    | 'recycling.collection.collected'
    | 'recycling.collection.started'
    | 'recycling.driver.assigned'
    | 'recycling.driver.en_route'
    | 'recycling.driver.arrived'
    | 'recycling.collection.delivered'
    | 'recycling.collection.delivery_updated'
    | 'recycling.payment.updated'
    // Shikoyat moduli
    | 'complaint.created'
    | 'complaint.updated';

export interface PublishPlatformEventInput {
    source: PlatformEventSource;
    type: PlatformEventType | (string & {});
    entityType?: string;
    entityId?: number;
    severity?: PlatformEventSeverity;
    title: string;
    message: string;
    status?: PlatformEventStatus;
    dedupeKey?: string;
    payload?: Prisma.InputJsonValue;
    requestId?: number;
    collectionId?: number;
    supervisorId?: number;
    driverId?: number;
    pointId?: number;
    userId?: number;
    notifyAdmins?: boolean;
    telegramText?: string;
}

export interface OrderMessageItem {
    name: string;
    quantity: number;
    price: number;
}

export interface WebsiteOrderTelegramNotification {
    id: number;
    customerName: string | null;
    contactPhone: string | null;
    shippingAddress: string | null;
    shippingLocation?: string | null;
    totalAmount: number | null;
    status: string;
    paymentMethod?: string | null;
    deliveryMethod?: string | null;
    items: OrderMessageItem[];
}

export interface ManualOrderTelegramNotification {
    id?: string | number | null;
    contactName?: string | null;
    contactPhone?: string | null;
    address?: string | null;
    comment?: string | null;
    totalAmount?: number | null;
    items: OrderMessageItem[];
}

export interface LowStockAlertItem {
    name: string;
    quantity: number;
    sku?: string | null;
}
