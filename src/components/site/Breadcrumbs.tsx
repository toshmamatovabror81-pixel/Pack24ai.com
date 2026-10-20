import Link from 'next/link';
import { siteUrl } from '@/lib/site';
import { jsonLdScript } from '@/lib/seo';

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(it.href ? { item: `${siteUrl()}${it.href}` } : {}) })),
  };
  return (
    <nav aria-label="breadcrumb" className="mb-4 text-sm text-slate-500">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(ld)} />
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span>/</span>}
            {it.href && i < items.length - 1 ? <Link href={it.href} className="hover:text-brand-500">{it.name}</Link> : <span className="text-slate-700">{it.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
