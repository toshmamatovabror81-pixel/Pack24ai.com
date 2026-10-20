import Link from 'next/link';

export function PageHeader({ title, action, children }: { title: string; action?: { href: string; label: string }; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 pl-10 lg:pl-0">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex items-center gap-2">
        {children}
        {action && <Link href={action.href} className="btn-primary px-4 py-2 text-sm">{action.label}</Link>}
      </div>
    </div>
  );
}

export function Notice({ show, children, tone = 'ok' }: { show: boolean; children: React.ReactNode; tone?: 'ok' | 'warn' }) {
  if (!show) return null;
  return <p className={`mb-4 rounded-lg p-3 text-sm ${tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{children}</p>;
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty && <p className="p-6 text-center text-slate-500">Hozircha hech narsa yo'q</p>}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-800',
  };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Field({ label, children, hint, wide }: { label: string; children: React.ReactNode; hint?: string; wide?: boolean }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/** Uch tilli matn maydonlari */
export function I18nFields({ name, label, value, textarea, rows = 3, required }: { name: string; label: string; value?: unknown; textarea?: boolean; rows?: number; required?: boolean }) {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, string>;
  return (
    <fieldset className="sm:col-span-2">
      <legend className="label">{label}</legend>
      <div className={`grid gap-2 ${textarea ? '' : 'sm:grid-cols-3'}`}>
        {(['uz', 'ru', 'en'] as const).map((l) => (
          <div key={l} className="relative">
            <span className="absolute right-2 top-2 text-[10px] font-bold uppercase text-slate-400">{l}</span>
            {textarea ? (
              <textarea name={`${name}.${l}`} defaultValue={v[l] ?? ''} rows={rows} required={required && l === 'uz'} className="input pr-8" />
            ) : (
              <input name={`${name}.${l}`} defaultValue={v[l] ?? ''} required={required && l === 'uz'} className="input pr-8" />
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export function Pager({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (n: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-sm">
      {page > 1 && <Link href={hrefFor(page - 1)} className="btn-ghost px-3 py-1.5">←</Link>}
      <span>{page} / {pages}</span>
      {page < pages && <Link href={hrefFor(page + 1)} className="btn-ghost px-3 py-1.5">→</Link>}
    </div>
  );
}
