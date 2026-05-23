/* Driver.invitedBy* maydonlarini hozirgi ma'lumotlar bilan to'ldirish */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    try {
        const drivers = await prisma.driver.findMany({
            where: { invitedAt: null, supervisorId: { not: null } },
            select: { id: true, supervisorId: true, pointId: true, registeredAt: true, createdAt: true },
        });

        let updated = 0;
        for (const d of drivers) {
            await prisma.driver.update({
                where: { id: d.id },
                data: {
                    invitedBySupervisorId: d.supervisorId,
                    invitedByPointId: d.pointId,
                    invitedAt: d.registeredAt || d.createdAt,
                },
            });
            updated++;
        }

        console.log(`[backfill] Updated ${updated} drivers with invited-by audit.`);
    } catch (e) {
        console.error('[backfill] error:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();
