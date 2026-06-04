import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/prisma';
import { generateReferralCode } from '@/lib/referral';

const LEVEL1_POINTS = 500;
const LEVEL2_POINTS = 200;
const LEVEL3_POINTS = 100;
const ECO_AMBASSADOR_THRESHOLD = 10;

async function createUniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const referralCode = generateReferralCode();
        const existing = await prisma.user.findUnique({
            where: { referralCode },
            select: { id: true },
        });
        if (!existing) {
            return referralCode;
        }
    }

    throw new Error('Referal kodini yaratib bo\'lmadi');
}

const referralSelect = {
    id: true,
    name: true,
    createdAt: true,
    ecoPoints: true,
} as const;

export async function GET() {
    try {
        const guard = await requireUser();
        if (!guard.ok) return guard.response;
        const userId = Number(guard.user.id);

        let user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                referrals: {
                    select: {
                        ...referralSelect,
                        referrals: {
                            select: {
                                ...referralSelect,
                                referrals: {
                                    select: referralSelect,
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Agar foydalanuvchida hali referal kod bo'lmasa, uni yaratib beramiz
        if (!user.referralCode) {
            user = await prisma.user.update({
                where: { id: userId },
                data: {
                    referralCode: await createUniqueReferralCode(),
                },
                include: {
                    referrals: {
                        select: {
                            ...referralSelect,
                            referrals: {
                                select: {
                                    ...referralSelect,
                                    referrals: {
                                        select: referralSelect,
                                    },
                                },
                            },
                        },
                    },
                },
            });
        }

        // Level 1: direct referrals
        const level1Referrals = user.referrals.map(({ referrals: _nested, ...rest }) => rest);

        // Level 2: referrals of referrals
        const level2Referrals = user.referrals.flatMap((r) =>
            r.referrals.map(({ referrals: _nested, ...rest }) => rest)
        );

        // Level 3: referrals of level 2
        const level3Referrals = user.referrals.flatMap((r) =>
            r.referrals.flatMap((r2) => r2.referrals)
        );

        const level1Points = level1Referrals.length * LEVEL1_POINTS;
        const level2Points = level2Referrals.length * LEVEL2_POINTS;
        const level3Points = level3Referrals.length * LEVEL3_POINTS;
        const totalBonusPoints = level1Points + level2Points + level3Points;
        const totalChainSize = level1Referrals.length + level2Referrals.length + level3Referrals.length;
        const isEcoAmbassador = totalChainSize >= ECO_AMBASSADOR_THRESHOLD;

        return NextResponse.json({
            success: true,
            referralCode: user.referralCode,
            points: user.ecoPoints,
            levels: {
                level1: {
                    count: level1Referrals.length,
                    points: level1Points,
                    referrals: level1Referrals,
                },
                level2: {
                    count: level2Referrals.length,
                    points: level2Points,
                    referrals: level2Referrals,
                },
                level3: {
                    count: level3Referrals.length,
                    points: level3Points,
                    referrals: level3Referrals,
                },
            },
            totalChainSize,
            isEcoAmbassador,
            totalBonusPoints,
            // Tree structure for visualization
            tree: user.referrals.map((r) => ({
                id: r.id,
                name: r.name,
                createdAt: r.createdAt,
                ecoPoints: r.ecoPoints,
                children: r.referrals.map((r2) => ({
                    id: r2.id,
                    name: r2.name,
                    createdAt: r2.createdAt,
                    ecoPoints: r2.ecoPoints,
                    children: r2.referrals.map((r3) => ({
                        id: r3.id,
                        name: r3.name,
                        createdAt: r3.createdAt,
                        ecoPoints: r3.ecoPoints,
                    })),
                })),
            })),
        });

    } catch (error) {
        console.error('[referral] GET xatosi:', error);
        return NextResponse.json(
            { error: "Server xatosi" },
            { status: 500 }
        );
    }
}
