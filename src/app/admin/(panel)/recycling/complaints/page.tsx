import Link from 'next/link';
import type { ComplaintStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate } from '@/lib/format';
import { str, type SearchParams } from '@/lib/params';
import { Badge, PageHeader, Pager, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { ComplaintBadge, complaintStatusLabels, RequestStatusBadge } from '@/components/admin/recycling/badges';
import { recyclingNavBadges } from '../events/navBadges';

export const metadata = { title: 'Shikoyatlar' };
export const dynamic = 'force-dynamic';
const PER_PAGE = 30;

const STATUSES: ComplaintStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
type Filter = ComplaintStatus | 'active' | 'all';
const filterLabels: Record<Filter, string> = { active: "Faol (ochiq + ko'rilmoqda)", open: complaintStatusLabels.open, in_progress: complaintStatusLabels.in_progress, resolved: complaintStatusLabels.resolved, closed: complaintStatusLabels.closed, all: 'Hammasi' };

function LevelBadge({ level }: { level: 'supervisor' | 'director' }) {
  return level === 'director' ? <Badge tone="red">Direktor</Badge> : <Badge tone="blue">Masul</Badge>;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export default async function ComplaintsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const raw = str(sp.status);
  const filter: Filter = raw === 'all' || raw === 'active' || STATUSES.includes(raw as ComplaintStatus) ? (raw as Filter) : 'active';
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const where: Prisma.RecycleComplaintWhereInput = filter === 'all' ? {} : filter === 'active' ? { status: { in: ['open', 'in_progress'] } } : { status: filter };
  const [rows, total, badges, counts] = await Promise.all([
    prisma.recycleComplaint.findMany({ where, orderBy: [{ createdAt: 'desc' }], skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { request: { select: { id: true, status: true, name: true, phone: true, point: { select: { cityUz: true } }, supervisor: { select: { name: true } } } } } }),
    prisma.recycleComplaint.count({ where }),
    recyclingNavBadges(),
    prisma.recycleComplaint.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const countBy = new Map(counts.map((c) => [c.status, c._count._all]));
  const hrefFor = (n: number) => `/admin/recycling/complaints?status=${filter}&page=${n}`;

  return (
    <>
      <PageHeader title={`Shikoyatlar (${total})`} />
      <RecyclingNav badges={badges} />
      <p className="mb-4 text-sm text-slate-500">
        Mijoz tortish natijasiga rozi bo'lmasa yoki botdan shikoyat yuborsa shu yerga tushadi. Avval masul darajasida hal qilinadi; hal bo'lmasa «Direktorga ko'tarish» — HQ adminlarga xabar boradi.
      </p>
      <form className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <select name="status" defaultValue={filter} className="input w-auto py-2">
          {(['active', 'open', 'in_progress', 'resolved', 'closed', 'all'] as Filter[]).map((f) => <option key={f} value={f}>{filterLabels[f]}</option>)}
        </select>
        <button className="btn-ghost px-4 py-2 text-sm">Ko'rsatish</button>
        <span className="ml-auto flex flex-wrap gap-3 text-xs text-slate-500">
          {STATUSES.map((s) => <span key={s}>{complaintStatusLabels[s]}: <b>{countBy.get(s) ?? 0}</b></span>)}
        </span>
      </form>
      <Table head={['#', 'Ariza', 'Mijoz', 'Daraja', 'Shikoyat', 'Sana', 'Holat', 'Javob', 'Amal']} empty={!rows.length}>
        {rows.map((c) => (
          <tr key={c.id} className={`hover:bg-slate-50 ${c.status === 'open' ? 'bg-red-50/40' : ''}`}>
            <td className="px-4 py-3"><Link href={`/admin/recycling/complaints/${c.id}`} className="font-semibold text-brand-500">#{c.id}</Link></td>
            <td className="px-4 py-3">
              <Link href={`/admin/recycling/requests/${c.requestId}`} className="font-medium text-brand-500 hover:underline">Ariza #{c.requestId}</Link>
              <span className="block"><RequestStatusBadge status={c.request.status} /></span>
              <span className="block text-xs text-slate-500">{c.request.point.cityUz}{c.request.supervisor ? ` · ${c.request.supervisor.name}` : ''}</span>
            </td>
            <td className="px-4 py-3">{c.fromName}<br /><a href={`tel:+${c.fromPhone}`} className="text-xs text-brand-500">{displayPhone(c.fromPhone)}</a></td>
            <td className="px-4 py-3"><LevelBadge level={c.level} /></td>
            <td className="max-w-xs px-4 py-3 text-sm">{cut(c.message, 140)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(c.createdAt, 'uz', true)}</td>
            <td className="px-4 py-3"><ComplaintBadge status={c.status} /></td>
            <td className="max-w-xs px-4 py-3 text-sm">{c.response ? <>{cut(c.response, 100)}<span className="block text-xs text-slate-500">{c.respondedBy}{c.resolvedAt ? ` · ${formatDate(c.resolvedAt, 'uz', true)}` : ''}</span></> : <span className="text-slate-400">—</span>}</td>
            <td className="px-4 py-3"><Link href={`/admin/recycling/complaints/${c.id}`} className="btn-ghost px-3 py-1 text-xs">{c.status === 'open' || c.status === 'in_progress' ? 'Javob berish' : 'Ochish'}</Link></td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={hrefFor} />
    </>
  );
}
