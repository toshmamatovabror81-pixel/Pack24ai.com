import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate, formatPrice, toNumber } from '@/lib/format';
import { str, type SearchParams } from '@/lib/params';
import { driverLeaderboard, financeOverview } from '@/lib/recycling/finance';
import { driverBalance } from '@/lib/recycling/wallet';
import { Notice, PageHeader, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { ConfirmButton } from '@/components/admin/recycling/ConfirmButton';
import { recyclingNavBadges } from '../events/navBadges';
import { payWithdrawalAction, rejectWithdrawalAction } from './actions';
import { financeUrl, periodLabels, resolvePeriod, type PeriodKey } from './period';

export const metadata = { title: 'Moliya' };
export const dynamic = 'force-dynamic';

const sum = (v: number) => formatPrice(v, "so'm");
const kg = (v: number) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(Math.round(v * 10) / 10)} kg`;

/** Ko'rsatkichlar guruhi: sarlavha + yorliq/qiymat juftliklari */
function Group({ title, items, hint }: { title: string; items: [string, React.ReactNode][]; hint?: string }) {
  return (
    <section className="card p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
        {items.map(([l, v]) => (
          <div key={l} className="contents">
            <dt className="text-slate-500">{l}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
    </section>
  );
}

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const p = resolvePeriod(sp);
  const period = { from: p.from, to: p.to, pointId: p.pointId };
  const [points, overview, leaders, withdrawals, badges] = await Promise.all([
    prisma.recyclePoint.findMany({ orderBy: { id: 'asc' }, select: { id: true, cityUz: true, regionUz: true } }),
    financeOverview(period),
    driverLeaderboard(period, 20),
    prisma.driverTransaction.findMany({
      where: { type: 'withdrawal', status: 'pending', ...(p.pointId ? { driver: { pointId: p.pointId } } : {}) },
      include: { driver: { select: { id: true, name: true, phone: true, point: { select: { cityUz: true } }, supervisor: { select: { id: true, name: true } } } }, card: true },
      orderBy: { id: 'asc' },
    }),
    recyclingNavBadges(),
  ]);
  const balances = new Map<number, number>();
  await Promise.all(Array.from(new Set(withdrawals.map((w) => w.driverId))).map(async (id) => balances.set(id, (await driverBalance(id)).balance)));
  const pointName = p.pointId ? points.find((x) => x.id === p.pointId)?.cityUz ?? `#${p.pointId}` : 'Barcha punktlar';
  const pill = (k: PeriodKey) => `rounded-full px-3 py-1.5 text-sm ${p.key === k ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;
  const hidden = (
    <>
      <input type="hidden" name="period" value={p.key} />
      <input type="hidden" name="from" value={p.fromStr} />
      <input type="hidden" name="to" value={p.toStr} />
      <input type="hidden" name="point" value={p.pointId ?? ''} />
    </>
  );
  const o = overview;

  return (
    <>
      <PageHeader title="Moliya">
        <a href={financeUrl(p, {}, '/admin/recycling/finance/export')} className="btn-ghost px-4 py-2 text-sm">⬇ CSV</a>
      </PageHeader>
      <RecyclingNav badges={badges} />
      <Notice show={str(sp.saved) === '1'}>Saqlandi</Notice>
      <Notice show={!!str(sp.error)} tone="warn">{str(sp.error)}</Notice>
      <form className="card mb-4 flex flex-wrap items-end gap-2 p-3">
        <input type="hidden" name="period" value="custom" />
        <div className="flex gap-1 self-center">
          {(['today', '7d', 'month'] as PeriodKey[]).map((k) => <Link key={k} href={financeUrl({ ...p, key: k })} className={pill(k)}>{periodLabels[k]}</Link>)}
        </div>
        <label className="text-xs text-slate-500">Dan<input type="date" name="from" defaultValue={p.fromStr} className="input w-auto py-2" /></label>
        <label className="text-xs text-slate-500">Gacha<input type="date" name="to" defaultValue={p.toStr} className="input w-auto py-2" /></label>
        <label className="text-xs text-slate-500">Punkt
          <select name="point" defaultValue={p.pointId ?? ''} className="input w-auto py-2">
            <option value="">Barcha punktlar</option>
            {points.map((pt) => <option key={pt.id} value={pt.id}>{pt.cityUz} ({pt.regionUz})</option>)}
          </select>
        </label>
        <button className="btn-ghost px-4 py-2 text-sm">Ko'rsatish</button>
        <span className="ml-auto text-sm text-slate-500">{p.fromStr === p.toStr ? p.fromStr : `${p.fromStr} — ${p.toStr}`} · <b>{pointName}</b></span>
      </form>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Group title="Arizalar" hint="Davr ichida yaratilgan arizalar" items={[['Jami', o.requests.total], ['Yakunlangan', <span key="c" className="text-emerald-700">{o.requests.completed}</span>], ['Bekor qilingan', <span key="x" className="text-slate-500">{o.requests.cancelled}</span>], ['Jarayonda', <span key="a" className="text-blue-700">{o.requests.active}</span>]]} />
        <Group title="Yig'ilgan makulatura" hint="Haydovchi tortgan yuklar (davr ichida)" items={[['Tortishlar', o.collections.count], ["Og'irlik", kg(o.collections.kg)], ['Effektiv kg', kg(o.collections.effectiveKg)], ['Jami summa', sum(o.collections.amount)], ["Mijozga to'langan", sum(o.collections.paidToCustomer)], ["Haydovchiga to'langan", sum(o.collections.paidToDriver)]]} />
        <Group title="Haydovchilar" hint="Hamyon: daromad va yechib olishlar" items={[['Daromad', sum(o.drivers.earned)], ['Yechilgan', sum(o.drivers.withdrawn)], ["Kutilayotgan so'rovlar", <span key="p" className={o.drivers.pendingWithdrawals ? 'text-amber-700' : ''}>{sum(o.drivers.pendingWithdrawals)}</span>], ['Bonus', sum(o.drivers.bonus)]]} />
        <Group title="Masul jurnali" hint="Qo'lda yuritilgan kunlik jurnal" items={[['Qabul', `${kg(o.journal.intakeKg)} · ${sum(o.journal.intakeSum)}`], ['Press', `${kg(o.journal.pressedKg)} · ${o.journal.bales} toy`], ['Xarajat', sum(o.journal.expense)], ['Avans', sum(o.journal.advance)], ['Sotuv', `${kg(o.journal.salesKg)} · ${sum(o.journal.salesSum)}`]]} />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Punktlar bo'yicha</h2>
          <Table head={['Punkt', 'Arizalar', "Yig'ilgan, kg", "Summa, so'm"]} empty={!o.byPoint.length}>
            {o.byPoint.map((b) => (
              <tr key={b.pointId} className="hover:bg-slate-50">
                <td className="px-4 py-2"><Link href={`/admin/recycling/points/${b.pointId}`} className="font-medium text-brand-500 hover:underline">{b.name}</Link></td>
                <td className="px-4 py-2 text-right">{b.requests}</td>
                <td className="px-4 py-2 text-right">{kg(b.kg)}</td>
                <td className="px-4 py-2 text-right">{sum(b.amount)}</td>
              </tr>
            ))}
          </Table>
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">Haydovchilar reytingi</h2>
          <Table head={['#', 'Haydovchi', 'Punkt', 'Safarlar', 'Kg', "Summa, so'm"]} empty={!leaders.length}>
            {leaders.map((l, i) => (
              <tr key={l.driver?.id ?? i} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                <td className="px-4 py-2">{l.driver ? <Link href={`/admin/recycling/drivers/${l.driver.id}`} className="font-medium text-brand-500 hover:underline">{l.driver.name}</Link> : '—'}{l.driver && <span className="block text-xs text-slate-500">{displayPhone(l.driver.phone)}</span>}</td>
                <td className="px-4 py-2">{l.driver?.point?.cityUz ?? '—'}</td>
                <td className="px-4 py-2 text-right">{l.trips}</td>
                <td className="px-4 py-2 text-right">{kg(l.kg)}</td>
                <td className="px-4 py-2 text-right">{sum(l.amount)}</td>
              </tr>
            ))}
          </Table>
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Yechib olish so'rovlari <span className="text-sm font-normal text-slate-500">{withdrawals.length} ta kutilmoqda</span></h2>
      <p className="mb-2 text-sm text-slate-500">Haydovchi botdan yoki kabinetdan so'ragan. «To'landi» — pul kartaga o'tkazilgandan keyin bosing; haydovchiga Telegram orqali xabar boradi.</p>
      <Table head={['#', 'Sana', 'Haydovchi', 'Punkt / masul', 'Summa', 'Karta', 'Balans', 'Amallar']} empty={!withdrawals.length}>
        {withdrawals.map((w) => (
          <tr key={w.id} className="hover:bg-slate-50">
            <td className="px-4 py-2 text-slate-500">{w.id}</td>
            <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDate(w.createdAt, 'uz', true)}</td>
            <td className="px-4 py-2"><Link href={`/admin/recycling/drivers/${w.driver.id}`} className="font-medium text-brand-500 hover:underline">{w.driver.name}</Link><span className="block text-xs text-slate-500">{displayPhone(w.driver.phone)}</span></td>
            <td className="px-4 py-2 text-sm">{w.driver.point?.cityUz ?? '—'}{w.driver.supervisor && <span className="block text-xs text-slate-500">{w.driver.supervisor.name}</span>}</td>
            <td className="whitespace-nowrap px-4 py-2 font-semibold">{sum(toNumber(w.amount))}</td>
            <td className="px-4 py-2 text-sm">{w.card ? <>{w.card.cardNumber}<span className="block text-xs text-slate-500">{w.card.cardHolder} · {w.card.cardType}</span></> : <span className="text-slate-500">{w.description ?? 'Naqd'}</span>}</td>
            <td className="whitespace-nowrap px-4 py-2 text-sm">{sum(balances.get(w.driverId) ?? 0)}</td>
            <td className="whitespace-nowrap px-4 py-2">
              <form action={payWithdrawalAction} className="inline">{hidden}<input type="hidden" name="id" value={w.id} /><ConfirmButton message={`${sum(toNumber(w.amount))} to'langan deb belgilansinmi?`} className="btn-primary px-3 py-1 text-xs">To'landi</ConfirmButton></form>{' '}
              <form action={rejectWithdrawalAction} className="inline">{hidden}<input type="hidden" name="id" value={w.id} /><ConfirmButton message="So'rov rad etilsinmi? Summa haydovchi balansiga qaytadi." className="btn-ghost px-3 py-1 text-xs text-red-600">Rad</ConfirmButton></form>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
