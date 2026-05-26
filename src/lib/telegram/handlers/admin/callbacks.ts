import { Context, Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/money';
import { Lang, formatText, getText } from '../../i18n';
import { createBotEvent } from '../../botEvents';
import { notifyCustomer, notifyDriver } from '../../notifier';
import {
    assignDriverKeyboard,
    backKeyboard,
    btn,
} from '../../keyboards';
import {
    fmtN,
    getSupervisor,
    volLabel,
} from '../../adminBot.shared';
import { approveBotAccessRequest, rejectBotAccessRequest } from '../../botAccessRequests';
import { tryHandleJournalDateCallback } from '../../adminBot.journalEntry';
import { tryJournalCorrectionCallback } from './journalCorrection';

async function renderDriverAccessRequestCard(ctx: Context, requestId: number) {
    const request = await prisma.botAccessRequest.findUnique({
        where: { id: requestId },
        include: { requestedPoint: true, requestedSupervisor: true },
    });

    if (!request || request.role !== 'driver') {
        await ctx.answerCbQuery?.('Topilmadi');
        return;
    }

    const text =
        `📝 <b>Driver arizasi #${request.id}</b>\n\n` +
        `👤 ${request.name}\n` +
        `📞 <code>${request.phone}</code>\n` +
        `📨 Telegram: <code>${request.telegramId || '—'}</code>\n` +
        `🚗 Mashina: ${request.vehicleInfo || '—'}\n` +
        `👷 So'ralgan admin: ${request.requestedSupervisor?.name || 'tanlanmagan'}\n` +
        `🏭 Baza: ${request.requestedPoint?.regionUz || 'tanlanmagan'}\n` +
        `Holat: <b>${request.status}</b>`;

    await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Tasdiqlash', callback_data: `adm_req_drv_ok_${request.id}` },
                    { text: '❌ Rad etish', callback_data: `adm_req_drv_no_${request.id}` },
                ],
                [{ text: '◀️ Ortga', callback_data: 'adm_req_drv_list' }],
            ],
        },
    });
}

export function registerAdminCallbackHandler(bot: Telegraf) {
    bot.on('callback_query', async (ctx) => {
        const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
        if (!data) return;

        const tgId = ctx.from.id.toString();

        try {
            const sup = await getSupervisor(tgId);
            if (!sup) {
                await ctx.answerCbQuery('❌ Ro\'yxatdan o\'tmagan');
                return;
            }

            const lang: Lang = 'uz';
            if (await tryHandleJournalDateCallback(ctx, data, sup, tgId, lang)) return;
            if (await tryJournalCorrectionCallback(ctx, data, sup, tgId, lang)) return;

            if (data === 'adm_req_drv_list') {
                const requests = await prisma.botAccessRequest.findMany({
                    where: {
                        role: 'driver',
                        status: 'pending',
                        OR: [
                            { requestedSupervisorId: sup.id },
                            { requestedSupervisorId: null },
                            ...(sup.pointId ? [{ requestedPointId: sup.pointId }] : []),
                        ],
                    },
                    orderBy: { createdAt: 'asc' },
                    take: 10,
                });

                await ctx.answerCbQuery('📝');
                if (requests.length === 0) {
                    await ctx.editMessageText('📝 Pending driver arizalari yo\'q.');
                    return;
                }

                await ctx.editMessageText('📝 <b>Driver arizalari</b>\nTasdiqlash yoki rad etish uchun tanlang:', {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: requests.flatMap((request) => [
                            [{ text: `${request.name} • ${request.phone}`, callback_data: `adm_req_drv_${request.id}` }],
                            [
                                { text: '✅ Tasdiqlash', callback_data: `adm_req_drv_ok_${request.id}` },
                                { text: '❌ Rad etish', callback_data: `adm_req_drv_no_${request.id}` },
                            ],
                        ]),
                    },
                });
                return;
            }

            if (data.startsWith('adm_req_drv_ok_')) {
                const requestId = Number(data.replace('adm_req_drv_ok_', ''));
                const result = await approveBotAccessRequest(requestId, {
                    approvedBySupervisorId: sup.id,
                    supervisorId: sup.id,
                    pointId: sup.pointId,
                });
                if (!('driver' in result)) {
                    throw new Error('Driver arizasi tasdiqlanmadi');
                }

                await ctx.answerCbQuery('Tasdiqlandi');
                await ctx.editMessageText(
                    `✅ <b>Driver arizasi tasdiqlandi</b>\n\n` +
                    `👤 ${result.driver.name}\n` +
                    `📞 <code>${result.driver.phone}</code>\n` +
                    `🔑 Kod: <code>${result.driver.registrationCode || '—'}</code>`,
                    { parse_mode: 'HTML' },
                );
                return;
            }

            if (data.startsWith('adm_req_drv_no_')) {
                const requestId = Number(data.replace('adm_req_drv_no_', ''));
                await rejectBotAccessRequest(requestId, {
                    rejectedBySupervisorId: sup.id,
                    reason: 'Admin/Supervisor tomonidan rad etildi',
                });
                await ctx.answerCbQuery('Rad etildi');
                await ctx.editMessageText('❌ Driver arizasi rad etildi.');
                return;
            }

            if (data.startsWith('adm_req_drv_')) {
                const requestId = Number(data.replace('adm_req_drv_', ''));
                await ctx.answerCbQuery('📝');
                await renderDriverAccessRequestCard(ctx, requestId);
                return;
            }

            if (data.startsWith('assign_driver_')) {
                const reqId = parseInt(data.replace('assign_driver_', ''), 10);
                const request = await prisma.recycleRequest.findUnique({ where: { id: reqId } });
                if (!request) {
                    await ctx.answerCbQuery('❌ Ariza topilmadi');
                    return;
                }

                const { mapLegacyMaterial } = await import('@/lib/tariffs');
                const tariffId = mapLegacyMaterial(request.material);
                const baseWhere = {
                    isOnline: true,
                    status: { in: ['active'] } as { in: ('active' | 'inactive')[] },
                    ...(sup.pointId ? { pointId: sup.pointId } : {}),
                };

                let drivers = tariffId
                    ? await prisma.driver.findMany({
                        where: { ...baseWhere, acceptedMaterials: { has: tariffId } },
                        orderBy: { lastSeenAt: 'desc' },
                        take: 10,
                    })
                    : await prisma.driver.findMany({
                        where: baseWhere,
                        orderBy: { lastSeenAt: 'desc' },
                        take: 10,
                    });

                if (drivers.length === 0 && tariffId) {
                    drivers = await prisma.driver.findMany({
                        where: baseWhere,
                        orderBy: { lastSeenAt: 'desc' },
                        take: 10,
                    });
                }

                if (drivers.length === 0) {
                    await ctx.answerCbQuery('❌');
                    await ctx.editMessageText(getText('adm_no_drivers', 'uz'), { parse_mode: 'HTML' });
                    return;
                }

                await ctx.answerCbQuery('🚚');
                await ctx.editMessageText(
                    formatText('adm_select_driver', 'uz', { id: String(reqId) }),
                    {
                        parse_mode: 'HTML',
                        reply_markup: assignDriverKeyboard(drivers, reqId),
                    }
                );
                return;
            }

            if (data.startsWith('select_drv_')) {
                const parts = data.replace('select_drv_', '').split('_');
                const driverId = parseInt(parts[0], 10);
                const reqId = parseInt(parts[1], 10);

                const driver = await prisma.driver.findUnique({ where: { id: driverId } });
                const request = await prisma.recycleRequest.findUnique({
                    where: { id: reqId },
                    include: { point: true },
                });

                if (!driver || !request) {
                    await ctx.answerCbQuery('❌ Topilmadi');
                    return;
                }

                await prisma.recycleRequest.update({
                    where: { id: reqId },
                    data: {
                        assignedDriverId: driverId,
                        assignedAt: new Date(),
                        status: 'assigned',
                        supervisorId: sup.id,
                        dispatchedAt: new Date(),
                    },
                });

                await prisma.driver.update({
                    where: { id: driverId },
                    data: { status: 'busy' },
                });

                await createBotEvent({
                    sourceBot: 'supervisor',
                    eventType: 'request.assigned',
                    entityType: 'recycle_request',
                    entityId: reqId,
                    severity: 'success',
                    title: 'Haydovchi tayinlandi',
                    message: `${sup.name} ariza #${reqId} uchun ${driver.name} ni tayinladi.`,
                    requestId: reqId,
                    driverId,
                    supervisorId: sup.id,
                    pointId: request.point?.id ?? request.pointId,
                });

                await ctx.answerCbQuery('✅');
                await ctx.editMessageText(
                    formatText('adm_driver_assigned', 'uz', {
                        id: String(reqId),
                        driver: driver.name,
                    }),
                    { parse_mode: 'HTML' }
                );

                if (driver.telegramId) {
                    const volText = volLabel(request.volumeSize);
                    const driverMsg =
                        `🆕 <b>Yangi topshiriq #${reqId}</b>\n\n` +
                        `👤 ${request.name}\n` +
                        `📞 ${request.phone}\n` +
                        `📍 ${request.point?.regionUz || '—'}\n` +
                        `⚖️ Hajm: ${volText}\n` +
                        `📸 Rasm: ${request.photoUrl ? 'Bor ✅' : 'Yo\'q'}\n` +
                        `🕐 ${new Date(request.createdAt).toLocaleString('ru-RU')}\n\n` +
                        `Qabul qilasizmi?`;

                    await notifyDriver(driver.telegramId, driverMsg, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    btn('✅ Qabul', `accept_${reqId}`),
                                    btn('❌ Rad', `reject_${reqId}`),
                                ],
                                [btn('🚚 Yo\'lga chiqdim', `enroute_${reqId}`)],
                            ],
                        },
                    });
                }

                if (request.customerTgId) {
                    const lang = (request.customerLang as Lang) || 'uz';
                    await notifyCustomer(
                        request.customerTgId,
                        formatText('notif_driver_assigned', lang, {
                            driver: driver.name,
                            phone: driver.phone,
                        })
                    );
                }
                return;
            }

            if (data.startsWith('approve_payment_')) {
                const collId = parseInt(data.replace('approve_payment_', ''), 10);
                const collection = await prisma.recycleCollection.findUnique({
                    where: { id: collId },
                    include: { request: true, driver: true },
                });

                if (!collection) {
                    await ctx.answerCbQuery('❌ Topilmadi');
                    return;
                }

                await prisma.recycleCollection.update({
                    where: { id: collId },
                    data: {
                        paymentStatus: 'completed',
                        paidAt: new Date(),
                        paidBy: sup.name,
                    },
                });

                await prisma.recycleRequest.update({
                    where: { id: collection.requestId },
                    data: { status: 'completed', completedAt: new Date() },
                });

                if (collection.driverId) {
                    await prisma.driver.update({
                        where: { id: collection.driverId },
                        data: { status: 'active' },
                    });
                }

                await createBotEvent({
                    sourceBot: 'supervisor',
                    eventType: 'payment.completed',
                    entityType: 'recycle_collection',
                    entityId: collId,
                    severity: 'success',
                    title: 'To\'lov tasdiqlandi',
                    message:
                        `${sup.name} ariza #${collection.requestId} bo'yicha ` +
                        `${fmtN(Math.round(toNumber(collection.totalAmount)))} so'm to'lovni tasdiqladi.`,
                    requestId: collection.requestId,
                    collectionId: collection.id,
                    driverId: collection.driverId,
                    supervisorId: sup.id,
                });

                await ctx.answerCbQuery('✅');
                await ctx.editMessageText(
                    formatText('adm_payment_approved', 'uz', { id: String(collId) }),
                    { parse_mode: 'HTML' }
                );

                if (collection.request.customerTgId) {
                    const lang = (collection.request.customerLang as Lang) || 'uz';
                    await notifyCustomer(
                        collection.request.customerTgId,
                        lang === 'uz'
                            ? `✅ <b>Ariza #${collection.requestId} yakunlandi!</b>\n\n💰 To'lov: ${fmtN(Math.round(toNumber(collection.totalAmount)))} so'm\n\nRahmat! ♻️`
                            : lang === 'ru'
                            ? `✅ <b>Заявка #${collection.requestId} завершена!</b>\n\n💰 Оплата: ${fmtN(Math.round(toNumber(collection.totalAmount)))} сум\n\nСпасибо! ♻️`
                            : `✅ <b>Request #${collection.requestId} completed!</b>\n\n💰 Payment: ${fmtN(Math.round(toNumber(collection.totalAmount)))} UZS\n\nThank you! ♻️`
                    );
                }
                return;
            }

            if (data.startsWith('toggle_point_')) {
                const pointId = parseInt(data.replace('toggle_point_', ''), 10);
                const point = await prisma.recyclePoint.findUnique({ where: { id: pointId } });
                if (!point) {
                    await ctx.answerCbQuery('❌');
                    return;
                }

                const newStatus = !point.isAccepting;
                await prisma.recyclePoint.update({
                    where: { id: pointId },
                    data: { isAccepting: newStatus },
                });

                await createBotEvent({
                    sourceBot: 'supervisor',
                    eventType: 'point.accepting_toggled',
                    entityType: 'recycle_point',
                    entityId: pointId,
                    severity: newStatus ? 'success' : 'warning',
                    title: newStatus ? 'Punkt qabulga ochildi' : 'Punkt qabulga yopildi',
                    message: `${sup.name} punkt #${pointId} holatini ${newStatus ? 'ochiq' : 'yopiq'} qildi.`,
                    supervisorId: sup.id,
                    pointId,
                });

                const statusText = newStatus ? getText('point_open', 'uz') : getText('point_closed', 'uz');
                await ctx.answerCbQuery('✅');
                await ctx.editMessageText(
                    formatText('adm_point_toggled', 'uz', { status: statusText }),
                    { parse_mode: 'HTML' }
                );
                return;
            }

            if (data.startsWith('report_')) {
                const period = data.replace('report_', '');
                const from = new Date();

                if (period === 'today') {
                    from.setHours(0, 0, 0, 0);
                } else if (period === 'week') {
                    from.setDate(from.getDate() - 7);
                } else if (period === 'month') {
                    from.setMonth(from.getMonth() - 1);
                }

                const pointFilter = sup.pointId ? { pointId: sup.pointId } : {};

                const totalRequests = await prisma.recycleRequest.count({
                    where: { ...pointFilter, createdAt: { gte: from } },
                });
                const completedRequests = await prisma.recycleRequest.count({
                    where: { ...pointFilter, status: 'completed', completedAt: { gte: from } },
                });
                const collections = await prisma.recycleCollection.findMany({
                    where: { createdAt: { gte: from } },
                });
                const intakeLogs = await prisma.recycleManualIntake.findMany({
                    where: { supervisorId: sup.id, date: { gte: from } },
                });
                const pressLogs = await prisma.recyclePressLog.findMany({
                    where: { supervisorId: sup.id, date: { gte: from } },
                });
                const expenseLogs = await prisma.recycleExpenseLog.findMany({
                    where: { supervisorId: sup.id, date: { gte: from } },
                });
                const salesLogs = await prisma.recycleSalesLog.findMany({
                    where: { supervisorId: sup.id, date: { gte: from } },
                });
                const totalWeight = collections.reduce((sum, row) => sum + row.actualWeight, 0);
                const totalAmount = collections.reduce((sum, row) => sum + toNumber(row.totalAmount), 0);
                const activeDrivers = await prisma.driver.count({
                    where: {
                        isOnline: true,
                        ...(sup.pointId ? { pointId: sup.pointId } : {}),
                    },
                });
                const intakeWeight = intakeLogs.reduce((sum, row) => sum + row.weightKg, 0);
                const intakeAmount = intakeLogs.reduce((sum, row) => sum + toNumber(row.totalAmount), 0);
                const pressedKg = pressLogs.reduce((sum, row) => sum + row.pressedKg, 0);
                const baleCount = pressLogs.reduce((sum, row) => sum + row.baleCount, 0);
                const expenseAmount = expenseLogs.reduce((sum, row) => sum + toNumber(row.expenseAmount), 0);
                const advanceAmount = expenseLogs.reduce((sum, row) => sum + toNumber(row.advanceAmount), 0);
                const soldWeight = salesLogs.reduce((sum, row) => sum + row.weightKg, 0);
                const soldAmount = salesLogs.reduce((sum, row) => sum + toNumber(row.totalAmount), 0);
                const soldBaleCount = salesLogs.reduce((sum, row) => sum + row.baleCount, 0);

                const periodLabel = period === 'today' ? 'Bugun' : period === 'week' ? 'Hafta' : 'Oy';

                await ctx.answerCbQuery('📊');
                await ctx.editMessageText(
                    formatText('adm_report', 'uz', {
                        period: periodLabel,
                        requests: String(totalRequests),
                        completed: String(completedRequests),
                        weight: String(Math.round(totalWeight * 10) / 10),
                        amount: fmtN(Math.round(totalAmount)),
                        drivers: String(activeDrivers),
                    }) +
                    `\n\n📥 <b>Qo'lda qabul:</b> ${fmtN(Math.round(intakeWeight))} kg | ${fmtN(Math.round(intakeAmount))} so'm` +
                    `\n🏭 <b>Press:</b> ${fmtN(Math.round(pressedKg))} kg | ${fmtN(baleCount)} toy` +
                    `\n🚛 <b>Sotuv:</b> ${fmtN(Math.round(soldWeight))} kg | ${fmtN(soldBaleCount)} toy | ${fmtN(Math.round(soldAmount))} so'm` +
                    `\n💸 <b>Xarajat:</b> ${fmtN(Math.round(expenseAmount))} so'm` +
                    `\n💼 <b>Avans:</b> ${fmtN(Math.round(advanceAmount))} so'm`,
                    { parse_mode: 'HTML' }
                );
                return;
            }

            if (data.startsWith('driver_info_')) {
                const driverId = parseInt(data.replace('driver_info_', ''), 10);
                const driver = await prisma.driver.findUnique({ where: { id: driverId } });
                if (!driver) {
                    await ctx.answerCbQuery('❌ Haydovchi topilmadi');
                    return;
                }

                const totalCollections = await prisma.recycleCollection.count({
                    where: { driverId: driver.id },
                });
                const totalWeightAgg = await prisma.recycleCollection.aggregate({
                    where: { driverId: driver.id },
                    _sum: { actualWeight: true },
                });

                await ctx.answerCbQuery('👤');
                await ctx.editMessageText(
                    `👤 <b>${driver.name}</b>\n\n` +
                    `📞 ${driver.phone}\n` +
                    `🚗 Mashina: ${driver.vehicleInfo || '—'}\n` +
                    `📊 Holat: ${driver.isOnline ? '🟢 Online' : '🔴 Offline'}\n` +
                    `🔄 Status: ${driver.status}\n\n` +
                    `📈 <b>Statistika:</b>\n` +
                    `🔢 Jami yig'ishlar: ${totalCollections}\n` +
                    `⚖️ Jami og'irlik: ${fmtN(Math.round((totalWeightAgg._sum.actualWeight || 0) * 10) / 10)} kg\n` +
                    `📅 Ro'yxatdan: ${driver.registeredAt ? new Date(driver.registeredAt).toLocaleDateString('ru-RU') : '—'}`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: backKeyboard(),
                    }
                );
                return;
            }

            if (data === 'adm_cancel') {
                await ctx.answerCbQuery('❌');
                await ctx.editMessageText('❌ Bekor qilindi.');
            }
        } catch (err) {
            console.error('[AdminBot] Callback error:', err);
            await ctx.answerCbQuery('❌ Xatolik').catch(() => {});
        }
    });
}
