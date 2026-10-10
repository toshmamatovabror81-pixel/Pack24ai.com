import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { str, type SearchParams } from '@/lib/params';
import { Badge, Notice, PageHeader, Pager, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { severityLabels, severityTone } from '@/components/admin/recycling/badges';
import { markAllEventsAction, markEventAction } from './actions';
import { eventsUrl, parseEventFilters, SEVERITIES, SOURCES, sourceLabels, statusFilterLabels, type StatusFilter } from './filters';
import { recyclingNavBadges } from './navBadges';

export const metadata = { title: 'Hodisalar' };
export const dynamic = 'force-dynamic';
const PER_PAGE = 50;

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const f = parseEventFilters({ status: str(sp.status), source: str(sp.source), severity: str(sp.severity), q: str(sp.q), page: str(sp.page) });
  const where: Prisma.BotEventWhereInput = {};
  if (f.status !== 'all') where.status = f.status;
  if (f.source) where.sourceBot = f.source;
  if (f.severity) where.severity = f.severity;
  if (f.q) where.OR = [{ title: { contains: f.q, mode: 'insensitive' } }, { message: { contains: f.q, mode: 'insensitive' } }, { eventType: { contains: f.q, mode: 'insensitive' } }];
  const [rows, total, newTotal, badges] = await Promise.all([
    prisma.botEvent.findMany({ where, orderBy: { id: 'desc' }, skip: (f.page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.botEvent.count({ where }),
    prisma.botEvent.count({ where: { status: 'new_' } }),
    recyclingNavBadges(),
  ]);
  const done = str(sp.done);
  const hidden = (
    <>
      <input type="hidden" name="status" value={f.status} />
      <input type="hidden" name="source" value={f.source} />
      <input type="hidden" name="severity" value={f.severity} />
      <input type="hidden" name="q" value={f.q} />
      <input type="hidden" name="page" value={f.page} />
    </>
  );
  const filtered = !!(f.source || f.severity || f.q || f.status !== 'new_');

  return (
    <>
      <PageHeader title="Hodisalar">
        <form action={markAllEventsAction}>
          {hidden}
          <button className="btn-ghost px-4 py-2 text-sm" disabled={!newTotal}>✓ Hammasini ko'rildi{f.source || f.severity || f.q ? ' (filtr bo\'yicha)' : ''}</button>
        </form>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <Notice show={done != null}>{Number(done) || 0} ta hodisa ko'rildi deb belgilandi.</Notice>
      <p className="mb-4 text-sm text-slate-500">
        Botlar va sayt yozgan hodisalar jurnali: arizalar, tortishlar, to'lovlar, kirish so'rovlari, xatolar. Boshqaruv botidagi rahbariyatga ham shu hodisalar boradi. Yangi: <b>{newTotal}</b>.
      </p>
      <form className="card mb-4 flex flex-wrap items-end gap-2 p-3">
        <input name="q" defaultValue={f.q} placeholder="Sarlavha, matn yoki tur" className="input max-w-xs" />
        <select name="status" defaultValue={f.status} className="input w-auto">
          {(['new_', 'processed', 'all'] as StatusFilter[]).map((s) => <option key={s} value={s}>{statusFilterLabels[s]}</option>)}
        </select>
        <select name="source" defaultValue={f.source} className="input w-auto">
          <option value="">Barcha manbalar</option>
          {SOURCES.map((s) => <option key={s} value={s}>{sourceLabels[s]}</option>)}
        </select>
        <select name="severity" defaultValue={f.severity} className="input w-auto">
          <option value="">Barcha darajalar</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{severityLabels[s]}</option>)}
        </select>
        <button className="btn-ghost px-4 py-2 text-sm">Qidirish</button>
        {filtered && <Link href="/admin/recycling/events" className="btn-ghost px-3 py-2 text-sm">Tozalash</Link>}
        <span className="ml-auto text-sm text-slate-500">Jami: <b>{total}</b></span>
      </form>
      <Table head={['Sana', 'Manba', 'Hodisa', 'Daraja', "Bog'liq", 'Holat', 'Amal']} empty={!rows.length}>
        {rows.map((e) => (
          <tr key={e.id} className={`hover:bg-slate-50 ${e.status === 'new_' ? '' : 'text-slate-500'}`}>
            <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{formatDate(e.createdAt, 'uz', true)}<span className="block text-slate-400">#{e.id}</span></td>
            <td className="whitespace-nowrap px-4 py-2 text-sm">{sourceLabels[e.sourceBot]}<span className="block font-mono text-[11px] text-slate-400">{e.eventType}</span></td>
            <td className="max-w-md px-4 py-2 text-sm"><span className={e.status === 'new_' ? 'font-semibold' : 'font-medium'}>{e.title}</span>{e.message && <span className="block whitespace-pre-wrap text-xs text-slate-500">{e.message.length > 300 ? `${e.message.slice(0, 300)}…` : e.message}</span>}</td>
            <td className="px-4 py-2"><Badge tone={severityTone[e.severity]}>{severityLabels[e.severity]}</Badge></td>
            <td className="whitespace-nowrap px-4 py-2 text-xs">
              {e.requestId && <Link href={`/admin/recycling/requests/${e.requestId}`} className="block text-brand-500 hover:underline">Ariza #{e.requestId}</Link>}
              {e.driverId && <Link href={`/admin/recycling/drivers/${e.driverId}`} className="block text-brand-500 hover:underline">Haydovchi #{e.driverId}</Link>}
              {e.supervisorId && <Link href={`/admin/recycling/supervisors/${e.supervisorId}`} className="block text-brand-500 hover:underline">Masul #{e.supervisorId}</Link>}
              {e.entityType === 'BotAccessRequest' && <Link href="/admin/recycling/access" className="block text-brand-500 hover:underline">Kirish so'rovi</Link>}
              {!e.requestId && !e.driverId && !e.supervisorId && e.entityType !== 'BotAccessRequest' && <span className="text-slate-400">—</span>}
            </td>
            <td className="px-4 py-2">{e.status === 'new_' ? <Badge tone="red">Yangi</Badge> : <Badge tone="slate">Ko'rildi</Badge>}</td>
            <td className="px-4 py-2">
              {e.status === 'new_' && (
                <form action={markEventAction}>{hidden}<input type="hidden" name="id" value={e.id} /><button className="btn-ghost px-3 py-1 text-xs">Ko'rildi</button></form>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <Pager page={f.page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(n) => eventsUrl({ ...f, page: n })} />
    </>
  );
}
