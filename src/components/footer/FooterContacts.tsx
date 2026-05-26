'use client';

import React from 'react';
import { Phone, Mail, MapPin, Clock, Instagram, Send, MessageCircle } from 'lucide-react';
import { Language } from '@/lib/translations';
import { STATS } from './footerData';

interface FooterContactsProps {
    language: Language;
    ui: (key: string) => string;
    lbl: (l: Partial<Record<Language, string>>) => string;
}

export default function FooterContacts({ language: _language, ui, lbl }: FooterContactsProps) {
    return (
        <div className="lg:col-span-2">
            <div className="mb-4">
                <span className="text-2xl font-black tracking-tighter text-white">
                    PACK<span className="text-brand-red">24</span>
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
                        className={`w-9 h-9 bg-white/10 ${color} rounded-xl flex items-center justify-center transition-colors text-white`}
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
    );
}
