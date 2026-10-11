import Link from 'next/link';

export function Pagination({ page, pages, hrefFor, labels }: { page: number; pages: number; hrefFor: (n: number) => string; labels: { prev: string; next: string } }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2);
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1" aria-label="pagination">
      {page > 1 && <Link href={hrefFor(page - 1)} className="btn-ghost px-3 py-2 text-sm" rel="prev">{labels.prev}</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && nums[i - 1] !== n - 1 && <span className="px-1 text-slate-400">…</span>}
          <Link href={hrefFor(n)} aria-current={n === page ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm ${n === page ? 'bg-brand-500 text-white' : 'hover:bg-slate-200'}`}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link href={hrefFor(page + 1)} className="btn-ghost px-3 py-2 text-sm" rel="next">{labels.next}</Link>}
    </nav>
  );
}
