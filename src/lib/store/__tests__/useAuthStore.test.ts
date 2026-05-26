import { act } from '@testing-library/react';
import type { Session } from 'next-auth';
import type { User } from '@/lib/store/useAuthStore';

// Mock next-auth/react before importing the store
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();

jest.mock('next-auth/react', () => ({
    signIn: (...args: unknown[]) => mockSignIn(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
    getSession: () => mockGetSession(),
}));

// Import store and helpers AFTER the mock is set up
import { useAuthStore, sessionUserToStoreUser } from '@/lib/store/useAuthStore';

const store = () => useAuthStore.getState();

const testUser: User = {
    id: 1,
    name: 'Test User',
    phone: '+998901234567',
    role: 'user',
    email: 'test@example.com',
};

beforeEach(() => {
    act(() =>
        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            orders: [],
        })
    );
    jest.clearAllMocks();
});

describe('useAuthStore', () => {
    describe('initial state', () => {
        it('has no user', () => {
            expect(store().user).toBeNull();
        });

        it('is not authenticated', () => {
            expect(store().isAuthenticated).toBe(false);
        });

        it('has empty orders', () => {
            expect(store().orders).toEqual([]);
        });
    });

    describe('state shape', () => {
        it('exposes all expected keys', () => {
            const state = store();
            expect(state).toHaveProperty('user');
            expect(state).toHaveProperty('isAuthenticated');
            expect(state).toHaveProperty('orders');
            expect(state).toHaveProperty('login');
            expect(state).toHaveProperty('register');
            expect(state).toHaveProperty('logout');
            expect(state).toHaveProperty('setSessionUser');
            expect(state).toHaveProperty('addOrder');
            expect(state).toHaveProperty('updateUser');
        });
    });

    describe('setSessionUser', () => {
        it('sets user and marks authenticated', () => {
            act(() => store().setSessionUser(testUser));
            expect(store().user).toEqual(testUser);
            expect(store().isAuthenticated).toBe(true);
        });

        it('clears user and marks unauthenticated when null', () => {
            act(() => store().setSessionUser(testUser));
            act(() => store().setSessionUser(null));
            expect(store().user).toBeNull();
            expect(store().isAuthenticated).toBe(false);
        });
    });

    describe('updateUser', () => {
        it('merges partial data into existing user', () => {
            act(() => store().setSessionUser(testUser));
            act(() => store().updateUser({ name: 'Updated' }));
            expect(store().user?.name).toBe('Updated');
            expect(store().user?.phone).toBe(testUser.phone);
        });

        it('does nothing if user is null', () => {
            act(() => store().updateUser({ name: 'Nope' }));
            expect(store().user).toBeNull();
        });
    });

    describe('addOrder', () => {
        it('prepends a new order with generated id and date', () => {
            act(() =>
                store().addOrder({
                    items: [
                        { id: 'i1', productId: 1, name: 'Item', price: 50, quantity: 1, image: '/img.png' },
                    ],
                    totalAmount: 50,
                    status: 'pending',
                    paymentMethod: 'cash',
                })
            );
            const orders = store().orders;
            expect(orders).toHaveLength(1);
            expect(orders[0].id).toMatch(/^ORD-\d{4}$/);
            expect(orders[0].date).toBeTruthy();
        });

        it('prepends newer orders before older ones', () => {
            act(() =>
                store().addOrder({
                    items: [],
                    totalAmount: 10,
                    status: 'pending',
                    paymentMethod: 'cash',
                })
            );
            act(() =>
                store().addOrder({
                    items: [],
                    totalAmount: 20,
                    status: 'pending',
                    paymentMethod: 'card',
                })
            );
            const orders = store().orders;
            expect(orders).toHaveLength(2);
            expect(orders[0].totalAmount).toBe(20);
            expect(orders[1].totalAmount).toBe(10);
        });
    });

    describe('logout', () => {
        it('clears user and calls signOut', () => {
            act(() => store().setSessionUser(testUser));
            act(() => store().logout());
            expect(store().user).toBeNull();
            expect(store().isAuthenticated).toBe(false);
            expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
        });
    });

    describe('login', () => {
        it('returns success and sets user on valid credentials', async () => {
            mockSignIn.mockResolvedValue({ error: null });
            mockGetSession.mockResolvedValue({
                user: { id: '1', name: 'A', phone: '+998', role: 'user', email: null },
            });

            let result!: { success: boolean; error?: string };
            await act(async () => {
                result = await store().login('+998 90 123', 'pass');
            });

            expect(result.success).toBe(true);
            expect(store().isAuthenticated).toBe(true);
            expect(store().user?.name).toBe('A');
            expect(mockSignIn).toHaveBeenCalledWith('credentials', {
                phone: '+99890123',
                password: 'pass',
                redirect: false,
            });
        });

        it('returns error when signIn fails', async () => {
            mockSignIn.mockResolvedValue({ error: 'bad' });

            let result!: { success: boolean; error?: string };
            await act(async () => {
                result = await store().login('phone', 'wrong');
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('returns error when session has no user', async () => {
            mockSignIn.mockResolvedValue({ error: null });
            mockGetSession.mockResolvedValue({ user: null });

            let result!: { success: boolean; error?: string };
            await act(async () => {
                result = await store().login('phone', 'pass');
            });

            expect(result.success).toBe(false);
        });

        it('returns error on network failure', async () => {
            mockSignIn.mockRejectedValue(new Error('network'));

            let result!: { success: boolean; error?: string };
            await act(async () => {
                result = await store().login('phone', 'pass');
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('register', () => {
        it('returns success on valid registration', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ id: 1 }),
            });
            mockSignIn.mockResolvedValue({ error: null });
            mockGetSession.mockResolvedValue({
                user: { id: '1', name: 'New', phone: '+998', role: 'user', email: null },
            });

            let result!: { success: boolean; error?: string };
            await act(async () => {
                result = await store().register('New', '+998 90 123', 'pass123');
            });

            expect(result.success).toBe(true);
            expect(store().isAuthenticated).toBe(true);
        });

        it('sends referralCode when provided', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ id: 1 }),
            });
            mockSignIn.mockResolvedValue({ error: null });
            mockGetSession.mockResolvedValue({
                user: { id: '1', name: 'X', phone: '+998', role: 'user', email: null },
            });

            await act(async () => {
                await store().register('X', '+998', 'pass', 'REF123');
            });

            const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
            const body = JSON.parse(fetchCall[1].body);
            expect(body.referralCode).toBe('REF123');
        });

        it('returns error when API responds with error', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                json: async () => ({ error: 'Phone taken' }),
            });

            let result!: { success: boolean; error?: string };
            await act(async () => {
                result = await store().register('A', '+998', 'pass');
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Phone taken');
        });

        it('returns error when signIn after register fails', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ id: 1 }),
            });
            mockSignIn.mockResolvedValue({ error: 'auth failed' });

            let result!: { success: boolean; error?: string };
            await act(async () => {
                result = await store().register('A', '+998', 'pass');
            });

            expect(result.success).toBe(false);
        });

        it('returns error on network failure', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('network'));

            let result!: { success: boolean; error?: string };
            await act(async () => {
                result = await store().register('A', '+998', 'pass');
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('sessionUserToStoreUser', () => {
        it('converts a valid session user', () => {
            const result = sessionUserToStoreUser({
                id: '1',
                name: 'John',
                phone: '+998901234567',
                role: 'admin',
                email: 'john@test.com',
            });
            expect(result).toEqual({
                id: '1',
                name: 'John',
                phone: '+998901234567',
                role: 'admin',
                email: 'john@test.com',
            });
        });

        it('defaults role to user for non-admin', () => {
            const result = sessionUserToStoreUser({
                id: '1',
                name: 'A',
                phone: '+998',
                role: 'user',
            });
            expect(result?.role).toBe('user');
        });

        it('returns null when id is missing', () => {
            expect(
                sessionUserToStoreUser({ name: 'A', phone: '+998' } as Session['user']),
            ).toBeNull();
        });

        it('returns null when phone is missing', () => {
            expect(
                sessionUserToStoreUser({ id: '1', name: 'A' } as Session['user']),
            ).toBeNull();
        });

        it('returns null for null/undefined input', () => {
            expect(sessionUserToStoreUser(null)).toBeNull();
            expect(sessionUserToStoreUser(undefined)).toBeNull();
        });
    });
});
