import { MaterialType } from '@prisma/client';

const VALID_MATERIAL_TYPES = new Set<string>([
    'qogoz', 'karton', 'gazeta', 'jurnal', 'ofis', 'kitob', 'aralash', 'sellofan', 'plastik',
]);

export interface CreateCollectionInput {
    requestId: number;
    driverId: number;
    actualWeight: number;
    discountPercent: number;
    pricePerKg: number;
    materialType: MaterialType | null;
    notes: string | null;
    discountReason: string | null;
}

export interface CollectionCalculationResult {
    effectiveWeight: number;
    totalAmount: number;
    ecoPoints: number;
}

export function calculateCollectionAmounts(
    actualWeight: number,
    discountPercent: number,
    pricePerKg: number
): CollectionCalculationResult {
    const effectiveWeight = Math.max(0, actualWeight - (actualWeight * discountPercent / 100));
    const totalAmount = Math.round(effectiveWeight * pricePerKg);

    return {
        effectiveWeight,
        totalAmount,
        ecoPoints: Math.max(1, Math.round(effectiveWeight)),
    };
}

function parseNumericInput(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value);
    return Number.NaN;
}

export function normalizeCreateCollectionInput(body: Record<string, unknown>): {
    ok: true;
    data: CreateCollectionInput;
} | {
    ok: false;
    error: string;
} {
    const requestId = parseNumericInput(body.requestId);
    const driverId = parseNumericInput(body.driverId);
    const actualWeight = parseNumericInput(body.actualWeight);
    const discountPercent = body.discountPercent === undefined
        ? 0
        : parseNumericInput(body.discountPercent);
    const pricePerKg = parseNumericInput(body.pricePerKg);

    if (!Number.isFinite(requestId) || requestId <= 0) {
        return { ok: false, error: 'requestId majburiy' };
    }

    if (!Number.isFinite(driverId) || driverId <= 0) {
        return { ok: false, error: 'driverId majburiy' };
    }

    if (!Number.isFinite(actualWeight) || actualWeight <= 0) {
        return { ok: false, error: 'actualWeight musbat son bo\'lishi kerak' };
    }

    if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
        return { ok: false, error: 'pricePerKg musbat son bo\'lishi kerak' };
    }

    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
        return { ok: false, error: 'discountPercent 0 va 100 oralig\'ida bo\'lishi kerak' };
    }

    return {
        ok: true,
        data: {
            requestId: Math.trunc(requestId),
            driverId: Math.trunc(driverId),
            actualWeight,
            discountPercent,
            pricePerKg,
            materialType: typeof body.materialType === 'string' && VALID_MATERIAL_TYPES.has(body.materialType.trim())
                ? body.materialType.trim() as MaterialType
                : null,
            notes: typeof body.notes === 'string' && body.notes.trim()
                ? body.notes.trim()
                : null,
            discountReason: typeof body.discountReason === 'string' && body.discountReason.trim()
                ? body.discountReason.trim()
                : null,
        },
    };
}
