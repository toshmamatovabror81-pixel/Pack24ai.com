'use client';

import { useActionState } from 'react';
import { issueDriverPassword, type IssueState } from '@/app/admin/(panel)/recycling/actions';
import { CopyButton } from './CopyButton';

/** Kabinet paroli: action javobida bir marta ko'rsatiladi — URL yoki cookie'ga tushmaydi */
export function DriverCredentials({ driverId, phone }: { driverId: number; phone: string }) {
  const [state, action, pending] = useActionState<IssueState, FormData>(issueDriverPassword, null);
  if (state?.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
        <p className="font-semibold text-emerald-800">Parol yaratildi — faqat hozir ko'rinadi, haydovchiga yetkazing:</p>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-white px-3 py-1 font-mono text-lg font-bold tracking-wider">{state.password}</span>
          <CopyButton text={`Login: ${phone}\nParol: ${state.password}`} label="Login+parolni nusxalash" />
        </p>
        <p className="mt-2 text-xs text-emerald-700">Kabinet: /driver/login — login: telefon raqami. Unutsa — haydovchi botida «Parolni tiklash».</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={driverId} />
      {state && !state.ok && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{state.error}</p>}
      <button className="btn-primary w-full py-2 text-sm" disabled={pending}>{pending ? 'Yaratilmoqda…' : '🔑 Kabinet parolini berish'}</button>
      <p className="text-xs text-slate-500">Parol bir marta yaratiladi va faqat shu yerda ko'rsatiladi.</p>
    </form>
  );
}
