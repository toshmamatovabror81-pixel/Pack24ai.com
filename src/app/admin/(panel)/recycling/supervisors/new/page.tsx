import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { str } from '@/lib/params';
import { PageHeader } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { NewSupervisorForm } from '@/components/admin/recycling/NewSupervisorForm';
import { recyclingBadges } from '@/components/admin/recycling/helpers';

export const metadata = { title: 'Yangi masul' };
export const dynamic = 'force-dynamic';

/** Forma — client (useActionState): xato va qiymatlar URL ga tushmaydi. ?pointId= faqat punkt sahifasidan oldindan tanlash uchun. */
export default async function NewSupervisorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const [points, badges] = await Promise.all([prisma.recyclePoint.findMany({ orderBy: { id: 'asc' }, select: { id: true, cityUz: true, regionUz: true, status: true } }), recyclingBadges()]);
  return (
    <>
      <PageHeader title="Yangi masul">
        <Link href="/admin/recycling/supervisors" className="btn-ghost px-4 py-2 text-sm">← Masullar</Link>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <NewSupervisorForm points={points} defaultPointId={str(sp.pointId)} />
    </>
  );
}
