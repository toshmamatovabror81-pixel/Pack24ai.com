/** @jest-environment node */

const getServerSessionMock = jest.fn();
const findUniqueMock = jest.fn();
const updateMock = jest.fn();

jest.mock('next-auth', () => ({
    __esModule: true,
    default: jest.fn(),
    getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: (...args: unknown[]) => findUniqueMock(...args),
            update: (...args: unknown[]) => updateMock(...args),
        },
    },
}));

import { GET } from '@/app/api/referral/route';

describe('GET /api/referral', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('sessiya bo\'lmasa 401 qaytaradi', async () => {
        getServerSessionMock.mockResolvedValue(null);

        const response = await GET();

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({ error: 'Tizimga kirishingiz kerak', code: 'AUTH_REQUIRED' });
    });

    it('session user id bilan referral ma\'lumotini qaytaradi', async () => {
        getServerSessionMock.mockResolvedValue({
            user: { id: '7', phone: '+998901234567', role: 'user' },
        });
        findUniqueMock.mockResolvedValue({
            id: 7,
            ecoPoints: 18,
            referralCode: 'PACK24-ABC123',
            referrals: [
                { id: 1, name: 'Ali', createdAt: new Date('2026-04-20'), ecoPoints: 0, referrals: [] },
                { id: 2, name: 'Vali', createdAt: new Date('2026-04-21'), ecoPoints: 0, referrals: [] },
            ],
        });

        const response = await GET();
        const payload = await response.json();

        expect(findUniqueMock).toHaveBeenCalledWith({
            where: { id: 7 },
            include: {
                referrals: {
                    select: {
                        id: true,
                        name: true,
                        createdAt: true,
                        ecoPoints: true,
                        referrals: {
                            select: {
                                id: true,
                                name: true,
                                createdAt: true,
                                ecoPoints: true,
                                referrals: {
                                    select: { id: true, name: true, createdAt: true, ecoPoints: true },
                                },
                            },
                        },
                    },
                },
            },
        });
        expect(payload.referralCode).toBe('PACK24-ABC123');
        expect(payload.totalBonusPoints).toBe(1000); // 2 × 500 = 1000 (level1)
        expect(updateMock).not.toHaveBeenCalled();
    });
});
