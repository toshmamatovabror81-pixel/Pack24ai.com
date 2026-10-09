import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { str } from '@/lib/params';
import { PageHeader } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { NewDriverForm } from '@/components/admin/recycling/NewDriverForm';
import { recyclingBadges } from '@/components/admin/recycling/helpers';

export const metadata = { title: 'Yangi haydovchi' };
export const dynamic = 'force-dynamic';

/** Forma — client (useActionState): xato va qiymatlar URL ga tushmaydi. ?pointId=/?supervisorId= — oldindan tanlash uchun. */
export default async function NewDriverPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const [points, supervisors, badges] = await Promise.all([
    prisma.recyclePoint.findMany({ orderBy: { id: 'asc' }, select: { id: true, cityUz: true, regionUz: true } }),
    prisma.supervisor.findMany({ where: { isActive: true }, orderBy: { id: 'asc' }, include: { point: { select: { cityUz: true } } } }),
    recyclingBadges(),
  ]);
  return (
    <>
      <PageHeader title="Yangi haydovchi">
        <Link href="/admin/recycling/drivers" className="btn-ghost px-4 py-2 text-sm">← Haydovchilar</Link>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <NewDriverForm
        points={points}
        supervisors={supervisors.map((s) => ({ id: s.id, name: s.name, pointCity: s.point?.cityUz ?? null }))}
        defaultPointId={str(sp.pointId)}
        defaultSupervisorId={str(sp.supervisorId)}
      />
    </>
  );
}
