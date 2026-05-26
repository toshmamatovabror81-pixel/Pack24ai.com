import { prisma } from '@/lib/prisma';

/* ─── Types ──────────────────────────────────────────────────── */

type SessionEntry<T> = {
    value: T;
    expiresAt: number;
};

export type TelegramSessionStore<T> = {
    get(key: string): T | undefined;
    set(key: string, value: T): TelegramSessionStore<T>;
    delete(key: string): boolean;
    has(key: string): boolean;
    clear(): void;
};

type SessionStoreOptions = {
    ttlMs?: number;
    refreshOnRead?: boolean;
};

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 12; // 12 soat
const CLEANUP_INTERVAL = 50;

/* ─── In-Memory Layer (tezkor operatsiyalar uchun) ───────────── */

const globalForTelegramSessionStore = globalThis as typeof globalThis & {
    __telegramSessionStores?: Map<string, Map<string, SessionEntry<unknown>>>;
    __telegramSessionStoreOps?: Map<string, number>;
    __telegramSessionPersistTimer?: ReturnType<typeof setInterval>;
};

function getGlobalStores() {
    if (!globalForTelegramSessionStore.__telegramSessionStores) {
        globalForTelegramSessionStore.__telegramSessionStores = new Map();
    }
    return globalForTelegramSessionStore.__telegramSessionStores;
}

function getGlobalOpCounters() {
    if (!globalForTelegramSessionStore.__telegramSessionStoreOps) {
        globalForTelegramSessionStore.__telegramSessionStoreOps = new Map();
    }
    return globalForTelegramSessionStore.__telegramSessionStoreOps;
}

function getOrCreateStore(namespace: string) {
    const stores = getGlobalStores();
    if (!stores.has(namespace)) {
        stores.set(namespace, new Map<string, SessionEntry<unknown>>());
    }
    return stores.get(namespace)!;
}

function nextExpiry(ttlMs: number) {
    return Date.now() + ttlMs;
}

function cleanupExpiredEntries(namespace: string, store: Map<string, SessionEntry<unknown>>) {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (entry.expiresAt <= now) {
            store.delete(key);
        }
    }
    const counters = getGlobalOpCounters();
    counters.set(namespace, 0);
}

function touchStore(namespace: string, store: Map<string, SessionEntry<unknown>>) {
    const counters = getGlobalOpCounters();
    const nextCount = (counters.get(namespace) ?? 0) + 1;
    counters.set(namespace, nextCount);

    if (nextCount >= CLEANUP_INTERVAL) {
        cleanupExpiredEntries(namespace, store);
    }
}

/* ─── DB Persistence Layer ───────────────────────────────────── */

/**
 * Sessiyalarni DB ga saqlash (BotEvent jadvalidan foydalanish)
 * Server restart'da in-memory sessiyalar yo'qolmasligi uchun
 * Telegram bot sessionlarini DB da JSON formatda saqlaymiz.
 * dedupeKey orqali har bir namespace uchun bitta yozuv.
 */
async function persistSessionsToDB(): Promise<void> {
    try {
        const stores = getGlobalStores();
        const now = Date.now();

        for (const [namespace, store] of stores.entries()) {
            // Faqat amal qilayotgan sessiyalarni saqlash
            const validEntries: Record<string, SessionEntry<unknown>> = {};
            for (const [key, entry] of store.entries()) {
                if (entry.expiresAt > now) {
                    validEntries[key] = entry;
                }
            }

            const dedupeKey = `session_store_${namespace}`;
            const payload = JSON.stringify(validEntries);

            // BotEvent jadvaliga upsert (dedupeKey unique)
            await prisma.botEvent.upsert({
                where: { dedupeKey },
                update: {
                    message: payload,
                    updatedAt: new Date(),
                },
                create: {
                    sourceBot: 'system',
                    eventType: 'session.persist',
                    title: `Session Store: ${namespace}`,
                    message: payload,
                    dedupeKey,
                    severity: 'info',
                },
            });
        }
    } catch (err) {
        console.error('[SessionStore] DB persist xatosi:', err);
    }
}

/**
 * Server boshlanganda DB dan sessiyalarni tiklash
 */
export async function restoreSessionsFromDB(): Promise<void> {
    try {
        const events = await prisma.botEvent.findMany({
            where: {
                sourceBot: 'system',
                eventType: 'session.persist',
            },
        });

        const _stores = getGlobalStores();
        const now = Date.now();

        for (const event of events) {
            const namespace = (event.dedupeKey ?? '').replace('session_store_', '');
            if (!namespace) continue;

            const store = getOrCreateStore(namespace);

            try {
                const entries = JSON.parse(event.message ?? '{}') as Record<string, SessionEntry<unknown>>;
                for (const [key, entry] of Object.entries(entries)) {
                    if (entry.expiresAt > now) {
                        store.set(key, entry);
                    }
                }
                console.log(`[SessionStore] ${namespace}: ${store.size} ta sessiya tiklandi`);
            } catch {
                // JSON parse xatosi — o'tkazib yuborish
            }
        }
    } catch (err) {
        console.error('[SessionStore] DB restore xatosi:', err);
    }
}

/* ─── Auto-Persist (har 5 daqiqada) ──────────────────────────── */

export function startAutoPersist(): void {
    if (globalForTelegramSessionStore.__telegramSessionPersistTimer) return;

    globalForTelegramSessionStore.__telegramSessionPersistTimer = setInterval(() => {
        persistSessionsToDB().catch(() => {});
    }, 5 * 60 * 1000); // 5 daqiqada bir
}

export function stopAutoPersist(): void {
    const timer = globalForTelegramSessionStore.__telegramSessionPersistTimer;
    if (timer) {
        clearInterval(timer);
        globalForTelegramSessionStore.__telegramSessionPersistTimer = undefined;
    }
}

// Dev/production da auto-persist boshlash (test muhitida timer leak oldini olish)
if (typeof globalThis !== 'undefined' && process.env.NODE_ENV !== 'test') {
    startAutoPersist();
}

/* ─── Factory Function ───────────────────────────────────────── */

export function createTelegramSessionStore<T>(
    namespace: string,
    options: SessionStoreOptions = {},
): TelegramSessionStore<T> {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const refreshOnRead = options.refreshOnRead ?? true;
    const store = getOrCreateStore(namespace);

    return {
        get(key: string) {
            touchStore(namespace, store);
            const entry = store.get(key) as SessionEntry<T> | undefined;
            if (!entry) return undefined;

            if (entry.expiresAt <= Date.now()) {
                store.delete(key);
                return undefined;
            }

            if (refreshOnRead) {
                entry.expiresAt = nextExpiry(ttlMs);
            }

            return entry.value;
        },
        set(key: string, value: T) {
            touchStore(namespace, store);
            store.set(key, {
                value,
                expiresAt: nextExpiry(ttlMs),
            });
            return this;
        },
        delete(key: string) {
            touchStore(namespace, store);
            return store.delete(key);
        },
        has(key: string) {
            touchStore(namespace, store);
            const entry = store.get(key);
            if (!entry) return false;

            if (entry.expiresAt <= Date.now()) {
                store.delete(key);
                return false;
            }

            return true;
        },
        clear() {
            store.clear();
            const counters = getGlobalOpCounters();
            counters.set(namespace, 0);
        },
    };
}
