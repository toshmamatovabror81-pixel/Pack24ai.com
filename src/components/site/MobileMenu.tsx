'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export function MobileMenu({ links, label }: { links: { href: string; label: string }[]; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg p-2 hover:bg-white/10" aria-label={label} aria-expanded={open}>
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-full z-40 border-t border-white/10 bg-brand-700 shadow-xl">
          <ul className="mx-auto max-w-site px-4 py-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-base hover:bg-white/10">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
