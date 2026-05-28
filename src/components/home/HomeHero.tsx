'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, ArrowRight, ShoppingCart, Package } from 'lucide-react';
import CatalogSidebar from '@/components/CatalogSidebar';
import HeroBannerSlider from '@/components/HeroBannerSlider';
import { useProductStore } from '@/lib/store/useProductStore';
import { useCartStore } from '@/lib/store/useCartStore';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { toast } from 'sonner';
import Image from 'next/image';
import type { Product } from '@/lib/store/useProductStore';
import { translateProductName, translateCategory, getProductUI } from '@/lib/product-translations';

interface Props {
    initialProducts?: Product[];
}

export default function HomeHero({ initialProducts }: Props) {
    const { language } = useLanguage();
    const products = useProductStore((state) => state.products);
    const loading = useProductStore((state) => state.loading);
    const { addToCart } = useCartStore();
    const { user } = useAuthStore();
    const isAdmin = (user as { role?: string } | null)?.role === 'ADMIN';

    // SSR mahsulotlar bilan store to'ldirish
    useEffect(() => {
        if (initialProducts && initialProducts.length > 0) {
            useProductStore.setState({ products: initialProducts, loading: false });
        } else if (products.length === 0) {
            useProductStore.getState().fetchProducts();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAdd = (product: Product) => {
        addToCart({
            productId: Number(product.id),
            name:      product.name,
            price:     product.price,
            image:     product.image,
            quantity:  1,
        });
        toast.success(getProductUI('addedToCart', language));
    };

    const POPULAR_LABEL: Record<string, string> = {
        uz: 'Mashhur Mahsulotlar', ru: 'Популярные товары', en: 'Popular Products', qr: 'Mashqur mahsulotlar',
        zh: '热门产品', tr: 'Popüler Ürünler', tg: 'Маҳсулоти машҳур', kk: 'Танымал тауарлар', tk: 'Meşhur harytlar', fa: 'محصولات محبوب',
    };
    const SEE_ALL_LABEL: Record<string, string> = {
        uz: "Barchasini ko'rish", ru: 'Смотреть все', en: 'View all', qr: "Bárin kóriw",
        zh: '查看全部', tr: 'Tümünü gör', tg: 'Ҳамаашро дидан', kk: 'Барлығын көру', tk: 'Hemmesini gör', fa: 'مشاهده همه',
    };

    const popularProducts = products.filter((p) => p.status === 'active').slice(0, 10);

    return (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-4">
            <div className="flex gap-5 items-start">
                {/* Left: Catalog Sidebar */}
                <div className="hidden lg:block shrink-0">
                    <CatalogSidebar />
                </div>

                {/* Right: Banner + Unified showcase */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                    {/* Hero Banner */}
                    <div className="rounded-2xl overflow-hidden shadow-sm">
                        <HeroBannerSlider />
                    </div>


                    {/* ── Mashhur mahsulotlar (baner ostida birlashtirish) ── */}
                    <div className="mt-2">
                        <div className="flex items-center justify-between mb-3 px-0.5">
                            <h2 className="text-base font-extrabold text-gray-900">
                                {POPULAR_LABEL[language] ?? POPULAR_LABEL.uz}
                            </h2>
                            <Link
                                href="/catalog"
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                            >
                                {SEE_ALL_LABEL[language] ?? SEE_ALL_LABEL.uz}
                                <ChevronRight size={14} />
                            </Link>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                                        <div className="h-40 bg-gray-200" />
                                        <div className="p-3 space-y-2">
                                            <div className="h-3 bg-gray-200 rounded w-1/3" />
                                            <div className="h-4 bg-gray-200 rounded" />
                                            <div className="h-4 bg-gray-200 rounded w-3/4" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : popularProducts.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <Package size={40} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm">{getProductUI('notFound', language)}</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {popularProducts.map((product) => {
                                        const isHit =
                                            (product.rating ?? 0) >= 4.5 ||
                                            (product.originalPrice != null && product.originalPrice > product.price);
                                        const discount = product.originalPrice && product.originalPrice > product.price
                                            ? Math.round((1 - product.price / product.originalPrice) * 100)
                                            : null;
                                        const translatedName = translateProductName(product.name, language);
                                        const translatedCat = product.category
                                            ? translateCategory(product.category, language) : '';

                                        return (
                                            <div
                                                key={product.id}
                                                className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col"
                                            >
                                                <div className="relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                                                    {product.image ? (
                                                        <Image
                                                            src={product.image}
                                                            alt={translatedName}
                                                            fill
                                                            sizes="(max-width: 640px) 50vw, 25vw"
                                                            className="object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                    ) : (
                                                        <Package size={40} className="text-gray-300" />
                                                    )}

                                                    {/* Badges — faqat mijozga ko'rinadigan (Hit, Chegirma) */}
                                                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                                                        {isHit && (
                                                            <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                                                                {getProductUI('hit', language)}
                                                            </span>
                                                        )}
                                                        {discount && (
                                                            <span className="bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                                -{discount}%
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* ⭐ Featured belgi — FAQAT ADMIN ko'radi */}
                                                    {isAdmin && product.isFeatured && (
                                                        <div className="absolute top-2 right-2 bg-amber-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full" title="Featured (admin)">
                                                            ⭐
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-3 flex flex-col flex-1">
                                                    {translatedCat && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">
                                                            {translatedCat}
                                                        </span>
                                                    )}
                                                    <Link href={`/product/${product.id}`}>
                                                        <h3 className="font-semibold text-gray-900 text-xs leading-snug line-clamp-2 hover:text-blue-600 transition-colors mb-2">
                                                            {translatedName}
                                                        </h3>
                                                    </Link>
                                                    <div className="mt-auto flex items-center justify-between gap-2">
                                                        <div>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="font-bold text-gray-900 text-sm">
                                                                    {product.price?.toLocaleString()}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400">
                                                                    {getProductUI('currency', language)}
                                                                </span>
                                                            </div>
                                                            {product.originalPrice && product.originalPrice > product.price && (
                                                                <span className="text-[10px] text-gray-400 line-through">
                                                                    {product.originalPrice.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => handleAdd(product)}
                                                            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-xl transition-colors active:scale-95"
                                                        >
                                                            <ShoppingCart size={11} />
                                                            <span>{getProductUI('addToCart', language)}</span>
                                                        </button>
                                                    </div>
                                                    <p className={`text-[9px] mt-1.5 font-medium ${product.inStock ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {product.inStock
                                                            ? `✓ ${getProductUI('inStock', language)}`
                                                            : `✗ ${getProductUI('outOfStock', language)}`}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-4 text-center sm:hidden">
                                    <Link
                                        href="/catalog"
                                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
                                    >
                                        {SEE_ALL_LABEL[language] ?? SEE_ALL_LABEL.uz} <ArrowRight size={15} />
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
