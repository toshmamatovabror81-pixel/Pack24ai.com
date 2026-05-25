import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(campaigns);
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, content, audience, status, sentAt } = body;

        const campaign = await prisma.campaign.create({
            data: {
                type,
                content,
                audience,
                status,
                sentAt: sentAt ? new Date(sentAt) : null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        });

        return NextResponse.json(campaign, { status: 201 });
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }
}


