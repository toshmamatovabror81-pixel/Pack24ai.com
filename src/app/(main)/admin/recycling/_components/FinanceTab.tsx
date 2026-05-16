'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
    DollarSign, Scale, TrendingUp, Clock, Truck, MapPin,
    Package, ArrowUpRight, ArrowDownRight, Banknote, Wallet,
    Download, Calendar,
} from 'lucide-react';

interface FinanceData {
    summary: {
        totalCollections: number;
        periodCollections: number;
        pendingPayments: number;
        totalWeight: number;
        totalEffectiveWeight: number;
        totalAmount: number;
        totalPaidToDrivers: number;
        totalPaidToCustomers: number;
        avgDiscount: number;
    };
    byDriver: { name: string; phone: string; collections: number; totalWeight: number; totalAmount: number; paid: number }[];
    byPoint: { name: string; collections: number; totalWeight: number; totalAmount: number }[];
    byMaterial: { material: string; count: number; weight: number; amount: number }[];
    dailyReport: { date: string; weight: number; amount: number; count: number }[];
    period: number;
}

const fmt = (n: number) => n.toLocaleString('ru-RU');
const fmtK = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const PERIODS = [
    { label: '7 kun', value: 7 },
    { label: '30 kun', value: 30 },
    { label: '90 kun', value: 90 },
    { label: '1 yil', value: 365 },
];

export default function FinanceTab() {
    const [data, setData] = useState<FinanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(30);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/recycling/finance?period=${period}`);
            if (res.ok) {
                setData(await res.json());
            } else {
                toast.error('Moliyaviy hisobotni yuklashda xatolik');
            }
        } catch {
            toast.error('Server xatosi');
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400 font-medium">Hisobot yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return <div className="text-center py-20 text-gray-400">Ma&apos;lumot topilmadi</div>;
    }

    const s = data.summary;
    const netProfit = s.totalAmount - s.totalPaidToDrivers - s.totalPaidToCustomers;
    const avgPerCollection = s.periodCollections > 0 ? Math.round(s.totalAmount / s.periodCollections) : 0;
    const avgWeightPerCollection = s.periodCollections > 0 ? Math.round(s.totalWeight / s.periodCollections * 10) / 10 : 0;

    return (
        <div className="space-y-6">
            {/* Period Filter */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <span className="text-sm font-bold text-gray-500">Davr:</span>
                    <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                        {PERIODS.map(p => (
                            <button
                                key={p.value}
                                onClick={() => setPeriod(p.value)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    period === p.value
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => window.open(`/api/admin/export?type=recycling&period=${period}`, '_blank')}
                        className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3 py-2 rounded-lg text-xs transition-colors"
                    >
                        <Download size={13} /> Excel
                    </button>
                    <button
                        onClick={() => window.open(`/api/eco/esg-report?userId=1&year=${new Date().getFullYear()}`, '_blank')}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg text-xs transition-colors"
                    >
                        🌍 ESG Hisobot
                    </button>
                </div>
            </div>

            {/* ═══ KPI Kartochkalari ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Jami tushum',
                        value: `${fmt(s.totalAmount)}`,
                        sub: `so'm`,
                        icon: DollarSign,
                        color: 'text-emerald-600',
                        bg: 'bg-emerald-50',
                        trend: s.periodCollections > 0 ? '+' : '',
                    },
                    {
                        label: 'Jami og\'irlik',
                        value: `${fmt(s.totalWeight)}`,
                        sub: `kg (${(s.totalWeight / 1000).toFixed(1)} t)`,
                        icon: Scale,
                        color: 'text-blue-600',
                        bg: 'bg-blue-50',
                    },
                    {
                        label: 'Yig\'ishlar',
                        value: `${s.periodCollections}`,
                        sub: `jami: ${s.totalCollections}`,
                        icon: Package,
                        color: 'text-purple-600',
                        bg: 'bg-purple-50',
                    },
                    {
                        label: 'Kutilayotgan to\'lov',
                        value: `${s.pendingPayments}`,
                        sub: 'ta ariza',
                        icon: Clock,
                        color: 'text-orange-600',
                        bg: 'bg-orange-50',
                    },
                ].map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-9 h-9 ${card.bg} rounded-xl flex items-center justify-center`}>
                                    <Icon size={18} className={card.color} />
                                </div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{card.label}</span>
                            </div>
                            <p className="text-2xl font-black text-gray-900">{card.value}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{card.sub}</p>
                        </div>
                    );
                })}
            </div>

            {/* ═══ Moliyaviy oqim kartochkalari ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowUpRight size={16} />
                        <span className="text-[10px] font-bold uppercase opacity-80">Tushum</span>
                    </div>
                    <p className="text-xl font-black">{fmtK(s.totalAmount)} so&apos;m</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Truck size={16} />
                        <span className="text-[10px] font-bold uppercase opacity-80">Haydovchilarga</span>
                    </div>
                    <p className="text-xl font-black">{fmtK(s.totalPaidToDrivers)} so&apos;m</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Wallet size={16} />
                        <span className="text-[10px] font-bold uppercase opacity-80">Mijozlarga</span>
                    </div>
                    <p className="text-xl font-black">{fmtK(s.totalPaidToCustomers)} so&apos;m</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Banknote size={16} />
                        <span className="text-[10px] font-bold uppercase opacity-80">Sof foyda</span>
                    </div>
                    <p className="text-xl font-black">{fmtK(netProfit)} so&apos;m</p>
                </div>
            </div>

            {/* ═══ O'rtacha ko'rsatkichlar ═══ */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">O&apos;rt. yig&apos;ish narxi</p>
                    <p className="text-xl font-black text-gray-900">{fmt(avgPerCollection)} <span className="text-sm text-gray-400">so&apos;m</span></p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">O&apos;rt. og&apos;irlik</p>
                    <p className="text-xl font-black text-gray-900">{avgWeightPerCollection} <span className="text-sm text-gray-400">kg</span></p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">O&apos;rt. chegirma</p>
                    <p className="text-xl font-black text-gray-900">{s.avgDiscount}<span className="text-sm text-gray-400">%</span></p>
                </div>
            </div>

            {/* ═══ Grafiklar ═══ */}
            {data.dailyReport.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Kunlik tushum */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                                <TrendingUp size={14} className="text-emerald-500" />
                                Kunlik tushum (so&apos;m)
                            </h3>
                            <span className="text-[10px] text-gray-400">{period} kun</span>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={data.dailyReport}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                                    formatter={(value: number) => [`${fmt(value)} so'm`, 'Summa']}
                                />
                                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fill="url(#colorAmount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Kunlik og'irlik */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                                <Scale size={14} className="text-blue-500" />
                                Kunlik yig&apos;ish (kg)
                            </h3>
                            <span className="text-[10px] text-gray-400">{data.dailyReport.length} kun</span>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={data.dailyReport}>
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                                    formatter={(value: number) => [`${value} kg`, 'Og\'irlik']}
                                />
                                <Bar dataKey="weight" fill="#6366f1" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ═══ Haydovchi + Hudud jadvallar ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Haydovchi bo'yicha */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                        <Truck size={14} className="text-indigo-500" />
                        <h3 className="font-bold text-gray-800 text-sm">Haydovchi bo&apos;yicha</h3>
                    </div>
                    {data.byDriver.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Ma&apos;lumot yo&apos;q</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-400 uppercase">Haydovchi</th>
                                        <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase">Soni</th>
                                        <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase">Og&apos;irlik</th>
                                        <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase">Summa</th>
                                        <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase">To&apos;langan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.byDriver.map((d, i) => (
                                        <tr key={i} className="hover:bg-blue-50/30">
                                            <td className="px-4 py-2.5">
                                                <p className="text-sm font-bold text-gray-800">{d.name}</p>
                                                <p className="text-[10px] text-gray-400">{d.phone}</p>
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-600">{d.collections}</td>
                                            <td className="px-3 py-2.5 text-right text-sm text-gray-600">{fmt(Math.round(d.totalWeight))} kg</td>
                                            <td className="px-3 py-2.5 text-right text-sm font-bold text-emerald-700">{fmt(Math.round(d.totalAmount))}</td>
                                            <td className="px-3 py-2.5 text-right text-sm text-blue-600">{fmt(Math.round(d.paid))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Hudud bo'yicha */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                        <MapPin size={14} className="text-emerald-500" />
                        <h3 className="font-bold text-gray-800 text-sm">Hudud bo&apos;yicha</h3>
                    </div>
                    {data.byPoint.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Ma&apos;lumot yo&apos;q</div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-400 uppercase">Hudud</th>
                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase">Soni</th>
                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase">Og&apos;irlik</th>
                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase">Summa</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {data.byPoint.map((p, i) => (
                                            <tr key={i} className="hover:bg-blue-50/30">
                                                <td className="px-4 py-2.5 text-sm font-bold text-gray-800">📍 {p.name}</td>
                                                <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-600">{p.collections}</td>
                                                <td className="px-3 py-2.5 text-right text-sm text-gray-600">{fmt(Math.round(p.totalWeight))} kg</td>
                                                <td className="px-3 py-2.5 text-right text-sm font-bold text-emerald-700">{fmt(Math.round(p.totalAmount))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ═══ Material turlari ═══ */}
            {data.byMaterial.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-1.5">
                            <Package size={14} className="text-amber-500" />
                            Material turlari
                        </h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={data.byMaterial}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={85}
                                    paddingAngle={3}
                                    dataKey="weight"
                                    nameKey="material"
                                >
                                    {data.byMaterial.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Legend
                                    wrapperStyle={{ fontSize: '11px' }}
                                    formatter={(value: string) => <span className="text-gray-600 text-xs">{value}</span>}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                                    formatter={(value: number) => [`${fmt(Math.round(value))} kg`, 'Og\'irlik']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                                <Package size={14} className="text-amber-500" />
                                Material statistikasi
                            </h3>
                        </div>
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-400 uppercase">Material</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase">Soni</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase">Og&apos;irlik</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase">Summa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.byMaterial.map((m, i) => (
                                    <tr key={i} className="hover:bg-blue-50/30">
                                        <td className="px-4 py-2.5 text-sm font-medium text-gray-800">
                                            <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                            {m.material}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-sm text-gray-600">{m.count}</td>
                                        <td className="px-3 py-2.5 text-right text-sm text-gray-600">{fmt(Math.round(m.weight))} kg</td>
                                        <td className="px-3 py-2.5 text-right text-sm font-bold text-emerald-700">{fmt(Math.round(m.amount))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ Ekologik natija ═══ */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-6">
                <h3 className="text-sm font-bold text-emerald-800 mb-4">🌍 Ekologik ta&apos;sir ({period} kun)</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Qayta ishlangan', value: `${(s.totalWeight / 1000).toFixed(1)} t`, emoji: '♻️' },
                        { label: 'CO₂ tejaldi', value: `${(s.totalWeight * 2.5 / 1000).toFixed(1)} t`, emoji: '🌱' },
                        { label: 'Daraxtlar saqlandi', value: `${Math.round(s.totalWeight * 0.017)}`, emoji: '🌳' },
                        { label: 'Suv tejaldi', value: `${fmt(Math.round(s.totalWeight * 26))} L`, emoji: '💧' },
                    ].map((item, i) => (
                        <div key={i} className="text-center">
                            <p className="text-2xl mb-1">{item.emoji}</p>
                            <p className="text-lg font-black text-emerald-800">{item.value}</p>
                            <p className="text-[10px] text-emerald-600 font-medium">{item.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
