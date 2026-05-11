import { eventBus, type RealtimeEvent } from '@/lib/platform/eventBus';

// SSE — Server-Sent Events endpoint
// Admin panel bu endpoint'ga ulanib, real-time eventlar oladi
export async function GET() {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Ping yuborish — connection tirik ekanini ko'rsatish
            const sendEvent = (event: RealtimeEvent) => {
                try {
                    const data = JSON.stringify(event);
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } catch {
                    // Stream yopilgan
                }
            };

            // Event bus'ga ulash
            const unsubscribe = eventBus.subscribe(sendEvent);

            // Har 25 soniyada ping — connection drop qilmasligi uchun
            const pingInterval = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: ping\n\n`));
                } catch {
                    clearInterval(pingInterval);
                }
            }, 25_000);

            // Dastlabki ping — client ulangan
            try {
                const welcome: RealtimeEvent = {
                    type: 'system.connected',
                    title: 'SSE ulandi',
                    message: `Real-time stream ulandi. Clientlar: ${eventBus.clientCount}`,
                    severity: 'info',
                    timestamp: new Date().toISOString(),
                    source: 'system',
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(welcome)}\n\n`));
            } catch { /* */ }

            // Cleanup
            const originalCancel = controller.close.bind(controller);
            void originalCancel; // suppress unused
            
            // Stream yopilganda cleanup
            const checkClosed = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(''));
                } catch {
                    clearInterval(checkClosed);
                    clearInterval(pingInterval);
                    unsubscribe();
                }
            }, 5000);
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}

// Edge runtime emas — Node runtime kerak SSE uchun
export const dynamic = 'force-dynamic';
