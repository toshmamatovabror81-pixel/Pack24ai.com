'use client';

import { Search, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ApiProductCategoryRow {
    category?: string | null;
}

export default function MobileCatalogPage() {
    const router = useRouter();
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/products')
            .then(res => res.json())
            .then(data => {
                // Extract unique categories from products
                // In a real app, you might have a dedicated /api/categories endpoint
                const rows = data as ApiProductCategoryRow[];
                const cats = Array.from(
                    new Set(rows.map((p) => p.category).filter((c): c is string => typeof c === 'string' && c.length > 0))
                );
                setCategories(cats);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    // Static mapping for images (since categories in DB might not have images yet)
    const _getCategoryImage = (name: string) => {
        const map: Record<string, string> = {
            'Polietilen paketlar': '/icons/poly.png',
            'Karton qutilar': '/icons/box.png',
            // Add defaults
        };
        return map[name] || '/icons/box.png'; // Default icon
    };

    return (
        <div className="bg-[#F9FAFB] min-h-screen pb-20">
            <div className="bg-white p-4 sticky top-0 z-10 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Mahsulotlar va toifalarni qidirish"
                        className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-2xl text-sm outline-none"
                    />
                </div>
                <div className="flex justify-end mt-2">
                    <span className="text-[#5D5FEF] font-medium text-sm flex items-center">
                        Hammasi <ChevronRight className="w-4 h-4" />
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-gray-400" />
                </div>
            ) : (
                <div className="p-4 grid grid-cols-2 gap-4">
                    {categories.map((category) => (
                        <div
                            key={category}
                            className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-sm active:scale-95 transition-transform"
                            onClick={() => router.push(`/mobile/catalog/${encodeURIComponent(category)}`)}
                        >
                            <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center">
                                {/* Ideally use Image component */}
                                <span className="text-2xl">📦</span>
                            </div>
                            <span className="text-center text-xs font-medium text-gray-700">{category}</span>
                        </div>
                    ))}
                    {categories.length === 0 && (
                        <div className="col-span-2 text-center text-gray-400 text-sm py-10">
                            Kategoriyalar topilmadi
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
