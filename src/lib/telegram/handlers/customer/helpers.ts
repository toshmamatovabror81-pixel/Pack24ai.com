import { prisma } from '@/lib/prisma';
import type { Lang } from '../../i18n';
import type { CustomerSession } from './types';
import { createTelegramSessionStore } from '../../sessionStore';

// ─── Session store ────────────────────────────────────────────────────────────
export const sessions = createTelegramSessionStore<CustomerSession>('customer-bot-sessions');
export const registrationSessions = new Set<string>();

// ─── OTP generatsiya (6 raqam) ────────────────────────────────────────────────
export function generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── Mijoz tilini olish ───────────────────────────────────────────────────────
export async function getUserLang(tgId: string): Promise<Lang> {
    const sessionLang = sessions.get(tgId)?.lang;
    if (sessionLang) return sessionLang;

    const user = await prisma.user.findFirst({ where: { telegramId: tgId }, select: { id: true } });
    if (user) return 'uz'; // registered users default uz
    const req = await prisma.recycleRequest.findFirst({
        where: { customerTgId: tgId },
        orderBy: { createdAt: 'desc' },
        select: { customerLang: true },
    });
    return (req?.customerLang as Lang) || 'uz';
}

// ─── Foydalanuvchini Telegram ID bilan topish ────────────────────────────────
export async function getUserByTgId(tgId: string) {
    return prisma.user.findFirst({ where: { telegramId: tgId } });
}

// ─── Yagona 5 raqamli kod generatsiya (User uchun) ──────────────────────────
export async function generateUniqueUserCode(): Promise<string> {
    for (let attempt = 0; attempt < 30; attempt++) {
        const code = String(Math.floor(10000 + Math.random() * 90000));
        const exists = await prisma.user.findFirst({ where: { telegramCode: code } });
        if (!exists) return code;
    }
    return String(Date.now()).slice(-5);
}

// ─── Telefon raqamini normallashtirish ──────────────────────────────────────
export function normalizePhone(phone: string): string {
    let p = phone.replace(/[^\d+]/g, '');
    if (!p.startsWith('+')) p = '+' + p;
    return p;
}
