import type { NextRequest } from 'next/server';
import {
    ADMIN_AUTH_COOKIE,
    ADMIN_AUTH_HEADER,
    validateAdminToken,
} from '@/lib/adminAuthShared';

export function getTelegramWebhookSecret(): string | null {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    return secret || null;
}

export function hasTelegramWebhookSecret(): boolean {
    return Boolean(getTelegramWebhookSecret());
}

export function isValidTelegramWebhookRequest(request: Request): boolean {
    const secret = getTelegramWebhookSecret();
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            console.error('[TelegramSecurity] TELEGRAM_WEBHOOK_SECRET o\'rnatilmagan');
            return false;
        }
        return true;
    }

    const received = request.headers.get('x-telegram-bot-api-secret-token');
    return received === secret;
}

export async function isAuthorizedTelegramOpsRequest(request: NextRequest): Promise<boolean> {
    const host = request.headers.get('host') || '';
    const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1');

    if (process.env.NODE_ENV !== 'production' && isLocalHost) {
        return true;
    }

    const adminSecret = process.env.ADMIN_SECRET;
    const adminCookie = request.cookies.get(ADMIN_AUTH_COOKIE)?.value;
    const adminHeader = request.headers.get(ADMIN_AUTH_HEADER);

    if (adminSecret) {
        if (adminCookie) {
            const cookieValidation = await validateAdminToken(adminCookie, adminSecret);
            if (cookieValidation.valid) return true;
        }

        if (adminHeader) {
            const headerValidation = await validateAdminToken(adminHeader, adminSecret);
            if (headerValidation.valid) return true;
        }
    }

    const opsSecret = process.env.TELEGRAM_OPS_SECRET;
    const authHeader = request.headers.get('authorization');
    if (opsSecret && authHeader === `Bearer ${opsSecret}`) {
        return true;
    }

    return false;
}
