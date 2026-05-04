'use client';

import React from 'react';
import Link from 'next/link';
import { Language } from '@/lib/translations';
import { FOOTER_LINKS } from './footerData';

interface FooterLinksProps {
    lbl: (l: Partial<Record<Language, string>>) => string;
}

export default function FooterLinks({ lbl }: FooterLinksProps) {
    return (
        <>
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
        </>
    );
}
