/**
 * Expo Push Notification yuborish xizmati.
 * 
 * Mobil ilovaga push notification yuborish uchun ishlatiladi.
 * Bot eventlar → publishPlatformEvent → pushToMobile
 */
import { prisma } from '@/lib/prisma';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: 'default' | null;
    badge?: number;
}

/**
 * Expo Push API orqali notification yuborish
 */
async function sendExpoPush(tokens: string[], message: PushMessage): Promise<void> {
    if (tokens.length === 0) return;

    const messages = tokens.map(token => ({
        to: token,
        title: message.title,
        body: message.body,
        data: message.data || {},
        sound: message.sound ?? 'default',
        badge: message.badge,
        channelId: 'default',
    }));

    try {
        await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(messages),
        });
    } catch (err) {
        console.error('[Expo Push Error]:', err);
    }
}

/**
 * Customer ga push yuborish
 */
export async function pushToCustomer(userId: number, message: PushMessage): Promise<void> {
    const subs = await prisma.pushSubscription.findMany({
        where: { userId, appType: 'customer', isActive: true },
        select: { token: true },
    });
    await sendExpoPush(subs.map(s => s.token).filter((t): t is string => !!t), message);
}

/**
 * Driver ga push yuborish
 */
export async function pushToDriver(driverId: number, message: PushMessage): Promise<void> {
    const subs = await prisma.pushSubscription.findMany({
        where: { driverId, appType: 'driver', isActive: true },
        select: { token: true },
    });
    await sendExpoPush(subs.map(s => s.token).filter((t): t is string => !!t), message);
}

/**
 * Barcha customer/driver larga broadcast
 */
export async function pushBroadcast(appType: 'customer' | 'driver', message: PushMessage): Promise<void> {
    const subs = await prisma.pushSubscription.findMany({
        where: { appType, isActive: true },
        select: { token: true },
    });

    // Expo 100 tadan yuborish
    for (let i = 0; i < subs.length; i += 100) {
        const batch = subs.slice(i, i + 100);
        await sendExpoPush(batch.map(s => s.token).filter((t): t is string => !!t), message);
    }
}
