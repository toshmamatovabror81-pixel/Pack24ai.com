'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { User, LogOut, Phone, Instagram, Send, MapPin, Globe, Settings, Info, Youtube, Bot, Headset, Leaf } from 'lucide-react';
import { useRouter } from 'next/navigation';
import EcoStatusCard from '@/components/eco/EcoStatusCard';
import AchievementGrid from '@/components/eco/AchievementGrid';

interface EcoProfile {
    ecoPoints: number;
    ecoLevel: string;
    totalRecycledWeight: number;
    totalCO2Saved: number;
    treesEquivalent: number;
    ecoStreak: number;
    achievements: Array<{ badgeKey: string; earnedAt: string }>;
}

export default function MobileProfilePage() {
    const router = useRouter();
    const [eco, setEco] = useState<EcoProfile | null>(null);
    const [ecoLoading, setEcoLoading] = useState(true);

    useEffect(() => {
        // Try to get userId from Telegram WebApp or session
        const tg = (window as any).Telegram?.WebApp;
        const tgUserId = tg?.initDataUnsafe?.user?.id;

        if (tgUserId) {
            fetch(`/api/user/eco-progress?userId=${tgUserId}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data) setEco(data); })
                .catch(() => {})
                .finally(() => setEcoLoading(false));
        } else {
            setEcoLoading(false);
        }
    }, []);

    return (
        <div className="bg-[#F9FAFB] min-h-screen flex flex-col">
            {/* Header */}
            <div className="bg-white p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <h1 className="text-lg font-bold text-gray-900">Profil</h1>
            </div>

            {/* Eco Gamification Section */}
            {!ecoLoading && eco && (
                <div className="mt-4 px-4 space-y-3">
                    <EcoStatusCard
                        ecoLevel={eco.ecoLevel}
                        ecoPoints={eco.ecoPoints}
                        totalKg={eco.totalRecycledWeight}
                        language="uz"
                    />
                    {eco.achievements && eco.achievements.length > 0 && (
                        <AchievementGrid
                            earnedBadges={eco.achievements}
                            language="uz"
                        />
                    )}
                </div>
            )}

            {/* Eco CTA (when no eco data) */}
            {!ecoLoading && !eco && (
                <div className="mt-4 px-4">
                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                            <Leaf className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-emerald-800">Eko dasturga qo'shiling!</p>
                            <p className="text-xs text-emerald-600 mt-0.5">Makulatura topshiring va ball yig'ing</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Support Section */}
            <div className="mt-4 px-4">
                <a
                    href="https://t.me/pack24_operator"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-white border border-gray-100 text-gray-800 p-4 rounded-2xl shadow-sm active:scale-95 transition-transform flex items-center justify-between group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            <Headset className="w-6 h-6" />
                        </div>
                        <span className="font-bold text-sm">Operator bilan bog'lanish</span>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </a>
            </div>

            {/* Menu List */}
            <div className="mt-4 bg-white">
                <div className="divide-y divide-gray-50">
                    <MenuItem icon={Settings} label="Sozlamalar" badge="Tez orada" />
                    <MenuItem icon={Globe} label="Til" value="O'zbekcha" />
                    <MenuItem icon={Info} label="Biz haqimizda" />
                    <MenuItem icon={Phone} label="Biz bilan bog'lanish" />
                </div>
            </div>

            {/* Login CTA */}
            <div className="mt-8 px-4">
                <button className="w-full bg-red-50 text-red-600 font-medium py-3 rounded-xl flex items-center justify-center gap-2" aria-label="Chiqish">
                    <LogOut className="w-5 h-5" />
                    Chiqish
                </button>
            </div>

            {/* Social Links */}
            <div className="mt-auto p-6 pb-8">
                <p className="text-sm font-medium text-gray-900 mb-3">Ijtimoiy tarmoqlar:</p>
                <div className="flex gap-3">
                    <SocialButton icon={Instagram} color="bg-pink-500" label="Instagram" />
                    <SocialButton icon={Send} color="bg-blue-500" label="Telegram" />
                    <SocialButton icon={Youtube} color="bg-red-500" label="Youtube" />
                </div>
                <p className="text-xs text-gray-400 mt-6 text-center">
                    robosell.uz tomonidan taqdim etilgan
                </p>
            </div>
        </div>
    );
}

function MenuItem({ icon: Icon, label, value, badge }: any) {
    return (
        <div className="flex items-center justify-between p-4 active:bg-gray-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-gray-900">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                {badge && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>}
                {value && <span className="text-sm text-gray-400">{value}</span>}
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </div>
    )
}

function SocialButton({ icon: Icon, color, label }: any) {
    return (
        <button
            className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform`}
            aria-label={label || "Social Link"}
        >
            <Icon className="w-5 h-5" />
        </button>
    )
}
