'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Package, ChevronRight, SlidersHorizontal, LayoutGrid, List, Search, X, Heart } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCategoryStore } from '@/lib/store/useCategoryStore';
import { useProductStore } from '@/lib/store/useProductStore';
import { useCartStore } from '@/lib/store/useCartStore';
import { useWishlistStore } from '@/lib/store/useWishlistStore';
import { useHasMounted } from '@/lib/hooks/useHasMounted';
import { CategoryIcon } from '@/components/CategoryIcon';
import { translateCategory, translateProductName, getProductUI } from '@/lib/product-translations';
import type { Language } from '@/lib/translations';
import { toast } from 'sonner';
import type { Product } from '@/lib/store/useProductStore';

const SORT_OPTIONS = [
    { value: 'default', uz: 'Standart', ru: 'По умолчанию', en: 'Default', zh: '默认', tr: 'Varsayılan' },
    { value: 'price_asc', uz: 'Narx: arzon', ru: 'Цена: дешевле', en: 'Price: low', zh: '价格↑', tr: 'Fiyat: ucuz' },
    { value: 'price_desc', uz: 'Narx: qimmat', ru: 'Цена: дороже', en: 'Price: high', zh: '价格↓', tr: 'Fiyat: pahalı' },
    { value: 'name', uz: 'Nomi bo\'yicha', ru: 'По названию', en: 'By name', zh: '按名称', tr: 'İsme göre' },
];

/* ──────────────────────── SIDEBAR ──────────────────────── */
type Category = ReturnType<typeof useCategoryStore.getState>['categories'][0];

interface SidebarNavProps {
    activeCategories: Category[];
    products: Product[];
    selectedCat: string | null;
    expandedCats: Set<string>;
    language: Language;
    onSelectCat: (slug: string) => void;
    onToggleCat: (id: string) => void;
}

function SidebarNav({ activeCategories, products, selectedCat, expandedCats, language, onSelectCat, onToggleCat }: SidebarNavProps) {
    return (
        <nav className="w-full">
            {activeCategories.map((cat) => {
                const isSelected = selectedCat === cat.slug ||
                    cat.children?.some(ch => ch.slug === selectedCat);
                const isExpanded = expandedCats.has(cat.id);
                const hasChildren = !!cat.children?.length;
                const count = products.filter(p => p.status === 'active' && (p.category === cat.slug || cat.children?.some(ch => ch.slug === p.category))).length;
                if (count === 0) return null;
                return (
                    <div key={cat.id}>
                        <button
                            type="button"
                            onClick={() => { onSelectCat(cat.slug); if (hasChildren) onToggleCat(cat.id); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors mb-0.5
                                ${isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-red-50 hover:text-red-600'}`}
                        >
                            <CategoryIcon name={cat.icon} className="w-3.5 h-3.5 shrink-0" />
                            <span className="flex-1 text-left text-[13px] leading-tight line-clamp-2">
                                {translateCategory(cat.slug, language)}
                            </span>
                            {hasChildren ? (
                                <ChevronRight size={12} className={`shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            ) : (
                                <span className="text-[10px] text-gray-400 font-medium shrink-0">{count}</span>
                            )}
                        </button>
                        {hasChildren && isExpanded && (
                            <div className="ml-5 border-l border-gray-200 pl-2 mb-1">
                                {cat.children!.map((sub) => {
                                    const subCount = products.filter(p => p.status === 'active' && p.category === sub.slug).length;
                                    if (subCount === 0) return null;
                                    return (
                                        <button
                                            type="button"
                                            key={sub.id}
                                            onClick={() => onSelectCat(sub.slug)}
                                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg mb-0.5 transition-colors
                                                ${selectedCat === sub.slug ? 'text-red-600 bg-red-50 font-semibold' : 'text-gray-600 hover:text-red-600 hover:bg-red-50'}`}
                                        >
                                            <span className="w-1 h-1 rounded-full bg-current opacity-60 shrink-0" />
                                            <span className="flex-1 text-left line-clamp-1">{translateCategory(sub.slug, language)}</span>
                                            <span className="text-[10px] text-gray-400">{subCount}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}

/* ──────────────────────── PRODUCT CARD ──────────────────────── */
interface ProductCardProps {
    product: Product;
    viewMode: 'grid' | 'list';
    qty: number;
    language: Language;
    isInWishlist: boolean;
    onSetQty: (id: string, val: number) => void;
    onAddToCart: (product: Product) => void;
    onToggleWishlist: (product: Product) => void;
    t: (uz: string, ru: string, en?: string) => string;
}

function ProductCard({ product, viewMode, qty, language, isInWishlist, onSetQty, onAddToCart, onToggleWishlist, t }: ProductCardProps) {
    const translatedName = translateProductName(product.name, language);
    const discount = product.originalPrice && product.originalPrice > product.price
        ? Math.round((1 - product.price / product.originalPrice) * 100) : null;
    const isHit = (product.rating ?? 0) >= 4.5;
    const wholesalePrice = product.originalPrice ? product.price : Math.floor(product.price * 0.85);

    if (viewMode === 'list') {
        return (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-all flex gap-4 p-3">
                <Link href={`/product/${product.id}`} className="relative w-28 h-28 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                    {product.image ? (
                        <Image src={product.image} alt={translatedName} fill className="object-contain p-2 mix-blend-multiply" sizes="112px" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Package size={32} className="text-gray-300" />
                        </div>
                    )}
                </Link>
                <div className="flex-1 min-w-0">
                    <Link href={`/product/${product.id}`}>
                        <h3 className="font-semibold text-sm text-gray-900 hover:text-blue-600 transition-colors line-clamp-2 mb-1">{translatedName}</h3>
                    </Link>
                    <p className={`text-xs font-medium mb-2 ${product.inStock ? 'text-emerald-600' : 'text-red-500'}`}>
                        {product.inStock ? `✓ ${getProductUI('inStock', language)}` : `✗ ${getProductUI('outOfStock', language)}`}
                    </p>
                    <div className="flex items-center gap-4 flex-wrap">
                        <div>
                            <p className="font-black text-gray-900 text-lg">{product.price.toLocaleString()} <span className="text-sm font-normal text-gray-500">{getProductUI('currency', language)}</span></p>
                            <p className="text-xs text-gray-400">{t("Optom", "Опт")}: {wholesalePrice.toLocaleString()} {getProductUI('currency', language)}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                <button type="button" title="-" onClick={() => onSetQty(String(product.id), qty - 1)} className="w-7 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-lg font-bold">−</button>
                                <input aria-label="qty" type="number" value={qty} onChange={e => onSetQty(String(product.id), Number(e.target.value))} className="w-10 h-8 text-center text-sm border-x border-gray-200 outline-none" min={1} />
                                <button type="button" title="+" onClick={() => onSetQty(String(product.id), qty + 1)} className="w-7 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-lg font-bold">+</button>
                            </div>
                            <button type="button" onClick={() => onAddToCart(product)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-2 rounded-lg transition-colors">
                                <ShoppingCart size={13} /> {getProductUI('addToCart', language)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 flex flex-col group">
            {/* Image */}
            <div className="relative h-44 bg-gradient-to-b from-gray-50 to-gray-100 overflow-hidden">
                <Link href={`/product/${product.id}`}>
                    {product.image ? (
                        <Image src={product.image} alt={translatedName} fill className="object-contain p-3 mix-blend-multiply group-hover:scale-105 transition-transform duration-300" sizes="(max-width:640px) 50vw, 25vw" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Package size={40} className="text-gray-300" />
                        </div>
                    )}
                </Link>
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {discount && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">-{discount}%</span>}
                    {isHit && <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">{getProductUI('hit', language)}</span>}
                </div>
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onToggleWishlist(product); }}
                    className={`absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm transition-all opacity-0 group-hover:opacity-100 ${
                        isInWishlist ? 'text-red-500 opacity-100' : 'hover:text-red-500'
                    }`}
                    title={t("Sevimlilarga qo'shish", "В избранное")}
                >
                    <Heart size={13} fill={isInWishlist ? 'currentColor' : 'none'} />
                </button>
            </div>

            {/* Body */}
            <div className="p-3 flex flex-col flex-1">
                {product.category && (
                    <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wide mb-0.5">
                        {translateCategory(product.category, language)}
                    </p>
                )}
                <Link href={`/product/${product.id}`}>
                    <h3 className="text-xs font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-2 leading-snug mb-2">
                        {translatedName}
                    </h3>
                </Link>

                <p className={`text-[10px] font-medium mb-2 ${product.inStock ? 'text-emerald-600' : 'text-red-500'}`}>
                    {product.inStock ? `● ${getProductUI('inStock', language)}` : `● ${getProductUI('outOfStock', language)}`}
                </p>

                {/* Price */}
                <div className="mb-2">
                    <div className="flex items-baseline gap-1.5">
                        <span className="font-black text-gray-900 text-base">{product.price.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 font-normal">{getProductUI('currency', language)}</span>
                        {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-[10px] text-gray-400 line-through">{product.originalPrice.toLocaleString()}</span>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400">
                        {t("Optom", "Опт")}: <span className="font-semibold text-blue-600">{wholesalePrice.toLocaleString()} {getProductUI('currency', language)}</span>
                    </p>
                </div>

                {/* Qty + Cart */}
                <div className="mt-auto flex items-center gap-1.5">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button type="button" title="-" onClick={() => onSetQty(String(product.id), qty - 1)} className="w-6 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-base">−</button>
                        <input
                            aria-label="qty"
                            type="number"
                            value={qty}
                            onChange={e => onSetQty(String(product.id), Number(e.target.value))}
                            className="w-8 h-7 text-center text-xs border-x border-gray-200 outline-none"
                            min={1}
                        />
                        <button type="button" title="+" onClick={() => onSetQty(String(product.id), qty + 1)} className="w-6 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-base">+</button>
                    </div>
                    <button
                        type="button"
                        onClick={() => onAddToCart(product)}
                        className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-[7px] rounded-lg transition-colors active:scale-95"
                    >
                        <ShoppingCart size={11} />
                        <span>{getProductUI('addToCart', language)}</span>
                    </button>
                </div>
                <p className="text-[9px] text-center text-blue-500 hover:text-blue-700 cursor-pointer mt-1 transition-colors">
                    {t("1 ta bosishda sotib olish", "Купить в 1 клик", "Buy in 1 click")}
                </p>
            </div>
        </div>
    );
}

/* ──────────────────────── MAIN PAGE ──────────────────────── */
export default function CatalogIndexPage() {
    const { language } = useLanguage();
    const categories = useCategoryStore((s) => s.categories);
    const { products, fetchProducts, loading } = useProductStore();
    const { addToCart } = useCartStore();
    const { toggleWishlist, isInWishlist } = useWishlistStore();
    const hasMounted = useHasMounted();

    const [search, setSearch] = useState('');
    const [selectedCat, setSelectedCat] = useState<string | null>(null);
    const [sort, setSort] = useState('default');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

    const t = (uz: string, ru: string, en?: string) =>
        language === 'uz' ? uz : language === 'en' ? (en ?? ru) : ru;

    const lbl = (obj: Record<string, string>, def = '') =>
        obj[language] ?? obj['en'] ?? obj['ru'] ?? obj['uz'] ?? def;

    useEffect(() => {
        fetchProducts({ status: 'active' });
    }, [fetchProducts]);

    const activeCategories = categories.filter((c) => c.isActive);

    const filtered = useMemo(() => {
        let list = products.filter((p) => p.status === 'active');
        if (selectedCat) {
            list = list.filter((p) => p.category === selectedCat ||
                activeCategories.find(c => c.slug === selectedCat)?.children?.some(ch => ch.slug === p.category));
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((p) =>
                p.name.toLowerCase().includes(q) ||
                translateProductName(p.name, language).toLowerCase().includes(q)
            );
        }
        switch (sort) {
            case 'price_asc': return [...list].sort((a, b) => a.price - b.price);
            case 'price_desc': return [...list].sort((a, b) => b.price - a.price);
            case 'name': return [...list].sort((a, b) => translateProductName(a.name, language).localeCompare(translateProductName(b.name, language)));
            default: return list;
        }
    }, [products, selectedCat, search, sort, language, activeCategories]);

    const handleAddToCart = (product: Product) => {
        const qty = quantities[product.id] ?? 1;
        addToCart({ productId: Number(product.id), name: product.name, price: product.price, image: product.image, quantity: qty });
        toast.success(getProductUI('addedToCart', language));
    };

    const handleToggleWishlist = (product: Product) => {
        const inWishlist = isInWishlist(String(product.id));
        toggleWishlist({
            productId: String(product.id),
            name: product.name,
            price: product.price,
            image: product.image,
            category: product.category,
            addedAt: Date.now(),
        });
        if (inWishlist) {
            toast(t("Sevimlilardan olib tashlandi", "Удалено из избранного"));
        } else {
            toast.success(t("Sevimlilarga qo'shildi ❤️", "Добавлено в избранное ❤️"));
        }
    };

    const setQty = (id: string, val: number) =>
        setQuantities((prev) => ({ ...prev, [id]: Math.max(1, val) }));

    const toggleCat = (id: string) =>
        setExpandedCats(prev => {
            const s = new Set(prev);
            if (s.has(id)) {
                s.delete(id);
            } else {
                s.add(id);
            }
            return s;
        });

    if (!hasMounted) return null;

    const selectedCatObj = activeCategories.find(c => c.slug === selectedCat);

    return (
        <div className="flex gap-0 relative">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute left-0 top-0 h-full w-72 bg-white p-4 overflow-y-auto z-50" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-gray-900">{t('Kategoriyalar', 'Категории')}</h2>
                            <button type="button" onClick={() => setSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><X size={18} /></button>
                        </div>
                        <SidebarNav
                            activeCategories={activeCategories}
                            products={products}
                            selectedCat={selectedCat}
                            expandedCats={expandedCats}
                            language={language}
                            onSelectCat={setSelectedCat}
                            onToggleCat={toggleCat}
                        />
                    </div>
                </div>
            )}

            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-60 shrink-0 mr-5 self-start sticky top-[80px]">
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-brand-navy text-white flex items-center gap-2">
                        <LayoutGrid size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide">
                            {t('Kategoriyalar', 'Категории', 'Categories')}
                        </span>
                    </div>
                    <div className="p-2 max-h-[70vh] overflow-y-auto">
                        <SidebarNav
                            activeCategories={activeCategories}
                            products={products}
                            selectedCat={selectedCat}
                            expandedCats={expandedCats}
                            language={language}
                            onSelectCat={setSelectedCat}
                            onToggleCat={toggleCat}
                        />
                    </div>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 min-w-0">
                {/* Toolbar */}
                <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3">
                    {/* Mobile filter btn */}
                    <button
                        type="button"
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden flex items-center gap-2 text-sm font-medium text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                    >
                        <SlidersHorizontal size={14} /> {t('Filtr', 'Фильтр')}
                    </button>

                    {/* Search */}
                    <div className="relative flex-1 min-w-[160px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('Mahsulot qidirish...', 'Поиск товаров...', 'Search products...')}
                            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 transition-colors"
                        />
                    </div>

                    {/* Sort */}
                    <select
                        value={sort}
                        onChange={e => setSort(e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
                    >
                        {SORT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>
                                {lbl({ uz: o.uz, ru: o.ru, en: o.en, zh: o.zh, tr: o.tr })}
                            </option>
                        ))}
                    </select>

                    {/* Count */}
                    <span className="text-sm text-gray-500 whitespace-nowrap">
                        {filtered.length} {t('ta', 'шт')}
                    </span>

                    {/* View mode */}
                    <div className="flex border border-gray-200 rounded-lg overflow-hidden ml-auto">
                        <button type="button" onClick={() => setViewMode('grid')} className={`p-1.5 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <LayoutGrid size={16} />
                        </button>
                        <button type="button" onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <List size={16} />
                        </button>
                    </div>
                </div>

                {/* Active category breadcrumb */}
                {selectedCatObj && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                        <button type="button" onClick={() => setSelectedCat(null)} className="hover:text-blue-600 transition-colors">
                            {t('Barcha mahsulotlar', 'Все товары')}
                        </button>
                        <ChevronRight size={14} />
                        <span className="text-gray-900 font-semibold">{translateCategory(selectedCatObj.slug, language)}</span>
                        <button type="button" onClick={() => setSelectedCat(null)} className="ml-2 text-gray-400 hover:text-red-500">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Products */}
                {loading ? (
                    <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-100 animate-pulse">
                                <div className={`bg-gray-200 ${viewMode === 'grid' ? 'h-44' : 'h-28'}`} />
                                <div className="p-3 space-y-2">
                                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                                    <div className="h-4 bg-gray-200 rounded" />
                                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
                        <Package size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-500 text-sm">{t("Mahsulot topilmadi", "Товары не найдены", "No products found")}</p>
                        <button type="button" onClick={() => { setSearch(''); setSelectedCat(null); }} className="mt-4 text-blue-600 hover:underline text-sm">
                            {t("Filtrlarni tozalash", "Сбросить фильтры", "Clear filters")}
                        </button>
                    </div>
                ) : (
                    <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                        {filtered.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                viewMode={viewMode}
                                qty={quantities[product.id] ?? 1}
                                language={language}
                                isInWishlist={isInWishlist(String(product.id))}
                                onSetQty={setQty}
                                onAddToCart={handleAddToCart}
                                onToggleWishlist={handleToggleWishlist}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
