import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone } from '@/lib/format';
import { ACTIVE_STATUSES } from '@/lib/recycling/statuses';
import { Badge, PageHeader, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { RegistrationCode, TelegramBadge } from '@/components/admin/recycling/badges';
import { recyclingBadges } from '@/components/admin/recycling/helpers';

export const metadata = { title: 'Masullar' };
export const dynamic = 'force-dynamic';

export default async function SupervisorsPage() {
  await requireStaff('recycling');
  const [supervisors, active, badges] = await Promise.all([
    prisma.supervisor.findMany({ orderBy: [{ isActive: 'desc' }, { id: 'asc' }], include: { point: true, _count: { select: { drivers: { where: { status: { not: 'inactive' } } } } } } }),
    prisma.recycleRequest.groupBy({ by: ['supervisorId'], where: { status: { in: ACTIVE_STATUSES }, supervisorId: { not: null } }, _count: { _all: true } }),
    recyclingBadges(),
  ]);
  const activeBy = new Map(active.map((a) => [a.supervisorId, a._count._all]));
  return (
    <>
      <PageHeader title={`Masullar (${supervisors.length})`} action={{ href: '/admin/recycling/supervisors/new', label: '➕ Yangi masul' }} />
      <RecyclingNav badges={badges} />
      <p className="mb-4 text-sm text-slate-500">Masul — punkt boshlig'i: boshqaruv botida arizalarni qabul qiladi, haydovchi tayinlaydi, to'lovni belgilaydi, kunlik jurnal yuritadi. Botga kirish: /start → ro'yxatdan o'tish kodi → telefon ulashish.</p>
      <Table head={['Masul', 'Telefon', 'Punkt', 'Telegram', 'Kod', 'Holat', 'Haydovchilar', 'Faol arizalar', '']} empty={!supervisors.length}>
        {supervisors.map((s) => (
          <tr key={s.id} className={`hover:bg-slate-50 ${s.isActive ? '' : 'opacity-60'}`}>
            <td className="px-4 py-3"><Link href={`/admin/recycling/supervisors/${s.id}`} className="font-semibold text-brand-500">{s.name}</Link></td>
            <td className="whitespace-nowrap px-4 py-3"><a href={`tel:+${s.phone}`} className="text-brand-500">{displayPhone(s.phone)}</a></td>
            <td className="px-4 py-3">{s.point ? <Link href={`/admin/recycling/points/${s.point.id}`} className="hover:underline">{s.point.cityUz}</Link> : <span className="text-amber-700">Biriktirilmagan</span>}</td>
            <td className="px-4 py-3"><TelegramBadge telegramId={s.telegramId} telegramName={s.telegramName} /></td>
            <td className="px-4 py-3">{s.telegramId ? <span className="text-xs text-slate-400">ulangan</span> : <RegistrationCode code={s.registrationCode} />}</td>
            <td className="px-4 py-3">{s.isActive ? <Badge tone="green">Faol</Badge> : <Badge tone="slate">Nofaol</Badge>}</td>
            <td className="px-4 py-3 text-center">{s._count.drivers}</td>
            <td className="px-4 py-3 text-center">{activeBy.get(s.id) ?? 0}</td>
            <td className="px-4 py-3"><Link href={`/admin/recycling/supervisors/${s.id}`} className="btn-ghost px-3 py-1 text-xs">Ochish</Link></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
