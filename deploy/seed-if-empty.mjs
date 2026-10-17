// Bazada hali mahsulot bo'lmasa, prisma/seed/catalog.sql (120 mahsulot) yuklanadi.
// Mavjud ma'lumotlarga tegmaydi: admin tahrirlari saqlanib qoladi.
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const count = await prisma.product.count();
  if (count > 0) {
    console.log(`[seed] bazada ${count} ta mahsulot bor, seed o'tkazib yuborildi`);
  } else {
    console.log('[seed] baza bo\'sh, katalog yuklanmoqda...');
    execFileSync(
      process.execPath,
      ['cli/node_modules/prisma/build/index.js', 'db', 'execute', '--file', 'prisma/seed/catalog.sql', '--url', process.env.DIRECT_URL || process.env.DATABASE_URL],
      { stdio: 'inherit' },
    );
    console.log(`[seed] yuklandi: ${await prisma.product.count()} ta mahsulot`);
  }
} finally {
  await prisma.$disconnect();
}
