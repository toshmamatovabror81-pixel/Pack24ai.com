/**
 * RecycleRequest — typed source-of-truth
 *
 * RecycleRequest.pickupType, pickupLocationMode va status transition matritsasi.
 * Status'lar allaqachon Prisma enum (RecycleRequestStatus) sifatida mavjud,
 * lekin transition map va runtime validatsiya shu yerda.
 */

// ── RecycleRequest.pickupType ─────────────────────────────────────────────

export const PICKUP_TYPES = ['base', 'pickup'] as const;
export type PickupType = (typeof PICKUP_TYPES)[number];

export const PICKUP_TYPE_LABELS: Record<PickupType, string> = {
    base: '🏭 Bazaga olib kelish',
    pickup: '🚛 Haydovchi chaqirish',
};

export function isValidPickupType(value: unknown): value is PickupType {
    return typeof value === 'string' && (PICKUP_TYPES as readonly string[]).includes(value);
}

// ── RecycleRequest.pickupLocationMode ─────────────────────────────────────

export const PICKUP_LOCATION_MODES = ['gps', 'map', 'text'] as const;
export type PickupLocationMode = (typeof PICKUP_LOCATION_MODES)[number];

export const PICKUP_LOCATION_MODE_LABELS: Record<PickupLocationMode, string> = {
    gps: '📍 GPS joylashuv',
    map: '🗺️ Xaritadan tanlash',
    text: '✍️ Manzil yozish',
};

export function isValidPickupLocationMode(value: unknown): value is PickupLocationMode {
    return typeof value === 'string' && (PICKUP_LOCATION_MODES as readonly string[]).includes(value);
}

// ── RecycleRequest.status transition map ──────────────────────────────────

/**
 * Status values — mirrors Prisma enum RecycleRequestStatus
 * Uses the Prisma-generated enum names (with _ suffix for "new")
 */
export const RECYCLE_REQUEST_STATUSES = [
    'new',
    'dispatched',
    'assigned',
    'en_route',
    'arrived',
    'collecting',
    'collected',
    'confirmed',
    'completed',
    'cancelled',
    'disputed',
] as const;
export type RecycleRequestStatusValue = (typeof RECYCLE_REQUEST_STATUSES)[number];

export const RECYCLE_REQUEST_STATUS_LABELS: Record<RecycleRequestStatusValue, string> = {
    new: '🆕 Yangi',
    dispatched: '📤 Yo\'naltirilgan',
    assigned: '👷 Tayinlangan',
    en_route: '🚗 Yo\'lda',
    arrived: '📍 Yetib keldi',
    collecting: '📦 Yig\'ilmoqda',
    collected: '✅ Yig\'ildi',
    confirmed: '🤝 Tasdiqlangan',
    completed: '🏁 Yakunlangan',
    cancelled: '❌ Bekor qilingan',
    disputed: '⚠️ Bahsli',
};

/**
 * Status transition matrix — qaysi statusdan qaysi statusga o'tish mumkin.
 * Agar status shu yerda yo'q — undan hech qayerga o'tib bo'lmaydi (terminal state).
 */
export const RECYCLE_REQUEST_TRANSITIONS: Record<RecycleRequestStatusValue, RecycleRequestStatusValue[]> = {
    new: ['dispatched', 'cancelled'],
    dispatched: ['assigned', 'cancelled'],
    assigned: ['en_route', 'cancelled'],
    en_route: ['arrived', 'cancelled'],
    arrived: ['collecting', 'cancelled'],
    collecting: ['collected', 'cancelled'],
    collected: ['confirmed', 'disputed'],
    confirmed: ['completed'],
    completed: [],           // Terminal state
    cancelled: [],           // Terminal state
    disputed: ['collecting', 'cancelled', 'completed'], // Qayta ko'rib chiqish mumkin
};

/**
 * Check if a status transition is allowed.
 */
export function canTransition(
    from: RecycleRequestStatusValue,
    to: RecycleRequestStatusValue,
): boolean {
    const allowed = RECYCLE_REQUEST_TRANSITIONS[from];
    return allowed?.includes(to) ?? false;
}

/**
 * Validate and perform a status transition.
 * Returns the new status or throws an error if the transition is invalid.
 */
export function assertTransition(
    from: RecycleRequestStatusValue,
    to: RecycleRequestStatusValue,
): RecycleRequestStatusValue {
    if (!canTransition(from, to)) {
        const allowed = RECYCLE_REQUEST_TRANSITIONS[from];
        throw new Error(
            `Status o'tishi taqiqlangan: "${from}" → "${to}". ` +
            `Ruxsat etilgan: [${allowed?.join(', ') ?? 'hech qaysi'}]`,
        );
    }
    return to;
}
