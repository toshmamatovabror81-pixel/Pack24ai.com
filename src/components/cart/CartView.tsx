'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { Locale } from '@/lib/i18n/config';
import { useCart } from './CartProvider';
import { fmtSum, useQuote } from './useQuote';

export type CartLabels = {
  title: string; empty: string; emptyText: string; total: string; subtotal: string; delivery: string;
  discount: string; checkout: string; remove: string; toCatalog: string; currency: string; minQty: string;
};

export function CartView({ locale, l }: { locale: Locale; l: CartLabels }) {
  const { items, ready, setQty, remove } = useCart();
  const { quote } = useQuote(items, locale, '', 'courier');
  if (!ready) return <div className="container-site py-16" />;
  if (!items.length)
    return (
      <div className="container-site py-16 text-center">
        <h1 className="h1">{l.empty}</h1>
        <p className="mt-2 text-slate-600">{l.emptyText}</p>
        <Link href={`/${locale}/catalog`} className="btn-primary mt-6">{l.toCatalog}</Link>
      </div>
    );
  const lineOf = (id: number) => quote?.lines.find((x) => x.productId === id);
  return (
    <div className="container-site py-8">
      <h1 className="h1 mb-6">{l.title}</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ul className="card divide-y divide-slate-200">
          {items.map((i) => {
            const line = lineOf(i.productId);
            const gone = quote?.missing.includes(i.productId);
            return (
              <li key={i.productId} className={`flex gap-4 p-4 ${gone ? 'opacity-50' : ''}`}>
                <Link href={i.href} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                  <Image src={i.image} alt="" fill sizes="80px" className="object-contain p-1" />
                </Link>
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <Link href={i.href} className="font-medium hover:text-brand-500">{i.name}</Link>
                    <p className="text-sm text-slate-500">{fmtSum(line?.unitPrice ?? i.price, l.currency)}{i.minQuantity > 1 && ` · ${l.minQty}: ${i.minQuantity}`}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-lg border border-slate-300">
                      <button type="button" className="p-2 hover:bg-slate-100" onClick={() => setQty(i.productId, i.qty - 1)} aria-label="-"><Minus className="h-4 w-4" /></button>
                      <input type="number" value={i.qty} min={i.minQuantity} onChange={(e) => setQty(i.productId, Number(e.target.value))} className="w-16 border-0 text-center text-sm focus:ring-0" />
                      <button type="button" className="p-2 hover:bg-slate-100" onClick={() => setQty(i.productId, i.qty + 1)} aria-label="+"><Plus className="h-4 w-4" /></button>
                    </div>
                    <p className="w-28 text-right font-semibold">{fmtSum(line?.lineTotal ?? i.price * i.qty, l.currency)}</p>
                    <button type="button" onClick={() => remove(i.productId)} className="p-2 text-slate-400 hover:text-accent-500" aria-label={l.remove}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <aside className="card h-fit space-y-3 p-5">
          <div className="flex justify-between text-sm"><span>{l.subtotal}</span><span>{quote ? fmtSum(quote.subtotal, l.currency) : '…'}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-bold"><span>{l.total}</span><span>{quote ? fmtSum(quote.subtotal, l.currency) : '…'}</span></div>
          <Link href={`/${locale}/checkout`} className="btn-accent w-full">{l.checkout}</Link>
        </aside>
      </div>
    </div>
  );
}
