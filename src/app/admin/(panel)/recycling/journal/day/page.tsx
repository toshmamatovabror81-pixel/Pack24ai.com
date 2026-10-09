import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { toNumber } from '@/lib/format';
import { str, type SearchParams } from '@/lib/params';
import { dateKey, dateLabel, parseJournalDate, todayTashkent } from '@/lib/recycling/journal';
import { Notice, PageHeader, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { ConfirmButton } from '@/components/admin/recycling/ConfirmButton';
import { recyclingNavBadges } from '../../events/navBadges';
import { addEntryAction, deleteEntryAction, updateEntryAction } from '../actions';
import { dayEntriesRange } from '../data';
import { dayUrl, hasTime, kg, money, monthKey, monthUrl, parseScope, summarize, tashkentKey, WEEKDAYS, type JournalScope } from '../shared';

export const metadata = { title: 'Jurnal — kun' };
export const dynamic = 'force-dynamic';

type Kind = 'intake' | 'press' | 'expense' | 'sales' | 'cash';
type Sup = { id: number; name: string; isActive: boolean };

/** Qaytish manzili uchun yashirin maydonlar (sahifa sanasi + ko'rinish) */
function ScopeFields({ scope, date }: { scope: JournalScope; date: string }) {
  return (
    <>
      <input type="hidden" name="scopeDate" value={date} />
      {'supervisorId' in scope ? <input type="hidden" name="scopeSupervisorId" value={scope.supervisorId} /> : <input type="hidden" name="scopePointId" value={scope.pointId} />}
    </>
  );
}

/** Qator amallari: tahrir formasi (boshqa kataklardagi input'lar form="u-..." bilan bog'lanadi) va o'chirish */
function RowActions({ kind, id, scope, date }: { kind: Kind; id: number; scope: JournalScope; date: string }) {
  return (
    <td className="whitespace-nowrap px-3 py-2 text-right">
      <form id={`u-${kind}-${id}`} action={updateEntryAction} className="inline">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <ScopeFields scope={scope} date={date} />
        <button className="btn-ghost px-3 py-1 text-xs">Saqlash</button>
      </form>{' '}
      <form id={`d-${kind}-${id}`} action={deleteEntryAction} className="inline">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <ScopeFields scope={scope} date={date} />
        <ConfirmButton message="Yozuv o'chirilsinmi? Qaytarib bo'lmaydi." className="btn-ghost px-3 py-1 text-xs text-red-600">O'chirish</ConfirmButton>
      </form>
    </td>
  );
}

const L = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="text-xs text-slate-500">{label}<span className="block">{children}</span></label>;

function SupervisorPick({ supervisors }: { supervisors: Sup[] }) {
  if (supervisors.length === 1) return <L label="Masul"><input type="hidden" name="supervisorId" value={supervisors[0].id} /><span className="inline-block py-1.5 text-sm text-slate-700">{supervisors[0].name}</span></L>;
  return (
    <L label="Masul">
      <select name="supervisorId" required className="input w-auto py-1">
        {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isActive ? '' : ' (nofaol)'}</option>)}
      </select>
    </L>
  );
}

/** Yangi yozuv formasi: tur, sana, masul + maydonlar */
function AddForm({ kind, scope, date, supervisors, children, label }: { kind: Kind; scope: JournalScope; date: string; supervisors: Sup[]; children: React.ReactNode; label: string }) {
  if (!supervisors.length) return <p className="mt-2 text-xs text-amber-700">Bu punktda masul yo'q — yozuv qo'shib bo'lmaydi. Avval masul yarating.</p>;
  return (
    <form action={addEntryAction} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <input type="hidden" name="kind" value={kind} />
      <ScopeFields scope={scope} date={date} />
      <L label="Sana"><input type="date" name="date" defaultValue={date} required className="input w-auto py-1" /></L>
      <SupervisorPick supervisors={supervisors} />
      {children}
      <button className="btn-primary px-4 py-2 text-sm">{label}</button>
    </form>
  );
}

/** Qator sanasi (tahrirlanadi). Vaqt belgili sana (⏱) — poydevor acceptAtBase() yozgan; saqlanganda kunga tekislanadi */
function DateCell({ form, date }: { form: string; date: Date }) {
  return (
    <td className="whitespace-nowrap px-3 py-2">
      <input type="date" name="date" form={form} defaultValue={tashkentKey(date)} required className="input w-auto py-1 text-xs" />
      {hasTime(date) && <span className="ml-1 cursor-help text-xs text-amber-600" title={`Bazada vaqt belgisi bilan saqlangan (${date.toISOString().replace('T', ' ').slice(0, 19)} UTC). «Saqlash» bosilsa kunga tekislanadi.`}>⏱</span>}
    </td>
  );
}

const numInput = 'input w-24 py-1 text-right';
const textInput = 'input min-w-32 py-1';
const In = ({ name, form, value, className = numInput, placeholder }: { name: string; form: string; value?: string | number | null; className?: string; placeholder?: string }) => (
  <input name={name} form={form} defaultValue={value ?? ''} placeholder={placeholder} inputMode={className === numInput ? 'decimal' : undefined} className={className} />
);

export default async function JournalDayPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const scope = parseScope(sp);
  if (!scope) redirect('/admin/recycling/journal');
  const date = parseJournalDate(str(sp.date) ?? '') ?? todayTashkent();
  const key = dateKey(date);
  // Kun oralig'i bilan (vaqt belgili qatorlar ham kiradi); yig'indi yozuvlardan hisoblanadi
  const [entries, badges, sup, point, supervisors] = await Promise.all([
    dayEntriesRange(scope, date),
    recyclingNavBadges(),
    'supervisorId' in scope ? prisma.supervisor.findUnique({ where: { id: scope.supervisorId }, include: { point: true } }) : Promise.resolve(null),
    'pointId' in scope ? prisma.recyclePoint.findUnique({ where: { id: scope.pointId } }) : Promise.resolve(null),
    prisma.supervisor.findMany({ where: 'supervisorId' in scope ? { id: scope.supervisorId } : { pointId: scope.pointId }, orderBy: [{ isActive: 'desc' }, { id: 'asc' }], select: { id: true, name: true, isActive: true } }),
  ]);
  const summary = summarize(date, entries);
  const timed = [...entries.intake, ...entries.press, ...entries.expense, ...entries.sales, ...entries.cash].filter((e) => hasTime(e.date)).length;
  const scopeTitle = sup ? `${sup.name}${sup.point ? ` · ${sup.point.cityUz}` : ''}` : point ? `${point.cityUz} (${point.regionUz})` : "Noma'lum";
  const showSup = 'pointId' in scope;
  const moved = str(sp.moved);
  const prevKey = dateKey(new Date(date.getTime() - 86_400_000));
  const nextKey = dateKey(new Date(date.getTime() + 86_400_000));
  const error = str(sp.error);

  return (
    <>
      <PageHeader title={`${dateLabel(date)} · ${WEEKDAYS[date.getUTCDay()]}`}>
        <Link href={monthUrl(scope, monthKey(date.getUTCFullYear(), date.getUTCMonth() + 1))} className="btn-ghost px-4 py-2 text-sm">← Oy jadvali</Link>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <Notice show={str(sp.saved) === '1' && !moved}>Saqlandi</Notice>
      <Notice show={!!moved}>Saqlandi — yozuv boshqa kunga ko'chirildi: {moved && <Link href={dayUrl(scope, moved)} className="underline">{moved.split('-').reverse().join('.')}</Link>}</Notice>
      <Notice show={!!error} tone="warn">{error}</Notice>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-semibold">{sup ? 'Masul' : 'Punkt'}: {scopeTitle}</span>
        {sup && <Link href={`/admin/recycling/supervisors/${sup.id}`} className="text-sm text-brand-500 hover:underline">masul sahifasi</Link>}
        <form className="ml-auto flex items-center gap-2">
          {'supervisorId' in scope ? <input type="hidden" name="supervisorId" value={scope.supervisorId} /> : <input type="hidden" name="pointId" value={scope.pointId} />}
          <Link href={dayUrl(scope, prevKey)} className="btn-ghost px-3 py-1.5 text-sm">←</Link>
          <input type="date" name="date" defaultValue={key} className="input w-auto py-1.5" />
          <button className="btn-ghost px-3 py-1.5 text-sm">O'tish</button>
          <Link href={dayUrl(scope, nextKey)} className="btn-ghost px-3 py-1.5 text-sm">→</Link>
        </form>
      </div>

      <section className="card mb-6 p-4">
        <p className="mb-2 text-sm font-semibold">Kun yakuni</p>
        <p className="text-sm text-slate-600">Yakun = Ochilish + Sotuv − Qabul − Xarajat − Avans</p>
        <p className="mt-1 font-mono text-sm">
          {money(summary.opening)} + {money(summary.salesSum)} − {money(summary.intakeSum)} − {money(summary.expense)} − {money(summary.advance)} = <b className={summary.closing != null && summary.closing < 0 ? 'text-red-600' : 'text-emerald-700'}>{money(summary.closing)}</b> so'm
        </p>
        {summary.opening == null && <p className="mt-1 text-xs text-amber-700">Kassa ochilishi kiritilmagan — yakun hisoblanmaydi. Pastdagi «Kassa ochilishi» bo'limida kiriting.</p>}
        {showSup && summary.openingCount > 1 && <p className="mt-1 text-xs text-slate-500">Punkt ko'rinishi: ochilish — {summary.openingCount} ta masul ochilishi yig'indisi; qabul/sotuv/xarajat ham barcha masullar bo'yicha.</p>}
        {timed > 0 && <p className="mt-1 text-xs text-amber-700">⏱ {timed} ta yozuv bazada vaqt belgisi bilan saqlangan (bazaga olib kelish qabuli) — shu kunga kiritildi; qatorni «Saqlash» bilan sana kunga tekislanadi.</p>}
        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-5">
          <span>Qabul: <b className="text-slate-800">{kg(summary.intakeKg)} kg</b> · {summary.intakeCount} ta</span>
          <span>Press: <b className="text-slate-800">{kg(summary.pressedKg)} kg</b> · {summary.bales} toy</span>
          <span>Xarajat: <b className="text-slate-800">{money(summary.expense)}</b></span>
          <span>Avans: <b className="text-slate-800">{money(summary.advance)}</b></span>
          <span>Sotuv: <b className="text-slate-800">{kg(summary.salesKg)} kg</b> · {money(summary.salesSum)}</span>
        </div>
      </section>

      {/* 1. Qabul */}
      <h2 className="mb-2 text-lg font-semibold">Qabul (qo'lda) <span className="text-sm font-normal text-slate-500">{entries.intake.length} ta</span></h2>
      <Table head={[...(showSup ? ['Masul'] : []), 'Sana', "Og'irlik, kg", "Narx, so'm/kg", "Jami, so'm", 'Izoh', 'Amallar']} empty={!entries.intake.length}>
        {entries.intake.map((e) => {
          const f = `u-intake-${e.id}`;
          return (
            <tr key={e.id} className="hover:bg-slate-50">
              {showSup && <td className="px-3 py-2 text-sm">{e.supervisor.name}</td>}
              <DateCell form={f} date={e.date} />
              <td className="px-3 py-2"><In name="weightKg" form={f} value={e.weightKg} /></td>
              <td className="px-3 py-2"><In name="pricePerKg" form={f} value={toNumber(e.pricePerKg)} /></td>
              <td className="px-3 py-2 text-right font-semibold">{money(toNumber(e.totalAmount))}</td>
              <td className="px-3 py-2"><In name="note" form={f} value={e.note} className={textInput} placeholder="Izoh" /></td>
              <RowActions kind="intake" id={e.id} scope={scope} date={key} />
            </tr>
          );
        })}
      </Table>
      <AddForm kind="intake" scope={scope} date={key} supervisors={supervisors} label="Qabul qo'shish">
        <L label="Og'irlik, kg"><input name="weightKg" required inputMode="decimal" className={numInput} /></L>
        <L label="Narx, so'm/kg"><input name="pricePerKg" required inputMode="decimal" defaultValue={point ? toNumber(point.pricePerKg) : sup?.point ? toNumber(sup.point.pricePerKg) : ''} className={numInput} /></L>
        <L label="Izoh"><input name="note" className={textInput} /></L>
      </AddForm>

      {/* 2. Press */}
      <h2 className="mb-2 mt-8 text-lg font-semibold">Press <span className="text-sm font-normal text-slate-500">{entries.press.length} ta</span></h2>
      <Table head={[...(showSup ? ['Masul'] : []), 'Sana', 'Press, kg', 'Toylar', 'Operatorlar', 'Izoh', 'Amallar']} empty={!entries.press.length}>
        {entries.press.map((e) => {
          const f = `u-press-${e.id}`;
          return (
            <tr key={e.id} className="hover:bg-slate-50">
              {showSup && <td className="px-3 py-2 text-sm">{e.supervisor.name}</td>}
              <DateCell form={f} date={e.date} />
              <td className="px-3 py-2"><In name="pressedKg" form={f} value={e.pressedKg} /></td>
              <td className="px-3 py-2"><In name="baleCount" form={f} value={e.baleCount} /></td>
              <td className="px-3 py-2"><In name="operators" form={f} value={e.operators} className={textInput} placeholder="Operatorlar" /></td>
              <td className="px-3 py-2"><In name="note" form={f} value={e.note} className={textInput} placeholder="Izoh" /></td>
              <RowActions kind="press" id={e.id} scope={scope} date={key} />
            </tr>
          );
        })}
      </Table>
      <AddForm kind="press" scope={scope} date={key} supervisors={supervisors} label="Press qo'shish">
        <L label="Press, kg"><input name="pressedKg" required inputMode="decimal" className={numInput} /></L>
        <L label="Toylar"><input name="baleCount" required inputMode="numeric" defaultValue={0} className={numInput} /></L>
        <L label="Operatorlar"><input name="operators" className={textInput} /></L>
        <L label="Izoh"><input name="note" className={textInput} /></L>
      </AddForm>

      {/* 3. Xarajat / avans */}
      <h2 className="mb-2 mt-8 text-lg font-semibold">Xarajat / avans <span className="text-sm font-normal text-slate-500">{entries.expense.length} ta</span></h2>
      <Table head={[...(showSup ? ['Masul'] : []), 'Sana', "Xarajat, so'm", "Avans, so'm", 'Izoh', 'Amallar']} empty={!entries.expense.length}>
        {entries.expense.map((e) => {
          const f = `u-expense-${e.id}`;
          return (
            <tr key={e.id} className="hover:bg-slate-50">
              {showSup && <td className="px-3 py-2 text-sm">{e.supervisor.name}</td>}
              <DateCell form={f} date={e.date} />
              <td className="px-3 py-2"><In name="expenseAmount" form={f} value={toNumber(e.expenseAmount)} className="input w-32 py-1 text-right" /></td>
              <td className="px-3 py-2"><In name="advanceAmount" form={f} value={toNumber(e.advanceAmount)} className="input w-32 py-1 text-right" /></td>
              <td className="px-3 py-2"><In name="comment" form={f} value={e.comment} className={textInput} placeholder="Izoh" /></td>
              <RowActions kind="expense" id={e.id} scope={scope} date={key} />
            </tr>
          );
        })}
      </Table>
      <AddForm kind="expense" scope={scope} date={key} supervisors={supervisors} label="Xarajat qo'shish">
        <L label="Xarajat, so'm"><input name="expenseAmount" inputMode="decimal" className="input w-32 py-1 text-right" /></L>
        <L label="Avans, so'm"><input name="advanceAmount" inputMode="decimal" className="input w-32 py-1 text-right" /></L>
        <L label="Izoh"><input name="comment" className={textInput} /></L>
      </AddForm>

      {/* 4. Sotuv */}
      <h2 className="mb-2 mt-8 text-lg font-semibold">Sotuv <span className="text-sm font-normal text-slate-500">{entries.sales.length} ta</span></h2>
      <Table head={[...(showSup ? ['Masul'] : []), 'Sana', 'Xaridor', 'Kg', 'Toylar', "Narx, so'm/kg", "Jami, so'm", 'Mashina', 'Raqam', 'Izoh', 'Amallar']} empty={!entries.sales.length}>
        {entries.sales.map((e) => {
          const f = `u-sales-${e.id}`;
          return (
            <tr key={e.id} className="hover:bg-slate-50">
              {showSup && <td className="px-3 py-2 text-sm">{e.supervisor.name}</td>}
              <DateCell form={f} date={e.date} />
              <td className="px-3 py-2"><In name="customerName" form={f} value={e.customerName} className={textInput} placeholder="Xaridor" /></td>
              <td className="px-3 py-2"><In name="weightKg" form={f} value={e.weightKg} /></td>
              <td className="px-3 py-2"><In name="baleCount" form={f} value={e.baleCount} className="input w-16 py-1 text-right" /></td>
              <td className="px-3 py-2"><In name="pricePerKg" form={f} value={toNumber(e.pricePerKg)} /></td>
              <td className="px-3 py-2 text-right font-semibold">{money(toNumber(e.totalAmount))}</td>
              <td className="px-3 py-2"><In name="vehicleType" form={f} value={e.vehicleType} className="input w-28 py-1" placeholder="Mashina" /></td>
              <td className="px-3 py-2"><In name="plateNumber" form={f} value={e.plateNumber} className="input w-28 py-1" placeholder="Raqam" /></td>
              <td className="px-3 py-2"><In name="note" form={f} value={e.note} className={textInput} placeholder="Izoh" /></td>
              <RowActions kind="sales" id={e.id} scope={scope} date={key} />
            </tr>
          );
        })}
      </Table>
      <AddForm kind="sales" scope={scope} date={key} supervisors={supervisors} label="Sotuv qo'shish">
        <L label="Xaridor"><input name="customerName" required minLength={2} className={textInput} /></L>
        <L label="Kg"><input name="weightKg" required inputMode="decimal" className={numInput} /></L>
        <L label="Toylar"><input name="baleCount" inputMode="numeric" defaultValue={0} className="input w-16 py-1 text-right" /></L>
        <L label="Narx, so'm/kg"><input name="pricePerKg" required inputMode="decimal" className={numInput} /></L>
        <L label="Mashina"><input name="vehicleType" className="input w-28 py-1" /></L>
        <L label="Raqam"><input name="plateNumber" className="input w-28 py-1" /></L>
        <L label="Izoh"><input name="note" className={textInput} /></L>
      </AddForm>

      {/* 5. Kassa */}
      <h2 className="mb-2 mt-8 text-lg font-semibold">Kassa ochilishi <span className="text-sm font-normal text-slate-500">{entries.cash.length} ta</span></h2>
      <Table head={[...(showSup ? ['Masul'] : []), 'Sana', "Ochilish, so'm", 'Izoh', 'Amallar']} empty={!entries.cash.length}>
        {entries.cash.map((e) => {
          const f = `u-cash-${e.id}`;
          return (
            <tr key={e.id} className="hover:bg-slate-50">
              {showSup && <td className="px-3 py-2 text-sm">{e.supervisor.name}</td>}
              <DateCell form={f} date={e.date} />
              <td className="px-3 py-2"><In name="openingBalance" form={f} value={toNumber(e.openingBalance)} className="input w-36 py-1 text-right" /></td>
              <td className="px-3 py-2"><In name="note" form={f} value={e.note} className={textInput} placeholder="Izoh" /></td>
              <RowActions kind="cash" id={e.id} scope={scope} date={key} />
            </tr>
          );
        })}
      </Table>
      <AddForm kind="cash" scope={scope} date={key} supervisors={supervisors} label="Ochilishni saqlash">
        <L label="Ochilish, so'm"><input name="openingBalance" required inputMode="decimal" className="input w-36 py-1 text-right" /></L>
        <L label="Izoh"><input name="note" className={textInput} /></L>
      </AddForm>
      <p className="mt-2 text-xs text-slate-400">Kassa ochilishi har masul uchun kuniga bitta: mavjud bo'lsa qayta saqlashda yangilanadi. Qator sanasini o'zgartirib yozuvni boshqa kunga ko'chirish mumkin.</p>
    </>
  );
}
