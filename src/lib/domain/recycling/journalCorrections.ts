import { prisma } from '@/lib/prisma';
import { createBotEvent } from '@/lib/telegram/botEvents';
import { notifyAdmin, notifyAllPack24Admins } from '@/lib/telegram/notifier';
import { endOfDay, startOfDay } from '@/lib/domain/recycling/journal';

export type CorrectionEntityType = 'manual_intake' | 'press_log' | 'expense_log' | 'daily_cash' | 'sales_log';

export function correctionKeyboardForPendingRequest(requestId: number) {
    return {
        inline_keyboard: [
            [
                { text: '✅ Tasdiqlash', callback_data: `pa_jcorr_ok_${requestId}` },
                { text: '❌ Rad', callback_data: `pa_jcorr_no_${requestId}` },
            ],
        ],
    };
}

export async function createJournalCorrectionRequest(input: {
    entityType: CorrectionEntityType;
    entityId: number;
    supervisorId: number;
    pointId: number | null;
    previousPayload: Record<string, unknown>;
    proposedPayload: Record<string, unknown>;
    summaryLine: string;
}) {
    const row = await prisma.journalCorrectionRequest.create({
        data: {
            entityType: input.entityType,
            entityId: input.entityId,
            supervisorId: input.supervisorId,
            pointId: input.pointId,
            previousPayload: input.previousPayload,
            proposedPayload: input.proposedPayload,
            summaryLine: input.summaryLine,
        },
    });

    const supervisorRow = await prisma.supervisor.findUnique({
        where: { id: row.supervisorId },
        select: { name: true },
    });
    const supervisorName = supervisorRow?.name ?? 'Mas\'ul';

    await createBotEvent({
        sourceBot: 'supervisor',
        eventType: 'journal.correction.pending',
        entityType: 'journal_correction_request',
        entityId: row.id,
        severity: 'warning',
        title: 'Jurnal tahriri so\'rovi',
        message: `${supervisorName}: ${input.summaryLine}`,
        supervisorId: row.supervisorId,
        pointId: row.pointId ?? undefined,
        payload: {
            correctionId: row.id,
            entityType: input.entityType,
            entityId: input.entityId,
        },
        notifyAdmins: false,
    });

    const msg =
        `📝 <b>Jurnal tahriri so\'rovi #${row.id}</b>\n\n` +
        `👷 ${supervisorName}\n` +
        `📌 ${escapeHtml(input.summaryLine)}\n\n` +
        `<b>Oldin:</b>\n<code>${escapeHtml(JSON.stringify(input.previousPayload))}</code>\n\n` +
        `<b>Taklif:</b>\n<code>${escapeHtml(JSON.stringify(input.proposedPayload))}</code>`;

    await notifyAllPack24Admins(msg, {
        reply_markup: correctionKeyboardForPendingRequest(row.id),
    });

    return row;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function reconcileDailyCashDateChange(
    supervisorId: number,
    rowId: number,
    newDate: Date,
    openingBalance: number,
    note: string | null,
) {
    const fromNew = startOfDay(new Date(newDate));
    const toNew = endOfDay(new Date(newDate));
    const other = await prisma.recycleDailyCash.findFirst({
        where: {
            supervisorId,
            id: { not: rowId },
            date: { gte: fromNew, lt: toNew },
        },
    });
    if (other) {
        throw new Error('Tanlangan kun uchun boshqa kassa yozuvi allaqachon bor.');
    }

    await prisma.recycleDailyCash.update({
        where: { id: rowId },
        data: {
            date: startOfDay(new Date(newDate)),
            openingBalance,
            note,
        },
    });
}

export async function approveJournalCorrectionRequest(requestId: number, reviewedByHqAdminId: number | null) {
    const req = await prisma.journalCorrectionRequest.findUnique({
        where: { id: requestId },
        include: { supervisor: true },
    });
    if (!req) throw new Error('So\'rov topilmadi');
    if (req.status !== 'pending') throw new Error('So\'rov allaqachon ko\'rib chiqilgan');

    const next = req.proposedPayload as Record<string, unknown>;

    switch (req.entityType as CorrectionEntityType) {
        case 'manual_intake':
            await prisma.recycleManualIntake.update({
                where: { id: req.entityId, supervisorId: req.supervisorId },
                data: {
                    date: new Date(String(next.date)),
                    weightKg: Number(next.weightKg),
                    pricePerKg: Number(next.pricePerKg),
                    totalAmount: Number(next.weightKg) * Number(next.pricePerKg),
                    note: next.note === null || next.note === undefined ? null : String(next.note),
                },
            });
            break;
        case 'press_log':
            await prisma.recyclePressLog.update({
                where: { id: req.entityId, supervisorId: req.supervisorId },
                data: {
                    date: new Date(String(next.date)),
                    pressedKg: Number(next.pressedKg),
                    baleCount: Math.round(Number(next.baleCount)),
                    operators: next.operators === null || next.operators === undefined || next.operators === ''
                        ? null
                        : String(next.operators),
                    note:
                        next.note === null || next.note === undefined || next.note === ''
                            ? null
                            : String(next.note),
                },
            });
            break;
        case 'expense_log':
            await prisma.recycleExpenseLog.update({
                where: { id: req.entityId, supervisorId: req.supervisorId },
                data: {
                    date: new Date(String(next.date)),
                    expenseAmount: Number(next.expenseAmount) || 0,
                    advanceAmount: Number(next.advanceAmount) || 0,
                    comment:
                        next.comment === null || next.comment === undefined || next.comment === ''
                            ? null
                            : String(next.comment),
                },
            });
            break;
        case 'daily_cash':
            await reconcileDailyCashDateChange(
                req.supervisorId,
                req.entityId,
                new Date(String(next.date)),
                Number(next.openingBalance),
                next.note === null || next.note === undefined || next.note === ''
                    ? null
                    : String(next.note),
            );
            break;
        case 'sales_log': {
            const w = Number(next.weightKg);
            const p = Number(next.pricePerKg);
            await prisma.recycleSalesLog.update({
                where: { id: req.entityId, supervisorId: req.supervisorId },
                data: {
                    date: new Date(String(next.date)),
                    customerName: String(next.customerName),
                    weightKg: w,
                    baleCount: Math.round(Number(next.baleCount)) || 0,
                    pricePerKg: p,
                    totalAmount: w * p,
                    vehicleType:
                        next.vehicleType === null || next.vehicleType === undefined || next.vehicleType === ''
                            ? null
                            : String(next.vehicleType),
                    plateNumber:
                        next.plateNumber === null || next.plateNumber === undefined || next.plateNumber === ''
                            ? null
                            : String(next.plateNumber),
                    note:
                        next.note === null || next.note === undefined || next.note === ''
                            ? null
                            : String(next.note),
                },
            });
            break;
        }
        default:
            throw new Error('Noma\'lum yozuv turi');
    }

    await prisma.journalCorrectionRequest.update({
        where: { id: requestId },
        data: {
            status: 'approved',
            reviewedAt: new Date(),
            reviewedByHqAdminId,
        },
    });

    await createBotEvent({
        sourceBot: 'pack24admin',
        eventType: 'journal.correction.approved',
        entityType: 'journal_correction_request',
        entityId: requestId,
        severity: 'success',
        title: 'Jurnal tahriri tasdiqlandi',
        message: `#${requestId}: ${req.summaryLine}`,
        supervisorId: req.supervisorId,
        pointId: req.pointId ?? undefined,
        notifyAdmins: false,
    });

    if (req.supervisor.telegramId) {
        await notifyAdmin(
            req.supervisor.telegramId,
            `✅ <b>HQ tasdig'i bilan jurnal tahriri qo'llandi</b>\n\n#${requestId}\n${req.summaryLine}`,
        );
    }

    return req;
}

export async function rejectJournalCorrectionRequest(
    requestId: number,
    reviewedByHqAdminId: number | null,
    rejectReason?: string,
) {
    const req = await prisma.journalCorrectionRequest.findUnique({
        where: { id: requestId },
        include: { supervisor: true },
    });
    if (!req) throw new Error('So\'rov topilmadi');
    if (req.status !== 'pending') throw new Error('So\'rov allaqachon ko\'rib chiqilgan');

    await prisma.journalCorrectionRequest.update({
        where: { id: requestId },
        data: {
            status: 'rejected',
            reviewedAt: new Date(),
            reviewedByHqAdminId,
            rejectReason: rejectReason || null,
        },
    });

    if (req.supervisor.telegramId) {
        await notifyAdmin(
            req.supervisor.telegramId,
            `❌ <b>Jurnal tahriri rad etildi</b>\n\n#${requestId}\n${req.summaryLine}` +
                (rejectReason ? `\n\nSababi: ${rejectReason}` : ''),
        );
    }

    return req;
}

/* ─────────────────────────────────────────────────────────────────
   Domain helpers extracted from adminBot.journalCorrection.ts
   ───────────────────────────────────────────────────────────────── */

/**
 * Fetch journal rows of a given entity type for a supervisor on a specific day.
 *
 * Pure data-fetching — no Telegram interaction.
 */
export async function fetchCorrectionRows(
    entityType: CorrectionEntityType,
    supervisorId: number,
    day: Date,
    take = 15,
) {
    const from = startOfDay(day);
    const to = endOfDay(day);

    switch (entityType) {
        case 'manual_intake':
            return prisma.recycleManualIntake.findMany({
                where: { supervisorId, date: { gte: from, lt: to } },
                orderBy: { id: 'desc' },
                take,
            });
        case 'press_log':
            return prisma.recyclePressLog.findMany({
                where: { supervisorId, date: { gte: from, lt: to } },
                orderBy: { id: 'desc' },
                take,
            });
        case 'expense_log':
            return prisma.recycleExpenseLog.findMany({
                where: { supervisorId, date: { gte: from, lt: to } },
                orderBy: { id: 'desc' },
                take,
            });
        case 'daily_cash':
            return prisma.recycleDailyCash.findMany({
                where: { supervisorId, date: { gte: from, lt: to } },
                orderBy: { id: 'desc' },
                take,
            });
        case 'sales_log':
            return prisma.recycleSalesLog.findMany({
                where: { supervisorId, date: { gte: from, lt: to } },
                orderBy: { id: 'desc' },
                take,
            });
        default:
            return [];
    }
}

/**
 * Serialize a journal row into a plain key-value object suitable for
 * correction request payloads (previous / proposed).
 *
 * Returns null when the row is not found or doesn't belong to the supervisor.
 */
export async function serializeJournalRow(
    entityType: CorrectionEntityType,
    entityId: number,
    supervisorId: number,
): Promise<Record<string, unknown> | null> {
    switch (entityType) {
        case 'manual_intake': {
            const r = await prisma.recycleManualIntake.findFirst({
                where: { id: entityId, supervisorId },
            });
            if (!r) return null;
            return {
                date: r.date.toISOString(),
                weightKg: r.weightKg,
                pricePerKg: r.pricePerKg,
                note: r.note,
            };
        }
        case 'press_log': {
            const r = await prisma.recyclePressLog.findFirst({
                where: { id: entityId, supervisorId },
            });
            if (!r) return null;
            return {
                date: r.date.toISOString(),
                pressedKg: r.pressedKg,
                baleCount: r.baleCount,
                operators: r.operators,
                note: r.note,
            };
        }
        case 'expense_log': {
            const r = await prisma.recycleExpenseLog.findFirst({
                where: { id: entityId, supervisorId },
            });
            if (!r) return null;
            return {
                date: r.date.toISOString(),
                expenseAmount: r.expenseAmount,
                advanceAmount: r.advanceAmount,
                comment: r.comment,
            };
        }
        case 'daily_cash': {
            const r = await prisma.recycleDailyCash.findFirst({
                where: { id: entityId, supervisorId },
            });
            if (!r) return null;
            return {
                date: r.date.toISOString(),
                openingBalance: r.openingBalance,
                note: r.note,
            };
        }
        case 'sales_log': {
            const r = await prisma.recycleSalesLog.findFirst({
                where: { id: entityId, supervisorId },
            });
            if (!r) return null;
            return {
                date: r.date.toISOString(),
                customerName: r.customerName,
                weightKg: r.weightKg,
                baleCount: r.baleCount,
                pricePerKg: r.pricePerKg,
                vehicleType: r.vehicleType,
                plateNumber: r.plateNumber,
                note: r.note,
            };
        }
        default:
            return null;
    }
}

/**
 * Sanitize a correction draft by stripping unknown keys and coercing
 * values to their expected types for the given entity.
 *
 * Pure transformation — no side-effects.
 */
export function sanitizeCorrectionDraft(
    entityType: CorrectionEntityType,
    draft: Record<string, unknown>,
): Record<string, unknown> {
    switch (entityType) {
        case 'manual_intake':
            return {
                date: draft.date,
                weightKg: Number(draft.weightKg),
                pricePerKg: Number(draft.pricePerKg),
                note: draft.note ?? null,
            };
        case 'press_log':
            return {
                date: draft.date,
                pressedKg: Number(draft.pressedKg),
                baleCount: Math.round(Number(draft.baleCount)),
                operators: draft.operators ?? null,
                note: draft.note ?? null,
            };
        case 'expense_log':
            return {
                date: draft.date,
                expenseAmount: Number(draft.expenseAmount) || 0,
                advanceAmount: Number(draft.advanceAmount) || 0,
                comment: draft.comment ?? null,
            };
        case 'daily_cash':
            return {
                date: draft.date,
                openingBalance: Number(draft.openingBalance),
                note: draft.note ?? null,
            };
        case 'sales_log':
            return {
                date: draft.date,
                customerName: String(draft.customerName),
                weightKg: Number(draft.weightKg),
                baleCount: Math.round(Number(draft.baleCount)) || 0,
                pricePerKg: Number(draft.pricePerKg),
                vehicleType: draft.vehicleType ?? null,
                plateNumber: draft.plateNumber ?? null,
                note: draft.note ?? null,
            };
        default:
            return draft;
    }
}
