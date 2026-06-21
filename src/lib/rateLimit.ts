/**
 * In-memory sliding-window rate limiter.
 *
 * Usage:
 * ```ts
 * import { rateLimit, getRateLimitResponse } from '@/lib/rateLimit';
 *
 * export async function POST(req: NextRequest) {
 *     const ip = req.headers.get('x-forwarded-for') ?? req.ip ?? 'unknown';
 *     const limiter = rateLimit({ windowMs: 60_000, max: 5 });
 *     const result = limiter.check(ip);
 *     if (!result.allowed) {
 *         return getRateLimitResponse(result.retryAfterMs);
 *     }
 *     // ... handler logic
 * }
 * ```
 */
import { NextResponse } from 'next/server';

// ── Types ─────────────────────────────────────────────────────────────────

interface RateLimitEntry {
    /** Timestamps of requests within the window */
    timestamps: number[];
}

interface RateLimitConfig {
    /** Time window in milliseconds */
    windowMs: number;
    /** Maximum number of requests per window */
    max: number;
}

interface RateLimitResult {
    allowed: boolean;
    /** Remaining requests in the current window */
    remaining: number;
    /** Milliseconds until the window resets (only set when blocked) */
    retryAfterMs?: number;
}

interface RateLimiter {
    check: (key: string) => RateLimitResult;
    reset: (key: string) => void;
}

// ── Cleanup ───────────────────────────────────────────────────────────────

const stores = new Set<Map<string, RateLimitEntry>>();

// Periodically clean expired entries (every 60 seconds)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
    if (cleanupInterval) return;
    cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const store of stores) {
            for (const [key, entry] of store) {
                // Remove entries with no recent timestamps
                if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < now - 300_000) {
                    store.delete(key);
                }
            }
        }
    }, 60_000);

    // Don't prevent Node.js from exiting
    if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
        cleanupInterval.unref();
    }
}

// ── Factory ───────────────────────────────────────────────────────────────

/**
 * Create a rate limiter with the given configuration.
 * Each call creates a separate in-memory store.
 */
export function rateLimit(config: RateLimitConfig): RateLimiter {
    const { windowMs, max } = config;
    const store = new Map<string, RateLimitEntry>();
    stores.add(store);
    ensureCleanup();

    return {
        check(key: string): RateLimitResult {
            const now = Date.now();
            const entry = store.get(key) ?? { timestamps: [] };

            // Remove timestamps outside the window
            entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);

            if (entry.timestamps.length >= max) {
                // Rate limited
                const oldestInWindow = entry.timestamps[0];
                const retryAfterMs = windowMs - (now - oldestInWindow);
                store.set(key, entry);
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfterMs: Math.max(retryAfterMs, 0),
                };
            }

            // Allow request
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

// ── Pre-configured limiters ───────────────────────────────────────────────

/** Login/auth endpoints: 5 attempts per minute */
export const authLimiter = rateLimit({ windowMs: 60_000, max: 5 });

/** OTP send: 3 attempts per minute */
export const otpLimiter = rateLimit({ windowMs: 60_000, max: 3 });

/** Scrape/AI endpoints: 10 requests per minute */
export const aiLimiter = rateLimit({ windowMs: 60_000, max: 10 });

/** General API: 60 requests per minute */
export const generalLimiter = rateLimit({ windowMs: 60_000, max: 60 });

// ── Response helper ───────────────────────────────────────────────────────

/**
 * Generate a 429 Too Many Requests response with Retry-After header.
 */
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

/**
 * Extract client IP from request headers.
 */
export function getClientIp(req: Request): string {
    const headers = req.headers;
    return (
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        headers.get('x-real-ip') ??
        'unknown'
    );
}
