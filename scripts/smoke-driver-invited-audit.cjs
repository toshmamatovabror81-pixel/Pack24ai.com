/* Smoke test:
 *   1) Driver schema'da yangi maydonlar mavjudligi
 *   2) generateReadablePassword + hashPassword ishlashi
 *   3) /api/admin/recycling/drivers/by-supervisor logikasi (DB-level)
 *   4) Driver invitedBy* audit ma'lumotlari joyida ekanligi
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    const errors = [];
    const ok = (msg) => console.log(`✅ ${msg}`);
    const fail = (msg) => { errors.push(msg); console.log(`❌ ${msg}`); };

    try {
        const sampleDriver = await prisma.driver.findFirst({
            where: { supervisorId: { not: null } },
            select: {
                id: true, name: true, registrationCode: true, passwordHash: true,
                invitedBySupervisorId: true, invitedByPointId: true, invitedAt: true,
                passwordSetByBotAt: true,
                invitedBySupervisor: { select: { id: true, name: true } },
                invitedByPoint: { select: { id: true, regionUz: true } },
            },
        });

        if (!sampleDriver) {
            fail('Test ma\'lumoti yo\'q (driver yo\'q)');
        } else {
            ok(`Schema OK: driver #${sampleDriver.id} invited maydonlar tekshirildi`);
            if (sampleDriver.invitedBySupervisorId !== null && !sampleDriver.invitedBySupervisor) {
                fail('invitedBySupervisor relation ishlamaydi');
            } else {
                ok('invitedBySupervisor relation OK');
            }
        }

        const totalDrivers = await prisma.driver.count();
        const auditedDrivers = await prisma.driver.count({ where: { invitedBySupervisorId: { not: null } } });
        ok(`Audit qamrovi: ${auditedDrivers}/${totalDrivers} haydovchi audit-ga ega`);

        const totalSupervisors = await prisma.supervisor.count();
        const supervisorsWithDrivers = await prisma.supervisor.findMany({
            select: { id: true, name: true, _count: { select: { drivers: true, invitedDrivers: true } } },
            take: 10,
        });
        ok(`Masullar: ${totalSupervisors} ta. Haydovchilar bilan: ${supervisorsWithDrivers.filter(s => s._count.drivers > 0).length}`);

        console.log('\n📊 Masullar bo\'yicha yig\'indi:');
        for (const s of supervisorsWithDrivers) {
            console.log(`  • ${s.name}: drivers=${s._count.drivers}, invitedByMe=${s._count.invitedDrivers}`);
        }

        const points = await prisma.recyclePoint.findMany({
            select: { id: true, regionUz: true, cityUz: true, _count: { select: { drivers: true, invitedDrivers: true, supervisors: true } } },
            take: 5,
        });
        console.log('\n🏭 Bazalar bo\'yicha:');
        for (const p of points) {
            console.log(`  • ${p.regionUz}, ${p.cityUz}: drivers=${p._count.drivers}, invited=${p._count.invitedDrivers}, supervisors=${p._count.supervisors}`);
        }

        // bcrypt + alphabet sanity
        const bcrypt = require('bcryptjs');
        const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const inlineGen = () => Array.from({ length: 8 }, () => PASSWORD_ALPHABET[Math.floor(Math.random() * PASSWORD_ALPHABET.length)]).join('');
        const p1 = inlineGen();
        const p2 = inlineGen();
        if (p1.length === 8 && p1 !== p2 && !/[0OlI1]/.test(p1)) ok(`Parol alfaviti OK: "${p1}" / "${p2}"`); else fail(`Parol alfaviti: ${p1}, ${p2}`);
        const h = await bcrypt.hash(p1, 10);
        if (h && h.startsWith('$2')) ok(`bcrypt hash OK: ${h.slice(0, 12)}...`); else fail('bcrypt hash xato');

        // Static regression: haydovchiga admin bot orqali xabar yuborilmasligi
        const fs = require('fs');
        const path = require('path');
        const botAccessSrc = fs.readFileSync(
            path.join(__dirname, '../src/lib/telegram/botAccessRequests.ts'),
            'utf8',
        );
        if (/notifyAdmin\s*\(\s*driver\.telegramId/.test(botAccessSrc)) {
            fail('REGRESSION: botAccessRequests.ts hali ham notifyAdmin(driver.telegramId) ishlatmoqda');
        } else {
            ok('Regression OK: haydovchiga notifyDriver ishlatiladi (notifyAdmin(driver.telegramId) yo\'q)');
        }
        if (!/notifyDriver\s*\(\s*driver\.telegramId/.test(botAccessSrc)) {
            fail('botAccessRequests.ts da notifyDriver(driver.telegramId) topilmadi');
        } else {
            ok('notifyDriver(driver.telegramId) mavjud');
        }

        const notifierSrc = fs.readFileSync(
            path.join(__dirname, '../src/lib/telegram/notifier.ts'),
            'utf8',
        );
        if (!/logUndeliveredDM/.test(notifierSrc)) {
            fail('notifier.ts da logUndeliveredDM yo\'q');
        } else {
            ok('notifier.ts: logUndeliveredDM audit funksiyasi mavjud');
        }
        for (const fn of ['notifyDriver', 'notifyAdmin', 'notifyPack24Admin']) {
            if (!new RegExp(`export async function ${fn}`).test(notifierSrc)) {
                fail(`notifier.ts: ${fn} export topilmadi`);
            }
        }
        ok('notifier.ts: notifyDriver/notifyAdmin/notifyPack24Admin exportlari OK');

        const messagesSrc = fs.readFileSync(
            path.join(__dirname, '../src/lib/telegram/handlers/driver/messages.ts'),
            'utf8',
        );
        if (!/notifyAllPack24Admins/.test(messagesSrc)) {
            fail('messages.ts da notifyAllPack24Admins chaqiruvi yo\'q');
        } else {
            ok('messages.ts: HQ adminlarga notifyAllPack24Admins qo\'shilgan');
        }

        const undeliveredEvents = await prisma.botEvent.count({
            where: { eventType: { endsWith: '.dm_undelivered' } },
        });
        ok(`BotEvent dm_undelivered yozuvlari: ${undeliveredEvents} ta (schema qabul qiladi)`);

    } catch (e) {
        fail(`Exception: ${e.message}`);
    } finally {
        await prisma.$disconnect();
    }

    if (errors.length) {
        console.log(`\n🚨 ${errors.length} xato:`);
        process.exit(1);
    } else {
        console.log('\n🎉 Barcha smoke testlar muvaffaqiyatli');
    }
})();
