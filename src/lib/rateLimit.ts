/**
 * Markaziy rate limit helper.
 *
 * In-memory implementatsiya (Map + epoch reset). Multi-instance prod uchun
 * Redis/Upstash bilan almashtirish oson — `RateLimitStore` interfeysi orqali.
 *
 * Asosiy ishlatilish:
 *
 *   const rl = await rateLimit(request, { bucket: 'admin-login', limit: 5, windowMs: 60_000 });
 *   if (!rl.ok) return rl.response;
 *
 * `bucket` har bir route uchun alohida bo'lishi kerak (login, otp, ai, ...).
 * Klient kaliti — IP + bucket. Authenticated route'lar `userKey` opsiyasini berishi mumkin.
 */
import { NextResponse } from 'next/server';

export interface RateLimitOptions {
    /** Bucket nomi — har xil sirt uchun alohida hisoblagich. */
    bucket: string;
    /** Window ichida maksimal so'rovlar. */
    limit: number;
    /** Window davomiyligi (ms). */
    windowMs: number;
    /** Authenticated foydalanuvchi (userId, driverId) uchun alohida kalit. IP o'rniga shu ishlatiladi. */
    userKey?: string;
}

export interface RateLimitOk {
    ok: true;
    remaining: number;
    resetAt: number;
}

export interface RateLimitBlocked {
    ok: false;
    response: NextResponse;
    retryAfterSec: number;
}

export type RateLimitResult = RateLimitOk | RateLimitBlocked;

interface Counter {
    count: number;
    resetAt: number;
}

export interface RateLimitStore {
    incr(key: string, windowMs: number, now: number): Promise<Counter>;
}

class InMemoryStore implements RateLimitStore {
    private map = new Map<string, Counter>();
    private lastSweep = 0;

    async incr(key: string, windowMs: number, now: number): Promise<Counter> {
        const existing = this.map.get(key);

        if (!existing || existing.resetAt <= now) {
            const next = { count: 1, resetAt: now + windowMs };
            this.map.set(key, next);
            this.maybeSweep(now);
            return next;
        }

        existing.count += 1;
        return existing;
    }

    private maybeSweep(now: number) {
        if (now - this.lastSweep < 30_000) return;
        this.lastSweep = now;
        for (const [k, v] of this.map) {
            if (v.resetAt <= now) this.map.delete(k);
        }
    }
}

let store: RateLimitStore = new InMemoryStore();

export function setRateLimitStore(custom: RateLimitStore) {
    store = custom;
}

/**
 * IP manzilni xavfsiz tarzda aniqlash. Proxy/CDN ortida ham ishlaydi.
 */
export function extractClientIp(req: Request): string {
    const headers = req.headers;
    const cf = headers.get('cf-connecting-ip');
    if (cf) return cf.trim();
    const xff = headers.get('x-forwarded-for');
    if (xff) {
        const first = xff.split(',')[0]?.trim();
        if (first) return first;
    }
    const real = headers.get('x-real-ip');
    if (real) return real.trim();
    return 'unknown';
}

export async function rateLimit(
    request: Request,
    opts: RateLimitOptions
): Promise<RateLimitResult> {
    const now = Date.now();
    const subject = opts.userKey
        ? `user:${opts.userKey}`
        : `ip:${extractClientIp(request)}`;
    const key = `${opts.bucket}:${subject}`;

    const counter = await store.incr(key, opts.windowMs, now);

    if (counter.count > opts.limit) {
        const retryAfterSec = Math.max(1, Math.ceil((counter.resetAt - now) / 1000));
        const response = NextResponse.json(
            {
                error: "Juda ko'p so'rov. Birozdan keyin qayta urinib ko'ring.",
                code: 'RATE_LIMITED',
                retryAfterSec,
            },
            { status: 429 }
        );
        response.headers.set('Retry-After', String(retryAfterSec));
        response.headers.set('X-RateLimit-Limit', String(opts.limit));
        response.headers.set('X-RateLimit-Remaining', '0');
        response.headers.set('X-RateLimit-Reset', String(Math.ceil(counter.resetAt / 1000)));
        return { ok: false, response, retryAfterSec };
    }

    return {
        ok: true,
        remaining: Math.max(0, opts.limit - counter.count),
        resetAt: counter.resetAt,
    };
}
