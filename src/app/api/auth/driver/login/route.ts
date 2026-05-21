/**
 * POST /api/auth/driver/login
 * 
 * Haydovchi login — telefon/email + parol bilan kirish.
 * Bearer token qaytaradi.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDriverTokenSecret } from '@/lib/auth/tokenSecrets';

function normalizePhone(phone: string): string {
    let p = phone.replace(/[^\d+]/g, '');
    if (!p.startsWith('+')) p = '+' + p;
    return p;
}

function generateDriverToken(driverId: number, identifier: string): string {
    const payload = JSON.stringify({ driverId, identifier, role: 'driver', ts: Date.now() });
    const hmac = crypto.createHmac('sha256', getDriverTokenSecret()).update(payload).digest('hex');
    return Buffer.from(payload).toString('base64') + '.' + hmac;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phone, email, password, code } = body as {
            phone?: string;
            email?: string;
            password?: string;
            code?: string; // Legacy registration code support
        };

        // Identifikator: telefon yoki email
        const identifier = phone?.trim() || email?.trim();
        if (!identifier) {
            return NextResponse.json(
                { error: 'Telefon yoki email kiritilishi shart' },
                { status: 400 }
            );
        }

        // Foydalanuvchini topish
        let driver;
        
        if (phone) {
            const cleanPhone = normalizePhone(phone);
            driver = await prisma.driver.findUnique({
                where: { phone: cleanPhone },
                include: {
                    point: { select: { id: true, regionUz: true } },
                    supervisor: { select: { id: true, name: true, phone: true } },
                },
            });
        } else if (email) {
            const cleanEmail = email.trim().toLowerCase();
            driver = await prisma.driver.findUnique({
                where: { email: cleanEmail },
                include: {
                    point: { select: { id: true, regionUz: true } },
                    supervisor: { select: { id: true, name: true, phone: true } },
                },
            });
        }

        if (!driver) {
            return NextResponse.json(
                { error: 'Foydalanuvchi topilmadi. Avval ro\'yxatdan o\'ting.' },
                { status: 404 }
            );
        }

        if (driver.status === 'inactive') {
            return NextResponse.json(
                { error: 'Hisobingiz faol emas' },
                { status: 403 }
            );
        }

        // Autentifikatsiya: parol yoki legacy registration code
        if (password) {
            // Parol bilan kirish
            if (!driver.passwordHash) {
                return NextResponse.json(
                    { error: 'Bu hisob uchun parol o\'rnatilmagan. Maxsus kod bilan kiring yoki qaytadan ro\'yxatdan o\'ting.' },
                    { status: 401 }
                );
            }

            const isPasswordValid = await bcrypt.compare(password, driver.passwordHash);
            if (!isPasswordValid) {
                return NextResponse.json(
                    { error: 'Parol noto\'g\'ri' },
                    { status: 401 }
                );
            }
        } else if (code) {
            // Legacy: registration code bilan kirish (eski foydalanuvchilar uchun)
            if (!driver.registrationCode || driver.registrationCode !== code.trim()) {
                return NextResponse.json(
                    { error: 'Noto\'g\'ri kod' },
                    { status: 401 }
                );
            }
        } else {
            return NextResponse.json(
                { error: 'Parol kiritilishi shart' },
                { status: 400 }
            );
        }

        // Oxirgi kirishni yangilash
        await prisma.driver.update({
            where: { id: driver.id },
            data: { lastSeenAt: new Date() },
        });

        const token = generateDriverToken(driver.id, driver.phone);

        return NextResponse.json({
            ok: true,
            token,
            driver: {
                id: driver.id,
                name: driver.name,
                phone: driver.phone,
                email: driver.email,
                status: driver.status,
                isOnline: driver.isOnline,
                vehicleInfo: driver.vehicleInfo,
                point: driver.point,
                supervisor: driver.supervisor,
            },
        });
    } catch (error) {
        console.error('[Driver Auth]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
