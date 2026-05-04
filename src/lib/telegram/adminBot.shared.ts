import { prisma } from '@/lib/prisma';
import { Lang } from './i18n';
import {
    calculateDailyJournalSummary,
    endOfDay,
    formatDailyJournalMessage,
    humanJournalDate,
    parseJournalDate,
    startOfDay,
} from '@/lib/domain/recycling/journal';
import { generateUniqueTelegramRegistrationCode } from './registrationCodes';
import { createTelegramSessionStore } from './sessionStore';

export type JournalFlow = 'intake' | 'press' | 'expense' | 'cash' | 'sale';

export interface AdminSession {
    step: 'phone' | 'menu' | 'journal';
    lang: Lang;
    supervisorId?: number;
    flow?: JournalFlow;
    stage?: string;
    journalDate?: string;
    weightKg?: number;
    pricePerKg?: number;
    note?: string | null;
    baleCount?: number;
    operators?: string | null;
    expenseAmount?: number;
    advanceAmount?: number;
    openingBalance?: number;
    customerName?: string;
    vehicleType?: string | null;
    plateNumber?: string | null;
}

export const adminSessions = createTelegramSessionStore<AdminSession>('admin-bot-sessions');
export const fmtN = (n: number) => n.toLocaleString('ru-RU');

export const statusLabels: Record<string, string> = {
    new: '🔵 Yangi',
    dispatched: '📋 Yo\'naltirilgan',
    assigned: '🚚 Tayinlangan',
    en_route: '🚚 Yo\'lda',
    arrived: '📍 Yetib keldi',
    collecting: '⚖️ Tortilmoqda',
    completed: '✅ Yakunlangan',
    cancelled: '❌ Bekor',
};

export async function generateUniqueSupCode(): Promise<string> {
    return generateUniqueTelegramRegistrationCode();
}

export async function getSupervisor(tgId: string) {
    return prisma.supervisor.findFirst({
        where: { telegramId: tgId },
        include: { point: true },
    });
}

export function volLabel(size: string | null): string {
    return size === 'small'
        ? '📦 Kichik'
        : size === 'medium'
        ? '📦📦 O\'rta'
        : size === 'large'
        ? '📦📦📦 Katta'
        : '—';
}

export { startOfDay, endOfDay, parseJournalDate, humanJournalDate };

export function parseNumberInput(input: string): number {
    return parseFloat(input.replace(/\s/g, '').replace(',', '.'));
}

export function isSkipText(input: string): boolean {
    const value = input.trim().toLowerCase();
    return value === '-' || value === 'yoq' || value === 'yo\'q' || value === 'skip';
}

export function setMenuSession(tgId: string, lang: Lang, supervisorId: number) {
    adminSessions.set(tgId, { step: 'menu', lang, supervisorId });
}

export function setJournalSession(
    tgId: string,
    lang: Lang,
    supervisorId: number,
    flow: JournalFlow,
    stage: string,
    patch: Partial<AdminSession> = {},
) {
    adminSessions.set(tgId, {
        ...patch,
        step: 'journal',
        lang,
        supervisorId,
        flow,
        stage,
    });
}

export async function getDailyJournalSummary(supervisorId: number, date: Date) {
    const from = startOfDay(date);
    const to = endOfDay(date);

    const [cash, intakes, presses, expenses, salesRows] = await Promise.all([
        prisma.recycleDailyCash.findFirst({
            where: { supervisorId, date: { gte: from, lt: to } },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.recycleManualIntake.findMany({
            where: { supervisorId, date: { gte: from, lt: to } },
        }),
        prisma.recyclePressLog.findMany({
            where: { supervisorId, date: { gte: from, lt: to } },
        }),
        prisma.recycleExpenseLog.findMany({
            where: { supervisorId, date: { gte: from, lt: to } },
        }),
        prisma.recycleSalesLog.findMany({
            where: { supervisorId, date: { gte: from, lt: to } },
        }),
    ]);

    return calculateDailyJournalSummary({
        openingBalance: cash?.openingBalance ?? 0,
        intakes,
        presses,
        expenses,
        salesRows,
    });
}

export async function buildDailyJournalMessage(supervisorId: number, date: Date) {
    const summary = await getDailyJournalSummary(supervisorId, date);
    return formatDailyJournalMessage(summary, date, fmtN);
}
