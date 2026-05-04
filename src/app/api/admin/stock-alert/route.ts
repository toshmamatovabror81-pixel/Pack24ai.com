import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    readArray,
    readBooleanQueryParam,
    readJsonObject,
    readOptionalNumber,
    readOptionalString,
    readPositiveIntegerQueryParam,
    RequestValidationError,
} from '@/lib/requestValidation';
import { publishPlatformEvent } from '@/lib/platform/events';
import { sendLowStockAlertToAdminChats } from '@/lib/platform/telegramCommands';
import { isAuthorizedTelegramOpsRequest } from '@/lib/telegram/security';

const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD ?? '10');

// ─── Telegram alert helper ────────────────────────────────────────────────────
async function sendLowStockAlert(items: { name: string; quantity: number; sku?: string | null }[], threshold: number) {
    if (!items.length) return false;
    return sendLowStockAlertToAdminChats(items, threshold);
}

// ─── GET /api/admin/stock-alert — Kam qolgan mahsulotlarni tekshirish ─────────
// Bu endpoint cron job yoki qo'lda tekshirish uchun ishlatiladi
export async function GET(req: NextRequest) {
    try {
        const authorized = await isAuthorizedTelegramOpsRequest(req);
        if (!authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const notify = readBooleanQueryParam(searchParams.get('notify'));
        const threshold = readPositiveIntegerQueryParam(
            searchParams.get('threshold'),
            'threshold',
            LOW_STOCK_THRESHOLD,
        );

        // Inventory checking — agar Inventory model bo'lsa
        let lowStockItems: { id: number; name: string; sku: string | null; quantity: number }[] = [];

        try {
            // Try inventory table first
            const inventoryItems = await (prisma as any).inventory.findMany({
                where: { quantity: { lte: threshold } },
                include: { product: { select: { id: true, name: true, sku: true } } },
                orderBy: { quantity: 'asc' },
                take: 50,
            });

            lowStockItems = inventoryItems.map((i: any) => ({
                id: i.product?.id ?? i.id,
                name: i.product?.name ?? 'Noma\'lum',
                sku: i.product?.sku ?? null,
                quantity: i.quantity,
            }));
        } catch {
            // No stock field — return empty with message
            lowStockItems = [];
            return NextResponse.json({
                message: 'Inventory modeli topilmadi. Warehouse bilan integratsiya qiling.',
                lowStock: [],
                threshold,
            });
        }

        // Send Telegram if requested
        let notified = false;
        if (notify && lowStockItems.length > 0) {
            notified = await sendLowStockAlert(lowStockItems, threshold);
            if (notified) {
                await publishPlatformEvent({
                    source: 'platform',
                    type: 'inventory.low_stock_detected',
                    entityType: 'inventory',
                    severity: 'warning',
                    title: 'Kam qolgan mahsulotlar bo\'yicha alert yuborildi',
                    message: `${lowStockItems.length} ta mahsulot uchun avtomatik low-stock alert yuborildi.`,
                    payload: {
                        threshold,
                        count: lowStockItems.length,
                        items: lowStockItems,
                    },
                    notifyAdmins: false,
                });
            }
        }

        return NextResponse.json({
            lowStock: lowStockItems,
            count: lowStockItems.length,
            threshold,
            notified,
            checkedAt: new Date().toISOString(),
        });
    } catch (error) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        console.error('[stock-alert]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

// ─── POST /api/admin/stock-alert — Manual alert yuborish ─────────────────────
export async function POST(req: NextRequest) {
    try {
        const authorized = await isAuthorizedTelegramOpsRequest(req);
        if (!authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await readJsonObject(req);
        const items = readArray(body.items, 'items').map((item, index) => {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                throw new RequestValidationError(`items[${index}] object bo'lishi kerak`);
            }

            const itemRecord = item as Record<string, unknown>;

            return {
                name: readOptionalString(itemRecord.name, `items[${index}].name`) || 'Noma\'lum',
                sku: readOptionalString(itemRecord.sku, `items[${index}].sku`) ?? null,
                quantity: readOptionalNumber(itemRecord.quantity, `items[${index}].quantity`) ?? 0,
            };
        });

        if (!items.length) {
            return NextResponse.json({ error: 'items majburiy' }, { status: 400 });
        }

        for (const [index, item] of items.entries()) {
            if (item.quantity < 0) {
                throw new RequestValidationError(`items[${index}].quantity manfiy bo'lmasligi kerak`);
            }
        }

        const sent = await sendLowStockAlert(items, LOW_STOCK_THRESHOLD);
        if (sent) {
            await publishPlatformEvent({
                source: 'platform',
                type: 'inventory.low_stock_alert_sent',
                entityType: 'inventory',
                severity: 'warning',
                title: 'Manual low-stock alert yuborildi',
                message: `${items.length} ta mahsulot uchun manual low-stock alert yuborildi.`,
                payload: {
                    threshold: LOW_STOCK_THRESHOLD,
                    count: items.length,
                    items,
                },
                notifyAdmins: false,
            });
        }
        return NextResponse.json({
            success: sent,
            message: sent
                ? `${items.length} ta mahsulot haqida Telegram xabar yuborildi`
                : 'Telegram admin chatlari sozlanmagan',
        }, { status: sent ? 200 : 503 });
    } catch (error) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
