import { Context } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { Lang, getText, formatText } from '../../../i18n';
import { btn, paymentApproveKeyboard, pointToggleKeyboard } from '../../../keyboards';
import {
    fmtN,
    statusLabels,
    volLabel,
} from '../../../adminBot.shared';
import { activeSupervisorRequestStatuses } from '@/lib/domain/recycling/statuses';
import { RecycleRequestStatus } from '@prisma/client';
import { toNumber } from '@/lib/money';
import { Supervisor } from '@prisma/client';

export async function handleListHandlers(
    ctx: Context,
    text: string,
    sup: Supervisor & { point?: { id: number; regionUz: string; isAccepting: boolean; workingHours: string } | null },
    lang: Lang,
): Promise<boolean> {
    if (text === getText('adm_btn_requests', lang) || text === getText('adm_btn_requests', 'ru') || text === getText('adm_btn_requests', 'en')) {
        const pointFilter = sup.pointId ? { pointId: sup.pointId } : {};
        const requests = await prisma.recycleRequest.findMany({
            where: {
                ...pointFilter,
                status: { in: [...activeSupervisorRequestStatuses] },
            },
            include: { point: true, assignedDriver: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        if (requests.length === 0) {
            await ctx.reply(getText('adm_no_requests', lang));
            return true;
        }

        for (const req of requests) {
            const info = formatText('adm_request_info', lang, {
                id: String(req.id),
                name: req.name,
                phone: req.phone,
                region: req.point?.regionUz || '—',
                volume: volLabel(req.volumeSize),
                photo: req.photoUrl ? 'Bor ✅' : 'Yo\'q',
                time: new Date(req.createdAt).toLocaleString('ru-RU'),
                status: statusLabels[req.status] || req.status,
            });

            const buttons: Array<Array<{ text: string; callback_data: string } | { text: string; url: string }>> = [];
            if (req.status === RecycleRequestStatus.new_) {
                buttons.push([btn('🚚 Haydovchi tayinlash', `assign_driver_${req.id}`)]);
            }
            if (req.assignedDriver) {
                buttons.push([btn(`👤 ${req.assignedDriver.name}`, `driver_info_${req.assignedDriver.id}`)]);
            }
            if (req.pickupLat && req.pickupLng && req.pickupLat !== 0) {
                buttons.push([{ text: '📍 Lokatsiyani ko\'rish', url: `https://maps.google.com/maps?q=${req.pickupLat},${req.pickupLng}` }]);
            }

            await ctx.reply(info, {
                parse_mode: 'HTML',
                reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
            });
        }
        return true;
    }

    if (text === getText('adm_btn_drivers', lang) || text === getText('adm_btn_drivers', 'ru') || text === getText('adm_btn_drivers', 'en')) {
        const pointFilter = sup.pointId ? { pointId: sup.pointId } : {};
        const drivers = await prisma.driver.findMany({
            where: { ...pointFilter },
            orderBy: [{ isOnline: 'desc' }, { lastSeenAt: 'desc' }],
        });

        if (drivers.length === 0) {
            await ctx.reply('👥 Haydovchilar ro\'yxati bo\'sh.');
            return true;
        }

        let msg = '👥 <b>Haydovchilar:</b>\n\n';
        for (const d of drivers) {
            const onlineIcon = d.isOnline ? '🟢' : '🔴';
            const statusIcon = d.status === 'busy' ? '🚛' : d.status === 'on_route' ? '🚚' : '';
            const lastSeen = d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('ru-RU') : '—';
            msg += `${onlineIcon} <b>${d.name}</b> ${statusIcon}\n`;
            msg += `   📞 ${d.phone} | 🚗 ${d.vehicleInfo || '—'}\n`;
            msg += `   🕐 Oxirgi: ${lastSeen}\n\n`;
        }

        await ctx.reply(msg, { parse_mode: 'HTML' });
        return true;
    }

    if (text === '📝 Driver arizalari') {
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

        if (requests.length === 0) {
            await ctx.reply('📝 Pending driver arizalari yo\'q.');
            return true;
        }

        await ctx.reply('📝 <b>Driver arizalari</b>\nTasdiqlash yoki rad etish uchun tanlang:', {
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
        return true;
    }

    if (text === getText('adm_btn_payments', lang) || text === getText('adm_btn_payments', 'ru') || text === getText('adm_btn_payments', 'en')) {
        const collections = await prisma.recycleCollection.findMany({
            where: {
                paymentStatus: { in: ['pending', 'paid_to_driver'] },
            },
            include: {
                request: true,
                driver: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        if (collections.length === 0) {
            await ctx.reply('💰 Kutilayotgan to\'lovlar yo\'q.');
            return true;
        }

        for (const col of collections) {
            const info = formatText('adm_payment_info', lang, {
                id: String(col.id),
                customer: col.request.name,
                driver: col.driver?.name || '—',
                weight: String(col.actualWeight),
                amount: fmtN(Math.round(toNumber(col.totalAmount))),
                status: col.paymentStatus === 'pending' ? '⏳ Kutilmoqda' : '💵 Haydovchiga to\'langan',
            });

            await ctx.reply(info, {
                parse_mode: 'HTML',
                reply_markup: paymentApproveKeyboard(col.id),
            });
        }
        return true;
    }

    if (text === getText('adm_btn_point', lang) || text === getText('adm_btn_point', 'ru') || text === getText('adm_btn_point', 'en')) {
        if (!sup.point) {
            await ctx.reply('❌ Sizga punkt biriktirilmagan. Admin bilan bog\'laning.');
            return true;
        }

        const point = sup.point;
        const statusText = point.isAccepting ? getText('point_open', lang) : getText('point_closed', lang);

        await ctx.reply(
            formatText('adm_point_status', lang, {
                name: point.regionUz,
                status: statusText,
                hours: point.workingHours,
            }),
            { parse_mode: 'HTML', reply_markup: pointToggleKeyboard(point.id, point.isAccepting) }
        );
        return true;
    }

    return false;
}
