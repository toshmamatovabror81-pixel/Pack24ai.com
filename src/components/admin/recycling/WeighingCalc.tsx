'use client';

import { useState } from 'react';

const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} so'm`;

/**
 * Tortish kalkulyatori: og'irlik va chegirma kiritilganda hisob darhol ko'rinadi.
 * Formulalar collections.ts bilan bir xil: effective = round2(w × (1 − d/100)), total = round(effective × narx).
 */
export function WeighingCalc({ pricePerKg, driverRatePerKg, defaultWeight, defaultDiscount, weightName = 'actualWeight', discountName = 'discountPercent' }: { pricePerKg: number; driverRatePerKg: number; defaultWeight?: number | null; defaultDiscount?: number | null; weightName?: string; discountName?: string }) {
  const [w, setW] = useState(defaultWeight != null ? String(defaultWeight) : '');
  const [d, setD] = useState(defaultDiscount != null ? String(defaultDiscount) : '0');
  const weight = Math.max(0, Number(w.replace(',', '.')) || 0);
  const disc = Math.min(100, Math.max(0, Number(d.replace(',', '.')) || 0));
  const effective = r2(weight * (1 - disc / 100));
  const total = Math.round(effective * pricePerKg);
  const earning = Math.round(weight * driverRatePerKg);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label">Og'irlik, kg *</span><input name={weightName} value={w} onChange={(e) => setW(e.target.value)} required inputMode="decimal" className="input" /></label>
        <label className="block"><span className="label">Chegirma, %</span><input name={discountName} value={d} onChange={(e) => setD(e.target.value)} inputMode="decimal" className="input" /></label>
      </div>
      <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
        <p>Narx: <b>{sum(pricePerKg)}/kg</b> (punkt narxi)</p>
        <p>Hisobli og'irlik: <b>{effective} kg</b> → mijozga <b className="text-slate-900">{sum(total)}</b></p>
        <p>Haydovchi daromadi: <b>{sum(earning)}</b> ({driverRatePerKg.toLocaleString('ru-RU')} so'm/kg × {weight} kg)</p>
      </div>
    </>
  );
}
