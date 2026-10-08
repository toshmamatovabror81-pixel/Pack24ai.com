import Link from 'next/link';
import type { LeadStatus, LeadType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate } from '@/lib/format';
import { str } from '@/lib/params';
import { PageHeader, Pager } from '@/components/admin/ui';
import { leadStatusBadge, leadStatusNames, leadTypeNames } from '@/components/admin/status';
import { updateLead } from './actions';

export const metadata = { title: 'Arizalar' };
const PER_PAGE = 30;

const detailNames: Record<string, string> = { product: 'Mahsulot', size: "O'lcham", quantity: 'Soni', logo: 'Logotip', address: 'Manzil', volume: 'Hajm, kg' };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('leads');
  const sp = await searchParams;
  const type = str(sp.type) as LeadType | undefined;
  const status = str(sp.status) as LeadStatus | undefined;
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const where: Prisma.LeadWhereInput = {};
  if (type && type in leadTypeNames) where.type = type;
  if (status && status in leadStatusNames) where.status = status;
  const [leads, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.lead.count({ where }),
  ]);
  return (
    <>
      <PageHeader title={`Arizalar (${total})`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="type" defaultValue={type ?? ''} className="input w-auto">
          <option value="">Barcha turlar</option>
          {Object.entries(leadTypeNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ''} className="input w-auto">
          <option value="">Barcha holatlar</option>
          {Object.entries(leadStatusNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-ghost px-4 py-2 text-sm">Filtr</button>
      </form>
      {leads.length === 0 && <p className="card p-6 text-center text-slate-500">Hozircha arizalar yo'q</p>}
      <div className="space-y-3">
        {leads.map((l) => {
          const details = Object.entries((l.details ?? {}) as Record<string, string>);
          return (
            <details key={l.id} className="card p-4" open={str(sp.open) === String(l.id) || l.status === 'new_'}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="font-semibold">#{l.id}</span>
                <span className="text-sm text-slate-500">{formatDate(l.createdAt, 'uz', true)}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{leadTypeNames[l.type]}</span>
                <span className="font-medium">{l.name}{l.company && `, ${l.company}`}</span>
                <a href={`tel:+${l.phone}`} className="text-brand-500">{displayPhone(l.phone)}</a>
                <span className="ml-auto">{leadStatusBadge(l.status)}</span>
              </summary>
              <div className="mt-3 grid gap-4 md:grid-cols-[1fr_320px]">
                <div className="space-y-1 text-sm">
                  {details.map(([k, v]) => <p key={k}><span className="text-slate-500">{detailNames[k] ?? k}:</span> {v}</p>)}
                  {l.message && <p className="whitespace-pre-line rounded bg-slate-50 p-3">{l.message}</p>}
                  {l.productId && <p><Link href={`/admin/products/${l.productId}`} className="text-brand-500">Mahsulot #{l.productId}</Link></p>}
                  {l.utmSource && <p className="text-xs text-slate-500">Manba: {[l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(' / ')}</p>}
                  <p><Link href={`/admin/customers/${l.phone}`} className="text-xs text-brand-500">Mijoz kartasi →</Link></p>
                </div>
                <form action={updateLead} className="space-y-2">
                  <input type="hidden" name="id" value={l.id} />
                  <select name="status" defaultValue={l.status} className="input">
                    {Object.entries(leadStatusNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <textarea name="managerNote" defaultValue={l.managerNote ?? ''} rows={2} placeholder="Menejer izohi" className="input" />
                  <button className="btn-primary w-full py-2 text-sm">Saqlash</button>
                </form>
              </div>
            </details>
          );
        })}
      </div>
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(n) => `/admin/leads?${new URLSearchParams({ ...(type ? { type } : {}), ...(status ? { status } : {}), page: String(n) })}`} />
    </>
  );
}
