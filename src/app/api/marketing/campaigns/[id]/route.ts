import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const campaign = await prisma.campaign.findUnique({
            where: { id: parseInt(id) },
        });

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        return NextResponse.json(campaign);
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { type, content, audience, status, sentAt } = body;

        const campaign = await prisma.campaign.update({
            where: { id: parseInt(id) },
            data: {
                type,
                content,
                audience,
                status,
                sentAt: sentAt ? new Date(sentAt) : null,
            },
        });

        return NextResponse.json(campaign);
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.campaign.delete({
            where: { id: parseInt(id) },
        });

        return NextResponse.json({ message: 'Campaign deleted successfully' });
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }
}
