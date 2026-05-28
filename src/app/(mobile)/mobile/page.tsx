'use client';

import Image from 'next/image';
import {
    Search,
} from 'lucide-react';
import Link from 'next/link';
import { useCategoryStore } from '@/lib/store/useCategoryStore';
import { useLanguage } from '@/lib/contexts/LanguageContext';

export default function MobileHomePage() {
    const categories = useCategoryStore((state) => state.categories);
    const { language } = useLanguage();

    return (
        <div className="pb-4">
            {/* Header */}
            <div className="p-4 bg-white sticky top-0 z-10 border-b border-gray-50">
                <div className="flex items-center justify-between mb-4">
                    {/* Logo or Brand */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                            {/* User Avatar Placeholder */}
                            <div className="w-full h-full flex items-center justify-center bg-gray-300 text-white">
                                <UserIcon />
                            </div>
                        </div>
                    </div>

                    <Link href="/mobile/ai-chat" className="p-2 hover:bg-gray-100 rounded-full relative" aria-label="AI Maslahatchi">
                        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                            AI
                        </div>
                        <BotIcon />
                    </Link>
                </div>

                {/* Hero / Banner */}
                <div className="mb-6 flex flex-col items-center justify-center py-4">
                    <div className="text-center">
                        <div className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 inline-block mb-1">PACK 24 uz</div>
                        <h2 className="text-xl font-bold text-slate-800 leading-tight">ДЕЛАЕМ КОРОБКИ<br /><span className="text-red-500">НУЖНОЙ ФОРМЫ И РАЗМЕРА</span></h2>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Mahsulotlar va toifalarni qidirish"
                        className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-purple/20"
                    />
                </div>
            </div>

            {/* Categories List (Vertical Cards with Images) */}
            <div className="flex flex-col px-4 pb-4 gap-4">
                {categories.filter(c => c.isActive).map((cat) => {
                    const imageUrl = cat.image || '/images/no-image.svg';

                    return (
                        <Link
                            key={cat.id}
                            href={`/mobile/catalog/${cat.slug}`}
                            className="flex items-center p-3 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-all"
                        >
                            {/* Image Container */}
                            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 mr-4 flex-shrink-0 relative">
                                {/* Using distinct colored backgrounds for placeholders if needed, or just the image */}
                                <Image
                                    src={imageUrl}
                                    alt={cat.name[language as keyof typeof cat.name] || cat.name.ru}
                                    className="w-full h-full object-cover" width={300} height={300}
                                />
                            </div>

                            {/* Text Content */}
                            <div className="flex-grow py-1">
                                <h3 className="text-base font-bold text-gray-800 leading-tight mb-1">
                                    {cat.name[language as keyof typeof cat.name] || cat.name.ru}
                                </h3>
                                <p className="text-xs text-gray-400 font-medium">
                                    {cat.productCount > 0 ? `${cat.productCount} ta mahsulot` : 'Katalog'}
                                </p>
                            </div>

                            {/* Arrow */}
                            <div className="text-gray-300 pr-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m9 18 6-6-6-6" />
                                </svg>
                            </div>
                        </Link>
                    )
                })}
            </div>

        </div>
    );
}

function UserIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-500">
            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
        </svg>
    )
}

function BotIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-blue-600">
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
        </svg>
    );
}
