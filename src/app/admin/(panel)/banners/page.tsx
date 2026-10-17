import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { pickText } from '@/lib/i18n/config';
import { Badge, PageHeader, Table } from '@/components/admin/ui';

export const metadata = { title: 'Bannerlar' };

export default async function BannersPage() {
  await requireStaff('marketing');
  const banners = await prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
  return (
    <>
      <PageHeader title="Bannerlar" action={{ href: '/admin/banners/new', label: "+ Qo'shish" }} />
      <p className="mb-4 text-sm text-slate-500">Bosh sahifadagi birinchi blokda faol bannerlardan 3 tasi chiqadi. Banner bo&apos;lmasa, mashhur mahsulotlar rasmi ko&apos;rsatiladi.</p>
      <Table head={['Tartib', 'Sarlavha', 'Havola', 'Holat']} empty={!banners.length}>
        {banners.map((b) => (
          <tr key={b.id} className="hover:bg-slate-50">
            <td className="px-4 py-2">{b.sortOrder}</td>
            <td className="px-4 py-2"><Link href={`/admin/banners/${b.id}`} className="font-medium text-brand-500">{pickText(b.titleI18n, 'uz') || `#${b.id}`}</Link></td>
            <td className="px-4 py-2 text-xs">{b.href ?? '—'}</td>
            <td className="px-4 py-2">{b.isActive ? <Badge tone="green">Faol</Badge> : <Badge>O&apos;chiq</Badge>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
