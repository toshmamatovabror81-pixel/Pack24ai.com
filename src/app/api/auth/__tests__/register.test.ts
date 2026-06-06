/**
 * @jest-environment node
 */

/**
 * Auth Register API Route Tests
 * POST /api/auth/register
 */

// Mock dependencies before imports
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/userAuth', () => ({
  hashPassword: jest.fn().mockResolvedValue('$2b$10$hashed'),
  isValidPhone: jest.fn(),
  normalizePhone: jest.fn(),
}));

jest.mock('@/lib/referral', () => ({
  generateReferralCode: jest.fn().mockReturnValue('REF123'),
  REFERRAL_SIGNUP_BONUS: 100,
}));

import { POST } from '../register/route';
import { prisma } from '@/lib/prisma';
import { isValidPhone, normalizePhone } from '@/lib/userAuth';

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (normalizePhone as jest.Mock).mockImplementation((p: string) => p.replace(/[\s-]/g, ''));
    (isValidPhone as jest.Mock).mockReturnValue(true);
  });

  it('400 - ism, telefon yoki parol kiritilmasa', async () => {
    const res = await POST(makeRequest({ name: 'Test' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('shart');
  });

  it('400 - ism 2 ta belgidan kam bolsa', async () => {
    const res = await POST(makeRequest({ name: 'A', phone: '+998901234567', password: '123456' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('2 ta');
  });

  it('400 - telefon formati xato bolsa', async () => {
    (isValidPhone as jest.Mock).mockReturnValue(false);

    const res = await POST(makeRequest({ name: 'Test User', phone: '123', password: '123456' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Telefon');
  });

  it('400 - parol 6 ta belgidan kam bolsa', async () => {
    const res = await POST(makeRequest({ name: 'Test User', phone: '+998901234567', password: '12345' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('6 ta');
  });

  it('409 - telefon allaqachon royxatdan otgan bolsa', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, phone: '+998901234567' });

    const res = await POST(makeRequest({ name: 'Test User', phone: '+998901234567', password: '123456' }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('allaqachon');
  });

  it('201 - muvaffaqiyatli royxatdan otish', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const createdUser = {
      id: 1, name: 'Test User', phone: '+998901234567',
      passwordHash: '$2b$10$hashed', referralCode: 'REF123',
      role: 'user', isActive: true,
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: Function) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue(createdUser),
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };
      return cb(tx);
    });

    const res = await POST(makeRequest({ name: 'Test User', phone: '+998901234567', password: '123456' }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user).toBeDefined();
    // passwordHash qaytarilmasligi kerak
    expect(data.user.passwordHash).toBeUndefined();
  });

  it('400 - referal kodi topilmasa', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)  // phone tekshirish
      .mockResolvedValueOnce(null); // referralCode tekshirish

    const res = await POST(makeRequest({
      name: 'Test User',
      phone: '+998901234567',
      password: '123456',
      referralCode: 'INVALID',
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('topilmadi');
  });

  it('201 - togri referal kodi bilan royxatdan otish', async () => {
    const referrer = { id: 2 };
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)     // phone tekshirish
      .mockResolvedValueOnce(referrer); // referralCode tekshirish

    const createdUser = {
      id: 3, name: 'New User', phone: '+998901234567',
      passwordHash: '$2b$10$hashed', referralCode: 'NEW123',
      role: 'user', isActive: true, referredById: 2,
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: Function) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue(createdUser),
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };
      return cb(tx);
    });

    const res = await POST(makeRequest({
      name: 'New User',
      phone: '+998901234567',
      password: '123456',
      referralCode: 'REF002',
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
