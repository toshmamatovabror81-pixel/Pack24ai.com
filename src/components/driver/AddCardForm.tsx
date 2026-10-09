'use client';

import { useState } from 'react';
import { addCardAction } from '@/app/driver/actions';
import { cardTypeFromDigits, formatCardInput } from './calc';
import { cardTypeLabels } from './labels';
import { SubmitButton } from './SubmitButton';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Karta qo'shish: raqam 4 talab guruhlanadi, turi avtomatik ko'rinadi. Serverda faqat oxirgi 4 raqam saqlanadi. */
export function AddCardForm({ first }: { first: boolean }) {
  const [number, setNumber] = useState('');
  const digits = number.replace(/\D/g, '');
  const type = cardTypeFromDigits(digits);
  const year = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => year + i);
  return (
    <form action={addCardAction} className="space-y-3">
      <label className="block">
        <span className="label">Karta raqami</span>
        <div className="relative">
          <input name="number" inputMode="numeric" autoComplete="cc-number" required value={number} onChange={(e) => setNumber(formatCardInput(e.target.value))} placeholder="8600 0000 0000 0000" className="input pr-20 font-mono text-base tracking-wider" />
          {type && <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{cardTypeLabels[type]}</span>}
        </div>
      </label>
      <label className="block">
        <span className="label">Karta egasi</span>
        <input name="holder" required maxLength={100} autoComplete="cc-name" placeholder="ALI VALIYEV" className="input uppercase" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">Oy</span>
          <select name="expiryMonth" className="input" defaultValue="" required>
            <option value="" disabled>MM</option>
            {MONTHS.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Yil</span>
          <select name="expiryYear" className="input" defaultValue="" required>
            <option value="" disabled>YYYY</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" defaultChecked={first} className="h-4 w-4" /> Asosiy karta
      </label>
      <p className="text-xs text-slate-500">Xavfsizlik uchun to'liq raqam saqlanmaydi — faqat oxirgi 4 ta raqam.</p>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Saqlanmoqda…">Kartani qo'shish</SubmitButton>
    </form>
  );
}
