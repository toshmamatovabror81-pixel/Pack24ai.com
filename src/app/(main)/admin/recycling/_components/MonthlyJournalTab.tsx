'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Download, FileSpreadsheet } from 'lucide-react';
import { buildPathWithRecyclingTab } from '@/lib/platform/botEventFeedUrl';

type Option = { id: number; name: string };

type JournalRowBase = {
    day: number;
    dateLabel: string;
};

type JournalData = {
    month: string;
    daysInMonth: number;
    intakeRows: Array<JournalRowBase & {
        weightKg: number;
        totalAmount: number;
        pricePerKg: number;
    }>;
    pressRows: Array<JournalRowBase & {
        pressedKg: number;
        baleCount: number;
        operators: string;
    }>;
    salesRows: Array<JournalRowBase & {
        customers: string;
        weightKg: number;
        baleCount: number;
        pricePerKg: number;
        totalAmount: number;
        vehicles: string;
        plateNumbers: string;
    }>;
    expenseRows: Array<JournalRowBase & {
        expenseAmount: number;
        advanceAmount: number;
        comments: string;
    }>;
    cashRows: Array<JournalRowBase & {
        openingBalance: number;
        intakeAmount: number;
        salesAmount: number;
        expenseAmount: number;
        advanceAmount: number;
        closingBalance: number;
    }>;
    totals: {
        intakeWeightKg: number;
        intakeAmount: number;
        pressedKg: number;
        pressBales: number;
        salesWeightKg: number;
        salesBales: number;
        salesAmount: number;
        expenseAmount: number;
        advanceAmount: number;
    };
};

type DayDetails = {
    date: string;
    intakes: Array<{
        id: number;
        weightKg: number;
        pricePerKg: number;
        totalAmount: number;
        note: string | null;
        supervisor: { id: number; name: string };
        point: { id: number; regionUz: string } | null;
    }>;
    presses: Array<{
        id: number;
        pressedKg: number;
        baleCount: number;
        operators: string | null;
        note: string | null;
        supervisor: { id: number; name: string };
        point: { id: number; regionUz: string } | null;
    }>;
    sales: Array<{
        id: number;
        customerName: string;
        weightKg: number;
        baleCount: number;
        pricePerKg: number;
        totalAmount: number;
        vehicleType: string | null;
        plateNumber: string | null;
        note: string | null;
        supervisor: { id: number; name: string };
        point: { id: number; regionUz: string } | null;
    }>;
    expenses: Array<{
        id: number;
        expenseAmount: number;
        advanceAmount: number;
        comment: string | null;
        supervisor: { id: number; name: string };
        point: { id: number; regionUz: string } | null;
    }>;
    cashLogs: Array<{
        id: number;
        openingBalance: number;
        note: string | null;
        supervisor: { id: number; name: string };
        point: { id: number; regionUz: string } | null;
    }>;
};

function fmt(n: number) {
    return n ? n.toLocaleString('ru-RU') : '-';
}

function currentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-base">{title}</h3>
            </div>
            <div className="overflow-x-auto">{children}</div>
        </div>
    );
}

export default function MonthlyJournalTab({
    points,
    supervisors,
    urlPointId = null,
    urlSupervisorId = null,
    onFilterUrlChange,
}: {
    points: Option[];
    supervisors: Option[];
    /** /admin/recycling?tab=journal&pointId=... — bot event yoki qo'lda yorliq orqali */
    urlPointId?: number | null;
    urlSupervisorId?: number | null;
    /** Jurnal filtri URLga yozilganda parentdagi umumiy point/masul state */
    onFilterUrlChange?: (pointId: number | null, supervisorId: number | null) => void;
}) {
    const [month, setMonth] = useState(currentMonthValue());
    const [pointId, setPointId] = useState(() =>
        urlPointId != null && urlPointId > 0 ? String(urlPointId) : '',
    );
    const [supervisorId, setSupervisorId] = useState(() =>
        urlSupervisorId != null && urlSupervisorId > 0 ? String(urlSupervisorId) : '',
    );
    const router = useRouter();
    const pathname = usePathname();
    const onFilterUrlChangeRef = useRef(onFilterUrlChange);
    onFilterUrlChangeRef.current = onFilterUrlChange;

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<JournalData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [dayLoading, setDayLoading] = useState(false);
    const [dayDetails, setDayDetails] = useState<DayDetails | null>(null);

    const fetchJournal = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ month });
            if (pointId) params.set('pointId', pointId);
            if (supervisorId) params.set('supervisorId', supervisorId);

            const res = await fetch(`/api/admin/recycling/journal?${params.toString()}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json?.error || 'Jurnalni yuklab bo\'lmadi');
            }
            setData(json);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Noma\'lum xato');
        } finally {
            setLoading(false);
        }
    }, [month, pointId, supervisorId]);

    useEffect(() => {
        fetchJournal();
    }, [fetchJournal]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const nextPath = buildPathWithRecyclingTab(pathname, window.location.search, {
            tab: 'journal',
            pointId,
            supervisorId,
        });
        const current = `${window.location.pathname}${window.location.search}`;
        if (nextPath === current) return;
        router.replace(nextPath, { scroll: false });
        onFilterUrlChangeRef.current?.(
            pointId ? parseInt(pointId, 10) : null,
            supervisorId ? parseInt(supervisorId, 10) : null,
        );
    }, [pointId, supervisorId, pathname, router]);

    const selectedPoint = useMemo(
        () => points.find(point => String(point.id) === pointId)?.name ?? 'Barcha bazalar',
        [pointId, points]
    );
    const selectedSupervisor = useMemo(
        () => supervisors.find(sup => String(sup.id) === supervisorId)?.name ?? 'Barcha masullar',
        [supervisorId, supervisors]
    );

    const openDayDetails = useCallback(async (day: number) => {
        const date = `${month}-${String(day).padStart(2, '0')}`;
        setSelectedDay(date);
        setDayLoading(true);
        setDayDetails(null);

        try {
            const params = new URLSearchParams({ date });
            if (pointId) params.set('pointId', pointId);
            if (supervisorId) params.set('supervisorId', supervisorId);
            const res = await fetch(`/api/admin/recycling/journal/day?${params.toString()}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || 'Kunlik detail yuklanmadi');
            setDayDetails(json);
        } catch (err: unknown) {
            setDayDetails(null);
            setError(err instanceof Error ? err.message : 'Noma\'lum xato');
        } finally {
            setDayLoading(false);
        }
    }, [month, pointId, supervisorId]);

    const exportCsv = useCallback(() => {
        if (!data) return;

        const sections: string[] = [];
        const addSection = (title: string, headers: string[], rows: string[][]) => {
            sections.push(title);
            sections.push(headers.join(','));
            rows.forEach((row) => sections.push(row.map((value) => {
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')));
            sections.push('');
        };

        addSection(
            'Makulatura qabul jurnali',
            ['Kun', 'Data', 'Qabul (kg)', 'Narx', 'Summa'],
            data.intakeRows.map((row) => [
                String(row.day),
                row.dateLabel,
                String(Math.round(row.weightKg)),
                String(Math.round(row.pricePerKg)),
                String(Math.round(row.totalAmount)),
            ])
        );

        addSection(
            'Press jurnali',
            ['Kun', 'Data', 'Press (kg)', 'Toylar', 'Bajaruvchilar'],
            data.pressRows.map((row) => [
                String(row.day),
                row.dateLabel,
                String(Math.round(row.pressedKg)),
                String(row.baleCount),
                row.operators || '',
            ])
        );

        addSection(
            'Sotuv jurnali',
            ['Kun', 'Data', 'Klient', 'Massa (kg)', 'Soni', 'Narx', 'Summasi', 'Mashina', 'Davlat raqami'],
            data.salesRows.map((row) => [
                String(row.day),
                row.dateLabel,
                row.customers || '',
                String(Math.round(row.weightKg)),
                String(row.baleCount),
                String(Math.round(row.pricePerKg)),
                String(Math.round(row.totalAmount)),
                row.vehicles || '',
                row.plateNumbers || '',
            ])
        );

        addSection(
            'Xarajat va kassa',
            ['Kun', 'Data', 'Kassa', 'Xarid', 'Sotuv', 'Xarajat', 'Avans', 'Qoldiq'],
            data.cashRows.map((row) => [
                String(row.day),
                row.dateLabel,
                String(Math.round(row.openingBalance)),
                String(Math.round(row.intakeAmount)),
                String(Math.round(row.salesAmount)),
                String(Math.round(row.expenseAmount)),
                String(Math.round(row.advanceAmount)),
                String(Math.round(row.closingBalance)),
            ])
        );

        const blob = new Blob([`\uFEFF${sections.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `recycle_journal_${month}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }, [data, month]);

    const rowClassName = 'cursor-pointer hover:bg-emerald-50/60 transition-colors';

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-gray-500">
                        <CalendarDays size={16} />
                        <span className="text-sm font-semibold">Oylik jurnal filtri</span>
                    </div>
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    />
                    <select
                        value={pointId}
                        onChange={(e) => setPointId(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                        title="Baza tanlash"
                    >
                        <option value="">Barcha bazalar</option>
                        {points.map(point => (
                            <option key={point.id} value={point.id}>{point.name}</option>
                        ))}
                    </select>
                    <select
                        value={supervisorId}
                        onChange={(e) => setSupervisorId(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                        title="Masul tanlash"
                    >
                        <option value="">Barcha masullar</option>
                        {supervisors.map(supervisor => (
                            <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={fetchJournal}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl"
                    >
                        Yangilash
                    </button>
                    <button
                        onClick={exportCsv}
                        disabled={!data}
                        className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        <Download size={14} />
                        CSV export
                    </button>
                </div>
                <div className="mt-3 text-xs text-gray-400">
                    Ko&apos;rinish: {selectedPoint} | {selectedSupervisor}
                </div>
            </div>

            {loading && (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
                    Jurnal yuklanmoqda...
                </div>
            )}

            {error && !loading && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-sm text-red-600">
                    {error}
                </div>
            )}

            {!loading && data && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                            { label: 'Qabul', value: `${fmt(data.totals.intakeWeightKg)} kg`, sub: `${fmt(data.totals.intakeAmount)} so'm` },
                            { label: 'Press', value: `${fmt(data.totals.pressedKg)} kg`, sub: `${fmt(data.totals.pressBales)} toy` },
                            { label: 'Sotuv', value: `${fmt(data.totals.salesWeightKg)} kg`, sub: `${fmt(data.totals.salesAmount)} so'm` },
                            { label: 'Xarajat', value: `${fmt(data.totals.expenseAmount)} so'm`, sub: `Avans ${fmt(data.totals.advanceAmount)} so'm` },
                            { label: 'Sotilgan toy', value: `${fmt(data.totals.salesBales)}`, sub: 'oylik jami' },
                        ].map((item) => (
                            <div key={item.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                                <div className="text-xs font-bold text-gray-400 uppercase">{item.label}</div>
                                <div className="text-xl font-black text-gray-900 mt-2">{item.value}</div>
                                <div className="text-xs text-gray-400 mt-1">{item.sub}</div>
                            </div>
                        ))}
                    </div>

                    <TableCard title="Makulatura qabul jurnali">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">№</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Data</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Qabul (kg)</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Narx</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Summa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.intakeRows.map((row) => (
                                    <tr key={row.day} className={rowClassName} onClick={() => openDayDetails(row.day)}>
                                        <td className="px-3 py-2">{row.day}</td>
                                        <td className="px-3 py-2">{row.dateLabel}</td>
                                        <td className="px-3 py-2 text-right">{fmt(Math.round(row.weightKg))}</td>
                                        <td className="px-3 py-2 text-right">{fmt(Math.round(row.pricePerKg))}</td>
                                        <td className="px-3 py-2 text-right font-semibold">{fmt(Math.round(row.totalAmount))}</td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-50 font-bold">
                                    <td className="px-3 py-2" colSpan={2}>Jami</td>
                                    <td className="px-3 py-2 text-right">{fmt(Math.round(data.totals.intakeWeightKg))}</td>
                                    <td className="px-3 py-2 text-right">-</td>
                                    <td className="px-3 py-2 text-right">{fmt(Math.round(data.totals.intakeAmount))}</td>
                                </tr>
                            </tbody>
                        </table>
                    </TableCard>

                    <TableCard title="Ishlab chiqarish / press jurnali">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">№</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Data</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Press (kg)</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Toylar</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Bajaruvchilar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.pressRows.map((row) => (
                                    <tr key={row.day} className={rowClassName} onClick={() => openDayDetails(row.day)}>
                                        <td className="px-3 py-2">{row.day}</td>
                                        <td className="px-3 py-2">{row.dateLabel}</td>
                                        <td className="px-3 py-2 text-right">{fmt(Math.round(row.pressedKg))}</td>
                                        <td className="px-3 py-2 text-right">{fmt(row.baleCount)}</td>
                                        <td className="px-3 py-2">{row.operators || '-'}</td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-50 font-bold">
                                    <td className="px-3 py-2" colSpan={2}>Jami</td>
                                    <td className="px-3 py-2 text-right">{fmt(Math.round(data.totals.pressedKg))}</td>
                                    <td className="px-3 py-2 text-right">{fmt(data.totals.pressBales)}</td>
                                    <td className="px-3 py-2">-</td>
                                </tr>
                            </tbody>
                        </table>
                    </TableCard>

                    <TableCard title="Preslangan makulatura sotuv jurnali">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">№</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Data</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Klient</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Massa (kg)</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Soni</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Narx</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Summasi</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Mashina</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Davlat raqami</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.salesRows.map((row) => (
                                    <tr key={row.day} className={rowClassName} onClick={() => openDayDetails(row.day)}>
                                        <td className="px-3 py-2">{row.day}</td>
                                        <td className="px-3 py-2">{row.dateLabel}</td>
                                        <td className="px-3 py-2">{row.customers || '-'}</td>
                                        <td className="px-3 py-2 text-right">{fmt(Math.round(row.weightKg))}</td>
                                        <td className="px-3 py-2 text-right">{fmt(row.baleCount)}</td>
                                        <td className="px-3 py-2 text-right">{fmt(Math.round(row.pricePerKg))}</td>
                                        <td className="px-3 py-2 text-right font-semibold">{fmt(Math.round(row.totalAmount))}</td>
                                        <td className="px-3 py-2">{row.vehicles || '-'}</td>
                                        <td className="px-3 py-2">{row.plateNumbers || '-'}</td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-50 font-bold">
                                    <td className="px-3 py-2" colSpan={3}>Jami</td>
                                    <td className="px-3 py-2 text-right">{fmt(Math.round(data.totals.salesWeightKg))}</td>
                                    <td className="px-3 py-2 text-right">{fmt(data.totals.salesBales)}</td>
                                    <td className="px-3 py-2 text-right">-</td>
                                    <td className="px-3 py-2 text-right">{fmt(Math.round(data.totals.salesAmount))}</td>
                                    <td className="px-3 py-2" colSpan={2}>-</td>
                                </tr>
                            </tbody>
                        </table>
                    </TableCard>

                    <TableCard title="Ish haqi, xarajat va kassa">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">№</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Data</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Kassa</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Xarid</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Sotuv</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Xarajat</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Avans</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Qoldiq</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.cashRows.map((row) => (
                                    <tr key={row.day} className={rowClassName} onClick={() => openDayDetails(row.day)}>
                                        <td className="px-3 py-2">{row.day}</td>
                                        <td className="px-3 py-2">{row.dateLabel}</td>
                                        <td className="px-3 py-2 text-right">{fmt(Math.round(row.openingBalance))}</td>
                                        <td className="px-3 py-2 text-right">{fmt(Math.round(row.intakeAmount))}</td>
                                        <td className="px-3 py-2 text-right">{fmt(Math.round(row.salesAmount))}</td>
                                        <td className="px-3 py-2 text-right">{fmt(Math.round(row.expenseAmount))}</td>
                                        <td className="px-3 py-2 text-right">{fmt(Math.round(row.advanceAmount))}</td>
                                        <td className="px-3 py-2 text-right font-semibold">{fmt(Math.round(row.closingBalance))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TableCard>

                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <FileSpreadsheet size={14} />
                        Jadval Excel uslubida kunma-kun jamlanib ko&apos;rsatiladi. Bo&apos;sh kunlar ham saqlanadi.
                    </div>

                    {selectedDay && (
                        <div
                            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
                            onClick={() => {
                                setSelectedDay(null);
                                setDayDetails(null);
                            }}
                        >
                            <div
                                className="bg-white rounded-2xl border border-gray-100 w-full max-w-5xl max-h-[90vh] overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-gray-900">Kunlik original yozuvlar</h3>
                                        <p className="text-xs text-gray-400 mt-1">{selectedDay}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedDay(null);
                                            setDayDetails(null);
                                        }}
                                        className="px-3 py-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700"
                                    >
                                        Yopish
                                    </button>
                                </div>

                                <div className="p-5 overflow-y-auto max-h-[calc(90vh-72px)] space-y-5">
                                    {dayLoading && (
                                        <div className="text-center text-gray-400 py-8">Kunlik ma&apos;lumot yuklanmoqda...</div>
                                    )}

                                    {!dayLoading && dayDetails && (
                                        <>
                                            <TableCard title="Qabul yozuvlari">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">ID</th>
                                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Kg</th>
                                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Narx</th>
                                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Summa</th>
                                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Izoh</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {dayDetails.intakes.length === 0 ? (
                                                            <tr><td className="px-3 py-4 text-center text-gray-400" colSpan={5}>Yozuv yo&apos;q</td></tr>
                                                        ) : dayDetails.intakes.map((item) => (
                                                            <tr key={item.id}>
                                                                <td className="px-3 py-2">#{item.id}</td>
                                                                <td className="px-3 py-2 text-right">{fmt(Math.round(item.weightKg))}</td>
                                                                <td className="px-3 py-2 text-right">{fmt(Math.round(item.pricePerKg))}</td>
                                                                <td className="px-3 py-2 text-right">{fmt(Math.round(item.totalAmount))}</td>
                                                                <td className="px-3 py-2">{item.note || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </TableCard>

                                            <TableCard title="Press yozuvlari">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">ID</th>
                                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Kg</th>
                                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Toylar</th>
                                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Bajaruvchilar</th>
                                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Izoh</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {dayDetails.presses.length === 0 ? (
                                                            <tr><td className="px-3 py-4 text-center text-gray-400" colSpan={5}>Yozuv yo&apos;q</td></tr>
                                                        ) : dayDetails.presses.map((item) => (
                                                            <tr key={item.id}>
                                                                <td className="px-3 py-2">#{item.id}</td>
                                                                <td className="px-3 py-2 text-right">{fmt(Math.round(item.pressedKg))}</td>
                                                                <td className="px-3 py-2 text-right">{fmt(item.baleCount)}</td>
                                                                <td className="px-3 py-2">{item.operators || '-'}</td>
                                                                <td className="px-3 py-2">{item.note || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </TableCard>

                                            <TableCard title="Sotuv yozuvlari">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">ID</th>
                                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Klient</th>
                                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Kg</th>
                                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Toylar</th>
                                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Narx</th>
                                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Summa</th>
                                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Mashina</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {dayDetails.sales.length === 0 ? (
                                                            <tr><td className="px-3 py-4 text-center text-gray-400" colSpan={7}>Yozuv yo&apos;q</td></tr>
                                                        ) : dayDetails.sales.map((item) => (
                                                            <tr key={item.id}>
                                                                <td className="px-3 py-2">#{item.id}</td>
                                                                <td className="px-3 py-2">{item.customerName}</td>
                                                                <td className="px-3 py-2 text-right">{fmt(Math.round(item.weightKg))}</td>
                                                                <td className="px-3 py-2 text-right">{fmt(item.baleCount)}</td>
                                                                <td className="px-3 py-2 text-right">{fmt(Math.round(item.pricePerKg))}</td>
                                                                <td className="px-3 py-2 text-right">{fmt(Math.round(item.totalAmount))}</td>
                                                                <td className="px-3 py-2">{[item.vehicleType, item.plateNumber].filter(Boolean).join(' | ') || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </TableCard>

                                            <TableCard title="Xarajat va kassa">
                                                <div className="grid lg:grid-cols-2 gap-5 p-5">
                                                    <div>
                                                        <h4 className="font-semibold text-gray-800 mb-3">Xarajatlar</h4>
                                                        <div className="space-y-2">
                                                            {dayDetails.expenses.length === 0 ? (
                                                                <div className="text-sm text-gray-400">Yozuv yo&apos;q</div>
                                                            ) : dayDetails.expenses.map((item) => (
                                                                <div key={item.id} className="border border-gray-100 rounded-xl p-3 text-sm">
                                                                    <div>💸 Xarajat: <b>{fmt(Math.round(item.expenseAmount))}</b></div>
                                                                    <div>💼 Avans: <b>{fmt(Math.round(item.advanceAmount))}</b></div>
                                                                    <div className="text-gray-500 mt-1">{item.comment || '-'}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-800 mb-3">Kassa</h4>
                                                        <div className="space-y-2">
                                                            {dayDetails.cashLogs.length === 0 ? (
                                                                <div className="text-sm text-gray-400">Yozuv yo&apos;q</div>
                                                            ) : dayDetails.cashLogs.map((item) => (
                                                                <div key={item.id} className="border border-gray-100 rounded-xl p-3 text-sm">
                                                                    <div>🏦 Boshlang&apos;ich kassa: <b>{fmt(Math.round(item.openingBalance))}</b></div>
                                                                    <div className="text-gray-500 mt-1">{item.note || '-'}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCard>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
