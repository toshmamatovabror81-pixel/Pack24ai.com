'use client';

import Link from 'next/link';import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    Settings,
    Plus,
    ChevronDown,
    LogOut,
} from 'lucide-react';
import { useState } from 'react';
import { navItems } from './adminNavConfig';

interface AdminSidebarProps {
    onLogout: () => void;
}

export default function AdminSidebar({ onLogout }: AdminSidebarProps) {
    const pathname = usePathname();
    const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

    const toggleDropdown = (name: string) => {
        setOpenDropdowns(prev => ({
            ...prev,
            [name]: !prev[name],
        }));
    };

    return (
        <aside className="w-[260px] h-screen bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col fixed left-0 top-0 z-50 overflow-hidden shadow-[2px_0_24px_rgba(0,0,0,0.02)] transition-colors">
            {/* Header: Project Selector */}
            <div className="h-16 flex items-center px-5 border-b border-gray-100 dark:border-slate-800 justify-between shrink-0 bg-white dark:bg-slate-900 z-10 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center shrink-0">
                        <span className="font-bold text-sm">A</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">Antigravity AI</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Project ID: #8832</span>
                    </div>
                </div>
                <button className="text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 p-1.5 rounded-md transition-colors" aria-label="Add New" title="Add New">
                    <Plus size={18} />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
                <ul className="space-y-0.5 px-3">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.href === '/admin/dashboard'
                            ? pathname === item.href
                            : pathname.startsWith(item.href);

                        return (
                            <li key={item.name}>
                                <div className="relative">
                                    <Link
                                        href={item.href}
                                        onClick={(e) => {
                                            if (item.hasDropdown) {
                                                e.preventDefault();
                                                toggleDropdown(item.name);
                                            }
                                        }}
                                        className={cn(
                                            "flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group cursor-pointer",
                                            isActive
                                                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold"
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            {Icon && <Icon size={18} strokeWidth={isActive ? 2 : 1.8} className={cn(isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />}
                                            <span className="text-[14px]">{item.name}</span>
                                        </div>
                                        {item.hasDropdown && (
                                            <ChevronDown
                                                size={14}
                                                className={cn(
                                                    "text-slate-400 dark:text-slate-500 transition-transform duration-200",
                                                    openDropdowns[item.name] ? "rotate-180" : ""
                                                )}
                                            />
                                        )}
                                    </Link>
                                </div>
                                {/* Dropdown Items */}
                                {item.hasDropdown && openDropdowns[item.name] && (
                                    <ul className="pl-9 pr-2 py-1 space-y-1 animate-in slide-in-from-top-1 duration-200">
                                        {item.subItems ? (
                                            item.subItems.map((sub) => (
                                                <li key={sub.name}>
                                                    <Link href={sub.href} className="flex items-center justify-between px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 rounded-md transition-colors">
                                                        <span>{sub.name}</span>
                                                        {sub.badge && (
                                                            <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded ml-2">{sub.badge}</span>
                                                        )}
                                                    </Link>
                                                </li>
                                            ))
                                        ) : (
                                            ['Ro\'yxat', 'Qo\'shish'].map((sub) => (
                                                <li key={sub}>
                                                    <Link href="#" className="block px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 rounded-md transition-colors">
                                                        {sub}
                                                    </Link>
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>

                {/* Settings Separator */}
                <div className="my-4 border-t border-gray-100 dark:border-slate-800 mx-5"></div>

                <ul className="px-3">
                    <li>
                        <Link
                            href="/admin/settings"
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                                pathname === '/admin/settings'
                                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                        >
                            <Settings size={18} strokeWidth={1.8} className={cn(pathname === '/admin/settings' ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
                            <span className="text-[14px]">Sozlamalar</span>
                        </Link>
                    </li>
                </ul>
            </nav>

            {/* Footer / Logout */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 transition-colors">
                <button
                    onClick={onLogout}
                    className="flex w-full items-center justify-center space-x-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 py-2 rounded-lg transition-all text-sm font-medium"
                >
                    <LogOut size={16} />
                    <span>Tizimdan chiqish</span>
                </button>
            </div>
        </aside>
    );
}
