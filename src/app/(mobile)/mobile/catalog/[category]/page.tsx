'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';import { ArrowLeft, SlidersHorizontal, Box, ChevronRight } from 'lucide-react';
import { useCategoryStore, Category } from '@/lib/store/useCategoryStore';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { translateProductName } from '@/lib/product-translations';

interface Product {
    id: number;
    name: string;
    price: number;
    image: string;
}


export default function CategoryProductsPage() {
    const router = useRouter();
    const params = useParams();
    const rawCategory = Array.isArray(params.category) ? params.category[0] : params.category;
    const slug = decodeURIComponent(rawCategory || '');
    const { language } = useLanguage();
    const categories = useCategoryStore((state) => state.categories);

    const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Recursive search to find category by slug
    const findCategoryBySlug = (cats: Category[], targetSlug: string): Category | null => {
        for (const cat of cats) {
            if (cat.slug === targetSlug) return cat;
            if (cat.children) {
                const found = findCategoryBySlug(cat.children, targetSlug);
                if (found) return found;
            }
        }
        return null;
    };

    useEffect(() => {
        const category = findCategoryBySlug(categories, slug);
        setCurrentCategory(category);

        // If it's a leaf category (no children) or not found in store, fetch products
        if (!category || !category.children || category.children.length === 0) {
            setLoading(true);
            // Use category name if found, else slug, for API search if needed
            // Actually API likely expects slug or name. 
            // In the previous code it used 'categoryName' which was the slug. 
            // Let's assume API filters by the string passed.
            fetch(`/api/products?category=${encodeURIComponent(slug)}`)
                .then(res => res.json())
                .then(data => setProducts(data))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, categories]);

    const title = currentCategory
        ? (currentCategory.name[language as keyof typeof currentCategory.name] || currentCategory.name.ru)
        : slug;

    return (
        <div className="bg-[#F9FAFB] min-h-screen pb-20">
            {/* Header */}
            <div className="bg-white p-4 sticky top-0 z-10 shadow-sm flex items-center gap-3">
                <button onClick={() => router.back()} className="p-1 -ml-1" aria-label="Orqaga">
                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-gray-900 leading-tight line-clamp-1">{title}</h1>
                    <p className="text-xs text-gray-500">
                        {currentCategory?.children?.length
                            ? `${currentCategory.children.length} bo'lim`
                            : `${products.length} ta mahsulot`
                        }
                    </p>
                </div>
                {!currentCategory?.children?.length && (
                    <button className="p-2 -mr-2 text-gray-600" aria-label="Filterlash">
                        <SlidersHorizontal className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="p-4">
                {loading ? (
                    <div className="grid grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map(n => (
                            <div key={n} className="bg-white rounded-2xl p-3 h-48 animate-pulse">
                                <div className="w-full h-24 bg-gray-200 rounded-xl mb-3"></div>
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                ) : currentCategory?.children && currentCategory.children.length > 0 ? (
                    /* Sub-categories List */
                    <div className="flex flex-col gap-3">
                        {currentCategory.children.map((sub) => {
                            const imageUrl = sub.image || '/images/no-image.svg';

                            return (
                                <Link
                                    key={sub.id}
                                    href={`/mobile/catalog/${sub.slug}`}
                                    className="flex items-center p-3 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-all"
                                >
                                    {/* Image Container */}
                                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 mr-4 flex-shrink-0 relative">
                                        <Image
                                            src={imageUrl}
                                            alt={sub.name[language as keyof typeof sub.name] || sub.name.ru}
                                            className="w-full h-full object-cover" width={300} height={300}
                                        />
                                    </div>

                                    {/* Text Content */}
                                    <div className="flex-grow py-1">
                                        <h3 className="text-sm font-bold text-gray-800 leading-tight mb-1">
                                            {sub.name[language as keyof typeof sub.name] || sub.name.ru}
                                        </h3>
                                        <p className="text-xs text-gray-400 font-medium">To&apos;plam</p>
                                    </div>

                                    {/* Arrow */}
                                    <div className="text-gray-300 pr-1">
                                        <ChevronRight className="w-5 h-5" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    /* Product Grid */
                    <div className="grid grid-cols-2 gap-3">
                        {products.length === 0 ? (
                            <div className="col-span-2 py-10 text-center text-gray-400 flex flex-col items-center">
                                <Box className="w-12 h-12 mb-3 opacity-20" />
                                <p>Mahsulotlar topilmadi</p>
                            </div>
                        ) : (
                            products.map((product) => {
                                const translatedName = translateProductName(product.name, language);
                                return (
                                <div
                                    key={product.id}
                                    className="bg-white p-3 rounded-2xl shadow-sm active:scale-98 transition-transform flex flex-col"
                                    onClick={() => router.push(`/mobile/product/${product.id}`)}
                                >
                                    <div className="relative aspect-square mb-3 bg-gray-50 rounded-xl overflow-hidden">
                                        <Image
                                            src={product.image}
                                            alt={translatedName}
                                            className="w-full h-full object-cover" width={300} height={300}
                                        />
                                    </div>
                                    <h3 className="text-xs font-medium text-gray-800 line-clamp-2 mb-auto">{translatedName}</h3>
                                    <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                                        <span className="text-sm font-bold text-brand-green">
                                            {product.price.toLocaleString()} co&apos;m
                                        </span>
                                        <div className="w-6 h-6 bg-brand-purple rounded-full flex items-center justify-center text-white text-xs">
                                            +
                                        </div>
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
