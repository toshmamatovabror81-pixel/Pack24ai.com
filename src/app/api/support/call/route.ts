import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { eventBus } from '@/lib/platform/eventBus';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user;

        // Xatto login qilmagan bo'lsa ham call qilish mumkinmi? Yo'q, login so'raylik yoki faqat guest bo'lsa body dan ism olaylik.
        const body = await req.json().catch(() => ({}));
        
        const callerName = user?.name || body.name || 'Noma\'lum mijoz';
        const callerPhone = user?.phone || body.phone || 'Noma\'lum telefon';
        const callerMessage = body.message || '';

        eventBus.publish({
            type: 'support.call',
            title: 'Yordam xizmati',
            message: callerMessage
                ? `${callerName} (${callerPhone}): ${callerMessage}`
                : `${callerName} operator yordamiga muhtoj.`,
            severity: 'warning',
            timestamp: new Date().toISOString(),
            source: 'customer_app',
            callerName,
            callerPhone,
        });

        return NextResponse.json({ success: true, message: "Operatorlarga xabar yuborildi" });
    } catch (error) {
        console.error('[Support Call API]', error);
        return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
    }
}
