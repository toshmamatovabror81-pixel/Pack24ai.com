import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function generateUniqueTelegramRegistrationCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const code = String(crypto.randomInt(10000, 100000));
        const [supervisor, driver, hqAdmin] = await Promise.all([
            prisma.supervisor.findFirst({ where: { registrationCode: code }, select: { id: true } }),
            prisma.driver.findFirst({ where: { registrationCode: code }, select: { id: true } }),
            prisma.telegramHqAdmin.findFirst({ where: { registrationCode: code }, select: { id: true } }),
        ]);

        if (!supervisor && !driver && !hqAdmin) {
            return code;
        }
    }

    // Fallback: kriptografik xavfsiz random (Date.now() o'rniga)
    return String(crypto.randomInt(10000, 100000));
}
