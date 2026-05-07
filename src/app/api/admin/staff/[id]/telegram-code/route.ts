import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/admin/staff/:id/telegram-code — Yangi Telegram ulash kodi yaratish */
export async function POST(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const userId = parseInt(id, 10);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, telegramId: true },
        });
        if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // 6 xonali unikal kod yaratish
        const code = Math.random().toString().slice(2, 8);

        // Kodni user ga saqlash (telegramId maydoniga vaqtincha yozamiz yoki alohida field)
        // Bu yerda staffLinkCode sifatida foydalanuvchi telegramVerifiedAt ga saqlymiz
        await prisma.user.update({
            where: { id: userId },
            data: {
                // Kodni metadata sifatida saqlash — telegramId hali bo'sh bo'lsa
                telegramVerifiedAt: null,
            },
        });

        // Global o'zgaruvchi orqali kodni saqlash (produksiya uchun Redis ishlatiladi)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = globalThis as any;
        if (!g.__staffTelegramCodes) g.__staffTelegramCodes = {};
        g.__staffTelegramCodes[code] = userId;

        return NextResponse.json({
            code,
            message: `Xodim "${user.name}" uchun Telegram ulash kodi: ${code}. Xodim bu kodni @pack24AUP_bot ga yuborishi kerak.`,
            instruction: `Telegramda @pack24AUP_bot ni oching va /link ${code} buyrug'ini yuboring.`,
        });
    } catch (err) {
        console.error('[API TelegramCode POST]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
