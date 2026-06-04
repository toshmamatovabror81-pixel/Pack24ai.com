'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import { useCartStore } from '@/lib/store/useCartStore';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import {
    ArrowLeft, ShoppingCart, RefreshCw, TrendingUp,
    Calendar, Package, Loader2, Zap, Clock,
} from 'lucide-react';
import type { Language } from '@/lib/translations';

// ── i18n ─────────────────────────────────────────────────────────
const TX: Record<string, Partial<Record<Language, string>>> = {
    pageTitle:       { uz: '🔄 Aqlli Qayta Buyurtma', ru: '🔄 Умный повторный заказ', en: '🔄 Smart Reorder' },
    back:            { uz: 'Buyurtmalar', ru: 'Заказы', en: 'Orders' },
    loading:         { uz: 'Yuklanmoqda...', ru: 'Загрузка...', en: 'Loading...' },
    loginRequired:   { uz: 'Tizimga kiring', ru: 'Войдите в систему', en: 'Please login' },
    loginBtn:        { uz: 'Kirish', ru: 'Войти', en: 'Login' },
    reorderDue:      { uz: 'Qayta buyurtma vaqti keldi!', ru: 'Пора повторить заказ!', en: 'Time to reorder!' },
    reorderDueDesc:  { uz: "O'rtacha intervalingiz asosida qayta buyurtma berish tavsiya qilinadi", ru: 'Рекомендуем повторить заказ на основе вашего среднего интервала', en: 'Based on your average interval, it\'s recommended to reorder' },
    daysSinceLast:   { uz: 'Oxirgi buyurtmadan beri', ru: 'С последнего заказа', en: 'Since last order' },
    days:            { uz: 'kun', ru: 'дней', en: 'days' },
    avgInterval:     { uz: "O'rtacha interval", ru: 'Средний интервал', en: 'Average interval' },
    suggestedDate:   { uz: 'Tavsiya etilgan sana', ru: 'Рекомендуемая дата', en: 'Suggested date' },
    frequentItems:   { uz: 'Tez-tez buyurtiladigan mahsulotlar', ru: 'Часто заказываемые товары', en: 'Frequently ordered products' },
    avgQty:          { uz: "O'rtacha miqdor", ru: 'Среднее кол-во', en: 'Avg quantity' },
    suggestedQty:    { uz: 'Tavsiya', ru: 'Рекомендация', en: 'Suggested' },
    lastPrice:       { uz: 'Oxirgi narx', ru: 'Последняя цена', en: 'Last price' },
    ordered:         { uz: 'marta buyurtma', ru: 'раз заказано', en: 'times ordered' },
    addToCart:       { uz: 'Savatga', ru: 'В корзину', en: 'Add to cart' },
    addAllToCart:    { uz: 'Barchasini savatga', ru: 'Всё в корзину', en: 'Add all to cart' },
    addedToCart:     { uz: 'Savatga qo\'shildi', ru: 'Добавлено в корзину', en: 'Added to cart' },
    allAddedToCart:  { uz: 'Barcha mahsulotlar savatga qo\'shildi', ru: 'Все товары добавлены в корзину', en: 'All products added to cart' },
    totalOrders:     { uz: 'Jami buyurtmalar', ru: 'Всего заказов', en: 'Total orders' },
    totalSpent:      { uz: 'Jami xarid', ru: 'Всего потрачено', en: 'Total spent' },
    noData:          { uz: 'Yetarli ma\'lumot yo\'q', ru: 'Недостаточно данных', en: 'Not enough data' },
    noDataDesc:      { uz: 'Tavsiyalar uchun kamida 1 ta yetkazib berilgan buyurtma kerak', ru: 'Для рекомендаций нужен хотя бы 1 доставленный заказ', en: 'At least 1 delivered order is needed for recommendations' },
    orderStats:      { uz: 'Buyurtma statistikasi', ru: 'Статистика заказов', en: 'Order statistics' },
    oneClick:        { uz: '1-klik bilan buyurtma', ru: 'Заказ в 1 клик', en: '1-click order' },
};

const t = (key: string, lang: Language): string =>
    TX[key]?.[lang] ?? TX[key]?.['en'] ?? key;

// ── Types ────────────────────────────────────────────────────────
interface FrequentProduct {
    productId: number;
    name: string;
    image: string;
    averageQuantity: number;
    suggestedQuantity: number;
    lastPrice: number;
    totalOrdered: number;
    suggestion: string;
}

interface SmartReorderData {
    lastOrderDate: string | null;
    averageIntervalDays: number;
    suggestedReorderDate: string | null;
    isReorderDue: boolean;
    frequentProducts: FrequentProduct[];
    totalOrderCount: number;
    totalSpent: number;
}

export default function SmartReorderPage() {
    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const { status } = useSession();
    const addToCart = useCartStore(s => s.addToCart);

    const [data, setData] = useState<SmartReorderData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status !== 'authenticated') {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/orders/smart-reorder');
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (e) {
                console.error('Failed to fetch smart reorder data', e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [status]);

    const handleAddToCart = (product: FrequentProduct) => {
        addToCart({
            productId: product.productId,
            name: product.name,
            price: product.lastPrice,
            image: product.image,
            quantity: product.suggestedQuantity,
        });
        toast.success(t('addedToCart', language));
    };

    const handleAddAllToCart = () => {
        if (!data) return;
        for (const product of data.frequentProducts) {
            addToCart({
                productId: product.productId,
                name: product.name,
                price: product.lastPrice,
                image: product.image,
                quantity: product.suggestedQuantity,
            });
        }
        toast.success(t('allAddedToCart', language));
    };

    // ── Auth loading ──
    if (status === 'loading') {
        return (
            <div className="min-h-[70vh] bg-surface-page flex flex-col items-center justify-center p-8 text-center">
                <Loader2 size={28} className="animate-spin text-blue-500" />
            </div>
        );
    }

    // ── Login required ──
    if (status !== 'authenticated') {
        return (
            <div className="min-h-[70vh] bg-surface-page flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-5 shadow-sm border border-gray-100">
                    <Package size={40} className="text-gray-200" />
                </div>
                <h1 className="text-xl font-extrabold text-gray-900 mb-2">{t('loginRequired', language)}</h1>
                <Link href="/login" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl text-sm transition-colors">
                    {t('loginBtn', language)}
                </Link>
            </div>
        );
    }

    // ── Compute days since last order ──
    const daysSinceLast = data?.lastOrderDate
        ? Math.round((Date.now() - new Date(data.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return (
        <div className="min-h-screen bg-surface-page">
            {/* Breadcrumb */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <nav className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Link href="/" className="hover:text-blue-600">🏠</Link>
                    <span>/</span>
                    <Link href="/my-orders" className="hover:text-blue-600">{t('back', language)}</Link>
                    <span>/</span>
                    <span className="text-gray-800 font-medium">Smart Reorder</span>
                </nav>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/my-orders" className="p-2 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                        <ArrowLeft size={16} className="text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900">{t('pageTitle', language)}</h1>
                        {data && (
                            <p className="text-xs text-gray-400">
                                {data.totalOrderCount} {t('totalOrders', language).toLowerCase()}
                            </p>
                        )}
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 size={28} className="animate-spin text-blue-500" />
                        <p className="text-sm text-gray-400">{t('loading', language)}</p>
                    </div>
                )}

                {/* No data state */}
                {!loading && (!data || data.totalOrderCount === 0) && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
                            <RefreshCw size={36} className="text-gray-200" />
                        </div>
                        <h2 className="text-lg font-extrabold text-gray-900 mb-2">{t('noData', language)}</h2>
                        <p className="text-sm text-gray-400 mb-6">{t('noDataDesc', language)}</p>
                        <Link
                            href="/catalog"
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-lg shadow-blue-200"
                        >
                            <ShoppingCart size={14} />
                            {language === 'ru' ? 'Перейти в каталог' : language === 'en' ? 'Go to Catalog' : "Katalogga o'tish"}
                        </Link>
                    </div>
                )}

                {/* Main content */}
                {!loading && data && data.totalOrderCount > 0 && (
                    <div className="space-y-5">
                        {/* Reorder Due Banner */}
                        {data.isReorderDue && (
                            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4">
                                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
                                    <Zap size={24} className="text-emerald-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-extrabold text-emerald-800 text-base mb-1">
                                        {t('reorderDue', language)}
                                    </h3>
                                    <p className="text-sm text-emerald-600">
                                        {t('reorderDueDesc', language)}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Status Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Days since last order */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                                        <Clock size={18} className="text-blue-600" />
                                    </div>
                                    <p className="text-xs text-gray-400 font-medium">{t('daysSinceLast', language)}</p>
                                </div>
                                <p className="text-2xl font-extrabold text-gray-900">
                                    {daysSinceLast} <span className="text-sm font-bold text-gray-400">{t('days', language)}</span>
                                </p>
                            </div>

                            {/* Average interval */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                                        <TrendingUp size={18} className="text-purple-600" />
                                    </div>
                                    <p className="text-xs text-gray-400 font-medium">{t('avgInterval', language)}</p>
                                </div>
                                <p className="text-2xl font-extrabold text-gray-900">
                                    {data.averageIntervalDays || '—'} <span className="text-sm font-bold text-gray-400">{t('days', language)}</span>
                                </p>
                            </div>

                            {/* Suggested date */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                                        <Calendar size={18} className="text-amber-600" />
                                    </div>
                                    <p className="text-xs text-gray-400 font-medium">{t('suggestedDate', language)}</p>
                                </div>
                                <p className="text-2xl font-extrabold text-gray-900">
                                    {data.suggestedReorderDate
                                        ? new Date(data.suggestedReorderDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })
                                        : '—'
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                    <Package size={18} className="text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{t('totalOrders', language)}</p>
                                    <p className="text-lg font-extrabold text-gray-900">{data.totalOrderCount}</p>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                                    <TrendingUp size={18} className="text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{t('totalSpent', language)}</p>
                                    <p className="text-lg font-extrabold text-gray-900">{format(data.totalSpent)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Frequent Products */}
                        {data.frequentProducts.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-extrabold text-gray-900">{t('frequentItems', language)}</h2>
                                    <button
                                        onClick={handleAddAllToCart}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-blue-200"
                                    >
                                        <ShoppingCart size={14} />
                                        {t('addAllToCart', language)}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {data.frequentProducts.map(product => (
                                        <div
                                            key={product.productId}
                                            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-blue-200 transition-all"
                                        >
                                            <div className="flex items-start gap-4 p-4">
                                                {/* Product image */}
                                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                                                    {product.image ? (
                                                        <Image
                                                            src={product.image}
                                                            alt={product.name}
                                                            width={80}
                                                            height={80}
                                                            className="w-full h-full object-contain"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Package size={24} className="text-gray-200" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Product info */}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-gray-900 text-sm truncate">{product.name}</h3>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {product.totalOrdered} {t('ordered', language)} · {t('lastPrice', language)}: {format(product.lastPrice)}
                                                    </p>

                                                    {/* Quantity badges */}
                                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-50 text-gray-600 border border-gray-100">
                                                            {t('avgQty', language)}: {product.averageQuantity}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                                                            {t('suggestedQty', language)}: {product.suggestedQuantity}
                                                        </span>
                                                    </div>

                                                    {/* AI suggestion */}
                                                    {product.suggestion && (
                                                        <p className="text-[11px] text-indigo-600 mt-2 flex items-center gap-1">
                                                            <Zap size={10} className="shrink-0" />
                                                            {product.suggestion}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Add to cart button */}
                                                <button
                                                    onClick={() => handleAddToCart(product)}
                                                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-colors self-center"
                                                >
                                                    <ShoppingCart size={12} />
                                                    <span className="hidden sm:inline">{t('addToCart', language)}</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Bottom CTA */}
                                <button
                                    onClick={() => {
                                        handleAddAllToCart();
                                        window.location.href = '/cart';
                                    }}
                                    className="w-full mt-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-2xl text-sm transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                                >
                                    <Zap size={16} />
                                    {t('oneClick', language)}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
