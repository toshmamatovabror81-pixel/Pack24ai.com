import { prisma } from '@/lib/db';
import { pickText } from '@/lib/i18n/config';
import { resolveLocale } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { str, type SearchParams } from '@/lib/params';
import { contactFields, leadLabels } from '@/lib/leadLabels';
import { LeadForm } from '@/components/forms/LeadForm';

type Props = { params: Promise<{ lang: string }>; searchParams: SearchParams };

export async function generateMetadata({ params }: Props) {
  const { locale, t } = await resolveLocale(params);
  return pageMetadata({ locale, path: '/wholesale', title: t.forms.wholesaleTitle, description: t.forms.wholesaleText });
}

export default async function WholesalePage({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const productId = Number(str((await searchParams).product)) || undefined;
  const product = productId ? await prisma.product.findFirst({ where: { id: productId, status: 'active' }, select: { id: true, name: true, nameI18n: true } }) : null;
  return (
    <div className="container-site max-w-3xl py-10">
      <h1 className="h1">{t.forms.wholesaleTitle}</h1>
      <p className="mt-3 text-slate-600">{t.forms.wholesaleText}</p>
      <div className="card mt-6 p-6">
        <LeadForm
          type="wholesale"
          types={[
            { value: 'wholesale', label: t.forms.typeWholesale },
            { value: 'custom_box', label: t.forms.typeCustom },
          ]}
          productId={product?.id}
          labels={leadLabels(t)}
          fields={[
            ...contactFields(t),
            { name: 'company', label: t.common.company },
            { name: 'product', label: t.forms.product, defaultValue: product ? pickText(product.nameI18n, locale, product.name) : '' },
            { name: 'size', label: t.forms.size },
            { name: 'quantity', label: t.forms.quantity, type: 'number' },
            { name: 'logo', label: t.forms.logo, type: 'select', options: [{ value: '', label: '—' }, { value: 'ha', label: t.forms.yes }, { value: "yo'q", label: t.forms.no }] },
            { name: 'message', label: t.common.message, type: 'textarea' },
          ]}
        />
      </div>
    </div>
  );
}
