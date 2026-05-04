import { Telegraf } from 'telegraf';

export type TelegramRuntimeBot = {
    name: string;
    webhookPath: string;
    init: () => Promise<Telegraf | null>;
};

const globalForTelegramRuntime = globalThis as unknown as {
    _telegramPollingStarted?: boolean;
    _telegramPollingShutdownRegistered?: boolean;
    _telegramPollingBots?: Map<string, Telegraf>;
};

function getPollingBotsRegistry() {
    if (!globalForTelegramRuntime._telegramPollingBots) {
        globalForTelegramRuntime._telegramPollingBots = new Map<string, Telegraf>();
    }

    return globalForTelegramRuntime._telegramPollingBots;
}

export function isTelegramPollingStarted() {
    return Boolean(globalForTelegramRuntime._telegramPollingStarted) && getPollingBotsRegistry().size > 0;
}

export function markTelegramPollingStarted(started: boolean) {
    globalForTelegramRuntime._telegramPollingStarted = started;
}

export function registerTelegramPollingShutdown() {
    if (globalForTelegramRuntime._telegramPollingShutdownRegistered) {
        return;
    }

    const resetPollingState = () => {
        const pollingBots = getPollingBotsRegistry();
        for (const bot of pollingBots.values()) {
            try {
                bot.stop('shutdown');
            } catch {}
        }
        pollingBots.clear();
        globalForTelegramRuntime._telegramPollingStarted = false;
    };

    process.once('SIGINT', resetPollingState);
    process.once('SIGTERM', resetPollingState);
    globalForTelegramRuntime._telegramPollingShutdownRegistered = true;
}

async function stopPollingBot(name: string) {
    const pollingBots = getPollingBotsRegistry();
    const activeBot = pollingBots.get(name);
    if (!activeBot) return;

    try {
        activeBot.stop('mode-switch');
    } catch {}

    pollingBots.delete(name);
    if (pollingBots.size === 0) {
        markTelegramPollingStarted(false);
    }
}

async function launchPollingBot(entry: TelegramRuntimeBot, bot: Telegraf) {
    const pollingBots = getPollingBotsRegistry();
    if (pollingBots.has(entry.name)) {
        return { bot: entry.name, status: 'ℹ️ Polling allaqachon ishlayapti' };
    }

    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    const launchPromise = bot.launch({ dropPendingUpdates: true });

    // Telegraf long polling keeps the process alive; do not block the setup
    // endpoint forever while the bot is already receiving updates.
    await Promise.race([
        launchPromise,
        new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);

    pollingBots.set(entry.name, bot);
    launchPromise.catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Polling] ${entry.name} polling to'xtadi:`, message);
        pollingBots.delete(entry.name);
        if (pollingBots.size === 0) {
            markTelegramPollingStarted(false);
        }
    });

    return { bot: entry.name, status: '✅ Polling boshlandi' };
}

export async function startTelegramPolling(
    bots: TelegramRuntimeBot[],
) {
    const results: { bot: string; status: string }[] = [];

    for (const entry of bots) {
        try {
            const bot = await entry.init();
            if (!bot) {
                results.push({ bot: entry.name, status: '⚠️ Token topilmadi' });
                continue;
            }

            const result = await launchPollingBot(entry, bot);
            results.push(result);
            if (result.status.startsWith('✅') || result.status.startsWith('ℹ️')) {
                console.log(`[Polling] ${result.status} — ${entry.name}`);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[Polling] ${entry.name} xatolik:`, message);
            results.push({ bot: entry.name, status: `❌ ${message}` });
        }
    }

    const hasActivePollingBots = getPollingBotsRegistry().size > 0;
    markTelegramPollingStarted(hasActivePollingBots);
    if (hasActivePollingBots) {
        registerTelegramPollingShutdown();
    }

    return results;
}

export async function configureTelegramBots(params: {
    bots: TelegramRuntimeBot[];
    mode: 'webhook' | 'polling';
    baseUrl?: string;
    webhookSecret?: string;
}) {
    const { bots, mode, baseUrl, webhookSecret } = params;
    const results: { bot: string; status: string; url?: string }[] = [];

    for (const entry of bots) {
        try {
            const bot = await entry.init();
            if (!bot) {
                results.push({ bot: entry.name, status: '⚠️ Token topilmadi' });
                continue;
            }

            if (mode === 'webhook' && baseUrl) {
                await stopPollingBot(entry.name);
                const webhookUrl = `${baseUrl}${entry.webhookPath}`;
                await bot.telegram.setWebhook(
                    webhookUrl,
                    webhookSecret ? { secret_token: webhookSecret } : undefined,
                );
                results.push({ bot: entry.name, status: '✅ Webhook o\'rnatildi', url: webhookUrl });
                continue;
            }

            results.push(await launchPollingBot(entry, bot));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            results.push({ bot: entry.name, status: `❌ ${message}` });
        }
    }

    if (mode === 'polling') {
        const hasActivePollingBots = getPollingBotsRegistry().size > 0;
        markTelegramPollingStarted(hasActivePollingBots);
        if (hasActivePollingBots) {
            registerTelegramPollingShutdown();
        }
    }

    return results;
}

export async function deleteTelegramWebhooks(
    bots: TelegramRuntimeBot[],
) {
    const results: { bot: string; status: string }[] = [];

    for (const entry of bots) {
        try {
            const bot = await entry.init();
            if (!bot) {
                results.push({ bot: entry.name, status: '⚠️ Token topilmadi' });
                continue;
            }

            await bot.telegram.deleteWebhook();
            results.push({ bot: entry.name, status: '✅ Webhook o\'chirildi' });
        } catch {
            results.push({ bot: entry.name, status: '❌ Xatolik' });
        }
    }

    return results;
}
