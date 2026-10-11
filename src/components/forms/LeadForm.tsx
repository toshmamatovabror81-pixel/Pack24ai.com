'use client';

import { useActionState, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { submitLead, type LeadState } from '@/lib/leads';
import { track } from '../site/track';

export type LeadField = { name: string; label: string; type?: 'text' | 'tel' | 'textarea' | 'number' | 'select'; required?: boolean; options?: { value: string; label: string }[]; defaultValue?: string };

export function LeadForm({
  type,
  types,
  fields,
  labels,
  productId,
}: {
  type: string;
  types?: { value: string; label: string }[];
  fields: LeadField[];
  labels: { send: string; sending: string; thanks: string; error: string; phoneError: string; typeLabel?: string };
  productId?: number;
}) {
  const [state, action, pending] = useActionState<LeadState, FormData>(submitLead, null);
  const [current, setCurrent] = useState(type);
  useEffect(() => {
    if (state?.ok) track('lead_submit', { type: current });
  }, [state, current]);
  if (state?.ok)
    return (
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-5 text-emerald-800">
        <CheckCircle2 className="h-6 w-6 shrink-0" />
        <p>{labels.thanks}</p>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="type" value={current} />
      {productId && <input type="hidden" name="productId" value={productId} />}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {types && (
        <fieldset>
          <legend className="label">{labels.typeLabel}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {types.map((t) => (
              <label key={t.value} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${current === t.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}>
                <input type="radio" checked={current === t.value} onChange={() => setCurrent(t.value)} />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.name} className={f.type === 'textarea' ? 'block sm:col-span-2' : 'block'}>
            <span className="label">{f.label}{f.required && ' *'}</span>
            {f.type === 'textarea' ? (
              <textarea name={f.name} rows={4} required={f.required} defaultValue={f.defaultValue} className="input" />
            ) : f.type === 'select' ? (
              <select name={f.name} defaultValue={f.defaultValue} className="input">
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input name={f.name} type={f.type ?? 'text'} required={f.required} defaultValue={f.defaultValue} className="input" />
            )}
          </label>
        ))}
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-accent-600" role="alert">{state.error === 'phone' ? labels.phoneError : labels.error}</p>}
      <button className="btn-accent w-full sm:w-auto" disabled={pending}>{pending ? labels.sending : labels.send}</button>
    </form>
  );
}
