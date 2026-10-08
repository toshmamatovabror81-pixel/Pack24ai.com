import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n';
import { getSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import { jsonLdScript } from '@/lib/seo';
import { pickText } from '@/lib/i18n/config';
import { CartProvider } from '@/components/cart/CartProvider';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { FloatingContact } from '@/components/site/FloatingContact';
import { Analytics } from '@/components/site/Analytics';

export const viewport: Viewport = { themeColor: '#102a45', width: 'device-width', initialScale: 1 };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const t = getDict(isLocale(lang) ? lang : 'uz');
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${t.meta.siteName}: ${t.meta.tagline}`, template: `%s | ${t.meta.siteName}` },
    description: t.meta.description,
  };
}

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale: Locale = lang;
  const t = getDict(locale);
  const s = await getSettings();
  const org = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
    name: s.companyName,
    legalName: s.legalName || undefined,
    url: siteUrl(),
    logo: `${siteUrl()}/icon.svg`,
    telephone: `+${s.phone}`,
    email: s.email || undefined,
    address: { '@type': 'PostalAddress', streetAddress: pickText(s.address, locale), addressLocality: 'Tashkent', addressCountry: 'UZ' },
    openingHours: 'Mo-Sa 09:00-18:00',
    sameAs: [s.telegramChannel && `https://t.me/${s.telegramChannel}`, s.instagram && `https://instagram.com/${s.instagram}`].filter(Boolean),
  };
  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(org)} />
        <CartProvider>
          <Header locale={locale} t={t} phone={s.phone} />
          <main className="flex-1">{children}</main>
          <Footer locale={locale} t={t} s={s} />
          <FloatingContact bot={s.telegramBot} phone={s.phone} telegramLabel={t.common.telegramOrder} callLabel={t.common.call} />
        </CartProvider>
        <Analytics ymId={s.yandexMetrikaId} gaId={s.ga4Id} />
      </body>
    </html>
  );
}
