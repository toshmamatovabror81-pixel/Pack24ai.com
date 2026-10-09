'use client';

import { useActionState } from 'react';
import { createSupervisorForm, type FormState } from '@/app/admin/(panel)/recycling/actions';
import { Field, Notice } from '@/components/admin/ui';

export type PointChoice = { id: number; cityUz: string; regionUz: string; status: 'active' | 'planned' };

/** Yangi masul: xato va qiymatlar javobda qaytadi (telefon URL ga tushmaydi) */
export function NewSupervisorForm({ points, defaultPointId }: { points: PointChoice[]; defaultPointId?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSupervisorForm, null);
  const v = (k: string) => state?.values[k] ?? '';
  return (
    <>
      <Notice show={!!state?.error} tone="warn">{state?.error}</Notice>
      <form action={action} className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Ism *"><input name="name" required minLength={2} defaultValue={v('name')} className="input" /></Field>
        <Field label="Telefon *" hint="Botda shu raqam ulashiladi — aniq kiriting"><input name="phone" type="tel" required defaultValue={v('phone')} placeholder="+998 90 123 45 67" className="input" /></Field>
        <Field label="Punkt" hint="Shu punktning arizalari masulga avtomatik yo'naltiriladi" wide>
          <select name="pointId" defaultValue={state ? v('pointId') : defaultPointId ?? ''} className="input">
            <option value="">Keyinroq biriktiriladi</option>
            {points.map((p) => <option key={p.id} value={p.id}>{p.cityUz} ({p.regionUz}){p.status === 'planned' ? ' — rejada' : ''}</option>)}
          </select>
        </Field>
        <p className="text-xs text-slate-500 sm:col-span-2">Saqlangach 5 xonali ro'yxatdan o'tish kodi ko'rsatiladi. Masul uni Masul botida /start → kod → telefon ulashish tartibida kiritadi.</p>
        <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{pending ? 'Yaratilmoqda…' : 'Masul yaratish'}</button></div>
      </form>
    </>
  );
}
