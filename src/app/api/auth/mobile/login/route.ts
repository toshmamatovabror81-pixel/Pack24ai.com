/**
 * POST /api/auth/mobile/login
 *
 * Mobil ilovalar uchun parol bilan kirish.
 * Telefon+parol YOKI email+parol orqali kirish mumkin.
 * JWT token qaytaradi (Bearer formatda).
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { verifyPassword, normalizePhone } from '@/lib/userAuth';
import { getMobileUserTokenSecret } from '@/lib/auth/tokenSecrets';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

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
            bucket: 'mobile-login',
            limit: 10,
            windowMs: 5 * 60_000,
        });
        if (!rl.ok) return rl.response;

        const body = await request.json();
        const { phone, email, password } = body as {
            phone?: string;
            email?: string;
            password?: string;
        };

        if (!password) {
            return NextResponse.json(
                { error: 'Parol kiritilishi shart' },
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

        if (!user || !user.passwordHash) {
            return NextResponse.json(
                { error: "Telefon/email yoki parol noto'g'ri" },
                { status: 401 }
            );
        }

        // ── Parol tekshirish ─────────────────────────────────────────
        const { valid, needsRehash, nextHash } = await verifyPassword(
            password,
            user.passwordHash
        );

        if (!valid) {
            return NextResponse.json(
                { error: "Telefon/email yoki parol noto'g'ri" },
                { status: 401 }
            );
        }

        // ── Legacy hash ni bcrypt ga yangilash ───────────────────────
        if (needsRehash && nextHash) {
            await prisma.user.update({
                where: { id: user.id },
                data: { passwordHash: nextHash },
            });
        }

        // ── Aktiv ekanligini tekshirish ──────────────────────────────
        if (!user.isActive) {
            return NextResponse.json(
                { error: "Foydalanuvchi bloklangan" },
                { status: 403 }
            );
        }

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
        console.error('[Mobile Login]:', error);
        return NextResponse.json(
            { error: 'Serverda xatolik yuz berdi' },
            { status: 500 }
        );
    }
}
