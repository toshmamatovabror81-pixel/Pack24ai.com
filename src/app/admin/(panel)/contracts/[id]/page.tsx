import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate, formatPrice, toNumber } from '@/lib/format';
import { Field, Notice, PageHeader, Table } from '@/components/admin/ui';
import { contractStatusNames, invoiceStatusBadge } from '@/components/admin/finance/status';
import { saveContract } from '../actions';

export const metadata = { title: 'Shartnoma' };
// Sana maydoni Toshkent vaqti bo'yicha (en-CA: YYYY-MM-DD), UTC bilan bir kun surilib ketmasligi uchun
const d = (v: Date | null | undefined) => (v ? v.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' }) : '');
const errors: Record<string, string> = {
  company: 'Kompaniya nomini kiriting',
  inn: "STIR faqat raqamlardan, 9-14 ta belgidan iborat bo'lishi kerak",
};

export default async function ContractEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireStaff('finance');
  const raw = (await params).id;
  const c = raw === 'new' ? null : await prisma.contract.findUnique({ where: { id: Number(raw) || 0 }, include: { invoices: { orderBy: { createdAt: 'desc' }, include: { order: { select: { id: true, customerName: true, companyName: true } } } } } });
  if (raw !== 'new' && !c) notFound();
  const customers = await prisma.user.findMany({ where: { role: 'user', deletedAt: null }, orderBy: { name: 'asc' }, take: 500, select: { id: true, name: true, phone: true, companyName: true } });
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={c ? `Shartnoma ${c.contractNo}` : 'Yangi shartnoma'}>
        <Link href="/admin/contracts" className="btn-ghost px-4 py-2 text-sm">← Ro'yxat</Link>
        {c && <Link href={`/admin/docs/contract/${c.id}`} target="_blank" className="btn-accent px-4 py-2 text-sm">Shartnomani chop etish ↗</Link>}
      </PageHeader>
      <Notice show={sp.saved === '1'}>Saqlandi</Notice>
      <Notice show={!!sp.error} tone="warn">{errors[sp.error ?? ''] ?? 'Xato'}</Notice>
      <form action={saveContract} className="card grid gap-4 p-5 sm:grid-cols-2">
        {c && <input type="hidden" name="id" value={c.id} />}
        <Field label="Kompaniya nomi *"><input name="companyName" required defaultValue={c?.companyName ?? ''} placeholder='"Alfa Savdo" MChJ' className="input" /></Field>
        <Field label="STIR (INN)" hint="9-14 ta raqam"><input name="inn" inputMode="numeric" pattern="[0-9]{9,14}" defaultValue={c?.inn ?? ''} className="input font-mono" /></Field>
        <Field label="Direktor"><input name="directorName" defaultValue={c?.directorName ?? ''} className="input" /></Field>
        <Field label="Telefon"><input name="phone" defaultValue={c?.phone ? displayPhone(c.phone) : ''} placeholder="+998 90 123 45 67" className="input" /></Field>
        <Field label="Yuridik manzil" wide><input name="address" defaultValue={c?.address ?? ''} className="input" /></Field>
        <Field label="Bank nomi"><input name="bankName" defaultValue={c?.bankName ?? ''} className="input" /></Field>
        <Field label="MFO"><input name="mfo" inputMode="numeric" defaultValue={c?.mfo ?? ''} className="input font-mono" /></Field>
        <Field label="Hisob raqami (h/r)" wide><input name="bankAccount" inputMode="numeric" defaultValue={c?.bankAccount ?? ''} className="input font-mono" /></Field>
        <Field label="Nasiya limiti, so'm" hint="0: nasiya yo'q"><input name="creditLimit" inputMode="decimal" defaultValue={c ? toNumber(c.creditLimit) : 0} className="input" /></Field>
        <Field label="To'lov muddati, kun" hint="Hisob-faktura berilgan kundan boshlab"><input name="paymentTermDays" type="number" min={0} defaultValue={c?.paymentTermDays ?? 15} className="input" /></Field>
        <Field label="Holat">
          <select name="status" defaultValue={c?.status ?? 'active'} className="input">
            {Object.entries(contractStatusNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Mijoz kabineti" hint="Ro'yxatdan o'tgan mijozga bog'lash (ixtiyoriy)">
          <select name="userId" defaultValue={c?.userId ?? ''} className="input">
            <option value="">— Bog'lanmagan —</option>
            {customers.map((u) => <option key={u.id} value={u.id}>{u.name} · {displayPhone(u.phone)}{u.companyName ? ` · ${u.companyName}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Boshlanish sanasi"><input name="startDate" type="date" defaultValue={c ? d(c.startDate) : d(new Date())} className="input" /></Field>
        <Field label="Tugash sanasi" hint="Bo'sh: 1 yil"><input name="endDate" type="date" defaultValue={d(c?.endDate)} className="input" /></Field>
        <Field label="Izoh" wide><textarea name="notes" rows={3} defaultValue={c?.notes ?? ''} className="input" /></Field>
        <div className="sm:col-span-2"><button className="btn-primary">Saqlash</button></div>
      </form>

      {c && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Hisob-fakturalar ({c.invoices.length})</h2>
          <Table head={['№', 'Buyurtma', 'Mijoz', 'Summa', "To'langan", "To'lov muddati", 'Holat']} empty={!c.invoices.length}>
            {c.invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2"><Link href={`/admin/invoices/${inv.id}`} className="font-mono font-semibold text-brand-500">{inv.invoiceNo}</Link></td>
                <td className="px-4 py-2"><Link href={`/admin/orders/${inv.orderId}`} className="text-brand-500 hover:underline">#{inv.orderId}</Link></td>
                <td className="px-4 py-2">{inv.order.companyName || inv.order.customerName || '—'}</td>
                <td className="whitespace-nowrap px-4 py-2 font-medium">{formatPrice(inv.totalAmount, "so'm")}</td>
                <td className="whitespace-nowrap px-4 py-2">{formatPrice(inv.paidAmount, "so'm")}</td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDate(inv.dueDate, 'uz')}</td>
                <td className="px-4 py-2">{invoiceStatusBadge(inv)}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}
    </>
  );
}
