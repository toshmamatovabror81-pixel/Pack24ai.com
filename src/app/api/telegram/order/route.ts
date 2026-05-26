import { NextRequest, NextResponse } from 'next/server';
import {
    readArray,
    readJsonObject,
    readOptionalNumber,
    readOptionalString,
    RequestValidationError,
} from '@/lib/requestValidation';
import { publishPlatformEvent } from '@/lib/platform/events';
import { sendManualOrderNotificationToAdminChats } from '@/lib/platform/telegramCommands';
import { isAuthorizedTelegramOpsRequest } from '@/lib/telegram/security';
import { roundUZS, toNumber } from '@/lib/money';

export async function POST(request: NextRequest) {
    try {
        const authorized = await isAuthorizedTelegramOpsRequest(request);
        if (!authorized) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await readJsonObject(request);
        const items = readArray(body.items, 'items').map((item, index) => {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                throw new RequestValidationError(`items[${index}] object bo'lishi kerak`);
            }

            const itemRecord = item as Record<string, unknown>;

            return {
                name: readOptionalString(itemRecord.name, `items[${index}].name`) || 'Mahsulot',
                quantity: readOptionalNumber(itemRecord.quantity, `items[${index}].quantity`) ?? 0,
                price: toNumber(
                    roundUZS(readOptionalNumber(itemRecord.price, `items[${index}].price`) ?? 0),
                ),
            };
        });

        if (items.length === 0) {
            return NextResponse.json({ success: false, error: 'Order items required' }, { status: 400 });
        }

        const orderId = readOptionalString(body.id, 'id') || 'N/A';
        const contactName = readOptionalString(body.contactName, 'contactName') || 'Noma\'lum';
        const contactPhone = readOptionalString(body.contactPhone, 'contactPhone') || '-';
        const address = readOptionalString(body.address, 'address') || '-';
        const comment = readOptionalString(body.comment, 'comment') || 'Yo\'q';
        const totalAmount = toNumber(
            roundUZS(readOptionalNumber(body.totalAmount, 'totalAmount') ?? 0),
        );
        const numericOrderId = typeof body.id === 'number' && Number.isInteger(body.id) ? body.id : undefined;

        const sent = await sendManualOrderNotificationToAdminChats({
            id: orderId,
            contactName,
            contactPhone,
            address,
            comment,
            totalAmount,
            items,
        });
        if (!sent) {
            console.error('Telegram admin chats not configured');
            await publishPlatformEvent({
                source: 'platform',
                type: 'order.notification_requested',
                entityType: 'order',
                entityId: numericOrderId,
                severity: 'warning',
                title: 'Buyurtma xabari yuborilmadi',
                message: `Buyurtma ${orderId} uchun Telegram admin chat topilmadi.`,
                payload: {
                    orderId,
                    contactName,
                    contactPhone,
                    address,
                    totalAmount,
                    itemCount: items.length,
                },
                notifyAdmins: false,
            });
            return NextResponse.json({ success: false, error: 'Telegram admin chat not configured' }, { status: 503 });
        }

        await publishPlatformEvent({
            source: 'platform',
            type: 'order.notification_requested',
            entityType: 'order',
            entityId: numericOrderId,
            severity: 'success',
            title: 'Buyurtma xabari Telegramga yuborildi',
            message: `Buyurtma ${orderId} uchun admin chatlarga Telegram xabari yuborildi.`,
            payload: {
                orderId,
                contactName,
                contactPhone,
                address,
                totalAmount,
                itemCount: items.length,
            },
            notifyAdmins: false,
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ success: false, error: error.message }, { status: error.status });
        }

        console.error('Telegram notification failed:', error);
        return NextResponse.json({ success: false, error: "Internal Server Error" });
    }
}
