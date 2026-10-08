import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { pickText } from '@/lib/i18n/config';
import { Badge, PageHeader, Table } from '@/components/admin/ui';

export const metadata = { title: 'Savol-javob' };

export default async function FaqAdmin() {
  await requireStaff('content');
  const items = await prisma.faqItem.findMany({ orderBy: { sortOrder: 'asc' } });
  return (
    <>
      <PageHeader title="Savol-javob" action={{ href: '/admin/faq/new', label: "+ Qo'shish" }} />
      <Table head={['Tartib', 'Savol', 'Holat']} empty={!items.length}>
        {items.map((f) => (
          <tr key={f.id} className="hover:bg-slate-50">
            <td className="px-4 py-2">{f.sortOrder}</td>
            <td className="px-4 py-2"><Link href={`/admin/faq/${f.id}`} className="text-brand-500">{pickText(f.questionI18n, 'uz')}</Link></td>
            <td className="px-4 py-2">{f.isActive ? <Badge tone="green">Faol</Badge> : <Badge>O&apos;chiq</Badge>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
