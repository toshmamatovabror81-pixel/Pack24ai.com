'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import {
    TrendingDown,
    Percent,
    Gift,
    ArrowRight,
    Loader2,
    Minus,
    Plus,
    Zap,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DiscountLabel {
    uz: string;
    ru: string;
    en: string;
}

interface DiscountItem {
    type: string;
    percent: number;
    label: DiscountLabel;
}

interface NextTierInfo {
    name: string;
    quantityNeeded: number;
    additionalDiscount: number;
}

interface PricingData {
    productId: number;
    productName: string;
    basePrice: number;
    quantity: number;
    discounts: DiscountItem[];
    totalDiscount: number;
    unitPrice: number;
    totalPrice: number;
    savings: number;
    tier: string;
    nextTier: NextTierInfo | null;
}

interface DynamicPriceCalculatorProps {
    productId: number;
    basePrice: number;
    productName: string;
}

// ─── i18n ────────────────────────────────────────────────────────────────────
type LangKey = 'uz' | 'ru' | 'en';

const TX: Record<string, Record<LangKey, string>> = {
    title: {
        uz: 'Narx kalkulyatori',
        ru: 'Калькулятор цены',
        en: 'Price Calculator',
    },
    quantity: {
        uz: 'Miqdor',
        ru: 'Количество',
        en: 'Quantity',
    },
    basePrice: {
        uz: 'Asosiy narx',
        ru: 'Базовая цена',
        en: 'Base price',
    },
    perUnit: {
        uz: 'dona uchun',
        ru: 'за штуку',
        en: 'per unit',
    },
    discounts: {
        uz: 'Chegirmalar',
        ru: 'Скидки',
        en: 'Discounts',
    },
    finalPrice: {
        uz: 'Yakuniy narx',
        ru: 'Итоговая цена',
        en: 'Final price',
    },
    totalPrice: {
        uz: 'Jami summa',
        ru: 'Общая сумма',
        en: 'Total',
    },
    savings: {
        uz: 'Tejash',
        ru: 'Экономия',
        en: 'Savings',
    },
    nextTierHint: {
        uz: '{qty} dona buyurtma bering va qo\'shimcha {pct}% chegirma oling!',
        ru: 'Закажите {qty} шт. и получите дополнительно {pct}% скидки!',
        en: 'Order {qty} units and get an extra {pct}% discount!',
    },
    progressToNext: {
        uz: 'Keyingi bosqichga',
        ru: 'До следующего уровня',
        en: 'To next tier',
    },
    noDiscounts: {
        uz: 'Hozircha chegirma yo\'q. Miqdorni oshiring!',
        ru: 'Пока без скидки. Увеличьте количество!',
        en: 'No discounts yet. Increase quantity!',
    },
    loading: {
        uz: 'Hisoblanmoqda...',
        ru: 'Рассчитываем...',
        en: 'Calculating...',
    },
    error: {
        uz: 'Xatolik yuz berdi',
        ru: 'Произошла ошибка',
        en: 'An error occurred',
    },
    tier: {
        uz: 'Daraja',
        ru: 'Уровень',
        en: 'Tier',
    },
};

const TIER_NAMES: Record<string, Record<LangKey, string>> = {
    standard: { uz: 'Standart', ru: 'Стандарт', en: 'Standard' },
    silver: { uz: 'Kumush', ru: 'Серебро', en: 'Silver' },
    gold: { uz: 'Oltin', ru: 'Золото', en: 'Gold' },
    platinum: { uz: 'Platinum', ru: 'Платинум', en: 'Platinum' },
    diamond: { uz: 'Olmos', ru: 'Бриллиант', en: 'Diamond' },
};

const TIER_COLORS: Record<string, string> = {
    standard: 'bg-gray-100 text-gray-700',
    silver: 'bg-slate-200 text-slate-700',
    gold: 'bg-amber-100 text-amber-700',
    platinum: 'bg-indigo-100 text-indigo-700',
    diamond: 'bg-cyan-100 text-cyan-700',
};

const DISCOUNT_ICONS: Record<string, React.ReactNode> = {
    volume: <TrendingDown size={14} />,
    loyalty: <Gift size={14} />,
    seasonal: <Zap size={14} />,
    bulk_bonus: <Percent size={14} />,
};

const PRESET_QUANTITIES = [100, 500, 1000, 5000];

// ─── Component ───────────────────────────────────────────────────────────────
export default function DynamicPriceCalculator({
    productId,
    basePrice,
    productName,
}: DynamicPriceCalculatorProps) {
    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const lang = (['uz', 'ru', 'en'].includes(language) ? language : 'uz') as LangKey;

    const t = (key: string): string => TX[key]?.[lang] ?? key;

    const [quantity, setQuantity] = useState(1);
    const [pricing, setPricing] = useState<PricingData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [animatePrice, setAnimatePrice] = useState(false);

    const fetchPricing = useCallback(
        async (qty: number) => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(
                    `/api/pricing/dynamic?productId=${productId}&quantity=${qty}`
                );
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || 'Server error');
                }
                const data: PricingData = await res.json();
                setPricing(data);
                // Trigger animation
                setAnimatePrice(true);
                setTimeout(() => setAnimatePrice(false), 400);
            } catch (err) {
                setError(err instanceof Error ? err.message : t('error'));
            } finally {
                setLoading(false);
            }
        },
        [productId]
    );

    // Debounced fetch
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchPricing(quantity);
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [quantity, fetchPricing]);

    const handleQuantityChange = (val: number) => {
        setQuantity(Math.max(1, Math.min(99999, val)));
    };

    // Progress to next tier
    const progressPercent =
        pricing?.nextTier
            ? Math.min(
                  100,
                  (quantity / pricing.nextTier.quantityNeeded) * 100
              )
            : 100;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Percent size={20} className="text-blue-600" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 truncate">
                        {t('title')}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">
                        {productName}
                    </p>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* ── Quantity input ── */}
                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                        {t('quantity')}
                    </label>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleQuantityChange(quantity - 1)}
                            className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors active:scale-95"
                            aria-label="Decrease"
                        >
                            <Minus size={16} className="text-gray-600" />
                        </button>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) =>
                                handleQuantityChange(
                                    parseInt(e.target.value, 10) || 1
                                )
                            }
                            className="flex-1 h-10 rounded-xl border border-gray-200 text-center font-bold text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={1}
                            max={99999}
                        />
                        <button
                            type="button"
                            onClick={() => handleQuantityChange(quantity + 1)}
                            className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors active:scale-95"
                            aria-label="Increase"
                        >
                            <Plus size={16} className="text-gray-600" />
                        </button>
                    </div>

                    {/* Preset buttons */}
                    <div className="flex gap-2 mt-3">
                        {PRESET_QUANTITIES.map((qty) => (
                            <button
                                key={qty}
                                type="button"
                                onClick={() => handleQuantityChange(qty)}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    quantity === qty
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {qty.toLocaleString()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Loading ── */}
                {loading && (
                    <div className="flex items-center justify-center gap-2 py-4 text-gray-500">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm">{t('loading')}</span>
                    </div>
                )}

                {/* ── Error ── */}
                {error && !loading && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* ── Pricing results ── */}
                {pricing && !loading && !error && (
                    <div className="space-y-4">
                        {/* Base price */}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">
                                {t('basePrice')} ({t('perUnit')})
                            </span>
                            <span className="font-semibold text-gray-700">
                                {format(pricing.basePrice)}
                            </span>
                        </div>

                        {/* Tier badge */}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">{t('tier')}</span>
                            <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    TIER_COLORS[pricing.tier] || TIER_COLORS.standard
                                }`}
                            >
                                {TIER_NAMES[pricing.tier]?.[lang] || pricing.tier}
                            </span>
                        </div>

                        {/* Discounts */}
                        {pricing.discounts.length > 0 ? (
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">
                                    {t('discounts')}
                                </p>
                                <div className="space-y-2">
                                    {pricing.discounts.map((d) => (
                                        <div
                                            key={d.type}
                                            className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-2.5"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-600">
                                                    {DISCOUNT_ICONS[d.type] || (
                                                        <Percent size={14} />
                                                    )}
                                                </span>
                                                <span className="text-sm text-green-800 font-medium">
                                                    {d.label[lang] || d.label.uz}
                                                </span>
                                            </div>
                                            <span className="text-sm font-bold text-green-700">
                                                -{d.percent}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-500 text-center">
                                {t('noDiscounts')}
                            </div>
                        )}

                        {/* Separator */}
                        <div className="border-t border-gray-100" />

                        {/* Final unit price */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">
                                {t('finalPrice')} ({t('perUnit')})
                            </span>
                            <span
                                className={`text-2xl font-extrabold text-brand-navy transition-all duration-300 ${
                                    animatePrice
                                        ? 'scale-110 text-blue-600'
                                        : 'scale-100'
                                }`}
                            >
                                {format(pricing.unitPrice)}
                            </span>
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between bg-brand-navy/5 rounded-xl px-4 py-3">
                            <span className="text-sm font-semibold text-gray-700">
                                {t('totalPrice')}
                            </span>
                            <span className="text-lg font-bold text-gray-900">
                                {format(pricing.totalPrice)}
                            </span>
                        </div>

                        {/* Savings */}
                        {pricing.savings > 0 && (
                            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                                <span className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                                    <TrendingDown size={16} />
                                    {t('savings')}
                                </span>
                                <div className="text-right">
                                    <span className="text-lg font-bold text-emerald-700">
                                        {format(pricing.savings)}
                                    </span>
                                    <span className="text-xs text-emerald-600 ml-1.5">
                                        ({pricing.totalDiscount}%)
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Next tier hint */}
                        {pricing.nextTier && (
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                <div className="flex items-start gap-2 mb-3">
                                    <ArrowRight
                                        size={16}
                                        className="text-blue-600 mt-0.5 shrink-0"
                                    />
                                    <p className="text-sm text-blue-800 font-medium">
                                        {t('nextTierHint')
                                            .replace(
                                                '{qty}',
                                                pricing.nextTier.quantityNeeded.toLocaleString()
                                            )
                                            .replace(
                                                '{pct}',
                                                String(
                                                    pricing.nextTier
                                                        .additionalDiscount
                                                )
                                            )}
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-xs text-blue-600 mb-1">
                                        <span>{t('progressToNext')}</span>
                                        <span className="font-bold">
                                            {quantity.toLocaleString()} /{' '}
                                            {pricing.nextTier.quantityNeeded.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                                            style={{
                                                width: `${progressPercent}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
