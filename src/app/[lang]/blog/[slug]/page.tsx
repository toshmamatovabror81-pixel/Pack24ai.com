import { SiteImage as Image } from '@/components/site/SiteImage';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { pickText } from '@/lib/i18n/config';
import { formatDate } from '@/lib/format';
import { resolveLocale } from '@/lib/locale';
import { jsonLdScript, pageMetadata } from '@/lib/seo';
import { siteUrl } from '@/lib/site';
import { Markdown } from '@/components/site/Markdown';
import { Breadcrumbs } from '@/components/site/Breadcrumbs';

type Props = { params: Promise<{ lang: string; slug: string }> };

export const revalidate = 300;

async function load(params: Props['params']) {
  const { locale, t } = await resolveLocale(params);
  const { slug } = await params;
  const post = await prisma.post.findUnique({ where: { slug } });
  if (!post || !post.isPublished) notFound();
  return { locale, t, post };
}

export async function generateMetadata({ params }: Props) {
  const { locale, post } = await load(params);
  return pageMetadata({
    locale,
    path: `/blog/${post.slug}`,
    title: pickText(post.titleI18n, locale),
    description: pickText(post.excerptI18n, locale).slice(0, 160),
    image: post.cover,
    type: 'article',
  });
}

export default async function PostPage({ params }: Props) {
  const { locale, t, post } = await load(params);
  const title = pickText(post.titleI18n, locale);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    image: post.cover ? [post.cover] : undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { '@type': 'Organization', name: 'Pack24' },
    publisher: { '@type': 'Organization', name: 'Pack24', logo: { '@type': 'ImageObject', url: `${siteUrl()}/icon.svg` } },
    mainEntityOfPage: `${siteUrl()}/${locale}/blog/${post.slug}`,
  };
  return (
    <article className="container-site max-w-3xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(ld)} />
      <Breadcrumbs items={[{ name: t.nav.home, href: `/${locale}` }, { name: t.nav.blog, href: `/${locale}/blog` }, { name: title }]} />
      <h1 className="h1">{title}</h1>
      {post.publishedAt && <p className="mt-2 text-sm text-slate-500">{formatDate(post.publishedAt, locale)}</p>}
      {post.cover && <div className="relative mt-6 aspect-video overflow-hidden rounded-xl"><Image src={post.cover} alt="" fill priority sizes="768px" className="object-cover" /></div>}
      <div className="card mt-6 p-6"><Markdown source={pickText(post.bodyI18n, locale)} /></div>
    </article>
  );
}
