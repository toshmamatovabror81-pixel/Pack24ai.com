import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/money';

// GET /api/admin/seed-products — faqat development uchun!
export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    const PRODUCTS = [
        // Gofroqorti
        { name: 'Gofroqorti 300×200×150 mm (T-23)', description: 'Ikki qavatli gofroqorti. Marketpleyslarga mos.', price: 4500, category: 'Gofroqorti', image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg', sku: 'GK-300x200x150' },
        { name: 'Gofroqorti 400×300×200 mm (T-23)', description: "O'rta o'lchamdagi mahsulotlar uchun.", price: 6800, category: 'Gofroqorti', image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg', sku: 'GK-400x300x200' },
        { name: 'Gofroqorti 600×400×400 mm (T-24)', description: 'Katta hajmli mahsulotlar uchun.', price: 12500, category: 'Gofroqorti', image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg', sku: 'GK-600x400x400' },
        { name: 'Gofroqorti 200×150×100 mm (mini)', description: 'Kichik mahsulotlar va sovg\'alar uchun.', price: 2800, category: 'Gofroqorti', image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg', sku: 'GK-200x150x100' },
        { name: 'Gofroqorti 500×350×250 mm (T-23)', description: 'Universal o\'lcham. Oziq-ovqat uchun.', price: 9200, category: 'Gofroqorti', image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg', sku: 'GK-500x350x250' },
        { name: 'Gofroqorti 250×200×100 mm (T-23)', description: 'Ixcham o\'lcham. Sovg\'a va kichik tovarlar uchun.', price: 3200, category: 'Gofroqorti', image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg', sku: 'GK-250x200x100' },
        // Polietilen paketlar
        { name: 'Polietilen paket futbolka 30×50 (100 dona)', description: 'Klassik futbolka shaklidagi paket.', price: 8900, category: 'Polietilen paketlar', image: 'https://pack24.ru/upload/iblock/b2a/polyethylene_bag.jpg', sku: 'PP-FUTBOLKA-30x50' },
        { name: 'Zip-lock paket 150×200 mm (100 dona)', description: 'Qayta yopish imkoniyatli paket.', price: 15000, category: 'Polietilen paketlar', image: 'https://pack24.ru/upload/iblock/b2a/polyethylene_bag.jpg', sku: 'PP-ZIPLOCK-150x200' },
        { name: 'Polietilen paket 40×60 sm (50 dona)', description: 'Katta hajmli tovarlar uchun.', price: 11500, category: 'Polietilen paketlar', image: 'https://pack24.ru/upload/iblock/b2a/polyethylene_bag.jpg', sku: 'PP-40x60-50' },
        { name: 'Polietilen zip-lock 100×150 mm (100 dona)', description: 'Mayda buyumlar va ziyofat uchun.', price: 9800, category: 'Polietilen paketlar', image: 'https://pack24.ru/upload/iblock/b2a/polyethylene_bag.jpg', sku: 'PP-ZIPLOCK-100x150' },
        // Stretch plyonka
        { name: 'Stretch plyonka 500 mm × 200 m (17 mkm)', description: 'Palet o\'rashga mo\'ljallangan katta rulon.', price: 42000, category: 'Stretch plyonka', image: 'https://pack24.ru/upload/iblock/ae2/stretch_film.jpg', sku: 'SP-500x200-17' },
        { name: 'Stretch plyonka qo\'l 500 mm × 100 m (20 mkm)', description: 'Qo\'l bilan ishlatishga qulay.', price: 24000, category: 'Stretch plyonka', image: 'https://pack24.ru/upload/iblock/ae2/stretch_film.jpg', sku: 'SP-HAND-500x100' },
        { name: 'Stretch plyonka qora 500 mm × 200 m', description: 'Qora rangdagi stretch plyonka.', price: 48000, category: 'Stretch plyonka', image: 'https://pack24.ru/upload/iblock/ae2/stretch_film.jpg', sku: 'SP-BLACK-500x200' },
        // Lipa lenta
        { name: 'OPP skotch shaffof 48mm × 66m (36 rulon)', description: "Eng mashhur qadoqlash lentasi.", price: 85000, originalPrice: 95000, category: 'Lipa lenta', image: 'https://pack24.ru/upload/iblock/cc4/scotch_tape.jpg', sku: 'LL-OPP-48x66-36' },
        { name: 'OPP skotch jigarrang 48mm × 66m (6 rulon)', description: 'Jigarrang rangli lenta.', price: 18000, category: 'Lipa lenta', image: 'https://pack24.ru/upload/iblock/cc4/scotch_tape.jpg', sku: 'LL-OPP-BROWN-48x66' },
        { name: 'Kraft lenta 50mm × 50m (6 dona)', description: 'Ekologik kraft qog\'oz lenta.', price: 34000, category: 'Lipa lenta', image: 'https://pack24.ru/upload/iblock/cc4/scotch_tape.jpg', sku: 'QL-KRAFT-50x50' },
        // Havo-pufakli plyonka
        { name: 'Havo-pufakli plyonka 0.6m × 50m (d10)', description: 'Nozik buyumlar himoyasi uchun.', price: 78000, category: 'Havo-pufakli plyonka', image: 'https://pack24.ru/upload/iblock/7f3/bubble_wrap.jpg', sku: 'HPP-0.6x50-D10' },
        { name: 'Havo-pufakli plyonka 1.2m × 50m (d10)', description: 'Keng rulon. Mebel qadoqlash uchun.', price: 145000, category: 'Havo-pufakli plyonka', image: 'https://pack24.ru/upload/iblock/7f3/bubble_wrap.jpg', sku: 'HPP-1.2x50-D10' },
        // Qog'oz sumkalar
        { name: "Kraft sumkasi 24×11×30 sm (100 dona)", description: 'Ekologik toza kraft qog\'ozdan.', price: 62000, category: "Qog'oz sumkalar", image: 'https://pack24.ru/upload/iblock/b2d/kraft_bag.jpg', sku: 'QS-KRAFT-24x11x30' },
        { name: "Oq qog'oz sumka 26×13×32 sm (50 dona)", description: 'Brend bosma uchun ideal.', price: 38000, category: "Qog'oz sumkalar", image: 'https://pack24.ru/upload/iblock/b2d/kraft_bag.jpg', sku: 'QS-WHITE-26x13x32' },
        { name: "Kraft sumkasi kichik 18×10×22 sm (100 dona)", description: 'Sovg\'a va kafe uchun.', price: 45000, category: "Qog'oz sumkalar", image: 'https://pack24.ru/upload/iblock/b2d/kraft_bag.jpg', sku: 'QS-KRAFT-18x10x22' },
        // Ko'pikli plyonka
        { name: "Ko'pikli polyetilen 3mm × 1m × 50m", description: 'Nozik sirt himoyasi.', price: 68000, category: "Ko'pikli plyonka", image: 'https://pack24.ru/upload/iblock/aa5/foam_polyethylene.jpg', sku: 'KPL-3mm-1x50' },
        // Qo'riqchi qirralar
        { name: "Burchak qo'riqchi 30×30×1000 mm (50 dona)", description: 'Burchaklarni zarba va sinishdan himoya.', price: 27000, category: "Qo'riqchi qirralar", image: 'https://pack24.ru/upload/iblock/e4b/corner_protector.jpg', sku: 'PQ-30x30x1000-50' },
        // Tasma
        { name: 'PP tasma 16mm × 1000m', description: "Palet bog'lash uchun.", price: 38000, category: 'Tasma', image: 'https://pack24.ru/upload/iblock/f0c/strapping_tape.jpg', sku: 'PPT-16x1000' },
        // Qog'oz va karton
        { name: "Kraft qog'oz 1m × 50m (70 gr/m²)", description: 'Keng rulon. Mebel va katta mahsulotlar uchun.', price: 89000, category: "Qog'oz va karton", image: 'https://pack24.ru/upload/iblock/9c1/kraft_paper.jpg', sku: 'KR-70-1x50' },
    ];

    let added = 0;
    let skipped = 0;
    const results: string[] = [];

    for (const p of PRODUCTS) {
        const existing = await prisma.product.findFirst({ where: { sku: p.sku } });
        if (existing) { skipped++; continue; }

        await prisma.product.create({
            data: {
                name: p.name,
                description: p.description ?? '',
                price: toDecimal(p.price),
                originalPrice: p.originalPrice != null ? toDecimal(p.originalPrice) : null,
                category: p.category,
                image: p.image,
                sku: p.sku,
                inStock: true,
                status: 'active',
                gallery: '[]',
                rating: 0,
                reviews: 0,
            }
        });
        added++;
        results.push(p.name);
    }

    return NextResponse.json({
        success: true,
        message: `${added} ta mahsulot qo'shildi, ${skipped} ta o'tkazib yuborildi.`,
        added: results,
    });
}
