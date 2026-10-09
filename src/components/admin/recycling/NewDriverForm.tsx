'use client';

import { useActionState } from 'react';
import { createDriverForm, type FormState } from '@/app/admin/(panel)/recycling/actions';
import { Field, Notice } from '@/components/admin/ui';

export type SupervisorChoice = { id: number; name: string; pointCity: string | null };

/** Yangi haydovchi: xato va qiymatlar javobda qaytadi (telefon URL ga tushmaydi) */
export function NewDriverForm({ points, supervisors, defaultPointId, defaultSupervisorId }: { points: { id: number; cityUz: string; regionUz: string }[]; supervisors: SupervisorChoice[]; defaultPointId?: string; defaultSupervisorId?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createDriverForm, null);
  const v = (k: string) => state?.values[k] ?? '';
  return (
    <>
      <Notice show={!!state?.error} tone="warn">{state?.error}</Notice>
      <form action={action} className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Ism *"><input name="name" required minLength={2} defaultValue={v('name')} className="input" /></Field>
        <Field label="Telefon *" hint="Botda shu raqam ulashiladi; kabinet logini ham shu"><input name="phone" type="tel" required defaultValue={v('phone')} placeholder="+998 90 123 45 67" className="input" /></Field>
        <Field label="Masul" hint="Punkt tanlanmasa masulning punkti olinadi">
          <select name="supervisorId" defaultValue={state ? v('supervisorId') : defaultSupervisorId ?? ''} className="input">
            <option value="">Tanlanmagan</option>
            {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}{s.pointCity ? ` — ${s.pointCity}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Punkt">
          <select name="pointId" defaultValue={state ? v('pointId') : defaultPointId ?? ''} className="input">
            <option value="">Masul punkti</option>
            {points.map((p) => <option key={p.id} value={p.id}>{p.cityUz} ({p.regionUz})</option>)}
          </select>
        </Field>
        <Field label="Mashina" hint="Model va davlat raqami" wide><input name="vehicleInfo" defaultValue={v('vehicleInfo')} placeholder="Damas 01A123BC" className="input" /></Field>
        <p className="text-xs text-slate-500 sm:col-span-2">Saqlangach 5 xonali ro'yxatdan o'tish kodi ko'rsatiladi: Haydovchi boti → /start → kod → telefon ulashish.</p>
        <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{pending ? 'Yaratilmoqda…' : 'Haydovchi yaratish'}</button></div>
      </form>
    </>
  );
}
