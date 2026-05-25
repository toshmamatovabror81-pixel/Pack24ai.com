import { PackageSearch, Home, Search, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '404 — Sahifa topilmadi | Pack24',
    description: "Siz izlagan sahifa mavjud emas yoki ko'chirilgan.",
    robots: { index: false, follow: false },
};

const QUICK_LINKS = [
    { label: 'Mahsulotlar',      href: '/catalog',       emoji: '📦' },
    { label: 'Konfigurator',     href: '/configurator',  emoji: '⚙️' },
    { label: 'Yetkazib berish',  href: '/delivery',      emoji: '🚚' },
    { label: 'Chegirmalar',      href: '/discounts',     emoji: '🏷️' },
    { label: 'Kontaktlar',       href: '/contacts',      emoji: '📞' },
    { label: 'FAQ',              href: '/faq',           emoji: '❓' },
];

export default function NotFound() {
    return (
        <div className="min-h-[75vh] flex items-center justify-center px-4 bg-gradient-to-b from-white to-gray-50">
            <div className="max-w-lg w-full text-center">

                {/* 404 visual */}
                <div className="relative mb-10 select-none">
                    <p className="text-[140px] font-black leading-none tracking-tighter text-gray-50 drop-shadow-sm">
                        404
                    </p>
                    {/* Icon centered over 404 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                            <div className="w-24 h-24 bg-white border border-blue-100 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-50">
                                <PackageSearch className="w-12 h-12 text-blue-500" strokeWidth={1.5} />
                            </div>
                            {/* Ping animation */}
                            <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-30" />
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 items-center justify-center">
                                    <span className="text-white text-[8px] font-black">!</span>
                                </span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Text */}
                <h1 className="text-2xl font-extrabold text-gray-900 mb-3">
                    Sahifa topilmadi
                </h1>
                <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                    Bu sahifa o&apos;chirilgan, ko&apos;chirilgan yoki hech qachon mavjud bo&apos;lmagan.
                    Quyidagi havolalardan foydalaning.
                </p>

                {/* Main actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl text-sm transition-all shadow-lg shadow-blue-100 hover:shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <Home size={15} />
                        Bosh sahifaga qaytish
                    </Link>
                    <Link
                        href="/catalog"
                        className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-xl text-sm transition-colors hover:bg-gray-50"
                    >
                        <Search size={15} />
                        Katalogga o&apos;tish
                    </Link>
                </div>

                {/* Quick links grid */}
                <div className="border-t border-gray-100 pt-8">
                    <p className="text-[11px] text-gray-400 uppercase tracking-widest font-bold mb-4">
                        Foydali bo&apos;limlar
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {QUICK_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="group flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left"
                            >
                                <span className="text-base">{link.emoji}</span>
                                <span className="text-xs font-semibold text-gray-600 group-hover:text-blue-700 transition-colors flex-1">
                                    {link.label}
                                </span>
                                <ChevronRight size={11} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
