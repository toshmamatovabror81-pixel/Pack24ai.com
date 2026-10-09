'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { MaterialType } from '@prisma/client';
import { createRequestForm, type FormState } from '@/app/admin/(panel)/recycling/actions';
import { Field, Notice } from '@/components/admin/ui';
import { PointPicker } from './PointPicker';

export type PointOption = { id: number; cityUz: string; regionUz: string; supervisors: string[] };

/**
 * Admin qo'lda ariza kiritadi. useActionState: xato bo'lsa xabar va qiymatlar javobda qaytadi (URL ga tushmaydi).
 * Muvaffaqiyatda action o'zi ariza sahifasiga yo'naltiradi.
 */
export function NewRequestForm({ points, materials, materialLabels, pickupMinKg }: { points: PointOption[]; materials: MaterialType[]; materialLabels: Record<MaterialType, string>; pickupMinKg: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createRequestForm, null);
  const v = (k: string) => state?.values[k] ?? '';
  const n = (k: string) => { const x = Number(v(k)); return v(k) && Number.isFinite(x) ? x : null; };
  return (
    <>
      <Notice show={!!state?.error} tone="warn">{state?.error}</Notice>
      <form action={action} className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Mijoz ismi *"><input name="name" required minLength={2} defaultValue={v('name')} className="input" /></Field>
        <Field label="Telefon *"><input name="phone" type="tel" required defaultValue={v('phone')} placeholder="+998 90 123 45 67" className="input" /></Field>
        <Field label="Punkt" hint="Tanlanmasa — eng yaqin faol punkt (koordinata bo'lsa) yoki birinchi faol punkt">
          <select name="pointId" defaultValue={v('pointId')} className="input">
            <option value="">Avtomatik</option>
            {points.map((p) => <option key={p.id} value={p.id}>{p.cityUz} ({p.regionUz}){p.supervisors.length ? ` — ${p.supervisors.join(', ')}` : " — masul yo'q"}</option>)}
          </select>
        </Field>
        <Field label="Material">
          <select name="material" defaultValue={v('material')} className="input">
            <option value="">Noma'lum</option>
            {materials.map((m) => <option key={m} value={m}>{materialLabels[m]}</option>)}
          </select>
        </Field>
        <Field label="Taxminiy hajm, kg" hint={`Olib ketish uchun kamida ${pickupMinKg} kg`}><input name="volume" type="number" min={1} step={1} defaultValue={v('volume')} className="input" /></Field>
        <Field label="Turi *">
          <select name="pickupType" defaultValue={v('pickupType') || 'pickup'} className="input">
            <option value="pickup">🚚 Olib ketish (mashina boradi)</option>
            <option value="base">🏭 Mijoz o'zi punktga olib keladi</option>
          </select>
        </Field>
        <Field label="Manzil" hint="Olib ketish uchun manzil yoki xaritada nuqta shart" wide><input name="address" defaultValue={v('address')} placeholder="Tuman, ko'cha, uy, mo'ljal" className="input" /></Field>
        <PointPicker lat={n('lat')} lng={n('lng')} hex="#3b82f6" hint="Olib ketish nuqtasi (ixtiyoriy): xaritada bosing yoki koordinata kiriting." />
        <Field label="Izoh" hint="Masul va haydovchi kartasida manzil yonida ko'rinadi" wide><textarea name="note" rows={2} defaultValue={v('note')} className="input" /></Field>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary" disabled={pending}>{pending ? 'Yaratilmoqda…' : 'Ariza yaratish'}</button>
          <Link href="/admin/recycling" className="btn-ghost">Bekor</Link>
        </div>
      </form>
    </>
  );
}
