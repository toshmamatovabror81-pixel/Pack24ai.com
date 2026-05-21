/**
 * scripts/audit-statuses.ts
 *
 * DB'dagi haqiqiy status qiymatlarini ro'yxatlash.
 * Ishlatilishi:
 *   npx tsx scripts/audit-statuses.ts
 *
 * Natija — JSON stdout. Hujjatlash uchun:
 *   npx tsx scripts/audit-statuses.ts > docs/schema-audit-2026-output.json
 */
import { prisma } from '../src/lib/prisma';

type Row = { value: string | null; count: number };

async function distinctCount(model: string, column: string): Promise<Row[]> {
    const result = await prisma.$queryRawUnsafe<Array<{ value: string | null; count: bigint }>>(
        `SELECT "${column}" AS value, COUNT(*)::bigint AS count FROM "${model}" GROUP BY "${column}" ORDER BY count DESC`
    );
    return result.map((r) => ({ value: r.value, count: Number(r.count) }));
}

async function main() {
    const targets: Array<[string, string]> = [
        ['User', 'role'],
        ['User', 'customerType'],
        ['User', 'customerGroup'],
        ['User', 'department'],
        ['Campaign', 'type'],
        ['Campaign', 'audience'],
        ['Order', 'status'],
        ['Order', 'paymentStatus'],
        ['Product', 'status'],
        ['RecycleRequest', 'status'],
        ['RecycleRequest', 'pickupType'],
        ['RecycleRequest', 'pickupLocationMode'],
        ['RecycleCollection', 'paymentStatus'],
        ['Driver', 'status'],
        ['RecycleComplaint', 'status'],
        ['WorkOrder', 'status'],
        ['Task', 'status'],
        ['Task', 'priority'],
    ];

    const report: Record<string, Row[]> = {};

    for (const [model, column] of targets) {
        try {
            const rows = await distinctCount(model, column);
            report[`${model}.${column}`] = rows;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            report[`${model}.${column}`] = [{ value: `__ERROR__ ${msg}`, count: 0 }];
        }
    }

    console.log(JSON.stringify(report, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
