'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import React, { useState } from 'react';
import {
    Phone, Mail, MapPin, Clock, Send,
    Instagram, MessageCircle, ArrowRight,
} from 'lucide-react';
import type { Language } from '@/lib/translations';
import {
    FOOTER_LINKS, STATS, DELIVERY_COMPANIES,
    PAYMENT_METHODS, UI,
} from './footer/footerData';

export default function Footer() {
    const { language } = useLanguage();
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);

    const ui = (key: string) => UI[key]?.[language] ?? UI[key]?.['en'] ?? UI[key]?.['ru'] ?? key;
    const lbl = (l: Partial<Record<Language, string>>) => l[language] ?? l['en'] ?? l['ru'] ?? l['uz'];

    const handleSubscribe = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim()) { setSubscribed(true); setEmail(''); }
    };

    return (
        <footer className="bg-[#0c1a2e] text-white">

            {/* ── Callback CTA strip ── */}
            <div className="bg-[#102a45] border-b border-white/10">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <p className="font-bold text-white">{ui('callTitle')}</p>
                        <p className="text-sm text-blue-200/70">{ui('callSub')}</p>
                    </div>
                    <Link
                        href="/contacts"
                        className="flex-shrink-0 bg-[#e33326] hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl transition-colors text-sm"
                    >
                        {ui('callback')}
                    </Link>
                </div>
            </div>

            {/* ── Main footer body ── */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">

                    {/* Brand + contacts */}
                    <div className="lg:col-span-2">
                        <div className="mb-4">
                            <span className="text-2xl font-black tracking-tighter">
                                PACK<span className="text-[#e33326]">24</span>
                                <span className="text-blue-400 ml-1 text-lg">AI</span>
                            </span>
                            <p className="text-blue-200/60 text-xs mt-1 font-medium">{ui('tagline')}</p>
                        </div>

                        <div className="space-y-2.5 text-sm">
                            <a href="tel:+998880557888" className="flex items-center gap-2.5 text-blue-100 hover:text-white transition-colors">
                                <Phone size={14} className="text-blue-400 shrink-0" />
                                <span>+998 88 055-78-88</span>
                            </a>
                            <a href="tel:+998951050052" className="flex items-center gap-2.5 text-blue-100 hover:text-white transition-colors">
                                <Phone size={14} className="text-blue-400 shrink-0" />
                                <span>+998 95 105-00-52</span>
                            </a>
                            <a href="mailto:sales@pack24.uz" className="flex items-center gap-2.5 text-blue-100 hover:text-white transition-colors">
                                <Mail size={14} className="text-blue-400 shrink-0" />
                                <span>sales@pack24.uz</span>
                            </a>
                            <div className="flex items-start gap-2.5 text-blue-100">
                                <MapPin size={14} className="text-blue-400 shrink-0 mt-0.5" />
                                <span>{ui('address')}</span>
                            </div>
                            <div className="flex items-center gap-2.5 text-blue-100">
                                <Clock size={14} className="text-blue-400 shrink-0" />
                                <span>{ui('schedule')}</span>
                            </div>
                        </div>

                        {/* Social links */}
                        <div className="flex gap-2 mt-5">
                            {[
                                { icon: Instagram,      label: 'Instagram', href: '#', color: 'hover:bg-pink-600' },
                                { icon: Send,           label: 'Telegram',  href: '#', color: 'hover:bg-blue-500' },
                                { icon: MessageCircle,  label: 'WhatsApp',  href: '#', color: 'hover:bg-green-600' },
                            ].map(({ icon: Icon, label, href, color }) => (
                                <a
                                    key={label}
                                    href={href}
                                    aria-label={label}
                                    className={`w-9 h-9 bg-white/10 ${color} rounded-xl flex items-center justify-center transition-colors`}
                                >
                                    <Icon size={16} />
                                </a>
                            ))}
                        </div>

                        {/* Stats */}
                        <div className="mt-5 grid grid-cols-2 gap-2">
                            {STATS.map((stat, idx) => {
                            const Icon = stat.icon;
                            return (
                                <div key={idx} className="flex items-center gap-1.5 text-blue-200/60 text-xs">
                                    <Icon size={12} className="text-blue-400 shrink-0" />
                                    <span>{lbl(stat.label)}</span>
                                </div>
                            );
                            })}
                        </div>
                    </div>

                    {/* Nav link columns */}
                    {Object.entries(FOOTER_LINKS).map(([key, section]) => (
                        <div key={key}>
                            <h3 className="text-xs font-extrabold uppercase tracking-widest text-blue-200/60 mb-4">
                                {lbl(section.title)}
                            </h3>
                            <ul className="space-y-2.5">
                                {section.links.map((link) => (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-blue-100/80 hover:text-white transition-colors"
                                        >
                                            {lbl(link.label)}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* ── Newsletter ── */}
                <div className="mt-10 pt-8 border-t border-white/10">
                    <div className="bg-gradient-to-br from-[#102a45] to-[#0e2038] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                            <p className="font-bold text-white mb-1">{ui('newsTitle')}</p>
                            <p className="text-sm text-blue-200/60">{ui('newsSub')}</p>
                        </div>
                        {subscribed ? (
                            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 px-5 py-3 rounded-xl text-sm font-semibold flex-shrink-0">
                                ✓ {ui('subscribed')}
                            </div>
                        ) : (
                            <form onSubmit={handleSubscribe} className="flex gap-2 w-full md:w-auto flex-shrink-0">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={ui('emailPlaceholder')}
                                    required
                                    className="flex-1 md:w-60 bg-white/10 border border-white/20 text-white placeholder-blue-200/40 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 transition-colors"
                                />
                                <button
                                    type="submit"
                                    className="bg-[#e33326] hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 text-sm whitespace-nowrap"
                                >
                                    {ui('subscribe')}
                                    <ArrowRight size={14} />
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* ── Delivery companies ── */}
                <div className="mt-8 pt-6 border-t border-white/10">
                    <p className="text-xs font-bold uppercase tracking-widest text-blue-200/40 mb-3">
                        {ui('delivery')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {DELIVERY_COMPANIES.map((name) => (
                            <span key={name} className="text-xs bg-white/5 border border-white/10 text-blue-200/60 px-3 py-1.5 rounded-lg font-medium">
                                {name}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── Payment methods ── */}
                <div className="mt-6">
                    <p className="text-xs font-bold uppercase tracking-widest text-blue-200/40 mb-3">
                        {ui('payments')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {PAYMENT_METHODS.map(({ label, bg }) => (
                            <span key={label} className={`${bg} text-white text-xs font-extrabold px-3 py-1.5 rounded-lg`}>
                                {label}
                            </span>
                        ))}
                    </div>
                </div>

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
