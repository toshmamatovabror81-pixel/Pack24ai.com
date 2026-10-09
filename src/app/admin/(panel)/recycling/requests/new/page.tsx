import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { MATERIALS, materialLabels } from '@/lib/recycling/statuses';
import { PageHeader } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { NewRequestForm } from '@/components/admin/recycling/NewRequestForm';
import { recyclingBadges } from '@/components/admin/recycling/helpers';

export const metadata = { title: 'Yangi ariza' };
export const dynamic = 'force-dynamic';

/** Admin qo'lda ariza kiritadi (telefon orqali kelgan). Forma — client (useActionState): xato va qiymatlar URL ga tushmaydi. */
export default async function NewRequestPage() {
  await requireStaff('recycling');
  const [points, settings, badges] = await Promise.all([
    prisma.recyclePoint.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' }, include: { supervisors: { where: { isActive: true }, select: { name: true } } } }),
    getSettings(),
    recyclingBadges(),
  ]);
  return (
    <>
      <PageHeader title="Yangi ariza">
        <Link href="/admin/recycling" className="btn-ghost px-4 py-2 text-sm">← Arizalar</Link>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <NewRequestForm
        points={points.map((p) => ({ id: p.id, cityUz: p.cityUz, regionUz: p.regionUz, supervisors: p.supervisors.map((s) => s.name) }))}
        materials={MATERIALS}
        materialLabels={materialLabels.uz}
        pickupMinKg={settings.recyclingPickupMinKg}
      />
    </>
  );
}
