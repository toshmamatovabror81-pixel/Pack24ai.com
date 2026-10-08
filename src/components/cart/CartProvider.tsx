'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { track } from '../site/track';

/** Savatda faqat mahsulot ID va soni saqlanadi; nom/rasm/narx ko'rsatish uchun, haqiqiy narx serverda hisoblanadi */
export type CartItem = { productId: number; qty: number; name: string; image: string; price: number; minQuantity: number; href: string };

type CartCtx = {
  items: CartItem[];
  ready: boolean;
  count: number;
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = 'p24_cart_v2';

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => i && Number.isInteger(i.productId) && i.qty > 0) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
    const onStorage = (e: StorageEvent) => e.key === KEY && setItems(load());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* xotira to'la yoki yopiq rejim */
    }
  }, [items, ready]);

  const add = useCallback((item: Omit<CartItem, 'qty'>, qty?: number) => {
    const n = Math.max(item.minQuantity, qty ?? item.minQuantity);
    setItems((prev) => {
      const found = prev.find((i) => i.productId === item.productId);
      if (found) return prev.map((i) => (i.productId === item.productId ? { ...i, ...item, qty: i.qty + n } : i));
      return [...prev, { ...item, qty: n }];
    });
    track('add_to_cart', { id: item.productId, value: item.price * n });
  }, []);

  const setQty = useCallback((productId: number, qty: number) => {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty: Math.max(i.minQuantity, Math.floor(qty) || i.minQuantity) } : i)));
  }, []);

  const remove = useCallback((productId: number) => setItems((prev) => prev.filter((i) => i.productId !== productId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, ready, count: items.length, add, setQty, remove, clear }),
    [items, ready, add, setQty, remove, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart CartProvider ichida ishlatilishi kerak');
  return ctx;
}
