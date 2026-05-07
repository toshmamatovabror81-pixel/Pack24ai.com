import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { getAccessIdentity, touchDbAdmin } from './helpers';
import {
    renderSupervisorsList,
    renderDriversList,
    renderSupervisorAccessRequests,
    renderSupervisorAccessRequestCard,
    renderSupervisorCard,
    renderDriverCard,
} from './renders';
import { approveBotAccessRequest, rejectBotAccessRequest } from '../../botAccessRequests';
import {
    approveJournalCorrectionRequest,
    rejectJournalCorrectionRequest,
} from '@/lib/domain/recycling/journalCorrections';
import { createBotEvent } from '../../botEvents';
import { generateUniqueTelegramRegistrationCode } from '../../registrationCodes';

export function registerCallbackHandlers(bot: Telegraf) {
    bot.on('callback_query', async (ctx) => {
        const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
        if (!data) return;

        const identity = await getAccessIdentity(ctx.from.id.toString());
        if (!identity) {
            await ctx.answerCbQuery('Ruxsat yo\'q');
            return;
        }

        await touchDbAdmin(identity);

        try {
            // ─── TASK CALLBACKS (Vazifa qabul/rad) ─────────────────────────
            if (data.startsWith('task_accept_')) {
                const taskId = Number(data.replace('task_accept_', ''));
                const telegramId = ctx.from.id.toString();

                // Telegram ID orqali foydalanuvchini topish
                const { prisma: db } = await import('@/lib/prisma');
                const dbUser = await db.user.findUnique({
                    where: { telegramId },
                    select: { id: true, name: true },
                });
                if (!dbUser) {
                    await ctx.answerCbQuery('Siz tizimda ro\'yxatdan o\'tmagansiz');
                    return;
                }

                const { markTaskAccepted } = await import('@/lib/services/notificationEscalationService');
                await markTaskAccepted(taskId, dbUser.id);

                await ctx.answerCbQuery('✅ Vazifa qabul qilindi!');
                if ('editMessageText' in ctx) {
                    await ctx.editMessageText(
                        `✅ <b>${dbUser.name}</b> vazifani qabul qildi!\n\n` +
                        `Vazifa #${taskId} — Jarayonga o'tkazildi.\n` +
                        `Dashboard: pack24.uz/admin/tasks`,
                        { parse_mode: 'HTML' },
                    );
                }
                return;
            }

            if (data.startsWith('task_reject_')) {
                const taskId = Number(data.replace('task_reject_', ''));
                const telegramId = ctx.from.id.toString();

                const { prisma: db } = await import('@/lib/prisma');
                const dbUser = await db.user.findUnique({
                    where: { telegramId },
                    select: { id: true, name: true },
                });
                if (!dbUser) {
                    await ctx.answerCbQuery('Siz tizimda ro\'yxatdan o\'tmagansiz');
                    return;
                }

                const { markTaskRejected } = await import('@/lib/services/notificationEscalationService');
                await markTaskRejected(taskId, dbUser.id);

                await ctx.answerCbQuery('❌ Vazifa rad etildi');
                if ('editMessageText' in ctx) {
                    await ctx.editMessageText(
                        `❌ <b>${dbUser.name}</b> vazifani rad etdi.\n\n` +
                        `Menejerga xabar yuborildi — boshqa xodimga tayinlang.`,
                        { parse_mode: 'HTML' },
                    );
                }
                return;
            }

            if (data.startsWith('task_detail_')) {
                const taskId = Number(data.replace('task_detail_', ''));
                await ctx.answerCbQuery('📋');
                await ctx.reply(
                    `📋 Vazifa batafsil: https://pack24.uz/admin/tasks\n\n` +
                    `Yoki Pack24 admin paneliga kiring va Vazifalar bo'limini oching.\n` +
                    `Vazifa ID: #${taskId}`,
                );
                return;
            }

            // ─── END TASK CALLBACKS ────────────────────────────────────────
            if (data.startsWith('pa_jcorr_ok_')) {
                const correctionId = Number(data.replace('pa_jcorr_ok_', ''));
                try {
                    await approveJournalCorrectionRequest(
                        correctionId,
                        identity.kind === 'db' ? identity.id : null,
                    );
                    await ctx.answerCbQuery('Tasdiqlandi');
                    if ('editMessageText' in ctx) {
                        await ctx.editMessageText(
                            `✅ Tahrir so\'rovi <b>#${correctionId}</b> qo\'llandi. Hisobotda yangilanadi.`,
                            { parse_mode: 'HTML' },
                        );
                    }
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Xatolik';
                    await ctx.answerCbQuery(msg.slice(0, 180));
                }
                return;
            }

            if (data.startsWith('pa_jcorr_no_')) {
                const correctionId = Number(data.replace('pa_jcorr_no_', ''));
                try {
                    await rejectJournalCorrectionRequest(
                        correctionId,
                        identity.kind === 'db' ? identity.id : null,
                    );
                    await ctx.answerCbQuery('Rad etildi');
                    if ('editMessageText' in ctx) {
                        await ctx.editMessageText(`❌ Tahrir so\'rovi <b>#${correctionId}</b> rad etildi.`, {
                            parse_mode: 'HTML',
                        });
                    }
                } catch {
                    await ctx.answerCbQuery('Xatolik');
                }
                return;
            }

            if (data === 'pa_list_sup') {
                await ctx.answerCbQuery('👷');
                await renderSupervisorsList(ctx);
                return;
            }

            if (data === 'pa_list_drv') {
                await ctx.answerCbQuery('🚚');
                await renderDriversList(ctx);
                return;
            }

            if (data === 'pa_req_sup_list') {
                await ctx.answerCbQuery('📝');
                await renderSupervisorAccessRequests(ctx);
                return;
            }

            if (data.startsWith('pa_req_sup_ok_')) {
                const requestId = Number(data.replace('pa_req_sup_ok_', ''));
                const result = await approveBotAccessRequest(requestId, {
                    approvedByHqAdminId: identity.kind === 'db' ? identity.id : null,
                });
                if (!('supervisor' in result)) {
                    throw new Error('Admin arizasi tasdiqlanmadi');
                }
                await ctx.answerCbQuery('Tasdiqlandi');
                await ctx.editMessageText(
                    `✅ <b>Admin arizasi tasdiqlandi</b>\n\n` +
                    `👤 ${result.supervisor.name}\n` +
                    `📞 <code>${result.supervisor.phone}</code>\n` +
                    `🔑 Kod: <code>${result.supervisor.registrationCode || '—'}</code>`,
                    { parse_mode: 'HTML' },
                );
                return;
            }

            if (data.startsWith('pa_req_sup_no_')) {
                const requestId = Number(data.replace('pa_req_sup_no_', ''));
                await rejectBotAccessRequest(requestId, {
                    rejectedByHqAdminId: identity.kind === 'db' ? identity.id : null,
                    reason: 'HQ admin tomonidan rad etildi',
                });
                await ctx.answerCbQuery('Rad etildi');
                await ctx.editMessageText('❌ Admin arizasi rad etildi.');
                return;
            }

            if (data.startsWith('pa_req_sup_')) {
                const requestId = Number(data.replace('pa_req_sup_', ''));
                await ctx.answerCbQuery('📝');
                await renderSupervisorAccessRequestCard(ctx, requestId);
                return;
            }

            if (data.startsWith('pa_sup_') && !data.startsWith('pa_sup_toggle_') && !data.startsWith('pa_sup_code_')) {
                const supervisorId = Number(data.replace('pa_sup_', ''));
                await ctx.answerCbQuery('👷');
                await renderSupervisorCard(ctx, supervisorId);
                return;
            }

            if (data.startsWith('pa_drv_') && !data.startsWith('pa_drv_toggle_') && !data.startsWith('pa_drv_code_')) {
                const driverId = Number(data.replace('pa_drv_', ''));
                await ctx.answerCbQuery('🚚');
                await renderDriverCard(ctx, driverId);
                return;
            }

            if (data.startsWith('pa_sup_toggle_')) {
                const supervisorId = Number(data.replace('pa_sup_toggle_', ''));
                const supervisor = await prisma.supervisor.findUnique({ where: { id: supervisorId } });
                if (!supervisor) {
                    await ctx.answerCbQuery('Topilmadi');
                    return;
                }

                const updated = await prisma.supervisor.update({
                    where: { id: supervisorId },
                    data: { isActive: !supervisor.isActive },
                });

                await createBotEvent({
                    sourceBot: 'pack24admin',
                    eventType: updated.isActive ? 'supervisor.activated' : 'supervisor.blocked',
                    entityType: 'supervisor',
                    entityId: updated.id,
                    severity: updated.isActive ? 'success' : 'warning',
                    title: updated.isActive ? 'Masul faollashtirildi' : 'Masul bloklandi',
                    message: `${identity.name} ${updated.name} uchun ruxsat holatini o'zgartirdi.`,
                    supervisorId: updated.id,
                    notifyAdmins: false,
                });

                await ctx.answerCbQuery(updated.isActive ? 'Faollashtirildi' : 'Bloklandi');
                await renderSupervisorCard(ctx, supervisorId);
                return;
            }

            if (data.startsWith('pa_sup_code_')) {
                const supervisorId = Number(data.replace('pa_sup_code_', ''));
                const supervisor = await prisma.supervisor.findUnique({ where: { id: supervisorId } });
                if (!supervisor) {
                    await ctx.answerCbQuery('Topilmadi');
                    return;
                }

                const code = await generateUniqueTelegramRegistrationCode();
                await prisma.supervisor.update({
                    where: { id: supervisorId },
                    data: { registrationCode: code },
                });

                await createBotEvent({
                    sourceBot: 'pack24admin',
                    eventType: 'supervisor.code_reset',
                    entityType: 'supervisor',
                    entityId: supervisorId,
                    severity: 'info',
                    title: 'Masul uchun yangi kod berildi',
                    message: `${identity.name} ${supervisor.name} uchun yangi kirish kodi yaratdi.`,
                    supervisorId,
                    payload: { registrationCode: code },
                    notifyAdmins: false,
                });

                await ctx.answerCbQuery(`Yangi kod: ${code}`);
                await renderSupervisorCard(ctx, supervisorId);
                return;
            }

            if (data.startsWith('pa_drv_toggle_')) {
                const driverId = Number(data.replace('pa_drv_toggle_', ''));
                const driver = await prisma.driver.findUnique({ where: { id: driverId } });
                if (!driver) {
                    await ctx.answerCbQuery('Topilmadi');
                    return;
                }

                const nextStatus = driver.status === 'inactive' ? 'active' : 'inactive';
                await prisma.driver.update({
                    where: { id: driverId },
                    data: {
                        status: nextStatus,
                        isOnline: nextStatus === 'active' ? driver.isOnline : false,
                    },
                });

                await createBotEvent({
                    sourceBot: 'pack24admin',
                    eventType: nextStatus === 'active' ? 'driver.activated' : 'driver.blocked',
                    entityType: 'driver',
                    entityId: driver.id,
                    severity: nextStatus === 'active' ? 'success' : 'warning',
                    title: nextStatus === 'active' ? 'Haydovchi faollashtirildi' : 'Haydovchi bloklandi',
                    message: `${identity.name} ${driver.name} uchun ruxsat holatini o'zgartirdi.`,
                    driverId: driver.id,
                    supervisorId: driver.supervisorId ?? undefined,
                    pointId: driver.pointId ?? undefined,
                    notifyAdmins: false,
                });

                await ctx.answerCbQuery(nextStatus === 'active' ? 'Faollashtirildi' : 'Bloklandi');
                await renderDriverCard(ctx, driverId);
                return;
            }

            if (data.startsWith('pa_drv_code_')) {
                const driverId = Number(data.replace('pa_drv_code_', ''));
                const driver = await prisma.driver.findUnique({ where: { id: driverId } });
                if (!driver) {
                    await ctx.answerCbQuery('Topilmadi');
                    return;
                }

                const code = await generateUniqueTelegramRegistrationCode();
                await prisma.driver.update({
                    where: { id: driverId },
                    data: { registrationCode: code },
                });

                await createBotEvent({
                    sourceBot: 'pack24admin',
                    eventType: 'driver.code_reset',
                    entityType: 'driver',
                    entityId: driver.id,
                    severity: 'info',
                    title: 'Haydovchi uchun yangi kod berildi',
                    message: `${identity.name} ${driver.name} uchun yangi kirish kodi yaratdi.`,
                    driverId: driver.id,
                    supervisorId: driver.supervisorId ?? undefined,
                    pointId: driver.pointId ?? undefined,
                    payload: { registrationCode: code },
                    notifyAdmins: false,
                });

                await ctx.answerCbQuery(`Yangi kod: ${code}`);
                await renderDriverCard(ctx, driverId);
                return;
            }
        } catch (error) {
            console.error('[Pack24AdminBot] Callback xatolik:', error);
            await ctx.answerCbQuery('Xatolik');
        }
    });
}
