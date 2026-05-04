import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import { Lang, getText, formatText } from './i18n';
import { createBotEvent } from './botEvents';
import {
    backKeyboard,
    btn,
    paymentApproveKeyboard,
    pointToggleKeyboard,
    reportPeriodKeyboard,
    supervisorMainKeyboard,
} from './keyboards';
import {
    adminSessions,
    buildDailyJournalMessage,
    fmtN,
    getSupervisor,
    humanJournalDate,
    isSkipText,
    parseJournalDate,
    parseNumberInput,
    setJournalSession,
    setMenuSession,
    statusLabels,
    volLabel,
} from './adminBot.shared';
import { activeSupervisorRequestStatuses } from '@/lib/domain/recycling/statuses';
import { journalEntryDateKeyboard, advanceJournalAfterDateChosen } from './adminBot.journalEntry';
import {
    handleJournalCorrectionText,
    journalCorrectionSessions,
} from './adminBot.journalCorrection';
import { isSupervisorReplyMenuText } from './adminBot.menuNav';

export function registerAdminTextHandler(bot: Telegraf) {
    bot.on('text', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const text = ctx.message.text;

        if (text.startsWith('/')) return;

        const sup = await getSupervisor(tgId);
        if (!sup) {
            await ctx.reply(
                '❌ Siz masul sifatida ro\'yxatdan o\'tmagansiz.\n\n/start bosing va telefon raqamingizni ulashing.',
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

        if (text === '❓ Yordam') {
            await ctx.reply(
                '👷 <b>Pack24 — Masul boti</b>\n\n' +
                '📋 Arizalar — yangi va jarayondagi arizalar\n' +
                '🚚 Haydovchi tayinlash — ariza uchun haydovchi tanlash\n' +
                '💰 To\'lovlar — hisob-kitob tasdiqlash\n' +
                '🏭 Punkt holati — ochiq/yopiq almashtirish\n' +
                '✏️ Jurnal tahriri (HQ) — eski yozuvni o\'zgartirish uchun so\'rov (HQ tasdig\'i bilan)\n' +
                '📥 Qabul / 🏭 Press / 💸 … — sana: <b>Bugun</b> / <b>Kecha</b> / qo\'lda\n' +
                '📊 Hisobotlar — kunlik/haftalik/oylik statistika\n\n' +
                '/start — Bosh menyu',
                { parse_mode: 'HTML' }
            );
            return;
        }

        if (ses?.step === 'journal' && ses.flow) {
            if (['bekor', 'cancel', '/cancel', '❌'].includes(text.trim().toLowerCase())) {
                setMenuSession(tgId, lang, sup.id);
                await ctx.reply('❌ Amal bekor qilindi.', {
                    parse_mode: 'HTML',
                    reply_markup: supervisorMainKeyboard(),
                });
                return;
            }

            if (ses.flow === 'intake') {
                if (ses.stage === 'date') {
                    const date = parseJournalDate(text);
                    if (!date) {
                        await ctx.reply('❌ Sana noto\'g\'ri. Namuna: `2026-04-01` yoki `bugun`', { parse_mode: 'Markdown' });
                        return;
                    }
                    await advanceJournalAfterDateChosen(ctx, tgId, lang, sup.id, 'intake', date);
                    return;
                }
                if (ses.stage === 'weight') {
                    const weightKg = parseNumberInput(text);
                    if (Number.isNaN(weightKg) || weightKg <= 0) {
                        await ctx.reply('❌ Kg noto\'g\'ri. Musbat son kiriting.');
                        return;
                    }
                    setJournalSession(tgId, lang, sup.id, 'intake', 'price', { ...ses, weightKg });
                    await ctx.reply(`💵 1 kg narxini kiriting.\n\nMasalan: <code>2000</code>`, { parse_mode: 'HTML' });
                    return;
                }
                if (ses.stage === 'price') {
                    const pricePerKg = parseNumberInput(text);
                    if (Number.isNaN(pricePerKg) || pricePerKg <= 0) {
                        await ctx.reply('❌ Narx noto\'g\'ri. Musbat son kiriting.');
                        return;
                    }
                    setJournalSession(tgId, lang, sup.id, 'intake', 'note', { ...ses, pricePerKg });
                    await ctx.reply(`📝 Izoh yuboring yoki <code>-</code> yozing.`, { parse_mode: 'HTML' });
                    return;
                }
                if (ses.stage === 'note') {
                    const date = ses.journalDate ? new Date(ses.journalDate) : null;
                    const note = isSkipText(text) ? null : text.trim();
                    if (!date || !ses.weightKg || !ses.pricePerKg) {
                        setMenuSession(tgId, lang, sup.id);
                        await ctx.reply('❌ Sessiya buzildi. Qaytadan boshlang.');
                        return;
                    }
                    const totalAmount = ses.weightKg * ses.pricePerKg;
                    await prisma.recycleManualIntake.create({
                        data: {
                            supervisorId: sup.id,
                            pointId: sup.pointId,
                            date,
                            weightKg: ses.weightKg,
                            pricePerKg: ses.pricePerKg,
                            totalAmount,
                            note,
                        },
                    });
                    await createBotEvent({
                        sourceBot: 'supervisor',
                        eventType: 'journal.intake.created',
                        entityType: 'recycle_manual_intake',
                        severity: 'success',
                        title: 'Qabul jurnali yozuvi saqlandi',
                        message: `${sup.name} ${fmtN(Math.round(ses.weightKg))} kg qabul yozuvini saqladi.`,
                        supervisorId: sup.id,
                        pointId: sup.pointId ?? undefined,
                        payload: {
                            date: date.toISOString(),
                            weightKg: ses.weightKg,
                            pricePerKg: ses.pricePerKg,
                            totalAmount,
                            note,
                        },
                    });
                    setMenuSession(tgId, lang, sup.id);
                    await ctx.reply(
                        `✅ <b>Qabul yozuvi saqlandi</b>\n\n` +
                        `📅 ${humanJournalDate(date)}\n⚖️ ${fmtN(Math.round(ses.weightKg))} kg\n` +
                        `💵 ${fmtN(Math.round(ses.pricePerKg))} so'm/kg\n` +
                        `🧾 Jami: <b>${fmtN(Math.round(totalAmount))} so'm</b>\n\n` +
                        await buildDailyJournalMessage(sup.id, date),
                        { parse_mode: 'HTML', reply_markup: supervisorMainKeyboard() }
                    );
                    return;
                }
            }

            if (ses.flow === 'press') {
                if (ses.stage === 'date') {
                    const date = parseJournalDate(text);
                    if (!date) {
                        await ctx.reply('❌ Sana noto\'g\'ri. Namuna: `2026-04-01` yoki `bugun`', { parse_mode: 'Markdown' });
                        return;
                    }
                    await advanceJournalAfterDateChosen(ctx, tgId, lang, sup.id, 'press', date);
                    return;
                }
                if (ses.stage === 'weight') {
                    const pressedKg = parseNumberInput(text);
                    if (Number.isNaN(pressedKg) || pressedKg <= 0) {
                        await ctx.reply('❌ Kg noto\'g\'ri. Musbat son kiriting.');
                        return;
                    }
                    setJournalSession(tgId, lang, sup.id, 'press', 'bales', { ...ses, weightKg: pressedKg });
                    await ctx.reply('📦 Toylar sonini kiriting.');
                    return;
                }
                if (ses.stage === 'bales') {
                    const baleCount = parseInt(text.replace(/\s/g, ''), 10);
                    if (Number.isNaN(baleCount) || baleCount <= 0) {
                        await ctx.reply('❌ Toylar soni noto\'g\'ri.');
                        return;
                    }
                    setJournalSession(tgId, lang, sup.id, 'press', 'operators', { ...ses, baleCount });
                    await ctx.reply('👷 Bajaruvchilarni yozing yoki <code>-</code> yuboring.', { parse_mode: 'HTML' });
                    return;
                }
                if (ses.stage === 'operators') {
                    const date = ses.journalDate ? new Date(ses.journalDate) : null;
                    if (!date || !ses.weightKg || !ses.baleCount) {
                        setMenuSession(tgId, lang, sup.id);
                        await ctx.reply('❌ Sessiya buzildi. Qaytadan boshlang.');
                        return;
                    }
                    const operators = isSkipText(text) ? null : text.trim();
                    await prisma.recyclePressLog.create({
                        data: {
                            supervisorId: sup.id,
                            pointId: sup.pointId,
                            date,
                            pressedKg: ses.weightKg,
                            baleCount: ses.baleCount,
                            operators,
                        },
                    });
                    await createBotEvent({
                        sourceBot: 'supervisor',
                        eventType: 'journal.press.created',
                        entityType: 'recycle_press_log',
                        severity: 'success',
                        title: 'Press jurnali yozuvi saqlandi',
                        message: `${sup.name} ${fmtN(Math.round(ses.weightKg))} kg press yozuvini saqladi.`,
                        supervisorId: sup.id,
                        pointId: sup.pointId ?? undefined,
                        payload: {
                            date: date.toISOString(),
                            pressedKg: ses.weightKg,
                            baleCount: ses.baleCount,
                            operators,
                        },
                    });
                    setMenuSession(tgId, lang, sup.id);
                    await ctx.reply(
                        `✅ <b>Press yozuvi saqlandi</b>\n\n` +
                        `📅 ${humanJournalDate(date)}\n⚖️ ${fmtN(Math.round(ses.weightKg))} kg\n` +
                        `📦 Toylar: <b>${fmtN(ses.baleCount)}</b>\n` +
                        `${operators ? `👷 ${operators}\n\n` : '\n'}` +
                        await buildDailyJournalMessage(sup.id, date),
                        { parse_mode: 'HTML', reply_markup: supervisorMainKeyboard() }
                    );
                    return;
                }
            }

            if (ses.flow === 'expense') {
                if (ses.stage === 'date') {
                    const date = parseJournalDate(text);
                    if (!date) {
                        await ctx.reply('❌ Sana noto\'g\'ri. Namuna: `2026-04-01` yoki `bugun`', { parse_mode: 'Markdown' });
                        return;
                    }
                    await advanceJournalAfterDateChosen(ctx, tgId, lang, sup.id, 'expense', date);
                    return;
                }
                if (ses.stage === 'expense') {
                    const expenseAmount = parseNumberInput(text) || 0;
                    if (Number.isNaN(expenseAmount) || expenseAmount < 0) {
                        await ctx.reply('❌ Xarajat summasi noto\'g\'ri.');
                        return;
                    }
                    setJournalSession(tgId, lang, sup.id, 'expense', 'advance', { ...ses, expenseAmount });
                    await ctx.reply('💼 Avans summasini kiriting. Agar bo\'lmasa <code>0</code> yozing.', { parse_mode: 'HTML' });
                    return;
                }
                if (ses.stage === 'advance') {
                    const advanceAmount = parseNumberInput(text) || 0;
                    if (Number.isNaN(advanceAmount) || advanceAmount < 0) {
                        await ctx.reply('❌ Avans summasi noto\'g\'ri.');
                        return;
                    }
                    if ((ses.expenseAmount || 0) <= 0 && advanceAmount <= 0) {
                        await ctx.reply('❌ Kamida xarajat yoki avans summalaridan biri noldan katta bo\'lishi kerak.');
                        return;
                    }
                    setJournalSession(tgId, lang, sup.id, 'expense', 'comment', { ...ses, advanceAmount });
                    await ctx.reply('📝 Komment yozing yoki <code>-</code> yuboring.', { parse_mode: 'HTML' });
                    return;
                }
                if (ses.stage === 'comment') {
                    const date = ses.journalDate ? new Date(ses.journalDate) : null;
                    if (!date) {
                        setMenuSession(tgId, lang, sup.id);
                        await ctx.reply('❌ Sessiya buzildi. Qaytadan boshlang.');
                        return;
                    }
                    const comment = isSkipText(text) ? null : text.trim();
                    await prisma.recycleExpenseLog.create({
                        data: {
                            supervisorId: sup.id,
                            pointId: sup.pointId,
                            date,
                            expenseAmount: ses.expenseAmount || 0,
                            advanceAmount: ses.advanceAmount || 0,
                            comment,
                        },
                    });
                    await createBotEvent({
                        sourceBot: 'supervisor',
                        eventType: 'journal.expense.created',
                        entityType: 'recycle_expense_log',
                        severity: 'warning',
                        title: 'Xarajat jurnali yozuvi saqlandi',
                        message:
                            `${sup.name} xarajat/avans yozuvini saqladi: ` +
                            `${fmtN(Math.round((ses.expenseAmount || 0) + (ses.advanceAmount || 0)))} so'm.`,
                        supervisorId: sup.id,
                        pointId: sup.pointId ?? undefined,
                        payload: {
                            date: date.toISOString(),
                            expenseAmount: ses.expenseAmount || 0,
                            advanceAmount: ses.advanceAmount || 0,
                            comment,
                        },
                    });
                    setMenuSession(tgId, lang, sup.id);
                    await ctx.reply(
                        `✅ <b>Xarajat yozuvi saqlandi</b>\n\n` +
                        `📅 ${humanJournalDate(date)}\n` +
                        `💸 Xarajat: <b>${fmtN(Math.round(ses.expenseAmount || 0))} so'm</b>\n` +
                        `💼 Avans: <b>${fmtN(Math.round(ses.advanceAmount || 0))} so'm</b>\n` +
                        `${comment ? `📝 ${comment}\n\n` : '\n'}` +
                        await buildDailyJournalMessage(sup.id, date),
                        { parse_mode: 'HTML', reply_markup: supervisorMainKeyboard() }
                    );
                    return;
                }
            }

            if (ses.flow === 'cash') {
                if (ses.stage === 'date') {
                    const date = parseJournalDate(text);
                    if (!date) {
                        await ctx.reply('❌ Sana noto\'g\'ri. Namuna: `2026-04-01` yoki `bugun`', { parse_mode: 'Markdown' });
                        return;
                    }
                    await advanceJournalAfterDateChosen(ctx, tgId, lang, sup.id, 'cash', date);
                    return;
                }
                if (ses.stage === 'openingBalance') {
                    const openingBalance = parseNumberInput(text);
                    const date = ses.journalDate ? new Date(ses.journalDate) : null;
                    if (!date || Number.isNaN(openingBalance) || openingBalance < 0) {
                        await ctx.reply('❌ Kassa summasi noto\'g\'ri.');
                        return;
                    }
                    const from = new Date(date);
                    from.setHours(0, 0, 0, 0);
                    const to = new Date(from);
                    to.setDate(to.getDate() + 1);
                    const existingCash = await prisma.recycleDailyCash.findFirst({
                        where: { supervisorId: sup.id, date: { gte: from, lt: to } },
                    });
                    let cashEventType = 'journal.cash.created';
                    if (existingCash) {
                        await prisma.recycleDailyCash.update({ where: { id: existingCash.id }, data: { openingBalance } });
                        cashEventType = 'journal.cash.updated';
                    } else {
                        await prisma.recycleDailyCash.create({
                            data: { supervisorId: sup.id, pointId: sup.pointId, date, openingBalance },
                        });
                    }
                    await createBotEvent({
                        sourceBot: 'supervisor',
                        eventType: cashEventType,
                        entityType: 'recycle_daily_cash',
                        title: 'Kunlik kassa yozuvi saqlandi',
                        message: `${sup.name} ${fmtN(Math.round(openingBalance))} so'm boshlang'ich kassani saqladi.`,
                        supervisorId: sup.id,
                        pointId: sup.pointId ?? undefined,
                        payload: {
                            date: date.toISOString(),
                            openingBalance,
                        },
                    });
                    setMenuSession(tgId, lang, sup.id);
                    await ctx.reply(
                        `✅ <b>Kassa saqlandi</b>\n\n` +
                        `📅 ${humanJournalDate(date)}\n🏦 Boshlang'ich kassa: <b>${fmtN(Math.round(openingBalance))} so'm</b>\n\n` +
                        await buildDailyJournalMessage(sup.id, date),
                        { parse_mode: 'HTML', reply_markup: supervisorMainKeyboard() }
                    );
                    return;
                }
            }

            if (ses.flow === 'sale') {
                if (ses.stage === 'date') {
                    const date = parseJournalDate(text);
                    if (!date) {
                        await ctx.reply('❌ Sana noto\'g\'ri. Namuna: `2026-04-01` yoki `bugun`', { parse_mode: 'Markdown' });
                        return;
                    }
                    await advanceJournalAfterDateChosen(ctx, tgId, lang, sup.id, 'sale', date);
                    return;
                }
                if (ses.stage === 'customer') {
                    const customerName = text.trim();
                    if (!customerName) {
                        await ctx.reply('❌ Mijoz nomi bo\'sh bo\'lmasligi kerak.');
                        return;
                    }
                    setJournalSession(tgId, lang, sup.id, 'sale', 'weight', { ...ses, customerName });
                    await ctx.reply('⚖️ Sotilgan massa (kg) ni kiriting.');
                    return;
                }
                if (ses.stage === 'weight') {
                    const weightKg = parseNumberInput(text);
                    if (Number.isNaN(weightKg) || weightKg <= 0) {
                        await ctx.reply('❌ Massa noto\'g\'ri.');
                        return;
                    }
                    setJournalSession(tgId, lang, sup.id, 'sale', 'bales', { ...ses, weightKg });
                    await ctx.reply('📦 Toylar sonini kiriting. Bo\'lmasa <code>0</code> yozing.', { parse_mode: 'HTML' });
                    return;
                }
                if (ses.stage === 'bales') {
                    const baleCount = parseInt(text.replace(/\s/g, ''), 10);
                    if (Number.isNaN(baleCount) || baleCount < 0) {
                        await ctx.reply('❌ Toylar soni noto\'g\'ri.');
                        return;
                    }
                    setJournalSession(tgId, lang, sup.id, 'sale', 'price', { ...ses, baleCount });
                    await ctx.reply('💵 1 kg narxini kiriting.');
                    return;
                }
                if (ses.stage === 'price') {
                    const pricePerKg = parseNumberInput(text);
                    if (Number.isNaN(pricePerKg) || pricePerKg <= 0) {
                        await ctx.reply('❌ Narx noto\'g\'ri.');
                        return;
                    }
                    setJournalSession(tgId, lang, sup.id, 'sale', 'vehicle', { ...ses, pricePerKg });
                    await ctx.reply('🚚 Mashina turini kiriting yoki <code>-</code> yuboring.', { parse_mode: 'HTML' });
                    return;
                }
                if (ses.stage === 'vehicle') {
                    const vehicleType = isSkipText(text) ? null : text.trim();
                    setJournalSession(tgId, lang, sup.id, 'sale', 'plate', { ...ses, vehicleType });
                    await ctx.reply('🔢 Davlat raqamini kiriting yoki <code>-</code> yuboring.', { parse_mode: 'HTML' });
                    return;
                }
                if (ses.stage === 'plate') {
                    const date = ses.journalDate ? new Date(ses.journalDate) : null;
                    if (!date || !ses.customerName || !ses.weightKg || !ses.pricePerKg) {
                        setMenuSession(tgId, lang, sup.id);
                        await ctx.reply('❌ Sessiya buzildi. Qaytadan boshlang.');
                        return;
                    }
                    const plateNumber = isSkipText(text) ? null : text.trim();
                    const totalAmount = ses.weightKg * ses.pricePerKg;
                    await prisma.recycleSalesLog.create({
                        data: {
                            supervisorId: sup.id,
                            pointId: sup.pointId,
                            date,
                            customerName: ses.customerName,
                            weightKg: ses.weightKg,
                            baleCount: ses.baleCount || 0,
                            pricePerKg: ses.pricePerKg,
                            totalAmount,
                            vehicleType: ses.vehicleType || null,
                            plateNumber,
                            note: null,
                        },
                    });
                    await createBotEvent({
                        sourceBot: 'supervisor',
                        eventType: 'journal.sale.created',
                        entityType: 'recycle_sales_log',
                        severity: 'success',
                        title: 'Sotuv jurnali yozuvi saqlandi',
                        message:
                            `${sup.name} ${ses.customerName} uchun ` +
                            `${fmtN(Math.round(totalAmount))} so'mlik sotuv yozuvini saqladi.`,
                        supervisorId: sup.id,
                        pointId: sup.pointId ?? undefined,
                        payload: {
                            date: date.toISOString(),
                            customerName: ses.customerName,
                            weightKg: ses.weightKg,
                            baleCount: ses.baleCount || 0,
                            pricePerKg: ses.pricePerKg,
                            totalAmount,
                            vehicleType: ses.vehicleType || null,
                            plateNumber,
                        },
                    });
                    setMenuSession(tgId, lang, sup.id);
                    await ctx.reply(
                        `✅ <b>Sotuv yozuvi saqlandi</b>\n\n` +
                        `📅 ${humanJournalDate(date)}\n` +
                        `🏢 Mijoz: <b>${ses.customerName}</b>\n` +
                        `⚖️ Massa: <b>${fmtN(Math.round(ses.weightKg))} kg</b>\n` +
                        `📦 Soni: <b>${fmtN(ses.baleCount || 0)}</b>\n` +
                        `💵 Narx: <b>${fmtN(Math.round(ses.pricePerKg))} so'm/kg</b>\n` +
                        `🧾 Jami: <b>${fmtN(Math.round(totalAmount))} so'm</b>\n` +
                        `${ses.vehicleType ? `🚚 Mashina: ${ses.vehicleType}\n` : ''}` +
                        `${plateNumber ? `🔢 Davlat raqami: ${plateNumber}\n` : ''}\n` +
                        await buildDailyJournalMessage(sup.id, date),
                        { parse_mode: 'HTML', reply_markup: supervisorMainKeyboard() }
                    );
                    return;
                }
            }
        }

        if (text === getText('adm_btn_requests', lang) || text === getText('adm_btn_requests', 'ru') || text === getText('adm_btn_requests', 'en')) {
            const pointFilter = sup.pointId ? { regionId: sup.pointId } : {};
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
                    region: req.point?.regionUz || '—',
                    volume: volLabel(req.volumeSize),
                    photo: req.photoUrl ? 'Bor ✅' : 'Yo\'q',
                    time: new Date(req.createdAt).toLocaleString('ru-RU'),
                    status: statusLabels[req.status] || req.status,
                });

                const buttons: Array<Array<{ text: string; callback_data: string } | { text: string; url: string }>> = [];
                if (req.status === 'new') {
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
            return;
        }

        if (text === getText('adm_btn_drivers', lang) || text === getText('adm_btn_drivers', 'ru') || text === getText('adm_btn_drivers', 'en')) {
            const pointFilter = sup.pointId ? { pointId: sup.pointId } : {};
            const drivers = await prisma.driver.findMany({
                where: { ...pointFilter },
                orderBy: [{ isOnline: 'desc' }, { lastSeenAt: 'desc' }],
            });

            if (drivers.length === 0) {
                await ctx.reply('👥 Haydovchilar ro\'yxati bo\'sh.');
                return;
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
            return;
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
                return;
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
                await ctx.reply('💰 Kutilayotgan to\'lovlar yo\'q.');
                return;
            }

            for (const col of collections) {
                const info = formatText('adm_payment_info', lang, {
                    id: String(col.id),
                    customer: col.request.name,
                    driver: col.driver?.name || '—',
                    weight: String(col.actualWeight),
                    amount: fmtN(Math.round(col.totalAmount)),
                    status: col.paymentStatus === 'pending' ? '⏳ Kutilmoqda' : '💵 Haydovchiga to\'langan',
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
                await ctx.reply('❌ Sizga punkt biriktirilmagan. Admin bilan bog\'laning.');
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

        if (text === '📥 Qabul') {
            setJournalSession(tgId, lang, sup.id, 'intake', 'date');
            await ctx.reply(
                `📥 <b>Makulatura qabul jurnaliga yozuv</b>\n\n` +
                `1-qadam: <b>sanani tanlang</b> yoki matn bilan yuboring.\n` +
                `<i>Masalan:</i> <code>bugun</code>, <code>kecha</code>, <code>2026-05-01</code>\n\n` +
                `<i>Bekor:</i> <code>cancel</code>`,
                { parse_mode: 'HTML', reply_markup: journalEntryDateKeyboard('intake') }
            );
            return;
        }

        if (text === '🏭 Press') {
            setJournalSession(tgId, lang, sup.id, 'press', 'date');
            await ctx.reply(
                `🏭 <b>Press / toy jurnali</b>\n\n` +
                `1-qadam: <b>sanani tanlang</b> yoki matn bilan yuboring.\n\n` +
                `<i>Bekor:</i> <code>cancel</code>`,
                { parse_mode: 'HTML', reply_markup: journalEntryDateKeyboard('press') }
            );
            return;
        }

        if (text === '💸 Xarajat') {
            setJournalSession(tgId, lang, sup.id, 'expense', 'date');
            await ctx.reply(
                `💸 <b>Ish haqi va xarajatlar</b>\n\n` +
                `1-qadam: <b>sanani tanlang</b> yoki matn bilan yuboring.\n\n` +
                `<i>Bekor:</i> <code>cancel</code>`,
                { parse_mode: 'HTML', reply_markup: journalEntryDateKeyboard('expense') }
            );
            return;
        }

        if (text === '💼 Kassa') {
            setJournalSession(tgId, lang, sup.id, 'cash', 'date');
            await ctx.reply(
                `💼 <b>Kunlik kassa ochilishi</b>\n\n` +
                `1-qadam: <b>sanani tanlang</b> yoki matn bilan yuboring.\n\n` +
                `<i>Bekor:</i> <code>cancel</code>`,
                { parse_mode: 'HTML', reply_markup: journalEntryDateKeyboard('cash') }
            );
            return;
        }

        if (text === '🚛 Sotuv') {
            setJournalSession(tgId, lang, sup.id, 'sale', 'date');
            await ctx.reply(
                `🚛 <b>Preslangan makulatura sotuv jurnali</b>\n\n` +
                `1-qadam: <b>sanani tanlang</b> yoki matn bilan yuboring.\n\n` +
                `<i>Bekor:</i> <code>cancel</code>`,
                { parse_mode: 'HTML', reply_markup: journalEntryDateKeyboard('sale') }
            );
            return;
        }

        if (text === getText('adm_btn_report', lang) || text === getText('adm_btn_report', 'ru') || text === getText('adm_btn_report', 'en')) {
            await ctx.reply(
                '📊 <b>Hisobot davrini tanlang:</b>',
                { parse_mode: 'HTML', reply_markup: reportPeriodKeyboard() }
            );
            return;
        }
    });
}
