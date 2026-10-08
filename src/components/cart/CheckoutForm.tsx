'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n/config';
import { placeOrder, type CheckoutResult } from '@/app/[lang]/checkout/actions';
import { useCart } from './CartProvider';
import { fmtSum, useQuote } from './useQuote';
import { track } from '../site/track';

type Method = 'cash' | 'payme' | 'click' | 'bank_transfer';

export type CheckoutLabels = Record<
  | 'title' | 'contact' | 'name' | 'phone' | 'company' | 'deliveryMethod' | 'courier' | 'pickup' | 'address' | 'comment'
  | 'paymentMethod' | 'cash' | 'payme' | 'click' | 'bank' | 'agree' | 'offer' | 'place' | 'placing' | 'subtotal' | 'discount'
  | 'delivery' | 'total' | 'promo' | 'apply' | 'promoInvalid' | 'empty' | 'toCatalog' | 'currency' | 'error' | 'required',
  string
>;

const errorText = (e: Exclude<CheckoutResult, { ok: true }>['error'], l: CheckoutLabels) =>
  e === 'promo' ? l.promoInvalid : e === 'phone' ? `${l.phone}: ${l.required}` : e === 'address' ? `${l.address}: ${l.required}` : l.error;

export function CheckoutForm({ locale, methods, l, defaults }: { locale: Locale; methods: Method[]; l: CheckoutLabels; defaults: { name: string; phone: string; address: string } }) {
  const { items, ready, clear } = useCart();
  const [delivery, setDelivery] = useState<'courier' | 'pickup'>('courier');
  const [payment, setPayment] = useState<Method>(methods[0]);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const { quote } = useQuote(items, locale, promo, delivery);

  if (!ready) return <div className="container-site py-16" />;
  if (!items.length)
    return (
      <div className="container-site py-16 text-center">
        <h1 className="h1">{l.empty}</h1>
        <Link href={`/${locale}/catalog`} className="btn-primary mt-6">{l.toCatalog}</Link>
      </div>
    );

  const methodLabel: Record<Method, string> = { cash: l.cash, payme: l.payme, click: l.click, bank_transfer: l.bank };

  function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    setError('');
    start(async () => {
      const res = await placeOrder({
        locale,
        name: String(fd.get('name') ?? ''),
        phone: String(fd.get('phone') ?? ''),
        company: String(fd.get('company') ?? ''),
        address: String(fd.get('address') ?? ''),
        comment: String(fd.get('comment') ?? ''),
        deliveryMethod: delivery,
        paymentMethod: payment,
        promoCode: promo,
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
      });
      if (!res.ok) {
        setError(errorText(res.error, l));
        return;
      }
      track('order_created', { order_id: res.orderId, value: res.total, currency: 'UZS', payment });
      // Buyurtma bazada yaratildi: savatni tozalaymiz, keyin to'lov yoki buyurtma sahifasiga
      clear();
      window.location.assign(res.redirect);
    });
  }

  return (
    <div className="container-site py-8">
      <h1 className="h1 mb-6">{l.title}</h1>
      <form
        className="grid gap-6 lg:grid-cols-[1fr_360px]"
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
      >
        <div className="space-y-6">
          <fieldset className="card space-y-4 p-5">
            <legend className="px-1 font-semibold">{l.contact}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="label">{l.name} *</span><input name="name" required minLength={2} defaultValue={defaults.name} className="input" autoComplete="name" /></label>
              <label><span className="label">{l.phone} *</span><input name="phone" required type="tel" defaultValue={defaults.phone} placeholder="+998 90 123 45 67" className="input" autoComplete="tel" /></label>
            </div>
            <label className="block"><span className="label">{l.company}</span><input name="company" className="input" autoComplete="organization" /></label>
          </fieldset>

          <fieldset className="card space-y-3 p-5">
            <legend className="px-1 font-semibold">{l.deliveryMethod}</legend>
            {(['courier', 'pickup'] as const).map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${delivery === m ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                <input type="radio" name="delivery" checked={delivery === m} onChange={() => setDelivery(m)} />
                {m === 'courier' ? l.courier : l.pickup}
              </label>
            ))}
            {delivery === 'courier' && (
              <label className="block"><span className="label">{l.address} *</span><textarea name="address" required minLength={5} rows={2} defaultValue={defaults.address} className="input" autoComplete="street-address" /></label>
            )}
            <label className="block"><span className="label">{l.comment}</span><textarea name="comment" rows={2} className="input" /></label>
          </fieldset>

          <fieldset className="card space-y-3 p-5">
            <legend className="px-1 font-semibold">{l.paymentMethod}</legend>
            {methods.map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${payment === m ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                <input type="radio" name="payment" checked={payment === m} onChange={() => setPayment(m)} />
                {methodLabel[m]}
              </label>
            ))}
          </fieldset>
        </div>

        <aside className="card h-fit space-y-3 p-5 lg:sticky lg:top-32">
          <ul className="max-h-60 space-y-2 overflow-auto text-sm">
            {items.map((i) => {
              const line = quote?.lines.find((x) => x.productId === i.productId);
              return (
                <li key={i.productId} className="flex justify-between gap-3">
                  <span className="line-clamp-2">{i.name} × {line?.qty ?? i.qty}</span>
                  <span className="shrink-0">{fmtSum(line?.lineTotal ?? i.price * i.qty, l.currency)}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2 border-t border-slate-200 pt-3">
            <input value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder={l.promo} className="input py-2" aria-label={l.promo} />
            <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => setPromo(promoInput.trim())}>{l.apply}</button>
          </div>
          {quote?.promoError && <p className="text-sm text-accent-600">{l.promoInvalid}</p>}
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>{l.subtotal}</dt><dd>{quote ? fmtSum(quote.subtotal, l.currency) : '…'}</dd></div>
            {!!quote?.discount && <div className="flex justify-between text-emerald-700"><dt>{l.discount}</dt><dd>−{fmtSum(quote.discount, l.currency)}</dd></div>}
            <div className="flex justify-between"><dt>{l.delivery}</dt><dd>{quote ? fmtSum(quote.delivery, l.currency) : '…'}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold"><dt>{l.total}</dt><dd>{quote ? fmtSum(quote.total, l.currency) : '…'}</dd></div>
          </dl>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-accent-600" role="alert">{error}</p>}
          <button type="submit" disabled={pending || !quote || quote.promoError} className="btn-accent w-full">{pending ? l.placing : l.place}</button>
          <p className="text-xs text-slate-500">
            {l.agree}: <Link href={`/${locale}/offer`} className="underline">{l.offer}</Link>
          </p>
        </aside>
      </form>
    </div>
  );
}
