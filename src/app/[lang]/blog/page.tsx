import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { pickText } from '@/lib/i18n/config';
import { formatDate } from '@/lib/format';
import { resolveLocale, type LangParams } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return pageMetadata({ locale, path: '/blog', title: t.pages.blog, description: t.meta.description });
}

export default async function BlogPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const posts = await prisma.post.findMany({ where: { isPublished: true }, orderBy: { publishedAt: 'desc' }, take: 60 });
  return (
    <div className="container-site py-10">
      <h1 className="h1">{t.pages.blog}</h1>
      {posts.length === 0 && <p className="mt-6 text-slate-500">{t.pages.noPosts}</p>}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <Link key={p.id} href={`/${locale}/blog/${p.slug}`} className="card overflow-hidden hover:shadow-lg">
            {p.cover && <div className="relative aspect-video"><Image src={p.cover} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /></div>}
            <div className="p-5">
              <p className="text-xs text-slate-400">{p.publishedAt && formatDate(p.publishedAt, locale)}</p>
              <h2 className="mt-1 font-semibold">{pickText(p.titleI18n, locale)}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{pickText(p.excerptI18n, locale)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
