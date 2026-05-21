/** Next.js Node server ishga tushganda chaqiladi */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    const { logger, logBotEvent } = await import('./lib/logger');
    logger.info({ event: 'app_start', runtime: process.env.NEXT_RUNTIME }, 'pack24-web ishga tushdi');

    // ── DB dan bot sessiyalarni tiklash (production + dev) ───────
    try {
        const { restoreSessionsFromDB } = await import('./lib/telegram/sessionStore');
        await restoreSessionsFromDB();
        logger.info('Telegram bot sessiyalari DB dan tiklandi');
    } catch (err) {
        logger.warn({ err }, 'Sessiya tiklash xatosi');
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
                logBotEvent('all-polling-bots', 'starting');
                const results = await startTelegramPolling(TELEGRAM_POLLING_BOT_ENTRIES);
                logBotEvent('all-polling-bots', 'polling_started', { results });
            } catch (err) {
                logBotEvent('all-polling-bots', 'error', { err: String(err) });
            }
        })();
    }, delayMs);
}
