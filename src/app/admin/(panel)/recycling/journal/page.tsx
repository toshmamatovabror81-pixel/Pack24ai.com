import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { str, type SearchParams } from '@/lib/params';
import { dateKey, todayTashkent } from '@/lib/recycling/journal';
import { Notice, PageHeader, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { recyclingNavBadges } from '../events/navBadges';
import { monthGridRange } from './data';
import { dayUrl, kg, money, MONTHS, monthKey, monthUrl, parseMonth, parseScope, scopeValue, WEEKDAYS, type DayTotals, type JournalScope } from './shared';

export const metadata = { title: 'Kunlik jurnal' };
export const dynamic = 'force-dynamic';

const hasData = (d: DayTotals) => d.opening != null || d.intakeCount > 0 || d.pressedKg > 0 || d.bales > 0 || d.expense > 0 || d.advance > 0 || d.salesCount > 0;

export default async function JournalPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const [points, supervisors, badges] = await Promise.all([
    prisma.recyclePoint.findMany({ orderBy: { id: 'asc' }, select: { id: true, cityUz: true, regionUz: true } }),
    prisma.supervisor.findMany({ orderBy: [{ isActive: 'desc' }, { id: 'asc' }], select: { id: true, name: true, isActive: true, point: { select: { cityUz: true } } } }),
    recyclingNavBadges(),
  ]);
  const scope: JournalScope | null = parseScope(sp) ?? (points[0] ? { pointId: points[0].id } : supervisors[0] ? { supervisorId: supervisors[0].id } : null);
  const today = todayTashkent();
  const { year, month } = parseMonth(str(sp.month)) ?? { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 };
  const mk = monthKey(year, month);
  // Kun oralig'i bilan: vaqt belgili qatorlar (bazaga olib kelish qabuli) ham o'z Toshkent kuniga tushadi
  const days = scope ? await monthGridRange(scope, year, month) : [];

  const scopeTitle = !scope ? '—'
    : 'supervisorId' in scope
      ? (() => { const s = supervisors.find((x) => x.id === scope.supervisorId); return s ? `Masul: ${s.name}${s.point ? ` (${s.point.cityUz})` : ''}` : `Masul #${scope.supervisorId}`; })()
      : (() => { const p = points.find((x) => x.id === scope.pointId); return p ? `Punkt: ${p.cityUz} (${p.regionUz})` : `Punkt #${scope.pointId}`; })();

  const totals = days.reduce(
    (t, d) => ({ intakeKg: t.intakeKg + d.intakeKg, intakeSum: t.intakeSum + d.intakeSum, pressedKg: t.pressedKg + d.pressedKg, bales: t.bales + d.bales, expense: t.expense + d.expense, advance: t.advance + d.advance, salesKg: t.salesKg + d.salesKg, salesSum: t.salesSum + d.salesSum }),
    { intakeKg: 0, intakeSum: 0, pressedKg: 0, bales: 0, expense: 0, advance: 0, salesKg: 0, salesSum: 0 },
  );
  const prev = month === 1 ? monthKey(year - 1, 12) : monthKey(year, month - 1);
  const next = month === 12 ? monthKey(year + 1, 1) : monthKey(year, month + 1);
  const todayKey = dateKey(today);
  const activeDays = days.filter(hasData).length;

  return (
    <>
      <PageHeader title="Kunlik jurnal">
        {scope && <Link href={dayUrl(scope, todayKey)} className="btn-primary px-4 py-2 text-sm">Bugungi kun</Link>}
      </PageHeader>
      <RecyclingNav badges={badges} />
      <Notice show={!points.length && !supervisors.length} tone="warn">Avval punkt va masul yarating — jurnal masul bo'yicha yuritiladi.</Notice>
      <p className="mb-4 text-sm text-slate-500">
        Masul kunlik jurnali: qabul (qo'lda yozilgan makulatura), press, xarajat/avans, sotuv va kassa ochilishi. Kun yakuni = ochilish + sotuv − qabul − xarajat − avans. Kunga bosib yozuvlarni tahrirlang.
      </p>
      <form className="card mb-4 flex flex-wrap items-end gap-2 p-3">
        <label className="text-xs text-slate-500">
          Punkt yoki masul
          <select name="scope" defaultValue={scope ? scopeValue(scope) : ''} className="input w-auto py-2">
            <optgroup label="Punktlar">
              {points.map((p) => <option key={`p${p.id}`} value={`p:${p.id}`}>{p.cityUz} ({p.regionUz})</option>)}
            </optgroup>
            <optgroup label="Masullar">
              {supervisors.map((s) => <option key={`s${s.id}`} value={`s:${s.id}`}>{s.name}{s.point ? ` · ${s.point.cityUz}` : ''}{s.isActive ? '' : ' (nofaol)'}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Oy
          <input type="month" name="month" defaultValue={mk} className="input w-auto py-2" />
        </label>
        <button className="btn-ghost px-4 py-2 text-sm">Ko'rsatish</button>
        {scope && (
          <span className="ml-auto flex items-center gap-2 text-sm">
            <Link href={monthUrl(scope, prev)} className="btn-ghost px-3 py-1.5">←</Link>
            <b>{MONTHS[month - 1]} {year}</b>
            <Link href={monthUrl(scope, next)} className="btn-ghost px-3 py-1.5">→</Link>
          </span>
        )}
      </form>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{scopeTitle}</span>
        <span className="text-slate-500">Yozuvli kunlar: <b>{activeDays}</b> / {days.length}</span>
      </div>
      <Table head={['Kun', 'Ochilish', 'Qabul, kg', "Qabul, so'm", 'Press, kg', 'Toy', 'Xarajat', 'Avans', 'Sotuv, kg', "Sotuv, so'm", 'Yakun']} empty={!days.length}>
        {days.map((d) => {
          const k = dateKey(d.date);
          const has = hasData(d);
          const isToday = k === todayKey;
          return (
            <tr key={k} className={`${has ? '' : 'text-slate-400'} ${isToday ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
              <td className="whitespace-nowrap px-4 py-2">
                {scope ? <Link href={dayUrl(scope, k)} className="font-semibold text-brand-500 hover:underline">{String(d.date.getUTCDate()).padStart(2, '0')} <span className="text-xs font-normal text-slate-400">{WEEKDAYS[d.date.getUTCDay()]}</span></Link> : d.date.getUTCDate()}
                {isToday && <span className="ml-1 text-xs text-amber-700">bugun</span>}
              </td>
              <td className="px-4 py-2 text-right">{money(d.opening)}</td>
              <td className="px-4 py-2 text-right">{d.intakeCount ? kg(d.intakeKg) : '—'}</td>
              <td className="px-4 py-2 text-right">{d.intakeCount ? money(d.intakeSum) : '—'}</td>
              <td className="px-4 py-2 text-right">{d.pressedKg ? kg(d.pressedKg) : '—'}</td>
              <td className="px-4 py-2 text-right">{d.bales || '—'}</td>
              <td className="px-4 py-2 text-right">{d.expense ? money(d.expense) : '—'}</td>
              <td className="px-4 py-2 text-right">{d.advance ? money(d.advance) : '—'}</td>
              <td className="px-4 py-2 text-right">{d.salesCount ? kg(d.salesKg) : '—'}</td>
              <td className="px-4 py-2 text-right">{d.salesCount ? money(d.salesSum) : '—'}</td>
              <td className={`px-4 py-2 text-right font-semibold ${d.closing != null && d.closing < 0 ? 'text-red-600' : ''}`}>{money(d.closing)}</td>
            </tr>
          );
        })}
        {days.length > 0 && (
          <tr className="bg-slate-50 font-semibold">
            <td className="px-4 py-2">Jami</td>
            <td className="px-4 py-2 text-right text-slate-400">—</td>
            <td className="px-4 py-2 text-right">{kg(totals.intakeKg)}</td>
            <td className="px-4 py-2 text-right">{money(totals.intakeSum)}</td>
            <td className="px-4 py-2 text-right">{kg(totals.pressedKg)}</td>
            <td className="px-4 py-2 text-right">{totals.bales}</td>
            <td className="px-4 py-2 text-right">{money(totals.expense)}</td>
            <td className="px-4 py-2 text-right">{money(totals.advance)}</td>
            <td className="px-4 py-2 text-right">{kg(totals.salesKg)}</td>
            <td className="px-4 py-2 text-right">{money(totals.salesSum)}</td>
            <td className="px-4 py-2 text-right text-slate-400">—</td>
          </tr>
        )}
      </Table>
      <p className="mt-2 text-xs text-slate-400">Summalar so'mda. Yakun faqat kassa ochilishi kiritilgan kunlarda hisoblanadi{scope && 'pointId' in scope ? '; punkt ko\'rinishida ochilish — barcha masullar ochilishlari yig\'indisi' : ''}.</p>
    </>
  );
}
