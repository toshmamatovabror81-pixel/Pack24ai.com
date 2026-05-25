/** @jest-environment node */

import { setRateLimitStore, type RateLimitStore } from '@/lib/rateLimit';

jest.mock('next-auth', () => ({
    __esModule: true,
    default: jest.fn(() => jest.fn(async () => new Response('ok'))),
}));

jest.mock('@/lib/auth', () => ({
    authOptions: {},
}));

function resetRateLimitStore() {
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
}

function makeLoginRequest(): Request {
    return new Request('http://localhost/api/auth/callback/credentials', {
        method: 'POST',
        headers: {
            'cf-connecting-ip': '203.0.113.10',
        },
    });
}

describe('NextAuth credentials rate limiting', () => {
    beforeEach(() => {
        resetRateLimitStore();
    });

    it('11-POST urinishda 429 qaytaradi', async () => {
        const { POST } = await import('../[...nextauth]/route');

        for (let i = 0; i < 10; i += 1) {
            const response = await POST(makeLoginRequest() as never);
            expect(response.status).not.toBe(429);
        }

        const blocked = await POST(makeLoginRequest() as never);
        expect(blocked.status).toBe(429);
    });
});
