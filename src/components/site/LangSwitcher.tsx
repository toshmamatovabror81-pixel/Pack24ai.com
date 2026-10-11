'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n/config';

export function LangSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const rest = pathname.replace(/^\/(uz|ru|en)(?=\/|$)/, '');
  const qs = search.toString();
  return (
    <div className="flex items-center gap-1 text-xs font-semibold">
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest}${qs ? `?${qs}` : ''}`}
          hrefLang={l}
          className={`rounded px-2 py-1 uppercase ${l === current ? 'bg-white text-brand-700' : 'text-white/80 hover:text-white'}`}
        >
          {l}
        </Link>
      ))}
    </div>
  );
}
