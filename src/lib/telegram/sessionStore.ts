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

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 12;
const CLEANUP_INTERVAL = 50;

const globalForTelegramSessionStore = globalThis as typeof globalThis & {
    __telegramSessionStores?: Map<string, Map<string, SessionEntry<unknown>>>;
    __telegramSessionStoreOps?: Map<string, number>;
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
