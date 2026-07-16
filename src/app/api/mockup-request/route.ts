import { NextResponse } from 'next/server';
import { eventBus } from '@/lib/platform/eventBus';
import { notifyAllPack24Admins } from '@/lib/telegram/notifier';

/**
 * POST /api/mockup-request
 * Bepul maket (mockup) buyurtma so'rovi.
 * Admin panelga (SSE) va Pack24 admin botiga xabar yuboradi.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const name = String(body.name ?? '').trim();
        const phone = String(body.phone ?? '').trim();
        const packagingType = String(body.packagingType ?? '').trim();
        const dimensions = String(body.dimensions ?? '').trim();
        const quantity = String(body.quantity ?? '').trim();
        const message = String(body.message ?? '').trim();

        if (!name || !phone) {
            return NextResponse.json({ error: "Ism va telefon raqam majburiy" }, { status: 400 });
        }
        if (name.length > 100 || phone.length > 30 || message.length > 2000) {
            return NextResponse.json({ error: "Maydon uzunligi chegaradan oshdi" }, { status: 400 });
        }

        const summary = [
            `📦 <b>Yangi maket so'rovi</b>`,
            ``,
            `👤 Mijoz: ${name}`,
            `📞 Telefon: ${phone}`,
            packagingType ? `📋 Qadoqlash turi: ${packagingType}` : null,
            dimensions ? `📐 O'lchamlar: ${dimensions}` : null,
            quantity ? `🔢 Miqdor: ${quantity}` : null,
            message ? `💬 Izoh: ${message}` : null,
        ].filter(Boolean).join('\n');

        eventBus.publish({
            type: 'mockup.request',
            title: 'Maket so\'rovi',
            message: `${name} (${phone}) bepul maket so'radi${packagingType ? ` — ${packagingType}` : ''}`,
            severity: 'info',
            timestamp: new Date().toISOString(),
            source: 'customer_app',
            callerName: name,
            callerPhone: phone,
        });

        // Telegram admin botga (token sozlanmagan bo'lsa jim o'tadi)
        notifyAllPack24Admins(summary, { parse_mode: 'HTML' }).catch((err) => {
            console.error('[Mockup Request] Telegram notify xatosi:', err);
        });

        return NextResponse.json({ success: true, message: "So'rovingiz qabul qilindi" });
    } catch (error) {
        console.error('[Mockup Request API]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
