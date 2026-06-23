import { NextResponse } from 'next/server';

// ── Types ─────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
    windowMs: number;
    max: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs?: number;
}

export interface RateLimiter {
    check: (key: string) => RateLimitResult;
    reset: (key: string) => void;
}

export interface RateLimitOptions {
    bucket: string;
    limit: number;
    windowMs: number;
    userKey?: string;
}

export type RateLimitResponse =
    | { ok: true; remaining: number }
    | { ok: false; response: NextResponse; retryAfterSec: number };

export interface RateLimitStore {
    incr: (key: string, windowMs: number, now: number) => Promise<{ count: number; resetAt: number }>;
}

// ── Store implementation ──────────────────────────────────────────────────

class InMemoryRateLimitStore implements RateLimitStore {
    private map = new Map<string, { count: number; resetAt: number }>();

    async incr(key: string, windowMs: number, now: number) {
        const existing = this.map.get(key);
        if (!existing || existing.resetAt <= now) {
            const next = { count: 1, resetAt: now + windowMs };
            this.map.set(key, next);
            return next;
        }
        existing.count += 1;
        return existing;
    }
}

let activeStore: RateLimitStore = new InMemoryRateLimitStore();

export function setRateLimitStore(store: RateLimitStore): void {
    activeStore = store;
}

// ── IP Helpers ────────────────────────────────────────────────────────────

export function extractClientIp(req: Request): string {
    const headers = req.headers;
    return (
        headers.get('cf-connecting-ip') ??
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        headers.get('x-real-ip') ??
        'unknown'
    );
}

export function getClientIp(req: Request): string {
    return extractClientIp(req);
}

// ── Factory Helper ────────────────────────────────────────────────────────

const factoryStores = new Set<Map<string, { timestamps: number[] }>>();
let factoryCleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureFactoryCleanup() {
    if (factoryCleanupInterval) return;
    factoryCleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const store of factoryStores) {
            for (const [key, entry] of store) {
                if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < now - 300_000) {
                    store.delete(key);
                }
            }
        }
    }, 60_000);

    if (factoryCleanupInterval && typeof factoryCleanupInterval === 'object' && 'unref' in factoryCleanupInterval) {
        factoryCleanupInterval.unref();
    }
}

function createFactoryLimiter(config: RateLimitConfig): RateLimiter {
    const { windowMs, max } = config;
    const store = new Map<string, { timestamps: number[] }>();
    factoryStores.add(store);
    ensureFactoryCleanup();

    return {
        check(key: string): RateLimitResult {
            const now = Date.now();
            const entry = store.get(key) ?? { timestamps: [] };

            entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);

            if (entry.timestamps.length >= max) {
                const oldestInWindow = entry.timestamps[0];
                const retryAfterMs = windowMs - (now - oldestInWindow);
                store.set(key, entry);
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfterMs: Math.max(retryAfterMs, 0),
                };
            }

            entry.timestamps.push(now);
            store.set(key, entry);
            return {
                allowed: true,
                remaining: max - entry.timestamps.length,
            };
        },

        reset(key: string): void {
            store.delete(key);
        },
    };
}

async function handleRequestRateLimit(req: Request, options: RateLimitOptions): Promise<RateLimitResponse> {
    const now = Date.now();
    const clientIp = extractClientIp(req);
    const key = options.userKey
        ? `rl:${options.bucket}:${options.userKey}`
        : `rl:${options.bucket}:${clientIp}`;

    const record = await activeStore.incr(key, options.windowMs, now);
    const remaining = Math.max(0, options.limit - record.count);

    if (record.count > options.limit) {
        const retryAfterMs = Math.max(0, record.resetAt - now);
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);

        const response = NextResponse.json(
            { error: "So'rovlar soni chegaradan oshdi. Keyinroq urinib ko'ring." },
            {
                status: 429,
                headers: {
                    'Retry-After': String(retryAfterSec),
                },
            }
        );

        return {
            ok: false,
            response,
            retryAfterSec,
        };
    }

    return {
        ok: true,
        remaining,
    };
}

// ── Overloaded rateLimit Function ──────────────────────────────────────────

export function rateLimit(config: RateLimitConfig): RateLimiter;
export function rateLimit(req: Request, options: RateLimitOptions): Promise<RateLimitResponse>;
export function rateLimit(
    configOrReq: RateLimitConfig | Request,
    options?: RateLimitOptions
): RateLimiter | Promise<RateLimitResponse> {
    if (options && configOrReq instanceof Request) {
        return handleRequestRateLimit(configOrReq, options);
    } else {
        const config = configOrReq as RateLimitConfig;
        return createFactoryLimiter(config);
    }
}

// ── Pre-configured limiters ───────────────────────────────────────────────

export const authLimiter = rateLimit({ windowMs: 60_000, max: 5 });
export const otpLimiter = rateLimit({ windowMs: 60_000, max: 3 });
export const aiLimiter = rateLimit({ windowMs: 60_000, max: 10 });
export const generalLimiter = rateLimit({ windowMs: 60_000, max: 60 });

// ── Response helper ───────────────────────────────────────────────────────

export function getRateLimitResponse(retryAfterMs?: number): NextResponse {
    const retryAfterSec = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 60;
    return NextResponse.json(
        { error: "So'rovlar soni chegaradan oshdi. Keyinroq urinib ko'ring." },
        {
            status: 429,
            headers: {
                'Retry-After': String(retryAfterSec),
            },
        },
    );
}
