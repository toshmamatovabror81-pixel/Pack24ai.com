import { BotAccessRequest, Driver, RecyclePoint, Supervisor } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createBotEvent } from './botEvents';
import { generateUniqueTelegramRegistrationCode } from './registrationCodes';
import { generateReadablePassword, hashPassword, formatDriverCredentialsMessage } from './driverCredentials';
import { notifyDriver, notifyAdmin } from './notifier';

export type BotAccessRole = 'supervisor' | 'driver';
export type BotAccessStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface CreateBotAccessRequestInput {
    role: BotAccessRole;
    name: string;
    phone: string;
    telegramId?: string | null;
    telegramName?: string | null;
    vehicleInfo?: string | null;
    requestedPointId?: number | null;
    requestedSupervisorId?: number | null;
    sourceBot: 'supervisor' | 'driver' | 'pack24admin' | 'platform';
}

export interface ApproveBotAccessRequestInput {
    approvedByHqAdminId?: number | null;
    approvedBySupervisorId?: number | null;
    pointId?: number | null;
    supervisorId?: number | null;
}

type SupervisorWithPoint = Supervisor & { point: RecyclePoint | null };
type DriverWithRelations = Driver & { point: RecyclePoint | null; supervisor: Supervisor | null };
type ApprovedSupervisorResult = { request: BotAccessRequest; supervisor: SupervisorWithPoint };
type ApprovedDriverResult = { request: BotAccessRequest; driver: DriverWithRelations };

export function normalizeStaffPhone(input: string): string {
    const digits = input.replace(/\D/g, '');
    if (digits.startsWith('998')) return `+${digits}`;
    if (digits.length === 9) return `+998${digits}`;
    if (digits.startsWith('0') && digits.length === 10) return `+998${digits.slice(1)}`;
    return input.startsWith('+') ? input : `+${digits}`;
}

export function phoneLookupVariants(phone: string): string[] {
    const normalized = normalizeStaffPhone(phone);
    const noPlus = normalized.replace('+', '');
    const local = normalized.startsWith('+998') ? `0${normalized.slice(4)}` : normalized;
    const short = normalized.slice(-9);
    return Array.from(new Set([normalized, noPlus, local, short].filter(Boolean)));
}

export async function findExistingAccessEntity(role: BotAccessRole, phone: string) {
    const variants = phoneLookupVariants(phone);
    if (role === 'supervisor') {
        return prisma.supervisor.findFirst({
            where: { OR: variants.map((variant) => ({ phone: variant })) },
            include: { point: true },
        });
    }

    return prisma.driver.findFirst({
        where: { OR: variants.map((variant) => ({ phone: variant })) },
        include: { point: true, supervisor: true },
    });
}

export async function createOrReuseBotAccessRequest(input: CreateBotAccessRequestInput) {
    const phone = normalizeStaffPhone(input.phone);
    const name = input.name.trim() || (input.role === 'driver' ? 'Driver nomzod' : 'Admin nomzod');
    const existingEntity = await findExistingAccessEntity(input.role, phone);
    if (existingEntity) {
        return { kind: 'existing' as const, entity: existingEntity };
    }

    const pending = await prisma.botAccessRequest.findFirst({
        where: { role: input.role, phone, status: 'pending' },
        orderBy: { createdAt: 'desc' },
    });
    if (pending) {
        return { kind: 'pending' as const, request: pending };
    }

    const request = await prisma.botAccessRequest.create({
        data: {
            role: input.role,
            status: 'pending',
            name,
            phone,
            telegramId: input.telegramId || null,
            telegramName: input.telegramName || null,
            vehicleInfo: input.vehicleInfo || null,
            requestedPointId: input.requestedPointId || null,
            requestedSupervisorId: input.requestedSupervisorId || null,
        },
    });

    await createBotEvent({
        sourceBot: input.sourceBot,
        eventType: `${input.role}.access_request.created`,
        entityType: 'bot_access_request',
        entityId: request.id,
        severity: 'warning',
        title: input.role === 'driver' ? 'Yangi driver arizasi' : 'Yangi admin arizasi',
        message: `${name} (${phone}) ${input.role === 'driver' ? 'driver' : 'admin'} bo'lish uchun ariza yubordi.`,
        supervisorId: input.requestedSupervisorId || undefined,
        pointId: input.requestedPointId || undefined,
        notifyAdmins: true,
        payload: {
            role: input.role,
            phone,
            telegramId: input.telegramId || null,
        },
    });

    return { kind: 'created' as const, request };
}

export async function approveBotAccessRequest(
    requestId: number,
    input: ApproveBotAccessRequestInput,
): Promise<ApprovedSupervisorResult | ApprovedDriverResult> {
    const request = await prisma.botAccessRequest.findUnique({
        where: { id: requestId },
        include: { requestedSupervisor: true, requestedPoint: true },
    });

    if (!request) throw new Error('Ariza topilmadi');
    if (request.status !== 'pending') throw new Error('Ariza allaqachon ko\'rib chiqilgan');

    const registrationCode = await generateUniqueTelegramRegistrationCode();

    if (request.role === 'supervisor') {
        const existing = await prisma.supervisor.findFirst({
            where: { OR: phoneLookupVariants(request.phone).map((phone) => ({ phone })) },
        });
        const supervisor = existing
            ? await prisma.supervisor.update({
                where: { id: existing.id },
                data: {
                    name: request.name,
                    phone: normalizeStaffPhone(request.phone),
                    telegramId: request.telegramId || existing.telegramId,
                    telegramName: request.telegramName || existing.telegramName,
                    pointId: input.pointId ?? request.requestedPointId ?? existing.pointId,
                    isActive: true,
                    registeredAt: existing.registeredAt ?? new Date(),
                    registrationCode: existing.registrationCode ?? registrationCode,
                },
                include: { point: true },
            })
            : await prisma.supervisor.create({
                data: {
                    name: request.name,
                    phone: normalizeStaffPhone(request.phone),
                    telegramId: request.telegramId,
                    telegramName: request.telegramName,
                    pointId: input.pointId ?? request.requestedPointId,
                    isActive: true,
                    registeredAt: request.telegramId ? new Date() : null,
                    registrationCode,
                },
                include: { point: true },
            });

        const updatedRequest = await prisma.botAccessRequest.update({
            where: { id: request.id },
            data: {
                status: 'approved',
                approvedByHqAdminId: input.approvedByHqAdminId || null,
                approvedAt: new Date(),
                createdSupervisorId: supervisor.id,
            },
        });

        await createBotEvent({
            sourceBot: 'pack24admin',
            eventType: 'supervisor.access_request.approved',
            entityType: 'supervisor',
            entityId: supervisor.id,
            severity: 'success',
            title: 'Admin arizasi tasdiqlandi',
            message: `${supervisor.name} admin/supervisor sifatida tasdiqlandi.`,
            supervisorId: supervisor.id,
            pointId: supervisor.pointId ?? undefined,
            notifyAdmins: true,
        });

        return { request: updatedRequest, supervisor };
    }

    const supervisorId = input.supervisorId ?? request.requestedSupervisorId ?? input.approvedBySupervisorId ?? null;
    const pointId = input.pointId ?? request.requestedPointId ?? request.requestedSupervisor?.pointId ?? null;
    const existing = await prisma.driver.findFirst({
        where: { OR: phoneLookupVariants(request.phone).map((phone) => ({ phone })) },
    });

    // Yangi haydovchilar uchun random parol generatsiya qilamiz
    // (mavjud bo'lsa va parol o'rnatilgan bo'lsa, qayta yaratmaymiz)
    const needsNewPassword = !existing?.passwordHash;
    const plainPassword = needsNewPassword ? generateReadablePassword() : null;
    const passwordHash = plainPassword ? await hashPassword(plainPassword) : null;
    const now = new Date();

    const driver = existing
        ? await prisma.driver.update({
            where: { id: existing.id },
            data: {
                name: request.name,
                phone: normalizeStaffPhone(request.phone),
                telegramId: request.telegramId || existing.telegramId,
                telegramName: request.telegramName || existing.telegramName,
                supervisorId,
                pointId,
                vehicleInfo: request.vehicleInfo || existing.vehicleInfo,
                status: 'active',
                isOnline: Boolean(request.telegramId) || existing.isOnline,
                registeredAt: existing.registeredAt ?? (request.telegramId ? now : null),
                registrationCode: existing.registrationCode ?? registrationCode,
                passwordHash: existing.passwordHash ?? passwordHash,
                passwordSetByBotAt: existing.passwordSetByBotAt ?? (passwordHash ? now : null),
                // Audit: kim taqdim etgan
                invitedBySupervisorId: existing.invitedBySupervisorId ?? input.approvedBySupervisorId ?? supervisorId ?? null,
                invitedByPointId: existing.invitedByPointId ?? pointId,
                invitedAt: existing.invitedAt ?? now,
            },
            include: { point: true, supervisor: true },
        })
        : await prisma.driver.create({
            data: {
                name: request.name,
                phone: normalizeStaffPhone(request.phone),
                telegramId: request.telegramId,
                telegramName: request.telegramName,
                supervisorId,
                pointId,
                vehicleInfo: request.vehicleInfo,
                status: 'active',
                isOnline: Boolean(request.telegramId),
                registeredAt: request.telegramId ? now : null,
                registrationCode,
                passwordHash,
                passwordSetByBotAt: passwordHash ? now : null,
                // Audit: kim taqdim etgan
                invitedBySupervisorId: input.approvedBySupervisorId ?? supervisorId ?? null,
                invitedByPointId: pointId,
                invitedAt: now,
            },
            include: { point: true, supervisor: true },
        });

    const updatedRequest = await prisma.botAccessRequest.update({
        where: { id: request.id },
        data: {
            status: 'approved',
            approvedBySupervisorId: input.approvedBySupervisorId || null,
            approvedAt: new Date(),
            createdDriverId: driver.id,
        },
    });

    await createBotEvent({
        sourceBot: 'supervisor',
        eventType: 'driver.access_request.approved',
        entityType: 'driver',
        entityId: driver.id,
        severity: 'success',
        title: 'Driver arizasi tasdiqlandi',
        message: `${driver.name} driver sifatida tasdiqlandi.`,
        driverId: driver.id,
        supervisorId: driver.supervisorId ?? undefined,
        pointId: driver.pointId ?? undefined,
        notifyAdmins: true,
        payload: {
            invitedBySupervisorId: driver.invitedBySupervisorId,
            invitedByPointId: driver.invitedByPointId,
            registrationCode: driver.registrationCode,
            passwordIssued: Boolean(plainPassword),
        },
    });

    // Tasdiqlangan haydovchiga bot orqali kirish ma'lumotlarini yuboramiz
    // (faqat plainPassword bor bo'lsa — yangi yaratilgan parol)
    if (plainPassword && driver.telegramId && driver.registrationCode) {
        try {
            const credMsg = formatDriverCredentialsMessage({
                name: driver.name,
                phone: driver.phone,
                code: driver.registrationCode,
                password: plainPassword,
                supervisorName: driver.supervisor?.name ?? null,
                pointRegion: driver.point?.regionUz ?? null,
                pointCity: driver.point?.cityUz ?? null,
            });
            await notifyDriver(driver.telegramId, credMsg);
        } catch (e) {
            console.error('[approveBotAccessRequest] credentials DM failed:', e);
        }
    }

    // Taklif qilgan mas'ulga eslatma
    if (driver.invitedBySupervisorId) {
        const inviter = await prisma.supervisor.findUnique({
            where: { id: driver.invitedBySupervisorId },
            select: { telegramId: true, name: true },
        });
        if (inviter?.telegramId) {
            await notifyAdmin(
                inviter.telegramId,
                `✅ <b>Siz taklif qilgan haydovchi tasdiqlandi</b>\n\n` +
                `👤 ${driver.name}\n` +
                `📞 ${driver.phone}\n` +
                `🏭 Punkt: ${driver.point?.regionUz || '—'}, ${driver.point?.cityUz || '—'}\n` +
                `🕐 ${new Date().toLocaleString('ru-RU')}`,
            );
        }
    }

    return { request: updatedRequest, driver };
}

export async function rejectBotAccessRequest(
    requestId: number,
    input: { rejectedByHqAdminId?: number | null; rejectedBySupervisorId?: number | null; reason?: string | null },
) {
    const request = await prisma.botAccessRequest.update({
        where: { id: requestId },
        data: {
            status: 'rejected',
            rejectedAt: new Date(),
            rejectReason: input.reason || null,
            approvedByHqAdminId: input.rejectedByHqAdminId || null,
            approvedBySupervisorId: input.rejectedBySupervisorId || null,
        },
    });

    await createBotEvent({
        sourceBot: request.role === 'driver' ? 'supervisor' : 'pack24admin',
        eventType: `${request.role}.access_request.rejected`,
        entityType: 'bot_access_request',
        entityId: request.id,
        severity: 'warning',
        title: request.role === 'driver' ? 'Driver arizasi rad etildi' : 'Admin arizasi rad etildi',
        message: `${request.name} (${request.phone}) arizasi rad etildi.`,
        notifyAdmins: true,
    });

    return request;
}
