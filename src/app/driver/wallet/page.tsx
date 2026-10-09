import { CreditCard, Trash2 } from 'lucide-react';
import { requireDriver } from '@/lib/auth/driver';
import { driverBalance, driverCards, driverTransactions, MIN_WITHDRAWAL } from '@/lib/recycling/wallet';
import { formatDate, formatPrice } from '@/lib/format';
import { Badge } from '@/components/admin/ui';
import { AddCardForm } from '@/components/driver/AddCardForm';
import { Flash } from '@/components/driver/Flash';
import { SubmitButton } from '@/components/driver/SubmitButton';
import { cardTypeLabels, txStatusLabels, txStatusTone, txTypeLabels } from '@/components/driver/labels';
import { removeCardAction, withdrawAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hamyon' };

const sum = (v: unknown) => formatPrice(v as number, "so'm");

export default async function DriverWalletPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const d = await requireDriver();
  const [bal, txs, cards, sp] = await Promise.all([driverBalance(d.id), driverTransactions(d.id, 50), driverCards(d.id), searchParams]);
  const canWithdraw = bal.balance >= MIN_WITHDRAWAL;
  return (
    <>
      <Flash saved={sp.saved} error={sp.error} />
      <section className="card mb-3 bg-brand-900 p-4 text-white">
        <p className="text-xs text-slate-300">Balans</p>
        <p className="text-3xl font-black">{sum(bal.balance)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div><p className="text-slate-400">Daromad</p><p className="font-semibold">{sum(bal.earned)}</p></div>
          <div><p className="text-slate-400">Yechilgan</p><p className="font-semibold">{sum(bal.withdrawn)}</p></div>
          <div><p className="text-slate-400">Kutilmoqda</p><p className="font-semibold">{sum(bal.pending)}</p></div>
        </div>
      </section>

      <details className="card mb-3 p-4" open={!!sp.error && !sp.saved}>
        <summary className="cursor-pointer select-none font-bold">💸 Yechib olish</summary>
        <form action={withdrawAction} className="mt-3 space-y-3">
          <label className="block">
            <span className="label">Summa, so'm</span>
            <input name="amount" type="number" inputMode="numeric" min={MIN_WITHDRAWAL} max={Math.max(MIN_WITHDRAWAL, bal.balance)} required defaultValue={canWithdraw ? bal.balance : MIN_WITHDRAWAL} className="input text-lg" />
            <span className="mt-1 block text-xs text-slate-500">Kamida {sum(MIN_WITHDRAWAL)}. Masul tasdiqlagach to'lanadi.</span>
          </label>
          <label className="block">
            <span className="label">Qayerga</span>
            {/* Karta bo'lsa so'rov doim kartaga biriktiriladi (poydevor); naqd faqat kartasiz haydovchi uchun */}
            <select name="cardId" className="input" defaultValue={cards.find((c) => c.isDefault)?.id ?? cards[0]?.id ?? 0}>
              {cards.length > 0 ? cards.map((c) => <option key={c.id} value={c.id}>{c.cardNumber} · {cardTypeLabels[c.cardType]}</option>) : <option value={0}>Naqd (kartasiz)</option>}
            </select>
            <span className="mt-1 block text-xs text-slate-500">{cards.length > 0 ? "Pul tanlangan kartaga o'tkaziladi." : "Karta qo'shsangiz, pul kartaga o'tkaziladi."}</span>
          </label>
          <SubmitButton className="btn-primary w-full py-3" pendingText="Yuborilmoqda…">So'rov yuborish</SubmitButton>
          {!canWithdraw && <p className="text-xs text-amber-700">Balans {sum(MIN_WITHDRAWAL)} dan kam — so'rov yuborib bo'lmaydi.</p>}
        </form>
      </details>

      <section className="card mb-3 p-4">
        <h2 className="mb-2 flex items-center gap-2 font-bold"><CreditCard className="h-4 w-4" /> Kartalar</h2>
        {cards.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500">Hali karta qo'shilmagan.</p>
        ) : (
          <ul className="mb-3 divide-y divide-slate-100">
            {cards.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="flex items-center gap-2"><span className="font-mono font-semibold">{c.cardNumber}</span>{c.isDefault && <Badge tone="green">asosiy</Badge>}</p>
                  <p className="text-xs text-slate-500">{c.cardHolder} · {String(c.expiryMonth).padStart(2, '0')}/{c.expiryYear} · {cardTypeLabels[c.cardType]}</p>
                </div>
                <form action={removeCardAction}>
                  <input type="hidden" name="cardId" value={c.id} />
                  <SubmitButton className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" pendingText="…"><Trash2 className="h-4 w-4" aria-label="O'chirish" /></SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <details open={cards.length === 0}>
          <summary className="cursor-pointer select-none text-sm font-medium text-brand-500">+ Karta qo'shish</summary>
          <div className="mt-3"><AddCardForm first={cards.length === 0} /></div>
        </details>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-bold">Tranzaksiyalar</h2>
        {txs.length === 0 ? (
          <p className="text-sm text-slate-500">Hozircha yo'q</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {txs.map((t) => {
              const out = t.type === 'withdrawal';
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">{txTypeLabels[t.type]} <Badge tone={txStatusTone[t.status]}>{txStatusLabels[t.status]}</Badge></p>
                    <p className="truncate text-xs text-slate-500">{formatDate(t.createdAt, 'uz', true)}{t.card ? ` · ${t.card.cardNumber}` : t.description ? ` · ${t.description}` : ''}</p>
                  </div>
                  <span className={`shrink-0 font-semibold ${out ? 'text-slate-700' : 'text-emerald-700'}`}>{out ? '−' : '+'}{sum(t.amount)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
