'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DriverInfo {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    status: string;
    isOnline: boolean;
    vehicleInfo: string | null;
    acceptedMaterials: string[];
    point: { regionUz: string; cityUz: string | null } | null;
    supervisor: { name: string; phone: string } | null;
}

export interface DriverTask {
    id: number;
    name: string;
    phone: string;
    material: string | null;
    volume: number | null;
    address: string | null;
    pickupLat: number | null;
    pickupLng: number | null;
    status: string;
    assignedAt: string | null;
    createdAt: string;
    pickupType: string | null;
    tariffId: string | null;
    point: {
        regionUz: string;
        cityUz: string | null;
        phone: string | null;
        lat: number | null;
        lng: number | null;
        pricePerKg: number | null;
    } | null;
    collections: { actualWeight: number; totalAmount: number }[];
}

export interface DriverStats {
    today: {
        collections: number;
        totalWeight: number;
        totalAmount: number;
    };
    total: {
        collections: number;
        totalWeight: number;
        workDays: number;
    };
    weekly: number[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface DriverStoreState {
    // Auth
    token: string | null;
    driver: DriverInfo | null;

    // Data
    tasks: DriverTask[];
    stats: DriverStats | null;

    // UI state
    isLoadingTasks: boolean;
    isLoadingStats: boolean;
    tasksError: string | null;

    // Auth actions
    setAuth: (token: string, driver: DriverInfo) => void;
    logout: () => void;

    // API actions
    fetchTasks: (status?: 'active' | 'completed') => Promise<void>;
    fetchStats: () => Promise<void>;
    setOnline: (online: boolean) => Promise<void>;
    updateTaskStatus: (taskId: number, status: string) => Promise<boolean>;
}

export const useDriverStore = create<DriverStoreState>()(
    persist(
        (set, get) => ({
            // Initial state
            token: null,
            driver: null,
            tasks: [],
            stats: null,
            isLoadingTasks: false,
            isLoadingStats: false,
            tasksError: null,

            // ── Auth ───────────────────────────────────────────────
            setAuth: (token, driver) => set({ token, driver }),

            logout: () => set({
                token: null,
                driver: null,
                tasks: [],
                stats: null,
                tasksError: null,
            }),

            // ── Tasks ──────────────────────────────────────────────
            fetchTasks: async (status = 'active') => {
                const { token } = get();
                if (!token) return;

                set({ isLoadingTasks: true, tasksError: null });
                try {
                    const res = await fetch(`/api/driver/tasks?status=${status}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'x-pack24-source': 'app',
                        },
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data: DriverTask[] = await res.json();
                    set({ tasks: data });
                } catch (err) {
                    set({ tasksError: err instanceof Error ? err.message : 'Xatolik yuz berdi' });
                } finally {
                    set({ isLoadingTasks: false });
                }
            },

            // ── Stats ──────────────────────────────────────────────
            fetchStats: async () => {
                const { token } = get();
                if (!token) return;

                set({ isLoadingStats: true });
                try {
                    const res = await fetch('/api/driver/stats', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'x-pack24-source': 'app',
                        },
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data: DriverStats = await res.json();
                    set({ stats: data });
                } catch {
                    // stats error silent — dashboard ko'rsatadi
                } finally {
                    set({ isLoadingStats: false });
                }
            },

            // ── Online toggle ──────────────────────────────────────
            setOnline: async (online) => {
                const { token } = get();
                if (!token) return;
                try {
                    const res = await fetch('/api/driver/online', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'x-pack24-source': 'app',
                        },
                        body: JSON.stringify({ online }),
                    });
                    if (res.ok) {
                        set((s) => ({ driver: s.driver ? { ...s.driver, isOnline: online } : null }));
                    }
                } catch {
                    // silent
                }
            },

            // ── Task status update ─────────────────────────────────
            updateTaskStatus: async (taskId, status) => {
                const { token } = get();
                if (!token) return false;
                try {
                    const res = await fetch(`/api/driver/update-status`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'x-pack24-source': 'app',
                        },
                        body: JSON.stringify({ requestId: taskId, status }),
                    });
                    if (!res.ok) return false;
                    // Local state yangilash
                    set((s) => ({
                        tasks: s.tasks.map((t) =>
                            t.id === taskId ? { ...t, status } : t
                        ),
                    }));
                    return true;
                } catch {
                    return false;
                }
            },
        }),
        {
            name: 'pack24-driver',
            storage: createJSONStorage(() =>
                typeof window !== 'undefined' ? localStorage : {
                    getItem: () => null,
                    setItem: () => {},
                    removeItem: () => {},
                }
            ),
            // Faqat token va driver ma'lumotlarini saqlash
            partialize: (s) => ({ token: s.token, driver: s.driver }),
        }
    )
);
