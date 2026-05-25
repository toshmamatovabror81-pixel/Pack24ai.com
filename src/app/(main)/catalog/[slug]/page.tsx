'use client';

import Image from 'next/image';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { useProductStore } from '@/lib/store/useProductStore';
import { useProductFilter } from '@/lib/hooks/useProductFilter';
import { FilterSidebar } from '@/components/catalog/FilterSidebar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/Sheet';
import { SlidersHorizontal, Search, LayoutGrid, List, ShoppingCart, Heart, Star, ArrowUpDown, ChevronRight } from 'lucide-react';
import { useCategoryStore } from '@/lib/store/useCategoryStore';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useCartStore } from '@/lib/store/useCartStore';
import { toast } from 'sonner';

// Sort options
const SORT_OPTIONS = [
    { value: 'default',     uz: 'Standart',        ru: 'По умолчанию' },
    { value: 'price_asc',   uz: 'Narx: arzondan',  ru: 'Цена: по возрастанию' },
    { value: 'price_desc',  uz: 'Narx: qimmatdan', ru: 'Цена: по убыванию' },
    { value: 'rating',      uz: 'Reyting',          ru: 'По рейтингу' },
    { value: 'name_asc',    uz: 'Nom: A-Z',         ru: 'Название: А-Я' },
] as const;

type SortValue = typeof SORT_OPTIONS[number]['value'];

// Product Card - Grid view
function ProductCardGrid({
    product, onAddToCart, format, language,
}: { product: UnsafeAny; onAddToCart: (p: UnsafeAny) => void; format: (n: number) => string; language: string }) {
    const [liked, setLiked] = useState(false);
    const [added, setAdded] = useState(false);
    const isOnSale = product.originalPrice && product.originalPrice > product.price;
    const discount = isOnSale ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;

    const handleCart = (e: React.MouseEvent) => {
        e.preventDefault();
        onAddToCart(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
    };

    return (
        <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-blue-100 transition-all duration-200">
            {/* Badges */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
                {isOnSale && (
                    <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                        -{discount}%
                    </span>
                )}
                {product.isNew && (
                    <span className="bg-blue-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                        NEW
                    </span>
                )}
            </div>

            {/* Wishlist */}
            <button
                onClick={e => { e.preventDefault(); setLiked(!liked); }}
                className={`absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${
                    liked ? 'bg-red-50 text-red-500 opacity-100' : 'bg-white/80 text-gray-400'
                }`}
                aria-label="Sevimlilarga"
            >
                <Heart size={13} fill={liked ? 'currentColor' : 'none'} />
            </button>

            {/* Image */}
            <Link href={`/product/${product.id}`}>
                <div className="h-44 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                    {product.image ? (
                        <Image
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300" width={300} height={300}
                        />
                    ) : (
                        <ShoppingCart size={36} className="text-gray-200" />
                    )}
                </div>
            </Link>

            {/* Info */}
            <div className="p-4">
                {/* Rating */}
                {product.rating > 0 && (
                    <div className="flex items-center gap-1 mb-2">
                        {[1,2,3,4,5].map(i => (
                            <Star key={i} size={10} className={i <= Math.round(product.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                        ))}
                        <span className="text-[10px] text-gray-400 ml-0.5">({product.reviews})</span>
                    </div>
                )}

                <Link href={`/product/${product.id}`}>
                    <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 hover:text-blue-600 transition-colors leading-snug mb-3">
                        {product.name}
                    </h3>
                </Link>

                {/* Price */}
                <div className="flex items-end justify-between gap-2 mt-auto">
                    <div>
                        {product.price > 0 ? (
                            <>
                                <p className="text-base font-extrabold text-blue-700">{format(product.price)}</p>
                                {isOnSale && (
                                    <p className="text-xs text-gray-400 line-through">{format(product.originalPrice)}</p>
                                )}
                            </>
                        ) : (
                            <p className="text-sm font-semibold text-gray-500">
                                {language === 'ru' ? 'По договорённости' : 'Kelishuv asosida'}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={handleCart}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all flex-shrink-0 ${
                            added
                                ? 'bg-emerald-500 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        <ShoppingCart size={11} />
                        {added ? '✓' : language === 'ru' ? 'В корзину' : 'Savatga'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Product Card - List view
function ProductCardList({
    product, onAddToCart, format, language,
}: { product: UnsafeAny; onAddToCart: (p: UnsafeAny) => void; format: (n: number) => string; language: string }) {
    const [added, setAdded] = useState(false);
    const isOnSale = product.originalPrice && product.originalPrice > product.price;

    const handleCart = () => {
        onAddToCart(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
    };

    return (
        <Link href={`/product/${product.id}`} className="block">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all p-4 flex items-center gap-4">
                <div className="w-24 h-24 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                    {product.image
                        ? <Image src={product.image} alt={product.name} className="w-full h-full object-contain p-1" width={300} height={300} />
                        : <ShoppingCart size={28} className="text-gray-200 m-auto mt-7" />
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm hover:text-blue-600 transition-colors line-clamp-1">{product.name}</h3>
                    {product.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{product.description}</p>
                    )}
                    {product.rating > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                            {[1,2,3,4,5].map(i => (
                                <Star key={i} size={9} className={i <= Math.round(product.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-shrink-0 text-right space-y-2">
                    {product.price > 0 ? (
                        <>
                            <p className="font-extrabold text-blue-700">{format(product.price)}</p>
                            {isOnSale && <p className="text-xs text-gray-400 line-through">{format(product.originalPrice)}</p>}
                        </>
                    ) : (
                        <p className="text-sm text-gray-500">{language === 'ru' ? 'По договорённости' : 'Kelishuv'}</p>
                    )}
                    <button
                        onClick={e => { e.preventDefault(); handleCart(); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            added ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        {added ? '✓' : <ShoppingCart size={12} />}
                    </button>
                </div>
            </div>
        </Link>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const [slug, setSlug] = useState<string>('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<SortValue>('default');
    const [sortOpen, setSortOpen] = useState(false);
    const { addToCart } = useCartStore();
    const [mounted, setMounted] = useState(false);

    const t = (uz: string, ru: string) => language === 'ru' ? ru : uz;

    useEffect(() => {
        setMounted(true);
        params.then(p => setSlug(p.slug));
    }, [params]);

    const handleAddToCart = (product: UnsafeAny) => {
        addToCart({ productId: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 });
        toast.success(t("Savatga qo'shildi!", "Добавлено в корзину!"));
    };

    const allProducts = useProductStore(s => s.products);
    const fetchProducts = useProductStore(s => s.fetchProducts);
    const categories = useCategoryStore(s => s.categories);

    // DB dan mahsulotlarni yuklash (faqat bo'sh bo'lsa)
    useEffect(() => {
        if (allProducts.length === 0) {
            fetchProducts({ status: 'active' });
        }
    }, [allProducts.length, fetchProducts]);

    const category = useMemo(() => {
        if (!slug) return undefined;
        const find = (cats: UnsafeAny[]): UnsafeAny => {
            for (const c of cats) {
                if (c.slug === slug) return c;
                if (c.children) { const f = find(c.children); if (f) return f; }
            }
        };
        return find(categories);
    }, [slug, categories]);

    const categoryProducts = useMemo(() => {
        if (!category) return [];
        return allProducts.filter(p => {
            if (!p.category) return false;
            const nUz = category.name.uz; const nRu = category.name.ru;
            return p.category === nUz || p.category === nRu || p.category.includes(nUz) || p.category.includes(nRu);
        });
    }, [allProducts, category]);

    const { searchQuery, setSearchQuery, priceRange, setPriceRange, selectedAttributes, setSelectedAttributes, filteredProducts, availableFilters } = useProductFilter(categoryProducts);

    // Sort
    const sortedProducts = useMemo(() => {
        const arr = [...filteredProducts];
        switch (sortBy) {
            case 'price_asc':   return arr.sort((a, b) => a.price - b.price);
            case 'price_desc':  return arr.sort((a, b) => b.price - a.price);
            case 'rating':      return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
            case 'name_asc':    return arr.sort((a, b) => a.name.localeCompare(b.name));
            default:            return arr;
        }
    }, [filteredProducts, sortBy]);

    if (!mounted || !slug) return null;
    if (!category && categories.length > 0) return notFound();
    if (!category) return null;

    const hasSubCategories = category?.children?.length > 0;
    const currentSort = SORT_OPTIONS.find(o => o.value === sortBy);

    return (
        <div className="font-sans">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-5">
                <Link href="/" className="hover:text-blue-600">{t("Bosh sahifa", "Главная")}</Link>
                <ChevronRight size={12} />
                <Link href="/catalog" className="hover:text-blue-600">{t("Katalog", "Каталог")}</Link>
                <ChevronRight size={12} />
                <span className="text-gray-800 font-medium">{category.name[language] || category.name['ru']}</span>
            </nav>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Desktop filter sidebar */}
                <aside className="hidden lg:block w-56 xl:w-64 flex-shrink-0">
                    <div className="sticky top-24 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <h2 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2">
                            <SlidersHorizontal size={14} className="text-blue-500" />
                            {t("Filtrlar", "Фильтры")}
                        </h2>
                        <FilterSidebar
                            availableFilters={availableFilters}
                            priceRange={priceRange}
                            setPriceRange={setPriceRange}
                            selectedAttributes={selectedAttributes}
                            setSelectedAttributes={setSelectedAttributes}
                        />
                    </div>
                </aside>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                        <div>
                            <h1 className="text-xl font-extrabold text-gray-900">
                                {category.name[language] || category.name['ru']}
                            </h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {sortedProducts.length} {t("ta mahsulot", "товаров")}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Search */}
                            <div className="relative flex-1 sm:w-48">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    placeholder={t("Qidirish...", "Поиск...")}
                                    className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Sort dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setSortOpen(!sortOpen)}
                                    className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-600 hover:border-blue-300 transition-colors whitespace-nowrap bg-white"
                                >
                                    <ArrowUpDown size={12} />
                                    <span className="hidden sm:inline">{language === 'ru' ? currentSort?.ru : currentSort?.uz}</span>
                                </button>
                                {sortOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden">
                                        {SORT_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                                                className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                                                    sortBy === opt.value ? 'text-blue-600 bg-blue-50 font-bold' : 'text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                {language === 'ru' ? opt.ru : opt.uz}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* View mode */}
                            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                                    aria-label="Grid"
                                >
                                    <LayoutGrid size={14} />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                                    aria-label="List"
                                >
                                    <List size={14} />
                                </button>
                            </div>

                            {/* Mobile filter */}
                            <div className="lg:hidden">
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <button
                                            title={t("Filtrlar", "Фильтры")}
                                            aria-label={t("Filtrlar", "Фильтры")}
                                            className="p-2 border border-gray-200 rounded-xl bg-white text-gray-500 hover:border-blue-300 transition-colors"
                                        >
                                            <SlidersHorizontal size={14} />
                                        </button>
                                    </SheetTrigger>
                                    <SheetContent side="left" className="w-[300px] overflow-y-auto">
                                        <div className="py-4 px-2">
                                            <h2 className="font-bold text-gray-800 mb-4">{t("Filtrlar", "Фильтры")}</h2>
                                            <FilterSidebar
                                                availableFilters={availableFilters}
                                                priceRange={priceRange}
                                                setPriceRange={setPriceRange}
                                                selectedAttributes={selectedAttributes}
                                                setSelectedAttributes={setSelectedAttributes}
                                            />
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </div>
                        </div>
                    </div>

                    {/* Sub-categories */}
                    {hasSubCategories && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6 border-b border-gray-100 pb-6">
                            {category.children.map((sub: UnsafeAny) => (
                                <Link
                                    key={sub.id}
                                    href={`/catalog/${sub.slug}`}
                                    className="group flex flex-col items-center justify-center p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-md hover:border-blue-200 transition-all"
                                >
                                    <div className="mb-2 p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors text-blue-600">
                                        <CategoryIcon name={sub.icon} className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-center text-xs font-semibold text-gray-700 group-hover:text-blue-700 transition-colors leading-tight">
                                        {sub.name[language] || sub.name['ru']}
                                    </h3>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Products */}
                    {sortedProducts.length > 0 ? (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {sortedProducts.map(p => (
                                    <ProductCardGrid key={p.id} product={p} onAddToCart={handleAddToCart} format={format} language={language} />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sortedProducts.map(p => (
                                    <ProductCardList key={p.id} product={p} onAddToCart={handleAddToCart} format={format} language={language} />
                                ))}
                            </div>
                        )
                    ) : (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                            <div className="text-5xl mb-4">🔍</div>
                            <h3 className="text-base font-bold text-gray-700">{t("Mahsulot topilmadi", "Товары не найдены")}</h3>
                            <p className="text-sm text-gray-400 mt-1">{t("Filtrlarni o'zgartiring", "Измените фильтры")}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
