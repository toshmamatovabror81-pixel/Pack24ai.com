import { create } from 'zustand';
import { toast } from 'sonner';
import { parseProduct } from '@/lib/product-utils';
import { toNumber } from '@/lib/money';

export interface Product {
    id: number | string;
    name: string;
    description?: string;
    price: number;
    originalPrice?: number;
    sku?: string;
    category?: string;
    image: string;
    gallery?: string[];
    videoUrl?: string;
    tags?: string[];
    minQuantity?: number;
    minPrice?: number;
    sizes?: { label: string; price: number; minQty?: number }[];
    inStock?: boolean;
    rating: number;
    reviews: number;
    created_at?: string;
    status: 'active' | 'draft' | 'archived';
    dimensions?: {
        width: number;
        height: number;
        length?: number;
        thickness?: number;
    };
    specifications?: Record<string, string>;
    sourceUrl?: string;
    originalCategoryPath?: string[];
    isFeatured?: boolean;
}

// ─── Typed selectors (performance) ────────────────────────────────────────
// Usage: const products = useProductStore(selectProducts)   ← minimal re-renders
// Usage: const loading = useProductStore(selectLoading)
export const selectProducts = (s: ProductState) => s.products;
export const selectLoading  = (s: ProductState) => s.loading;
export const selectByCategory = (category: string) =>
    (s: ProductState) => s.products.filter((p) => p.category === category);
export const selectActiveProducts = (s: ProductState) =>
    s.products.filter((p) => p.status === 'active');
export const selectProductById = (id: number | string) =>
    (s: ProductState) => s.products.find((p) => p.id === id) ?? null;
// ─────────────────────────────────────────────────────────────────────────

interface FetchFilters {
    category?: string;
    status?: 'active' | 'draft' | 'archived';
    search?: string;
}

export interface ImportData {
    name: string;
    description?: string;
    price: number | string;
    sku?: string;
    category?: string;
    image?: string;
    gallery?: string[];
    specifications?: Record<string, string>;
}

interface ProductState {
    products: Product[];
    loading: boolean;
    fetchProducts: (filters?: FetchFilters) => Promise<void>;
    addProduct: (product: Omit<Product, 'id' | 'created_at' | 'rating' | 'reviews'>) => Promise<void>;
    updateProduct: (id: number | string, updates: Partial<Product>) => Promise<void>;
    deleteProduct: (id: number | string) => Promise<void>;
    bulkUpdatePrice: (category: string, percentage: number) => Promise<void>;
    importProduct: (data: ImportData) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
    products: [],
    loading: false,

    fetchProducts: async (filters = {}) => {
        set({ loading: true });
        try {
            const params = new URLSearchParams();
            if (filters.category) params.append('category', filters.category);
            if (filters.status) params.append('status', filters.status);
            if (filters.search) params.append('search', filters.search);

            const res = await fetch(`/api/products?${params}`);
            if (res.ok) {
                const data = await res.json();
                set({
                    products: (Array.isArray(data) ? data : []).map((p: Record<string, unknown>) =>
                        parseProduct(p) as unknown as Product,
                    ),
                });
            }
        } catch (error) {
            console.error('Failed to fetch products', error);
        } finally {
            set({ loading: false });
        }
    },

    addProduct: async (newProduct) => {
        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProduct)
            });
            if (res.ok) {
                const product = parseProduct(await res.json()) as unknown as Product;
                set(state => ({ products: [product, ...state.products] }));
                toast.success('Mahsulot qo\'shildi');
            }
        } catch (_error) {
            toast.error('Xatolik yuz berdi');
        }
    },

    updateProduct: async (id, updates) => {
        // Optimistic update
        const originalProducts = get().products;
        set(state => ({
            products: state.products.map(p => p.id === id ? { ...p, ...updates } : p)
        }));

        try {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error();
        } catch (_error) {
            set({ products: originalProducts }); // Revert
            toast.error('Yangilashda xatolik');
        }
    },

    deleteProduct: async (id) => {
        const originalProducts = get().products;
        set(state => ({ products: state.products.filter(p => p.id !== id) }));

        try {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            toast.success("Mahsulot o'chirildi");
        } catch (_error) {
            set({ products: originalProducts });
            toast.error("O'chirishda xatolik");
        }
    },

    bulkUpdatePrice: async (category, percentage) => {
        // Optimistic update (UI darhol ko'rinishi uchun)
        set(state => ({
            products: state.products.map(p => {
                if (category === 'all' || p.category === category) {
                    return {
                        ...p,
                        price: Math.max(0, Math.round(toNumber(p.price) * (1 + percentage / 100))),
                    };
                }
                return p;
            })
        }));

        // Bitta API call — server tomonda $transaction ishlatadi
        try {
            const res = await fetch('/api/products/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, percentage }),
            });
            if (!res.ok) throw new Error('Bulk update failed');
            toast.success(`${category === 'all' ? 'Barcha' : category} mahsulotlar narxi yangilandi`);
        } catch {
            // Xato bo'lsa qayta fetch qilamiz (rollback uchun)
            const { fetchProducts } = get() as ProductState;
            await fetchProducts();
            toast.error('Narx yangilashda xatolik');
        }
    },

    importProduct: async (data: ImportData) => {
        try {
            // Map scraped data to Product structure
            const mappedProduct = {
                name: data.name,
                description: data.description || '',
                price: typeof data.price === 'string' ? parseFloat(data.price.replace(/[^0-9.]/g, '')) : (data.price || 0),
                originalPrice: null,
                sku: data.sku || '',
                category: data.category || 'Uncategorized', // dynamic mapping might be needed
                image: data.image || '/placeholder.png',
                gallery: data.gallery || [],
                status: 'draft',
                inStock: true,
                specifications: data.specifications || {},
                // Handle other fields...
            };

            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mappedProduct)
            });

            if (res.ok) {
                const product = parseProduct(await res.json()) as unknown as Product;
                set(state => ({ products: [product, ...state.products] }));
            } else {
                throw new Error('Import failed');
            }
        } catch (error) {
            console.error('Import error:', error);
            throw error; // Let caller handle or just log
        }
    }
}));

