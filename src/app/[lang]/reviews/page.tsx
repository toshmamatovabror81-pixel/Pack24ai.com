import { Star } from 'lucide-react';
import { prisma } from '@/lib/db';
import { resolveLocale, type LangParams } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { formatDate } from '@/lib/format';
import { ReviewForm } from '@/components/forms/ReviewForm';

export const revalidate = 300;

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return pageMetadata({ locale, path: '/reviews', title: t.pages.reviews, description: t.meta.description });
}

export default async function ReviewsPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const reviews = await prisma.review.findMany({ where: { status: 'approved' }, orderBy: { createdAt: 'desc' }, take: 100 });
  return (
    <div className="container-site py-10">
      <h1 className="h1">{t.pages.reviews}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {reviews.length === 0 && <p className="text-slate-500">{t.pages.noReviews}</p>}
          {reviews.map((r) => (
            <article key={r.id} className="card p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{r.authorName}{r.company && <span className="font-normal text-slate-500"> · {r.company}</span>}</p>
                <p className="flex text-amber-500" aria-label={`${r.rating}/5`}>
                  {Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-4 w-4 ${i < r.rating ? 'fill-current' : 'opacity-30'}`} />)}
                </p>
              </div>
              <p className="mt-2 whitespace-pre-line text-slate-700">{r.text}</p>
              <p className="mt-2 text-xs text-slate-400">{formatDate(r.createdAt, locale)}</p>
            </article>
          ))}
        </div>
        <aside className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">{t.forms.reviewTitle}</h2>
          <ReviewForm
            labels={{
              name: t.common.name, company: t.common.company, rating: t.forms.rating, text: t.forms.reviewText,
              send: t.common.send, sending: t.common.sending, thanks: t.forms.reviewThanks, error: t.common.error,
            }}
          />
        </aside>
      </div>
    </div>
  );
}
