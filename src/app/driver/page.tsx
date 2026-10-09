import { requireDriver } from '@/lib/auth/driver';
import { driverTasks } from '@/lib/recycling/driverTasks';
import { DriverLocation } from '@/components/driver/DriverLocation';
import { Flash } from '@/components/driver/Flash';
import { TaskCard } from '@/components/driver/TaskCard';
import { acceptedTaskIds } from './accepted';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Topshiriqlar' };

export default async function DriverTasksPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const d = await requireDriver();
  const [tasks, sp] = await Promise.all([driverTasks(d.id), searchParams]);
  const accepted = await acceptedTaskIds(d.id, tasks);
  return (
    <>
      <DriverLocation isOnline={d.isOnline} />
      <Flash saved={sp.saved} error={sp.error} />
      <h1 className="mb-3 text-lg font-bold">Topshiriqlar {tasks.length > 0 && <span className="text-slate-400">({tasks.length})</span>}</h1>
      {tasks.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-3xl">📭</p>
          <p className="mt-2 font-semibold">Hozircha topshiriq yo'q</p>
          <p className="mt-1 text-sm text-slate-500">{d.isOnline ? 'Siz onlaynsiz — yangi topshiriq kelganda shu yerda ko\'rinadi.' : 'Onlayn bo\'lsangiz masul sizga topshiriq tayinlaydi.'}</p>
        </div>
      ) : (
        <div className="space-y-3">{tasks.map((t) => <TaskCard key={t.id} task={t} accepted={accepted.has(t.id)} />)}</div>
      )}
    </>
  );
}
