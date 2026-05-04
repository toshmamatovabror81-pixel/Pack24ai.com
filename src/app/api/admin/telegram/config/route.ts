import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    readJsonObject,
    readOptionalString,
    RequestValidationError,
} from '@/lib/requestValidation';
import { getCustomerBot, resetCustomerBot } from '@/lib/telegram/botManager';
import {
    getTelegramWebhookSecret,
    hasTelegramWebhookSecret,
    isAuthorizedTelegramOpsRequest,
} from '@/lib/telegram/security';

export async function GET(request: NextRequest) {
    try {
        const authorized = await isAuthorizedTelegramOpsRequest(request);
        if (!authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const config = await prisma.telegramConfig.findFirst();

        // ─── Real DB stats ─────────────────────────────────────────────
        const [
            totalUsers,
            totalOrders,
            totalCollections,
            pendingCollections,
            paidCollections,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.order.count(),
            prisma.recycleCollection.count(),
            prisma.recycleCollection.count({
                where: { paymentStatus: 'pending' },
            }),
            prisma.recycleCollection.count({
                where: {
                    paymentStatus: { in: ['paid_to_driver', 'paid_to_customer', 'paid_both', 'completed'] },
                },
            }),
        ]);

        // ─── Webhook info ───────────────────────────────────────────────
        let webhookInfo = null;
        if (config?.botToken) {
            try {
                const bot = await getCustomerBot();
                if (bot) {
                    webhookInfo = await bot.telegram.getWebhookInfo();
                }
            } catch (e) {
                console.error('Webhook info error:', e);
            }
        }

        return NextResponse.json({
            ...(config || {
                botToken: '',
                botUsername: '',
                welcomeMessage: 'Assalomu alaykum! Xush kelibsiz.',
                mainButton: 'Katalog',
                salesChatId: '',
                isActive: false,
            }),
            webhookInfo,
            stats: {
                totalUsers,
                totalOrders,
                totalCollections,
                pendingCollections,
                paidCollections,
            },
        });
    } catch (error) {
        console.error('Config fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const authorized = await isAuthorizedTelegramOpsRequest(request);
        if (!authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await readJsonObject(request);
        const botToken = readOptionalString(body.botToken, 'botToken', { allowEmpty: true }) ?? '';
        const welcomeMessage = readOptionalString(body.welcomeMessage, 'welcomeMessage', { allowEmpty: true }) ?? '';
        const mainButton = readOptionalString(body.mainButton, 'mainButton', { allowEmpty: true }) ?? '';
        const salesChatId = readOptionalString(body.salesChatId, 'salesChatId', { allowEmpty: true }) ?? '';

        let config = await prisma.telegramConfig.findFirst();

        if (config) {
            config = await prisma.telegramConfig.update({
                where: { id: config.id },
                data: { botToken, welcomeMessage, mainButton, salesChatId },
            });
        } else {
            config = await prisma.telegramConfig.create({
                data: { botToken, welcomeMessage, mainButton, salesChatId },
            });
        }

        resetCustomerBot();

        let botUsername = config.botUsername || 'Noma\'lum';

        if (botToken) {
            try {
                const bot = await getCustomerBot();
                if (bot) {
                    const me = await bot.telegram.getMe();
                    botUsername = `@${me.username}`;

                    await prisma.telegramConfig.update({
                        where: { id: config.id },
                        data: { botUsername, isActive: true },
                    });

                    if (process.env.NEXT_PUBLIC_APP_URL) {
                        if (hasTelegramWebhookSecret()) {
                            const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook`;
                            const webhookSecret = getTelegramWebhookSecret();
                            await bot.telegram.setWebhook(
                                webhookUrl,
                                webhookSecret ? { secret_token: webhookSecret } : undefined,
                            );
                            console.log(`✅ Webhook set: ${webhookUrl}`);
                        } else {
                            console.warn('⚠️ TELEGRAM_WEBHOOK_SECRET yo\'q — webhook o\'rnatilmadi');
                        }
                    } else {
                        console.warn('⚠️ NEXT_PUBLIC_APP_URL not set — webhook not configured');
                    }
                }
            } catch (err) {
                console.error('Failed to verify bot token:', err);
            }
        }

        return NextResponse.json({ ...config, botUsername });
    } catch (error) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        console.error('Error saving config:', error);
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }
}
