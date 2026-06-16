'use client';

import { usePathname } from 'next/navigation';import { Bell, Search, ChevronDown } from 'lucide-react';
import { navItems } from './adminNavConfig';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AdminHeaderProps {
    newOrdersCount: number;
}

export default function AdminHeader({ newOrdersCount }: AdminHeaderProps) {
    const pathname = usePathname();

    return (
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 h-16 flex items-center justify-between px-8 sticky top-0 z-40 shadow-sm transition-all">
            <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                    {navItems.find(i => pathname.startsWith(i.href))?.name || 'Boshqaruv Paneli'}
                </h2>
            </div>

            {/* Global Search */}
            <div className="flex-1 max-w-xl mx-12 hidden md:block">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Global qidiruv (Mijoz, Buyurtma ID, Telefon)..."
                        className="w-full bg-gray-50/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                        <kbd className="hidden group-focus-within:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                            <span className="text-xs">⌘</span>K
                        </kbd>
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-4">
                <ThemeToggle />
                
                <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors" aria-label="Bildirishnomalar">
                    <Bell size={20} />
                    {newOrdersCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-white px-0.5">
                            {newOrdersCount > 99 ? '99+' : newOrdersCount}
                            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
                        </span>
                    )}
                </button>

                <div className="flex items-center space-x-3 h-10 cursor-pointer hover:bg-gray-50 px-2 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold border border-blue-200">
                        A
                    </div>
                    <div className="text-left hidden sm:block">
                        <p className="text-sm font-bold text-slate-800 leading-none">Abror</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Administrator</p>
                    </div>
                    <ChevronDown size={14} className="text-slate-400" />
                </div>
            </div>
        </header>
    );
}
