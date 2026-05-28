'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react';
import BoxCalculator from '@/components/home/BoxCalculator';
import { useCategoryStore, Category } from '@/lib/store/useCategoryStore';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { usePathname } from 'next/navigation';
import { translateCategory } from '@/lib/product-translations';

export default function CatalogSidebar() {
    const { language } = useLanguage();
    const pathname = usePathname();
    const categories = useCategoryStore((s) => s.categories);
    const activeCategories = categories.filter((c) => c.isActive);
    const [expanded, setExpanded] = useState<string | null>(null);

    const UI: Record<string, Record<string, string>> = {
        allCategories: { uz: 'Barcha kategoriyalar', ru: 'Все категории', en: 'All Categories', qr: 'Barliq kategoriyalar', zh: '所有类别', tr: 'Tüm Kategoriler', tg: 'Ҳамаи категорияҳо', kk: 'Барлық санаттар', tk: 'Ähli kategoriýalar', fa: 'همه دسته‌بندی‌ها' },
        viewAll:       { uz: "Barchasini ko'rish", ru: 'Смотреть все', en: 'View all', qr: "Barlıqın kóriw", zh: '查看全部', tr: 'Tümünü gör', tg: 'Хамаашро дидан', kk: 'Барлығын көру', tk: 'Hemmesini gör', fa: 'مشаهده همه' },
        fullCatalog:   { uz: "To'liq katalog", ru: 'Полный каталог', en: 'Full Catalog', qr: "To'liq katalog", zh: '完整目录', tr: 'Tam Katalog', tg: 'Каталоги пурра', kk: 'Толық каталог', tk: 'Doly katalog', fa: 'کاتالوگ کامل' },
    };
    const ui = (key: string) => UI[key]?.[language] ?? UI[key]?.['uz'] ?? key;

    // Kategoriya nomini til bo'yicha olish — CATEGORY_NAMES dan, keyin DB dan fallback
    const getName = (cat: Category) =>
        translateCategory(cat.slug, language);

    return (
        <nav className="w-[260px] shrink-0 self-start sticky top-[80px] flex flex-col gap-3">
            {/* Box Calculator — kategoriyalar ustida */}
            <BoxCalculator />

            {/* Categories */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2.5 px-4 py-3.5 bg-brand-navy text-white">
                    <LayoutGrid size={16} className="shrink-0" />
                    <span className="font-bold text-sm tracking-wide uppercase">
                        {ui('allCategories')}
                    </span>
                </div>

                {/* Category list — scrollable */}
                <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
                    <ul className="py-1">
                        {activeCategories.map((cat) => {
                            const hasChildren = !!cat.children?.length;
                            const isExpanded = expanded === cat.id;
                            const isActive = pathname === `/category/${cat.slug}`;

                            return (
                                <li key={cat.id}>
                                    {/* Parent row */}
                                    <div className={`flex items-center gap-2 px-3 py-[7px] group cursor-pointer transition-colors
                                        ${isActive ? 'bg-red-50' : 'hover:bg-red-50'}`}>
                                        {/* Icon */}
                                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors
                                            ${isActive ? 'bg-red-100' : 'bg-gray-100 group-hover:bg-red-100'}`}>
                                            <CategoryIcon name={cat.icon} className={`w-3 h-3 ${isActive ? 'text-red-600' : 'text-gray-500 group-hover:text-red-500'}`} />
                                        </div>

                                        {/* Name — link or expand */}
                                        {hasChildren ? (
                                            <button
                                                onClick={() => setExpanded(isExpanded ? null : cat.id)}
                                                className={`flex-1 text-left text-[13px] font-medium leading-tight truncate transition-colors
                                                    ${isActive ? 'text-red-600 font-semibold' : 'text-gray-700 group-hover:text-red-600'}`}
                                            >
                                                {getName(cat)}
                                            </button>
                                        ) : (
                                            <Link
                                                href={`/category/${cat.slug}`}
                                                className={`flex-1 text-[13px] font-medium leading-tight truncate transition-colors
                                                    ${isActive ? 'text-red-600 font-semibold' : 'text-gray-700 hover:text-red-600'}`}
                                            >
                                                {getName(cat)}
                                            </Link>
                                        )}

                                        {/* Arrow */}
                                        {hasChildren ? (
                                            <button
                                                onClick={() => setExpanded(isExpanded ? null : cat.id)}
                                                aria-label={isExpanded ? 'Yopish' : 'Ochish'}
                                                className={`text-gray-400 hover:text-gray-600 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
                                            >
                                                <ChevronRight size={13} />
                                            </button>
                                        ) : (
                                            <ChevronRight size={11} className="text-gray-300 shrink-0 group-hover:text-gray-400" />
                                        )}
                                    </div>

                                    {/* Sub-categories */}
                                    {hasChildren && isExpanded && (
                                        <ul className="border-l-2 border-blue-100 ml-5 mb-0.5">
                                            {cat.children!.map((sub) => {
                                                const subActive = pathname === `/category/${sub.slug}`;
                                                return (
                                                    <li key={sub.id}>
                                                        <Link
                                                            href={`/category/${sub.slug}`}
                                                            className={`flex items-center gap-1.5 px-3 py-[5px] text-xs transition-colors
                                                                ${subActive
                                                                    ? 'text-red-600 font-semibold bg-red-50'
                                                                    : 'text-gray-500 hover:text-red-600 hover:bg-red-50'}`}
                                                        >
                                                            <span className="w-1 h-1 rounded-full bg-current shrink-0 opacity-60" />
                                                            {getName(sub)}
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                            <li>
                                                <Link
                                                    href={`/category/${cat.slug}`}
                                                    className="flex items-center gap-1.5 px-3 py-[5px] text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 font-semibold transition-colors"
                                                >
                                                    <ChevronDown size={10} />
                                                    {ui('viewAll')}
                                                </Link>
                                            </li>
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    {/* Footer: full catalog */}
                    <div className="px-3 py-2.5 border-t border-gray-100">
                        <Link
                            href="/catalog"
                            className="flex items-center justify-center gap-2 w-full py-2 bg-brand-navy hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition-colors"
                        >
                            <LayoutGrid size={12} />
                            {ui('fullCatalog')}
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
