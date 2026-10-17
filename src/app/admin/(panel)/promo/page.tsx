import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate, formatPrice, toNumber } from '@/lib/format';
import { Badge, PageHeader, Table } from '@/components/admin/ui';

export const metadata = { title: 'Promokodlar' };

export default async function PromoPage() {
  await requireStaff('marketing');
  const promos = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
  const usage = await prisma.order.groupBy({ by: ['promoCode'], where: { promoCode: { not: null }, deletedAt: null }, _count: { _all: true }, _sum: { totalAmount: true } });
  const use = new Map(usage.map((u) => [u.promoCode, u]));
  const now = new Date();
  return (
    <>
      <PageHeader title="Promokodlar" action={{ href: '/admin/promo/new', label: "+ Qo'shish" }} />
      <Table head={['Kod', 'Chegirma', 'Muddat', 'Ishlatilgan', 'Buyurtmalar summasi', 'Holat']} empty={!promos.length}>
        {promos.map((p) => {
          const expired = (p.endsAt && p.endsAt < now) || (p.maxUses != null && p.usedCount >= p.maxUses);
          return (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-2"><Link href={`/admin/promo/${p.id}`} className="font-mono font-semibold text-brand-500">{p.code}</Link>{p.note && <><br /><span className="text-xs text-slate-500">{p.note}</span></>}</td>
              <td className="px-4 py-2">{p.type === 'percent' ? `${toNumber(p.value)}%` : formatPrice(p.value, "so'm")}{toNumber(p.minSubtotal) > 0 && <span className="text-xs text-slate-500"> ({formatPrice(p.minSubtotal, "so'm")} dan)</span>}</td>
              <td className="px-4 py-2 text-xs">{p.startsAt ? formatDate(p.startsAt, 'uz') : '…'} — {p.endsAt ? formatDate(p.endsAt, 'uz') : '…'}</td>
              <td className="px-4 py-2">{p.usedCount}{p.maxUses != null && ` / ${p.maxUses}`}</td>
              <td className="px-4 py-2">{formatPrice(use.get(p.code)?._sum.totalAmount ?? 0, "so'm")}</td>
              <td className="px-4 py-2">{!p.isActive ? <Badge>O'chiq</Badge> : expired ? <Badge tone="amber">Tugagan</Badge> : <Badge tone="green">Faol</Badge>}</td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
