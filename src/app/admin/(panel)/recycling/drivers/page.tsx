import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone } from '@/lib/format';
import { str } from '@/lib/params';
import { PageHeader, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { DriverStatusBadge, OnlineBadge, RegistrationCode, TelegramBadge } from '@/components/admin/recycling/badges';
import { recyclingBadges } from '@/components/admin/recycling/helpers';

export const metadata = { title: 'Haydovchilar' };
export const dynamic = 'force-dynamic';

export default async function DriversPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const showBlocked = str(sp.all) === '1';
  const [drivers, badges] = await Promise.all([
    prisma.driver.findMany({ where: showBlocked ? {} : { status: { not: 'inactive' } }, orderBy: [{ isOnline: 'desc' }, { id: 'asc' }], include: { point: true, supervisor: true } }),
    recyclingBadges(),
  ]);
  return (
    <>
      <PageHeader title={`Haydovchilar (${drivers.length})`} action={{ href: '/admin/recycling/drivers/new', label: '➕ Yangi haydovchi' }}>
        <Link href={showBlocked ? '/admin/recycling/drivers' : '/admin/recycling/drivers?all=1'} className="btn-ghost px-3 py-2 text-sm">{showBlocked ? 'Faqat faollar' : 'Bloklanganlar ham'}</Link>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <Table head={['Haydovchi', 'Telefon', 'Punkt', 'Masul', 'Mashina', 'Holat', 'Onlayn', 'Telegram', 'Kod', '']} empty={!drivers.length}>
        {drivers.map((d) => (
          <tr key={d.id} className={`hover:bg-slate-50 ${d.status === 'inactive' ? 'opacity-60' : ''}`}>
            <td className="px-4 py-3"><Link href={`/admin/recycling/drivers/${d.id}`} className="font-semibold text-brand-500">{d.name}</Link>{d.passwordHash && <span className="ml-1 text-xs text-slate-400" title="Kabinet paroli berilgan">🔑</span>}</td>
            <td className="whitespace-nowrap px-4 py-3"><a href={`tel:+${d.phone}`} className="text-brand-500">{displayPhone(d.phone)}</a></td>
            <td className="px-4 py-3">{d.point ? <Link href={`/admin/recycling/points/${d.point.id}`} className="hover:underline">{d.point.cityUz}</Link> : <span className="text-slate-400">—</span>}</td>
            <td className="px-4 py-3">{d.supervisor ? <Link href={`/admin/recycling/supervisors/${d.supervisor.id}`} className="hover:underline">{d.supervisor.name}</Link> : <span className="text-slate-400">—</span>}</td>
            <td className="px-4 py-3 text-slate-600">{d.vehicleInfo ?? '—'}</td>
            <td className="px-4 py-3"><DriverStatusBadge status={d.status} /></td>
            <td className="px-4 py-3"><OnlineBadge driver={d} /></td>
            <td className="px-4 py-3"><TelegramBadge telegramId={d.telegramId} telegramName={d.telegramName} /></td>
            <td className="px-4 py-3">{d.telegramId ? <span className="text-xs text-slate-400">ulangan</span> : <RegistrationCode code={d.registrationCode} />}</td>
            <td className="px-4 py-3"><Link href={`/admin/recycling/drivers/${d.id}`} className="btn-ghost px-3 py-1 text-xs">Ochish</Link></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
