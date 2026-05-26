'use client';import { LogOut, Phone, Instagram, Send, Globe, Settings, Info, Youtube, Headset, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MobileProfilePage() {
    const _router = useRouter();
    return (
        <div className="bg-[#F9FAFB] min-h-screen flex flex-col">
            {/* Header */}
            <div className="bg-white p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <h1 className="text-lg font-bold text-gray-900">Profil</h1>
            </div>

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
                        <span className="font-bold text-sm">Operator bilan bog&apos;lanish</span>
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

function MenuItem({
    icon: Icon,
    label,
    value,
    badge,
}: {
    icon: LucideIcon;
    label: string;
    value?: string;
    badge?: string;
}) {
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

function SocialButton({
    icon: Icon,
    color,
    label,
}: {
    icon: LucideIcon;
    color: string;
    label?: string;
}) {
    return (
        <button
            className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform`}
            aria-label={label || "Social Link"}
        >
            <Icon className="w-5 h-5" />
        </button>
    )
}
