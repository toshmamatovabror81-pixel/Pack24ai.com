import { SAVED_MESSAGES } from './labels';

/** ?saved=kalit yoki ?error=matn — sahifa tepasidagi qisqa xabar. info — oddiy eslatma (sariq). */
export function Flash({ saved, error, info }: { saved?: string; error?: string; info?: string | null }) {
  const ok = saved ? (SAVED_MESSAGES[saved] ?? 'Saqlandi') : null;
  if (!error && !ok && !info) return null;
  const cls = error ? 'bg-red-50 text-red-700' : ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800';
  return (
    <div role="status" className={`mb-3 rounded-xl px-3 py-2.5 text-sm ${cls}`}>
      {error ? error.slice(0, 160) : ok ?? info}
    </div>
  );
}
