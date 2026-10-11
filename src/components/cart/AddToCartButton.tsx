'use client';

import { useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import { useCart, type CartItem } from './CartProvider';

export function AddToCartButton({
  item,
  label,
  addedLabel,
  qty,
  compact,
}: {
  item: Omit<CartItem, 'qty'>;
  label: string;
  addedLabel: string;
  qty?: number;
  compact?: boolean;
}) {
  const { add } = useCart();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        add(item, qty);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold text-white transition ${done ? 'bg-emerald-600' : 'bg-brand-500 hover:bg-brand-600'} ${compact ? 'px-3 py-2 text-sm' : 'px-6 py-3'}`}
    >
      {done ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
      {done ? addedLabel : label}
    </button>
  );
}
