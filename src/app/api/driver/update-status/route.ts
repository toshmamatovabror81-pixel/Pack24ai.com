/**
 * POST /api/driver/update-status
 * Haydovchi ariza statusini yangilash
 * body: { requestId, driverId, status, actualWeight?, discountPercent?, pricePerKg? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateRecycleRequest } from '@/lib/domain/recycling/requestService';
import { requireDriver } from '@/lib/auth/guards';

export async function POST(req: NextRequest) {
    try {
        const guard = await requireDriver(req);
        if (!guard.ok) return guard.response;
        const driverId = guard.driverId;

        const body = await req.json();
        const { requestId, status, actualWeight, discountPercent, pricePerKg, notes } = body;

        if (!requestId || !status) {
            return NextResponse.json({ error: 'requestId va status talab qilinadi' }, { status: 400 });
        }

        const request = await prisma.recycleRequest.findUnique({
            where: { id: Number(requestId) },
            include: { point: true },
        });
        if (!request) return NextResponse.json({ error: 'Ariza topilmadi' }, { status: 404 });

        if (request.assignedDriverId !== driverId) {
            return NextResponse.json(
                { error: 'Bu ariza sizga tayinlanmagan' },
                { status: 403 }
            );
        }

        // requestService orqali status yangilash (eco-progress trigger ham ichida)
        await updateRecycleRequest(Number(requestId), { status });

        if ((status === 'completed' || status === 'collected') && actualWeight) {
            const effWeight = actualWeight * (1 - (discountPercent || 0) / 100);
            const pKg = pricePerKg || request.point?.pricePerKg || 800;
            const totalAmount = Math.round(effWeight * pKg);

            // Takroriy collection yaratmaslik uchun tekshirish
            const existing = await prisma.recycleCollection.findFirst({
                where: { requestId: Number(requestId) },
            });

            if (!existing) {
                const collection = await prisma.recycleCollection.create({
                    data: {
                        requestId: Number(requestId),
                        driverId: Number(driverId),
                        actualWeight,
                        discountPercent: discountPercent || 0,
                        effectiveWeight: effWeight,
                        pricePerKg: pKg,
                        totalAmount,
                        notes: notes || null,
                        paymentStatus: 'pending',
                    },
                });

                // Haydovchiga daromad yozish — RecyclePoint.driverRatePerKg asosida
                const driverRate = (request.point as any)?.driverRatePerKg ?? 100;
                const driverEarning = Math.round(actualWeight * driverRate);
                await prisma.driverTransaction.create({
                    data: {
                        driverId: Number(driverId),
                        type: 'earning',
                        amount: driverEarning,
                        status: 'completed',
                        description: `Buyurtma #${requestId} (${actualWeight} kg × ${driverRate} so'm/kg)`,
                        collectionId: collection.id,
                    }
                });

                return NextResponse.json({ ok: true, status, collectionId: collection.id, earned: driverEarning });
            }
        }

        return NextResponse.json({ ok: true, status });
    } catch (error: any) {
        console.error('[driver/update-status]', error);
        return NextResponse.json({ error: 'Server xatosi', detail: error.message }, { status: 500 });
    }
}
