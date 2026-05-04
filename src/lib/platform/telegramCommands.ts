import { escapeTelegramHtml } from '@/lib/telegram/format';
import { notifyLegacyAdminChats } from '@/lib/telegram/notifier';
import {
    LowStockAlertItem,
    ManualOrderTelegramNotification,
    WebsiteOrderTelegramNotification,
} from './contracts';

const paymentLabel: Record<string, string> = {
    click: '🔵 Click',
    payme: '🟢 Payme',
    cash: '💵 Naqd pul',
};

const deliveryLabel: Record<string, string> = {
    courier: '🚚 Kuryer',
    pickup: '📦 Olib ketish',
};

function getAdminLink(path: string) {
    return `${process.env.NEXT_PUBLIC_APP_URL ?? ''}${path}`;
}

export function buildWebsiteOrderCreatedAdminText(order: WebsiteOrderTelegramNotification) {
    const itemLines = order.items
        .map((item) => `  • ${escapeTelegramHtml(item.name)} × ${item.quantity} = ${(item.price * item.quantity).toLocaleString()} so'm`)
        .join('\n');
    const safeCustomerName = escapeTelegramHtml(order.customerName ?? 'Noma\'lum');
    const safePhone = escapeTelegramHtml(order.contactPhone ?? '-');
    const safeAddress = escapeTelegramHtml(order.shippingAddress ?? '-');
    const safeDelivery = escapeTelegramHtml(
        deliveryLabel[order.deliveryMethod ?? ''] ?? (order.deliveryMethod ?? '-'),
    );
    const safePayment = escapeTelegramHtml(
        paymentLabel[order.paymentMethod ?? ''] ?? (order.paymentMethod ?? '-'),
    );
    const safeLocation = order.shippingLocation
        ? encodeURIComponent(order.shippingLocation)
        : null;

    return [
        `🛒 <b>Yangi Buyurtma #${order.id}</b>`,
        '',
        `👤 <b>Mijoz:</b> ${safeCustomerName}`,
        `📞 <b>Tel:</b> ${safePhone}`,
        `📍 <b>Manzil:</b> ${safeAddress}`,
        safeLocation ? `🗺️ <b>Xarita:</b> <a href="https://www.google.com/maps?q=${safeLocation}">Lokatsiyani ko'rish</a>` : '',
        `🚀 <b>Yetkazish:</b> ${safeDelivery}`,
        `💳 <b>To'lov:</b> ${safePayment}`,
        '',
        '<b>Mahsulotlar:</b>',
        itemLines,
        '',
        `💰 <b>Jami: ${(order.totalAmount ?? 0).toLocaleString()} so'm</b>`,
        `📌 Status: ${escapeTelegramHtml(order.status)}`,
        '',
        `🔗 Admin: ${getAdminLink('/admin/orders')}`,
    ].join('\n');
}

export function buildManualOrderAdminText(order: ManualOrderTelegramNotification) {
    const itemsList = order.items.map((item) =>
        `- ${escapeTelegramHtml(item.name)} (${item.quantity} x ${item.price.toLocaleString()} UZS)`,
    ).join('\n');

    const safeOrderId = escapeTelegramHtml(order.id || 'N/A');
    const safeContactName = escapeTelegramHtml(order.contactName || 'Noma\'lum');
    const safePhone = escapeTelegramHtml(order.contactPhone || '-');
    const safeAddress = escapeTelegramHtml(order.address || '-');
    const safeComment = escapeTelegramHtml(order.comment || 'Yo\'q');

    return `
📦 <b>Yangi Buyurtma!</b>

🆔 <b>ID:</b> <code>${safeOrderId}</code>
👤 <b>Mijoz:</b> ${safeContactName}
📞 <b>Tel:</b> ${safePhone}
📍 <b>Manzil:</b> ${safeAddress}
📝 <b>Izoh:</b> ${safeComment}

🛒 <b>Mahsulotlar:</b>
${itemsList}

💰 <b>Jami:</b> <b>${(order.totalAmount ?? 0).toLocaleString()} UZS</b>
    `.trim();
}

export function buildLowStockAdminText(items: LowStockAlertItem[], threshold: number) {
    const lines = items.map((item) =>
        `  ⚠️ ${escapeTelegramHtml(item.name)}${item.sku ? ` (${escapeTelegramHtml(item.sku)})` : ''} — qoldi: <b>${item.quantity}</b>`,
    ).join('\n');

    return [
        '📦 <b>Ombor: Kam qolgan mahsulotlar</b>',
        '',
        lines,
        '',
        `Chegara: ${threshold} dona`,
        `🔗 Admin: ${getAdminLink('/admin/products/warehouse')}`,
    ].join('\n');
}

export async function sendWebsiteOrderCreatedToAdminChats(order: WebsiteOrderTelegramNotification) {
    return notifyLegacyAdminChats(buildWebsiteOrderCreatedAdminText(order));
}

export async function sendManualOrderNotificationToAdminChats(order: ManualOrderTelegramNotification) {
    return notifyLegacyAdminChats(buildManualOrderAdminText(order));
}

export async function sendLowStockAlertToAdminChats(items: LowStockAlertItem[], threshold: number) {
    if (!items.length) return false;
    return notifyLegacyAdminChats(buildLowStockAdminText(items, threshold));
}
