'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
    Users, TrendingUp, DollarSign, UserX, Crown,
    RefreshCw, AlertCircle
} from 'lucide-react';

interface AnalyticsData {
    summary: {
        totalCustomers: number;
        newCustomers: number;
        activeCustomers: number;
        churnRate: number;
        avgLtv: number;
    };
    customersByType: { type: string; count: number }[];
    customersByGroup: { group: string; count: number }[];
    topCustomers: { phone: string; name: string; orders: number; revenue: number }[];
    segments: {
        champions: number;
        loyal: number;
        atRisk: number;
        newCustomers: number;
        lost: number;
    };
    dailyNewCustomers: { date: string; count: number }[];
}

function fmtM(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString('ru-RU');
}

const TYPE_LABELS: Record<string, string> = {
    individual: '👤 Jismoniy',
    corporate:  '🏢 Korporativ',
    wholesale:  '📦 Ulgurji',
    dealer:     '🤝 Diler',
};

const SEGMENT_CONFIG = [
    { key: 'champions',    label: '🏆 Chempionlar', color: '#10b981', desc: 'Yaqinda, ko`p, yuqori summa' },
    { key: 'loyal',        label: '💚 Sodiq',       color: '#3b82f6', desc: 'Muntazam xaridorlar' },
    { key: 'newCustomers', label: '🌱 Yangi',       color: '#8b5cf6', desc: 'Yaqinda birinchi buyurtma' },
    { key: 'atRisk',       label: '⚠️ Xavf ostida',  color: '#f59e0b', desc: 'Ilgari faol, hozir yo`q' },
    { key: 'lost',         label: '💤 Yo`qolgan',   color: '#ef4444', desc: '90+ kun buyurtmasiz' },
] as const;

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316'];

export default function CustomerAnalytics() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/customers/analytics');
            if (!res.ok) throw new Error(`Server xatosi (${res.status})`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Noma'lum xato");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
                    ))}
                </div>
                <div className="grid lg:grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                        <div key={i} className="h-72 bg-white rounded-2xl border border-gray-100 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
                <AlertCircle size={18} className="text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
                <button onClick={fetchData} className="ml-auto flex items-center gap-1 text-xs font-bold text-red-600 border border-red-200 px-3 py-1.5 rounded-xl">
                    <RefreshCw size={12} /> Qayta
                </button>
            </div>
        );
    }

    if (!data) return null;

    const s = data.summary;
    const segmentData = SEGMENT_CONFIG.map(seg => ({
        name: seg.label,
        value: data.segments[seg.key as keyof typeof data.segments],
        color: seg.color,
    })).filter(d => d.value > 0);

    const typeData = data.customersByType.map((c, i) => ({
        name: TYPE_LABELS[c.type] ?? c.type,
        value: c.count,
        color: PIE_COLORS[i % PIE_COLORS.length],
    }));

    return (
        <div className="space-y-5">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-5">
                <h2 className="text-base font-extrabold text-gray-900">Analitik CRM</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Segmentatsiya, churn xavfi, o&apos;rtacha LTV, top mijozlar va yangi mijozlar dinamikasi.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                            <Users size={14} className="text-white" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Jami mijozlar</span>
                    </div>
                    <p className="text-2xl font-extrabold text-gray-900">{s.totalCustomers}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                            <TrendingUp size={14} className="text-white" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Yangi mijozlar</span>
                    </div>
                    <p className="text-2xl font-extrabold text-emerald-600">+{s.newCustomers}</p>
                    <p className="text-[10px] text-gray-400">90 kunda</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                            <DollarSign size={14} className="text-white" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">O&apos;rtacha LTV</span>
                    </div>
                    <p className="text-2xl font-extrabold text-purple-600">{fmtM(s.avgLtv)}</p>
                    <p className="text-[10px] text-gray-400">so&apos;m</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                            <Crown size={14} className="text-white" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Faol mijozlar</span>
                    </div>
                    <p className="text-2xl font-extrabold text-amber-600">{s.activeCustomers}</p>
                    <p className="text-[10px] text-gray-400">60 kunda buyurtma berganlar</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg ${s.churnRate > 30 ? 'bg-red-500' : 'bg-gray-400'} flex items-center justify-center`}>
                            <UserX size={14} className="text-white" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Churn xavfi</span>
                    </div>
                    <p className={`text-2xl font-extrabold ${s.churnRate > 30 ? 'text-red-500' : 'text-gray-700'}`}>{s.churnRate}%</p>
                    <p className="text-[10px] text-gray-400">Yo&apos;qolganlar ulushi</p>
                </div>
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-5">
                {/* RFM Segments */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="font-bold text-gray-800 mb-4">📊 Segmentatsiya (RFM)</p>
                    {segmentData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={segmentData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                        {segmentData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="mt-3 space-y-2">
                                {SEGMENT_CONFIG.map(seg => {
                                    const val = data.segments[seg.key as keyof typeof data.segments];
                                    if (val === 0) return null;
                                    return (
                                        <div key={seg.key} className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                                            <span className="text-xs text-gray-600 flex-1">{seg.label}</span>
                                            <span className="text-[10px] text-gray-400">{seg.desc}</span>
                                            <span className="text-xs font-bold text-gray-800">{val}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Ma&apos;lumot yetarli emas</div>
                    )}
                </div>

                {/* Customer Types */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="font-bold text-gray-800 mb-4">👥 Mijoz turlari va portfel tarkibi</p>
                    {typeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={typeData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={120} />
                                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} maxBarSize={24}>
                                    {typeData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Ma&apos;lumot yo&apos;q</div>
                    )}
                </div>
            </div>

            {/* Daily new customers + Top customers */}
            <div className="grid lg:grid-cols-2 gap-5">
                {/* Daily chart */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="font-bold text-gray-800 mb-4">📈 Yangi mijozlar dinamikasi (30 kun)</p>
                    {data.dailyNewCustomers.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={data.dailyNewCustomers}>
                                <defs>
                                    <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                                <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fill="url(#custGrad)" dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-44 flex items-center justify-center text-gray-300 text-sm">Ma&apos;lumot yo&apos;q</div>
                    )}
                </div>

                {/* Top customers */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50">
                        <p className="font-bold text-gray-800 text-sm">🏆 Top mijozlar (daromad bo&apos;yicha)</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {data.topCustomers.length === 0 ? (
                            <div className="p-8 text-center text-gray-300 text-sm">Ma&apos;lumot yo&apos;q</div>
                        ) : (
                            data.topCustomers.map((c, i) => (
                                <div key={c.phone} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                                    <span className={`w-5 text-[11px] font-extrabold ${i < 3 ? 'text-amber-500' : 'text-gray-400'}`}>{i + 1}</span>
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                        {(c.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-gray-800 truncate">{c.name || "Noma'lum"}</p>
                                        <p className="text-[10px] text-gray-400">{c.phone} • {c.orders} buyurtma</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-extrabold text-emerald-600">{fmtM(c.revenue)}</p>
                                        <p className="text-[10px] text-gray-400">so&apos;m</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
