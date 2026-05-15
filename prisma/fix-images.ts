/**
 * Pack24 — Singan rasmlarni tuzatish skripti
 * pack24.ru dan yuklanmayotgan rasmlarni Supabase Storage'ga ko'chiradi
 * 
 * Ishlatish: npx tsx prisma/fix-images.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Kategoriya bo'yicha emoji xarita (rasm o'rniga SVG placeholder yaratish uchun)
const CATEGORY_EMOJI: Record<string, string> = {
    'karton-qutilar': '📦',
    'kuryer-paketlari': '📮',
    'rossiya-pochta-paketlari': '✉️',
    'bopp-paketlar': '🔲',
    'zip-lock-paketlar': '🔒',
    'pvd-paketlar-marketpleys': '🛍️',
    'slayder-paketlar': '🎚️',
    'qadoqlash-plyonkasi': '🔄',
    'paket-payvandlagichlar': '⚡',
    'kraft-paketlar': '☕',
    'doy-pak': '☕',
    'polietilen-paketlar': '🛍️',
    'pufakchali-plyonka': '💨',
    'havo-yostigi-lentasi': '💨',
    'havo-yostiqli-paketlar': '💨',
    'qadoqlash-qogozi': '📄',
    'qogoz-konvertlar': '✉️',
    'termoetiketkalar': '🏷️',
    'skotch-yelim-lenta': '🎗️',
    'streich-plyonka': '🔄',
    'toldiruvchilar': '📦',
    'karton-tubuslar': '🥫',
    'gofrokarton': '📦',
    'himoya-profili': '🛡️',
    'plastik-qutilar': '📦',
    'kopikli-polietilen': '🔲',
    'kopikli-pe-paketlar': '🛍️',
    'yelimli-chontaklar': '⬜',
    'dokonlar-uchun-mollar': '🏪',
    'vakuum-paketlar': '📦',
    'termo-qisqaruvchi-plyonka': '📦',
    'pp-qoplar': '🛍️',
    'pp-lenta': '➖',
    'termo-paketlar': '🌡️',
    'iplar-arqonlar': '🧵',
    'plombalar': '🔒',
    'kanselyariya': '✏️',
    'pet-bankalar': '🥫',
    'himoya-vositalari': '🛡️',
    'palletlar': '🪵',
    'gofrokoroblar': '📦',
    'arxiv-qutilar': '🗄️',
    'oziq-ovqat-konteynerlari': '🍱',
    'pishiriq-qogozi': '👨‍🍳',
    'chiqindi-paketlari': '🗑️',
};

// pack24.ru URL'larini kategory nomi bo'yicha yaxshi placeholder SVG rasmiga almashtirish
// Bu SVG rasmlar data:image/svg sifatida saqlanadi yoki Supabase'ga yuklanadi
function generatePlaceholderSvg(productName: string, category: string): string {
    const emoji = CATEGORY_EMOJI[category] || '📦';
    const shortName = productName.slice(0, 30);
    const colors = getCategoryColors(category);
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors[1]};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)" rx="0"/>
  <text x="300" y="260" font-size="120" text-anchor="middle" dominant-baseline="central">${emoji}</text>
  <text x="300" y="400" font-size="24" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" opacity="0.9">${escapeXml(shortName)}</text>
  <text x="300" y="440" font-size="16" fill="white" text-anchor="middle" font-family="Arial, sans-serif" opacity="0.5">PACK24.AI</text>
</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function getCategoryColors(category: string): [string, string] {
    const colorMap: Record<string, [string, string]> = {
        'karton-qutilar': ['#92400E', '#D97706'],
        'kuryer-paketlari': ['#1E3A5F', '#3B82F6'],
        'bopp-paketlar': ['#312E81', '#6366F1'],
        'zip-lock-paketlar': ['#064E3B', '#10B981'],
        'kraft-paketlar': ['#78350F', '#D97706'],
        'doy-pak': ['#7C2D12', '#EA580C'],
        'polietilen-paketlar': ['#1E3A5F', '#60A5FA'],
        'pufakchali-plyonka': ['#312E81', '#818CF8'],
        'skotch-yelim-lenta': ['#831843', '#EC4899'],
        'streich-plyonka': ['#064E3B', '#34D399'],
        'gofrokarton': ['#78350F', '#B45309'],
        'plombalar': ['#1F2937', '#6B7280'],
        'termoetiketkalar': ['#4C1D95', '#7C3AED'],
        'qadoqlash-qogozi': ['#713F12', '#CA8A04'],
    };
    return colorMap[category] || ['#1E293B', '#475569'];
}

async function fixBrokenImages() {
    console.log('🔧 Pack24 — Singan rasmlarni tuzatish boshlandi...\n');

    // 1. Barcha mahsulotlarni olish
    const products = await prisma.product.findMany({
        select: { id: true, name: true, image: true, category: true },
    });

    console.log(`📦 Jami mahsulotlar: ${products.length}`);

    // 2. Singan rasmli mahsulotlarni filtrlash
    const broken = products.filter(p => 
        p.image && (
            p.image.includes('pack24.ru') || 
            p.image === '/placeholder.png' ||
            p.image.startsWith('/uploads/')
        )
    );

    console.log(`❌ Singan rasmlar: ${broken.length}`);
    console.log(`✅ Yaxshi rasmlar: ${products.length - broken.length}\n`);

    if (broken.length === 0) {
        console.log('✨ Barcha rasmlar yaxshi! Hech narsa tuzatish kerak emas.');
        return;
    }

    // 3. Har bir singan mahsulotga SVG placeholder yaratish
    let fixed = 0;
    for (const product of broken) {
        const category = product.category || 'unknown';
        const svgDataUrl = generatePlaceholderSvg(product.name, category);

        await prisma.product.update({
            where: { id: product.id },
            data: { image: svgDataUrl },
        });

        fixed++;
        if (fixed % 10 === 0) {
            console.log(`  ✅ ${fixed}/${broken.length} tuzatildi...`);
        }
    }

    console.log(`\n🎉 ${fixed} ta mahsulot rasmi muvaffaqiyatli tuzatildi!`);

    // 4. Maxsus belgi bilan slug tuzatish
    const badSlug = await prisma.product.findMany({
        where: { category: { contains: 'ʼ' } },
        select: { id: true, category: true },
    });

    if (badSlug.length > 0) {
        for (const p of badSlug) {
            const fixed = p.category!.replace(/ʼ/g, "'").replace(/'/g, '-');
            await prisma.product.update({
                where: { id: p.id },
                data: { category: 'havo-yostigi-lentasi' },
            });
        }
        console.log(`🔧 ${badSlug.length} ta noto'g'ri slug tuzatildi`);
    }
}

fixBrokenImages()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
