import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    void request;
    return NextResponse.json(
        {
            ok: false,
            error: 'Deprecated endpoint. Use /api/telegram/webhook instead.',
        },
        { status: 410 },
    );
}

export async function GET() {
    return NextResponse.json(
        {
            ok: false,
            error: 'Deprecated endpoint. Use /api/telegram/webhook instead.',
        },
        { status: 410 },
    );
}
