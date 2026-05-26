'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCategoryStore, type Category } from '@/lib/store/useCategoryStore';
import { useProductStore } from '@/lib/store/useProductStore';
import { CategoryIcon } from '@/components/CategoryIcon';
import { translateCategory, getProductUI } from '@/lib/product-translations';
import type { Language } from '@/lib/translations';
import { ChevronRight, Package } from 'lucide-react';

/* ── UI translations ── */
const UI: Record<string, Record<string, string>> = {
    title: {
        uz: 'Barcha mahsulot turlari', ru: 'Все категории товаров', en: 'All product categories', qr: 'Barlıq mahsulot turleri',
        zh: '所有品类', tr: 'Tüm ürün kategorileri', tg: 'Ҳамаи навъҳои маҳсулот', kk: 'Барлық тауар түрлері', tk: 'Ähli haryt görnüşleri', fa: 'همه دسته‌بندی‌ها',
    },
    viewAll: {
        uz: 'Barchasi', ru: 'Все товары', en: 'View all', qr: "Barlıǵı",
        zh: '全部商品', tr: 'Tümünü gör', tg: 'Ҳамаш', kk: 'Барлығы', tk: 'Hemmesi', fa: 'همه',
    },
    from: {
        uz: 'dan', ru: 'от', en: 'from', qr: 'dan',
        zh: '起', tr: "den", tg: 'аз', kk: 'бастап', tk: '-dan', fa: 'از',
    },
    items: {
        uz: "ta mahsulot", ru: 'товаров', en: 'products', qr: 'ta mahsulot',
        zh: '个产品', tr: 'ürün', tg: 'маҳсулот', kk: 'тауар', tk: 'haryt', fa: 'محصول',
    },
    subCats: {
        uz: 'ta tur', ru: 'видов', en: 'types', qr: 'ta tur',
        zh: '种', tr: 'çeşit', tg: 'навъ', kk: 'түрі', tk: 'görnüş', fa: 'نوع',
    },
};

function getCatName(cat: Category, lang: Language): string {
    return translateCategory(cat.slug, lang) || cat.name[lang as keyof typeof cat.name] || cat.name.uz || cat.name.ru;
}

export default function CategoryCatalogGrid() {
    const { language } = useLanguage();
    const categories = useCategoryStore((s) => s.categories);
    const products = useProductStore((s) => s.products);
    const activeCategories = categories.filter((c) => c.isActive);

    const ui = (key: string) => UI[key]?.[language] ?? UI[key]?.['uz'] ?? key;

    // Enhance each category with product count and representative image
    const enrichedCategories = activeCategories.map((cat) => {
        const catSlugs = new Set([cat.slug, ...(cat.children?.map((c) => c.slug) ?? [])]);
        const catProducts = products.filter(
            (p) => p.status === 'active' && p.category && catSlugs.has(p.category)
        );
        const rep = catProducts.find((p) => p.isFeatured) ?? catProducts[0];
        const minPrice = catProducts.length > 0 ? Math.min(...catProducts.map(p => p.price)) : null;
        const subCount = cat.children?.filter(ch => ch.isActive).length ?? 0;

        return {
            cat,
            count: catProducts.length,
            subCount,
            image: rep?.image || null,
            minPrice,
        };
    });

    // Only show categories that have products OR sub-categories
    const visibleCategories = enrichedCategories.filter(e => e.count > 0 || e.subCount > 0);

    if (visibleCategories.length === 0) return null;

    const currency = getProductUI('currency', language);

    return (
        <section className="bg-white border-t border-gray-100">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Section header */}
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-extrabold text-gray-900">
                        {ui('title')}
                    </h2>
                    <Link
                        href="/catalog"
                        className="text-sm text-brand-red hover:text-red-700 font-medium transition-colors flex items-center gap-1"
                    >
                        {ui('viewAll')}
                        <ChevronRight size={14} />
                    </Link>
                </div>

                {/* Grid — 5 columns desktop, 3 tablet, 2 mobile */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 border-l border-t border-gray-200">
                    {visibleCategories.map(({ cat, count, subCount, image, minPrice }) => (
                        <Link
                            key={cat.id}
                            href={`/category/${cat.slug}`}
                            className="group flex flex-col items-center text-center p-4 border-r border-b border-gray-200 hover:bg-surface-hover transition-colors duration-150 relative"
                        >
                            {/* Image / Icon */}
                            <div className="w-full aspect-square max-w-[110px] relative mb-3 flex items-center justify-center">
                                {image ? (
                                    <Image
                                        src={image}
                                        alt={getCatName(cat, language)}
                                        fill
                                        className="object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-200"
                                        sizes="110px"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-xl">
                                        <CategoryIcon name={cat.icon} className="w-12 h-12 text-gray-300" preferEmoji />
                                    </div>
                                )}
                            </div>

                            {/* Name */}
                            <p className="text-[13px] font-medium text-gray-800 group-hover:text-brand-red transition-colors duration-150 leading-snug line-clamp-2 mb-1.5 flex-1">
                                {getCatName(cat, language)}
                            </p>

                            {/* Sub-categories / product count */}
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-1">
                                {subCount > 0 && (
                                    <span>{subCount} {ui('subCats')}</span>
                                )}
                                {count > 0 && (
                                    <span className="flex items-center gap-0.5">
                                        <Package size={9} />
                                        {count}
                                    </span>
                                )}
                            </div>

                            {/* Price */}
                            {minPrice !== null && (
                                <p className="text-[13px] font-semibold text-brand-red mt-auto whitespace-nowrap">
                                    {ui('from')} {minPrice.toLocaleString()} {currency}
                                </p>
                            )}
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
