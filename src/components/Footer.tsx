'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import React from 'react';
import type { Language } from '@/lib/translations';
import { UI } from './footer/footerData';

import FooterContacts from './footer/FooterContacts';
import FooterLinks from './footer/FooterLinks';
import FooterNewsletter from './footer/FooterNewsletter';
import FooterPartners from './footer/FooterPartners';

export default function Footer() {
    const { language } = useLanguage();

    const ui = (key: string) => UI[key]?.[language] ?? UI[key]?.['en'] ?? UI[key]?.['ru'] ?? key;
    const lbl = (l: Partial<Record<Language, string>>) => l[language] ?? l['en'] ?? l['ru'] ?? l['uz'] ?? '';

    return (
        <footer className="bg-brand-deeper text-white">

            {/* ── Callback CTA strip ── */}
            <div className="bg-brand-dark border-b border-white/10">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <p className="font-bold text-white">{ui('callTitle')}</p>
                        <p className="text-sm text-blue-200/70">{ui('callSub')}</p>
                    </div>
                    <Link
                        href="/contacts"
                        className="flex-shrink-0 bg-brand-red hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl transition-colors text-sm"
                    >
                        {ui('callback')}
                    </Link>
                </div>
            </div>

            {/* ── Main footer body ── */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
                    
                    <FooterContacts language={language} ui={ui} lbl={lbl} />
                    
                    <FooterLinks lbl={lbl} />

                </div>

                <FooterNewsletter ui={ui} />

                <FooterPartners ui={ui} />

                {/* ── Copyright ── */}
                <div className="mt-10 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-blue-200/40">
                    <p>© Pack24 AI — {ui('tagline')}, 2015–{new Date().getFullYear()}</p>
                    <div className="flex gap-4">
                        <Link href="/privacy" className="hover:text-blue-200 transition-colors">{ui('privacy')}</Link>
                        <Link href="/offer"   className="hover:text-blue-200 transition-colors">{ui('offer')}</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
