import { resolveLocale, type LangParams } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { contactFields, leadLabels } from '@/lib/leadLabels';
import { LeadForm } from '@/components/forms/LeadForm';

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return pageMetadata({ locale, path: '/recycling', title: t.forms.recyclingTitle, description: t.forms.recyclingText });
}

export default async function RecyclingPage({ params }: LangParams) {
  const { t } = await resolveLocale(params);
  return (
    <div className="container-site max-w-3xl py-10">
      <h1 className="h1">{t.forms.recyclingTitle}</h1>
      <p className="mt-3 text-slate-600">{t.forms.recyclingText}</p>
      <div className="card mt-6 p-6">
        <LeadForm
          type="recycling"
          labels={leadLabels(t)}
          fields={[
            ...contactFields(t),
            { name: 'address', label: t.forms.address, required: true },
            { name: 'volume', label: t.forms.volume, type: 'number' },
            { name: 'message', label: t.common.message, type: 'textarea' },
          ]}
        />
      </div>
    </div>
  );
}
