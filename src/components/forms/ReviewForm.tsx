'use client';

import { useActionState } from 'react';
import { submitReview, type ReviewState } from '@/lib/reviews';

export function ReviewForm({ labels }: { labels: Record<'name' | 'company' | 'rating' | 'text' | 'send' | 'sending' | 'thanks' | 'error', string> }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, null);
  if (state?.ok) return <p className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{labels.thanks}</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="block"><span className="label">{labels.name} *</span><input name="name" required minLength={2} className="input" /></label>
      <label className="block"><span className="label">{labels.company}</span><input name="company" className="input" /></label>
      <label className="block">
        <span className="label">{labels.rating}</span>
        <select name="rating" defaultValue="5" className="input">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select>
      </label>
      <label className="block"><span className="label">{labels.text} *</span><textarea name="text" required minLength={10} rows={4} className="input" /></label>
      {state?.error && <p className="text-sm text-accent-600">{labels.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? labels.sending : labels.send}</button>
    </form>
  );
}
