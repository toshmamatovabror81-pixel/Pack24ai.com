/** Next.js Node server ishga tushganda chaqiladi */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    console.log('[instrumentation] pack24-web ishga tushmoqda');

    try {
        const { initServerSentry } = await import('./lib/sentry');
        initServerSentry();
    } catch {
        /* sentry optional — paket o'rnatilmagan bo'lishi mumkin */
    }

    // ── DB dan bot sessiyalarni tiklash (production + dev) ───────
    try {
        const { restoreSessionsFromDB } = await import('./lib/telegram/sessionStore');
        await restoreSessionsFromDB();
        console.log('[instrumentation] Telegram bot sessiyalari DB dan tiklandi');
    } catch (err) {
        console.warn('[instrumentation] Sessiya tiklash xatosi:', err);
    }

    if (process.env.NODE_ENV !== 'development') return;

    const flag = process.env.TELEGRAM_DEV_AUTO_POLL?.trim().toLowerCase();
    if (!flag || !['1', 'true', 'yes'].includes(flag)) return;

    const delayRaw = Number(process.env.TELEGRAM_DEV_POLL_DELAY_MS ?? '2500');
    const delayMs = Number.isFinite(delayRaw) ? delayRaw : 2500;

    setTimeout(() => {
        void (async () => {
            try {
                const { isTelegramPollingStarted, startTelegramPolling } = await import('./lib/telegram/runtime');
                const { TELEGRAM_POLLING_BOT_ENTRIES } = await import('./lib/telegram/pollingBotsConfig');

                if (isTelegramPollingStarted()) return;
                console.log('[telegram] Polling boshlanmoqda...');
                const results = await startTelegramPolling(TELEGRAM_POLLING_BOT_ENTRIES);
                console.log('[telegram] TELEGRAM_DEV_AUTO_POLL:', results);
            } catch (err) {
                console.warn('[telegram] TELEGRAM_DEV_AUTO_POLL xato:', err);
            }
        })();
    }, delayMs);
}
