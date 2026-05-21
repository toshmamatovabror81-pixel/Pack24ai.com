import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { Lang, getText, formatText } from '../../i18n';
import {
    btn,
    paymentApproveKeyboard,
    pointToggleKeyboard,
    reportPeriodKeyboard,
    supervisorMainKeyboard,
} from '../../keyboards';
import {
    adminSessions,
    fmtN,
    getSupervisor,
    setJournalSession,
    setMenuSession,
    statusLabels,
    volLabel,
} from '../../adminBot.shared';
import { activeSupervisorRequestStatuses } from '@/lib/domain/recycling/statuses';
import { RecycleRequestStatus } from '@prisma/client';
import { journalEntryDateKeyboard } from '../../adminBot.journalEntry';
import {
    handleJournalCorrectionText,
    journalCorrectionSessions,
} from './journalCorrection';
import { isSupervisorReplyMenuText } from '../../adminBot.menuNav';
import { handleJournalFlow } from '../../adminBot.text.flows';

export function registerAdminTextHandler(bot: Telegraf) {
    bot.on('text', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const text = ctx.message.text;

        if (text.startsWith('/')) return;

        const sup = await getSupervisor(tgId);
        if (!sup) {
            await ctx.reply(
                'вќЊ Siz masul sifatida ro\'yxatdan o\'tmagansiz.\n\n/start bosing va telefon raqamingizni ulashing.',
                { parse_mode: 'HTML' }
            );
            return;
        }

        const lang: Lang = 'uz';

        if (isSupervisorReplyMenuText(text)) {
            journalCorrectionSessions.delete(tgId);
            const preMenu = adminSessions.get(tgId);
            if (preMenu?.step === 'journal') {
                setMenuSession(tgId, lang, sup.id);
            }
        }

        const ses = adminSessions.get(tgId);

        if (await handleJournalCorrectionText(ctx, tgId, text, sup, lang)) return;

        if (text === 'вќ“ Yordam') {
            await ctx.reply(
                'рџ‘· <b>Pack24 вЂ” Masul boti</b>\n\n' +
                'рџ“‹ Arizalar вЂ” yangi va jarayondagi arizalar\n' +
                'рџљљ Haydovchi tayinlash вЂ” ariza uchun haydovchi tanlash\n' +
                'рџ’° To\'lovlar вЂ” hisob-kitob tasdiqlash\n' +
                'рџЏ­ Punkt holati вЂ” ochiq/yopiq almashtirish\n' +
                'вњЏпёЏ Jurnal tahriri (HQ) вЂ” eski yozuvni o\'zgartirish uchun so\'rov (HQ tasdig\'i bilan)\n' +
                'рџ“Ґ Qabul / рџЏ­ Press / рџ’ё вЂ¦ вЂ” sana: <b>Bugun</b> / <b>Kecha</b> / qo\'lda\n' +
                'рџ“Љ Hisobotlar вЂ” kunlik/haftalik/oylik statistika\n\n' +
                '/start вЂ” Bosh menyu',
                { parse_mode: 'HTML' }
            );
            return;
        }

        if (ses?.step === 'journal' && ses.flow) {
            if (['bekor', 'cancel', '/cancel', 'вќЊ'].includes(text.trim().toLowerCase())) {
                setMenuSession(tgId, lang, sup.id);
                await ctx.reply('вќЊ Amal bekor qilindi.', {
                    parse_mode: 'HTML',
                    reply_markup: supervisorMainKeyboard(),
                });
                return;
            }

            const handled = await handleJournalFlow(ctx, tgId, text, ses, sup, lang);
            if (handled) return;
        }

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
                return;
            }

            for (const req of requests) {
                const info = formatText('adm_request_info', lang, {
                    id: String(req.id),
                    name: req.name,
                    phone: req.phone,
                    region: req.point?.regionUz || 'вЂ”',
                    volume: volLabel(req.volumeSize),
                    photo: req.photoUrl ? 'Bor вњ…' : 'Yo\'q',
                    time: new Date(req.createdAt).toLocaleString('ru-RU'),
                    status: statusLabels[req.status] || req.status,
                });

                const buttons: Array<Array<{ text: string; callback_data: string } | { text: string; url: string }>> = [];
                if (req.status === RecycleRequestStatus.new_) {
                    buttons.push([btn('рџљљ Haydovchi tayinlash', `assign_driver_${req.id}`)]);
                }
                if (req.assignedDriver) {
                    buttons.push([btn(`рџ‘¤ ${req.assignedDriver.name}`, `driver_info_${req.assignedDriver.id}`)]);
                }
                if (req.pickupLat && req.pickupLng && req.pickupLat !== 0) {
                    buttons.push([{ text: 'рџ“Ќ Lokatsiyani ko\'rish', url: `https://maps.google.com/maps?q=${req.pickupLat},${req.pickupLng}` }]);
                }

                await ctx.reply(info, {
                    parse_mode: 'HTML',
                    reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
                });
            }
            return;
        }

        if (text === getText('adm_btn_drivers', lang) || text === getText('adm_btn_drivers', 'ru') || text === getText('adm_btn_drivers', 'en')) {
            const pointFilter = sup.pointId ? { pointId: sup.pointId } : {};
            const drivers = await prisma.driver.findMany({
                where: { ...pointFilter },
                orderBy: [{ isOnline: 'desc' }, { lastSeenAt: 'desc' }],
            });

            if (drivers.length === 0) {
                await ctx.reply('рџ‘Ґ Haydovchilar ro\'yxati bo\'sh.');
                return;
            }

            let msg = 'рџ‘Ґ <b>Haydovchilar:</b>\n\n';
            for (const d of drivers) {
                const onlineIcon = d.isOnline ? 'рџџў' : 'рџ”ґ';
                const statusIcon = d.status === 'busy' ? 'рџљ›' : d.status === 'on_route' ? 'рџљљ' : '';
                const lastSeen = d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('ru-RU') : 'вЂ”';
                msg += `${onlineIcon} <b>${d.name}</b> ${statusIcon}\n`;
                msg += `   рџ“ћ ${d.phone} | рџљ— ${d.vehicleInfo || 'вЂ”'}\n`;
                msg += `   рџ•ђ Oxirgi: ${lastSeen}\n\n`;
            }

            await ctx.reply(msg, { parse_mode: 'HTML' });
            return;
        }

        if (text === 'рџ“ќ Driver arizalari') {
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
                await ctx.reply('рџ“ќ Pending driver arizalari yo\'q.');
                return;
            }

            await ctx.reply('рџ“ќ <b>Driver arizalari</b>\nTasdiqlash yoki rad etish uchun tanlang:', {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: requests.flatMap((request) => [
                        [{ text: `${request.name} вЂў ${request.phone}`, callback_data: `adm_req_drv_${request.id}` }],
                        [
                            { text: 'вњ… Tasdiqlash', callback_data: `adm_req_drv_ok_${request.id}` },
                            { text: 'вќЊ Rad etish', callback_data: `adm_req_drv_no_${request.id}` },
                        ],
                    ]),
                },
            });
            return;
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
                await ctx.reply('рџ’° Kutilayotgan to\'lovlar yo\'q.');
                return;
            }

            for (const col of collections) {
                const info = formatText('adm_payment_info', lang, {
                    id: String(col.id),
                    customer: col.request.name,
                    driver: col.driver?.name || 'вЂ”',
                    weight: String(col.actualWeight),
                    amount: fmtN(Math.round(col.totalAmount)),
                    status: col.paymentStatus === 'pending' ? 'вЏі Kutilmoqda' : 'рџ’µ Haydovchiga to\'langan',
                });

                await ctx.reply(info, {
                    parse_mode: 'HTML',
                    reply_markup: paymentApproveKeyboard(col.id),
                });
            }
            return;
        }

        if (text === getText('adm_btn_point', lang) || text === getText('adm_btn_point', 'ru') || text === getText('adm_btn_point', 'en')) {
            if (!sup.point) {
                await ctx.reply('вќЊ Sizga punkt biriktirilmagan. Admin bilan bog\'laning.');
                return;
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
            return;
        }

        if (text === 'рџ“Ґ Qabul') {
            setJournalSession(tgId, lang, sup.id, 'intake', 'date');
            await ctx.reply(
                `рџ“Ґ <b>Makulatura qabul jurnaliga yozuv</b>\n\n` +
                `1-qadam: <b>sanani tanlang</b> yoki matn bilan yuboring.\n` +
                `<i>Masalan:</i> <code>bugun</code>, <code>kecha</code>, <code>2026-05-01</code>\n\n` +
                `<i>Bekor:</i> <code>cancel</code>`,
                { parse_mode: 'HTML', reply_markup: journalEntryDateKeyboard('intake') }
            );
            return;
        }

        if (text === 'рџЏ­ Press') {
            setJournalSession(tgId, lang, sup.id, 'press', 'date');
            await ctx.reply(
                `рџЏ­ <b>Press / toy jurnali</b>\n\n` +
                `1-qadam: <b>sanani tanlang</b> yoki matn bilan yuboring.\n\n` +
                `<i>Bekor:</i> <code>cancel</code>`,
                { parse_mode: 'HTML', reply_markup: journalEntryDateKeyboard('press') }
            );
            return;
        }

        if (text === 'рџ’ё Xarajat') {
            setJournalSession(tgId, lang, sup.id, 'expense', 'date');
            await ctx.reply(
                `рџ’ё <b>Ish haqi va xarajatlar</b>\n\n` +
                `1-qadam: <b>sanani tanlang</b> yoki matn bilan yuboring.\n\n` +
                `<i>Bekor:</i> <code>cancel</code>`,
                { parse_mode: 'HTML', reply_markup: journalEntryDateKeyboard('expense') }
            );
            return;
        }

        if (text === 'рџ’ј Kassa') {
            setJournalSession(tgId, lang, sup.id, 'cash', 'date');
            await ctx.reply(
                `рџ’ј <b>Kunlik kassa ochilishi</b>\n\n` +
                `1-qadam: <b>sanani tanlang</b> yoki matn bilan yuboring.\n\n` +
                `<i>Bekor:</i> <code>cancel</code>`,
                { parse_mode: 'HTML', reply_markup: journalEntryDateKeyboard('cash') }
            );
            return;
        }

        if (text === 'рџљ› Sotuv') {
            setJournalSession(tgId, lang, sup.id, 'sale', 'date');
            await ctx.reply(
                `рџљ› <b>Preslangan makulatura sotuv jurnali</b>\n\n` +
                `1-qadam: <b>sanani tanlang</b> yoki matn bilan yuboring.\n\n` +
                `<i>Bekor:</i> <code>cancel</code>`,
                { parse_mode: 'HTML', reply_markup: journalEntryDateKeyboard('sale') }
            );
            return;
        }

        if (text === getText('adm_btn_report', lang) || text === getText('adm_btn_report', 'ru') || text === getText('adm_btn_report', 'en')) {
            await ctx.reply(
                'рџ“Љ <b>Hisobot davrini tanlang:</b>',
                { parse_mode: 'HTML', reply_markup: reportPeriodKeyboard() }
            );
            return;
        }
    });
}
