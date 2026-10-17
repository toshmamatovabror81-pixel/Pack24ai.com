'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { AddToCartButton } from './AddToCartButton';
import type { CartItem } from './CartProvider';

export function ProductBuyBox({
  item,
  tiers,
  labels,
  currency,
}: {
  item: Omit<CartItem, 'qty'>;
  tiers: { minQty: number; price: number }[];
  labels: { add: string; added: string; quantity: string };
  currency: string;
}) {
  const [qty, setQty] = useState(item.minQuantity);
  let unit = item.price;
  for (const t of tiers) if (qty >= t.minQty && t.price < unit) unit = t.price;
  const fmt = (n: number) => `${new Intl.NumberFormat('ru-RU').format(Math.round(n)).replace(/ /g, ' ')} ${currency}`;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">{labels.quantity}</span>
        <div className="flex items-center rounded-lg border border-slate-300 bg-white">
          <button type="button" className="p-2.5 hover:bg-slate-100" onClick={() => setQty((q) => Math.max(item.minQuantity, q - 1))} aria-label="-">
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            min={item.minQuantity}
            value={qty}
            onChange={(e) => setQty(Math.max(item.minQuantity, Math.floor(Number(e.target.value)) || item.minQuantity))}
            className="w-20 border-0 text-center focus:ring-0"
            aria-label={labels.quantity}
          />
          <button type="button" className="p-2.5 hover:bg-slate-100" onClick={() => setQty((q) => q + 1)} aria-label="+">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        = <span className="text-lg font-bold text-slate-900">{fmt(unit * qty)}</span>
        {unit < item.price && <span className="ml-2 text-emerald-700">({fmt(unit)} / 1)</span>}
      </p>
      <AddToCartButton item={{ ...item, price: unit }} qty={qty} label={labels.add} addedLabel={labels.added} />
    </div>
  );
}
