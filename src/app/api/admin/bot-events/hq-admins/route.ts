import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateUniqueTelegramRegistrationCode } from '@/lib/telegram/registrationCodes';

export async function GET() {
    try {
        const admins = await prisma.telegramHqAdmin.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(admins);
    } catch (error) {
        console.error('[HQAdmins GET]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const name = body.name?.trim();
        const phone = body.phone?.trim();

        if (!name || !phone) {
            return NextResponse.json({ error: 'Ism va telefon majburiy' }, { status: 400 });
        }

        const registrationCode = await generateUniqueTelegramRegistrationCode();
        const admin = await prisma.telegramHqAdmin.create({
            data: {
                name,
                phone,
                isActive: body.isActive ?? true,
                registrationCode,
            },
        });

        return NextResponse.json(admin, { status: 201 });
    } catch (error) {
        console.error('[HQAdmins POST]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
