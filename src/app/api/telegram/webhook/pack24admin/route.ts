import { NextResponse } from 'next/server';
import { initPack24AdminBot } from '@/lib/telegram/pack24AdminBot';
import { isValidTelegramWebhookRequest } from '@/lib/telegram/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        if (!isValidTelegramWebhookRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const bot = await initPack24AdminBot();

        if (!bot) {
            return NextResponse.json({ error: 'Pack24 Admin Bot not configured' }, { status: 503 });
        }

        const body = await request.json();
        await bot.handleUpdate(body);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Webhook/Pack24Admin] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'Pack24 Admin Bot Webhook Active', bot: '@pack24admin_bot' });
}
