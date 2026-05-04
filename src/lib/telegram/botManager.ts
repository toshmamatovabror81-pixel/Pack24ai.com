import { Telegraf } from 'telegraf';
import { initAdminBot } from './adminBot';
import {
    getAdminBotToken,
    getCustomerBotToken,
    getDriverBotToken,
    getPack24AdminBotToken,
} from './botTokens';
import { initCustomerBot, resetInitializedCustomerBot } from './customerBot';
import { initDriverBot } from './driverBot';
import { initPack24AdminBot } from './pack24AdminBot';

// ─── Asosiy mijozlar botini olish ─────────────────────────────────────────────
export async function getCustomerBot(): Promise<Telegraf | null> {
    return initCustomerBot();
}

export function resetCustomerBot() {
    resetInitializedCustomerBot();
}

// ─── Haydovchilar botini olish ────────────────────────────────────────────────
export async function getDriverBot(): Promise<Telegraf | null> {
    return initDriverBot();
}

// ─── Admin/Masul botini olish ─────────────────────────────────────────────────
export async function getAdminBot(): Promise<Telegraf | null> {
    return initAdminBot();
}

// ─── HQ / Pack24 admin botini olish ───────────────────────────────────────────
export async function getPack24AdminBot(): Promise<Telegraf | null> {
    return initPack24AdminBot();
}

// ─── Barcha botlar ────────────────────────────────────────────────────────────
export async function getAllBots() {
    return {
        customer: await getCustomerBot(),
        driver: await getDriverBot(),
        admin: await getAdminBot(),
        pack24admin: await getPack24AdminBot(),
    };
}

// ─── Bot tokenlar ro'yxati (admin sahifa uchun) ──────────────────────────────
export async function getBotStatuses() {
    const customerToken = await getCustomerBotToken();
    return [
        {
            name: 'Customer Bot',
            username: '@Pack24AI_bot',
            envKey: 'CUSTOMER_BOT_TOKEN',
            hasToken: !!customerToken,
            description: 'Mijozlar — katalog, makulatura ariza, AI assistent',
        },
        {
            name: 'Driver Bot',
            username: '@pack24MX_bot',
            envKey: 'DRIVER_BOT_TOKEN',
            hasToken: !!getDriverBotToken(),
            description: 'Haydovchilar — topshiriqlar, kalkulyator, online/offline',
        },
        {
            name: 'Admin Bot',
            username: '@pack24AUP_bot',
            envKey: 'ADMIN_BOT_TOKEN',
            hasToken: !!getAdminBotToken(),
            description: 'Masullar — arizalar, haydovchi tayinlash, to\'lovlar',
        },
        {
            name: 'Pack24 Admin Bot',
            username: '@pack24admin_bot',
            envKey: 'PACK24ADMIN_BOT_TOKEN',
            hasToken: !!getPack24AdminBotToken(),
            description: 'HQ adminlar — event feed, alertlar, operativ nazorat',
        },
    ];
}
