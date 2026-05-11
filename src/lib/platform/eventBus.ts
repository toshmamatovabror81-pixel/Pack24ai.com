/**
 * In-memory Event Bus — Server-Sent Events (SSE) uchun
 *
 * Botlar `publishPlatformEvent` / `createBotEvent` orqali event yuborganda,
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
}

type SSEClient = (event: RealtimeEvent) => void;

class EventBus {
    private clients: Set<SSEClient> = new Set();

    subscribe(client: SSEClient): () => void {
        this.clients.add(client);
        return () => {
            this.clients.delete(client);
        };
    }

    publish(event: RealtimeEvent): void {
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
}

// Singleton — Next.js hot reload da ham saqlanadi
const globalForBus = globalThis as unknown as { eventBus?: EventBus };
export const eventBus = globalForBus.eventBus ?? new EventBus();
if (process.env.NODE_ENV !== 'production') globalForBus.eventBus = eventBus;
