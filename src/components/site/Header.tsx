import Link from 'next/link';
import { Suspense } from 'react';
import { Phone, Search, User } from 'lucide-react';
import type { Locale } from '@/lib/i18n/config';
import type { Dict } from '@/lib/i18n';
import { displayPhone } from '@/lib/format';
import { Logo } from './Logo';
import { CartLink } from './CartLink';
import { LangSwitcher } from './LangSwitcher';
import { MobileMenu } from './MobileMenu';
import { TrackedLink } from './TrackedLink';

export function Header({ locale, t, phone }: { locale: Locale; t: Dict; phone: string }) {
  const p = (path: string) => `/${locale}${path}`;
  const links = [
    { href: p('/catalog'), label: t.nav.catalog },
    { href: p('/wholesale'), label: t.nav.wholesale },
    { href: p('/delivery'), label: t.nav.delivery },
    { href: p('/payment'), label: t.nav.payment },
    { href: p('/blog'), label: t.nav.blog },
    { href: p('/contacts'), label: t.nav.contacts },
  ];
  return (
    <header className="sticky top-0 z-50 bg-brand-700 text-white shadow-md">
      <div className="relative mx-auto flex h-16 max-w-site items-center gap-3 px-4">
        <MobileMenu links={links} label={t.nav.menu} />
        <Link href={p('')} aria-label="Pack24" className="shrink-0">
          <Logo />
        </Link>
        <form action={p('/catalog')} className="ml-2 hidden flex-1 md:flex" role="search">
          <label className="relative w-full max-w-md">
            <span className="sr-only">{t.nav.search}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              type="search"
              placeholder={t.nav.search}
              className="w-full rounded-lg border-0 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-accent-500"
            />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <TrackedLink
            href={`tel:+${phone}`}
            event="phone_click"
            className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10 lg:inline-flex"
          >
            <Phone className="h-4 w-4" />
            {displayPhone(phone)}
          </TrackedLink>
          <Link href={p('/profile')} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10" aria-label={t.nav.account}>
            <User className="h-5 w-5" />
          </Link>
          <CartLink href={p('/cart')} label={t.nav.cart} />
          <Suspense>
            <LangSwitcher current={locale} />
          </Suspense>
        </div>
      </div>
      <nav className="hidden border-t border-white/10 bg-brand-900/40 lg:block">
        <ul className="mx-auto flex max-w-site gap-1 px-4 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="block px-3 py-2.5 text-white/85 hover:text-white">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action={p('/catalog')} className="border-t border-white/10 px-4 py-2 md:hidden" role="search">
        <input
          name="q"
          type="search"
          placeholder={t.nav.search}
          aria-label={t.nav.search}
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
        />
      </form>
    </header>
  );
}
