import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedTelegramOpsRequest } from '@/lib/telegram/security';
import {
    isTelegramPollingStarted,
    startTelegramPolling,
} from '@/lib/telegram/runtime';
import { TELEGRAM_POLLING_BOT_ENTRIES } from '@/lib/telegram/pollingBotsConfig';

export const dynamic = 'force-dynamic';

// GET /api/telegram/start-polling — Dev rejimda barcha botlarni polling boshlash
export async function GET(request: NextRequest) {
    const authorized = await isAuthorizedTelegramOpsRequest(request);
    if (!authorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isTelegramPollingStarted()) {
        return NextResponse.json({
            ok: true,
            message: '🤖 Botlar allaqachon polling rejimda ishlayapti!',
        });
    }

    const results = await startTelegramPolling(TELEGRAM_POLLING_BOT_ENTRIES);
    const hasStartedBot = results.some((entry) => entry.status.startsWith('✅') || entry.status.startsWith('ℹ️'));

    return NextResponse.json({
        ok: hasStartedBot,
        message: hasStartedBot
            ? '🤖 Polling rejimi ishga tushirildi!'
            : '⚠️ Hech bir bot polling rejimida ishga tushmadi.',
        bots: results,
    }, { status: hasStartedBot ? 200 : 503 });
}
