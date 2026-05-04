import { prisma } from '@/lib/prisma';

export async function getCustomerBotToken(): Promise<string | null> {
    if (process.env.CUSTOMER_BOT_TOKEN) {
        return process.env.CUSTOMER_BOT_TOKEN;
    }

    const config = await prisma.telegramConfig.findFirst({
        select: { botToken: true },
    });
    return config?.botToken || null;
}

export function getDriverBotToken(): string | null {
    return process.env.DRIVER_BOT_TOKEN || null;
}

export function getAdminBotToken(): string | null {
    return process.env.ADMIN_BOT_TOKEN || null;
}

export function getPack24AdminBotToken(): string | null {
    return process.env.PACK24ADMIN_BOT_TOKEN || null;
}
