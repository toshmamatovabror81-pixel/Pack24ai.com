import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/money';

/**
 * GET /api/admin/seed-demo
 * Demo mahsulotlarni DB ga qo'shadi (bir martalik ishlatish uchun).
 * Har bir kategoriyadan kamida 1 ta namuna mahsulot.
 */

const DEMO_PRODUCTS = [
    // ── Karton Qutilar (karton-qutilar) ──────────────────────────
    {
        name: 'Karton quti 300×200×150 mm (T-23)',
        description: 'Ikki qavatli gofroqorti. E-commerce uchun ideal. O\'ta mustahkam va engil.',
        price: 4500, sku: 'GK-300x200x150',
        category: 'karton-qutilar',
        image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg',
        isFeatured: true,
    },
    {
        name: 'Karton quti 400×300×200 mm (T-23)',
        description: 'O\'rta o\'lchamdagi mahsulotlar uchun. Marketpleyslarga mos.',
        price: 6800, sku: 'GK-400x300x200',
        category: 'karton-qutilar',
        image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg',
    },
    // ── Kuryer Paketlari (kuryer-paketlari) ──────────────────────
    {
        name: 'Kuryer paketi A4 (300×400 mm) — 50 dona',
        description: 'Marketpleys uchun maxsus. Yopishqoq lentali. O\'ta mustahkam PE.',
        price: 22000, sku: 'KP-A4-300x400-50',
        category: 'kuryer-paketlari',
        image: 'https://pack24.ru/upload/iblock/f1e/7e3h6j1i9xcn5f4q0y2w8r3t.jpg',
        isFeatured: true,
    },
    {
        name: 'Kuryer paketi A5 (250×350 mm) — 100 dona',
        description: 'Kichik buyumlar uchun. Hujjat cho\'ntagi bilan.',
        price: 35000, sku: 'KP-A5-250x350-100',
        category: 'kuryer-paketlari',
        image: 'https://pack24.ru/upload/iblock/f1e/7e3h6j1i9xcn5f4q0y2w8r3t.jpg',
    },
    // ── BOPP Paketlar (bopp-paketlar) ────────────────────────────
    {
        name: 'BOPP paket klapan+skotch 100×150 mm — 100 dona',
        description: 'Shaffof BOPP paket, natijador ko\'rinish uchun. Yevroslot mavjud.',
        price: 18000, sku: 'BOPP-KS-100x150-100',
        category: 'bopp-paketlar',
        image: 'https://pack24.ru/upload/iblock/ae2/stretch.jpg',
        isFeatured: true,
    },
    // ── Streich-Plyonka (streich-plyonka) ────────────────────────
    {
        name: 'Stretch plyonka 500 mm × 200 m (17 mkm)',
        description: 'Yuk o\'rashga mo\'ljallangan. Katta rulonlarda. Omborxonalar uchun.',
        price: 42000, sku: 'SP-500x200-17',
        category: 'streich-plyonka',
        image: 'https://pack24.ru/upload/iblock/ae2/stretch.jpg',
        isFeatured: true,
    },
    {
        name: 'Stretch plyonka qo\'l uchun 500 mm × 100 m',
        description: 'Qo\'l bilan ishlatishga qulay. Ofislar va kichik omborlar uchun ideal.',
        price: 24000, sku: 'SP-HAND-500x100',
        category: 'streich-plyonka',
        image: 'https://pack24.ru/upload/iblock/ae2/stretch.jpg',
    },
    // ── Skotch va Yelim Lenta (skotch-yelim-lenta) ───────────────
    {
        name: 'Skotch OPP shaffof 48mm × 66m (36 rulon)',
        description: 'Eng mashhur qadoqlash lentasi. Katta quti uchun qulay.',
        price: 85000, originalPrice: 95000, sku: 'LL-OPP-48x66-36',
        category: 'skotch-yelim-lenta',
        image: 'https://pack24.ru/upload/iblock/cc4/scotch.jpg',
        isFeatured: true,
    },
    // ── Pufakchali Plyonka (pufakchali-plyonka) ──────────────────
    {
        name: 'Havo-pufakli plyonka 0.6 m × 50 m (d10)',
        description: 'Nozik buyumlarni himoya qilish uchun. Shisha, keramika, elektronika uchun.',
        price: 78000, sku: 'HPP-0.6x50-D10',
        category: 'pufakchali-plyonka',
        image: 'https://pack24.ru/upload/iblock/7f3/bubblewrap.jpg',
        isFeatured: true,
    },
    // ── Kraft Paketlar (kraft-paketlar) ──────────────────────────
    {
        name: 'Kraft qog\'oz sumka 24×11×30 sm — 100 dona',
        description: 'Ekologik toza kraft qog\'ozdan. Butik va kafe uchun mos.',
        price: 62000, sku: 'QS-KRAFT-24x11x30',
        category: 'kraft-paketlar',
        image: 'https://pack24.ru/upload/iblock/b2d/kraft_bag.jpg',
        isFeatured: true,
    },
    // ── Ko\'pikli Polietilen (kopikli-polietilen) ─────────────────
    {
        name: 'Ko\'pikli polietilen 3 mm × 1 m × 50 m',
        description: 'Nozik sirt himoyasi uchun. Mebel, shisha va elektronika qadoqlashda.',
        price: 68000, sku: 'KPL-3mm-1x50',
        category: 'kopikli-polietilen',
        image: 'https://pack24.ru/upload/iblock/aa5/foam.jpg',
        isFeatured: true,
    },
    // ── Qadoqlash Qog\'ozi (qadoqlash-qogozi) ────────────────────
    {
        name: 'Kraft qog\'oz rulon 70 gr/m² 1 m × 50 m',
        description: 'Keng rulon. Mebel va katta mahsulotlarni qadoqlash uchun.',
        price: 89000, sku: 'KR-70-1x50',
        category: 'qadoqlash-qogozi',
        image: 'https://pack24.ru/upload/iblock/9c1/crepe.jpg',
        isFeatured: true,
    },
    // ── PP Lenta (pp-lenta) ───────────────────────────────────────
    {
        name: 'PP lenta 16 mm × 1000 m (PP tasma)',
        description: 'Muhim yuklarni bog\'lash uchun. Paletlash va fasonlash uchun.',
        price: 38000, sku: 'PPT-16x1000',
        category: 'pp-lenta',
        image: 'https://pack24.ru/upload/iblock/f0c/tape.jpg',
        isFeatured: true,
    },
    // ── Himoya Profili (himoya-profili) ──────────────────────────
    {
        name: 'Penoplast burchak 30×30×1000 mm — 50 dona',
        description: 'Burchaklarni zarba va sinikrishdan himoya qiladi. Yuk tashishda zarur.',
        price: 27000, sku: 'PQ-30x30x1000-50',
        category: 'himoya-profili',
        image: 'https://pack24.ru/upload/iblock/e4b/corner.jpg',
        isFeatured: true,
    },
    // ── Polietilen Paketlar (polietilen-paketlar) ─────────────────
    {
        name: 'Polietilen paket futbolka 30×50 — 100 dona',
        description: 'Klassik futbolka shaklidagi paket. Do\'konlar va savdo nuqtalari uchun.',
        price: 8900, sku: 'PP-FUTBOLKA-30x50',
        category: 'polietilen-paketlar',
        image: 'https://pack24.ru/upload/iblock/f1e/7e3h6j1i9xcn5f4q0y2w8r3t.jpg',
        isFeatured: true,
    },
    // ── Zip-Lock Paketlar (zip-lock-paketlar) ─────────────────────
    {
        name: 'Zip-lock paket shaffof 150×200 — 100 dona',
        description: 'Qayta yopish imkoniyatli paket. Oziq-ovqat va mayda buyumlar uchun.',
        price: 15000, sku: 'PP-ZIPLOCK-150x200',
        category: 'zip-lock-paketlar',
        image: 'https://pack24.ru/upload/iblock/f1e/7e3h6j1i9xcn5f4q0y2w8r3t.jpg',
        isFeatured: true,
    },
    // ── Gofrokarton (gofrokarton) ─────────────────────────────────
    {
        name: 'Gofrokarton T-23 1200×800 mm — 10 dona',
        description: 'Ikki qavatli gofrokarton. Qadoqlash va issiqlik izolyatsiyasi uchun.',
        price: 35000, sku: 'GK-SHEET-1200x800',
        category: 'gofrokarton',
        image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg',
        isFeatured: true,
    },
    // ── Termoetiketkalar (termoetiketkalar) ───────────────────────
    {
        name: 'Termo etiketka 58×40 mm ECO — 1000 dona',
        description: 'Kassalar va printerlar uchun. Suv o\'tkazmaydigan.',
        price: 25000, sku: 'TE-58x40-ECO-1000',
        category: 'termoetiketkalar',
        image: 'https://pack24.ru/upload/iblock/f0c/tape.jpg',
        isFeatured: true,
    },
] satisfies Array<{
    name: string; description?: string; price: number; originalPrice?: number;
    sku: string; category: string; image: string; isFeatured?: boolean;
}>;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const SEED_SECRET = process.env.SEED_SECRET;

    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && (!SEED_SECRET || secret !== SEED_SECRET)) {
        return NextResponse.json({ error: 'Forbidden: provide ?secret=... query param' }, { status: 403 });
    }

    try {
        let added = 0;
        let skipped = 0;

        for (const p of DEMO_PRODUCTS) {
            const exists = await prisma.product.findFirst({ where: { sku: p.sku } });
            if (exists) { skipped++; continue; }

            await prisma.product.create({
                data: {
                    name:         p.name,
                    description:  p.description ?? '',
                    price:        toDecimal(p.price),
                    originalPrice: p.originalPrice != null ? toDecimal(p.originalPrice) : null,
                    sku:          p.sku,
                    category:     p.category,
                    image:        p.image,
                    gallery:      [],
                    specifications: {},
                    tags:         [],
                    inStock:      true,
                    status:       'active',
                    rating:       0,
                    reviews:      0,
                    isFeatured:   p.isFeatured ?? false,
                },
            });
            added++;
        }

        return NextResponse.json({
            ok: true,
            message: `${added} ta mahsulot qo\'shildi, ${skipped} ta o\'tkazib yuborildi.`,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
