'use client';

/**
 * Masullar va haydovchilar bo'yicha to'liq audit hisoboti.
 *
 * Bir qarashda quyidagilar ko'rinadi:
 *  - Qaysi masulda nechta haydovchi ro'yxatdan o'tgan
 *  - Qaysi haydovchilar qaysi baza/punkt orqali olingan
 *  - Bot orqali kirgan haydovchilar (parol va kod berilganlar)
 *  - Audit: kim taqdim etgan ("invitedBy")
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Users, ChevronDown, ChevronUp, Wifi, WifiOff, KeyRound, BadgeCheck, Building2, AlertTriangle, RefreshCw } from 'lucide-react';

interface PointSummary {
    id: number;
    regionUz: string;
    cityUz: string;
    driversCount: number;
    invitedDriversCount: number;
    supervisorsCount: number;
}

interface DriverRow {
    id: number;
    name: string;
    phone: string;
    status: string;
    isOnline: boolean;
    registeredAt: string | null;
    invitedAt: string | null;
    invitedByMe: boolean;
    hasPassword: boolean;
    hasRegistrationCode: boolean;
    acceptedMaterialsCount: number;
    lastSeenAt: string | null;
    point: { id: number; regionUz: string; cityUz: string } | null;
}

interface SupervisorReport {
    supervisor: {
        id: number;
        name: string;
        phone: string;
        isActive: boolean;
        hasTelegram: boolean;
        point: { id: number; regionUz: string; cityUz: string } | null;
    };
    kpis: {
        total: number;
        online: number;
        botRegistered: number;
        withPassword: number;
        withTariffs: number;
        invitedByMe: number;
    };
    byPoint: Array<{ pointId: number | null; regionUz: string; cityUz: string; count: number }>;
    drivers: DriverRow[];
}

interface TeamReportResponse {
    ok: boolean;
    supervisors: SupervisorReport[];
    points: PointSummary[];
    orphans: number;
}

export default function TeamReportTab() {
    const [data, setData] = useState<TeamReportResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/admin/recycling/drivers/by-supervisor', { cache: 'no-store' });
            if (r.ok) {
                const json = (await r.json()) as TeamReportResponse;
                setData(json);
            } else {
                toast.error('Hisobotni yuklashda xato');
            }
        } catch {
            toast.error('Tarmoq xatosi');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const totals = useMemo(() => {
        if (!data) return null;
        const drivers = data.supervisors.reduce((s, r) => s + r.kpis.total, 0);
        const online = data.supervisors.reduce((s, r) => s + r.kpis.online, 0);
        const bot = data.supervisors.reduce((s, r) => s + r.kpis.botRegistered, 0);
        const pwd = data.supervisors.reduce((s, r) => s + r.kpis.withPassword, 0);
        return { drivers, online, bot, pwd };
    }, [data]);

    const toggle = (id: number) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    if (loading) return <div className="text-gray-500 p-6">Yuklanmoqda…</div>;
    if (!data) return <div className="text-gray-500 p-6">Ma&apos;lumot yo&apos;q</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Users size={18} className="text-indigo-600" />
                        Jamoa hisoboti — masullar va haydovchilar
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Qaysi masulda nechta haydovchi, qaysi baza bilan hamkorlik — audit
                    </p>
                </div>
                <button onClick={fetchData} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border hover:bg-gray-50">
                    <RefreshCw size={12} /> Yangilash
                </button>
            </div>

            {/* KPI cards */}
            {totals && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <KpiCard color="bg-indigo-50" textColor="text-indigo-700" label="Jami masullar" value={data.supervisors.length} icon={<BadgeCheck size={16} />} />
                    <KpiCard color="bg-emerald-50" textColor="text-emerald-700" label="Jami haydovchilar" value={totals.drivers} icon={<Users size={16} />} />
                    <KpiCard color="bg-sky-50" textColor="text-sky-700" label="Online" value={totals.online} icon={<Wifi size={16} />} />
                    <KpiCard color="bg-amber-50" textColor="text-amber-700" label="Bot orqali" value={totals.bot} icon={<KeyRound size={16} />} />
                    <KpiCard color="bg-violet-50" textColor="text-violet-700" label="Bazalar" value={data.points.length} icon={<Building2 size={16} />} />
                </div>
            )}

            {data.orphans > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <AlertTriangle size={16} />
                    <span><b>{data.orphans}</b> bot orqali kirgan haydovchining audit-mas&apos;uli aniqlanmagan.</span>
                </div>
            )}

            {/* Supervisor cards */}
            <div className="space-y-3">
                {data.supervisors.map(row => {
                    const isExpanded = expanded.has(row.supervisor.id);
                    return (
                        <div key={row.supervisor.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <button
                                onClick={() => toggle(row.supervisor.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-gray-900 truncate">{row.supervisor.name}</span>
                                        {row.supervisor.hasTelegram && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">TG</span>
                                        )}
                                        {!row.supervisor.isActive && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Faol emas</span>
                                        )}
                                        <span className="text-xs text-gray-500">{row.supervisor.phone}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                                        🏭 {row.supervisor.point?.regionUz || '—'}{row.supervisor.point?.cityUz ? `, ${row.supervisor.point.cityUz}` : ''}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Pill label="Haydovchi" value={row.kpis.total} />
                                    <Pill label="Online" value={row.kpis.online} accent="text-emerald-600" />
                                    <Pill label="Bot" value={row.kpis.botRegistered} accent="text-amber-600" />
                                    <Pill label="Taklif" value={row.kpis.invitedByMe} accent="text-indigo-600" />
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-3">
                                    {row.byPoint.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {row.byPoint.map(p => (
                                                <span key={String(p.pointId)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white border border-gray-200">
                                                    <Building2 size={12} className="text-violet-500" />
                                                    {p.regionUz}{p.cityUz && p.cityUz !== '—' ? `, ${p.cityUz}` : ''}: <b>{p.count}</b>
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {row.drivers.length === 0 ? (
                                        <div className="text-sm text-gray-500 italic">Ushbu mas&apos;ulga haydovchi biriktirilmagan</div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left">Haydovchi</th>
                                                        <th className="px-3 py-2 text-left">Baza</th>
                                                        <th className="px-3 py-2 text-center">Holat</th>
                                                        <th className="px-3 py-2 text-center">Bot</th>
                                                        <th className="px-3 py-2 text-center">Parol</th>
                                                        <th className="px-3 py-2 text-center">Tariflar</th>
                                                        <th className="px-3 py-2 text-center">Taklif</th>
                                                        <th className="px-3 py-2 text-left">Ro&apos;yxatga olingan</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {row.drivers.map(d => (
                                                        <tr key={d.id} className="hover:bg-gray-50">
                                                            <td className="px-3 py-2">
                                                                <div className="font-semibold text-gray-900">{d.name}</div>
                                                                <div className="text-xs text-gray-500">{d.phone}</div>
                                                            </td>
                                                            <td className="px-3 py-2 text-xs text-gray-600">
                                                                {d.point ? `${d.point.regionUz}, ${d.point.cityUz}` : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                {d.isOnline
                                                                    ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><Wifi size={12} /> online</span>
                                                                    : <span className="inline-flex items-center gap-1 text-gray-400 text-xs"><WifiOff size={12} /> offline</span>}
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                {d.hasRegistrationCode
                                                                    ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Bot kodi bor"></span>
                                                                    : <span className="inline-block w-2 h-2 rounded-full bg-gray-300" title="Yo'q"></span>}
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                {d.hasPassword
                                                                    ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Parol o'rnatilgan"></span>
                                                                    : <span className="inline-block w-2 h-2 rounded-full bg-gray-300" title="Yo'q"></span>}
                                                            </td>
                                                            <td className="px-3 py-2 text-center text-xs">
                                                                {d.acceptedMaterialsCount > 0
                                                                    ? <span className="text-indigo-600 font-semibold">{d.acceptedMaterialsCount}</span>
                                                                    : <span className="text-gray-400">—</span>}
                                                            </td>
                                                            <td className="px-3 py-2 text-center text-xs">
                                                                {d.invitedByMe
                                                                    ? <span className="inline-flex items-center gap-1 text-indigo-600 text-xs"><BadgeCheck size={12} /></span>
                                                                    : <span className="text-gray-400">—</span>}
                                                            </td>
                                                            <td className="px-3 py-2 text-xs text-gray-500">
                                                                {d.registeredAt
                                                                    ? new Date(d.registeredAt).toLocaleDateString('ru-RU')
                                                                    : (d.invitedAt ? new Date(d.invitedAt).toLocaleDateString('ru-RU') : '—')}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bazalar bo'yicha yig'indi */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Building2 size={14} className="text-violet-600" />
                        Bazalar bo&apos;yicha — qaysi punkt bilan qancha haydovchi hamkorlik qiladi
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="px-4 py-2 text-left">Baza (region, shahar)</th>
                                <th className="px-4 py-2 text-center">Masullar</th>
                                <th className="px-4 py-2 text-center">Haydovchilar</th>
                                <th className="px-4 py-2 text-center">Ushbu punktda taklif qilingan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.points.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-semibold text-gray-900">{p.regionUz}, <span className="text-gray-500 font-normal">{p.cityUz}</span></td>
                                    <td className="px-4 py-2 text-center">{p.supervisorsCount}</td>
                                    <td className="px-4 py-2 text-center font-bold text-emerald-600">{p.driversCount}</td>
                                    <td className="px-4 py-2 text-center text-indigo-600">{p.invitedDriversCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function KpiCard({ color, textColor, label, value, icon }: { color: string; textColor: string; label: string; value: number; icon: React.ReactNode }) {
    return (
        <div className={`${color} rounded-xl p-4 border border-white`}>
            <div className={`flex items-center gap-2 ${textColor} text-xs font-semibold`}>
                {icon} {label}
            </div>
            <div className={`text-2xl font-extrabold ${textColor} mt-1`}>{value}</div>
        </div>
    );
}

function Pill({ label, value, accent = 'text-gray-700' }: { label: string; value: number; accent?: string }) {
    return (
        <div className="text-center">
            <div className={`text-base font-extrabold ${accent}`}>{value}</div>
            <div className="text-[10px] uppercase text-gray-400 font-semibold">{label}</div>
        </div>
    );
}
