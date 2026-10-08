import Link from 'next/link';
import type { ContractStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate, formatPrice } from '@/lib/format';
import { str } from '@/lib/params';
import { PageHeader, Table } from '@/components/admin/ui';
import { contractStatusBadge, contractStatusNames } from '@/components/admin/finance/status';

export const metadata = { title: 'Shartnomalar' };

export default async function ContractsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('finance');
  const sp = await searchParams;
  const status = str(sp.status) as ContractStatus | undefined;
  const q = str(sp.q)?.trim();
  const where: Prisma.ContractWhereInput = {};
  if (status && status in contractStatusNames) where.status = status;
  if (q) where.OR = [{ contractNo: { contains: q, mode: 'insensitive' } }, { companyName: { contains: q, mode: 'insensitive' } }, { inn: { contains: q.replace(/\D/g, '') || q } }];
  const contracts = await prisma.contract.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { invoices: true } } } });
  return (
    <>
      <PageHeader title={`Shartnomalar (${contracts.length})`} action={{ href: '/admin/contracts/new', label: '+ Yangi shartnoma' }} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Raqam, kompaniya yoki STIR" className="input max-w-xs" />
        <select name="status" defaultValue={status ?? ''} className="input w-auto">
          <option value="">Barcha holatlar</option>
          {Object.entries(contractStatusNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-ghost px-4 py-2 text-sm">Qidirish</button>
      </form>
      <Table head={['№', 'Kompaniya', 'STIR', 'Holat', "To'lov muddati", 'Nasiya limiti', 'Hisob-fakturalar', 'Boshlanishi']} empty={!contracts.length}>
        {contracts.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50">
            <td className="whitespace-nowrap px-4 py-2"><Link href={`/admin/contracts/${c.id}`} className="font-mono font-semibold text-brand-500">{c.contractNo}</Link></td>
            <td className="px-4 py-2">{c.companyName}{c.directorName && <><br /><span className="text-xs text-slate-500">{c.directorName}</span></>}</td>
            <td className="px-4 py-2 text-slate-500">{c.inn ?? '—'}</td>
            <td className="px-4 py-2">{contractStatusBadge(c.status)}</td>
            <td className="px-4 py-2">{c.paymentTermDays} kun</td>
            <td className="whitespace-nowrap px-4 py-2">{formatPrice(c.creditLimit, "so'm")}</td>
            <td className="px-4 py-2"><Link href={`/admin/invoices?contract=${c.id}`} className="text-brand-500 hover:underline">{c._count.invoices}</Link></td>
            <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDate(c.startDate, 'uz')}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
