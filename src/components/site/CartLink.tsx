'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../cart/CartProvider';

export function CartLink({ href, label }: { href: string; label: string }) {
  const { count, ready } = useCart();
  return (
    <Link href={href} className="relative inline-flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10" aria-label={label}>
      <ShoppingCart className="h-5 w-5" />
      <span className="hidden sm:inline">{label}</span>
      {ready && count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accent-500 px-1.5 text-center text-xs font-bold leading-5 text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
