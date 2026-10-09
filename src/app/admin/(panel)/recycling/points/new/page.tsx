import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { str } from '@/lib/params';
import { Notice, PageHeader } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { PointForm } from '@/components/admin/recycling/PointForm';
import { recyclingBadges } from '@/components/admin/recycling/helpers';
import { createPointAction } from '../../actions';

export const metadata = { title: 'Yangi punkt' };
export const dynamic = 'force-dynamic';

export default async function NewPointPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const badges = await recyclingBadges();
  return (
    <>
      <PageHeader title="Yangi qabul punkti">
        <Link href="/admin/recycling/points" className="btn-ghost px-4 py-2 text-sm">← Punktlar</Link>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <Notice show={!!str(sp.error)} tone="warn">{str(sp.error)}</Notice>
      <PointForm action={createPointAction} submitLabel="Punkt yaratish" />
    </>
  );
}
