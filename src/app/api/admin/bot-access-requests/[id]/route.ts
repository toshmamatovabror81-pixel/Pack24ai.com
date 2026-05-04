import { NextRequest, NextResponse } from 'next/server';
import { approveBotAccessRequest, rejectBotAccessRequest } from '@/lib/telegram/botAccessRequests';

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const requestId = Number(id);
        if (!Number.isInteger(requestId) || requestId <= 0) {
            return NextResponse.json({ error: 'ID noto\'g\'ri' }, { status: 400 });
        }

        const body = await req.json() as {
            action?: 'approve' | 'reject';
            reason?: string | null;
            approvedByHqAdminId?: number | null;
            approvedBySupervisorId?: number | null;
            pointId?: number | null;
            supervisorId?: number | null;
        };

        if (body.action === 'approve') {
            const result = await approveBotAccessRequest(requestId, {
                approvedByHqAdminId: body.approvedByHqAdminId || null,
                approvedBySupervisorId: body.approvedBySupervisorId || null,
                pointId: body.pointId || null,
                supervisorId: body.supervisorId || null,
            });
            return NextResponse.json(result);
        }

        if (body.action === 'reject') {
            const request = await rejectBotAccessRequest(requestId, {
                rejectedByHqAdminId: body.approvedByHqAdminId || null,
                rejectedBySupervisorId: body.approvedBySupervisorId || null,
                reason: body.reason || 'Admin panel orqali rad etildi',
            });
            return NextResponse.json(request);
        }

        return NextResponse.json({ error: 'Action noto\'g\'ri' }, { status: 400 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server xatosi';
        const status = message.includes('topilmadi') ? 404 : message.includes('allaqachon') ? 409 : 500;
        console.error('[BotAccessRequest PUT]', error);
        return NextResponse.json({ error: message }, { status });
    }
}
