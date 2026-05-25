'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useProductStore } from '@/lib/store/useProductStore';
import { useCategoryStore, type Category } from '@/lib/store/useCategoryStore';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import { useCartStore } from '@/lib/store/useCartStore';
import { CategoryIcon } from '@/components/CategoryIcon';
import { translateCategory, translateProductName, getProductUI } from '@/lib/product-translations';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import type { Language } from '@/lib/translations';
import {
    ChevronRight, Package, Box, ShoppingCart, Star,
    Grid3x3, LayoutList, Layers, ArrowLeft
} from 'lucide-react';

function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}

function getCatName(cat: Category, lang: Language): string {
    return translateCategory(cat.slug, lang) || cat.name[lang as keyof typeof cat.name] || cat.name.uz || cat.name.ru;
}

export default function CategoryPage() {
    const params = useParams();
    const slug = params?.slug as string;

    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const { addToCart } = useCartStore();
    const categories = useCategoryStore(s => s.categories);
    const products = useProductStore(s => s.products);
    const fetchProducts = useProductStore(s => s.fetchProducts);

    const [view, setView] = useState<'grid' | 'list'>('grid');
    const [sort, setSort] = useState<'default' | 'price_asc' | 'price_desc' | 'rating'>('default');
    const [subFilter, setSubFilter] = useState<string | null>(null);
    const [hasMounted, setHasMounted] = useState(false);

    const t = (uz: string, ru: string, en?: string) =>
        language === 'uz' ? uz : language === 'en' ? (en ?? ru) : ru;

    useEffect(() => {
        setHasMounted(true);
        fetchProducts({ status: 'active' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reset sub-filter when slug changes
    useEffect(() => {
        setSubFilter(null);
    }, [slug]);

    // Find the category (could be parent or sub-category)
    const findCategory = (): { parent: Category | null; current: Category | null; isSubCategory: boolean } => {
        // First check directly
        const direct = categories.find(c => c.slug === slug);
        if (direct) return { parent: null, current: direct, isSubCategory: false };

        // Check in sub-categories
        for (const parentCat of categories) {
            if (parentCat.children) {
                const sub = parentCat.children.find(ch => ch.slug === slug);
                if (sub) return { parent: parentCat, current: sub, isSubCategory: true };
            }
        }

        // Fallback — try name-based matching
        const byName = categories.find(c =>
            c.name && typeof c.name === 'object' && Object.values(c.name as object).some(v =>
                typeof v === 'string' && v.toLowerCase().replace(/\s+/g, '-') === slug
            )
        );
        if (byName) return { parent: null, current: byName, isSubCategory: false };

        return { parent: null, current: null, isSubCategory: false };
    };

    const { parent, current: category, isSubCategory } = findCategory();
    const activeSubCategories = (!isSubCategory && category?.children?.filter(ch => ch.isActive)) || [];

    // Category name
    const catName = category ? getCatName(category, language) : slug.replace(/-/g, ' ');
    const parentName = parent ? getCatName(parent, language) : null;

    // Normalize for matching
    const norm = (s: string) =>
        s.toLowerCase().trim().replace(/[''`'ʻʼ]/g, '').trim();

    // Filter products
    const filtered = products.filter(p => {
        if (p.status !== 'active') return false;
        if (!p.category) return false;
        const pCat = p.category.toLowerCase().trim();

        // If sub-filter is active, only show that sub-category
        if (subFilter) {
            return pCat === subFilter.toLowerCase();
        }

        const slugLower = slug.toLowerCase();

        // Direct slug match
        if (pCat === slugLower) return true;

        // Name → slug normalization
        const pCatAsSlug = norm(pCat).replace(/\s+/g, '-');
        if (pCatAsSlug === slugLower) return true;

        // Words matching
        const slugAsWords = slugLower.replace(/-/g, ' ');
        const pCatNorm = norm(pCat);
        if (pCatNorm === slugAsWords) return true;

        // Include sub-category products when viewing parent
        if (!isSubCategory && category?.children) {
            const subSlugs = category.children.map(ch => ch.slug.toLowerCase());
            if (subSlugs.includes(pCat)) return true;
        }

        return false;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
        if (sort === 'price_asc') return a.price - b.price;
        if (sort === 'price_desc') return b.price - a.price;
        if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
        return 0;
    });

    const handleAdd = (product: UnsafeAny) => {
        addToCart({ productId: Number(product.id), name: product.name, price: product.price, image: product.image, quantity: 1 });
        toast.success(t("Savatga qo'shildi! 🎉", "Добавлено в корзину! 🎉", "Added to cart! 🎉"));
    };

    // Sub-category product counts
    const subCatCounts = activeSubCategories.map(sub => {
        const count = products.filter(p => p.status === 'active' && p.category === sub.slug).length;
        return { ...sub, productCount: count };
    });

    return (
        <div className="min-h-screen bg-[#f5f6fa]">
            {/* Header strip */}
            <div className="bg-white border-b border-gray-100 py-5">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-3 flex-wrap">
                        <Link href="/" className="hover:text-blue-600">{t("Bosh sahifa", "Главная", "Home")}</Link>
                        <ChevronRight size={12} />
                        <Link href="/catalog" className="hover:text-blue-600">{t("Katalog", "Каталог", "Catalog")}</Link>
                        {isSubCategory && parent && (
                            <>
                                <ChevronRight size={12} />
                                <Link href={`/category/${parent.slug}`} className="hover:text-blue-600">{parentName}</Link>
                            </>
                        )}
                        <ChevronRight size={12} />
                        <span className="text-gray-800 font-medium">{catName}</span>
                    </nav>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {isSubCategory && parent && (
                                <Link
                                    href={`/category/${parent.slug}`}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                                >
                                    <ArrowLeft size={16} />
                                </Link>
                            )}
                            <div>
                                <h1 className="text-2xl font-extrabold text-gray-900">{catName}</h1>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {sorted.length} {t("ta mahsulot", "товаров", "products")}
                                    {activeSubCategories.length > 0 && !subFilter && (
                                        <span className="ml-2 text-purple-500 font-medium">
                                            · {activeSubCategories.length} {t("ta turlar", "видов", "types")}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Sort + View */}
                        <div className="flex items-center gap-3">
                            <select
                                value={sort}
                                onChange={e => setSort(e.target.value as typeof sort)}
                                title={t("Tartiblash", "Сортировка", "Sort")}
                                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-400"
                            >
                                <option value="default">{t("Standart", "По умолчанию", "Default")}</option>
                                <option value="price_asc">{t("Narx: arzondan", "Цена: по возрастанию", "Price: low to high")}</option>
                                <option value="price_desc">{t("Narx: qimmatdan", "Цена: по убыванию", "Price: high to low")}</option>
                                <option value="rating">{t("Reytingga ko'ra", "По рейтингу", "By rating")}</option>
                            </select>

                            <div className="hidden sm:flex border border-gray-200 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setView('grid')}
                                    aria-label="Grid"
                                    className={`p-2.5 transition-colors ${view === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                                >
                                    <Grid3x3 size={14} />
                                </button>
                                <button
                                    onClick={() => setView('list')}
                                    aria-label="List"
                                    className={`p-2.5 transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                                >
                                    <LayoutList size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* ── Sub-category cards (only for parent categories) ── */}
                {activeSubCategories.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Layers size={14} className="text-purple-500" />
                            <span className="text-sm font-bold text-gray-700">{t("Turlar", "Виды", "Types")}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {/* "All" button */}
                            <button
                                onClick={() => setSubFilter(null)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                                    !subFilter
                                        ? 'bg-[#e33326] text-white border-[#e33326] shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#e33326] hover:text-[#e33326]'
                                }`}
                            >
                                {t("Barchasi", "Все", "All")} ({filtered.length})
                            </button>

                            {subCatCounts.map(sub => (
                                <button
                                    key={sub.id}
                                    onClick={() => setSubFilter(subFilter === sub.slug ? null : sub.slug)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                                        subFilter === sub.slug
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-purple-400 hover:text-purple-600'
                                    }`}
                                >
                                    <CategoryIcon name={sub.icon} className="w-3.5 h-3.5" />
                                    {getCatName(sub, language)}
                                    {sub.productCount > 0 && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                            subFilter === sub.slug ? 'bg-white/20' : 'bg-gray-100 text-gray-400'
                                        }`}>
                                            {sub.productCount}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Loading */}
                {!hasMounted && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                                <Skeleton className="h-48 rounded-none" />
                                <div className="p-4 space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /><div className="flex justify-between pt-1"><Skeleton className="h-5 w-20" /><Skeleton className="h-8 w-20 rounded-xl" /></div></div>
                            </div>
                        ))}
                    </div>
                )}

                {/* No products */}
                {hasMounted && sorted.length === 0 && (
                    <div className="text-center py-24">
                        <Package size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-500 font-medium">{t("Bu kategoriyada mahsulot topilmadi.", "В этой категории нет товаров.", "No products in this category.")}</p>
                        <Link href="/catalog" className="text-blue-600 hover:underline text-sm font-semibold mt-3 inline-block">
                            ← {t("Barcha kategoriyalar", "Все категории", "All categories")}
                        </Link>
                    </div>
                )}

                {/* Products grid */}
                {hasMounted && sorted.length > 0 && (
                    <div className={view === 'grid'
                        ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                        : "flex flex-col gap-3"
                    }>
                        {sorted.map(product => {
                            const isOnSale = product.originalPrice && product.originalPrice > product.price;
                            const discount = isOnSale ? Math.round((1 - product.price / product.originalPrice!) * 100) : 0;
                            const translatedName = translateProductName(product.name, language);
                            const translatedCat = product.category ? translateCategory(product.category, language) : '';
                            const isHit = (product.rating ?? 0) >= 4.5;

                            if (view === 'list') {
                                return (
                                    <div key={product.id} className="bg-white rounded-2xl border border-gray-100 flex gap-4 p-4 hover:shadow-md transition-shadow">
                                        <Link href={`/product/${product.id}`} className="w-28 h-28 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                                            {product.image ? (
                                                <Image src={product.image} alt={translatedName} fill className="object-contain p-2 mix-blend-multiply" sizes="112px" />
                                            ) : (
                                                <Box size={32} className="text-gray-200" />
                                            )}
                                        </Link>
                                        <div className="flex-1 min-w-0">
                                            {translatedCat && <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-0.5">{translatedCat}</p>}
                                            <Link href={`/product/${product.id}`}>
                                                <h3 className="font-semibold text-gray-900 text-sm leading-snug hover:text-blue-600 transition-colors line-clamp-2">{translatedName}</h3>
                                            </Link>
                                            <p className={`text-xs mt-1 font-medium ${product.inStock ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {product.inStock ? `✓ ${getProductUI('inStock', language)}` : `✗ ${getProductUI('outOfStock', language)}`}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end justify-between shrink-0">
                                            <div className="text-right">
                                                <p className="font-extrabold text-gray-900 text-lg">{format(product.price)}</p>
                                                {isOnSale && <p className="text-xs text-gray-400 line-through">{format(product.originalPrice!)}</p>}
                                            </div>
                                            <button onClick={() => handleAdd(product)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
                                                <ShoppingCart size={12} />{t("Qo'shish", "В корзину", "Add")}
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={product.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                                    <Link href={`/product/${product.id}`} className="relative block h-44 bg-gradient-to-br from-gray-50 to-gray-100">
                                        {product.image ? (
                                            <Image
                                                src={product.image}
                                                alt={translatedName}
                                                fill
                                                sizes="(max-width:640px) 50vw, 25vw"
                                                className="object-contain p-3 mix-blend-multiply group-hover:scale-105 transition-transform"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center"><Box size={40} className="text-gray-200" /></div>
                                        )}
                                        {/* Badges */}
                                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                                            {isOnSale && <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">-{discount}%</span>}
                                            {isHit && <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{getProductUI('hit', language)}</span>}
                                        </div>
                                    </Link>
                                    <div className="p-3 flex flex-col flex-1">
                                        {translatedCat && <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-0.5">{translatedCat}</p>}
                                        <Link href={`/product/${product.id}`}>
                                            <h3 className="text-xs font-semibold text-gray-800 line-clamp-2 mb-2 hover:text-blue-600 transition-colors">{translatedName}</h3>
                                        </Link>
                                        {product.rating > 0 && (
                                            <div className="flex items-center gap-0.5 mb-2">
                                                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={10} className={i <= Math.round(product.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />)}
                                            </div>
                                        )}
                                        <p className={`text-[10px] font-medium mb-2 ${product.inStock ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {product.inStock ? `● ${getProductUI('inStock', language)}` : `● ${getProductUI('outOfStock', language)}`}
                                        </p>
                                        <div className="mt-auto flex items-center justify-between">
                                            <div>
                                                <p className="font-extrabold text-gray-900 text-sm">{format(product.price)}</p>
                                                {isOnSale && <p className="text-[10px] text-gray-400 line-through">{format(product.originalPrice!)}</p>}
                                            </div>
                                            <button
                                                onClick={() => handleAdd(product)}
                                                aria-label={t("Savatga qo'shish", "В корзину", "Add to cart")}
                                                className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                                            >
                                                <ShoppingCart size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
