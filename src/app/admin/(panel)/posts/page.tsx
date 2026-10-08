import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { pickText } from '@/lib/i18n/config';
import { Badge, PageHeader, Table } from '@/components/admin/ui';

export const metadata = { title: 'Blog' };

export default async function PostsPage() {
  await requireStaff('content');
  const posts = await prisma.post.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <>
      <PageHeader title="Blog maqolalari" action={{ href: '/admin/posts/new', label: '+ Yozish' }} />
      <Table head={['Sarlavha', 'Manzil', 'Sana', 'Tillar', 'Holat']} empty={!posts.length}>
        {posts.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <td className="px-4 py-2"><Link href={`/admin/posts/${p.id}`} className="font-medium text-brand-500">{pickText(p.titleI18n, 'uz')}</Link></td>
            <td className="px-4 py-2 font-mono text-xs">/blog/{p.slug}</td>
            <td className="px-4 py-2 text-slate-500">{p.publishedAt ? formatDate(p.publishedAt, 'uz') : '—'}</td>
            <td className="px-4 py-2 text-xs uppercase">{Object.keys(p.bodyI18n as object).join(', ') || '—'}</td>
            <td className="px-4 py-2">{p.isPublished ? <Badge tone="green">Chop etilgan</Badge> : <Badge>Qoralama</Badge>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
