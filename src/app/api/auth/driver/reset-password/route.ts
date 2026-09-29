/**
 * POST /api/auth/driver/reset-password
 *
 * Haydovchi parolini tiklash — ikki bosqichli, Telegram OTP orqali.
 *
 * 1-bosqich. Body: { phone?: string, email?: string }
 *    → haydovchining Telegram'iga (@pack24MX_bot) 6 xonali kod yuboriladi.
 * 2-bosqich. Body: { phone?: string, email?: string, otp: string, newPassword: string }
 *    → kod to'g'ri bo'lsa parol yangilanadi.
 *
 * Xavfsizlik:
 *  - Kodsiz parol o'zgartirib bo'lmaydi (oldin faqat telefon raqami yetarli edi)
 *  - Kod 10 daqiqa amal qiladi, 5 ta noto'g'ri urinishdan keyin bekor bo'ladi
 *  - 1-bosqich javobi haydovchi mavjudligini oshkor qilmaydi
 *  - Rate limit: 10 ta so'rov / 10 daqiqa
 *  - Parol bcrypt bilan hash qilinadi
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { rateLimit } from '@/lib/rateLimit';

const OTP_TTL_MS = 10 * 60_000;
const MAX_WRONG_ATTEMPTS = 5;

const CODE_SENT_MESSAGE =
    'Agar hisobingiz Telegram botga ulangan bo\'lsa, tasdiqlash kodi yuborildi. Kod kelmasa, admin bilan bog\'laning.';

async function sendTelegram(chatId: string, text: string) {
    const botToken = process.env.DRIVER_BOT_TOKEN;
    if (!botToken) return false;
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    return res.ok;
}

function normalizePhone(phone: string): string {
    let p = phone.replace(/[^\d+]/g, '');
    if (!p.startsWith('+')) p = '+' + p;
    return p;
}

export async function POST(request: Request) {
    // Rate limiting — 10 urinish / 10 daqiqa (kod so'rash + tasdiqlash)
    const rl = await rateLimit(request, {
        bucket: 'driver-reset-password',
        limit: 10,
        windowMs: 10 * 60_000,
    });
    if (!rl.ok) return rl.response;

    try {
        const body = await request.json();
        const { phone, email, otp, newPassword } = body as {
            phone?: string;
            email?: string;
            otp?: string;
            newPassword?: string;
        };

        // Validatsiya
        if (!phone && !email) {
            return NextResponse.json(
                { error: 'Telefon raqam yoki email manzil kiritilishi shart' },
                { status: 400 }
            );
        }

        // Haydovchini topish
        let driver;

        if (phone) {
            const cleanPhone = normalizePhone(phone);
            driver = await prisma.driver.findUnique({
                where: { phone: cleanPhone },
                select: { id: true, name: true, status: true, telegramId: true, resetOtpCode: true, resetOtpExpiry: true, resetOtpAttempts: true },
            });
        } else if (email) {
            const cleanEmail = email.trim().toLowerCase();
            driver = await prisma.driver.findUnique({
                where: { email: cleanEmail },
                select: { id: true, name: true, status: true, telegramId: true, resetOtpCode: true, resetOtpExpiry: true, resetOtpAttempts: true },
            });
        }

        // ── 1-bosqich: kod yuborish ─────────────────────────────────
        if (!otp) {
            // Xavfsizlik: haydovchi topilmasa ham bir xil javob (enumeration himoyasi)
            if (driver && driver.status !== 'inactive' && driver.telegramId) {
                const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
                await prisma.driver.update({
                    where: { id: driver.id },
                    data: {
                        resetOtpCode: code,
                        resetOtpExpiry: new Date(Date.now() + OTP_TTL_MS),
                        resetOtpAttempts: 0,
                    },
                });
                try {
                    await sendTelegram(driver.telegramId, [
                        '🔐 *Parolni tiklash kodi*',
                        '',
                        `Kod: \`${code}\``,
                        '',
                        'Kod 10 daqiqa amal qiladi. Agar siz so\'ramagan bo\'lsangiz, bu xabarni e\'tiborsiz qoldiring.',
                    ].join('\n'));
                } catch (err) {
                    console.error('[Driver Reset Password] Telegram send failed:', err);
                }
            }
            return NextResponse.json({ ok: true, codeSent: true, message: CODE_SENT_MESSAGE });
        }

        // ── 2-bosqich: kodni tekshirish va parolni yangilash ────────
        if (!newPassword || typeof newPassword !== 'string') {
            return NextResponse.json(
                { error: 'Yangi parol kiritilishi shart' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' },
                { status: 400 }
            );
        }

        if (newPassword.length > 128) {
            return NextResponse.json(
                { error: 'Parol juda uzun' },
                { status: 400 }
            );
        }

        if (!/^\d{6}$/.test(String(otp).trim())) {
            return NextResponse.json(
                { error: "Kod 6 raqamdan iborat bo'lishi kerak" },
                { status: 400 }
            );
        }

        if (!driver || driver.status === 'inactive' || !driver.resetOtpCode || !driver.resetOtpExpiry) {
            return NextResponse.json(
                { error: "Kod noto'g'ri yoki muddati tugagan. Yangi kod so'rang." },
                { status: 401 }
            );
        }

        if (new Date() > driver.resetOtpExpiry || driver.resetOtpAttempts >= MAX_WRONG_ATTEMPTS) {
            await prisma.driver.update({
                where: { id: driver.id },
                data: { resetOtpCode: null, resetOtpExpiry: null, resetOtpAttempts: 0 },
            });
            return NextResponse.json(
                { error: "Kod noto'g'ri yoki muddati tugagan. Yangi kod so'rang." },
                { status: 401 }
            );
        }

        const expected = Buffer.from(driver.resetOtpCode);
        const received = Buffer.from(String(otp).trim());
        if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
            await prisma.driver.update({
                where: { id: driver.id },
                data: { resetOtpAttempts: { increment: 1 } },
            });
            return NextResponse.json(
                { error: "Noto'g'ri kod" },
                { status: 401 }
            );
        }

        // Parolni hash qilish
        const passwordHash = await bcrypt.hash(newPassword, 12);

        // Parolni yangilash
        await prisma.driver.update({
            where: { id: driver.id },
            data: {
                passwordHash,
                lastSeenAt: new Date(),
                resetOtpCode: null,
                resetOtpExpiry: null,
                resetOtpAttempts: 0,
            },
        });

        // Telegram bildirishnoma
        if (driver.telegramId) {
            try {
                await sendTelegram(driver.telegramId, [
                    '🔐 *Parolingiz yangilandi*',
                    '',
                    `Salom, *${driver.name}*!`,
                    '',
                    'Hisobingiz paroli muvaffaqiyatli yangilandi.',
                    '',
                    '⚠️ Agar siz bu amaliyotni bajarmagan bo\'lsangiz, darhol admin bilan bog\'laning.',
                ].join('\n'));
            } catch {
                // Bildirishnoma xatosi asosiy jarayonni to'xtatmasin
            }
        }

        return NextResponse.json({
            ok: true,
            message: 'Parol muvaffaqiyatli yangilandi! Yangi parol bilan tizimga kirishingiz mumkin.',
        });

    } catch (error) {
        console.error('[Driver Reset Password]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
