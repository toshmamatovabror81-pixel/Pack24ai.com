'use client';

import { useActionState } from 'react';
import { staffLogin, type StaffLoginState } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<StaffLoginState, FormData>(staffLogin, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block"><span className="label">Telefon, email yoki login</span><input name="login" required autoComplete="username" className="input" /></label>
      <label className="block"><span className="label">Parol</span><input name="password" type="password" required autoComplete="current-password" className="input" /></label>
      {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-accent-600">{state.error === 'rate' ? "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." : "Login yoki parol noto'g'ri"}</p>}
      <button className="btn-primary w-full" disabled={pending}>Kirish</button>
    </form>
  );
}
