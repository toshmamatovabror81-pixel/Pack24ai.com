import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Field, I18nFields, Notice, PageHeader } from '@/components/admin/ui';
import { ImageInput } from '@/components/admin/ImageInput';
import { deleteCategory, saveCategory } from '../actions';

export const metadata = { title: 'Kategoriya' };

const errors: Record<string, string> = {
  name: "O'zbekcha nomi majburiy",
  slug: 'Bu manzil band yoki noto\'g\'ri',
  used: "Kategoriyada sotuvdagi mahsulotlar bor, avval ularni boshqa kategoriyaga o'tkazing",
};

export default async function CategoryEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireStaff('products');
  const raw = (await params).id;
  const isNew = raw === 'new';
  const cat = isNew ? null : await prisma.category.findUnique({ where: { id: Number(raw) || 0 } });
  if (!isNew && !cat) notFound();
  const sp = await searchParams;
  const nameI18n = cat && Object.keys(cat.nameI18n as object).length ? cat.nameI18n : { uz: cat?.name ?? '' };
  return (
    <>
      <PageHeader title={cat?.name ?? 'Yangi kategoriya'}>
        {cat && (
          <form action={deleteCategory}>
            <input type="hidden" name="id" value={cat.id} />
            <button className="btn-ghost px-4 py-2 text-sm text-accent-600">O'chirish</button>
          </form>
        )}
      </PageHeader>
      <Notice show={sp.saved === '1'}>Saqlandi</Notice>
      <Notice show={!!sp.error} tone="warn">{errors[sp.error ?? ''] ?? 'Xato'}</Notice>
      <form action={saveCategory} className="card grid gap-4 p-5 sm:grid-cols-2">
        {cat && <input type="hidden" name="id" value={cat.id} />}
        <I18nFields name="name" label="Nomi *" value={nameI18n} required />
        <Field label="Manzil (slug)" hint="Bo'sh qoldirsa nomdan yasaladi. O'zgartirsangiz eski havolalar ishlamay qoladi."><input name="slug" defaultValue={cat?.slug ?? ''} className="input font-mono" /></Field>
        <Field label="Tartib raqami"><input name="sortOrder" type="number" defaultValue={cat?.sortOrder ?? 0} className="input" /></Field>
        <Field label="Rasm" wide><ImageInput name="image" defaultValue={cat?.image} folder="categories" /></Field>
        <I18nFields name="description" label="Kategoriya sahifasidagi matn (SEO). Markdown: ## sarlavha, **qalin**, - ro'yxat" value={cat?.descriptionI18n} textarea rows={6} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={cat?.isActive ?? true} /> Saytda ko'rinadi</label>
        <div className="sm:col-span-2"><button className="btn-primary">Saqlash</button></div>
      </form>
    </>
  );
}
