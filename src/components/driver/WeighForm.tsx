'use client';

import { useState } from 'react';
import { weighAction } from '@/app/driver/actions';
import { formatPrice } from '@/lib/format';
import { weighPreview } from './calc';
import { DISCOUNT_OPTIONS, DISCOUNT_REASONS } from './labels';
import { SubmitButton } from './SubmitButton';

type Props = {
  requestId: number;
  pricePerKg: number;
  driverRatePerKg: number;
  materials: { value: string; label: string }[];
  defaultMaterial?: string | null;
  defaults?: { weight?: number | null; discount?: number | null; notes?: string | null } | null;
  again?: boolean;
};

const sum = (n: number) => formatPrice(n, "so'm");

/** Tortish formasi: kiritilganda hisob darhol ko'rinadi (formula calc.ts, collections.ts bilan bir xil) */
export function WeighForm({ requestId, pricePerKg, driverRatePerKg, materials, defaultMaterial, defaults, again }: Props) {
  const [w, setW] = useState(defaults?.weight ? String(defaults.weight) : '');
  const [d, setD] = useState(String(defaults?.discount ?? 0));
  const [reason, setReason] = useState<string>('namlik');
  const p = weighPreview(Number(w.replace(',', '.')), Number(d), pricePerKg, driverRatePerKg);

  return (
    <form id="weigh" action={weighAction} className="card space-y-3 p-4">
      <input type="hidden" name="id" value={requestId} />
      <h2 className="text-base font-bold">⚖️ {again ? 'Qayta tortish' : 'Tortish'}</h2>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">Og'irlik, kg *</span>
          <input name="actualWeight" type="number" inputMode="decimal" step="0.1" min="0.1" max="100000" required value={w} onChange={(e) => setW(e.target.value)} className="input text-lg" placeholder="0.0" />
        </label>
        <label className="block">
          <span className="label">Chegirma, %</span>
          <select name="discountPercent" value={d} onChange={(e) => setD(e.target.value)} className="input text-lg">
            {DISCOUNT_OPTIONS.map((o) => <option key={o} value={o}>{o}%</option>)}
          </select>
        </label>
      </div>
      {p.discount > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="label">Chegirma sababi</span>
            <select name="discountReason" value={reason} onChange={(e) => setReason(e.target.value)} className="input">
              {DISCOUNT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          {reason === 'boshqa' && (
            <label className="block">
              <span className="label">Qaysi sabab?</span>
              <input name="discountReasonText" maxLength={200} className="input" placeholder="Masalan: yirtiq" />
            </label>
          )}
        </div>
      )}
      <label className="block">
        <span className="label">Material</span>
        <select name="materialType" defaultValue={defaultMaterial ?? ''} className="input">
          <option value="">Ko'rsatilmagan</option>
          {materials.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Izoh</span>
        <textarea name="notes" rows={2} maxLength={500} defaultValue={defaults?.notes ?? ''} className="input" placeholder="Ixtiyoriy" />
      </label>

      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <p className="flex justify-between"><span>Narx (punkt)</span><b>{sum(pricePerKg)}/kg</b></p>
        <p className="flex justify-between"><span>Hisobli og'irlik</span><b>{p.effective} kg</b></p>
        <p className="flex justify-between text-base"><span>Mijozga jami</span><b className="text-slate-900">{sum(p.total)}</b></p>
        <p className="flex justify-between text-emerald-700"><span>Sizning daromadingiz</span><b>{sum(p.earning)}</b></p>
        <p className="mt-1 text-xs text-slate-500">{driverRatePerKg.toLocaleString('ru-RU')} so'm/kg × {p.weight} kg. Narxni o'zgartirib bo'lmaydi.</p>
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Saqlanmoqda…">{again ? 'Qayta saqlash' : 'Saqlash va mijozga yuborish'}</SubmitButton>
    </form>
  );
}
