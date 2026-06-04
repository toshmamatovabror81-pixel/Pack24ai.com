import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ─── Sample data (Carbon model hali yo'q) ─────────────────────────────────────
const SAMPLE_CREDITS = [
    { id: 1, seller: 'EcoTex LLC', amount: 500, pricePerKg: 15000, currency: 'UZS', listedAt: '2026-05-20', status: 'available', verified: true },
    { id: 2, seller: 'GreenPack MChJ', amount: 1200, pricePerKg: 12500, currency: 'UZS', listedAt: '2026-05-18', status: 'available', verified: true },
    { id: 3, seller: 'Toza Muhit', amount: 300, pricePerKg: 18000, currency: 'UZS', listedAt: '2026-05-22', status: 'available', verified: false },
    { id: 4, seller: 'RecycloUz', amount: 800, pricePerKg: 11000, currency: 'UZS', listedAt: '2026-05-15', status: 'available', verified: true },
    { id: 5, seller: 'EcoFiber Group', amount: 2000, pricePerKg: 9500, currency: 'UZS', listedAt: '2026-05-25', status: 'available', verified: true },
    { id: 6, seller: 'Qayta Ishlash MChJ', amount: 450, pricePerKg: 14000, currency: 'UZS', listedAt: '2026-05-28', status: 'available', verified: true },
    { id: 7, seller: 'BioPak Tashkent', amount: 150, pricePerKg: 20000, currency: 'UZS', listedAt: '2026-05-30', status: 'sold', verified: true },
    { id: 8, seller: 'Green Valley Co', amount: 600, pricePerKg: 13000, currency: 'UZS', listedAt: '2026-06-01', status: 'available', verified: false },
    { id: 9, seller: 'Pack24 Eco Division', amount: 3500, pricePerKg: 8500, currency: 'UZS', listedAt: '2026-06-02', status: 'available', verified: true },
    { id: 10, seller: 'O\'rmon Himoyasi', amount: 250, pricePerKg: 17500, currency: 'UZS', listedAt: '2026-05-10', status: 'available', verified: true },
    { id: 11, seller: 'Samarqand Recyclers', amount: 700, pricePerKg: 10500, currency: 'UZS', listedAt: '2026-06-03', status: 'available', verified: true },
    { id: 12, seller: 'Namangan Green', amount: 380, pricePerKg: 16000, currency: 'UZS', listedAt: '2026-06-04', status: 'available', verified: false },
];

function computeMarketStats() {
    const available = SAMPLE_CREDITS.filter(c => c.status === 'available');
    const totalAvailable = available.reduce((sum, c) => sum + c.amount, 0);
    const avgPrice = available.length > 0
        ? Math.round(available.reduce((sum, c) => sum + c.pricePerKg, 0) / available.length)
        : 0;
    return {
        totalAvailable,
        avgPrice,
        totalTraded: 25000,
        activeListings: available.length,
    };
}

// ─── GET /api/carbon/credits — Mavjud kreditlarni olish ──────────────────────
export async function GET() {
    try {
        return NextResponse.json({
            credits: SAMPLE_CREDITS,
            marketStats: computeMarketStats(),
        });
    } catch (error) {
        console.error('[GET /api/carbon/credits]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── POST /api/carbon/credits — Yangi kredit listing yaratish ────────────────
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Tizimga kiring' },
                { status: 401 }
            );
        }

        // Corporate user tekshiruvi (role yoki userType orqali)
        const user = session.user as { id: string; role?: string; userType?: string };
        if (user.role !== 'corporate' && user.userType !== 'corporate') {
            // Hozircha har qanday autentifikatsiyalangan foydalanuvchiga ruxsat
            // Kelajakda faqat corporate user'larga cheklanadi
        }

        const body = await request.json();
        const { amount, pricePerKg } = body;

        // Validatsiya
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return NextResponse.json(
                { error: 'CO₂ miqdorini to\'g\'ri kiriting (kg)' },
                { status: 400 }
            );
        }

        if (!pricePerKg || typeof pricePerKg !== 'number' || pricePerKg <= 0) {
            return NextResponse.json(
                { error: 'Narxni to\'g\'ri kiriting (UZS/kg)' },
                { status: 400 }
            );
        }

        if (amount > 100000) {
            return NextResponse.json(
                { error: 'Maksimum 100,000 kg miqdor kiritish mumkin' },
                { status: 400 }
            );
        }

        if (pricePerKg > 1000000) {
            return NextResponse.json(
                { error: 'Maksimum narx 1,000,000 UZS/kg' },
                { status: 400 }
            );
        }

        // DB modelga yozish hozircha yo'q — muvaffaqiyat qaytaramiz
        const newListing = {
            id: Date.now(),
            seller: `User #${session.user.id}`,
            amount,
            pricePerKg,
            currency: 'UZS',
            listedAt: new Date().toISOString().split('T')[0],
            status: 'pending_verification',
            verified: false,
        };

        return NextResponse.json(
            { success: true, listing: newListing },
            { status: 201 }
        );
    } catch (error) {
        console.error('[POST /api/carbon/credits]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
