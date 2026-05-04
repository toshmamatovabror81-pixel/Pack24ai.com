import { NextResponse } from 'next/server';
import { initDriverBot } from '@/lib/telegram/driverBot';
import { isValidTelegramWebhookRequest } from '@/lib/telegram/security';

export const dynamic = 'force-dynamic';

// Handle POST requests from Telegram Webhook (Driver Bot — @pack24MX_bot)
export async function POST(request: Request) {
    try {
        if (!isValidTelegramWebhookRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const bot = await initDriverBot();

        if (!bot) {
            return NextResponse.json({ error: 'Driver Bot not configured' }, { status: 503 });
        }

        const body = await request.json();
        await bot.handleUpdate(body);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Webhook/Driver] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Handle GET requests (verify webhook status)
export async function GET() {
    return NextResponse.json({ status: 'Driver Bot Webhook Active', bot: '@pack24MX_bot' });
}
