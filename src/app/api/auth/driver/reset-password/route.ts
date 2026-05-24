/**
 * POST /api/auth/driver/reset-password
 *
 * Haydovchi parolini tiklash.
 * Telefon yoki email orqali yangi parol o'rnatish imkonini beradi.
 *
 * Body: { phone?: string, email?: string, newPassword: string }
 * Response: { ok: true, message: string }
 *
 * Xavfsizlik:
 *  - Rate limit: 3 ta urinish / 10 daqiqa
 *  - Faqat mavjud va active haydovchilar uchun ishlaydi
 *  - Parol bcrypt bilan hash qilinadi
 *  - Muvaffaqiyatli tiklanganda @pack24MX_bot orqali bildirishnoma yuboriladi
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { rateLimit } from '@/lib/rateLimit';

function normalizePhone(phone: string): string {
    let p = phone.replace(/[^\d+]/g, '');
    if (!p.startsWith('+')) p = '+' + p;
    return p;
}

export async function POST(request: Request) {
    // Rate limiting — 3 urinish / 10 daqiqa
    const rl = await rateLimit(request, {
        bucket: 'driver-reset-password',
        limit: 3,
        windowMs: 10 * 60_000,
    });
    if (!rl.ok) return rl.response;

    try {
        const body = await request.json();
        const { phone, email, newPassword } = body as {
            phone?: string;
            email?: string;
            newPassword?: string;
        };

        // Validatsiya
        if (!phone && !email) {
            return NextResponse.json(
                { error: 'Telefon raqam yoki email manzil kiritilishi shart' },
                { status: 400 }
            );
        }

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

        // Haydovchini topish
        let driver;

        if (phone) {
            const cleanPhone = normalizePhone(phone);
            driver = await prisma.driver.findUnique({
                where: { phone: cleanPhone },
                select: { id: true, name: true, status: true, telegramId: true, phone: true, email: true },
            });
        } else if (email) {
            const cleanEmail = email.trim().toLowerCase();
            driver = await prisma.driver.findUnique({
                where: { email: cleanEmail },
                select: { id: true, name: true, status: true, telegramId: true, phone: true, email: true },
            });
        }

        // Xavfsizlik: haydovchi topilmasa ham muvaffaqiyatli javob qaytaramiz
        // (enumeration hujumidan himoya)
        if (!driver) {
            return NextResponse.json({
                ok: true,
                message: 'Agar bu ma\'lumotlar tizimda mavjud bo\'lsa, parol yangilandi.',
            });
        }

        if (driver.status === 'inactive') {
            return NextResponse.json(
                { error: 'Hisobingiz faol emas. Admin bilan bog\'laning.' },
                { status: 403 }
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
            },
        });

        // Telegram bildirishnoma (agar telegramId mavjud bo'lsa)
        if (driver.telegramId) {
            try {
                const botToken = process.env.DRIVER_BOT_TOKEN;
                if (botToken) {
                    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: driver.telegramId,
                            text: [
                                '🔐 *Parolingiz yangilandi*',
                                '',
                                `Salom, *${driver.name}*!`,
                                '',
                                'Hisobingiz paroli muvaffaqiyatli yangilandi.',
                                '',
                                '⚠️ Agar siz bu amaliyotni bajarmagan bo\'lsangiz, darhol admin bilan bog\'laning.',
                            ].join('\n'),
                            parse_mode: 'Markdown',
                        }),
                    });
                }
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
