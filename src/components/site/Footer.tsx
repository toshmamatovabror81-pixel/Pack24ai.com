import Link from 'next/link';
import { pickText, type Locale } from '@/lib/i18n/config';
import type { Dict } from '@/lib/i18n';
import type { SiteSettings } from '@/lib/settings';
import { displayPhone } from '@/lib/format';
import { Logo } from './Logo';
import { TrackedLink } from './TrackedLink';

export function Footer({ locale, t, s }: { locale: Locale; t: Dict; s: SiteSettings }) {
  const p = (path: string) => `/${locale}${path}`;
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 bg-brand-900 text-slate-300">
      <div className="mx-auto grid max-w-site gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo className="text-white" />
          <p className="mt-3 text-sm leading-relaxed">{t.footer.about}</p>
        </div>
        <div>
          <h2 className="mb-3 font-semibold text-white">{t.footer.customers}</h2>
          <ul className="space-y-2 text-sm">
            <li><Link href={p('/catalog')} className="hover:text-white">{t.nav.catalog}</Link></li>
            <li><Link href={p('/wholesale')} className="hover:text-white">{t.nav.wholesale}</Link></li>
            <li><Link href={p('/delivery')} className="hover:text-white">{t.nav.delivery}</Link></li>
            <li><Link href={p('/payment')} className="hover:text-white">{t.nav.payment}</Link></li>
            <li><Link href={p('/faq')} className="hover:text-white">{t.nav.faq}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-semibold text-white">{t.footer.company}</h2>
          <ul className="space-y-2 text-sm">
            <li><Link href={p('/contacts')} className="hover:text-white">{t.nav.contacts}</Link></li>
            <li><Link href={p('/reviews')} className="hover:text-white">{t.nav.reviews}</Link></li>
            <li><Link href={p('/blog')} className="hover:text-white">{t.nav.blog}</Link></li>
            <li><Link href={p('/recycling')} className="hover:text-white">{t.nav.recycling}</Link></li>
            <li><Link href={p('/vacancies')} className="hover:text-white">{t.nav.vacancies}</Link></li>
          </ul>
        </div>
        <div className="space-y-2 text-sm">
          <h2 className="mb-3 font-semibold text-white">{t.nav.contacts}</h2>
          <p>
            <TrackedLink href={`tel:+${s.phone}`} event="phone_click" className="text-lg font-semibold text-white hover:underline">
              {displayPhone(s.phone)}
            </TrackedLink>
          </p>
          {s.email && <p><a href={`mailto:${s.email}`} className="hover:text-white">{s.email}</a></p>}
          <p>{pickText(s.address, locale)}</p>
          <p>{pickText(s.workHours, locale)}</p>
          <p className="flex gap-3 pt-2">
            {s.telegramBot && <TrackedLink href={`https://t.me/${s.telegramBot}`} event="telegram_click" className="hover:text-white" target="_blank" rel="noopener">Telegram bot</TrackedLink>}
            {s.telegramChannel && <a href={`https://t.me/${s.telegramChannel}`} className="hover:text-white" target="_blank" rel="noopener">Telegram</a>}
            {s.instagram && <a href={`https://instagram.com/${s.instagram}`} className="hover:text-white" target="_blank" rel="noopener">Instagram</a>}
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-site flex-col gap-2 px-4 py-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {s.legalName || s.companyName}. {t.footer.rights}</p>
          <p className="flex gap-4">
            <Link href={p('/privacy')} className="hover:text-white">{t.pages.privacy}</Link>
            <Link href={p('/offer')} className="hover:text-white">{t.pages.offer}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
