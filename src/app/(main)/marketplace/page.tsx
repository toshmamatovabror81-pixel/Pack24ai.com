'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    Store,
    MapPin,
    Star,
    Truck,
    ShieldCheck,
    Leaf,
    Search,
    SlidersHorizontal,
    X,
    Loader2,
    Phone,
    ChevronDown,
    Package,
    BadgeCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Slider } from '@/components/ui/Slider';
import { Checkbox } from '@/components/ui/Checkbox';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/Sheet';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';

// ─── i18n ─────────────────────────────────────────────────────────────────────
type LangKey = 'uz' | 'ru' | 'en';

const TX: Record<string, Record<LangKey, string>> = {
    title:             { uz: "Yetkazib beruvchilar bozori", ru: "Маркетплейс поставщиков", en: "Supplier Marketplace" },
    subtitle:          { uz: "O'zbek qadoqlash materiallari yetkazib beruvchilarini toping", ru: "Найдите поставщиков упаковочных материалов Узбекистана", en: "Find Uzbekistan packaging material suppliers" },
    searchPlaceholder: { uz: "Yetkazib beruvchi qidirish...", ru: "Поиск поставщика...", en: "Search supplier..." },
    suppliers:         { uz: "Yetkazib beruvchilar", ru: "Поставщики", en: "Suppliers" },
    avgRating:         { uz: "O'rtacha reyting", ru: "Средний рейтинг", en: "Avg. rating" },
    materials:         { uz: "Materiallar", ru: "Материалы", en: "Materials" },
    filters:           { uz: "Filtrlar", ru: "Фильтры", en: "Filters" },
    materialType:      { uz: "Material turi", ru: "Тип материала", en: "Material type" },
    location:          { uz: "Joylashuv", ru: "Расположение", en: "Location" },
    allLocations:      { uz: "Barcha shaharlar", ru: "Все города", en: "All cities" },
    priceRange:        { uz: "Narx oralig'i (UZS/kg)", ru: "Диапазон цен (UZS/кг)", en: "Price range (UZS/kg)" },
    ecoOnly:           { uz: "Faqat eko-do'st", ru: "Только экологичные", en: "Eco-friendly only" },
    certifiedOnly:     { uz: "Faqat sertifikatlangan", ru: "Только сертифицированные", en: "Only certified" },
    clearFilters:      { uz: "Filtrlarni tozalash", ru: "Очистить фильтры", en: "Clear filters" },
    contact:           { uz: "Aloqa qilish", ru: "Связаться", en: "Contact" },
    responseTime:      { uz: "Javob vaqti", ru: "Время ответа", en: "Response time" },
    minOrder:          { uz: "Min. buyurtma", ru: "Мин. заказ", en: "Min. order" },
    verified:          { uz: "Tasdiqlangan", ru: "Проверенный", en: "Verified" },
    eco:               { uz: "Eko", ru: "Эко", en: "Eco" },
    delivery:          { uz: "Yetkazish", ru: "Доставка", en: "Delivery" },
    noResults:         { uz: "Hech qanday yetkazib beruvchi topilmadi", ru: "Поставщики не найдены", en: "No suppliers found" },
    noResultsDesc:     { uz: "Filtrlarni o'zgartiring yoki qidiruv so'zini tekshiring", ru: "Измените фильтры или проверьте поисковый запрос", en: "Adjust your filters or check search query" },
    ctaTitle:          { uz: "Yetkazib beruvchi sifatida ro'yxatdan o'ting", ru: "Зарегистрируйтесь как поставщик", en: "Register as a supplier" },
    ctaDesc:           { uz: "Pack24 bozorida o'z mahsulotlaringizni sotishni boshlang", ru: "Начните продавать свою продукцию на маркетплейсе Pack24", en: "Start selling your products on the Pack24 marketplace" },
    ctaButton:         { uz: "Ro'yxatdan o'tish", ru: "Зарегистрироваться", en: "Register" },
    sortBy:            { uz: "Saralash", ru: "Сортировка", en: "Sort by" },
    sortDefault:       { uz: "Standart", ru: "По умолчанию", en: "Default" },
    sortRating:        { uz: "Reyting bo'yicha", ru: "По рейтингу", en: "By rating" },
    sortPrice:         { uz: "Narx bo'yicha", ru: "По цене", en: "By price" },
    reviews:           { uz: "sharh", ru: "отзывов", en: "reviews" },
    perKg:             { uz: "so'm/kg", ru: "сум/кг", en: "UZS/kg" },
    loading:           { uz: "Yuklanmoqda...", ru: "Загрузка...", en: "Loading..." },
};

// ─── Material and location options ────────────────────────────────────────────
const MATERIAL_OPTIONS = [
    "Gofra karton",
    "Kraft qog'oz",
    "Linerboard",
    "Plastik plyonka",
    "Stretch plyonka",
    "Pufakchali plyonka",
    "Karton quti",
    "Bioplyonka",
    "Qayta ishlangan karton",
];

const LOCATION_OPTIONS = [
    "Toshkent",
    "Samarqand",
    "Buxoro",
    "Farg'ona",
    "Andijon",
    "Namangan",
    "Navoiy",
    "Qashqadaryo",
    "Xorazm",
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface PriceRange {
    min: number;
    max: number;
    currency: string;
}

interface Supplier {
    id: number;
    name: string;
    location: string;
    materials: string[];
    rating: number;
    reviewCount: number;
    minOrderKg: number;
    priceRange: PriceRange;
    delivery: boolean;
    certified: boolean;
    ecoFriendly: boolean;
    responseTime: string;
    image: string | null;
}

interface SupplierStats {
    totalSuppliers: number;
    averageRating: number;
    totalMaterials: number;
}

interface ApiResponse {
    suppliers: Supplier[];
    stats: SupplierStats;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function t(key: string, lang: string): string {
    const l = (['uz', 'ru', 'en'].includes(lang) ? lang : 'uz') as LangKey;
    return TX[key]?.[l] ?? key;
}

function renderStars(rating: number) {
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.3;
    const stars: React.ReactNode[] = [];
    for (let i = 0; i < 5; i++) {
        if (i < full) {
            stars.push(<Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />);
        } else if (i === full && hasHalf) {
            stars.push(
                <span key={i} className="relative inline-block h-4 w-4">
                    <Star className="absolute h-4 w-4 text-gray-200" />
                    <span className="absolute inset-0 overflow-hidden w-1/2">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    </span>
                </span>
            );
        } else {
            stars.push(<Star key={i} className="h-4 w-4 text-gray-200" />);
        }
    }
    return stars;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MarketplacePage() {
    const { language } = useLanguage();
    const { format } = useCurrencySafe();

    // Data
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 15000]);
    const [ecoOnly, setEcoOnly] = useState(false);
    const [certifiedOnly, setCertifiedOnly] = useState(false);
    const [sort, setSort] = useState('');
    const [sortOpen, setSortOpen] = useState(false);

    // Fetch
    useEffect(() => {
        setLoading(true);
        fetch('/api/marketplace/suppliers')
            .then(async (res) => {
                if (!res.ok) throw new Error('Fetch error');
                return res.json() as Promise<ApiResponse>;
            })
            .then((d) => {
                setData(d);
                setError(null);
            })
            .catch(() => setError('Server xatosi'))
            .finally(() => setLoading(false));
    }, []);

    // Client-side filtering
    const filtered = useMemo(() => {
        if (!data) return [];
        let list = [...data.suppliers];

        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (s) =>
                    s.name.toLowerCase().includes(q) ||
                    s.materials.some((m) => m.toLowerCase().includes(q)) ||
                    s.location.toLowerCase().includes(q)
            );
        }

        // Materials
        if (selectedMaterials.length > 0) {
            list = list.filter((s) =>
                selectedMaterials.some((mat) =>
                    s.materials.some((m) => m.toLowerCase() === mat.toLowerCase())
                )
            );
        }

        // Location
        if (selectedLocation) {
            list = list.filter(
                (s) => s.location.toLowerCase() === selectedLocation.toLowerCase()
            );
        }

        // Price range
        list = list.filter(
            (s) =>
                s.priceRange.min >= priceRange[0] && s.priceRange.max <= priceRange[1]
        );

        // Eco
        if (ecoOnly) list = list.filter((s) => s.ecoFriendly);

        // Certified
        if (certifiedOnly) list = list.filter((s) => s.certified);

        // Sort
        if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
        else if (sort === 'price') list.sort((a, b) => a.priceRange.min - b.priceRange.min);

        return list;
    }, [data, search, selectedMaterials, selectedLocation, priceRange, ecoOnly, certifiedOnly, sort]);

    const clearFilters = useCallback(() => {
        setSearch('');
        setSelectedMaterials([]);
        setSelectedLocation('');
        setPriceRange([0, 15000]);
        setEcoOnly(false);
        setCertifiedOnly(false);
        setSort('');
    }, []);

    const hasActiveFilters =
        search || selectedMaterials.length > 0 || selectedLocation || ecoOnly || certifiedOnly || priceRange[0] > 0 || priceRange[1] < 15000;

    const toggleMaterial = useCallback((mat: string) => {
        setSelectedMaterials((prev) =>
            prev.includes(mat) ? prev.filter((m) => m !== mat) : [...prev, mat]
        );
    }, []);

    // ─── Filter sidebar content (reused in desktop & mobile sheet) ────────────
    const filterContent = (
        <div className="space-y-6">
            {/* Material type */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('materialType', language)}
                </h3>
                <div className="space-y-2">
                    {MATERIAL_OPTIONS.map((mat) => (
                        <label
                            key={mat}
                            className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <Checkbox
                                checked={selectedMaterials.includes(mat)}
                                onCheckedChange={() => toggleMaterial(mat)}
                            />
                            {mat}
                        </label>
                    ))}
                </div>
            </div>

            {/* Location */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {t('location', language)}
                </h3>
                <div className="relative">
                    <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                        <option value="">{t('allLocations', language)}</option>
                        {LOCATION_OPTIONS.map((loc) => (
                            <option key={loc} value={loc}>
                                {loc}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {/* Price range */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    {t('priceRange', language)}
                </h3>
                <Slider
                    min={0}
                    max={15000}
                    step={500}
                    value={priceRange}
                    onValueChange={(v) => setPriceRange(v as [number, number])}
                />
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>{priceRange[0].toLocaleString('ru-RU')}</span>
                    <span>{priceRange[1].toLocaleString('ru-RU')}</span>
                </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-700 flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-green-500" />
                        {t('ecoOnly', language)}
                    </span>
                    <Switch checked={ecoOnly} onCheckedChange={setEcoOnly} />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-700 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-blue-500" />
                        {t('certifiedOnly', language)}
                    </span>
                    <Switch checked={certifiedOnly} onCheckedChange={setCertifiedOnly} />
                </label>
            </div>

            {/* Clear */}
            {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="w-full text-red-500 hover:text-red-600" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    {t('clearFilters', language)}
                </Button>
            )}
        </div>
    );

    // ─── Loading skeleton ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6fa]">
                {/* Hero skeleton */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 py-16">
                    <div className="max-w-5xl mx-auto space-y-4">
                        <div className="h-10 w-72 bg-white/20 rounded-lg animate-pulse" />
                        <div className="h-5 w-96 bg-white/10 rounded animate-pulse" />
                        <div className="h-12 w-full max-w-lg bg-white/20 rounded-xl animate-pulse mt-6" />
                        <div className="flex gap-6 mt-6">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-16 w-36 bg-white/10 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    </div>
                </div>
                {/* Content skeleton */}
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="flex gap-6">
                        <div className="hidden lg:block w-64 shrink-0 space-y-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
                            ))}
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-64 bg-white rounded-xl animate-pulse" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center">
                <div className="text-center space-y-3">
                    <Store className="h-12 w-12 text-gray-300 mx-auto" />
                    <p className="text-gray-500">{error}</p>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        Qayta yuklash
                    </Button>
                </div>
            </div>
        );
    }

    const stats = data?.stats;

    return (
        <div className="min-h-screen bg-[#f5f6fa]">
            {/* ─── Hero ────────────────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-12 sm:py-16 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
                <div className="max-w-5xl mx-auto relative z-10">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
                        🏪 {t('title', language)}
                    </h1>
                    <p className="text-blue-100 mt-2 text-base sm:text-lg max-w-2xl">
                        {t('subtitle', language)}
                    </p>

                    {/* Search bar */}
                    <div className="mt-6 relative max-w-xl">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t('searchPlaceholder', language)}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white rounded-xl text-gray-800 text-[15px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 shadow-lg"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <X className="h-4 w-4 text-gray-400" />
                            </button>
                        )}
                    </div>

                    {/* Stats */}
                    {stats && (
                        <div className="flex flex-wrap gap-4 sm:gap-6 mt-8">
                            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 text-white">
                                <div className="text-2xl font-bold">{stats.totalSuppliers}</div>
                                <div className="text-blue-100 text-sm">{t('suppliers', language)}</div>
                            </div>
                            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 text-white">
                                <div className="text-2xl font-bold flex items-center gap-1">
                                    <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                                    {stats.averageRating}
                                </div>
                                <div className="text-blue-100 text-sm">{t('avgRating', language)}</div>
                            </div>
                            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 text-white">
                                <div className="text-2xl font-bold">{stats.totalMaterials}</div>
                                <div className="text-blue-100 text-sm">{t('materials', language)}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Content ─────────────────────────────────────────────────────────── */}
            <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
                {/* Mobile filter trigger + sort */}
                <div className="flex items-center justify-between mb-4 lg:hidden">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <SlidersHorizontal className="h-4 w-4" />
                                {t('filters', language)}
                                {hasActiveFilters && (
                                    <span className="ml-1 h-5 w-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center">
                                        !
                                    </span>
                                )}
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="overflow-y-auto">
                            <h2 className="text-lg font-semibold mb-6">{t('filters', language)}</h2>
                            {filterContent}
                        </SheetContent>
                    </Sheet>

                    {/* Sort dropdown */}
                    <div className="relative">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setSortOpen(!sortOpen)}
                        >
                            {t('sortBy', language)}
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                        {sortOpen && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 min-w-[160px]">
                                {[
                                    { value: '', label: t('sortDefault', language) },
                                    { value: 'rating', label: t('sortRating', language) },
                                    { value: 'price', label: t('sortPrice', language) },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${sort === opt.value ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                                        onClick={() => {
                                            setSort(opt.value);
                                            setSortOpen(false);
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-6">
                    {/* ─── Desktop sidebar ─────────────────────────────────────────── */}
                    <aside className="hidden lg:block w-64 shrink-0">
                        <Card className="sticky top-24">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <SlidersHorizontal className="h-4 w-4" />
                                    {t('filters', language)}
                                </h2>
                            </div>
                            {filterContent}

                            {/* Desktop sort */}
                            <div className="mt-6 pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('sortBy', language)}</h3>
                                <div className="space-y-1">
                                    {[
                                        { value: '', label: t('sortDefault', language) },
                                        { value: 'rating', label: t('sortRating', language) },
                                        { value: 'price', label: t('sortPrice', language) },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${sort === opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                                            onClick={() => setSort(opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </aside>

                    {/* ─── Supplier grid ────────────────────────────────────────────── */}
                    <main className="flex-1 min-w-0">
                        {filtered.length === 0 ? (
                            /* Empty state */
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                    <Search className="h-8 w-8 text-gray-300" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-700">
                                    {t('noResults', language)}
                                </h3>
                                <p className="text-gray-500 text-sm mt-1 max-w-md">
                                    {t('noResultsDesc', language)}
                                </p>
                                {hasActiveFilters && (
                                    <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                                        {t('clearFilters', language)}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filtered.map((supplier) => (
                                    <SupplierCard
                                        key={supplier.id}
                                        supplier={supplier}
                                        lang={language}
                                        format={format}
                                    />
                                ))}
                            </div>
                        )}

                        {/* ─── CTA Banner ──────────────────────────────────────────── */}
                        <div className="mt-10 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-8 sm:px-10 sm:py-10 text-center relative overflow-hidden">
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
                            <div className="relative z-10">
                                <BadgeCheck className="h-10 w-10 text-blue-200 mx-auto mb-3" />
                                <h3 className="text-xl sm:text-2xl font-bold text-white">
                                    {t('ctaTitle', language)}
                                </h3>
                                <p className="text-blue-100 mt-2 max-w-lg mx-auto text-sm sm:text-base">
                                    {t('ctaDesc', language)}
                                </p>
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    className="mt-6 rounded-full font-semibold shadow-md"
                                >
                                    {t('ctaButton', language)}
                                </Button>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}

// ─── Supplier Card ────────────────────────────────────────────────────────────
function SupplierCard({
    supplier,
    lang,
    format,
}: {
    supplier: Supplier;
    lang: string;
    format: (p: number) => string;
}) {
    return (
        <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                        <Store className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{supplier.name}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {supplier.location}
                        </p>
                    </div>
                </div>
                {/* Response time */}
                <span className="text-[11px] text-gray-400 whitespace-nowrap mt-1">
                    ⚡ {supplier.responseTime}
                </span>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2 mt-3">
                <div className="flex items-center gap-0.5">{renderStars(supplier.rating)}</div>
                <span className="text-sm font-semibold text-gray-700">{supplier.rating}</span>
                <span className="text-xs text-gray-400">
                    ({supplier.reviewCount} {t('reviews', lang)})
                </span>
            </div>

            {/* Materials tags */}
            <div className="flex flex-wrap gap-1.5 mt-3">
                {supplier.materials.map((mat) => (
                    <Badge key={mat} variant="secondary" className="text-[11px]">
                        {mat}
                    </Badge>
                ))}
            </div>

            {/* Price & min order */}
            <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="text-gray-700 font-medium">
                    {format(supplier.priceRange.min)} – {format(supplier.priceRange.max)}
                    <span className="text-gray-400 font-normal"> /kg</span>
                </span>
                <span className="text-gray-400 text-xs">
                    {t('minOrder', lang)}: {supplier.minOrderKg} kg
                </span>
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
                {supplier.certified && (
                    <Badge variant="info" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {t('verified', lang)} ✓
                    </Badge>
                )}
                {supplier.ecoFriendly && (
                    <Badge variant="success" className="gap-1">
                        <Leaf className="h-3 w-3" />
                        {t('eco', lang)} 🌿
                    </Badge>
                )}
                {supplier.delivery && (
                    <Badge variant="neutral" className="gap-1">
                        <Truck className="h-3 w-3" />
                        {t('delivery', lang)} 🚚
                    </Badge>
                )}
            </div>

            {/* Contact button */}
            <div className="mt-auto pt-4">
                <Button variant="primary" size="sm" className="w-full gap-2">
                    <Phone className="h-4 w-4" />
                    {t('contact', lang)}
                </Button>
            </div>
        </Card>
    );
}
