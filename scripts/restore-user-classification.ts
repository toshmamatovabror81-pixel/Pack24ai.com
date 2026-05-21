/**
 * scripts/restore-user-classification.ts
 *
 * P2.4 migratsiyasi yon ta'siri: `User.role` va `User.customerType` ustunlari
 * Postgres tomonidan drop-and-recreate qilindi (Prisma `db push --accept-data-loss`).
 * `department` va `companyName` ustunlari saqlanib qoldi, shu sabab role/type'ni
 * qaytadan tiklash mumkin.
 *
 * Qoidalar (2026-05-21 audit asosida):
 *   - department='management'                                       → role='manager'
 *   - department in (warehouse, production, household, sales, ...)   → role='staff'
 *   - department IS NULL                                            → role='user'
 *
 *   - companyName IS NOT NULL  → customerType='corporate'
 *   - aks holda                → customerType='individual'
 */
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('User role tiklanmoqda...');

    const managerResult = await prisma.$executeRawUnsafe(
        `UPDATE "User" SET role = 'manager'::"UserRole" WHERE department = 'management'`
    );
    console.log(`  manager: ${managerResult} qator yangilandi`);

    const staffResult = await prisma.$executeRawUnsafe(
        `UPDATE "User" SET role = 'staff'::"UserRole"
         WHERE department IS NOT NULL AND department != 'management'`
    );
    console.log(`  staff: ${staffResult} qator yangilandi`);

    console.log('User customerType tiklanmoqda...');
    const corpResult = await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "customerType" = 'corporate'::"CustomerType"
         WHERE "companyName" IS NOT NULL AND "companyName" != ''`
    );
    console.log(`  corporate: ${corpResult} qator yangilandi`);

    console.log('Yakuniy tekshiruv:');
    const roles = await prisma.$queryRawUnsafe<Array<{ role: string; count: bigint }>>(
        `SELECT role::text AS role, COUNT(*)::bigint AS count FROM "User" GROUP BY role ORDER BY count DESC`
    );
    console.log('  role:', roles.map(r => `${r.role}=${r.count}`).join(', '));

    const types = await prisma.$queryRawUnsafe<Array<{ type: string; count: bigint }>>(
        `SELECT "customerType"::text AS type, COUNT(*)::bigint AS count FROM "User" GROUP BY "customerType" ORDER BY count DESC`
    );
    console.log('  customerType:', types.map(r => `${r.type}=${r.count}`).join(', '));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
