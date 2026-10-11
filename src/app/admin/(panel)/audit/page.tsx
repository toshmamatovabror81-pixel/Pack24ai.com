import Link from 'next/link';
import { reportChecks, reportSummary, type Severity } from '@/lib/ai/audit';
import { aiConfigured, aiDailyLimit, aiModel } from '@/lib/ai/client';
import { requireStaff } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { str } from '@/lib/params';
import { tashkentClock } from '@/lib/tashkent';
import { Badge, Notice, PageHeader, Table } from '@/components/admin/ui';
import { runAuditNow } from './actions';

export const metadata = { title: 'AI tekshiruv' };

const severity: Record<Severity, { label: string; tone: 'red' | 'amber' | 'slate' }> = {
  high: { label: 'Muhim', tone: 'red' },
  medium: { label: "O'rta", tone: 'amber' },
  low: { label: 'Past', tone: 'slate' },
};
const num = (n: number) => new Intl.NumberFormat('ru-RU').format(n);

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('reports');
  const sp = await searchParams;
  const n = Number(str(sp.id));
  const id = Number.isSafeInteger(n) && n > 0 && n < 2 ** 31 ? n : null;
  const { day } = tashkentClock(new Date());
  const [chosen, history, today, month] = await Promise.all([
    id ? prisma.auditReport.findUnique({ where: { id } }) : null,
    prisma.auditReport.findMany({ orderBy: { id: 'desc' }, take: 20 }),
    prisma.aiUsage.findUnique({ where: { day } }),
    prisma.aiUsage.aggregate({ where: { day: { startsWith: day.slice(0, 7) } }, _sum: { requests: true, inputTokens: true, outputTokens: true } }),
  ]);
  const report = chosen ?? history[0] ?? null;
  const checks = report ? reportChecks(report.checks) : [];
  const summary = report ? reportSummary(report.summary) : null;
  const configured = aiConfigured();
  return (
    <>
      <PageHeader title="AI tekshiruv">
        <form action={runAuditNow}><button className="btn-primary px-4 py-2 text-sm">Hozir tekshirish</button></form>
      </PageHeader>
      <Notice show={sp.done === '1'}>Tekshiruv bajarildi.</Notice>
      <Notice show={sp.wait === '1'} tone="warn">Tekshiruv hozirgina bajarilgan. Bir daqiqadan keyin qayta urinib ko&apos;ring.</Notice>

      <section className="card mb-6 p-5 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          {configured ? <Badge tone="green">Ulangan</Badge> : <Badge tone="amber">Sozlanmagan</Badge>}
          <h2 className="font-semibold">Sun&apos;iy intellekt (Claude)</h2>
          {configured && <span className="text-slate-500">model: {aiModel()}</span>}
        </div>
        {configured ? (
          <p className="mt-2 text-slate-600">
            Bugun: {num(today?.requests ?? 0)} / {num(aiDailyLimit())} so&apos;rov. Shu oy: {num(month._sum.requests ?? 0)} so&apos;rov,{' '}
            {num((month._sum.inputTokens ?? 0) + (month._sum.outputTokens ?? 0))} token. Aniq xarajat Anthropic kabinetida (console.anthropic.com → Usage) ko&apos;rinadi.
          </p>
        ) : (
          <p className="mt-2 text-slate-600">
            Tekshiruv AI&apos;siz ham ishlaydi: quyidagi ro&apos;yxat bazadagi aniq qoidalar bo&apos;yicha tuziladi. AI xulosasi (nima birinchi navbatda qilinishi kerak)
            va mijoz botidagi savol-javob yordamchisi uchun serverda <code>deploy/ai-setup.sh</code> ishga tushiriladi.
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Har kuni soat 08:00 dan keyin avtomatik bajariladi va natija boshqaruv botiga yuboriladi. AI&apos;ga faqat sonlar hamda buyurtma va hisob-faktura
          raqamlari yuboriladi — mijoz ismi, telefoni va manzili yuborilmaydi.
        </p>
      </section>

      {!report && <p className="card p-6 text-center text-slate-500">Hali tekshiruv o&apos;tkazilmagan. «Hozir tekshirish» tugmasini bosing.</p>}

      {report && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold">
            {formatDate(report.createdAt, 'uz', true)} · {report.trigger === 'cron' ? 'avtomatik' : "qo'lda"} · {checks.length ? `${checks.length} ta topilma` : 'muammo topilmadi'}
          </h2>
          {summary && (
            <div className="card mb-4 border-l-4 border-brand-500 p-5">
              <p className="font-medium">{summary.headline}</p>
              <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
                {summary.priorities.map((p, i) => (
                  <li key={i}>
                    <span className="font-semibold">{p.title}</span>
                    {p.why && <span className="text-slate-600"> — {p.why}</span>}
                    {p.action && <p className="mt-1">{p.action}</p>}
                  </li>
                ))}
              </ol>
              {summary.note && <p className="mt-3 text-sm text-slate-600">💡 {summary.note}</p>}
              <p className="mt-3 text-xs text-slate-400">Xulosani sun&apos;iy intellekt yozgan{report.model ? ` (${report.model})` : ''}; raqamlar pastdagi ro&apos;yxatdan olinadi.</p>
            </div>
          )}
          {checks.length === 0 && <p className="card p-6 text-center text-emerald-700">✅ Hammasi joyida: e&apos;tibor talab qiladigan narsa topilmadi.</p>}
          <div className="space-y-3">
            {checks.map((c) => (
              <div key={c.key} className="card p-4 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={severity[c.severity].tone}>{severity[c.severity].label}</Badge>
                  <span className="font-medium">{c.title}</span>
                  <span className="font-bold">{num(c.count)}</span>
                  <Link href={c.link} className="ml-auto text-brand-500 hover:underline">Ochish →</Link>
                </div>
                {c.items.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-slate-600">
                    {c.items.map((it, i) => <li key={`${i}:${it}`}>• {it}</li>)}
                    {c.count > c.items.length && <li className="text-slate-400">… yana {num(c.count - c.items.length)} ta</li>}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {history.length > 1 && (
        <section>
          <h2 className="mb-2 font-semibold">Oldingi tekshiruvlar</h2>
          <Table head={['Sana', 'Turi', 'Topilmalar', 'Muhim', 'AI xulosa', '']}>
            {history.map((r) => {
              const list = reportChecks(r.checks);
              return (
                <tr key={r.id} className={r.id === report?.id ? 'bg-slate-50' : ''}>
                  <td className="whitespace-nowrap px-4 py-2">{formatDate(r.createdAt, 'uz', true)}</td>
                  <td className="px-4 py-2">{r.trigger === 'cron' ? 'Avtomatik' : "Qo'lda"}</td>
                  <td className="px-4 py-2">{list.length}</td>
                  <td className="px-4 py-2">{list.filter((c) => c.severity === 'high').length}</td>
                  <td className="px-4 py-2">{r.summary ? 'Bor' : '—'}</td>
                  <td className="px-4 py-2 text-right"><Link href={`/admin/audit?id=${r.id}`} className="text-brand-500 hover:underline">Ko&apos;rish</Link></td>
                </tr>
              );
            })}
          </Table>
        </section>
      )}
    </>
  );
}
