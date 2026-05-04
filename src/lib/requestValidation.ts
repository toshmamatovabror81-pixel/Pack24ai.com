export class RequestValidationError extends Error {
    status = 400;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
    const body = await request.json().catch(() => {
        throw new RequestValidationError('Yaroqsiz JSON body');
    });

    if (!isPlainObject(body)) {
        throw new RequestValidationError('JSON object kutilgan');
    }

    return body;
}

export function readOptionalString(
    value: unknown,
    fieldName: string,
    options: { trim?: boolean; allowEmpty?: boolean } = {},
): string | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value !== 'string') {
        throw new RequestValidationError(`${fieldName} matn bo'lishi kerak`);
    }

    const normalized = options.trim === false ? value : value.trim();
    if (!options.allowEmpty && normalized.length === 0) {
        return undefined;
    }

    return normalized;
}

export function readEnum<T extends string>(
    value: unknown,
    fieldName: string,
    allowedValues: readonly T[],
): T {
    if (typeof value !== 'string') {
        throw new RequestValidationError(`${fieldName} matn bo'lishi kerak`);
    }

    if (!allowedValues.includes(value as T)) {
        throw new RequestValidationError(
            `${fieldName} quyidagilardan biri bo'lishi kerak: ${allowedValues.join(', ')}`,
        );
    }

    return value as T;
}

export function readOptionalEnum<T extends string>(
    value: unknown,
    fieldName: string,
    allowedValues: readonly T[],
): T | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }

    return readEnum(value, fieldName, allowedValues);
}

export function readNumber(value: unknown, fieldName: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new RequestValidationError(`${fieldName} son bo'lishi kerak`);
    }

    return value;
}

export function readOptionalNumber(value: unknown, fieldName: string): number | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }

    return readNumber(value, fieldName);
}

export function readArray(value: unknown, fieldName: string): unknown[] {
    if (!Array.isArray(value)) {
        throw new RequestValidationError(`${fieldName} array bo'lishi kerak`);
    }

    return value;
}

export function readBooleanQueryParam(value: string | null): boolean {
    return value === 'true';
}

export function readPositiveIntegerQueryParam(
    value: string | null,
    fieldName: string,
    fallback: number,
): number {
    if (!value) return fallback;

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new RequestValidationError(`${fieldName} musbat butun son bo'lishi kerak`);
    }

    return parsed;
}

export function readUrlString(value: unknown, fieldName: string): string | undefined {
    const normalized = readOptionalString(value, fieldName);
    if (!normalized) return undefined;

    try {
        const url = new URL(normalized);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('unsupported');
        }
        return url.toString().replace(/\/$/, '');
    } catch {
        throw new RequestValidationError(`${fieldName} to'g'ri URL bo'lishi kerak`);
    }
}
