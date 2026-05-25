'use client';

import Image from 'next/image';
import { useCartStore } from '@/lib/store/useCartStore';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import {
    Minus, Plus, Trash2, ShoppingBag, ArrowRight,
    Box, ShieldCheck, Truck, Tag, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const useHasMounted = () => {
    const [m, setM] = useState(false);
    useEffect(() => setM(true), []);
    return m;
};

export default function CartPage() {
    const mounted = useHasMounted();
    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const { items, updateQuantity, removeFromCart, totalAmount } = useCartStore();
    const [promo, setPromo] = useState('');
    const [promoApplied, setPromoApplied] = useState(false);
    const [removingId, setRemovingId] = useState<number | null>(null);

    const t = (uz: string, ru: string) => language === 'ru' ? ru : uz;

    if (!mounted) return <div className="min-h-screen bg-[#f5f6fa] animate-pulse" />;

    const subtotal = totalAmount();
    const discount = promoApplied ? Math.round(subtotal * 0.05) : 0;
    const _delivery = subtotal > 500000 ? 0 : 0; // Free delivery shown as TBD
    const total = subtotal - discount;

    const handleRemove = (id: number) => {
        setRemovingId(id);
        setTimeout(() => {
            removeFromCart(id);
            setRemovingId(null);
            toast.success(t("Mahsulot olib tashlandi", "Товар удалён"));
        }, 300);
    };

    const handlePromo = () => {
        if (promo.trim().toUpperCase() === 'PACK24') {
            setPromoApplied(true);
            toast.success(t("Promo-kod qo'llanildi! −5% chegirma", "Промокод применён! −5% скидка"));
        } else {
            toast.error(t("Noto'g'ri promo-kod", "Неверный промокод"));
        }
    };

    // ── Empty state ────────────────────────────────────────────────────────────
    if (items.length === 0) {
        return (
            <div className="min-h-[70vh] bg-[#f5f6fa] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-28 h-28 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                    <ShoppingBag size={52} className="text-gray-200" />
                </div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
                    {t("Savatingiz bo'sh", "Корзина пуста")}
                </h1>
                <p className="text-gray-500 mb-8 max-w-xs text-sm leading-relaxed">
                    {t("Keng assortimentimizdan o'zingizga kerakli mahsulotlarni toping.", "Найдите нужные товары в нашем широком ассортименте.")}
                </p>
                <Link
                    href="/catalog"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3.5 rounded-2xl transition-colors shadow-lg shadow-blue-200"
                >
                    {t("Katalogni ko'rish", "Перейти в каталог")}
                    <ArrowRight size={16} />
                </Link>
            </div>
        );
    }

    // ── Main cart ──────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#f5f6fa]">

            {/* Breadcrumb */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <nav className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Link href="/" className="hover:text-blue-600">{t("Bosh sahifa", "Главная")}</Link>
                    <ChevronRight size={12} />
                    <span className="text-gray-800 font-medium">{t("Savat", "Корзина")}</span>
                </nav>
            </div>

            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <h1 className="text-2xl font-extrabold text-gray-900 mb-6 flex items-center gap-3">
                    <ShoppingBag size={24} className="text-blue-600" />
                    {t("Savat", "Корзина")}
                    <span className="text-base font-medium text-gray-400">({items.length})</span>
                </h1>

                <div className="flex flex-col xl:flex-row gap-6">

                    {/* ── Items list ────────────────────────────────────────── */}
                    <div className="flex-1 space-y-3">

                        {/* Column headers (desktop) */}
                        <div className="hidden sm:grid grid-cols-[1fr_120px_120px_40px] gap-4 px-5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <span>{t("Mahsulot", "Товар")}</span>
                            <span className="text-center">{t("Miqdor", "Кол-во")}</span>
                            <span className="text-right">{t("Jami", "Сумма")}</span>
                            <span />
                        </div>

                        {items.map((item) => (
                            <div
                                key={item.productId}
                                className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 ${
                                    removingId === item.productId ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                                }`}
                            >
                                <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_40px] gap-4 items-center">

                                    {/* Product info */}
                                    <div className="flex items-center gap-4">
                                        <Link href={`/product/${item.productId}`} className="flex-shrink-0">
                                            <div className="w-20 h-20 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden hover:border-blue-200 transition-colors">
                                                {item.image
                                                    ? <Image src={item.image} alt={item.name} className="w-full h-full object-contain" width={300} height={300} />
                                                    : <Box size={28} className="text-gray-200 m-auto mt-5" />
                                                }
                                            </div>
                                        </Link>
                                        <div>
                                            <Link href={`/product/${item.productId}`} className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                                                {item.name}
                                            </Link>
                                            <p className="text-blue-600 font-bold text-sm mt-1">{format(item.price)}</p>
                                        </div>
                                    </div>

                                    {/* Quantity */}
                                    <div className="flex items-center justify-center">
                                        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                                className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 text-gray-500 hover:text-red-500 transition-colors"
                                                aria-label="Kamaytirish"
                                            >
                                                <Minus size={13} />
                                            </button>
                                            <span className="w-10 text-center font-bold text-sm text-gray-900">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                                className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 text-gray-500 hover:text-blue-600 transition-colors"
                                                aria-label="Ko'paytirish"
                                            >
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Line total */}
                                    <div className="text-right">
                                        <p className="font-extrabold text-gray-900">{format(item.price * item.quantity)}</p>
                                    </div>

                                    {/* Remove */}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => handleRemove(item.productId)}
                                            className="w-8 h-8 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center transition-colors"
                                            aria-label="O'chirish"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Continue shopping */}
                        <div className="pt-2">
                            <Link
                                href="/catalog"
                                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold"
                            >
                                ← {t("Xaridni davom ettirish", "Продолжить покупки")}
                            </Link>
                        </div>
                    </div>

                    {/* ── Order summary sidebar ──────────────────────────────── */}
                    <div className="xl:w-80 flex-shrink-0 space-y-4">

                        {/* Promo code */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                                <Tag size={12} className="text-blue-500" />
                                {t("Promo-kod", "Промокод")}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={promo}
                                    onChange={e => setPromo(e.target.value.toUpperCase())}
                                    placeholder={t("Kodni kiriting", "Введите код")}
                                    disabled={promoApplied}
                                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
                                />
                                <button
                                    onClick={handlePromo}
                                    disabled={promoApplied || !promo.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
                                >
                                    {promoApplied ? '✓' : t("Qo'lla", "Применить")}
                                </button>
                            </div>
                            {promoApplied && (
                                <p className="text-xs text-emerald-600 font-semibold mt-2">
                                    ✅ PACK24 — {t("5% chegirma qo'llanildi", "Скидка 5% применена")}
                                </p>
                            )}
                        </div>

                        {/* Summary */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-24">
                            <h2 className="font-bold text-gray-800 mb-4 text-base">
                                {t("Buyurtma xulosasi", "Сводка заказа")}
                            </h2>

                            <div className="space-y-2.5 text-sm mb-4">
                                <div className="flex justify-between text-gray-600">
                                    <span>{t("Mahsulotlar", "Товары")} ({items.length})</span>
                                    <span>{format(subtotal)}</span>
                                </div>
                                {promoApplied && (
                                    <div className="flex justify-between text-emerald-600 font-semibold">
                                        <span>{t("Chegirma (5%)", "Скидка (5%)")}</span>
                                        <span>−{format(discount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-gray-600">
                                    <span>{t("Yetkazib berish", "Доставка")}</span>
                                    <span className="text-emerald-600 font-semibold">
                                        {t("Hisoblanadi", "Рассчитывается")}
                                    </span>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4 mb-5">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-gray-900">{t("Jami", "Итого")}</span>
                                    <span className="font-extrabold text-xl text-blue-700">{format(total)}</span>
                                </div>
                            </div>

                            <Link
                                href="/checkout"
                                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-blue-200 text-sm"
                            >
                                {t("Buyurtmani rasmiylashtirish", "Оформить заказ")}
                                <ArrowRight size={15} />
                            </Link>

                            {/* Trust badges */}
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <ShieldCheck size={13} className="text-green-500 flex-shrink-0" />
                                    {t("Xavfsiz to'lov · SSL himoyasi", "Безопасная оплата · SSL защита")}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <Truck size={13} className="text-blue-500 flex-shrink-0" />
                                    {t("500 000 so'm dan yuqoriga bepul yetkazish", "Бесплатная доставка от 500 000 сум")}
                                </div>
                            </div>

                            {/* Payment logos */}
                            <div className="mt-4 flex gap-1.5 flex-wrap">
                                {[
                                    { label: 'Click', bg: 'bg-blue-500' },
                                    { label: 'Payme', bg: 'bg-indigo-500' },
                                    { label: 'UzCard', bg: 'bg-green-600' },
                                    { label: 'Humo', bg: 'bg-purple-600' },
                                    { label: 'Naqd', bg: 'bg-gray-400' },
                                ].map(p => (
                                    <span key={p.label} className={`${p.bg} text-white text-[9px] font-bold px-2 py-1 rounded-md`}>
                                        {p.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
