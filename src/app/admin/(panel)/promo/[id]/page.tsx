import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { toNumber } from '@/lib/format';
import { Field, Notice, PageHeader } from '@/components/admin/ui';
import { savePromo } from '../../marketing-actions';

export const metadata = { title: 'Promokod' };
const d = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : '');

export default async function PromoEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireStaff('marketing');
  const raw = (await params).id;
  const p = raw === 'new' ? null : await prisma.promoCode.findUnique({ where: { id: Number(raw) || 0 } });
  if (raw !== 'new' && !p) notFound();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={p?.code ?? 'Yangi promokod'} />
      <Notice show={sp.saved === '1'}>Saqlandi</Notice>
      <Notice show={!!sp.error} tone="warn">{sp.error === 'exists' ? 'Bunday kod bor' : 'Kod va chegirma qiymatini tekshiring (foiz 1-100)'}</Notice>
      <form action={savePromo} className="card grid gap-4 p-5 sm:grid-cols-2">
        {p && <input type="hidden" name="id" value={p.id} />}
        <Field label="Kod *" hint="Lotin harflari va raqamlar, masalan INSTA10"><input name="code" required defaultValue={p?.code ?? ''} className="input font-mono uppercase" /></Field>
        <Field label="Turi">
          <select name="type" defaultValue={p?.type ?? 'percent'} className="input"><option value="percent">Foiz, %</option><option value="fixed">Qat'iy summa, so'm</option></select>
        </Field>
        <Field label="Qiymati *"><input name="value" required inputMode="decimal" defaultValue={p ? toNumber(p.value) : ''} className="input" /></Field>
        <Field label="Minimal buyurtma, so'm"><input name="minSubtotal" inputMode="decimal" defaultValue={p ? toNumber(p.minSubtotal) : 0} className="input" /></Field>
        <Field label="Necha marta ishlatish mumkin" hint="Bo'sh: cheksiz"><input name="maxUses" type="number" min={1} defaultValue={p?.maxUses ?? ''} className="input" /></Field>
        <Field label="Izoh (qaysi kampaniya)"><input name="note" defaultValue={p?.note ?? ''} className="input" /></Field>
        <Field label="Boshlanishi"><input name="startsAt" type="date" defaultValue={d(p?.startsAt)} className="input" /></Field>
        <Field label="Tugashi"><input name="endsAt" type="date" defaultValue={d(p?.endsAt)} className="input" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} /> Faol</label>
        <div className="sm:col-span-2"><button className="btn-primary">Saqlash</button></div>
      </form>
    </>
  );
}
