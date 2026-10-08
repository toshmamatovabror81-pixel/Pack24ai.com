import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Field, I18nFields, Notice, PageHeader } from '@/components/admin/ui';
import { ImageInput } from '@/components/admin/ImageInput';
import { deletePost, savePost } from '../../marketing-actions';

export const metadata = { title: 'Maqola' };

export default async function PostEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireStaff('content');
  const raw = (await params).id;
  const p = raw === 'new' ? null : await prisma.post.findUnique({ where: { id: Number(raw) || 0 } });
  if (raw !== 'new' && !p) notFound();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={p ? 'Maqolani tahrirlash' : 'Yangi maqola'}>
        {p && <form action={deletePost}><input type="hidden" name="id" value={p.id} /><button className="btn-ghost px-4 py-2 text-sm text-accent-600">O&apos;chirish</button></form>}
      </PageHeader>
      <Notice show={sp.saved === '1'}>Saqlandi</Notice>
      <Notice show={!!sp.error} tone="warn">{sp.error === 'slug' ? 'Bu manzil band' : "O'zbekcha sarlavha majburiy"}</Notice>
      <form action={savePost} className="card grid gap-4 p-5 sm:grid-cols-2">
        {p && <input type="hidden" name="id" value={p.id} />}
        <I18nFields name="title" label="Sarlavha *" value={p?.titleI18n} required />
        <Field label="Manzil (slug)" hint="Bo'sh qoldirsa sarlavhadan yasaladi"><input name="slug" defaultValue={p?.slug ?? ''} className="input font-mono" /></Field>
        <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" name="isPublished" defaultChecked={p?.isPublished ?? false} /> Saytda chop etish</label>
        <Field label="Muqova rasmi" wide><ImageInput name="cover" defaultValue={p?.cover} folder="blog" /></Field>
        <I18nFields name="excerpt" label="Qisqa tavsif (ro'yxat va Google uchun)" value={p?.excerptI18n} textarea rows={2} />
        <I18nFields name="body" label="Matn (Markdown: ## sarlavha, **qalin**, - ro'yxat, [havola](https://...))" value={p?.bodyI18n} textarea rows={14} />
        <div className="sm:col-span-2"><button className="btn-primary">Saqlash</button></div>
      </form>
    </>
  );
}
