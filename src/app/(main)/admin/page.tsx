'use client';

import { useEffect, useState } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import {
    TrendingUp, ShoppingCart, Package, ArrowUpRight,
    ArrowDownRight, RefreshCw, Users, DollarSign,
    Clock, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
    totalOrders: number;
    newOrders: number;
    thisMonthRevenue: number;
    lastMonthRevenue: number;
    revenueGrowth: number;
    totalProducts: number;
    totalCategories: number;
    recentOrders: {
        id: number;
        customerName: string | null;
        contactPhone: string | null;
        totalAmount: number | null;
        status: string;
        createdAt: string;
    }[];
    chartData: { name: string; orders: number; revenue: number }[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    new:        { bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500',   label: 'Yangi' },
    processing: { bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Jarayonda' },
    shipping:   { bg: 'bg-indigo-50',  text: 'text-indigo-700', dot: 'bg-indigo-500', label: "Yo'lda" },
    delivered:  { bg: 'bg-emerald-50', text: 'text-emerald-700',dot: 'bg-emerald-500',label: 'Yetkazildi' },
    cancelled:  { bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500',    label: 'Bekor' },
    draft:      { bg: 'bg-gray-50',    text: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Qoralama' },
};

function formatMoney(amount: number): string {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M so'm`;
    if (amount >= 1_000)     return `${(amount / 1_000).toFixed(0)}K so'm`;
    return `${amount.toLocaleString()} so'm`;
}

function StatCard({
    title, value, sub, growth, icon: Icon, color, loading
}: {
    title: string;
    value: string;
    sub?: string;
    growth?: number;
    icon: any;
    color: string;
    loading?: boolean;
}) {
    const isPositive = (growth ?? 0) >= 0;
    return (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon size={18} className="text-white" />
                </div>
                {growth !== undefined && (
                    <span className={`flex items-center gap-0.5 text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        {Math.abs(growth)}%
                    </span>
                )}
            </div>
            {loading ? (
                <div className="space-y-2">
                    <div className="h-7 bg-gray-100 rounded animate-pulse w-24" />
                    <div className="h-3 bg-gray-50 rounded animate-pulse w-16" />
                </div>
            ) : (
                <>
                    <p className="text-2xl font-extrabold text-gray-900">{value}</p>
                    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                </>
            )}
            <p className="text-xs text-gray-500 mt-1 font-medium">{title}</p>
        </div>
    );
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchStats = async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await fetch('/api/admin/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
                setLastUpdated(new Date());
            }
        } catch (e) {
            console.error('[Dashboard]', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(() => fetchStats(true), 60_000); // auto-refresh 1 min
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">Boshqaruv Paneli</h1>
                    {lastUpdated && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock size={10} /> Yangilangan: {lastUpdated.toLocaleTimeString('uz-UZ')}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => fetchStats(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-600 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:border-blue-300 transition-all"
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-500' : ''} />
                    {refreshing ? 'Yangilanmoqda...' : 'Yangilash'}
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Bu oy daromad"
                    value={stats ? formatMoney(stats.thisMonthRevenue) : '–'}
                    sub={stats ? `O'tgan oy: ${formatMoney(stats.lastMonthRevenue)}` : ''}
                    growth={stats?.revenueGrowth}
                    icon={DollarSign}
                    color="bg-blue-600"
                    loading={loading}
                />
                <StatCard
                    title="Jami buyurtmalar"
                    value={stats ? stats.totalOrders.toString() : '–'}
                    sub={stats?.newOrders ? `${stats.newOrders} ta yangi` : ''}
                    icon={ShoppingCart}
                    color="bg-emerald-600"
                    loading={loading}
                />
                <StatCard
                    title="Mahsulotlar"
                    value={stats ? stats.totalProducts.toString() : '–'}
                    sub={stats ? `${stats.totalCategories} kategoriya` : ''}
                    icon={Package}
                    color="bg-purple-600"
                    loading={loading}
                />
                <StatCard
                    title="Yangi buyurtmalar"
                    value={stats ? stats.newOrders.toString() : '–'}
                    sub="Hozir kutilmoqda"
                    icon={AlertCircle}
                    color="bg-amber-500"
                    loading={loading}
                />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Revenue area chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-gray-800">Daromad grafigi</p>
                            <p className="text-xs text-gray-400">So'nggi 7 kun</p>
                        </div>
                        <TrendingUp size={16} className="text-blue-500" />
                    </div>
                    {loading ? (
                        <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={stats?.chartData ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <YAxis tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={45} />
                                <Tooltip formatter={(value) => [formatMoney(Number(value ?? 0)), 'Daromad']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', fontSize: 12 }} />
                                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRevenue)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Orders bar chart */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-gray-800">Buyurtmalar</p>
                            <p className="text-xs text-gray-400">So'nggi 7 kun</p>
                        </div>
                        <ShoppingCart size={16} className="text-emerald-500" />
                    </div>
                    {loading ? (
                        <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={stats?.chartData ?? []} margin={{ top: 5, right: 0, left: -15, bottom: 0 }} barSize={14}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', fontSize: 12 }} formatter={(v) => [Number(v ?? 0), 'Buyurtmalar']} />
                                <Bar dataKey="orders" fill="#10b981" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-50">
                    <p className="font-bold text-gray-800">So'nggi buyurtmalar</p>
                    <Link href="/admin/orders" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                        Barchasini ko'rish →
                    </Link>
                </div>
                {loading ? (
                    <div className="p-5 space-y-3">
                        {[1,2,3,4,5].map(i => (
                            <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : !stats?.recentOrders?.length ? (
                    <div className="p-12 text-center text-gray-400">
                        <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Buyurtmalar yo'q</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {stats.recentOrders.map(order => {
                            const s = STATUS_STYLES[order.status] ?? STATUS_STYLES.draft;
                            return (
                                <div key={order.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <ShoppingCart size={13} className="text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">
                                                {order.customerName || 'Noma\'lum'} <span className="font-mono text-gray-400">#{order.id}</span>
                                            </p>
                                            <p className="text-xs text-gray-400">{order.contactPhone || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                                        <p className="text-sm font-bold text-gray-900 hidden sm:block">
                                            {formatMoney(order.totalAmount ?? 0)}
                                        </p>
                                        <p className="text-xs text-gray-400 hidden md:block">
                                            {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { href: '/admin/orders',   icon: ShoppingCart, label: "Buyurtmalar",   color: 'text-blue-600 bg-blue-50', count: stats?.newOrders },
                    { href: '/admin/products', icon: Package,      label: "Mahsulotlar",   color: 'text-purple-600 bg-purple-50', count: stats?.totalProducts },
                    { href: '/admin/news',     icon: AlertCircle,  label: "Yangiliklar",   color: 'text-amber-600 bg-amber-50' },
                    { href: '/admin/customers',icon: Users,        label: "Mijozlar",      color: 'text-emerald-600 bg-emerald-50' },
                ].map(item => (
                    <Link key={item.href} href={item.href} className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-blue-100 transition-all text-center group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                            <item.icon size={18} />
                        </div>
                        <p className="text-xs font-bold text-gray-700">{item.label}</p>
                        {item.count !== undefined && (
                            <span className="text-xs font-extrabold text-gray-900">{item.count}</span>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
}
