import { DriverNav } from './DriverNav';

/** Kabinet qobig'i: tepada sarlavha, pastda menyu. Faqat kirgan haydovchi uchun. */
export function DriverShell({ name, isOnline, children }: { name: string; isOnline: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-brand-900 text-white shadow">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <span className="text-lg font-black tracking-tight">
            PACK<span className="text-accent-500">24</span> <span className="text-xs font-normal text-slate-300">· Haydovchi</span>
          </span>
          <span className="flex items-center gap-2 truncate text-sm">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} aria-label={isOnline ? 'Onlayn' : 'Oflayn'} />
            <span className="truncate">{name}</span>
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-4">{children}</main>
      <DriverNav />
    </div>
  );
}
