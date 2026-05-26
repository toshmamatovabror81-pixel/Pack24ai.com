import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toNumber, type MoneyInput } from '@/lib/money';

export interface OrderItem {
    id: string;
    productId: number;
    name: string;
    price: number;
    quantity: number;
    image: string;
}

export interface AdminOrder {
    id: string;
    customer: {
        name: string;
        phone: string;
        address: string;
    };
    items: OrderItem[];
    totalAmount: number;
    status: 'new' | 'accepted' | 'shipping' | 'completed' | 'cancelled';
    source: 'website' | 'telegram' | 'app';
    date: string;
    comment?: string;
}

interface AdminStore {
    allOrders: AdminOrder[];

    // Actions
    addOrder: (order: Omit<AdminOrder, 'date' | 'status' | 'source' | 'totalAmount'> & {
        status?: string;
        source?: string;
        totalAmount: MoneyInput;
    }) => void;
    updateOrderStatus: (id: string, status: AdminOrder['status']) => void;
}

export const useAdminStore = create<AdminStore>()(
    persist(
        (set) => ({
            allOrders: [
                // Mock Initial Data (so the list isn't empty initially)
                {
                    id: '10045',
                    customer: { name: 'Alisher Otaboyev', phone: '+998 90 123 45 67', address: 'Toshkent sh, Chilonzor 19' },
                    totalAmount: 1250000,
                    status: 'new',
                    source: 'telegram',
                    date: new Date(Date.now() - 3600000).toISOString(),
                    items: []
                }
            ],

            addOrder: (order) => set((state) => ({
                allOrders: [
                    {
                        ...order,
                        totalAmount: toNumber(order.totalAmount),
                        id: order.id || Math.floor(Math.random() * 100000).toString(),
                        status: (order.status as AdminOrder['status']) || 'new',
                        source: (order.source as AdminOrder['source']) || 'website',
                        date: new Date().toISOString()
                    },
                    ...state.allOrders
                ]
            })),

            updateOrderStatus: (id, status) => set((state) => ({
                allOrders: state.allOrders.map(order =>
                    order.id === id ? { ...order, status } : order
                )
            }))
        }),
        {
            name: 'pack24-admin-storage',
            storage: createJSONStorage(() => localStorage),
            skipHydration: true,
        }
    )
);
