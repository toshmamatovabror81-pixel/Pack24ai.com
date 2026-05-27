'use client';

import Image from 'next/image';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, TrendingUp, Package, Tag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCategoryStore } from '@/lib/store/useCategoryStore';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import Link from 'next/link';
import { CategoryIcon } from '@/components/CategoryIcon';
import { translateProductName, translateCategory } from '@/lib/product-translations';

// ─── Popular searches ──────────────────────────────────────────────────────
const POPULAR_SEARCHES = [
    { uz: 'Karton qutichalar', ru: 'Картонные коробки' },
    { uz: 'Kuryer paketlar',   ru: 'Курьерские пакеты' },
    { uz: 'Polietilen paketlar', ru: 'Полиэтиленовые пакеты' },
    { uz: 'Kraft paketlar',    ru: 'Крафт пакеты' },
];

interface SearchProduct {
    id: number | string;
    name: string;
    price: number;
    category?: string;
    image: string;
}

export function SmartSearch() {
    const router = useRouter();
    const { language } = useLanguage();
    const { format } = useCurrencySafe();

    const [query, setQuery]           = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [isOpen, setIsOpen]         = useState(false);
    const [isLoading, setIsLoading]   = useState(false);
    const [results, setResults]       = useState<SearchProduct[]>([]);
    const wrapperRef                  = useRef<HTMLDivElement>(null);
    const inputRef                    = useRef<HTMLInputElement>(null);

    const categories = useCategoryStore(s => s.categories);
    const t = (uz: string, ru: string) => language === 'ru' ? ru : uz;

    // ── Debounce (300ms) ──────────────────────────────────────────────────
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQ(query), 300);
        return () => clearTimeout(timer);
    }, [query]);

    // ── Server-side API qidiruv ───────────────────────────────────────────
    useEffect(() => {
        if (debouncedQ.length < 2) { setResults([]); setIsLoading(false); return; }
        setIsLoading(true);
        fetch(`/api/products?search=${encodeURIComponent(debouncedQ)}&status=active`)
            .then(r => r.ok ? r.json() : [])
            .then((data: SearchProduct[]) => setResults(data.slice(0, 6)))
            .catch(() => setResults([]))
            .finally(() => setIsLoading(false));
    }, [debouncedQ]);

    // ── Kategoriya filter (client-side, kam ma'lumot) ─────────────────────
    const filteredCats = debouncedQ.length > 1
        ? categories.filter(c => {
            const n = c.name as unknown as { ru?: string; uz?: string } | string;
            const nameRu = typeof n === 'object' ? (n.ru ?? '') : String(n);
            const nameUz = typeof n === 'object' ? (n.uz ?? '') : '';
            return nameRu.toLowerCase().includes(debouncedQ.toLowerCase())
                || nameUz.toLowerCase().includes(debouncedQ.toLowerCase());
        }).slice(0, 3)
        : [];

    const hasResults = results.length > 0 || filteredCats.length > 0;

    // ── Click outside ─────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
                setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSearch = useCallback(() => {
        if (query.trim()) {
            router.push(`/catalog?q=${encodeURIComponent(query.trim())}`);
            setIsOpen(false);
        }
    }, [query, router]);

    const getCatName = (cat: { name: { uz?: string; ru?: string; en?: string } | string }): string => {
        const n = cat.name;
        if (typeof n === 'object' && n !== null) {
            return language === 'uz' ? (n.uz || n.ru || '') : (n.ru || n.uz || '');
        }
        return String(n ?? '');
    };

    return (
        <div ref={wrapperRef} className="relative w-full max-w-3xl mx-auto z-30">
            {/* ── Input ──────────────────────────────────────────────────── */}
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {isLoading
                        ? <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        : <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                    }
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    className="block w-full pl-12 pr-32 py-4 border-2 border-transparent bg-white shadow-lg rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-base transition-all"
                    placeholder={t("Qadoqlash materialini qidiring...", "Поиск упаковочных материалов...")}
                    value={query}
                    onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    onFocus={() => setIsOpen(true)}
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => { setQuery(''); setDebouncedQ(''); setResults([]); inputRef.current?.focus(); }}
                        className="absolute inset-y-0 right-24 flex items-center pr-2 text-gray-400 hover:text-gray-600"
                        aria-label="Tozalash"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleSearch}
                    className="absolute inset-y-1.5 right-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 font-semibold text-sm transition-colors"
                >
                    {t("Qidirish", "Найти")}
                </button>
            </div>

            {/* ── Dropdown ───────────────────────────────────────────────── */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

                    {/* Popular searches (empty query) */}
                    {!debouncedQ && (
                        <div className="p-4">
                            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <TrendingUp size={11} /> {t("Ommabop qidiruvlar", "Популярные запросы")}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {POPULAR_SEARCHES.map(s => (
                                    <button
                                        key={s.uz}
                                        type="button"
                                        onClick={() => {
                                            const q = language === 'uz' ? s.uz : s.ru;
                                            setQuery(q);
                                            setDebouncedQ(q);
                                            setIsOpen(true);
                                        }}
                                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium transition-colors"
                                    >
                                        {language === 'uz' ? s.uz : s.ru}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading state */}
                    {isLoading && (
                        <div className="p-6 text-center">
                            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                    )}

                    {/* Results */}
                    {debouncedQ.length > 1 && !isLoading && (
                        <>
                            {/* Categories */}
                            {filteredCats.length > 0 && (
                                <div className="p-3 bg-gray-50/50 border-b border-gray-100">
                                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 px-1">
                                        <Tag size={11} /> {t("Kategoriyalar", "Категории")}
                                    </p>
                                    {filteredCats.map(cat => (
                                        <Link
                                            key={cat.id}
                                            href={`/catalog?category=${encodeURIComponent(getCatName(cat))}`}
                                            onClick={() => setIsOpen(false)}
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-gray-700 font-semibold text-sm"
                                        >
                                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                                <CategoryIcon name={cat.icon} className="w-4 h-4 text-blue-500" />
                                            </div>
                                            <span>{getCatName(cat)}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}

                            {/* Products */}
                            {results.length > 0 && (
                                <div className="p-3">
                                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 px-1">
                                        <Package size={11} /> {t("Mahsulotlar", "Товары")}
                                    </p>
                                    {results.map(product => {
                                        const translatedName = translateProductName(product.name, language);
                                        const translatedCategory = product.category
                                            ? translateCategory(product.category, language)
                                            : undefined;
                                        return (
                                        <Link
                                            key={product.id}
                                            href={`/product/${product.id}`}
                                            onClick={() => setIsOpen(false)}
                                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 rounded-xl transition-colors group"
                                        >
                                            <div className="w-10 h-10 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                                                {product.image && product.image !== '/placeholder.png' ? (
                                                    <Image src={product.image} alt={translatedName} className="w-full h-full object-contain" width={300} height={300} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">📦</div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700">{translatedName}</p>
                                                {translatedCategory && <p className="text-xs text-gray-400">{translatedCategory}</p>}
                                            </div>
                                            <span className="text-sm font-extrabold text-blue-600 shrink-0">{format(product.price)}</span>
                                        </Link>
                                        );
                                    })}
                                </div>
                            )}

                            {/* No results */}
                            {!hasResults && (
                                <div className="p-8 text-center">
                                    <p className="text-4xl mb-2">🔍</p>
                                    <p className="text-sm text-gray-500 font-medium">
                                        {t(`"${debouncedQ}" bo'yicha natija topilmadi`, `По запросу "${debouncedQ}" ничего не найдено`)}
                                    </p>
                                </div>
                            )}

                            {/* Footer */}
                            {hasResults && (
                                <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
                                    <button
                                        type="button"
                                        onClick={handleSearch}
                                        className="text-sm text-blue-600 font-semibold hover:underline"
                                    >
                                        {t("Barcha natijalarni ko'rish", "Смотреть все результаты")} ({results.length + filteredCats.length})
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
