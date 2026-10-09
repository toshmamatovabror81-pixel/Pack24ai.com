'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, History, UserRound, Wallet } from 'lucide-react';

const ITEMS = [
  { href: '/driver', label: 'Topshiriqlar', Icon: ClipboardList },
  { href: '/driver/history', label: 'Tarix', Icon: History },
  { href: '/driver/wallet', label: 'Hamyon', Icon: Wallet },
  { href: '/driver/profile', label: 'Profil', Icon: UserRound },
];

/** Pastki yopishqoq menyu (telefon uchun) */
export function DriverNav() {
  const pathname = usePathname();
  const active = (href: string) => (href === '/driver' ? pathname === '/driver' || pathname.startsWith('/driver/tasks') : pathname.startsWith(href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, Icon }) => {
          const on = active(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? 'page' : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${on ? 'text-brand-500' : 'text-slate-500'}`}>
                <Icon className="h-5 w-5" strokeWidth={on ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
