/**
 * GET /api/admin/recycling/drivers/by-supervisor
 *
 * Mas'ullar bo'yicha haydovchilar hisoboti — Yandex Pro-ga o'xshash
 * "qaysi masulda nechta haydovchi va qaysi punkt orqali olingan".
 *
 * Har bir supervisor uchun:
 *  - jami haydovchilar soni
 *  - bot orqali kirgan haydovchilar (registeredAt is not null)
 *  - online haydovchilar
 *  - haydovchilar ro'yxati (qisqacha)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const supervisors = await prisma.supervisor.findMany({
            orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
            select: {
                id: true,
                name: true,
                phone: true,
                isActive: true,
                telegramId: true,
                point: { select: { id: true, regionUz: true, cityUz: true } },
                drivers: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        status: true,
                        isOnline: true,
                        registeredAt: true,
                        invitedAt: true,
                        invitedBySupervisorId: true,
                        invitedByPointId: true,
                        registrationCode: true,
                        passwordHash: true,
                        passwordSetByBotAt: true,
                        acceptedMaterials: true,
                        lastSeenAt: true,
                        point: { select: { id: true, regionUz: true, cityUz: true } },
                    },
                    orderBy: [{ isOnline: 'desc' }, { name: 'asc' }],
                },
                invitedDrivers: {
                    select: { id: true, name: true, phone: true, isOnline: true },
                },
            },
        });

        // Supervisor ostidagi punkt sinflashtirilishi: haydovchilar
        // o'zlarining `pointId` lari bo'yicha qaysi bazada ishlayotgani
        const report = supervisors.map(s => {
            const drivers = s.drivers;
            const total = drivers.length;
            const online = drivers.filter(d => d.isOnline).length;
            const botRegistered = drivers.filter(d => d.registeredAt).length;
            const withPassword = drivers.filter(d => d.passwordHash).length;
            const withTariffs = drivers.filter(d => (d.acceptedMaterials?.length || 0) > 0).length;

            // Punkt bo'yicha guruh (kichik haydovchilar ham boshqa punktda bo'lishi mumkin)
            const byPoint = new Map<string, { pointId: number | null; regionUz: string; cityUz: string; count: number }>();
            for (const d of drivers) {
                const key = String(d.point?.id ?? 'none');
                const prev = byPoint.get(key);
                if (prev) {
                    prev.count += 1;
                } else {
                    byPoint.set(key, {
                        pointId: d.point?.id ?? null,
                        regionUz: d.point?.regionUz ?? '—',
                        cityUz: d.point?.cityUz ?? '—',
                        count: 1,
                    });
                }
            }

            return {
                supervisor: {
                    id: s.id,
                    name: s.name,
                    phone: s.phone,
                    isActive: s.isActive,
                    hasTelegram: Boolean(s.telegramId),
                    point: s.point,
                },
                kpis: {
                    total,
                    online,
                    botRegistered,
                    withPassword,
                    withTariffs,
                    invitedByMe: s.invitedDrivers.length,
                },
                byPoint: Array.from(byPoint.values()),
                drivers: drivers.map(d => ({
                    id: d.id,
                    name: d.name,
                    phone: d.phone,
                    status: d.status,
                    isOnline: d.isOnline,
                    registeredAt: d.registeredAt,
                    invitedAt: d.invitedAt,
                    invitedByMe: d.invitedBySupervisorId === s.id,
                    hasPassword: Boolean(d.passwordHash),
                    hasRegistrationCode: Boolean(d.registrationCode),
                    acceptedMaterialsCount: d.acceptedMaterials?.length || 0,
                    lastSeenAt: d.lastSeenAt,
                    point: d.point,
                })),
            };
        });

        // Punkt-darajasidagi yig'indi (qaysi baza bilan qancha haydovchi ishlayapti)
        const points = await prisma.recyclePoint.findMany({
            orderBy: { regionUz: 'asc' },
            select: {
                id: true,
                regionUz: true,
                cityUz: true,
                _count: {
                    select: {
                        drivers: true,
                        invitedDrivers: true,
                        supervisors: true,
                    },
                },
            },
        });

        // Audit: kim taqdim etgan-grouping
        const orphans = await prisma.driver.count({
            where: { invitedBySupervisorId: null, registeredAt: { not: null } },
        });

        return NextResponse.json({
            ok: true,
            supervisors: report,
            points: points.map(p => ({
                id: p.id,
                regionUz: p.regionUz,
                cityUz: p.cityUz,
                driversCount: p._count.drivers,
                invitedDriversCount: p._count.invitedDrivers,
                supervisorsCount: p._count.supervisors,
            })),
            orphans,
        });
    } catch (e) {
        console.error('[drivers/by-supervisor]', e);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
