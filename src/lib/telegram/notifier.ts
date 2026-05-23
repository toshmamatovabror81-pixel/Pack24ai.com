// ─── Cross-Bot Notifier Service ──────────────────────────────────────────────
// Bu xizmat turli botlar orasidagi xabarlarni boshqaradi.
// Masalan: Haydovchi botda "yo'lga chiqdim" bosilganda, Mijoz botiga xabar boradi.

import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { getCustomerBot, getDriverBot, getAdminBot, getPack24AdminBot } from './botManager';

type SendOptions = {
    parse_mode?: 'HTML' | 'Markdown';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reply_markup?: any;
};

function parseChatIds(rawValue?: string | null): string[] {
    if (!rawValue) return [];

    return rawValue
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

async function sendMessageWithBot(bot: Telegraf, chatId: string, text: string, opts?: SendOptions) {
    await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts });
}

async function sendMessageWithLegacyToken(token: string, chatId: string, text: string, opts?: SendOptions) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: opts?.parse_mode ?? 'HTML',
            reply_markup: opts?.reply_markup,
        }),
    });

    if (!response.ok) {
        throw new Error(`Telegram API ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
        throw new Error(data.description || 'Telegram API xatosi');
    }
}

async function sendToChatIds(chatIds: string[], text: string, opts?: SendOptions) {
    if (chatIds.length === 0) {
        return false;
    }

    const customerBot = await getCustomerBot();
    if (customerBot) {
        await Promise.all(chatIds.map((chatId) => sendMessageWithBot(customerBot, chatId, text, opts)));
        return true;
    }

    const legacyToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!legacyToken) {
        console.warn('[Notifier] Telegram yuborish uchun bot token topilmadi');
        return false;
    }

    await Promise.all(chatIds.map((chatId) => sendMessageWithLegacyToken(legacyToken, chatId, text, opts)));
    return true;
}

async function getSalesChatIds() {
    const config = await prisma.telegramConfig.findFirst({
        select: { salesChatId: true },
    });

    return parseChatIds(config?.salesChatId);
}

async function logUndeliveredDM(
    channel: 'driver' | 'admin' | 'pack24admin',
    chatId: string,
    err: unknown,
) {
    try {
        const { createBotEvent } = await import('./botEvents');
        await createBotEvent({
            sourceBot: 'platform',
            eventType: `${channel}.dm_undelivered`,
            entityType: 'telegram_chat',
            severity: 'warning',
            title: `${channel} chatga xabar yetkazilmadi`,
            message: `chatId=${chatId}: ${(err as Error)?.message || 'unknown'}`,
            payload: { channel, chatId },
        });
    } catch (logErr) {
        console.error('[Notifier] dm_undelivered audit yozilmadi:', logErr);
    }
}

// ─── Mijozga xabar yuborish (Customer Bot orqali) ────────────────────────────
export async function notifyCustomer(chatId: string, text: string, opts?: SendOptions) {
    try {
        const bot = await getCustomerBot();
        if (!bot) { console.warn('[Notifier] Customer bot mavjud emas'); return; }
        await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts });
    } catch (err) {
        console.error('[Notifier] Mijozga xabar yuborishda xatolik:', err);
    }
}

// ─── Haydovchiga xabar yuborish (Driver Bot orqali) ─────────────────────────
export async function notifyDriver(chatId: string, text: string, opts?: SendOptions) {
    try {
        const bot = await getDriverBot();
        if (!bot) { console.warn('[Notifier] Driver bot mavjud emas'); return; }
        await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts });
    } catch (err) {
        console.error('[Notifier] Haydovchiga xabar yuborishda xatolik:', err);
        await logUndeliveredDM('driver', chatId, err);
    }
}

// ─── Masulga xabar yuborish (Admin Bot orqali) ──────────────────────────────
export async function notifyAdmin(chatId: string, text: string, opts?: SendOptions) {
    try {
        const bot = await getAdminBot();
        if (!bot) { console.warn('[Notifier] Admin bot mavjud emas'); return; }
        await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts });
    } catch (err) {
        console.error('[Notifier] Masulga xabar yuborishda xatolik:', err);
        await logUndeliveredDM('admin', chatId, err);
    }
}

/** DB dagi aktiv HQ adminlar + PACK24ADMIN_ALLOWED_TELEGRAM_IDS */
export async function notifyAllPack24Admins(text: string, opts?: SendOptions) {
    try {
        const ids = new Set<string>();
        const rows = await prisma.telegramHqAdmin.findMany({
            where: { isActive: true, telegramId: { not: null } },
            select: { telegramId: true },
        });
        for (const row of rows) {
            if (row.telegramId) ids.add(row.telegramId);
        }
        for (const raw of parseChatIds(process.env.PACK24ADMIN_ALLOWED_TELEGRAM_IDS)) {
            ids.add(raw);
        }
        await Promise.all([...ids].map((chatId) => notifyPack24Admin(chatId, text, opts)));
    } catch (err) {
        console.error('[Notifier] HQ adminlarga ommaviy xabar xatolik:', err);
    }
}

// ─── HQ adminlarga xabar yuborish (Pack24 Admin Bot orqali) ───────────────────
export async function notifyPack24Admin(chatId: string, text: string, opts?: SendOptions) {
    try {
        const bot = await getPack24AdminBot();
        if (!bot) { console.warn('[Notifier] Pack24 Admin bot mavjud emas'); return; }
        await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts });
    } catch (err) {
        console.error('[Notifier] HQ adminlarga xabar yuborishda xatolik:', err);
        await logUndeliveredDM('pack24admin', chatId, err);
    }
}

// ─── Lokatsiya yuborish ────────────────────────────────────────────────────
export async function sendLocationToCustomer(chatId: string, latitude: number, longitude: number) {
    try {
        const bot = await getCustomerBot();
        if (!bot) return;
        await bot.telegram.sendLocation(chatId, latitude, longitude);
    } catch (err) {
        console.error('[Notifier] Lokatsiya yuborishda xatolik:', err);
    }
}

// ─── Sotuv/admin chatlariga xabar yuborish (Customer Bot orqali) ──────────────
export async function notifySalesChats(text: string, opts?: SendOptions) {
    try {
        const chatIds = await getSalesChatIds();
        return await sendToChatIds(chatIds, text, opts);
    } catch (err) {
        console.error('[Notifier] Sales chatlarga xabar yuborishda xatolik:', err);
        return false;
    }
}

// ─── Legacy admin chatlarga xabar yuborish ────────────────────────────────────
export async function notifyLegacyAdminChats(text: string, opts?: SendOptions) {
    try {
        const envChatIds = parseChatIds(process.env.TELEGRAM_ADMIN_CHAT_ID);
        const chatIds = envChatIds.length > 0 ? envChatIds : await getSalesChatIds();
        return await sendToChatIds(chatIds, text, opts);
    } catch (err) {
        console.error('[Notifier] Legacy admin chatlarga xabar yuborishda xatolik:', err);
        return false;
    }
}
