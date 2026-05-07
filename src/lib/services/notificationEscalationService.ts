import { prisma } from '@/lib/prisma';
import { notifyAdmin, notifyPack24Admin } from '@/lib/telegram/notifier';
import { sendSms, makeVoiceCall } from '@/lib/services/smsService';
import { DEPARTMENT_LABELS } from '@/lib/domain/taskConstants';
import type { TaskDepartment } from '@/lib/domain/taskConstants';

// ─── Constants ──────────────────────────────────────────────────────────────

const ESCALATION_TIMEOUT_MS = 20 * 60 * 1000; // 20 daqiqa
const SMS_TIMEOUT_MS = 10 * 60 * 1000;        // 10 daqiqa (SMS dan keyin Call ga)

// ─── Send Task Notification (Telegram) ──────────────────────────────────────

/**
 * Vazifa tayinlanganda xodimga xabar yuborish.
 * 1. Telegram bot orqali xabar + inline buttonlar
 * 2. DB da TaskNotification yozuvi yaratish
 * 3. 20 daqiqadan keyin tekshirish (escalation)
 */
export async function notifyAssigneeAboutTask(taskId: number, userId: number) {
    const [task, user] = await Promise.all([
        prisma.task.findUnique({
            where: { id: taskId },
            select: {
                id: true, publicCode: true, title: true, description: true,
                department: true, priority: true, dueAt: true,
            },
        }),
        prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, name: true, phone: true, telegramId: true,
                telegramNotify: true, smsNotify: true,
            },
        }),
    ]);

    if (!task || !user) return null;

    const priorityEmoji: Record<string, string> = {
        urgent: '🔴 SHOSHILINCH',
        high: '🟠 Yuqori',
        normal: '🟡 O\'rtacha',
        low: '🔵 Past',
    };

    const deptLabel = DEPARTMENT_LABELS[task.department as TaskDepartment] || task.department;
    const prioLabel = priorityEmoji[task.priority] || task.priority;
    const deadlineStr = task.dueAt
        ? new Date(task.dueAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : 'Belgilanmagan';

    // ─── 1. Telegram xabar yuborish ─────────────────────────────────────────
    let telegramSent = false;

    if (user.telegramId && user.telegramNotify) {
        const message =
            `📋 <b>Sizga yangi vazifa tayinlandi!</b>\n\n` +
            `<b>${task.publicCode || '#' + task.id}</b> — ${task.title}\n` +
            `${task.description ? `📝 ${task.description}\n` : ''}` +
            `\n🏢 Bo'lim: ${deptLabel}\n` +
            `⚡ Muhimlik: ${prioLabel}\n` +
            `⏰ Muddat: ${deadlineStr}\n\n` +
            `Qabul qilish yoki rad etish uchun tugmalarni bosing 👇`;

        try {
            await notifyAdmin(user.telegramId, message, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Qabul qilaman', callback_data: `task_accept_${task.id}` },
                            { text: '❌ Rad etaman', callback_data: `task_reject_${task.id}` },
                        ],
                        [
                            { text: '📋 Batafsil', callback_data: `task_detail_${task.id}` },
                        ],
                    ],
                },
            });
            telegramSent = true;
        } catch (err) {
            console.error(`[TaskNotify] Telegram xatolik (user=${userId}):`, err);
        }
    }

    // ─── 2. DB da notification yozuvi ───────────────────────────────────────
    const notification = await prisma.taskNotification.create({
        data: {
            taskId: task.id,
            userId: user.id,
            channel: 'telegram',
            status: telegramSent ? 'sent' : 'failed',
        },
    });

    // ─── 3. Telegram yuborilmasa → darhol SMS ──────────────────────────────
    if (!telegramSent && user.smsNotify) {
        await escalateToSms(notification.id, task, user);
    }

    // ─── 4. 20 daqiqadan keyin escalation tekshiruvi rejalashtirish ────────
    if (telegramSent) {
        scheduleEscalationCheck(notification.id, task.id, userId);
    }

    return notification;
}

// ─── SMS Escalation ─────────────────────────────────────────────────────────

async function escalateToSms(
    notificationId: number,
    task: { id: number; publicCode: string | null; title: string },
    user: { id: number; phone: string; smsNotify: boolean },
) {
    if (!user.smsNotify) return;

    const smsText = `Pack24: Sizga yangi vazifa tayinlandi — ${task.publicCode || '#' + task.id}: ${task.title}. Telegram botga kiring yoki +998880557888 ga qo'ng'iroq qiling.`;

    const sent = await sendSms(user.phone, smsText);

    await prisma.taskNotification.update({
        where: { id: notificationId },
        data: {
            escalatedToSms: true,
            escalationNote: sent ? 'SMS yuborildi' : 'SMS yuborilmadi',
        },
    });

    if (sent) {
        // SMS dan 10 daqiqadan keyin call escalation tekshiruvi
        setTimeout(async () => {
            await checkAndEscalateToCall(notificationId, task, user);
        }, SMS_TIMEOUT_MS);
    }
}

// ─── Call Escalation ────────────────────────────────────────────────────────

async function checkAndEscalateToCall(
    notificationId: number,
    task: { id: number; publicCode: string | null; title: string },
    user: { id: number; phone: string },
) {
    // Tekshirish: xodim vazifani qabul qilganmi?
    const notification = await prisma.taskNotification.findUnique({
        where: { id: notificationId },
    });

    if (!notification || notification.status === 'accepted' || notification.status === 'read') {
        return; // Allaqachon qabul qilingan
    }

    const callMessage = `Pack24 tizimidan xabar. Sizga yangi vazifa tayinlandi. Iltimos Telegram botga kirib vazifani qabul qiling. Vazifa raqami ${task.publicCode || task.id}.`;

    const called = await makeVoiceCall(user.phone, callMessage);

    await prisma.taskNotification.update({
        where: { id: notificationId },
        data: {
            escalatedToCall: true,
            status: 'escalated',
            escalationNote: called
                ? 'Qo\'ng\'iroq amalga oshirildi'
                : 'Qo\'ng\'iroq amalga oshmadi — menejerga eskalatsiya',
        },
    });

    // Menejerga xabar yuborish (oxirgi bosqich)
    if (!called) {
        await notifyManagerAboutUnacceptedTask(task.id, user.id);
    }
}

// ─── Escalation Check (20 daqiqa timer) ─────────────────────────────────────

function scheduleEscalationCheck(notificationId: number, taskId: number, userId: number) {
    setTimeout(async () => {
        try {
            const notification = await prisma.taskNotification.findUnique({
                where: { id: notificationId },
            });

            if (!notification || notification.status === 'accepted' || notification.status === 'read') {
                return; // Vazifa qabul qilingan — eskalatsiya kerak emas
            }

            // 20 daqiqa o'tdi, javob yo'q — SMS ga eskalyatsiya
            const task = await prisma.task.findUnique({
                where: { id: taskId },
                select: { id: true, publicCode: true, title: true },
            });
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, phone: true, smsNotify: true },
            });

            if (task && user) {
                console.log(`[Escalation] ⚠️ ${user.phone} 20 daqiqada javob bermadi → SMS`);
                await escalateToSms(notificationId, task, user);
            }
        } catch (err) {
            console.error('[Escalation] Timer xatolik:', err);
        }
    }, ESCALATION_TIMEOUT_MS);
}

// ─── Manager Notification ───────────────────────────────────────────────────

async function notifyManagerAboutUnacceptedTask(taskId: number, userId: number) {
    try {
        const [task, user] = await Promise.all([
            prisma.task.findUnique({
                where: { id: taskId },
                select: { publicCode: true, title: true },
            }),
            prisma.user.findUnique({
                where: { id: userId },
                select: { name: true, phone: true },
            }),
        ]);

        if (!task || !user) return;

        const message =
            `⚠️ <b>Qabul qilinmagan vazifa!</b>\n\n` +
            `Vazifa: <b>${task.publicCode}</b> — ${task.title}\n` +
            `Xodim: ${user.name} (${user.phone})\n\n` +
            `Xodim 30+ daqiqa davomida vazifani qabul qilmadi.\n` +
            `Telegram, SMS va qo'ng'iroq yuborildi — javob yo'q.\n\n` +
            `Iltimos, boshqa xodimga tayinlang yoki shaxsan bog'laning.`;

        await notifyPack24Admin('', message); // HQ admin
        // Also notify all admins
        const { notifyAllPack24Admins } = await import('@/lib/telegram/notifier');
        await notifyAllPack24Admins(message);
    } catch (err) {
        console.error('[Escalation] Manager xabar xatolik:', err);
    }
}

// ─── Mark notification as accepted (Telegram callback dan chaqiriladi) ───────

export async function markTaskAccepted(taskId: number, userId: number) {
    const notification = await prisma.taskNotification.findFirst({
        where: { taskId, userId, channel: 'telegram' },
        orderBy: { createdAt: 'desc' },
    });

    if (notification) {
        await prisma.taskNotification.update({
            where: { id: notification.id },
            data: {
                status: 'accepted',
                acceptedAt: new Date(),
            },
        });
    }

    // Update task assignee status
    await prisma.taskAssignee.updateMany({
        where: { taskId, userId },
        data: { status: 'in_progress' },
    });

    // Update task status to in_progress if pending
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { status: true },
    });
    if (task?.status === 'pending') {
        await prisma.task.update({
            where: { id: taskId },
            data: { status: 'in_progress' },
        });
    }

    return notification;
}

export async function markTaskRejected(taskId: number, userId: number) {
    const notification = await prisma.taskNotification.findFirst({
        where: { taskId, userId, channel: 'telegram' },
        orderBy: { createdAt: 'desc' },
    });

    if (notification) {
        await prisma.taskNotification.update({
            where: { id: notification.id },
            data: { status: 'failed', escalationNote: 'Xodim rad etdi' },
        });
    }

    // Notify managers about rejection
    const [task, user] = await Promise.all([
        prisma.task.findUnique({ where: { id: taskId }, select: { publicCode: true, title: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);

    if (task && user) {
        const { notifyAllPack24Admins } = await import('@/lib/telegram/notifier');
        await notifyAllPack24Admins(
            `❌ <b>${user.name}</b> vazifani rad etdi\n` +
            `Vazifa: ${task.publicCode} — ${task.title}\n\n` +
            `Boshqa xodimga tayinlang.`
        );
    }

    return notification;
}
