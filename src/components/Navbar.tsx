
'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useHasMounted } from '@/lib/hooks/useHasMounted';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

// Sub-komponentlar
import NavTopBar from './layout/NavTopBar';
import NavCatalogDropdown from './layout/NavCatalogDropdown';
import NavSearchBar from './layout/NavSearchBar';
import NavUserActions from './layout/NavUserActions';

// t() kalitlari orqali barcha 10 til avtomatik qo'llanadi
const NAV_LINKS = [
    { href: '/',                 key: 'nav.home' },
    { href: '/delivery',         key: 'nav.delivery' },
    { href: '/payment',          key: 'nav.payment' },
    { href: '/discounts',        key: 'nav.discounts' },
    { href: '/special-offers',   key: 'nav.special' },
    { href: '/recycling',        key: 'nav.recycling' },
    { href: '/eco-dashboard',    key: 'nav.eco_dashboard' }, // Added for Gamification UI
    { href: '/prts',             key: 'nav.prts' },          // PRTS Recycle Track System
    { href: '/referral',         key: 'nav.referral' },      // Added for Gamification UI
    { href: '/reviews',          key: 'nav.reviews' },
    { href: '/faq',              key: 'nav.faq' },
    { href: '/active-vacancies', key: 'nav.vacancies' },
    { href: '/contacts',         key: 'nav.contacts' },
] as const;




export default function Navbar() {
    const { language, t } = useLanguage();
    const hasMounted = useHasMounted();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const isRtl = language === 'fa';

    // SSR skeleton — hydration xatolarini oldini olish
    if (!hasMounted) {
        return (
            <nav className="bg-brand-dark text-white shadow-lg sticky top-0 z-50">
                <div className="max-w-site mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-[70px]">
                        <span className="text-2xl font-black tracking-tighter">
                            PACK<span className="text-brand-red">24</span>
                        </span>
                    </div>
                </div>
            </nav>
        );
    }

    return (
        <header className="font-sans flex flex-col w-full text-sm sticky top-0 z-50 shadow-md" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* 1. Top info bar */}
            <NavTopBar />

            {/* 2. Main header: Logo + Catalog + Search + Actions */}
            <div className="bg-white py-4 md:py-5 border-b border-gray-100">
                <div className="max-w-site mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-6">
                    {/* Logo */}
                    <Link href="/" className="flex-shrink-0 flex items-center mr-2" aria-label="Pack24 bosh sahifasi">
                        <span className="text-3xl font-black text-gray-900 tracking-tighter uppercase relative">
                            PACK24 <span className="text-blue-600">AI</span>
                        </span>
                    </Link>
                    {/* Catalog button */}
                    <NavCatalogDropdown />


                    {/* Search */}
                    <NavSearchBar />

                    {/* Online payment — hidden on small */}
                    <div className="hidden xl:block flex-shrink-0">
                        <Link
                            href="/payment"
                            className="text-brand-red border border-brand-red px-4 py-2.5 rounded text-[13px] font-bold uppercase hover:bg-brand-red hover:text-white transition-colors whitespace-nowrap"
                        >
                            {t('nav.onlinePayment')}
                        </Link>
                    </div>

                    {/* User: profile, favorites, cart */}
                    <NavUserActions />

                    {/* Mobile hamburger */}
                    <button
                        className="md:hidden ml-auto text-gray-700 hover:text-brand-red transition-colors"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label={mobileOpen ? 'Menyu yopish' : 'Menyu ochish'}
                    >
                        {mobileOpen ? <X size={26} /> : <Menu size={26} />}
                    </button>
                </div>
            </div>

            {/* 3. Desktop nav links */}
            <nav className="bg-white hidden md:block border-b-2 border-gray-100" aria-label="Asosiy navigatsiya">
                <div className="max-w-site mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center space-x-0 overflow-x-auto">
                        {NAV_LINKS.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`font-bold text-[13px] py-4 px-3 lg:px-4 uppercase whitespace-nowrap transition-colors border-b-2 ${
                                        isActive
                                            ? 'text-brand-red border-brand-red'
                                            : 'text-brand-dark hover:text-brand-red border-transparent'
                                    }`}
                                >
                                    {t(link.key)}
                                </Link>
                            );
                        })}

                    </div>
                </div>
            </nav>


            {/* 4. Mobile menu */}
            {mobileOpen && (
                <nav
                    className="md:hidden bg-white border-b border-gray-200 px-4 pb-4 animate-in slide-in-from-top-2 duration-200"
                    aria-label="Mobil navigatsiya"
                >
                    <ul className="flex flex-col space-y-1 mt-2">
                        {NAV_LINKS.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={`flex items-center justify-between py-3 border-b border-gray-100 uppercase text-xs font-bold transition-colors ${
                                            isActive ? 'text-brand-red' : 'text-gray-700 hover:text-brand-red'
                                        }`}
                                    >
                                        {t(link.key)}
                                        {isActive && <span className="w-2 h-2 bg-brand-red rounded-full" />}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            )}
        </header>
    );
}
