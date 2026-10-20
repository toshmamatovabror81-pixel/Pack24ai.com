import type { ReviewStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { str } from '@/lib/params';
import { Badge, PageHeader } from '@/components/admin/ui';
import { moderateReview } from '../marketing-actions';

export const metadata = { title: 'Sharhlar' };
const names: Record<ReviewStatus, string> = { pending: 'Kutmoqda', approved: 'Tasdiqlangan', rejected: 'Rad etilgan' };

export default async function ReviewsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('marketing');
  const status = (str((await searchParams).status) as ReviewStatus | undefined) ?? 'pending';
  const reviews = await prisma.review.findMany({ where: { status: status in names ? status : 'pending' }, orderBy: { createdAt: 'desc' }, take: 100 });
  return (
    <>
      <PageHeader title="Sharhlar" />
      <div className="mb-4 flex gap-2 text-sm">
        {(Object.keys(names) as ReviewStatus[]).map((s) => (
          <a key={s} href={`/admin/reviews?status=${s}`} className={`rounded-lg px-3 py-1.5 ${s === status ? 'bg-brand-500 text-white' : 'bg-white hover:bg-slate-200'}`}>{names[s]}</a>
        ))}
      </div>
      {reviews.length === 0 && <p className="card p-6 text-center text-slate-500">Bo&apos;sh</p>}
      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{r.authorName}</span>
              {r.company && <span className="text-sm text-slate-500">{r.company}</span>}
              <Badge tone="amber">{'★'.repeat(r.rating)}</Badge>
              <span className="text-xs text-slate-400">{formatDate(r.createdAt, 'uz', true)}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{r.text}</p>
            <form action={moderateReview} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={r.id} />
              {r.status !== 'approved' && <button name="action" value="approved" className="btn-primary px-3 py-1.5 text-sm">Tasdiqlash</button>}
              {r.status !== 'rejected' && <button name="action" value="rejected" className="btn-ghost px-3 py-1.5 text-sm">Rad etish</button>}
              <button name="action" value="delete" className="btn-ghost px-3 py-1.5 text-sm text-accent-600">O&apos;chirish</button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
