import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type BannerLocation = 'hero' | 'promo' | 'sidebar';
export type BannerGradient =
    | 'from-blue-600 to-indigo-700'
    | 'from-emerald-500 to-teal-600'
    | 'from-brand-navy to-[#163860]'
    | 'from-purple-600 to-violet-700'
    | 'from-orange-500 to-red-500'
    | 'from-emerald-600 to-teal-700'
    | 'from-rose-500 to-pink-600'
    | 'from-amber-500 to-orange-600';

export interface Banner {
    id: string;
    title: { uz: string; ru: string };
    subtitle: { uz: string; ru: string };
    badge?: { uz: string; ru: string };
    link: string;
    gradient: BannerGradient;
    emoji?: string;
    highlightText?: { uz: string; ru: string };
    location: BannerLocation;
    order: number;
    isActive: boolean;
    createdAt: string;
}

interface BannerState {
    banners: Banner[];
    addBanner: (banner: Omit<Banner, 'id' | 'createdAt'>) => void;
    updateBanner: (id: string, updates: Partial<Banner>) => void;
    deleteBanner: (id: string) => void;
    toggleActive: (id: string) => void;
    reorder: (id: string, direction: 'up' | 'down') => void;
}

const DEFAULT_BANNERS: Banner[] = [
    {
        id: 'b-1',
        title: { uz: "2026 yil yangi kolleksiya", ru: "Новая коллекция 2026" },
        subtitle: { uz: "Eng zamonaviy dizayndagi qadoqlar — optom narxlarda", ru: "Самые современные упаковки — по оптовым ценам" },
        badge: { uz: "Yangilik", ru: "Новинка" },
        highlightText: { uz: "kolleksiya", ru: "коллекция" },
        link: '/catalog?filter=new',
        gradient: 'from-blue-600 to-indigo-700',
        emoji: '📦',
        location: 'hero',
        order: 1,
        isActive: true,
        createdAt: '2026-03-01',
    },
    {
        id: 'b-2',
        title: { uz: "Optom buyurtmada -15%", ru: "Скидка -15% на оптовый заказ" },
        subtitle: { uz: "100 ta va undan ko'p buyurtma uchun maxsus narxlar", ru: "Специальные цены при заказе от 100 единиц" },
        badge: { uz: "Maxsus taklif", ru: "Спецпредложение" },
        highlightText: { uz: "-15%", ru: "-15%" },
        link: '/special-offers',
        gradient: 'from-emerald-500 to-teal-600',
        emoji: '🎁',
        location: 'hero',
        order: 2,
        isActive: true,
        createdAt: '2026-03-01',
    },
    {
        id: 'b-3',
        title: { uz: "Makulatura topshiring", ru: "Сдайте макулатуру" },
        subtitle: { uz: "O'zbekistonning 12 viloyatida qabul punktlari. Pul ishlang!", ru: "Пункты приёма в 12 регионах. Зарабатывайте!" },
        badge: { uz: "Yangi yo'nalish", ru: "Новое направление" },
        highlightText: { uz: "pul ishlang", ru: "зарабатывайте" },
        link: '/recycling',
        gradient: 'from-emerald-600 to-teal-700',
        emoji: '♻️',
        location: 'hero',
        order: 3,
        isActive: true,
        createdAt: '2026-03-20',
    },
    {
        id: 'b-4',
        title: { uz: "Tez yetkazib berish", ru: "Быстрая доставка" },
        subtitle: { uz: "Buyurtma kuni yetkazib beramiz — butun O'zbekiston bo'ylab", ru: "Доставим в день заказа по всему Узбекистану" },
        badge: { uz: "Xizmat", ru: "Сервис" },
        highlightText: { uz: "kuni yetkazib", ru: "в день заказа" },
        link: '/delivery',
        gradient: 'from-purple-600 to-violet-700',
        emoji: '🚛',
        location: 'hero',
        order: 4,
        isActive: true,
        createdAt: '2026-03-01',
    },
];

export const useBannerStore = create<BannerState>()(
    persist(
        (set) => ({
            banners: DEFAULT_BANNERS,

            addBanner: (banner) =>
                set((state) => ({
                    banners: [
                        ...state.banners,
                        {
                            ...banner,
                            id: `b-${Date.now()}`,
                            createdAt: new Date().toISOString().split('T')[0],
                        },
                    ],
                })),

            updateBanner: (id, updates) =>
                set((state) => ({
                    banners: state.banners.map((b) =>
                        b.id === id ? { ...b, ...updates } : b
                    ),
                })),

            deleteBanner: (id) =>
                set((state) => ({
                    banners: state.banners.filter((b) => b.id !== id),
                })),

            toggleActive: (id) =>
                set((state) => ({
                    banners: state.banners.map((b) =>
                        b.id === id ? { ...b, isActive: !b.isActive } : b
                    ),
                })),

            reorder: (id, direction) =>
                set((state) => {
                    const sorted = [...state.banners].sort((a, b) => a.order - b.order);
                    const idx = sorted.findIndex((b) => b.id === id);
                    if (direction === 'up' && idx > 0) {
                        [sorted[idx].order, sorted[idx - 1].order] = [sorted[idx - 1].order, sorted[idx].order];
                    } else if (direction === 'down' && idx < sorted.length - 1) {
                        [sorted[idx].order, sorted[idx + 1].order] = [sorted[idx + 1].order, sorted[idx].order];
                    }
                    return { banners: sorted };
                }),
        }),
        {
            name: 'pack24-banners-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
