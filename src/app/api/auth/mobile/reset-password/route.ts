/**
 * POST /api/auth/mobile/reset-password
 *
 * OTP orqali parolni yangilash. Muvaffaqiyatli bo'lsa auto-login (token qaytaradi).
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword, normalizePhone } from '@/lib/userAuth';
import { getMobileUserTokenSecret } from '@/lib/auth/tokenSecrets';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const MAX_WRONG_ATTEMPTS = 5;

function generateToken(userId: number, phone: string | null): string {
    const payload = JSON.stringify({ userId, phone, ts: Date.now() });
    const hmac = crypto
        .createHmac('sha256', getMobileUserTokenSecret())
        .update(payload)
        .digest('hex');
    return Buffer.from(payload).toString('base64') + '.' + hmac;
}

export async function POST(request: Request) {
    try {
        const rl = await rateLimit(request, {
            bucket: 'mobile-reset-password',
            limit: 10,
            windowMs: 5 * 60_000,
        });
        if (!rl.ok) return rl.response;

        const body = await request.json();
        const { phone, email, otp, newPassword } = body as {
            phone?: string;
            email?: string;
            otp?: string;
            newPassword?: string;
        };

        if (!otp) {
            return NextResponse.json(
                { error: 'Tasdiqlash kodi kiritilishi shart' },
                { status: 400 }
            );
        }

        if (!/^\d{6}$/.test(otp.trim())) {
            return NextResponse.json(
                { error: "Kod 6 raqamdan iborat bo'lishi kerak" },
                { status: 400 }
            );
        }

        if (!newPassword || newPassword.length < 6) {
            return NextResponse.json(
                { error: "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak" },
                { status: 400 }
            );
        }

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

        // ── OTP tekshirish ───────────────────────────────────────────
        if (!user.otpCode || !user.otpExpiry) {
            return NextResponse.json(
                { error: 'Kod yuborilmagan' },
                { status: 400 }
            );
        }

        if (new Date() > user.otpExpiry) {
            await prisma.user.update({
                where: { id: user.id },
                data: { otpCode: null, otpExpiry: null, otpAttempts: 0 },
            });
            return NextResponse.json(
                { error: 'Kod muddati tugagan', expired: true },
                { status: 401 }
            );
        }

        if (user.otpAttempts >= MAX_WRONG_ATTEMPTS) {
            await prisma.user.update({
                where: { id: user.id },
                data: { otpCode: null, otpExpiry: null, otpAttempts: 0 },
            });
            return NextResponse.json(
                { error: "Juda ko'p urinish", tooManyAttempts: true },
                { status: 401 }
            );
        }

        if (user.otpCode !== otp.trim()) {
            await prisma.user.update({
                where: { id: user.id },
                data: { otpAttempts: { increment: 1 } },
            });
            return NextResponse.json(
                { error: "Noto'g'ri kod" },
                { status: 401 }
            );
        }

        // ── Parolni yangilash + OTP tozalash ─────────────────────────
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: await hashPassword(newPassword),
                otpCode: null,
                otpExpiry: null,
                otpAttempts: 0,
            },
        });

        const token = generateToken(user.id, user.phone);

        return NextResponse.json({
            ok: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                ecoPoints: user.ecoPoints || 0,
            },
        });
    } catch (error) {
        console.error('[Mobile Reset Password]:', error);
        return NextResponse.json(
            { error: 'Serverda xatolik yuz berdi' },
            { status: 500 }
        );
    }
}
