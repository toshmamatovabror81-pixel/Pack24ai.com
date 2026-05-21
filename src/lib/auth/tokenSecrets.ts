/**
 * Token secrets — domen bo'yicha ajratilgan.
 *
 * Avval `ADMIN_SECRET` driver, mobile user va admin token uchun
 * birgalikda ishlatilgan edi. M2 audit bo'yicha ular ajratildi:
 *
 *  - Admin (HMAC cookie/header) — `ADMIN_SECRET`
 *  - Driver mobile token        — `DRIVER_TOKEN_SECRET`
 *  - User mobile token (OTP)    — `MOBILE_TOKEN_SECRET` (default AUTH_SECRET)
 *
 * Predictable fallback string'lar olib tashlandi: secret yo'q bo'lsa
 * exception tashlaymiz, chunki bunday holatda token generate qilish
 * yoki tekshirish xavfsiz emas.
 */

export class MissingSecretError extends Error {
    constructor(envName: string, context: string) {
        super(
            `${envName} env o'rnatilmagan (${context}). Token operatsiyasi to'xtatildi. ` +
            `.env va docs/security-action-required.md ga qarang.`
        );
        this.name = 'MissingSecretError';
    }
}

function requireSecret(envName: string, value: string | undefined, context: string): string {
    if (!value || value.length < 16) {
        throw new MissingSecretError(envName, context);
    }
    return value;
}

export function getDriverTokenSecret(): string {
    return requireSecret(
        'DRIVER_TOKEN_SECRET',
        process.env.DRIVER_TOKEN_SECRET,
        'driver mobile token'
    );
}

export function getMobileUserTokenSecret(): string {
    return requireSecret(
        'MOBILE_TOKEN_SECRET',
        process.env.MOBILE_TOKEN_SECRET || process.env.AUTH_SECRET,
        'user mobile token'
    );
}

export function getAdminSecret(): string {
    return requireSecret(
        'ADMIN_SECRET',
        process.env.ADMIN_SECRET,
        'admin HMAC token'
    );
}
