import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { initialCategories } from './initialCategories';

export interface Category {
    id: string;
    name: {
        uz: string;
        ru: string;
        en: string;
    };
    icon: string; // Lucide icon name or image URL
    image?: string; // Kategoriya rasmi (Supabase/CDN URL)
    slug: string;
    productCount: number;
    isActive: boolean;
    children?: Category[]; // Nested sub-categories
}

interface CategoryState {
    categories: Category[];
    addCategory: (category: Omit<Category, 'id' | 'productCount'>) => void;
    updateCategory: (id: string, updates: Partial<Category>) => void;
    deleteCategory: (id: string) => void;
}

export const useCategoryStore = create<CategoryState>()(
    persist(
        (set) => ({
            categories: initialCategories,
            addCategory: (newCategory) => set((state) => ({
                categories: [
                    ...state.categories,
                    {
                        ...newCategory,
                        id: `cat-${Date.now()}`,
                        productCount: 0,
                    },
                ],
            })),
            updateCategory: (id, updates) => set((state) => ({
                categories: state.categories.map((cat) =>
                    cat.id === id ? { ...cat, ...updates } : cat
                ),
            })),
            deleteCategory: (id) => set((state) => ({
                categories: state.categories.filter((cat) => cat.id !== id),
            })),
        }),
        {
            name: 'pack24-category-storage',
            storage: createJSONStorage(() => localStorage),
            skipHydration: true,
            merge: (persistedState: unknown, currentState) => {
                const state = persistedState as Partial<CategoryState> | undefined;
                if (!state || !state.categories || state.categories.length === 0) {
                    return currentState;
                }
                return state as CategoryState;
            },
        }
    )
);
