/**
 * Pack24 UZ — Birlashtrilgan seed skripti
 * Bu fayl seed-demo.js va seed-products.ts o'rnini bosadi.
 * 
 * Ishga tushirish:
 *   npx tsx prisma/seed.ts
 *
 * yoki package.json ga qo'shing:
 *   "prisma": { "seed": "tsx prisma/seed.ts" }
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Barcha mahsulotlar (slug-based kategoriyalar bilan) ──────────────────────
const PRODUCTS = [
  // Karton qutilar / Gofroqorti
  {
    name: 'Karton quti 300×200×150 mm (T-23)',
    description: 'Ikki qavatli gofroqorti. Elektron tijorat uchun ideal. O\'ta mustahkam va engil.',
    price: 4500,
    sku: 'GK-300x200x150',
    category: 'karton-qutilar',
    image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg',
    isFeatured: true,
    inStock: true,
  },
  {
    name: 'Karton quti 400×300×200 mm (T-23)',
    description: 'O\'rta o\'lchamdagi mahsulotlar uchun. Marketpleyslarga mos.',
    price: 6800,
    sku: 'GK-400x300x200',
    category: 'karton-qutilar',
    image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg',
    isFeatured: false,
    inStock: true,
  },
  {
    name: 'Karton quti 600×400×400 mm (T-24)',
    description: 'Katta o\'lchamli mahsulotlar uchun. Yuk tashishda keng qo\'llaniladi.',
    price: 12500,
    sku: 'GK-600x400x400',
    category: 'karton-qutilar',
    image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg',
    isFeatured: false,
    inStock: true,
  },
  {
    name: 'Karton quti 200×150×100 mm — mini (T-23)',
    description: 'Kichik mahsulotlar va sovg\'alar uchun. Elektronika qadoqlashga mos.',
    price: 2800,
    sku: 'GK-200x150x100',
    category: 'karton-qutilar',
    image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg',
    isFeatured: false,
    inStock: true,
  },
  {
    name: 'Gofroqorti quti 500×350×250mm',
    description: 'Universal o\'lcham. Oziq-ovqat va sanoat mahsulotlari uchun.',
    price: 9200,
    sku: 'GK-500x350x250',
    category: 'gofrokoroblar',
    image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg',
    isFeatured: true,
    inStock: true,
  },
  {
    name: 'Gofrokarton T-23 1200×800mm — 10 dona',
    description: 'Varaq shaklida. Qadoqlash va ishlab chiqarish uchun.',
    price: 35000,
    sku: 'GK-SHEET-1200x800',
    category: 'gofrokarton',
    image: 'https://pack24.ru/upload/iblock/5a9/jk0pmv7jwkrqmm0gojuwbx5ubs0aoi4e.jpg',
    isFeatured: true,
    inStock: true,
  },

  // Kuryer paketlari
  {
    name: 'Kuryer paketi A4 (300×400 mm) — 50 dona',
    description: 'Onlayn do\'kon va marketpleyslar uchun ideal kuryer paketi.',
    price: 22000,
    sku: 'KP-A4-50',
    category: 'kuryer-paketlari',
    image: 'https://pack24.ru/upload/iblock/f1e/7e3h6j1i9xcn5f4q0y2w8r3t.jpg',
    isFeatured: true,
    inStock: true,
  },
  {
    name: 'Kuryer paketi A5 (250×350 mm) — 100 dona',
    description: 'Kichik buyumlar uchun tejamkor kuryer paketi.',
    price: 35000,
    sku: 'KP-A5-100',
    category: 'kuryer-paketlari',
    image: 'https://pack24.ru/upload/iblock/f1e/7e3h6j1i9xcn5f4q0y2w8r3t.jpg',
    isFeatured: false,
    inStock: true,
  },

  // BOPP paketlar
  {
    name: 'BOPP paket klapan+skotch 100×150 mm',
    description: 'Shaffof BOPP paket. Taqinchoq va suvenir uchun.',
    price: 18000,
    sku: 'BOPP-KS-100x150',
    category: 'bopp-paketlar',
    image: 'https://pack24.ru/upload/iblock/ae2/stretch.jpg',
    isFeatured: true,
    inStock: true,
  },

  // Stretch plyonka
  {
    name: 'Stretch plyonka 500mm×200m (17mkm)',
    description: 'Yuk o\'rashga mo\'ljallangan. Katta rulonlarda. Omborxonalar uchun.',
    price: 42000,
    sku: 'SP-500x200-17',
    category: 'streich-plyonka',
    image: 'https://pack24.ru/upload/iblock/ae2/stretch.jpg',
    isFeatured: true,
    inStock: true,
  },
  {
    name: 'Stretch plyonka qo\'l uchun 500mm×100m (20mkm)',
    description: 'Qo\'l bilan ishlatishga qulay. Ofislar va kichik omborlar uchun ideal.',
    price: 24000,
    sku: 'SP-HAND-500x100',
    category: 'streich-plyonka',
    image: 'https://pack24.ru/upload/iblock/ae2/stretch.jpg',
    isFeatured: false,
    inStock: true,
  },
  {
    name: 'Stretch plyonka qora 500mm×200m',
    description: 'Qora rangdagi stretch plyonka. Maxfiylik va UV himoya uchun.',
    price: 48000,
    sku: 'SP-BLACK-500x200',
    category: 'streich-plyonka',
    image: 'https://pack24.ru/upload/iblock/ae2/stretch.jpg',
    isFeatured: false,
    inStock: true,
  },

  // Skotch / Yelim lenta
  {
    name: 'Skotch OPP shaffof 48mm×66m (36 rulon)',
    description: 'Eng mashhur qadoqlash lentasi. Katta quti uchun qulay.',
    price: 85000,
    originalPrice: 95000,
    sku: 'LL-OPP-48x66-36',
    category: 'skotch-yelim-lenta',
    image: 'https://pack24.ru/upload/iblock/cc4/scotch.jpg',
    isFeatured: true,
    inStock: true,
  },
  {
    name: 'Skotch OPP jigarrang 48mm×66m (6 rulon)',
    description: 'Jigarrang rangli. Yuk paketlarsiz qo\'shimcha himoya uchun.',
    price: 18000,
    sku: 'LL-OPP-BROWN-48x66',
    category: 'skotch-yelim-lenta',
    image: 'https://pack24.ru/upload/iblock/cc4/scotch.jpg',
    isFeatured: false,
    inStock: true,
  },
  {
    name: 'Qog\'oz lenta (Kraft) 50mm×50m (6 dona)',
    description: 'Ekologik kraft qog\'oz lenta. Yashil qadoqlash uchun.',
    price: 34000,
    sku: 'QL-KRAFT-50x50',
    category: 'skotch-yelim-lenta',
    image: 'https://pack24.ru/upload/iblock/cc4/scotch.jpg',
    isFeatured: false,
    inStock: true,
  },

  // Pufakchali plyonka
  {
    name: 'Havo-pufakli plyonka 0.6m×50m (d10)',
    description: 'Nozik buyumlarni himoya qilish uchun. Shisha, keramika, elektronika uchun.',
    price: 78000,
    sku: 'HPP-0.6x50-D10',
    category: 'pufakchali-plyonka',
    image: 'https://pack24.ru/upload/iblock/7f3/bubblewrap.jpg',
    isFeatured: true,
    inStock: true,
  },
  {
    name: 'Havo-pufakli plyonka 1.2m×50m (d10)',
    description: 'Keng rulon. Mebel va katta buyumlarni qadoqlash uchun.',
    price: 145000,
    sku: 'HPP-1.2x50-D10',
    category: 'pufakchali-plyonka',
    image: 'https://pack24.ru/upload/iblock/7f3/bubblewrap.jpg',
    isFeatured: false,
    inStock: true,
  },

  // Kraft paketlar
  {
    name: 'Kraft qog\'oz sumka 24×11×30sm — 100 dona',
    description: 'Ekologik toza kraft qog\'ozdan. Butik va kafe uchun mos.',
    price: 62000,
    sku: 'QS-KRAFT-24x11x30',
    category: 'kraft-paketlar',
    image: 'https://pack24.ru/upload/iblock/b2d/kraft_bag.jpg',
    isFeatured: true,
    inStock: true,
  },
  {
    name: 'Kraft qog\'oz sumka oq 26×13×32sm — 50 dona',
    description: 'Oq rangli, brendlash uchun qulay. Bosma qo\'yish mumkin.',
    price: 38000,
    sku: 'QS-WHITE-26x13x32',
    category: 'kraft-paketlar',
    image: 'https://pack24.ru/upload/iblock/b2d/kraft_bag.jpg',
    isFeatured: false,
    inStock: true,
  },

  // Ko'pikli polietilen
  {
    name: 'Ko\'pikli polietilen 3mm×1m×50m',
    description: 'Nozik sirt himoyasi uchun. Mebel, shisha va elektronika qadoqlashda.',
    price: 68000,
    sku: 'KPL-3mm-1x50',
    category: 'kopikli-polietilen',
    image: 'https://pack24.ru/upload/iblock/aa5/foam.jpg',
    isFeatured: true,
    inStock: true,
  },

  // Qadoqlash qog'ozi
  {
    name: 'Kraft qog\'oz rulon 70gr/m² 1m×50m',
    description: 'Keng rulon. Mebel va katta mahsulotlarni qadoqlash uchun.',
    price: 89000,
    sku: 'KR-70-1x50',
    category: 'qadoqlash-qogozi',
    image: 'https://pack24.ru/upload/iblock/9c1/crepe.jpg',
    isFeatured: true,
    inStock: true,
  },
  {
    name: 'Krep qog\'oz to\'q sariq 50sm×2.5m',
    description: 'Bezak va gift qadoqlash uchun. Nozik va estetik ko\'rinish.',
    price: 5500,
    sku: 'KQ-YELLOW-50x250',
    category: 'qadoqlash-qogozi',
    image: 'https://pack24.ru/upload/iblock/9c1/crepe.jpg',
    isFeatured: false,
    inStock: true,
  },

  // PP Lenta
  {
    name: 'PP lenta 16mm×1000m (PP tasma)',
    description: 'Muhim yuklarni bog\'lash uchun. Paletlash va fasonlash uchun.',
    price: 38000,
    sku: 'PPT-16x1000',
    category: 'pp-lenta',
    image: 'https://pack24.ru/upload/iblock/f0c/tape.jpg',
    isFeatured: true,
    inStock: true,
  },

  // Himoya profili
  {
    name: 'Penoplast burchak 30×30×1000mm — 50 dona',
    description: 'Burchaklarni zarba va sinikrishdan himoya qiladi. Yuk tashishda zarur.',
    price: 27000,
    sku: 'PQ-30x30x1000-50',
    category: 'himoya-profili',
    image: 'https://pack24.ru/upload/iblock/e4b/corner.jpg',
    isFeatured: true,
    inStock: true,
  },

  // Polietilen paketlar
  {
    name: 'Polietilen paket futbolka 30×50 — 100 dona',
    description: 'Klassik futbolka shaklidagi paket. Do\'konlar va savdo nuqtalari uchun.',
    price: 8900,
    sku: 'PP-FUTBOLKA-30x50',
    category: 'polietilen-paketlar',
    image: 'https://pack24.ru/upload/iblock/f1e/7e3h6j1i9xcn5f4q0y2w8r3t.jpg',
    isFeatured: true,
    inStock: true,
  },
  {
    name: 'Polietilen zip-lock paket shaffof 150×200 — 100 dona',
    description: 'Qayta yopish imkoniyatli paket. Oziq-ovqat va mayda buyumlar uchun.',
    price: 15000,
    sku: 'PP-ZIPLOCK-150x200',
    category: 'zip-lock-paketlar',
    image: 'https://pack24.ru/upload/iblock/f1e/7e3h6j1i9xcn5f4q0y2w8r3t.jpg',
    isFeatured: true,
    inStock: true,
  },
  {
    name: 'Polietilen paket majburiy 40×60 — 50 dona',
    description: 'Yo\'l-yo\'l stripli mustahkam paket. Katta hajmli tovarlar uchun.',
    price: 11500,
    sku: 'PP-MAJBURIY-40x60',
    category: 'polietilen-paketlar',
    image: 'https://pack24.ru/upload/iblock/f1e/7e3h6j1i9xcn5f4q0y2w8r3t.jpg',
    isFeatured: false,
    inStock: true,
  },

  // Termoetiketkalar
  {
    name: 'Termo etiketka 58×40mm ECO — 1000 dona',
    description: 'Sklad va omborlar uchun. Barcode printer bilan mos keladi.',
    price: 25000,
    sku: 'TE-58x40-ECO-1000',
    category: 'termoetiketkalar',
    image: 'https://pack24.ru/upload/iblock/f0c/tape.jpg',
    isFeatured: true,
    inStock: true,
  },

  // Chiqindi paketlari
  {
    name: 'Chiqindi paketi qora 120L — 10 dona',
    description: 'Kuchli va bardoshli qora chiqindi paketi.',
    price: 12000,
    sku: 'CP-BLACK-120L-10',
    category: 'chiqindi-paketlari',
    image: 'https://pack24.ru/upload/iblock/f1e/7e3h6j1i9xcn5f4q0y2w8r3t.jpg',
    isFeatured: true,
    inStock: true,
  },
];

// ── Admin foydalanuvchisi ─────────────────────────────────────────────────────
// Produksiyada bu parolni o'zgartiring!
const ADMIN_USER = {
  name: 'Admin',
  phone: '+998900000000',
  email: 'admin@pack24.uz',
  // bcrypt hash of the local admin password from .env (rounds=10)
  passwordHash: '$2b$10$Zf5aOl8ie1KaxUv5R2faCew8XYIXNUv8MkAoFYtc1PKlZAGRKWD/C',
  role: 'admin',
};

async function main() {
  console.log('🌱 Pack24 seed boshlandi...\n');

  // ── 1. Admin foydalanuvchi ──────────────────────────────────────────────
  const existingAdmin = await prisma.user.findUnique({ where: { phone: ADMIN_USER.phone } });
  if (!existingAdmin) {
    await prisma.user.create({ data: ADMIN_USER });
    console.log('✅ Admin foydalanuvchi yaratildi:', ADMIN_USER.phone);
  } else {
    console.log('⏭️  Admin allaqachon mavjud:', ADMIN_USER.phone);
  }

  // ── 2. Mahsulotlar ─────────────────────────────────────────────────────
  console.log('\n📦 Mahsulotlar qo\'shilmoqda...');
  let added = 0;
  let skipped = 0;

  for (const product of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { sku: product.sku } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.product.create({
      data: {
        name: product.name,
        description: product.description ?? '',
        price: product.price,
        originalPrice: (product as { originalPrice?: number }).originalPrice ?? null,
        sku: product.sku,
        category: product.category,
        image: product.image,
        isFeatured: product.isFeatured ?? false,
        gallery: [],
        specifications: {},
        tags: [],
        inStock: product.inStock ?? true,
        status: 'active',
        rating: 0,
        reviews: 0,
      },
    });

    console.log(`  ✅ ${product.name}`);
    added++;
  }

  console.log(`\n🎉 Tugadi!`);
  console.log(`   📦 ${added} ta mahsulot qo'shildi`);
  console.log(`   ⏭️  ${skipped} ta o'tkazib yuborildi (mavjud)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed xatosi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
