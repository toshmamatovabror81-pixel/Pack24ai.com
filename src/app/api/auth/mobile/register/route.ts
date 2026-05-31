/**
 * POST /api/auth/mobile/register
 *
 * Mobil ilovalar uchun ro'yxatdan o'tish.
 * Telefon YOKI email (kamida bittasi) orqali ro'yxatdan o'tish mumkin.
 * JWT token qaytaradi (Bearer formatda).
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword, isValidPhone, normalizePhone } from '@/lib/userAuth';
import { generateReferralCode, REFERRAL_SIGNUP_BONUS } from '@/lib/referral';
import { getMobileUserTokenSecret } from '@/lib/auth/tokenSecrets';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateToken(userId: number, phone: string | null): string {
    const payload = JSON.stringify({ userId, phone, ts: Date.now() });
    const hmac = crypto
        .createHmac('sha256', getMobileUserTokenSecret())
        .update(payload)
        .digest('hex');
    return Buffer.from(payload).toString('base64') + '.' + hmac;
}

async function createUniqueReferralCode(
    tx: Pick<typeof prisma, 'user'>
): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const referralCode = generateReferralCode();
        const existing = await tx.user.findUnique({
            where: { referralCode },
            select: { id: true },
        });
        if (!existing) return referralCode;
    }
    throw new Error("Referral code yaratib bo'lmadi");
}

export async function POST(request: Request) {
    try {
        const rl = await rateLimit(request, {
            bucket: 'mobile-register',
            limit: 5,
            windowMs: 15 * 60_000,
        });
        if (!rl.ok) return rl.response;

        const body = await request.json();
        const { name, phone, email, password, referralCode } = body as {
            name?: string;
            phone?: string;
            email?: string;
            password?: string;
            referralCode?: string;
        };

        // ── Validatsiya ──────────────────────────────────────────────
        if (!name || name.trim().length < 2) {
            return NextResponse.json(
                { error: "Ism kamida 2 ta belgidan iborat bo'lishi kerak" },
                { status: 400 }
            );
        }

        if (!password || password.length < 6) {
            return NextResponse.json(
                { error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" },
                { status: 400 }
            );
        }

        if (!phone && !email) {
            return NextResponse.json(
                { error: 'Telefon yoki email kiritilishi shart' },
                { status: 400 }
            );
        }

        let cleanPhone: string | null = null;
        let cleanEmail: string | null = null;

        // ── Telefon tekshirish ───────────────────────────────────────
        if (phone) {
            cleanPhone = normalizePhone(phone);
            if (!isValidPhone(cleanPhone)) {
                return NextResponse.json(
                    { error: 'Telefon formati: +998901234567' },
                    { status: 400 }
                );
            }
            const existingByPhone = await prisma.user.findUnique({
                where: { phone: cleanPhone },
                select: { id: true },
            });
            if (existingByPhone) {
                return NextResponse.json(
                    { error: "Bu telefon raqam allaqachon ro'yxatdan o'tgan" },
                    { status: 409 }
                );
            }
        }

        // ── Email tekshirish ─────────────────────────────────────────
        if (email) {
            cleanEmail = email.trim().toLowerCase();
            if (!EMAIL_REGEX.test(cleanEmail)) {
                return NextResponse.json(
                    { error: "Email formati noto'g'ri" },
                    { status: 400 }
                );
            }
            const existingByEmail = await prisma.user.findUnique({
                where: { email: cleanEmail },
                select: { id: true },
            });
            if (existingByEmail) {
                return NextResponse.json(
                    { error: "Bu email allaqachon ro'yxatdan o'tgan" },
                    { status: 409 }
                );
            }
        }

        // ── Referral tekshirish ──────────────────────────────────────
        const normalizedReferralCode =
            referralCode?.trim().toUpperCase() || null;
        const referrer = normalizedReferralCode
            ? await prisma.user.findUnique({
                  where: { referralCode: normalizedReferralCode },
                  select: { id: true },
              })
            : null;

        if (normalizedReferralCode && !referrer) {
            return NextResponse.json(
                { error: 'Referal kodi topilmadi yoki eskirgan' },
                { status: 400 }
            );
        }

        // ── Tranzaksiya: foydalanuvchi yaratish + referral bonus ─────
        const newUser = await prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    name: name.trim(),
                    phone: cleanPhone,
                    email: cleanEmail,
                    passwordHash: await hashPassword(password),
                    role: 'user',
                    isActive: true,
                    referralCode: await createUniqueReferralCode(tx),
                    referredById: referrer?.id ?? null,
                },
            });

            if (referrer?.id) {
                await tx.user.update({
                    where: { id: referrer.id },
                    data: {
                        ecoPoints: { increment: REFERRAL_SIGNUP_BONUS },
                    },
                });
            }

            return createdUser;
        });

        const token = generateToken(newUser.id, newUser.phone);

        return NextResponse.json(
            {
                ok: true,
                token,
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    phone: newUser.phone,
                    email: newUser.email,
                    ecoPoints: newUser.ecoPoints || 0,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('[Mobile Register]:', error);
        return NextResponse.json(
            { error: 'Serverda xatolik yuz berdi' },
            { status: 500 }
        );
    }
}
