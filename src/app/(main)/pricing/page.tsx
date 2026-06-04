'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import Link from 'next/link';
import {
    ChevronRight,
    Calculator,
    Percent,
    Gift,
    Zap,
    TrendingDown,
    Loader2,
    Package,
    ShoppingCart,
} from 'lucide-react';
import DynamicPriceCalculator from '@/components/DynamicPriceCalculator';

// ─── i18n ────────────────────────────────────────────────────────────────────
type LangKey = 'uz' | 'ru' | 'en';

const TX: Record<string, Record<LangKey, string>> = {
    home: {
        uz: 'Bosh sahifa',
        ru: 'Главная',
        en: 'Home',
    },
    pageTitle: {
        uz: 'Narx kalkulyatori',
        ru: 'Калькулятор цены',
        en: 'Price Calculator',
    },
    pageSubtitle: {
        uz: "Mahsulotni tanlang va miqdorga qarab chegirmani ko'ring",
        ru: 'Выберите товар и узнайте скидку в зависимости от количества',
        en: 'Select a product and see discounts based on quantity',
    },
    selectProduct: {
        uz: 'Mahsulotni tanlang',
        ru: 'Выберите товар',
        en: 'Select a product',
    },
    searchProduct: {
        uz: 'Mahsulotni qidirish...',
        ru: 'Поиск товара...',
        en: 'Search product...',
    },
    loadingProducts: {
        uz: 'Mahsulotlar yuklanmoqda...',
        ru: 'Загрузка товаров...',
        en: 'Loading products...',
    },
    noProducts: {
        uz: 'Mahsulotlar topilmadi',
        ru: 'Товары не найдены',
        en: 'No products found',
    },
    discountTiers: {
        uz: 'Chegirma bosqichlari',
        ru: 'Уровни скидок',
        en: 'Discount Tiers',
    },
    discountTiersDesc: {
        uz: "Buyurtma miqdoriga qarab avtomatik chegirma qo'llaniladi",
        ru: 'Скидки применяются автоматически в зависимости от количества',
        en: 'Discounts are applied automatically based on quantity',
    },
    quantity: {
        uz: 'Miqdor',
        ru: 'Количество',
        en: 'Quantity',
    },
    discount: {
        uz: 'Chegirma',
        ru: 'Скидка',
        en: 'Discount',
    },
    tier: {
        uz: 'Daraja',
        ru: 'Уровень',
        en: 'Tier',
    },
    orderNow: {
        uz: 'Hoziroq buyurtma bering',
        ru: 'Закажите прямо сейчас',
        en: 'Order Now',
    },
    orderNowDesc: {
        uz: "Chegirmalardan foydalaning va buyurtma bering!",
        ru: 'Воспользуйтесь скидками и оформите заказ!',
        en: 'Take advantage of discounts and place your order!',
    },
    goToCatalog: {
        uz: 'Katalogga o\'tish',
        ru: 'Перейти в каталог',
        en: 'Go to Catalog',
    },
    bonusVolume: {
        uz: 'Optom chegirma',
        ru: 'Оптовая скидка',
        en: 'Volume discount',
    },
    bonusLoyalty: {
        uz: 'Sodiq mijoz (3+ buyurtma)',
        ru: 'Постоянный клиент (3+ заказа)',
        en: 'Loyal customer (3+ orders)',
    },
    bonusSeason: {
        uz: 'Mavsumiy chegirma',
        ru: 'Сезонная скидка',
        en: 'Seasonal discount',
    },
    bonusBulk: {
        uz: 'Katta hajm + sodiq mijoz',
        ru: 'Большой объём + постоянный клиент',
        en: 'Bulk + loyal customer',
    },
    additionalBonuses: {
        uz: "Qo'shimcha bonuslar",
        ru: 'Дополнительные бонусы',
        en: 'Additional Bonuses',
    },
    additionalBonusesDesc: {
        uz: 'Optom chegirmadan tashqari yana qo\'shimcha imkoniyatlar',
        ru: 'Помимо оптовых скидок есть дополнительные возможности',
        en: 'Additional opportunities beyond volume discounts',
    },
};

// ─── Tier data ───────────────────────────────────────────────────────────────
interface TierRow {
    range: Record<LangKey, string>;
    discount: string;
    tier: Record<LangKey, string>;
    color: string;
    badge: string;
    icon: string;
}

const TIER_TABLE: TierRow[] = [
    {
        range: { uz: '1 — 99', ru: '1 — 99', en: '1 — 99' },
        discount: '0%',
        tier: { uz: 'Standart', ru: 'Стандарт', en: 'Standard' },
        color: 'border-gray-200 bg-gray-50',
        badge: 'bg-gray-100 text-gray-600',
        icon: '📦',
    },
    {
        range: { uz: '100 — 499', ru: '100 — 499', en: '100 — 499' },
        discount: '5%',
        tier: { uz: 'Kumush', ru: 'Серебро', en: 'Silver' },
        color: 'border-slate-300 bg-slate-50',
        badge: 'bg-slate-200 text-slate-700',
        icon: '🥈',
    },
    {
        range: { uz: '500 — 999', ru: '500 — 999', en: '500 — 999' },
        discount: '10%',
        tier: { uz: 'Oltin', ru: 'Золото', en: 'Gold' },
        color: 'border-amber-300 bg-amber-50',
        badge: 'bg-amber-100 text-amber-700',
        icon: '🥇',
    },
    {
        range: { uz: '1 000 — 4 999', ru: '1 000 — 4 999', en: '1,000 — 4,999' },
        discount: '15%',
        tier: { uz: 'Platinum', ru: 'Платинум', en: 'Platinum' },
        color: 'border-indigo-300 bg-indigo-50',
        badge: 'bg-indigo-100 text-indigo-700',
        icon: '💎',
    },
    {
        range: { uz: '5 000+', ru: '5 000+', en: '5,000+' },
        discount: '20%',
        tier: { uz: 'Olmos', ru: 'Бриллиант', en: 'Diamond' },
        color: 'border-cyan-300 bg-cyan-50',
        badge: 'bg-cyan-100 text-cyan-700',
        icon: '👑',
    },
];

const BONUS_ITEMS = [
    {
        key: 'bonusLoyalty',
        percent: '3%',
        icon: Gift,
        iconBg: 'bg-purple-100 text-purple-600',
    },
    {
        key: 'bonusSeason',
        percent: '2%',
        icon: Zap,
        iconBg: 'bg-orange-100 text-orange-600',
    },
    {
        key: 'bonusBulk',
        percent: '5%',
        icon: TrendingDown,
        iconBg: 'bg-emerald-100 text-emerald-600',
    },
];

// ─── Product type ────────────────────────────────────────────────────────────
interface ProductItem {
    id: number;
    name: string;
    price: number;
    image: string;
    category: string | null;
}

// ─── Page Component ──────────────────────────────────────────────────────────
export default function PricingPage() {
    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const lang = (['uz', 'ru', 'en'].includes(language) ? language : 'uz') as LangKey;
    const t = (key: string): string => TX[key]?.[lang] ?? key;

    const [products, setProducts] = useState<ProductItem[]>([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch products
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/products?status=active&limit=100');
                if (res.ok) {
                    const data = await res.json();
                    setProducts(
                        data.map((p: Record<string, unknown>) => ({
                            id: p.id as number,
                            name: p.name as string,
                            price: Number(p.price),
                            image: (p.image as string) || '/placeholder.png',
                            category: (p.category as string) || null,
                        }))
                    );
                }
            } catch {
                // Silently handle — products grid will show empty state
            } finally {
                setProductsLoading(false);
            }
        })();
    }, []);

    const filteredProducts = searchQuery.trim()
        ? products.filter((p) =>
              p.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : products;

    return (
        <div className="min-h-screen bg-surface-page">
            {/* ── Breadcrumb ── */}
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <nav className="flex items-center gap-2 text-sm text-gray-500">
                    <Link
                        href="/"
                        className="hover:text-blue-600 transition-colors"
                    >
                        {t('home')}
                    </Link>
                    <ChevronRight size={14} />
                    <span className="text-gray-900 font-medium">
                        {t('pageTitle')}
                    </span>
                </nav>
            </div>

            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
                    {t('pageTitle')}
                </h1>
                <p className="text-gray-500 text-sm mb-8">
                    {t('pageSubtitle')}
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
                    {/* ── Product selector — left column ── */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                                    <Package size={20} className="text-indigo-600" />
                                </div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {t('selectProduct')}
                                </h2>
                            </div>

                            <div className="p-4 border-b border-gray-100">
                                <input
                                    type="text"
                                    placeholder={t('searchProduct')}
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    className="w-full h-10 rounded-xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100">
                                {productsLoading ? (
                                    <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
                                        <Loader2
                                            size={18}
                                            className="animate-spin"
                                        />
                                        <span className="text-sm">
                                            {t('loadingProducts')}
                                        </span>
                                    </div>
                                ) : filteredProducts.length === 0 ? (
                                    <div className="py-12 text-center text-gray-400 text-sm">
                                        {t('noProducts')}
                                    </div>
                                ) : (
                                    filteredProducts.map((product) => (
                                        <button
                                            key={product.id}
                                            type="button"
                                            onClick={() =>
                                                setSelectedProduct(product)
                                            }
                                            className={`w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-blue-50/50 ${
                                                selectedProduct?.id ===
                                                product.id
                                                    ? 'bg-blue-50 border-l-4 border-blue-600'
                                                    : ''
                                            }`}
                                        >
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = '/placeholder.png';
                                                }}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-gray-900 truncate">
                                                    {product.name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {format(product.price)}
                                                </p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Calculator — right column ── */}
                    <div className="lg:col-span-3">
                        {selectedProduct ? (
                            <DynamicPriceCalculator
                                productId={selectedProduct.id}
                                basePrice={selectedProduct.price}
                                productName={selectedProduct.name}
                            />
                        ) : (
                            <div className="bg-white rounded-2xl border border-gray-200 flex items-center justify-center h-full min-h-[300px]">
                                <div className="text-center px-6">
                                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Calculator
                                            size={28}
                                            className="text-gray-400"
                                        />
                                    </div>
                                    <p className="text-gray-500 text-sm">
                                        {t('selectProduct')}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Discount Tiers Table ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                            <Percent size={20} className="text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {t('discountTiers')}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {t('discountTiersDesc')}
                            </p>
                        </div>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600">
                                        {t('quantity')}
                                    </th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600">
                                        {t('tier')}
                                    </th>
                                    <th className="px-6 py-3 text-right font-semibold text-gray-600">
                                        {t('discount')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {TIER_TABLE.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4">
                                            <span className="flex items-center gap-2">
                                                <span className="text-xl">
                                                    {row.icon}
                                                </span>
                                                <span className="font-medium text-gray-900">
                                                    {row.range[lang]}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-bold ${row.badge}`}
                                            >
                                                {row.tier[lang]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-green-700 text-base">
                                                {row.discount}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-gray-100">
                        {TIER_TABLE.map((row, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-4 p-4 border-l-4 ${row.color}`}
                            >
                                <span className="text-2xl shrink-0">
                                    {row.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.badge}`}
                                        >
                                            {row.tier[lang]}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {row.range[lang]} {t('quantity').toLowerCase()}
                                    </p>
                                </div>
                                <span className="font-bold text-green-700 text-lg shrink-0">
                                    {row.discount}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Additional Bonuses ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                            <Gift size={20} className="text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {t('additionalBonuses')}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {t('additionalBonusesDesc')}
                            </p>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {BONUS_ITEMS.map(
                            ({ key, percent, icon: Icon, iconBg }) => (
                                <div
                                    key={key}
                                    className="flex items-center gap-4 p-5"
                                >
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
                                    >
                                        <Icon size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {t(key)}
                                        </p>
                                    </div>
                                    <span className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full shrink-0">
                                        +{percent}
                                    </span>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* ── CTA ── */}
                <div className="bg-gradient-to-br from-brand-navy to-[#163860] rounded-2xl p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                        <h3 className="text-xl font-bold mb-2">
                            {t('orderNow')}
                        </h3>
                        <p className="text-blue-200/80 text-sm">
                            {t('orderNowDesc')}
                        </p>
                    </div>
                    <Link
                        href="/catalog"
                        className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5 shrink-0"
                    >
                        <ShoppingCart size={18} />
                        {t('goToCatalog')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
