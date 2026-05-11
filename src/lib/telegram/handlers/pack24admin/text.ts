import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { getAccessIdentity, touchDbAdmin, formatEventRows, replyWithMenu } from './helpers';
import { renderSupervisorsList, renderDriversList, renderSupervisorAccessRequests } from './renders';
import { pack24AdminMainKeyboard } from '../../keyboards';

// ─── /link va /tasks buyruqlari ──────────────────────────────────────────────
export function registerStaffCommands(bot: Telegraf) {
    // /link <code> — Xodim Telegram hisobini ulash
    bot.command('link', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const args = ctx.message.text.split(' ');
        const code = args[1]?.trim();

        if (!code || code.length < 4) {
            await ctx.reply(
                '🔗 <b>Telegram ulash</b>\n\n' +
                'Foydalanish: <code>/link 123456</code>\n\n' +
                'Kodni admin paneldan oling:\n' +
                '1. Admin panelga kiring\n' +
                '2. Xodimlar → Ismingizga bosing\n' +
                '3. "Ulash kodi yaratish" tugmasini bosing\n' +
                '4. Kodni shu yerga yuboring',
                { parse_mode: 'HTML' },
            );
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = globalThis as any;
        const codes = g.__staffTelegramCodes || {};
        const userId = codes[code];

        if (!userId) {
            await ctx.reply('❌ Kod noto\'g\'ri yoki muddati o\'tgan. Admin paneldan yangi kod oling.');
            return;
        }

        try {
            // Telegram ID ni foydalanuvchiga ulash
            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    telegramId: tgId,
                    telegramVerifiedAt: new Date(),
                },
                select: { id: true, name: true, department: true, position: true },
            });

            // Kodni o'chirish
            delete codes[code];

            await ctx.reply(
                '✅ <b>Telegram muvaffaqiyatli ulandi!</b>\n\n' +
                `👤 ${user.name}\n` +
                `📍 ${user.department || ''}${user.position ? ' — ' + user.position : ''}\n\n` +
                'Endi vazifalar tayinlanganda sizga avtomatik xabar keladi.\n\n' +
                '📋 /tasks — Sizga tayinlangan vazifalar',
                { parse_mode: 'HTML' },
            );
        } catch (err) {
            console.error('[Link] Xatolik:', err);
            await ctx.reply('❌ Xatolik yuz berdi. Qayta urinib ko\'ring.');
        }
    });

    // /tasks — Xodimga tayinlangan vazifalar
    bot.command('tasks', async (ctx) => {
        const tgId = ctx.from.id.toString();

        const user = await prisma.user.findUnique({
            where: { telegramId: tgId },
            select: {
                id: true, name: true,
                taskAssignments: {
                    include: {
                        task: {
                            select: {
                                id: true, publicCode: true, title: true,
                                status: true, priority: true, dueAt: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        if (!user) {
            await ctx.reply(
                '❌ Siz tizimga ulanmagansiz.\n\n' +
                '/link <code>kod</code> buyrug\'i bilan Telegram hisobingizni ulang.',
                { parse_mode: 'HTML' },
            );
            return;
        }

        const tasks = user.taskAssignments;
        if (tasks.length === 0) {
            await ctx.reply('📋 Sizga hozircha vazifa tayinlanmagan.');
            return;
        }

        const statusIcons: Record<string, string> = {
            pending: '⏳', in_progress: '🔄', review: '👁️', completed: '✅', cancelled: '❌',
        };
        const priorityIcons: Record<string, string> = {
            urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢',
        };

        const lines = tasks.map(a => {
            const t = a.task;
            const icon = statusIcons[t.status] || '📋';
            const pIcon = priorityIcons[t.priority] || '';
            const due = t.dueAt ? ` ⏰ ${new Date(t.dueAt).toLocaleDateString('uz-UZ')}` : '';
            return `${icon} ${pIcon} <b>${t.publicCode}</b> ${t.title}${due}`;
        }).join('\n\n');

        const inlineButtons = tasks
            .filter(a => a.task.status === 'pending')
            .map(a => [{
                text: `✅ ${a.task.publicCode} Qabul qilish`,
                callback_data: `task_accept_${a.task.id}`,
            }]);

        await ctx.reply(
            `📋 <b>${user.name} — Vazifalarim</b>\n\n${lines}`,
            {
                parse_mode: 'HTML',
                ...(inlineButtons.length > 0 ? { reply_markup: { inline_keyboard: inlineButtons } } : {}),
            },
        );
    });
}

export function registerTextHandlers(bot: Telegraf) {
    bot.on('text', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const text = ctx.message.text;

        if (text.startsWith('/')) return; // /link, /tasks handled separately

        const hqAdmin = await getAccessIdentity(tgId);
        if (!hqAdmin) {
            await ctx.reply('❌ Siz HQ admin sifatida ulanmagansiz. /start ni bosing.');
            return;
        }

        await touchDbAdmin(hqAdmin);

        if (text === '👷 Masullar') {
            await renderSupervisorsList(ctx);
            return;
        }

        if (text === '🚚 Haydovchilar') {
            await renderDriversList(ctx);
            return;
        }

        if (text === '📝 Admin arizalari') {
            await renderSupervisorAccessRequests(ctx);
            return;
        }

        if (text === '📋 Jurnal tahrirlari') {
            const pending = await prisma.journalCorrectionRequest.findMany({
                where: { status: 'pending' },
                orderBy: { createdAt: 'asc' },
                take: 14,
                include: { supervisor: { select: { name: true } } },
            });

            if (pending.length === 0) {
                await ctx.reply('📋 Kutilayotgan jurnal tahrirlari yo\'q.', {
                    reply_markup: pack24AdminMainKeyboard(),
                });
                return;
            }

            const summary = pending
                .map((row) => `• <b>#${row.id}</b> ${row.supervisor.name}: ${row.summaryLine}`)
                .join('\n');

            await ctx.reply(
                `📋 <b>Jurnal tahrirlari (kutilmoqda)</b>\n\n${summary}\n\nTasdiqlash yoki rad — pastdagi tugmalar:`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: pending.map((row) => [
                            { text: `✅ #${row.id}`, callback_data: `pa_jcorr_ok_${row.id}` },
                            { text: `❌ #${row.id}`, callback_data: `pa_jcorr_no_${row.id}` },
                        ]),
                    },
                },
            );
            return;
        }

        if (text === '📡 Hodisalar') {
            const events = await prisma.botEvent.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    title: true,
                    message: true,
                    sourceBot: true,
                    severity: true,
                    createdAt: true,
                    requestId: true,
                },
            });

            await ctx.reply(
                `📡 <b>So'nggi hodisalar</b>\n\n${formatEventRows(events)}`,
                { parse_mode: 'HTML', reply_markup: pack24AdminMainKeyboard() },
            );
            return;
        }

        if (text === '🚨 Ogohlantirishlar') {
            const events = await prisma.botEvent.findMany({
                where: {
                    OR: [
                        { status: 'new' },
                        { severity: { in: ['warning', 'error'] } },
                    ],
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    title: true,
                    message: true,
                    sourceBot: true,
                    severity: true,
                    createdAt: true,
                    requestId: true,
                },
            });

            await ctx.reply(
                `🚨 <b>Yangi va muhim ogohlantirishlar</b>\n\n${formatEventRows(events)}`,
                { parse_mode: 'HTML', reply_markup: pack24AdminMainKeyboard() },
            );
            return;
        }

        if (text === '📊 Statistika') {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const [all, unread, critical, grouped] = await Promise.all([
                prisma.botEvent.count({ where: { createdAt: { gte: since } } }),
                prisma.botEvent.count({ where: { status: 'new' } }),
                prisma.botEvent.count({
                    where: {
                        createdAt: { gte: since },
                        severity: { in: ['warning', 'error'] },
                    },
                }),
                prisma.botEvent.groupBy({
                    by: ['sourceBot'],
                    _count: { _all: true },
                    where: { createdAt: { gte: since } },
                }),
            ]);

            const lines = grouped
                .map((row) => `• ${row.sourceBot}: ${row._count._all}`)
                .join('\n') || '• Hali event yo\'q';

            await ctx.reply(
                `📊 <b>So'nggi 24 soat statistikasi</b>\n\n` +
                `Jami eventlar: <b>${all}</b>\n` +
                `Yangi eventlar: <b>${unread}</b>\n` +
                `Muhim alertlar: <b>${critical}</b>\n\n` +
                `${lines}`,
                { parse_mode: 'HTML', reply_markup: pack24AdminMainKeyboard() },
            );
            return;
        }

        if (text === '✅ Barchasini o\'qildi') {
            const result = await prisma.botEvent.updateMany({
                where: { status: 'new' },
                data: {
                    status: 'read',
                    processedAt: new Date(),
                },
            });

            await ctx.reply(
                `✅ ${result.count} ta hodisa o'qilgan deb belgilandi.`,
                { reply_markup: pack24AdminMainKeyboard() },
            );
            return;
        }

        if (text === '👤 Profil') {
            const unreadCount = await prisma.botEvent.count({ where: { status: 'new' } });
            await ctx.reply(
                `👤 <b>HQ admin profili</b>\n\n` +
                `Ism: <b>${hqAdmin.name}</b>\n` +
                `Telefon: <code>${hqAdmin.phone || '—'}</code>\n` +
                `Telegram: <code>${hqAdmin.telegramId || 'ulanmagan'}</code>\n` +
                `Kod: <code>${hqAdmin.registrationCode || '—'}</code>\n` +
                `Faol: ${hqAdmin.isActive ? 'ha' : 'yo\'q'}\n` +
                `Yangi hodisalar: <b>${unreadCount}</b>`,
                { parse_mode: 'HTML', reply_markup: pack24AdminMainKeyboard() },
            );
            return;
        }

        // ─── 🌿 PRTS Statistika ────────────────────────────────────────
        if (text === '🌿 PRTS Statistika') {
            const [totalUsers, totalWeight, totalPoints, topUsers] = await Promise.all([
                prisma.user.count({ where: { ecoPoints: { gt: 0 } } }),
                prisma.user.aggregate({ _sum: { totalRecycledWeight: true } }),
                prisma.user.aggregate({ _sum: { ecoPoints: true } }),
                prisma.user.findMany({
                    where: { ecoPoints: { gt: 0 } },
                    orderBy: { ecoPoints: 'desc' },
                    take: 5,
                    select: { name: true, ecoPoints: true, totalRecycledWeight: true },
                }),
            ]);

            const weight = totalWeight._sum.totalRecycledWeight || 0;
            const points = totalPoints._sum.ecoPoints || 0;

            const topList = topUsers.length > 0
                ? topUsers.map((u, i) =>
                    `${['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]} <b>${u.name}</b> — ${u.ecoPoints} ball (${u.totalRecycledWeight} kg)`
                ).join('\n')
                : '— Hali ma\'lumot yo\'q';

            await ctx.reply(
                `🌿 <b>PRTS Statistika</b>\n\n` +
                `👥 Aktiv foydalanuvchilar: <b>${totalUsers}</b>\n` +
                `♻️ Jami qayta ishlangan: <b>${weight.toFixed(1)} kg</b>\n` +
                `🏆 Jami berilgan ballar: <b>${points}</b>\n` +
                `🌍 CO₂ tejaldi: <b>${(weight * 2.5).toFixed(1)} kg</b>\n` +
                `🌳 Daraxtlar saqlandi: <b>${(weight * 0.017).toFixed(1)} ta</b>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🏆 <b>Top 5 Eko-qahramon:</b>\n\n${topList}`,
                { parse_mode: 'HTML', reply_markup: pack24AdminMainKeyboard() },
            );
            return;
        }

        await replyWithMenu(ctx, hqAdmin.name);
    });
}
