// ─── Order Status ─────────────────────────────────────────────────────────────
export const orderStatuses = [
    'draft',
    'new',
    'processing',
    'shipping',
    'delivered',
    'cancelled',
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const orderStatusLabels: Record<OrderStatus, string> = {
    draft: 'Qoralama',
    new: 'Yangi',
    processing: 'Jarayonda',
    shipping: 'Yetkazilmoqda',
    delivered: 'Yetkazildi',
    cancelled: 'Bekor qilindi',
};

const orderTransitions: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
    draft: ['new', 'cancelled'],
    new: ['processing', 'cancelled'],
    processing: ['shipping', 'cancelled'],
    shipping: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
    return orderTransitions[from]?.includes(to) ?? false;
}

export function isOrderStatus(value: string): value is OrderStatus {
    return orderStatuses.includes(value as OrderStatus);
}

// ─── Payment Status ──────────────────────────────────────────────────────────
export const paymentStatuses = [
    'pending',
    'processing',
    'paid',
    'failed',
    'refunded',
] as const;

export type PaymentStatus = (typeof paymentStatuses)[number];

export function isPaymentStatus(value: string): value is PaymentStatus {
    return paymentStatuses.includes(value as PaymentStatus);
}

// ─── Product Status ──────────────────────────────────────────────────────────
export const productStatuses = [
    'active',
    'draft',
    'archived',
] as const;

export type ProductStatus = (typeof productStatuses)[number];

export function isProductStatus(value: string): value is ProductStatus {
    return productStatuses.includes(value as ProductStatus);
}

// ─── Work Order Status ───────────────────────────────────────────────────────
export const workOrderStatuses = [
    'planned',
    'in_progress',
    'completed',
    'paused',
    'cancelled',
] as const;

export type WorkOrderStatus = (typeof workOrderStatuses)[number];

const workOrderTransitions: Record<WorkOrderStatus, ReadonlyArray<WorkOrderStatus>> = {
    planned: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'paused', 'cancelled'],
    paused: ['in_progress', 'cancelled'],
    completed: [],
    cancelled: [],
};

export function canTransitionWorkOrderStatus(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
    return workOrderTransitions[from]?.includes(to) ?? false;
}

export function isWorkOrderStatus(value: string): value is WorkOrderStatus {
    return workOrderStatuses.includes(value as WorkOrderStatus);
}

// ─── Work Order Stage Status ─────────────────────────────────────────────────
export const workOrderStageStatuses = [
    'pending',
    'in_progress',
    'completed',
] as const;

export type WorkOrderStageStatus = (typeof workOrderStageStatuses)[number];

// ─── Work Order Priority ─────────────────────────────────────────────────────
export const workOrderPriorities = [
    'low',
    'normal',
    'high',
    'urgent',
] as const;

export type WorkOrderPriority = (typeof workOrderPriorities)[number];

// ─── Production Stages ───────────────────────────────────────────────────────
export const productionStages = [
    'gofra',
    'pechat',
    'yiguv',
    'qc',
] as const;

export type ProductionStage = (typeof productionStages)[number];

// ─── Customer Types ──────────────────────────────────────────────────────────
export const customerTypes = [
    'individual',
    'corporate',
    'wholesale',
    'dealer',
] as const;

export type CustomerType = (typeof customerTypes)[number];

// ─── Customer Groups ─────────────────────────────────────────────────────────
export const customerGroups = [
    'standard',
    'vip',
    'new',
    'inactive',
    'blocked',
] as const;

export type CustomerGroup = (typeof customerGroups)[number];

// ─── Task Status ─────────────────────────────────────────────────────────────
export const taskStatuses = [
    'pending',
    'in_progress',
    'review',
    'completed',
    'cancelled',
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

// ─── Campaign Status ─────────────────────────────────────────────────────────
export const campaignStatuses = [
    'draft',
    'scheduled',
    'sent',
] as const;

export type CampaignStatus = (typeof campaignStatuses)[number];

// ─── Complaint Status ────────────────────────────────────────────────────────
export const complaintStatuses = [
    'open',
    'in_progress',
    'resolved',
    'closed',
] as const;

export type ComplaintStatus = (typeof complaintStatuses)[number];

// ─── Recycle Request Status ───────────────────────────────────────────────────
export const recycleRequestStatuses = [
    'new',
    'dispatched',
    'assigned',
    'en_route',
    'arrived',
    'collecting',
    'collected',
    'confirmed',
    'completed',
    'disputed',
    'cancelled',
] as const;

export type RecycleRequestStatus = (typeof recycleRequestStatuses)[number];

export const recycleRequestStatusLabels: Record<RecycleRequestStatus, string> = {
    new: '🔵 Yangi',
    dispatched: '📋 Dispatch',
    assigned: '🚚 Tayinlandi',
    en_route: '🚛 Yo\'lda',
    arrived: '📍 Yetib keldi',
    collecting: '⚖️ Yig\'ilmoqda',
    collected: '✅ Yig\'ildi',
    confirmed: '🎉 Tasdiqlandi',
    completed: '✅ Yakunlandi',
    disputed: '⚠️ E\'tiroz',
    cancelled: '❌ Bekor',
};

export function isRecycleRequestStatus(v: string): v is RecycleRequestStatus {
    return recycleRequestStatuses.includes(v as RecycleRequestStatus);
}

// ─── Recycle Collection Status ────────────────────────────────────────────────
export const recycleCollectionStatuses = ['pending', 'completed', 'disputed'] as const;
export type RecycleCollectionStatus = (typeof recycleCollectionStatuses)[number];
