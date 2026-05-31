import { NextRequest, NextResponse } from 'next/server';
import {
    computeBoxPricing,
    isFlexoQtyValid,
    roundSalePrice,
    PAPER_LAYER_PROFILES,
    type PaperLayerProfileId,
} from '@/lib/domain/boxCalculator';
import { readBoxCalculatorConfig } from '@/lib/domain/boxCalculatorConfigStore';

export const dynamic = 'force-dynamic';

const VALID_PROFILE_IDS = new Set(PAPER_LAYER_PROFILES.map(p => p.id));
const MAX_DIMENSION_MM = 10000;

type EstimateBody = {
    l?: number;
    w?: number;
    h?: number;
    profileId?: PaperLayerProfileId;
    printType?: 'offset' | 'flexo';
    needsPrint?: boolean;
    qty?: number;
};

export async function POST(request: NextRequest) {
    let body: EstimateBody;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Noto\'g\'ri so\'rov' }, { status: 400 });
    }

    const l = Math.min(Number(body.l) || 0, MAX_DIMENSION_MM);
    const w = Math.min(Number(body.w) || 0, MAX_DIMENSION_MM);
    const h = Math.min(Number(body.h) || 0, MAX_DIMENSION_MM);
    const rawProfileId = body.profileId ?? 'e-flute';
    const profileId = (VALID_PROFILE_IDS.has(rawProfileId as PaperLayerProfileId) ? rawProfileId : 'e-flute') as PaperLayerProfileId;
    const printType = body.printType === 'flexo' ? 'flexo' : 'offset';
    const needsPrint = body.needsPrint !== false;
    const qty = Math.max(0, Math.floor(Number(body.qty) || 0));

    const config = await readBoxCalculatorConfig();
    const pricing = computeBoxPricing(
        { l, w, h },
        {
            profileId,
            includePrintGlue: printType === 'flexo' ? needsPrint : true,
            pricePerSqM: config.profilePricePerSqM[profileId],
            wasteFactor: config.wasteFactor,
            printGlueUzs: config.printGlueUzs,
            laborUzs: config.laborUzs,
            fixedUzs: config.fixedUzs,
            markupPercent: config.markupPercent,
        },
    );

    if (!pricing) {
        return NextResponse.json({ error: 'O\'lchamlar noto\'g\'ri' }, { status: 400 });
    }

    const roundedPrice = roundSalePrice(pricing.salePricePerUnit);
    const orderUnits = qty > 0 ? qty : 1;
    const offsetSetupTotal = printType === 'offset'
        ? config.offsetOneTimePrintUzs + config.offsetOneTimeDesignUzs
        : 0;
    const orderSubtotal = roundedPrice * orderUnits;
    const orderGrandTotal = orderSubtotal + (qty > 0 && printType === 'offset' ? offsetSetupTotal : 0);

    return NextResponse.json({
        roundedPrice,
        orderUnits,
        orderSubtotal,
        offsetSetupTotal,
        offsetPrintUzs: config.offsetOneTimePrintUzs,
        offsetDesignUzs: config.offsetOneTimeDesignUzs,
        orderGrandTotal,
        qtyValid: printType !== 'flexo' || qty === 0 || isFlexoQtyValid(qty),
    });
}
