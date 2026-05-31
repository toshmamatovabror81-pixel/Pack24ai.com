/**
 * POST /api/auth/mobile/forgot-password
 *
 * Parolni tiklash uchun OTP yuborish.
 * Foydalanuvchining Telegram bog'langan bo'lishi shart.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/userAuth';
import { notifyCustomer } from '@/lib/telegram/notifier';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

function generateOtp(): string {
    return String(crypto.randomInt(100_000, 999_999));
}

export async function POST(request: Request) {
    try {
        const rl = await rateLimit(request, {
            bucket: 'mobile-forgot-password',
            limit: 3,
            windowMs: 5 * 60_000,
        });
        if (!rl.ok) return rl.response;

        const body = await request.json();
        const { phone, email } = body as {
            phone?: string;
            email?: string;
        };

        if (!phone && !email) {
            return NextResponse.json(
                { error: 'Telefon yoki email kiritilishi shart' },
                { status: 400 }
            );
        }

        // ── Foydalanuvchini topish ───────────────────────────────────
        let user;
        if (phone) {
            const cleanPhone = normalizePhone(phone);
            user = await prisma.user.findUnique({
                where: { phone: cleanPhone },
            });
        } else if (email) {
            const cleanEmail = email.trim().toLowerCase();
            user = await prisma.user.findUnique({
                where: { email: cleanEmail },
            });
        }

        if (!user || !user.isActive) {
            return NextResponse.json(
                { error: 'Foydalanuvchi topilmadi' },
                { status: 404 }
            );
        }

        // ── Telegram bog'langanligini tekshirish ─────────────────────
        if (!user.telegramId) {
            return NextResponse.json(
                { error: "Telegram bog'lanmagan" },
                { status: 400 }
            );
        }

        // ── OTP yaratish va saqlash ──────────────────────────────────
        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 5 * 60_000); // 5 daqiqa

        await prisma.user.update({
            where: { id: user.id },
            data: {
                otpCode: otp,
                otpExpiry,
                otpAttempts: 0,
            },
        });

        // ── Telegram orqali OTP yuborish ─────────────────────────────
        await notifyCustomer(
            user.telegramId,
            `🔐 Parolni tiklash kodi: <b>${otp}</b>\n\nKod 5 daqiqa ichida amal qiladi.`
        );

        return NextResponse.json({
            ok: true,
            message: 'Telegram orqali kod yuborildi',
            expiresIn: 300,
        });
    } catch (error) {
        console.error('[Mobile Forgot Password]:', error);
        return NextResponse.json(
            { error: 'Serverda xatolik yuz berdi' },
            { status: 500 }
        );
    }
}
