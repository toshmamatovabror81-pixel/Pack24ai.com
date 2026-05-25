/** @jest-environment node */

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { ADMIN_AUTH_COOKIE } from '@/lib/adminAuthShared';
import { middleware } from '@/middleware';

const ADMIN_SECRET = 'test-admin-secret-for-csrf';

function createAdminToken(timestamp = Date.now()): string {
    const hmac = crypto
        .createHmac('sha256', ADMIN_SECRET)
        .update(`admin_${timestamp}`)
        .digest('hex');

    return `admin_${timestamp}_${hmac}`;
}

function makePost(path: string, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest(`http://localhost${path}`, {
        method: 'POST',
        headers,
    });
}

describe('middleware CSRF protection', () => {
    beforeEach(() => {
        process.env.ADMIN_SECRET = ADMIN_SECRET;
        delete process.env.ALLOWED_ORIGINS;
        delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('rad etadi: spoofable x-pack24-source header CSRF bypass qilmaydi', async () => {
        const response = await middleware(makePost('/api/public', {
            'x-pack24-source': 'app',
        }));

        expect(response.status).toBe(403);
    });

    it('rad etadi: noto\'g\'ri x-admin-token CSRF bypass qilmaydi', async () => {
        const response = await middleware(makePost('/api/public', {
            'x-admin-token': 'garbage',
        }));

        expect(response.status).toBe(403);
    });

    it('valid admin cookie bilan CSRF tekshiruvidan o\'tkazadi', async () => {
        const token = createAdminToken();
        const response = await middleware(makePost('/api/public', {
            cookie: `${ADMIN_AUTH_COOKIE}=${token}`,
        }));

        expect(response.status).not.toBe(403);
    });

    it('valid origin bilan CSRF tekshiruvidan o\'tkazadi', async () => {
        const response = await middleware(makePost('/api/public', {
            origin: 'http://localhost:3000',
        }));

        expect(response.status).not.toBe(403);
    });

    it('Bearer token bilan CSRF tekshiruvidan o\'tkazadi', async () => {
        const response = await middleware(makePost('/api/public', {
            authorization: 'Bearer driver-token',
        }));

        expect(response.status).not.toBe(403);
    });

    it('/api/bot-events ni /api/bot/ exemption bilan chalkashtirmaydi', async () => {
        const response = await middleware(makePost('/api/bot-events'));

        expect(response.status).toBe(403);
    });
});
