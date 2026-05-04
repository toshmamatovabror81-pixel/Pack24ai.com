import { prisma } from '@/lib/prisma';
import { createTelegramSessionStore } from '../../sessionStore';
import { generateUniqueTelegramRegistrationCode } from '../../registrationCodes';
import type { DriverSession } from './types';

export const sessions = createTelegramSessionStore<DriverSession>('driver-bot-sessions');

export async function getDriver(tgId: string) {
    return prisma.driver.findFirst({ where: { telegramId: tgId } });
}

export async function generateUniqueDriverCode(): Promise<string> {
    return generateUniqueTelegramRegistrationCode();
}
