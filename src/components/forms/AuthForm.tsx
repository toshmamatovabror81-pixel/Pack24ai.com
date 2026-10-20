'use client';

import { useActionState } from 'react';
import type { AuthState } from '@/app/[lang]/login/actions';

type Field = { name: string; label: string; type?: string; autoComplete?: string; required?: boolean };

export function AuthForm({
  action,
  locale,
  fields,
  submit,
  errors,
}: {
  action: (s: AuthState, fd: FormData) => Promise<AuthState>;
  locale: string;
  fields: Field[];
  submit: string;
  errors: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="label">{f.label}</span>
          <input name={f.name} type={f.type ?? 'text'} autoComplete={f.autoComplete} required={f.required ?? true} className="input" />
        </label>
      ))}
      {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-accent-600" role="alert">{errors[state.error] ?? errors.invalid}</p>}
      <button className="btn-primary w-full" disabled={pending}>{submit}</button>
    </form>
  );
}
