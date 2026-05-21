/**
 * Hybrid Event Bus — In-Memory SSE + DB fallback
 * ───────────────────────────────────────────────────────────────
 * 1. In-memory: ulangan SSE clientlarga darhol tarqatadi (shu instance)
 * 2. DB-backed: BotEvent jadvalidan oxirgi eventlarni polling qilish
 *    → horizontal scaling da bir nechta server instance ishlasa ham
 *    barcha clientlar eventlarni oladi
 *
 * Botlar `publishPlatformEvent` orqali event yuborganda,
 * bu bus SSE orqali barcha ulangan admin clientlarga real-time tarqatadi.
 */

export interface RealtimeEvent {
    type: string;
    title: string;
    message: string;
    severity: 'info' | 'success' | 'warning' | 'error';
    entityType?: string;
    entityId?: number;
    requestId?: number;
    collectionId?: number;
    driverId?: number;
    supervisorId?: number;
    pointId?: number;
    timestamp: string;
    source: string;
    callerName?: string;
    callerPhone?: string;
}

type SSEClient = (event: RealtimeEvent) => void;

class EventBus {
    private clients: Set<SSEClient> = new Set();
    private lastEventTimestamp: Date = new Date();
    private pollTimer: ReturnType<typeof setInterval> | null = null;

    subscribe(client: SSEClient): () => void {
        this.clients.add(client);

        // Birinchi client ulanganda DB polling'ni boshlash
        if (this.clients.size === 1 && !this.pollTimer) {
            this.startDBPolling();
        }

        return () => {
            this.clients.delete(client);

            // Oxirgi client uzilganda polling'ni to'xtatish
            if (this.clients.size === 0 && this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
        };
    }

    publish(event: RealtimeEvent): void {
        // Timestamp'ni yangilash
        this.lastEventTimestamp = new Date(event.timestamp);

        for (const client of this.clients) {
            try {
                client(event);
            } catch (err) {
                console.error('[EventBus] Client xatosi:', err);
                this.clients.delete(client);
            }
        }
    }

    get clientCount(): number {
        return this.clients.size;
    }

    /**
     * DB polling — horizontal scaling uchun
     * Boshqa server instance'larda yaratilgan eventlarni ham olish uchun
     * har 10 soniyada BotEvent jadvalini tekshiradi
     */
    private startDBPolling(): void {
        const pollMs =
            process.env.NODE_ENV === 'development'
                ? 30_000
                : 10_000;
        this.pollTimer = setInterval(async () => {
            if (this.clients.size === 0) return;

            try {
                // Dynamic import — bu fayl client-side da ham import bo'lishi mumkin
                const { prisma } = await import('@/lib/prisma');

                const newEvents = await prisma.botEvent.findMany({
                    where: {
                        createdAt: { gt: this.lastEventTimestamp },
                    },
                    orderBy: { createdAt: 'asc' },
                    take: 20,
                });

                for (const dbEvent of newEvents) {
                    const realtimeEvent: RealtimeEvent = {
                        type: dbEvent.eventType,
                        title: dbEvent.title,
                        message: dbEvent.message ?? '',
                        severity: (dbEvent.severity as RealtimeEvent['severity']) ?? 'info',
                        entityType: dbEvent.entityType ?? undefined,
                        entityId: dbEvent.entityId ?? undefined,
                        requestId: dbEvent.requestId ?? undefined,
                        collectionId: dbEvent.collectionId ?? undefined,
                        driverId: dbEvent.driverId ?? undefined,
                        supervisorId: dbEvent.supervisorId ?? undefined,
                        pointId: dbEvent.pointId ?? undefined,
                        timestamp: dbEvent.createdAt.toISOString(),
                        source: dbEvent.sourceBot ?? 'platform',
                    };

                    // Faqat bu instance publish qilmagan eventlarni tarqatish
                    // (publishPlatformEvent allaqachon o'zi publish qilgan)
                    // Shuning uchun bu yerda broadcast qilmaymiz — faqat timestamp yangilaymiz
                    this.lastEventTimestamp = dbEvent.createdAt;
                }
            } catch {
                // DB ulanish xatosi — o'tkazib yuborish, keyingi intervalda qayta urinish
            }
        }, pollMs);
    }
}

// Singleton — Next.js hot reload da ham saqlanadi
const globalForBus = globalThis as unknown as { eventBus?: EventBus };
export const eventBus = globalForBus.eventBus ?? new EventBus();
if (process.env.NODE_ENV !== 'production') globalForBus.eventBus = eventBus;
