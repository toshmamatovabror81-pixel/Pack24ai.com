import { NextRequest, NextResponse } from 'next/server';
import {
    readOptionalEnum,
    readJsonObject,
    readUrlString,
    RequestValidationError,
} from '@/lib/requestValidation';
import { initCustomerBot } from '@/lib/telegram/customerBot';
import { initDriverBot } from '@/lib/telegram/driverBot';
import { initAdminBot } from '@/lib/telegram/adminBot';
import { initPack24AdminBot } from '@/lib/telegram/pack24AdminBot';
import { getBotStatuses } from '@/lib/telegram/botManager';
import {
    getTelegramWebhookSecret,
    hasTelegramWebhookSecret,
    isAuthorizedTelegramOpsRequest,
} from '@/lib/telegram/security';
import {
    configureTelegramBots,
    deleteTelegramWebhooks,
    type TelegramRuntimeBot,
} from '@/lib/telegram/runtime';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOTS: TelegramRuntimeBot[] = [
    {
        name: 'Customer (@Pack24AI_bot)',
        webhookPath: '/api/telegram/webhook',
        init: initCustomerBot,
    },
    {
        name: 'Driver (@pack24MX_bot)',
        webhookPath: '/api/telegram/webhook/driver',
        init: initDriverBot,
    },
    {
        name: 'Admin (@pack24AUP_bot)',
        webhookPath: '/api/telegram/webhook/admin',
        init: initAdminBot,
    },
    {
        name: 'Pack24 Admin (@pack24admin_bot)',
        webhookPath: '/api/telegram/webhook/pack24admin',
        init: initPack24AdminBot,
    },
];

// ─── GET — Botlar holati ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    const authorized = await isAuthorizedTelegramOpsRequest(request);
    if (!authorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const statuses = await getBotStatuses();
    return NextResponse.json({ ok: true, bots: statuses });
}

// ─── POST — Webhooklarni o'rnatish / polling boshlash ────────────────────────
export async function POST(request: NextRequest) {
    try {
        const authorized = await isAuthorizedTelegramOpsRequest(request);
        if (!authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: Record<string, unknown> = await readJsonObject(request).catch((error: unknown) => {
            if (error instanceof RequestValidationError) {
                return {};
            }
            throw error;
        });
        const mode = readOptionalEnum(body.mode, 'mode', ['webhook', 'polling'] as const) || 'webhook';
        const baseUrl = readUrlString(body.baseUrl, 'baseUrl');
        const webhookSecret = getTelegramWebhookSecret();

        if (mode === 'webhook' && !baseUrl) {
            return NextResponse.json(
                { ok: false, error: 'Webhook rejimi uchun baseUrl majburiy' },
                { status: 400 },
            );
        }

        if (mode === 'webhook' && !hasTelegramWebhookSecret()) {
            return NextResponse.json(
                { ok: false, error: 'Webhook rejimi uchun TELEGRAM_WEBHOOK_SECRET majburiy' },
                { status: 400 },
            );
        }

        const results = await configureTelegramBots({
            bots: TELEGRAM_BOTS,
            mode,
            baseUrl,
            webhookSecret: webhookSecret ?? undefined,
        });
        const hasSuccessfulResult = results.some((entry) => entry.status.startsWith('✅') || entry.status.startsWith('ℹ️'));

        return NextResponse.json({
            ok: hasSuccessfulResult,
            mode,
            message: mode === 'webhook'
                ? hasSuccessfulResult
                    ? '🌐 Webhooklar o\'rnatildi!'
                    : '⚠️ Webhooklar o\'rnatilmadi.'
                : hasSuccessfulResult
                    ? '🔄 Polling boshlandi!'
                    : '⚠️ Polling ishga tushmadi.',
            bots: results,
        }, { status: hasSuccessfulResult ? 200 : 503 });
    } catch (error: unknown) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
        }

        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

// ─── DELETE — Webhooklarni o'chirish ─────────────────────────────────────────
export async function DELETE(request: NextRequest) {
    const authorized = await isAuthorizedTelegramOpsRequest(request);
    if (!authorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await deleteTelegramWebhooks(TELEGRAM_BOTS);

    return NextResponse.json({ ok: true, message: 'Webhooklar o\'chirildi', bots: results });
}
