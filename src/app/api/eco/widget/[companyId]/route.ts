/**
 * GET /api/eco/widget/[companyId]
 * Public endpoint — korxona mijozlar saytiga embed qilish uchun eco statistikani qaytaradi.
 * Auth talab qilinmaydi (public widget data).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const id = parseInt(companyId, 10);

    if (!id || isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid company ID' },
        { status: 400, headers: corsHeaders }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        companyName: true,
        name: true,
        customerType: true,
        ecoPoints: true,
        ecoLevel: true,
        totalRecycledWeight: true,
        totalCO2Saved: true,
        treesEquivalent: true,
        lastEcoActivity: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (user.customerType !== 'corporate') {
      return NextResponse.json(
        { error: 'Widget is available for corporate accounts only' },
        { status: 403, headers: corsHeaders }
      );
    }

    const totalRecycledWeight = Math.round(user.totalRecycledWeight || 0);
    const co2Saved = Math.round(user.totalCO2Saved || 0);
    const treesEquivalent = user.treesEquivalent || 0;

    const data = {
      company: user.companyName || user.name,
      totalRecycledWeight,
      co2Saved,
      treesEquivalent,
      ecoLevel: user.ecoLevel,
      ecoPoints: user.ecoPoints || 0,
      lastActivity: user.lastEcoActivity
        ? user.lastEcoActivity.toISOString().split('T')[0]
        : null,
    };

    return NextResponse.json(data, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('[eco-widget]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
