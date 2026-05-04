import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateUniqueTelegramRegistrationCode } from '@/lib/telegram/registrationCodes';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        const data: {
            name?: string;
            phone?: string;
            isActive?: boolean;
            registrationCode?: string;
            telegramId?: null;
            telegramName?: null;
            registeredAt?: null;
        } = {};

        if (body.name !== undefined) data.name = String(body.name).trim();
        if (body.phone !== undefined) data.phone = String(body.phone).trim();
        if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
        if (body.resetRegistrationCode) data.registrationCode = await generateUniqueTelegramRegistrationCode();
        if (body.unlinkTelegram) {
            data.telegramId = null;
            data.telegramName = null;
            data.registeredAt = null;
        }

        const updated = await prisma.telegramHqAdmin.update({
            where: { id: Number(id) },
            data,
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('[HQAdmins PUT]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.telegramHqAdmin.delete({
            where: { id: Number(id) },
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[HQAdmins DELETE]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
