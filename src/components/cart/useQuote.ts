'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n/config';
import type { CartItem } from './CartProvider';

export type ClientQuote = {
  lines: { productId: number; qty: number; unitPrice: number; lineTotal: number }[];
  missing: number[];
  subtotal: number;
  discount: number;
  promoError: boolean;
  delivery: number;
  total: number;
};

/** Savat narxini serverdan olish (narx faqat bazadan) */
export function useQuote(items: CartItem[], locale: Locale, promo: string, delivery: 'courier' | 'pickup') {
  const [quote, setQuote] = useState<ClientQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(items.map((i) => [i.productId, i.qty])) + promo + delivery;
  useEffect(() => {
    if (!items.length) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetch('/api/cart/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, items: items.map((i) => ({ productId: i.productId, qty: i.qty })), promo, delivery }),
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((q) => q && setQuote(q))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, locale]);
  return { quote, loading };
}

export const fmtSum = (n: number, currency: string) =>
  `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n).replace(/ /g, ' ')} ${currency}`;
