import { NextResponse } from 'next/server';
import { initCustomerBot } from '@/lib/telegram/customerBot';
import { isValidTelegramWebhookRequest } from '@/lib/telegram/security';

export const dynamic = 'force-dynamic';

// Handle POST requests from Telegram Webhook (Customer Bot — @Pack24AI_bot)
export async function POST(request: Request) {
    try {
        if (!isValidTelegramWebhookRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const bot = await initCustomerBot();

        if (!bot) {
            return NextResponse.json({ error: 'Bot not configured' }, { status: 503 });
        }

        const body = await request.json();
        await bot.handleUpdate(body);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Webhook/Customer] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Handle GET requests (verify webhook status)
export async function GET() {
    return NextResponse.json({ status: 'Customer Bot Webhook Active', bot: '@Pack24AI_bot' });
}
