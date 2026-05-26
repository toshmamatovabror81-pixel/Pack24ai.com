'use client';

import Link from 'next/link';
import { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCategoryStore, type Category } from '@/lib/store/useCategoryStore';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Language } from '@/lib/translations';
import { ChevronRight } from 'lucide-react';

type L = Record<Language, string>;

const LABEL: L = {
    uz: 'Katalog', ru: 'Каталог', en: 'Catalog', qr: 'Katalog',
    zh: '目录', tr: 'Katalog', tg: 'Каталог', kk: 'Каталог', tk: 'Katalog', fa: 'کاتالوگ',
};
const VIEW_ALL: L = {
    uz: "Barchasini ko'rish →", ru: 'Смотреть все →', en: 'View all →', qr: "Barlıqın kóriw →",
    zh: '查看全部 →', tr: 'Tümünü gör →', tg: 'Ҳамаашро дидан →', kk: 'Барлығын көру →', tk: 'Hemmesini gör →', fa: '→ مشاهده همه',
};

function getCatName(cat: Category, lang: Language): string {
    return cat.name[lang as keyof typeof cat.name] || cat.name.uz || cat.name.ru;
}

function getIcon(iconName: string): LucideIcon {
    const map = LucideIcons as unknown as Record<string, LucideIcon | undefined>;
    return (iconName && map[iconName]) || LucideIcons.Box;
}

export default function NavCatalogDropdown() {
    const { language } = useLanguage();
    const categories = useCategoryStore((state) => state.categories);
    const [isOpen, setIsOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearCloseTimer = useCallback(() => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    }, []);

    const startCloseTimer = useCallback(() => {
        clearCloseTimer();
        closeTimer.current = setTimeout(() => {
            setIsOpen(false);
            setActiveCategory(null);
        }, 200);
    }, [clearCloseTimer]);

    const handleMouseEnterButton = () => {
        clearCloseTimer();
        setIsOpen(true);
    };

    const handleMouseEnterDropdown = () => {
        clearCloseTimer();
    };

    const handleMouseLeave = () => {
        startCloseTimer();
    };

    const activeCategories = categories.filter((c) => c.isActive);
    const hoveredCat = activeCategories.find((c) => c.id === activeCategory);
    const hasChildren = hoveredCat?.children && hoveredCat.children.length > 0;

    return (
        <div className="relative z-50">
            {/* Catalog Button */}
            <Link
                href="/catalog"
                className="hidden lg:flex items-center bg-[#e33326] text-white px-5 py-3 rounded text-[15px] font-bold uppercase hover:bg-[#c92d21] transition-colors gap-2 flex-shrink-0"
                onMouseEnter={handleMouseEnterButton}
                onMouseLeave={handleMouseLeave}
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                {LABEL[language] ?? LABEL.uz}
            </Link>

            {/* Mega Menu */}
            {isOpen && (
                <div
                    className="absolute top-full left-0 flex"
                    onMouseEnter={handleMouseEnterDropdown}
                    onMouseLeave={handleMouseLeave}
                    style={{ paddingTop: '4px' }}
                >
                    {/* ─── Left: Kategoriyalar ro'yxati ─── */}
                    <div className="w-[300px] bg-white rounded-bl-lg shadow-2xl border border-gray-100 max-h-[75vh] overflow-y-auto custom-scrollbar">
                        {activeCategories.map((cat) => {
                            const Icon = getIcon(cat.icon);
                            const isHovered = activeCategory === cat.id;
                            const hasSubs = cat.children && cat.children.length > 0;

                            return (
                                <Link
                                    key={cat.id}
                                    href={`/category/${cat.slug}`}
                                    className={`flex items-center gap-3 px-4 py-3 text-[13.5px] transition-all border-b border-gray-50 last:border-0 ${
                                        isHovered
                                            ? 'bg-[#e33326]/5 text-[#e33326]'
                                            : 'text-gray-700 hover:bg-gray-50 hover:text-[#e33326]'
                                    }`}
                                    onMouseEnter={() => setActiveCategory(cat.id)}
                                    onClick={() => { setIsOpen(false); setActiveCategory(null); }}
                                >
                                    <Icon size={17} className={isHovered ? 'text-[#e33326]' : 'text-gray-400'} />
                                    <span className="font-medium flex-1 leading-tight">{getCatName(cat, language)}</span>
                                    {hasSubs && (
                                        <ChevronRight size={14} className={isHovered ? 'text-[#e33326]' : 'text-gray-300'} />
                                    )}
                                </Link>
                            );
                        })}

                        {/* Barchasini ko'rish */}
                        <Link
                            href="/catalog"
                            className="block text-center py-3 text-xs font-bold text-[#e33326] bg-red-50/60 hover:bg-red-50 uppercase tracking-wide sticky bottom-0"
                            onClick={() => { setIsOpen(false); setActiveCategory(null); }}
                        >
                            {VIEW_ALL[language] ?? VIEW_ALL.uz}
                        </Link>
                    </div>

                    {/* ─── Right: Ichki kategoriyalar (submenu) ─── */}
                    {hasChildren && hoveredCat && (
                        <div
                            className="w-[280px] bg-white rounded-br-lg shadow-2xl border border-l-0 border-gray-100 max-h-[75vh] overflow-y-auto"
                            onMouseEnter={handleMouseEnterDropdown}
                        >
                            {/* Submenu sarlavha */}
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    {getCatName(hoveredCat, language)}
                                </p>
                            </div>

                            {hoveredCat.children!.filter(sub => sub.isActive).map((sub) => {
                                const SubIcon = getIcon(sub.icon);
                                return (
                                    <Link
                                        key={sub.id}
                                        href={`/category/${sub.slug}`}
                                        className="flex items-center gap-3 px-4 py-3 text-[13px] text-gray-600 hover:bg-[#e33326]/5 hover:text-[#e33326] transition-all border-b border-gray-50 last:border-0"
                                        onClick={() => { setIsOpen(false); setActiveCategory(null); }}
                                    >
                                        <SubIcon size={15} className="text-gray-400" />
                                        <span className="font-medium leading-tight">{getCatName(sub, language)}</span>
                                    </Link>
                                );
                            })}

                            {/* Kategoriya ichidagi barchasini ko'rish */}
                            <Link
                                href={`/category/${hoveredCat.slug}`}
                                className="block text-center py-2.5 text-xs font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-50 uppercase tracking-wide sticky bottom-0"
                                onClick={() => { setIsOpen(false); setActiveCategory(null); }}
                            >
                                {VIEW_ALL[language] ?? VIEW_ALL.uz}
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
