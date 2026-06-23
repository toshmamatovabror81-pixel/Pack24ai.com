import { prisma } from '@/lib/prisma';

/**
 * Kriptografik xavfsiz 5 xonali kod generatsiya qiladi.
 * Web Crypto API ishlatadi (Node.js va Vercel Edge'da ishlaydi).
 */
function secureRandomInt(min: number, max: number): number {
    const range = max - min;
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return min + (array[0] % range);
}

export async function generateUniqueTelegramRegistrationCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const code = String(secureRandomInt(10000, 100000));
        const [supervisor, driver, hqAdmin] = await Promise.all([
            prisma.supervisor.findFirst({ where: { registrationCode: code }, select: { id: true } }),
            prisma.driver.findFirst({ where: { registrationCode: code }, select: { id: true } }),
            prisma.telegramHqAdmin.findFirst({ where: { registrationCode: code }, select: { id: true } }),
        ]);

        if (!supervisor && !driver && !hqAdmin) {
            return code;
        }
    }

    // Fallback: kriptografik xavfsiz random
    return String(secureRandomInt(10000, 100000));
}
