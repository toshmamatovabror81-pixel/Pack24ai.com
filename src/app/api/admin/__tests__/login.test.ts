/**
 * @jest-environment node
 */

/**
 * Admin Login API Route Tests
 * POST /api/admin/login
 */

// Mock env before imports
const MOCK_ENV = {
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'SuperSecretPass123!',
  ADMIN_SECRET: 'test-admin-secret-32-chars-long-xx',
};

const originalEnv = process.env;
beforeAll(() => {
  process.env = { ...originalEnv, ...MOCK_ENV };
});
afterAll(() => {
  process.env = originalEnv;
});

jest.mock('@/lib/rateLimit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ ok: true }),
}));

import { NextRequest } from 'next/server';
import { POST } from '../login/route';
import { ADMIN_AUTH_COOKIE } from '@/lib/adminAuthShared';

function makeAdminRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('200 - togri login va parol bilan muvaffaqiyatli kirish', async () => {
    const res = await POST(makeAdminRequest({
      username: 'admin',
      password: 'SuperSecretPass123!',
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    // Cookie ornatilganini tekshirish
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain(ADMIN_AUTH_COOKIE);
    expect(setCookie).toContain('HttpOnly');
  });

  it('401 - xato parol bilan rad etilishi', async () => {
    const res = await POST(makeAdminRequest({
      username: 'admin',
      password: 'wrong-password-here!',
    }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('401 - xato foydalanuvchi nomi bilan rad etilishi', async () => {
    const res = await POST(makeAdminRequest({
      username: 'hacker',
      password: 'SuperSecretPass123!',
    }));
    expect(res.status).toBe(401);
  });

  it('401 - bosh body bilan rad etilishi', async () => {
    const res = await POST(makeAdminRequest({}));
    expect(res.status).toBe(401);
  });

  it('401 - faqat username bilan rad etilishi', async () => {
    const res = await POST(makeAdminRequest({ username: 'admin' }));
    expect(res.status).toBe(401);
  });

  it('500 - env ozgaruvchilari yoq bolsa server xatosi', async () => {
    const saved = process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_USERNAME;

    const res = await POST(makeAdminRequest({
      username: 'admin',
      password: 'SuperSecretPass123!',
    }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('konfiguratsiya');

    process.env.ADMIN_USERNAME = saved;
  });

  it('429 - rate limit oshganda rad etilishi', async () => {
    const { rateLimit } = require('@/lib/rateLimit');
    (rateLimit as jest.Mock).mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
      }),
    });

    const res = await POST(makeAdminRequest({
      username: 'admin',
      password: 'SuperSecretPass123!',
    }));
    expect(res.status).toBe(429);
  });
});
