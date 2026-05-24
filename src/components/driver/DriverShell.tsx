'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useDriverStore } from '@/lib/store/useDriverStore';

// ─── Icons ────────────────────────────────────────────────────────────────────

function HomeIcon({ active }: { active?: boolean }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    );
}

function ClipboardIcon({ active }: { active?: boolean }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
        </svg>
    );
}

function UserIcon({ active }: { active?: boolean }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
    { href: '/driver/dashboard', label: 'Bosh sahifa', Icon: HomeIcon },
    { href: '/driver/tasks', label: 'Vazifalar', Icon: ClipboardIcon },
    { href: '/driver/profile', label: 'Profil', Icon: UserIcon },
];

// ─── DriverShell ──────────────────────────────────────────────────────────────

/**
 * Driver ilovasi asosiy shell komponenti.
 *
 * Vazifalar:
 *   - Auth token mavjudligini tekshiradi → yo'q bo'lsa `/driver/login`ga redirect
 *   - Pastki navigatsiya (Bottom Nav) ko'rsatadi
 *   - Online/Offline toggling uchun yuqori status bar
 */
export default function DriverShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const token = useDriverStore((s) => s.token);
    const driver = useDriverStore((s) => s.driver);
    const setOnline = useDriverStore((s) => s.setOnline);

    // Auth guard
    useEffect(() => {
        if (!token) {
            router.replace('/driver/login');
        }
    }, [token, router]);

    if (!token || !driver) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const handleOnlineToggle = () => {
        setOnline(!driver.isOnline);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            {/* Top Status Bar */}
            <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
                <div className="flex items-center justify-between max-w-md mx-auto">
                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-900/30">
                            {driver.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white leading-none">{driver.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {driver.point?.regionUz ?? 'Hudud belgilanmagan'}
                            </p>
                        </div>
                    </div>

                    {/* Online Toggle */}
                    <button
                        id="driver-online-toggle"
                        onClick={handleOnlineToggle}
                        className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold
                            transition-all duration-300 border
                            ${driver.isOnline
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-900/20 shadow-lg'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }
                        `}
                    >
                        <span className={`w-2 h-2 rounded-full ${driver.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {driver.isOnline ? 'Online' : 'Offline'}
                    </button>
                </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto pb-20 max-w-md mx-auto w-full">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 safe-area-pb">
                <div className="flex items-center justify-around max-w-md mx-auto px-2 py-2">
                    {NAV_ITEMS.map(({ href, label, Icon }) => {
                        const active = pathname === href || pathname.startsWith(href + '/');
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`
                                    flex flex-col items-center gap-1 px-4 py-2 rounded-2xl
                                    transition-all duration-200
                                    ${active
                                        ? 'text-emerald-400 bg-emerald-500/10'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }
                                `}
                            >
                                <Icon active={active} />
                                <span className="text-[10px] font-medium leading-none">{label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
