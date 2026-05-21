/**
 * @jest-environment node
 *
 * Markaziy rateLimit helper uchun unit testlar.
 * `next/server` Node Web API'larga muhtoj (Request/Response global), shu sabab
 * `jest-environment-node` ishlatamiz (default `jsdom` o'rniga).
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { rateLimit, extractClientIp, setRateLimitStore, type RateLimitStore } from '../rateLimit';

function makeReq(headers: Record<string, string> = {}): Request {
    return new Request('http://localhost/test', {
        method: 'POST',
        headers,
    });
}

describe('rateLimit', () => {
    beforeEach(() => {
        // Har test boshida toza in-memory store
        const fresh = new (class implements RateLimitStore {
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
        })();
        setRateLimitStore(fresh);
    });

    describe('extractClientIp', () => {
        it('cf-connecting-ip dan oladi', () => {
            const req = makeReq({ 'cf-connecting-ip': '1.2.3.4' });
            expect(extractClientIp(req)).toBe('1.2.3.4');
        });

        it('x-forwarded-for birinchi qiymatini oladi', () => {
            const req = makeReq({ 'x-forwarded-for': '10.0.0.1, 10.0.0.2' });
            expect(extractClientIp(req)).toBe('10.0.0.1');
        });

        it('x-real-ip fallback', () => {
            const req = makeReq({ 'x-real-ip': '192.168.1.1' });
            expect(extractClientIp(req)).toBe('192.168.1.1');
        });

        it('hech qanday header bo\'lmasa unknown', () => {
            const req = makeReq();
            expect(extractClientIp(req)).toBe('unknown');
        });
    });

    describe('rateLimit', () => {
        it('birinchi so\'rov ruxsat etiladi', async () => {
            const req = makeReq({ 'cf-connecting-ip': '1.1.1.1' });
            const res = await rateLimit(req, { bucket: 'test', limit: 3, windowMs: 60_000 });
            expect(res.ok).toBe(true);
            if (res.ok) {
                expect(res.remaining).toBe(2);
            }
        });

        it('limit ichida — ruxsat', async () => {
            const req = makeReq({ 'cf-connecting-ip': '2.2.2.2' });
            const a = await rateLimit(req, { bucket: 'test', limit: 3, windowMs: 60_000 });
            const b = await rateLimit(req, { bucket: 'test', limit: 3, windowMs: 60_000 });
            const c = await rateLimit(req, { bucket: 'test', limit: 3, windowMs: 60_000 });
            expect(a.ok && b.ok && c.ok).toBe(true);
        });

        it('limit oshganda — 429 qaytaradi', async () => {
            const req = makeReq({ 'cf-connecting-ip': '3.3.3.3' });
            await rateLimit(req, { bucket: 'test', limit: 2, windowMs: 60_000 });
            await rateLimit(req, { bucket: 'test', limit: 2, windowMs: 60_000 });
            const blocked = await rateLimit(req, { bucket: 'test', limit: 2, windowMs: 60_000 });
            expect(blocked.ok).toBe(false);
            if (!blocked.ok) {
                expect(blocked.response.status).toBe(429);
                expect(blocked.retryAfterSec).toBeGreaterThan(0);
                expect(blocked.response.headers.get('Retry-After')).toBeTruthy();
            }
        });

        it('turli IP — alohida hisoblanadi', async () => {
            const a = makeReq({ 'cf-connecting-ip': '4.4.4.4' });
            const b = makeReq({ 'cf-connecting-ip': '5.5.5.5' });
            await rateLimit(a, { bucket: 'test', limit: 1, windowMs: 60_000 });
            const limitedA = await rateLimit(a, { bucket: 'test', limit: 1, windowMs: 60_000 });
            const allowedB = await rateLimit(b, { bucket: 'test', limit: 1, windowMs: 60_000 });
            expect(limitedA.ok).toBe(false);
            expect(allowedB.ok).toBe(true);
        });

        it('turli bucket — alohida hisoblanadi', async () => {
            const req = makeReq({ 'cf-connecting-ip': '6.6.6.6' });
            await rateLimit(req, { bucket: 'login', limit: 1, windowMs: 60_000 });
            const blocked = await rateLimit(req, { bucket: 'login', limit: 1, windowMs: 60_000 });
            const allowedOther = await rateLimit(req, { bucket: 'otp', limit: 1, windowMs: 60_000 });
            expect(blocked.ok).toBe(false);
            expect(allowedOther.ok).toBe(true);
        });

        it('userKey ishlatilsa IP ga qaramaydi', async () => {
            const reqA = makeReq({ 'cf-connecting-ip': '7.7.7.7' });
            const reqB = makeReq({ 'cf-connecting-ip': '8.8.8.8' });
            await rateLimit(reqA, { bucket: 'profile', limit: 1, windowMs: 60_000, userKey: 'u42' });
            const blocked = await rateLimit(reqB, { bucket: 'profile', limit: 1, windowMs: 60_000, userKey: 'u42' });
            expect(blocked.ok).toBe(false);
        });
    });
});
