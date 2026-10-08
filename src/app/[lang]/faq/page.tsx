import { prisma } from '@/lib/db';
import { pickText } from '@/lib/i18n/config';
import { resolveLocale, type LangParams } from '@/lib/locale';
import { jsonLdScript, pageMetadata } from '@/lib/seo';
import { Markdown } from '@/components/site/Markdown';

export const revalidate = 300;

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return pageMetadata({ locale, path: '/faq', title: t.pages.faq, description: t.meta.description });
}

export default async function FaqPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const items = (await prisma.faqItem.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }))
    .map((f) => ({ id: f.id, q: pickText(f.questionI18n, locale), a: pickText(f.answerI18n, locale) }))
    .filter((f) => f.q && f.a);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  return (
    <div className="container-site max-w-3xl py-10">
      {items.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(ld)} />}
      <h1 className="h1">{t.pages.faq}</h1>
      <div className="mt-6 space-y-3">
        {items.map((f) => (
          <details key={f.id} className="card group p-5">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">{f.q}</summary>
            <div className="mt-3 text-slate-700"><Markdown source={f.a} /></div>
          </details>
        ))}
      </div>
    </div>
  );
}
