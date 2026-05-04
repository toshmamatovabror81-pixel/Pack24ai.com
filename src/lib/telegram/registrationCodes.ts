import { prisma } from '@/lib/prisma';

export async function generateUniqueTelegramRegistrationCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const code = String(Math.floor(10000 + Math.random() * 90000));
        const [supervisor, driver, hqAdmin] = await Promise.all([
            prisma.supervisor.findFirst({ where: { registrationCode: code }, select: { id: true } }),
            prisma.driver.findFirst({ where: { registrationCode: code }, select: { id: true } }),
            prisma.telegramHqAdmin.findFirst({ where: { registrationCode: code }, select: { id: true } }),
        ]);

        if (!supervisor && !driver && !hqAdmin) {
            return code;
        }
    }

    return String(Date.now()).slice(-5);
}
