'use client';

import Image from 'next/image';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    TrendingUp, ShoppingBag, DollarSign,
    ArrowUpRight, ArrowDownRight, RefreshCw, Package,
    ChevronRight, Box
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import SalesFunnel from './components/SalesFunnel';
import RegionSalesMap from './components/RegionSalesMap';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardData {
    summary: {
        totalOrders: number;
        newOrders: number;
        totalRevenue: number;
        periodRevenue: number;
        completedOrders: number;
        conversionRate: number;
        periodOrders: number;
        aov: number;
        cancelRate: number;
        repeatRate: number;
        cancelledOrders: number;
        peakHour: number;
    };
    trends: {
        ordersGrowth: number;
        revenueGrowth: number;
        conversionChange: number;
    };
    topProducts: {
        productId: number;
        name: string;
        image: string | null;
        totalSold: number;
        orderCount: number;
    }[];
    ordersByStatus: { status: string; _count: { status: number } }[];
    dailyRevenue: { date: string; revenue: number; orders: number }[];
    funnelData: {
        draft: number;
        new: number;
        processing: number;
        shipping: number;
        delivered: number;
        cancelled: number;
    } | null;
    regionSales: { region: string; orders: number; revenue: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('ru-RU'); }
function fmtM(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
    return fmt(n);
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    new:        { label: 'Yangi',      color: '#3b82f6' },
    processing: { label: 'Jarayonda', color: '#8b5cf6' },
    shipping:   { label: "Yo'lda",    color: '#f59e0b' },
    delivered:  { label: 'Yetkazildi',color: '#10b981' },
    cancelled:  { label: 'Bekor',     color: '#ef4444' },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
    label, value, sub, icon: Icon, color, trend, loading,
}: {
    label: string; value: string; sub: string;
    icon: (props: { size?: number; className?: string }) => React.ReactNode;
    color: string; trend?: number; loading: boolean;
}) {
    if (loading) return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-28 mb-4" />
            <div className="h-8 bg-gray-100 rounded w-36 mb-2" />
            <div className="h-2.5 bg-gray-50 rounded w-20" />
        </div>
    );
    const isUp = (trend ?? 0) >= 0;
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-gray-500 font-medium">{label}</p>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon size={18} className="text-white" />
                </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 mb-1">{value}</p>
            <div className="flex items-center gap-2">
                {trend !== undefined && (
                    <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {Math.abs(trend)}%
                    </span>
                )}
                <span className="text-xs text-gray-400">{sub}</span>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(30);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/reports?period=${period}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
                setLastRefresh(new Date());
            }
        } catch (e) {
            console.error('[Dashboard]', e);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-refresh every 2 minutes
    useEffect(() => {
        const interval = setInterval(fetchData, 120_000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const s = data?.summary;
    const pieData = (data?.ordersByStatus ?? [])
        .filter(o => o.status !== 'draft')
        .map(o => ({
            name:  STATUS_LABELS[o.status]?.label ?? o.status,
            value: o._count.status,
            color: STATUS_LABELS[o.status]?.color ?? '#9ca3af',
        }));

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">Dashboard</h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Yangilandi: {lastRefresh.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Period selector */}
                    <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white text-sm">
                        {[7, 30, 90].map(d => (
                            <button
                                key={d}
                                onClick={() => setPeriod(d)}
                                className={`px-4 py-2 font-semibold transition-colors ${period === d ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                {d}k
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        title="Yangilash"
                        aria-label="Yangilash"
                        className="w-9 h-9 bg-white rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw size={14} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Davr buyurtmalari"  value={loading ? '…' : fmt(s?.periodOrders ?? 0)}         sub={`${period} kun`}          icon={ShoppingBag}   color="bg-blue-500"    trend={data?.trends?.ordersGrowth}  loading={loading} />
                <StatCard label="Davr daromadi"       value={loading ? '…' : `${fmtM(s?.periodRevenue ?? 0)} so'm`} sub="yetkazildilar bilan" icon={DollarSign}    color="bg-emerald-500" trend={data?.trends?.revenueGrowth}   loading={loading} />
                <StatCard label="Konversiya"           value={loading ? '…' : `${s?.conversionRate ?? 0}%`}  sub="yetkazildi / jami"        icon={TrendingUp}    color="bg-purple-500"  trend={data?.trends?.conversionChange}  loading={loading} />
                <StatCard label="Jami buyurtmalar"    value={loading ? '…' : fmt(s?.totalOrders ?? 0)}      sub="barcha vaqt"               icon={Package}       color="bg-orange-500"  loading={loading} />
            </div>

            {/* Extended KPI row */}
            {!loading && s && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                        <p className="text-xs text-gray-400 mb-1">O&apos;rtacha buyurtma (AOV)</p>
                        <p className="text-xl font-extrabold text-gray-900">{fmtM(s.aov)} <span className="text-xs font-normal text-gray-400">so&apos;m</span></p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                        <p className="text-xs text-gray-400 mb-1">Takroriy mijozlar</p>
                        <p className="text-xl font-extrabold text-emerald-600">{s.repeatRate}%</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                        <p className="text-xs text-gray-400 mb-1">Bekor qilish</p>
                        <p className={`text-xl font-extrabold ${s.cancelRate > 20 ? 'text-red-500' : 'text-gray-700'}`}>{s.cancelRate}%</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                        <p className="text-xs text-gray-400 mb-1">Yetkazildi (davr)</p>
                        <p className="text-xl font-extrabold text-emerald-600">{fmt(s.completedOrders)}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                        <p className="text-xs text-gray-400 mb-1">⏰ Eng faol soat</p>
                        <p className="text-xl font-extrabold text-blue-600">{s.peakHour}:00</p>
                    </div>
                </div>
            )}

            {/* Charts row */}
            <div className="grid lg:grid-cols-3 gap-5">
                {/* Revenue area chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <p className="font-bold text-gray-800">Kunlik daromad</p>
                        <Link href="/admin/reports" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                            Batafsil <ChevronRight size={12} />
                        </Link>
                    </div>
                    {loading ? (
                        <div className="h-52 bg-gray-50 rounded-xl animate-pulse" />
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={data?.dailyRevenue ?? []}>
                                <defs>
                                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <YAxis tickFormatter={v => fmtM(Number(v))} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
                                <Tooltip
                                    formatter={(v) => [`${fmt(Number(v ?? 0))} so'm`, 'Daromad']}
                                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#areaGrad)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Status pie */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <p className="font-bold text-gray-800 mb-5">Status taqsimoti</p>
                    {loading ? (
                        <div className="h-52 bg-gray-50 rounded-xl animate-pulse" />
                    ) : pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
                                    {pieData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-52 flex items-center justify-center text-gray-300 text-sm">Ma&apos;lumot yo&apos;q</div>
                    )}
                </div>
            </div>

            {/* Funnel + Region row */}
            <div className="grid lg:grid-cols-2 gap-5">
                <SalesFunnel data={data?.funnelData ?? null} loading={loading} />
                <RegionSalesMap data={data?.regionSales ?? []} loading={loading} />
            </div>

            {/* Bar + Top products */}
            <div className="grid lg:grid-cols-3 gap-5">
                {/* Orders bar */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <p className="font-bold text-gray-800 mb-5">Kunlik buyurtmalar soni</p>
                    {loading ? (
                        <div className="h-44 bg-gray-50 rounded-xl animate-pulse" />
                    ) : (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={data?.dailyRevenue ?? []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip
                                    formatter={v => [Number(v ?? 0), 'Buyurtmalar']}
                                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }}
                                />
                                <Bar dataKey="orders" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Top products */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                        <p className="font-bold text-gray-800 text-sm">🏆 Top mahsulotlar</p>
                        <Link href="/admin/products" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                            Barchasi <ChevronRight size={12} />
                        </Link>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="p-3 flex items-center gap-3 animate-pulse">
                                    <div className="w-9 h-9 bg-gray-100 rounded-xl" />
                                    <div className="flex-1">
                                        <div className="h-3 bg-gray-100 rounded w-24 mb-1.5" />
                                        <div className="h-2.5 bg-gray-50 rounded w-16" />
                                    </div>
                                    <div className="h-3 bg-gray-100 rounded w-10" />
                                </div>
                            ))
                        ) : (data?.topProducts ?? []).length === 0 ? (
                            <div className="p-8 text-center text-gray-300 text-sm">Ma&apos;lumot yo&apos;q</div>
                        ) : (
                            (data?.topProducts ?? []).slice(0, 6).map((p, i) => (
                                <div key={p.productId} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                                    <span className={`w-5 text-[11px] font-extrabold ${i < 3 ? 'text-amber-500' : 'text-gray-400'}`}>{i + 1}</span>
                                    <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                                        {p.image ? <Image src={p.image} alt="" className="w-full h-full object-contain" width={300} height={300} /> : <Box size={14} className="text-gray-300" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                                        <p className="text-[10px] text-gray-400">{p.orderCount} buyurtma</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-extrabold text-gray-900">{fmt(p.totalSold)}</p>
                                        <p className="text-[10px] text-gray-400">dona</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Quick status overview */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(STATUS_LABELS).map(([key, meta]) => {
                    const count = data?.ordersByStatus.find(o => o.status === key)?._count?.status ?? 0;
                    return (
                        <Link key={key} href={`/admin/orders?status=${key}`}
                            className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow flex items-center justify-between"
                        >
                            <div>
                                <p className="text-xs text-gray-500 mb-1">{meta.label}</p>
                                <p className="text-xl font-extrabold text-gray-900">{loading ? '…' : count}</p>
                            </div>
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: meta.color + '20' }}
                            >
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color }} />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
