import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { mergeBoxCalculatorConfig, type BoxCalculatorConfig } from '@/lib/domain/boxCalculatorConfig';
import { readBoxCalculatorConfig, writeBoxCalculatorConfig } from '@/lib/domain/boxCalculatorConfigStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const authError = await verifyAdminAuth(request);
    if (authError) return authError;
    return NextResponse.json(await readBoxCalculatorConfig());
}

export async function PUT(request: NextRequest) {
    const authError = await verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const body = (await request.json()) as Partial<BoxCalculatorConfig>;
        const saved = await writeBoxCalculatorConfig(mergeBoxCalculatorConfig(body));
        return NextResponse.json(saved);
    } catch {
        return NextResponse.json({ error: 'Saqlashda xatolik' }, { status: 400 });
    }
}
