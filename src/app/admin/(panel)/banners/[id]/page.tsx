import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Field, I18nFields, Notice, PageHeader } from '@/components/admin/ui';
import { ImageInput } from '@/components/admin/ImageInput';
import { deleteBanner, saveBanner } from '../../marketing-actions';

export const metadata = { title: 'Banner' };

export default async function BannerEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireStaff('marketing');
  const raw = (await params).id;
  const b = raw === 'new' ? null : await prisma.banner.findUnique({ where: { id: Number(raw) || 0 } });
  if (raw !== 'new' && !b) notFound();
  return (
    <>
      <PageHeader title={b ? `Banner #${b.id}` : 'Yangi banner'}>
        {b && <form action={deleteBanner}><input type="hidden" name="id" value={b.id} /><button className="btn-ghost px-4 py-2 text-sm text-accent-600">O&apos;chirish</button></form>}
      </PageHeader>
      <Notice show={(await searchParams).saved === '1'}>Saqlandi</Notice>
      <form action={saveBanner} className="card grid gap-4 p-5 sm:grid-cols-2">
        {b && <input type="hidden" name="id" value={b.id} />}
        <I18nFields name="title" label="Sarlavha" value={b?.titleI18n} required />
        <I18nFields name="text" label="Matn" value={b?.textI18n} />
        <Field label="Havola" hint="Sayt ichida: /catalog/karton-qutilar, tashqi: https://..."><input name="href" defaultValue={b?.href ?? ''} className="input" /></Field>
        <Field label="Tartib raqami"><input name="sortOrder" type="number" defaultValue={b?.sortOrder ?? 0} className="input" /></Field>
        <Field label="Fon rasmi" wide><ImageInput name="image" defaultValue={b?.image} folder="banners" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={b?.isActive ?? true} /> Faol</label>
        <div className="sm:col-span-2"><button className="btn-primary">Saqlash</button></div>
      </form>
    </>
  );
}
