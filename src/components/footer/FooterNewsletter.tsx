'use client';

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface FooterNewsletterProps {
    ui: (key: string) => string;
}

export default function FooterNewsletter({ ui }: FooterNewsletterProps) {
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);

    const handleSubscribe = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim()) {
            setSubscribed(true);
            setEmail('');
        }
    };

    return (
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
    );
}
