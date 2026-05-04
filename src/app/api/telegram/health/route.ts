import { NextResponse } from 'next/server';
import {
    getDriverBotToken,
    getAdminBotToken,
    getPack24AdminBotToken,
} from '@/lib/telegram/botTokens';
import { hasTelegramWebhookSecret } from '@/lib/telegram/security';
import { isTelegramPollingStarted } from '@/lib/telegram/runtime';

export const dynamic = 'force-dynamic';

/**
 * Tokenlarni OCHIQ qilmaydi — faqat .env-da bor/yo'qligi (customer uchun env; DB fallback tekshirilmaydi).
 * Brauzer: GET /api/telegram/health
 */
export async function GET() {
    const nodeEnv = process.env.NODE_ENV ?? 'unknown';
    const polling = isTelegramPollingStarted();
    const webhookSecret = hasTelegramWebhookSecret();
    const db = Boolean(process.env.DATABASE_URL?.trim());

    const hints: string[] = [];

    if (nodeEnv === 'production' && !webhookSecret) {
        hints.push(
            'Production: TELEGRAM_WEBHOOK_SECRET qoʻyilmagan — Telegram webhooklari 401 (Unauthorized) qaytadi.',
        );
    }

    if (!db) {
        hints.push('DATABASE_URL yoʻq — Customer bot tokenga qadar DB oʻqishi ishlamasligi mumkin.');
    }

    const customerEnvToken = Boolean(process.env.CUSTOMER_BOT_TOKEN?.trim());
    if (!customerEnvToken) {
        hints.push(
            'CUSTOMER_BOT_TOKEN .env-da yoʻq — token faqat Postgres TelegramConfigdan yuklanishi mumkin (DB zarur).',
        );
    }

    if (nodeEnv !== 'production' && !polling) {
        hints.push(
            'Lokal ish: `next dev` qayta yuklangandan keyin polling yo‘qoladi — /api/telegram/start-polling ni qayta oching YOKI .env ga TELEGRAM_DEV_AUTO_POLL=true qo‘shing.',
        );
        hints.push(
            'Agar pollingda webhook oʻchirilgan boʻlsa yangilanish yoʻli qolmaydi — yuqoridagini albatda bajarish kerak.',
        );
    }

    const driver = Boolean(getDriverBotToken());
    const admin = Boolean(getAdminBotToken());
    const pack24 = Boolean(getPack24AdminBotToken());

    const anyToken = customerEnvToken || driver || admin || pack24;
    if (!anyToken) {
        hints.push('.env da hech qanday bot tokenga oʻxshash oʻzgaruvchi topilmadi.');
    }

    return NextResponse.json({
        ok: true,
        nodeEnv,
        databaseUrlConfigured: db,
        pollingActive: polling,
        webhookSecretConfigured: webhookSecret,
        botTokensPresent: {
            customerFromEnvOnly: customerEnvToken,
            driver,
            adminSupervisorBot: admin,
            pack24AdminBot: pack24,
        },
        hints,
        webhookPaths: [
            '/api/telegram/webhook',
            '/api/telegram/webhook/driver',
            '/api/telegram/webhook/admin',
            '/api/telegram/webhook/pack24admin',
        ],
    });
}
