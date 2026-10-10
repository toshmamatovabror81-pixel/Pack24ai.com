'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BadgePercent, BarChart3, Factory, FileSignature, FolderTree, HelpCircle, Image, Inbox, LayoutDashboard, Menu, Newspaper, Package,
  Receipt, Settings, ShoppingCart, Star, UserCog, Users, Warehouse, X, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  BadgePercent, BarChart3, Factory, FileSignature, FolderTree, HelpCircle, Image, Inbox, LayoutDashboard, Newspaper, Package, Receipt,
  Settings, ShoppingCart, Star, UserCog, Users, Warehouse,
};

export function Sidebar({ items, badges }: { items: { href: string; label: string; icon: string }[]; badges: Record<string, number> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));
  return (
    <>
      <button type="button" className="fixed left-3 top-3 z-50 rounded-lg bg-brand-700 p-2 text-white lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menyu">
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 overflow-y-auto bg-brand-900 text-slate-300 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-5 text-xl font-black text-white">PACK<span className="text-accent-500">24</span> <span className="text-xs font-normal text-slate-400">admin</span></div>
        <nav>
          <ul className="space-y-0.5 px-2 pb-6">
            {items.map((it) => {
              const Icon = ICONS[it.icon] ?? LayoutDashboard;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active(it.href) ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{it.label}</span>
                    {!!badges[it.href] && <span className="rounded-full bg-accent-500 px-2 text-xs font-bold text-white">{badges[it.href]}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
