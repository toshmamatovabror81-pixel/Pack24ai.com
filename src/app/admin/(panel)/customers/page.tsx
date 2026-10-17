import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate, formatPrice, normalizePhone } from '@/lib/format';
import { str } from '@/lib/params';
import { PageHeader, Pager, Table } from '@/components/admin/ui';

export const metadata = { title: 'Mijozlar' };
const PER_PAGE = 40;

/**
 * Mijozlar ro'yxati buyurtmalardagi telefon raqamlar bo'yicha yig'iladi:
 * ro'yxatdan o'tmagan (mehmon) mijozlar ham ko'rinadi.
 */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('customers');
  const sp = await searchParams;
  const q = str(sp.q)?.trim();
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const where: Prisma.OrderWhereInput = { deletedAt: null, contactPhone: { not: null } };
  if (q) {
    const phone = normalizePhone(q);
    where.OR = [{ customerName: { contains: q, mode: 'insensitive' } }, { contactPhone: { contains: phone ?? (q.replace(/\D/g, '') || q) } }];
  }
  const groups = await prisma.order.groupBy({
    by: ['contactPhone'],
    where,
    _count: { _all: true },
    _sum: { totalAmount: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
  });
  const slice = groups.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const phones = slice.map((g) => g.contactPhone!).filter(Boolean);
  const [users, names] = await Promise.all([
    prisma.user.findMany({ where: { phone: { in: phones } }, select: { id: true, phone: true, name: true, companyName: true, customerType: true } }),
    prisma.order.findMany({ where: { contactPhone: { in: phones } }, orderBy: { createdAt: 'desc' }, distinct: ['contactPhone'], select: { contactPhone: true, customerName: true } }),
  ]);
  const userBy = new Map(users.map((u) => [u.phone, u]));
  const nameBy = new Map(names.map((n) => [n.contactPhone, n.customerName]));
  const paid = await prisma.order.groupBy({ by: ['contactPhone'], where: { contactPhone: { in: phones }, paymentStatus: 'paid', deletedAt: null }, _sum: { totalAmount: true } });
  const paidBy = new Map(paid.map((p) => [p.contactPhone, p._sum.totalAmount]));
  return (
    <>
      <PageHeader title={`Mijozlar (${groups.length})`} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Ism yoki telefon" className="input max-w-xs" />
        <button className="btn-ghost px-4 py-2 text-sm">Qidirish</button>
      </form>
      <Table head={['Mijoz', 'Telefon', 'Buyurtmalar', "To'langan", 'Oxirgi buyurtma', 'Kabinet']} empty={!slice.length}>
        {slice.map((g) => {
          const u = userBy.get(g.contactPhone!);
          return (
            <tr key={g.contactPhone} className="hover:bg-slate-50">
              <td className="px-4 py-2"><Link href={`/admin/customers/${g.contactPhone}`} className="font-medium text-brand-500 hover:underline">{u?.name ?? nameBy.get(g.contactPhone) ?? '—'}</Link>{u?.companyName && <><br /><span className="text-xs text-slate-500">{u.companyName}</span></>}</td>
              <td className="whitespace-nowrap px-4 py-2">{displayPhone(g.contactPhone!)}</td>
              <td className="px-4 py-2">{g._count._all}</td>
              <td className="whitespace-nowrap px-4 py-2">{formatPrice(paidBy.get(g.contactPhone) ?? 0, "so'm")}</td>
              <td className="px-4 py-2 text-slate-500">{g._max.createdAt && formatDate(g._max.createdAt, 'uz')}</td>
              <td className="px-4 py-2">{u ? 'Bor' : '—'}</td>
            </tr>
          );
        })}
      </Table>
      <Pager page={page} pages={Math.ceil(groups.length / PER_PAGE)} hrefFor={(n) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`} />
    </>
  );
}
