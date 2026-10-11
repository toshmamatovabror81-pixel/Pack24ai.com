import Link from 'next/link';
import { reportChecks, reportSummary, type Severity } from '@/lib/ai/audit';
import { aiConfigured, aiDailyLimit, aiModel } from '@/lib/ai/client';
import { requireStaff } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { alertChats, readOps } from '@/lib/ops';
import { str } from '@/lib/params';
import { tashkentClock } from '@/lib/tashkent';
import { botToken } from '@/lib/telegram/bots';
import { outboxStats } from '@/lib/telegram/outbox';
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
  const [chosen, history, today, month, ops, queue, recipients] = await Promise.all([
    id ? prisma.auditReport.findUnique({ where: { id } }) : null,
    prisma.auditReport.findMany({ orderBy: { id: 'desc' }, take: 20 }),
    prisma.aiUsage.findUnique({ where: { day } }),
    prisma.aiUsage.aggregate({ where: { day: { startsWith: day.slice(0, 7) } }, _sum: { requests: true, inputTokens: true, outputTokens: true } }),
    readOps().catch(() => null),
    outboxStats().catch(() => null),
    alertChats().catch(() => null),
  ]);
  const report = chosen ?? history[0] ?? null;
  const checks = report ? reportChecks(report.checks) : [];
  const summary = report ? reportSummary(report.summary) : null;
  const configured = aiConfigured();
  const staffBot = !!botToken('staff');
  // Belgi faqat signal kelayotganini emas, faktlarning o'zini ham ko'rsatadi (chegaralar deploy/watchdog.sh xabar beradiganlari bilan bir xil)
  const f = ops?.state;
  const bad = {
    disk: !!f && f.disk >= 90,
    backup: !!f && (f.backupAgeH < 0 || f.backupAgeH >= 30),
    restore: f?.restoreOk === 0,
    offsite: f?.offsiteOk === 0,
    cert: !!f && f.certDays >= 0 && f.certDays < 14,
    site: f?.siteOk === 0,
    tick: f?.tickOk === 0,
  };
  const anyBad = Object.values(bad).some(Boolean);
  // Eskirgan holatda satrlar ajratilmaydi: ular hozirgi holat emas
  const mark = (on: boolean) => (on && !ops?.stale ? 'font-medium text-red-700' : undefined);
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

      <section className="card mb-6 p-5 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          {!ops ? <Badge tone="slate">Ma&apos;lumot yo&apos;q</Badge> : ops.stale ? <Badge tone="amber">Signal kelmayapti</Badge> : anyBad ? <Badge tone="red">Muammo bor</Badge> : <Badge tone="green">Kuzatuvda</Badge>}
          <h2 className="font-semibold">Server holati</h2>
          {ops && <span className="text-slate-500">oxirgi signal: {formatDate(ops.state.at, 'uz', true)}</span>}
        </div>
        {ops?.stale && <p className="mt-2 text-xs text-slate-500">Quyidagilar — oxirgi ma&apos;lum holat, hozirgi holat emas.</p>}
        {ops ? (
          <ul className={`mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 ${ops.stale ? 'text-slate-400' : 'text-slate-600'}`}>
            <li className={mark(bad.disk)}>Disk: {ops.state.disk >= 0 ? `${ops.state.disk}% band` : 'aniqlanmadi'}</li>
            <li className={mark(bad.backup)}>Oxirgi zaxira nusxa: {ops.state.backupAgeH >= 0 ? `${ops.state.backupAgeH} soat oldin` : 'topilmadi'}</li>
            <li className={mark(bad.restore)}>Zaxirani tiklash sinovi: {ops.state.restoreOk === 1 ? "o'tdi" : ops.state.restoreOk === 0 ? "o'tmadi" : "hali o'tkazilmagan"}</li>
            <li className={mark(bad.offsite)}>Serverdan tashqaridagi nusxa: {ops.state.offsiteOk === 1 ? 'yuborilmoqda' : ops.state.offsiteOk === 0 ? 'yuborilmadi' : 'yoqilmagan (deploy/offsite-setup.sh)'}</li>
            <li className={mark(bad.cert)}>HTTPS sertifikat: {ops.state.certDays === 0 ? 'muddati tugagan yoki bugun tugaydi' : ops.state.certDays > 0 ? `${ops.state.certDays} kun qoldi` : 'aniqlanmadi'}</li>
            <li className={mark(bad.site)}>Sayt internetdan: {ops.state.siteOk === 1 ? 'ochilyapti' : 'ochilmayapti'}</li>
            <li className={mark(bad.tick)}>Davriy ishlar signali: {ops.state.tickOk === 1 ? "o'tyapti" : "o'tmayapti"}</li>
          </ul>
        ) : (
          <p className="mt-2 text-slate-600">Server kuzatuvi (deploy/watchdog.sh) hali signal yubormagan. U avtomatik yangilanish bilan birga har 5 daqiqada ishlaydi.</p>
        )}
        {queue && (
          <p className="mt-2 text-slate-600">
            Bot xabarlari navbati: {num(queue.pending)} ta kutmoqda{queue.stuck > 0 ? ` (${num(queue.stuck)} tasi bir soatdan ortiq)` : ''}, oxirgi 24 soatda {num(queue.failed24h)} ta yetkazilmadi.
          </p>
        )}
        {!staffBot ? (
          <p className="mt-2 text-xs text-amber-700">
            Boshqaruv boti hali ulanmagan — muammo chiqsa Telegram xabari yuborilmaydi, u faqat server logiga yoziladi. Botni serverda deploy/bots-setup.sh bilan ulang.
          </p>
        ) : recipients && recipients.length === 0 ? (
          <p className="mt-2 text-xs text-amber-700">
            Hozircha xabar oladigan administrator yo&apos;q — muammo chiqsa Telegram xabari hech kimga bormaydi.{' '}
            <Link href="/admin/staff" className="underline">Xodimlar</Link> bo&apos;limida administrator hisobini boshqaruv botiga ulang.
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Sayt, disk, zaxira yoki sertifikatda muammo chiqsa boshqaruv botiga ulangan administratorlarga{recipients ? ` (${recipients.length} kishi)` : ''} Telegram orqali darhol xabar boradi.
          </p>
        )}
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
