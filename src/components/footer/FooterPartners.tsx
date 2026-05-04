'use client';

import React from 'react';
import { DELIVERY_COMPANIES, PAYMENT_METHODS } from './footerData';

interface FooterPartnersProps {
    ui: (key: string) => string;
}

export default function FooterPartners({ ui }: FooterPartnersProps) {
    return (
        <>
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
        </>
    );
}
