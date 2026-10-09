'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { driverLogin, type DriverLoginState } from '@/app/driver/actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<DriverLoginState, FormData>(driverLogin, null);
  // Xato bo'lsa telefon qolsin (React 19 formani o'zi tozalaydi), parol har doim tozalanadi
  const [phone, setPhone] = useState('');
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Telefon</span>
        <input name="phone" type="tel" inputMode="tel" required autoComplete="tel" placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} className="input text-base" />
      </label>
      <label className="block">
        <span className="label">Parol</span>
        <input name="password" type="password" required autoComplete="current-password" className="input text-base" />
      </label>
      {state?.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.error === 'rate' ? "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." : "Telefon yoki parol noto'g'ri"}
        </p>
      )}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? 'Tekshirilmoqda…' : 'Kirish'}</button>
      <p className="text-center text-sm"><Link href="/driver/forgot" className="text-brand-500 hover:underline">Parolni unutdingizmi?</Link></p>
    </form>
  );
}
