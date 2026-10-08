import type { Metadata } from 'next';
import { locales, localeTags, type Locale } from './i18n/config';
import { siteUrl } from './site';

/** path: tilsiz yo'l, masalan "/catalog/karton-qutilar" */
export function pageMetadata(opts: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  image?: string | null;
  noindex?: boolean;
  type?: 'website' | 'article';
}): Metadata {
  const path = opts.path === '/' ? '' : opts.path;
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeTags[l]] = `${siteUrl()}/${l}${path}`;
  languages['x-default'] = `${siteUrl()}/uz${path}`;
  // Admin yuklagan rasm (/uploads/...) to'liq manzilga aylantiriladi; rasm bo'lmasa brend banneri /og
  const img = opts.image ?? '';
  const image = /^https?:\/\//.test(img) ? img : img.startsWith('/uploads/') ? `${siteUrl()}${img}` : `${siteUrl()}/og`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: `${siteUrl()}/${opts.locale}${path}`, languages },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: `${siteUrl()}/${opts.locale}${path}`,
      siteName: 'Pack24',
      locale: localeTags[opts.locale].replace('-', '_'),
      type: opts.type ?? 'website',
      images: [{ url: image }],
    },
    twitter: { card: 'summary_large_image', title: opts.title, description: opts.description, images: [image] },
    robots: opts.noindex ? { index: false, follow: true } : undefined,
  };
}

export function jsonLdScript(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}
