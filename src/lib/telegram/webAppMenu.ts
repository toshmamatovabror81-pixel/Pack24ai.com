import type { Telegraf } from 'telegraf';

const WEBAPP_LABELS: Record<string, string> = {
    uz: "Do'kon",
    ru: 'Магазин',
    en: 'Shop',
};

/**
 * Customer bot uchun Telegram WebApp menu button.
 * Production: https://pack24.uz/mobile
 */
export async function configureCustomerWebAppMenu(
    bot: Telegraf,
    baseUrl: string,
): Promise<void> {
    const root = baseUrl.replace(/\/$/, '');
    const webAppUrl = `${root}/mobile`;
    const label = WEBAPP_LABELS.uz;

    await bot.telegram.setChatMenuButton({
        menuButton: {
            type: 'web_app',
            text: label,
            web_app: { url: webAppUrl },
        },
    });
}
