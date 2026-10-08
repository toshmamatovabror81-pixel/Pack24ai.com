'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Makulatura bo'limi ichki bo'limlari (/admin/recycling/*) */
export const RECYCLING_TABS: { href: string; label: string }[] = [
  { href: '/admin/recycling', label: 'Arizalar' },
  { href: '/admin/recycling/map', label: 'Xarita' },
  { href: '/admin/recycling/points', label: 'Punktlar' },
  { href: '/admin/recycling/supervisors', label: 'Masullar' },
  { href: '/admin/recycling/drivers', label: 'Haydovchilar' },
  { href: '/admin/recycling/journal', label: 'Jurnal' },
  { href: '/admin/recycling/finance', label: 'Moliya' },
  { href: '/admin/recycling/complaints', label: 'Shikoyatlar' },
  { href: '/admin/recycling/events', label: 'Hodisalar' },
  { href: '/admin/recycling/access', label: "Kirish so'rovlari" },
  { href: '/admin/recycling/hq', label: 'HQ adminlar' },
];

export function RecyclingNav({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname();
  const active = (href: string) => (href === '/admin/recycling' ? pathname === href || pathname.startsWith('/admin/recycling/requests') : pathname.startsWith(href));
  return (
    <nav className="mb-5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-sm">
      {RECYCLING_TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 ${active(t.href) ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          {t.label}
          {!!badges[t.href] && <span className="ml-1.5 rounded-full bg-accent-500 px-1.5 text-xs font-bold text-white">{badges[t.href]}</span>}
        </Link>
      ))}
    </nav>
  );
}
