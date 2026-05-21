/**
 * Oddiy in-memory route cache (dev va bir-instance prod uchun).
 * Neon DB tarmoq kechikishi tufayli takroriy admin so'rovlarini yengillashtiradi.
 *
 * Multi-instance prod uchun Redis/Upstash kerak — keyin `RateLimitStore` kabi almashtiriladi.
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export function getRouteCache<T>(key: string): T | null {
    const hit = store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
        store.delete(key);
        return null;
    }
    return hit.value as T;
}

export function setRouteCache<T>(key: string, value: T, ttlMs: number): void {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Dev'da uzoqroq TTL — kompilatsiya vaqtida kamroq DB yuk */
export function routeCacheTtl(defaultMs: number): number {
    if (process.env.NODE_ENV === 'development') {
        return Math.max(defaultMs, defaultMs * 2);
    }
    return defaultMs;
}
