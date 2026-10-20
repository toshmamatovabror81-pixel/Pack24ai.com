import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Field, I18nFields, Notice, PageHeader } from '@/components/admin/ui';
import { deleteFaq, saveFaq } from '../../marketing-actions';

export const metadata = { title: 'Savol' };

export default async function FaqEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireStaff('content');
  const raw = (await params).id;
  const f = raw === 'new' ? null : await prisma.faqItem.findUnique({ where: { id: Number(raw) || 0 } });
  if (raw !== 'new' && !f) notFound();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={f ? 'Savolni tahrirlash' : 'Yangi savol'}>
        {f && <form action={deleteFaq}><input type="hidden" name="id" value={f.id} /><button className="btn-ghost px-4 py-2 text-sm text-accent-600">O&apos;chirish</button></form>}
      </PageHeader>
      <Notice show={sp.saved === '1'}>Saqlandi</Notice>
      <Notice show={!!sp.error} tone="warn">O&apos;zbekcha savol majburiy</Notice>
      <form action={saveFaq} className="card grid gap-4 p-5 sm:grid-cols-2">
        {f && <input type="hidden" name="id" value={f.id} />}
        <I18nFields name="question" label="Savol *" value={f?.questionI18n} required />
        <I18nFields name="answer" label="Javob" value={f?.answerI18n} textarea rows={4} />
        <Field label="Tartib raqami"><input name="sortOrder" type="number" defaultValue={f?.sortOrder ?? 0} className="input" /></Field>
        <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" name="isActive" defaultChecked={f?.isActive ?? true} /> Faol</label>
        <div className="sm:col-span-2"><button className="btn-primary">Saqlash</button></div>
      </form>
    </>
  );
}
