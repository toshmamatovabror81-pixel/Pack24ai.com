'use client';

import Image from 'next/image';
import { useProductStore } from '@/lib/store/useProductStore';
import { useCartStore } from '@/lib/store/useCartStore';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';import { Star, ShoppingCart, Truck, ShieldCheck, Minus, Plus, Heart, ChevronRight, Box, Check, ZoomIn, ChevronLeft, Package, Phone, Share2, MessageSquare, Send, ThumbsUp, Film } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { trackEvent } from '@/components/GoogleAnalytics';import { translateProductName, translateCategory, translateProductDescription, translateSpecifications } from '@/lib/product-translations';

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function ProductSkeleton() {
    return (
        <div className="min-h-screen bg-surface-page animate-pulse">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="h-4 bg-gray-200 rounded-full w-64 mb-6" />
            </div>
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Image skeleton */}
                        <div className="space-y-3">
                            <div className="h-80 bg-gray-100 rounded-2xl" />
                            <div className="flex gap-2">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="w-16 h-16 bg-gray-100 rounded-xl" />
                                ))}
                            </div>
                        </div>
                        {/* Info skeleton */}
                        <div className="space-y-4 pt-2">
                            <div className="h-3 bg-gray-100 rounded-full w-28" />
                            <div className="h-7 bg-gray-200 rounded-full w-3/4" />
                            <div className="h-5 bg-gray-100 rounded-full w-36" />
                            <div className="h-20 bg-gray-100 rounded-2xl" />
                            <div className="flex gap-3">
                                <div className="h-11 bg-gray-100 rounded-xl w-28" />
                                <div className="h-11 bg-gray-200 rounded-xl flex-1" />
                                <div className="h-11 bg-gray-100 rounded-xl w-11" />
                            </div>
                            <div className="h-11 bg-gray-100 rounded-xl" />
                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-10 bg-gray-100 rounded-xl" />
                                <div className="h-10 bg-gray-100 rounded-xl" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Image gallery ─────────────────────────────────────────────────────────────
function ImageGallery({ images, name }: { images: string[]; name: string }) {
    const [selected, setSelected] = useState(0);
    const [lightbox, setLightbox] = useState(false);

    const validImages = images.filter(Boolean);
    const current = validImages[selected];

    const next = useCallback(() => setSelected(s => (s + 1) % validImages.length), [validImages.length]);
    const prev = useCallback(() => setSelected(s => (s - 1 + validImages.length) % validImages.length), [validImages.length]);

    useEffect(() => {
        if (!lightbox) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'Escape') setLightbox(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [lightbox, next, prev]);

    if (validImages.length === 0) {
        return (
            <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl overflow-hidden h-80 flex items-center justify-center">
                <Box size={80} className="text-gray-200" />
            </div>
        );
    }

    return (
        <>
            <div
                className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl overflow-hidden h-80 flex items-center justify-center group cursor-zoom-in"
                onClick={() => setLightbox(true)}
            >
                <Image
                    src={current}
                    alt={name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" width={300} height={300}
                />
                <button
                    aria-label="Kattalashtirish"
                    className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-xl flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <ZoomIn size={14} className="text-gray-600" />
                </button>
                {validImages.length > 1 && (
                    <>
                        <button
                            aria-label="Oldingisi"
                            onClick={e => { e.stopPropagation(); prev(); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-sm hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            aria-label="Keyingisi"
                            onClick={e => { e.stopPropagation(); next(); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-sm hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <ChevronRight size={16} />
                        </button>
                        {/* Dot indicators */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {validImages.map((_, i) => (
                                    <button
                                        key={i}
                                        aria-label={`${i + 1}-rasm`}
                                        onClick={e => { e.stopPropagation(); setSelected(i); }}
                                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === selected ? 'bg-blue-600 w-4' : 'bg-gray-300'}`}
                                    />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {validImages.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                    {validImages.map((img, i) => (
                        <button
                            key={i}
                            aria-label={`Rasm ${i + 1}`}
                            onClick={() => setSelected(i)}
                            className={`w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                                i === selected ? 'border-blue-500 shadow-md shadow-blue-100' : 'border-gray-100 hover:border-gray-300'
                            }`}
                        >
                            <Image src={img} alt="" className="w-full h-full object-contain" width={300} height={300} />
                        </button>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setLightbox(false)}
                >
                    <button
                        aria-label="Yopish"
                        className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                        onClick={() => setLightbox(false)}
                    >
                        ✕
                    </button>
                    {validImages.length > 1 && (
                        <>
                            <button
                                aria-label="Oldingisi"
                                onClick={e => { e.stopPropagation(); prev(); }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                aria-label="Keyingisi"
                                onClick={e => { e.stopPropagation(); next(); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </>
                    )}
                    <Image
                        src={current}
                        alt={name}
                        width={900}
                        height={900}
                        className="max-h-[85vh] max-w-[85vw] object-contain"
                        onClick={e => e.stopPropagation()}
                    />
                    <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
                        {selected + 1} / {validImages.length}
                    </p>
                </div>
            )}
        </>
    );
}

// ─── Demo reviews ─────────────────────────────────────────────────────────────
const DEMO_REVIEWS = [
    { id: 1, name: 'Jasur T.', rating: 5, date: '2025-03-10', text: "Juda sifatli mahsulot! Kutganimdan ham yaxshi chiqdi. Yetkazish ham tez bo'ldi, tavsiya qilaman.", helpful: 12 },
    { id: 2, name: 'Nilufar R.', rating: 4, date: '2025-02-28', text: "Narxi qulay, sifati yaxshi. Faqat ranglar biroz farq qildi, lekin umuman olganda mamnunman.", helpful: 7 },
    { id: 3, name: 'Sherzod M.', rating: 5, date: '2025-02-15', text: "Ikkinchi marta buyurtma berdim. Har doim sifatli va o'z vaqtida yetkazishadi. 5 yulduz!", helpful: 19 },
];

function ReviewsSection({ language }: { language: string }) {
    const t = (uz: string, ru: string) => language === 'ru' ? ru : uz;
    const [form, setForm] = useState({ name: '', rating: 5, text: '' });
    const [submitted, setSubmitted] = useState(false);
    const [helpful, setHelpful] = useState<Record<number, boolean>>({});

    const avgRating = DEMO_REVIEWS.reduce((s, r) => s + r.rating, 0) / DEMO_REVIEWS.length;
    const distribution = [5, 4, 3, 2, 1].map(star => ({
        star,
        count: DEMO_REVIEWS.filter(r => r.rating === star).length,
        pct: Math.round((DEMO_REVIEWS.filter(r => r.rating === star).length / DEMO_REVIEWS.length) * 100),
    }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (form.name && form.text) {
            setSubmitted(true);
            toast.success(t("Sharhingiz qabul qilindi! ✅", "Ваш отзыв принят! ✅"));
        }
    };

    return (
        <div className="p-6 space-y-8">
            {/* Rating overview */}
            <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex flex-col items-center justify-center bg-blue-50 rounded-2xl px-8 py-5 flex-shrink-0">
                    <span className="text-5xl font-black text-blue-700">{avgRating.toFixed(1)}</span>
                    <div className="flex mt-1">
                        {[1, 2, 3, 4, 5].map(i => (
                            <Star key={i} size={14} className={i <= Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                        ))}
                    </div>
                    <span className="text-xs text-gray-500 mt-1">{DEMO_REVIEWS.length} {t('sharh', 'отзывов')}</span>
                </div>

                <div className="flex-1 space-y-2">
                    {distribution.map(({ star, count, pct }) => (
                        <div key={star} className="flex items-center gap-2 text-xs">
                            <span className="w-3 text-gray-500">{star}</span>
                            <Star size={10} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-yellow-400 h-2 rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="w-6 text-gray-400">{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reviews list */}
            <div className="space-y-4">
                {DEMO_REVIEWS.map(review => (
                    <div key={review.id} className="bg-gray-50 rounded-2xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                                <p className="font-semibold text-gray-800 text-sm">{review.name}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    {[1,2,3,4,5].map(i => (
                                        <Star key={i} size={11} className={i <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                                    ))}
                                </div>
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                                {new Date(review.date).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{review.text}</p>
                        <button
                            onClick={() => setHelpful(h => ({ ...h, [review.id]: !h[review.id] }))}
                            className={`mt-3 flex items-center gap-1.5 text-xs transition-colors ${helpful[review.id] ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <ThumbsUp size={12} fill={helpful[review.id] ? 'currentColor' : 'none'} />
                            {t('Foydali', 'Полезно')} ({review.helpful + (helpful[review.id] ? 1 : 0)})
                        </button>
                    </div>
                ))}
            </div>

            {/* Write review form */}
            <div className="border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <MessageSquare size={16} className="text-blue-500" />
                    {t("Sharh qoldirish", "Оставить отзыв")}
                </h3>

                {submitted ? (
                    <div className="bg-green-50 border border-green-100 text-green-700 rounded-2xl p-4 text-center text-sm font-semibold">
                        ✅ {t("Sharhingiz uchun rahmat!", "Спасибо за ваш отзыв!")}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">{t("Bahoyingiz", "Ваша оценка")}</label>
                            <div className="flex gap-1">
                                {[1,2,3,4,5].map(i => (
                                    <button
                                        key={i}
                                        type="button"
                                        aria-label={`${i} yulduz baho berish`}
                                        onClick={() => setForm(f => ({ ...f, rating: i }))}
                                        className="transition-transform hover:scale-110"
                                    >
                                        <Star size={24} className={i <= form.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                                    </button>
                                ))}
                            </div>
                        </div>
                        <input
                            type="text"
                            placeholder={t("Ismingiz", "Ваше имя")}
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            required
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors"
                        />
                        <textarea
                            placeholder={t("Fikringizni yozing...", "Напишите ваш отзыв...")}
                            value={form.text}
                            onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                            required
                            rows={3}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors resize-none"
                        />
                        <button
                            type="submit"
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
                        >
                            <Send size={14} />
                            {t("Yuborish", "Отправить")}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── Asosiy sahifa ─────────────────────────────────────────────────────────────
export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const [id, setId] = useState<string>('');
    const { addToCart } = useCartStore();
    const [mounted, setMounted] = useState(false);
    const [qty, setQty] = useState(1);
    const [liked, setLiked] = useState(false);
    const [tab, setTab] = useState<'desc' | 'spec' | 'delivery' | 'reviews'>('desc');
    const [cartAdded, setCartAdded] = useState(false);

    // 10 tilni qamrovchi tarjima funksiyasi
    const t = (uz: string, ru: string, en?: string, tr?: string, zh?: string, tg?: string, kk?: string, tk?: string, fa?: string, qr?: string): string => {
        const map: Record<string, string> = {
            uz, ru,
            en: en ?? uz,
            tr: tr ?? uz,
            zh: zh ?? uz,
            tg: tg ?? uz,
            kk: kk ?? uz,
            tk: tk ?? uz,
            fa: fa ?? uz,
            qr: qr ?? uz,
        };
        return map[language] ?? uz;
    };

    useEffect(() => {
        params.then(p => setId(p.id));
        setMounted(true);
    }, [params]);

    const products = useProductStore(s => s.products);
    const fetchProducts = useProductStore(s => s.fetchProducts);
    const product = products.find(p => p.id.toString() === id);

    useEffect(() => {
        if (products.length === 0) fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (product) {
            trackEvent('view_item', { item_name: product.name, item_id: product.id, price: product.price });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product?.id]);

    const translatedName = translateProductName(product?.name ?? '', language);
    const translatedCategory = product?.category ? translateCategory(product.category, language) : '';
    const translatedDescription = translateProductDescription(product?.description, language);
    const translatedSpecs = translateSpecifications(product?.specifications, language);

    if (!mounted || !id) return <ProductSkeleton />;
    if (!product && id && mounted) return notFound();
    if (!product) return <ProductSkeleton />;

    const handleAddToCart = () => {
        addToCart({ productId: Number(product.id), name: product.name, price: product.price, image: product.image, quantity: qty });
        toast.success(t(`${qty} ta savatga qo'shildi! 🎉`, `${qty} шт. добавлено в корзину! 🎉`));
        trackEvent('add_to_cart', { item_name: product.name, item_id: product.id, quantity: qty, price: product.price });
        // Micro-animation
        setCartAdded(true);
        setTimeout(() => setCartAdded(false), 1500);
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({ title: product.name, url: window.location.href });
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast.success(t("Havola nusxalandi!", "Ссылка скопирована!"));
        }
    };

    const isOnSale = product.originalPrice && product.originalPrice > product.price;
    const discount = isOnSale ? Math.round((1 - product.price / product.originalPrice!) * 100) : 0;
    const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 8);

    // Gallery: asosiy rasm + qo'shimcha rasmlar (gallery field)
    const galleryImages = [
        product.image,
        ...(Array.isArray(product.gallery) ? product.gallery : []),
    ].filter((img): img is string => Boolean(img) && img !== '/placeholder.png');

    // ── "Buy" panel (shared between inline mobile + sticky desktop) ──
    const BuyPanel = ({ sticky }: { sticky?: boolean }) => (
        <div className={sticky ? 'hidden xl:block' : 'xl:hidden'}>
            <div className={sticky
                ? 'sticky top-24 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4'
                : 'space-y-4'
            }>
                {sticky && (
                    <>
                        <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{translatedName}</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-extrabold text-blue-700">{format(product.price)}</span>
                            {isOnSale && <span className="text-base text-gray-400 line-through">{format(product.originalPrice!)}</span>}
                        </div>
                    </>
                )}

                {/* Qty + Cart */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                        <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-11 flex items-center justify-center hover:bg-gray-50 transition-colors" aria-label="Kamaytirish">
                            <Minus size={14} />
                        </button>
                        <span className="w-12 text-center font-bold text-sm">{qty}</span>
                        <button onClick={() => setQty(q => q + 1)} className="w-10 h-11 flex items-center justify-center hover:bg-gray-50 transition-colors" aria-label="Ko'paytirish">
                            <Plus size={14} />
                        </button>
                    </div>
                    <button
                        id="add-to-cart-btn"
                        onClick={handleAddToCart}
                        className={`flex-1 flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-all shadow-lg ${
                            cartAdded
                                ? 'bg-emerald-500 shadow-emerald-200 scale-95'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                        } text-white`}
                    >
                        {cartAdded ? (
                            <><Check size={16} />{t("Qo'shildi!", "Добавлено!")}</>
                        ) : (
                            <><ShoppingCart size={16} />{t("Savatga", "В корзину")}</>
                        )}
                    </button>
                    <button
                        onClick={() => setLiked(!liked)}
                        aria-label={t("Sevimlilarga", "В избранное")}
                        className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all ${liked ? 'border-red-500 text-red-500 bg-red-50' : 'border-gray-200 text-gray-400 hover:border-red-300'}`}
                    >
                        <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
                    </button>
                </div>

                {/* Phone order */}
                <a
                    href="tel:+998880557888"
                    className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
                >
                    <Phone size={14} /> {t("Telefonda buyurtma", "Заказ по телефону")}
                </a>

                {/* Trust badges */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5">
                        <Truck size={13} className="text-blue-500" />{t("Tez yetkazish", "Быстрая доставка")}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5">
                        <ShieldCheck size={13} className="text-green-500" />{t("Sifat kafolati", "Гарантия качества")}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-surface-page">

            {/* Breadcrumb */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <nav className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Link href="/" className="hover:text-blue-600">{t("Bosh sahifa", "Главная")}</Link>
                    <ChevronRight size={12} />
                    <Link href="/catalog" className="hover:text-blue-600">{t("Katalog", "Каталог")}</Link>
                    {translatedCategory && <><ChevronRight size={12} /><span>{translatedCategory}</span></>}
                    <ChevronRight size={12} />
                    <span className="text-gray-800 font-medium truncate max-w-[200px]">{translatedName}</span>
                </nav>
            </div>

            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-12">

                {/* ── Main card ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">

                    {/* 2-col layout: image | info + sticky panel */}
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px_240px]">

                        {/* Image gallery */}
                        <div className="p-6 border-b xl:border-b-0 xl:border-r border-gray-100">
                            <div className="relative">
                                {isOnSale && (
                                    <div className="absolute top-3 left-3 z-10 bg-red-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-xl">
                                        -{discount}%
                                    </div>
                                )}
                                <ImageGallery
                                    images={galleryImages.length > 0 ? galleryImages : [product.image ?? '']}
                                    name={translatedName}
                                />

                                {/* Video bo'limi */}
                                {product.videoUrl && (
                                    <div className="mt-5 rounded-2xl overflow-hidden border border-purple-100 bg-purple-50/30">
                                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-purple-100">
                                            <Film size={14} className="text-purple-500" />
                                            <span className="text-xs font-semibold text-purple-700">
                                                {language === 'ru' ? 'Видео о товаре' : 'Mahsulot videosi'}
                                            </span>
                                        </div>
                                        <video
                                            src={product.videoUrl}
                                            controls
                                            className="w-full max-h-72 object-contain bg-black"
                                            playsInline
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Product info (middle) */}
                        <div className="p-6 lg:p-8 border-b xl:border-b-0 xl:border-r border-gray-100">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                                    {translatedCategory || t("Kategoriyasiz", "Без категории", "Uncategorized")}
                                </span>
                                <button
                                    onClick={handleShare}
                                    aria-label="Ulashish"
                                    className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
                                >
                                    <Share2 size={14} />
                                </button>
                            </div>

                            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-3 leading-snug">
                                {translatedName}
                            </h1>

                            {product.rating > 0 && (
                                <button
                                    onClick={() => setTab('reviews')}
                                    className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity"
                                >
                                    <div className="flex">
                                        {[1,2,3,4,5].map(i => (
                                            <Star key={i} size={13} className={i <= Math.round(product.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                                        ))}
                                    </div>
                                    <span className="text-sm text-gray-500 underline underline-offset-2">
                                        {product.rating} ({product.reviews} {t("sharh", "отзывов", "reviews", "yorum", "评论", "шарҳ", "пікір", "teswir", "نظر", "pikir")})
                                    </span>
                                </button>
                            )}

                            {/* Price */}
                            <div className="mb-5 bg-blue-50 rounded-2xl p-4">
                                <div className="flex items-baseline gap-3">
                                    <span className="text-3xl font-extrabold text-blue-700">{format(product.price)}</span>
                                    {isOnSale && <span className="text-lg text-gray-400 line-through">{format(product.originalPrice!)}</span>}
                                </div>
                                {product.minPrice && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {t("Ulgurji narx:", "Оптовая цена:")} <span className="font-bold text-emerald-600">{format(product.minPrice)}</span>
                                        <span className="text-gray-400"> dan</span>
                                    </p>
                                )}
                            </div>

                            {/* Stock */}
                            <div className="flex items-center gap-1.5 mb-5">
                                <Check size={14} className="text-emerald-500" />
                                <span className="text-sm font-semibold text-emerald-600">{t("Mavjud", "В наличии", "In stock", "Mevcut", "现货", "Мавҷуд", "Бар", "Bar", "موجود", "Bar")}</span>
                                {product.sku && (
                                    <span className="ml-auto text-xs text-gray-400 font-mono">SKU: {product.sku}</span>
                                )}
                            </div>

                            {/* Buy panel — mobile/tablet (inline) */}
                            <BuyPanel />
                        </div>

                        {/* Sticky buy panel — desktop only */}
                        <div className="p-5">
                            <BuyPanel sticky />
                        </div>
                    </div>

                    {/* ── Tabs ── */}
                    <div className="border-t border-gray-100">
                        <div className="flex border-b border-gray-100 overflow-x-auto">
                            {(['desc', 'spec', 'delivery', 'reviews'] as const).map(k => (
                                <button
                                    key={k}
                                    onClick={() => setTab(k)}
                                    className={`px-5 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                                        tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {k === 'desc'     ? t('Tavsif', 'Описание', 'Description', 'Açıklama', '描述', 'Тавсиф', 'Сипаттама', 'Beýan', 'توضیحات', 'Tavsif')
                                    : k === 'spec'    ? t("O'lchamlar", 'Характеристики', 'Specifications', 'Özellikler', '规格', 'Хусусиятҳо', 'Сипаттамалар', 'Häsiýetlikler', 'مشخصات', "O'lshamlar")
                                    : k === 'delivery'? t('Yetkazish', 'Доставка', 'Delivery', 'Teslimat', '配送', 'Тавзеъ', 'Жеткізу', 'Eltip bermek', 'تحویل', 'Yetkeriwshi')
                                    :                   t(`Sharhlar (${DEMO_REVIEWS.length})`, `Отзывы (${DEMO_REVIEWS.length})`, `Reviews (${DEMO_REVIEWS.length})`, `Yorumlar (${DEMO_REVIEWS.length})`, `评论 (${DEMO_REVIEWS.length})`, `Шарҳҳо (${DEMO_REVIEWS.length})`, `Пікірлер (${DEMO_REVIEWS.length})`, `Teswirler (${DEMO_REVIEWS.length})`, `نظرات (${DEMO_REVIEWS.length})`, `Pikirler (${DEMO_REVIEWS.length})`)}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        {tab === 'reviews' ? (
                            <ReviewsSection language={language} />
                        ) : (
                            <div className="p-6 text-sm text-gray-600">
                                {tab === 'desc' && (
                                    <p className="leading-relaxed">
                                        {translatedDescription || t("Tavsif kiritilmagan.", "Описание не добавлено.")}
                                    </p>
                                )}
                                {tab === 'spec' && (
                                    <div>
                                        {product.sizes && product.sizes.length > 0 && (
                                            <div className="mb-6">
                                                <h3 className="font-bold text-gray-800 mb-3">{t("O'lchamlar jadvali", "Таблица размеров")}</h3>
                                                <table className="w-full text-sm border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-50">
                                                            <th className="py-2 px-3 text-left font-semibold text-gray-600 border border-gray-100">{t("O'lcham", "Размер")}</th>
                                                            <th className="py-2 px-3 text-right font-semibold text-gray-600 border border-gray-100">{t("Narx", "Цена")}</th>
                                                            <th className="py-2 px-3 text-right font-semibold text-gray-600 border border-gray-100">{t("Min qty", "Мин кол-во")}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {product.sizes!.map((s, i) => (
                                                            <tr key={i} className="hover:bg-blue-50 transition-colors">
                                                                <td className="py-2 px-3 border border-gray-100 font-mono">{translateProductName(s.label, language)}</td>
                                                                <td className="py-2 px-3 border border-gray-100 text-right font-bold text-blue-600">{format(s.price)}</td>
                                                                <td className="py-2 px-3 border border-gray-100 text-right text-gray-500">{s.minQty ?? 1}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            {translatedSpecs.map(({ key, value }) => (
                                                <div key={key} className="flex justify-between py-2 border-b border-gray-50">
                                                    <span className="text-gray-500">{key}</span>
                                                    <span className="font-medium">{value}</span>
                                                </div>
                                            ))}
                                            {translatedSpecs.length === 0 && !product.sizes?.length && (
                                                <p className="text-gray-400">{t("Ma'lumot yo'q.", "Данные отсутствуют.")}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {tab === 'delivery' && (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                                            <Truck size={15} className="text-blue-500 mt-0.5" />
                                            <div>
                                                <p className="font-semibold text-gray-800">{t("Standart yetkazish", "Стандартная доставка")}</p>
                                                <p className="text-gray-500 text-xs">{t("3-5 ish kuni", "3-5 рабочих дней")}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl">
                                            <Truck size={15} className="text-emerald-500 mt-0.5" />
                                            <div>
                                                <p className="font-semibold text-gray-800">{t("Express yetkazish", "Экспресс-доставка")}</p>
                                                <p className="text-gray-500 text-xs">{t("Bugun yoki ertaga", "Сегодня или завтра")}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                                            <Package size={15} className="text-gray-500 mt-0.5" />
                                            <div>
                                                <p className="font-semibold text-gray-800">{t("O'z olish", "Самовывоз")}</p>
                                                <p className="text-gray-500 text-xs">{t("Toshkent sh., Chilonzor t.", "Ташкент, р. Чиланзар")}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Related products — horizontal scroll ── */}
                {related.length > 0 && (
                    <div className="mt-10">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-bold text-gray-900">
                                {t("O'xshash mahsulotlar", "Похожие товары", "Related Products", "Benzer Ürünler", "相关产品", "Маҳсулоти монанд", "Ұқсас тауарлар", "Meňzeş harytlar", "محصولات مشابه", "Uqsas mahsulotlar")}
                            </h2>
                            <Link href={`/catalog?category=${product.category}`} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold">
                                {t("Barchasi", "Все")} <ChevronRight size={14} />
                            </Link>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
                            {related.map(rp => {
                                const rpOnSale = rp.originalPrice && rp.originalPrice > rp.price;
                                return (
                                    <div
                                        key={rp.id}
                                        className="flex-shrink-0 w-48 bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group snap-start"
                                    >
                                        <Link href={`/product/${rp.id}`} className="block">
                                            <div className="h-36 bg-gray-50 flex items-center justify-center overflow-hidden relative">
                                                {rpOnSale && (
                                                    <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-lg z-10">
                                                        -{Math.round((1 - rp.price / rp.originalPrice!) * 100)}%
                                                    </span>
                                                )}
                                                {rp.image
                                                    ? <Image src={rp.image} alt={rp.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" width={300} height={300} />
                                                    : <Box size={32} className="text-gray-200" />
                                                }
                                            </div>
                                            <div className="p-3 pb-2">
                                                <p className="text-xs font-semibold text-gray-800 line-clamp-2 mb-1 leading-snug">
                                                    {translateProductName(rp.name, language)}
                                                </p>
                                                <div className="flex items-baseline gap-1.5">
                                                    <p className="text-sm font-bold text-blue-600">{format(rp.price)}</p>
                                                    {rpOnSale && <p className="text-[10px] text-gray-400 line-through">{format(rp.originalPrice!)}</p>}
                                                </div>
                                            </div>
                                        </Link>
                                        <div className="px-3 pb-3">
                                            <button
                                                onClick={() => {
                                                    addToCart({ productId: Number(rp.id), name: rp.name, price: rp.price, image: rp.image, quantity: 1 });
                                                    toast.success(t("Savatga qo'shildi!", "Добавлено в корзину!"));
                                                }}
                                                className="w-full flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 text-xs font-bold py-2 rounded-xl transition-all border border-blue-100 hover:border-blue-600"
                                            >
                                                <ShoppingCart size={12} />
                                                {t("Savatga", "В корзину")}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
