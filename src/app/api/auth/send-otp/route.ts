/**
 * POST /api/auth/send-otp
 *
 * Foydalanuvchining telegramiga OTP kod yuboradi.
 * Flow: Saytda "Kirish" → telefon kiritish → "Kodni yuborish" → Telegram botda kod keladi → saytga kiritiladi
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyCustomer } from '@/lib/telegram/notifier';
import { otpLimiter, getClientIp, getRateLimitResponse } from '@/lib/rateLimit';

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS_PER_WINDOW = 3;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 daqiqa

function generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000)); // 6 raqam
}

function normalizePhone(phone: string): string {
    let p = phone.replace(/[^\d+]/g, '');
    if (!p.startsWith('+')) p = '+' + p;
    return p;
}

export async function POST(request: Request) {
    try {
        // IP-based rate limiting: 3 urinish/daqiqa
        const ip = getClientIp(request);
        const rl = otpLimiter.check(`otp:${ip}`);
        if (!rl.allowed) return getRateLimitResponse(rl.retryAfterMs);
        const body = await request.json();
        const { phone } = body as { phone?: string };

        if (!phone) {
            return NextResponse.json({ error: 'Telefon raqam kiritilishi shart' }, { status: 400 });
        }

        const cleanPhone = normalizePhone(phone);

        const user = await prisma.user.findUnique({
            where: { phone: cleanPhone },
            select: {
                id: true,
                name: true,
                telegramId: true,
                isActive: true,
                otpExpiry: true,
                otpAttempts: true,
            },
        });

        if (!user) {
            return NextResponse.json({
                error: 'Bu telefon raqam tizimda ro\'yxatdan o\'tmagan. Avval @Pack24AI_bot orqali ro\'yxatdan o\'ting.',
                noTelegram: true,
            }, { status: 404 });
        }

        if (!user.isActive) {
            return NextResponse.json({
                error: 'Hisobingiz faol emas. Qo\'llab-quvvatlash bilan bog\'laning.',
                noTelegram: true,
            }, { status: 403 });
        }

        // Telegram ID yo'q — bot orqali yuborib bo'lmaydi
        if (!user.telegramId) {
            return NextResponse.json({
                error: 'Bu raqamga Telegram bog\'lanmagan. Avval @Pack24AI_bot ga /start yuboring.',
                noTelegram: true,
            }, { status: 400 });
        }

        // Rate limiting: 5 daqiqada 3 dan ko'p so'rov bo'lsa, to'xtat
        const now = new Date();
        if (
            user.otpExpiry &&
            user.otpAttempts >= MAX_ATTEMPTS_PER_WINDOW &&
            now.getTime() - user.otpExpiry.getTime() < RATE_LIMIT_WINDOW_MS
        ) {
            const waitSec = Math.ceil(
                (user.otpExpiry.getTime() + RATE_LIMIT_WINDOW_MS - now.getTime()) / 1000
            );
            return NextResponse.json({
                error: `Juda ko'p urinish. ${Math.ceil(waitSec / 60)} daqiqadan so'ng qayta urinib ko'ring.`,
            }, { status: 429 });
        }

        // OTP generatsiya va saqlash
        const otp = generateOtp();
        const expiry = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                otpCode: otp,
                otpExpiry: expiry,
                otpAttempts: user.otpExpiry && now < user.otpExpiry
                    ? { increment: 1 }
                    : 1, // yangi oyna — reset
            },
        });

        // Telegram orqali yuborish
        const message =
            `🔐 <b>Pack24 — Tasdiqlash kodi</b>\n\n` +
            `Sizning bir martalik kirish kodingiz:\n\n` +
            `<code>${otp}</code>\n\n` +
            `⏱ Amal qilish muddati: <b>${OTP_EXPIRY_MINUTES} daqiqa</b>\n\n` +
            `⚠️ Bu kodni hech kimga bermang!\n` +
            `Agar siz so'ramagan bo'lsangiz — e'tibor bermang.`;

        await notifyCustomer(user.telegramId, message);

        return NextResponse.json({
            ok: true,
            message: `Tasdiqlash kodi Telegramga yuborildi. ${OTP_EXPIRY_MINUTES} daqiqa ichida kiring.`,
            expiresIn: OTP_EXPIRY_MINUTES * 60, // sekund
        });

    } catch (error) {
        console.error('[SendOTP Error]:', error);
        return NextResponse.json({ error: 'Serverda xatolik' }, { status: 500 });
    }
}
