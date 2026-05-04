'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
    Search, Users, Building2, Handshake,
    Crown, UserPlus, RefreshCw, Loader2,
    Phone, ChevronRight, Filter, BarChart3,
    ShoppingCart,
    DollarSign, AlertTriangle, MessageSquare, Headphones, Megaphone
} from 'lucide-react';
import Link from 'next/link';
import CustomerDrawer from './_components/CustomerDrawer';
import CustomerAnalytics from './_components/CustomerAnalytics';

// ── Konfiguratsiya ───────────────────────────────────────────────
const CUSTOMER_TYPES: Record<string, { label: string; color: string; bg: string }> = {
    individual: { label: '👤 Jismoniy', color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
    corporate:  { label: '🏢 Korporativ', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
    wholesale:  { label: '📦 Ulgurji',  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
    dealer:     { label: '🤝 Diler',    color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
};

const CUSTOMER_GROUPS: Record<string, { label: string; dot: string; color: string; bg: string }> = {
    standard: { label: 'Standard',   dot: 'bg-gray-400',   color: 'text-gray-600',  bg: 'bg-gray-50 border-gray-200' },
    vip:      { label: '💎 VIP',     dot: 'bg-amber-500',  color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    new:      { label: '🟢 Yangi',   dot: 'bg-green-500',  color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    inactive: { label: '⚪ Faol emas',dot: 'bg-gray-300',  color: 'text-gray-500',  bg: 'bg-gray-50 border-gray-200' },
    blocked:  { label: '🔴 Bloklangan',dot: 'bg-red-500',  color: 'text-red-600',   bg: 'bg-red-50 border-red-200' },
};

type TypeFilter = 'all' | 'individual' | 'corporate' | 'wholesale' | 'dealer';
type GroupFilter = 'all' | 'standard' | 'vip' | 'new' | 'inactive' | 'blocked' | 'debtor' | 'active';
type CrmView = 'operational' | 'analytical' | 'collaboration';

interface CustomerData {
    id: number | string;
    source: 'registered' | 'guest';
    name: string;
    phone: string;
    email: string | null;
    isActive: boolean;
    customerType: string;
    customerGroup: string;
    companyName: string | null;
    address: string | null;
    notes: string | null;
    createdAt: string;
    totalOrders: number;
    totalRevenue: number;
    totalPaid: number;
    totalDebit: number;
    totalCredit: number;
    lastOrderDate: string | null;
    deliveredOrders: number;
    activeOrders: number;
    cancelledOrders: number;
}

interface Stats {
    total: number;
    registered: number;
    guests: number;
    corporate: number;
    wholesale: number;
    dealer: number;
    vip: number;
    newThisMonth: number;
    inactive: number;
    blocked: number;
    totalRevenue: number;
    totalDebit: number;
    totalPaid: number;
    debtors: number;
    activeWithOrders?: number;
}

function formatMoney(amount: number): string {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
    return amount.toLocaleString();
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<CustomerData[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [activeView, setActiveView] = useState<CrmView>('operational');

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (typeFilter !== 'all') params.set('type', typeFilter);
            if (groupFilter !== 'all') params.set('group', groupFilter);
            params.set('page', page.toString());
            params.set('limit', '30');

            const res = await fetch(`/api/admin/customers?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setCustomers(data.customers);
                setStats(data.stats);
                setTotalPages(data.totalPages);
                setTotal(data.total);
            }
        } catch (e) {
            console.error('[Customers fetch]', e);
        } finally {
            setLoading(false);
        }
    }, [search, typeFilter, groupFilter, page]);

    useEffect(() => {
        const timer = setTimeout(() => fetchCustomers(), search ? 400 : 0);
        return () => clearTimeout(timer);
    }, [fetchCustomers, search]);

    const openDrawer = (customer: CustomerData) => {
        setSelectedCustomer(customer);
        setDrawerOpen(true);
    };

    const TYPE_TABS: { key: TypeFilter; label: string; count?: number }[] = [
        { key: 'all',        label: 'Barchasi',     count: stats?.total },
        { key: 'individual', label: '👤 Jismoniy',  count: stats ? stats.total - (stats.corporate + stats.wholesale + stats.dealer) : undefined },
        { key: 'corporate',  label: '🏢 Korporativ',count: stats?.corporate },
        { key: 'wholesale',  label: '📦 Ulgurji',   count: stats?.wholesale },
        { key: 'dealer',     label: '🤝 Diler',     count: stats?.dealer },
    ];

    const GROUP_TABS: { key: GroupFilter; label: string; count?: number }[] = [
        { key: 'all',      label: 'Barchasi' },
        { key: 'debtor',   label: '💰 Qarzdorlar', count: stats?.debtors },
        { key: 'active',   label: '⚡ Faol buyurtma', count: stats?.activeWithOrders },
        { key: 'vip',      label: '💎 VIP',        count: stats?.vip },
        { key: 'new',      label: '🟢 Yangi',      count: stats?.newThisMonth },
        { key: 'inactive', label: '⚪ Faol emas',   count: stats?.inactive },
        { key: 'blocked',  label: '🔴 Bloklangan',  count: stats?.blocked },
    ];

    const CRM_VIEWS: { key: CrmView; label: string; description: string; icon: ReactNode }[] = [
        { key: 'operational', label: 'Operatsion CRM', description: 'Jarayonlar, segmentlar va tezkor Customer 360', icon: <Users size={14} /> },
        { key: 'analytical', label: 'Analitik CRM', description: 'Segmentatsiya, churn, LTV va daromad tahlili', icon: <BarChart3 size={14} /> },
        { key: 'collaboration', label: 'Hamkorlik CRM', description: 'Aloqa kanallari va jamoaviy ish markazi', icon: <Handshake size={14} /> },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">Mijozlar CRM</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Mijozlar + Ma&apos;lumot + Avtomatlashtirish
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {stats ? `${stats.total} ta mijoz` : 'Yuklanmoqda...'}
                        {stats?.guests ? ` (${stats.registered} ro'yxatdan + ${stats.guests} mehmon)` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white text-sm">
                        {CRM_VIEWS.map(view => (
                            <button
                                key={view.key}
                                onClick={() => setActiveView(view.key)}
                                title={view.description}
                                className={`px-4 py-2 font-semibold transition-colors flex items-center gap-1.5 ${activeView === view.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                {view.icon} {view.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => fetchCustomers()}
                        disabled={loading}
                        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Yangilash
                    </button>
                </div>
            </div>

            {/* Analytical CRM */}
            {activeView === 'analytical' && <CustomerAnalytics />}

            {/* Operational CRM */}
            {activeView === 'operational' && (
            <>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                        <Users size={18} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-extrabold text-gray-900">Operatsion CRM</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Turli kanallardan kelgan mijozlarni bitta ro&apos;yxatda ko&apos;rib, segment, qarzdorlik,
                            faol buyurtma va Customer 360 profiliga tez o&apos;ting.
                        </p>
                    </div>
                </div>
            </div>

            {/* Stat Cards — Moliyaviy */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center mb-2">
                            <Users size={14} className="text-white" />
                        </div>
                        <p className="text-xl font-extrabold text-gray-900">{stats.total}</p>
                        <p className="text-[10px] text-gray-400">Jami mijozlar</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center mb-2">
                            <Building2 size={14} className="text-white" />
                        </div>
                        <p className="text-xl font-extrabold text-gray-900">{stats.corporate}</p>
                        <p className="text-[10px] text-gray-400">Korporativ</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center mb-2">
                            <DollarSign size={14} className="text-white" />
                        </div>
                        <p className="text-xl font-extrabold text-emerald-600">{formatMoney(stats.totalPaid)}</p>
                        <p className="text-[10px] text-gray-400">Jami to&apos;langan</p>
                    </div>
                    <div className={`rounded-2xl border p-4 shadow-sm ${stats.totalDebit > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${stats.totalDebit > 0 ? 'bg-red-500' : 'bg-gray-400'}`}>
                            <AlertTriangle size={14} className="text-white" />
                        </div>
                        <p className={`text-xl font-extrabold ${stats.totalDebit > 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatMoney(stats.totalDebit)}</p>
                        <p className="text-[10px] text-gray-400">Debitor qarzdorlik</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center mb-2">
                            <Crown size={14} className="text-white" />
                        </div>
                        <p className="text-xl font-extrabold text-gray-900">{stats.vip}</p>
                        <p className="text-[10px] text-gray-400">VIP</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center mb-2">
                            <UserPlus size={14} className="text-white" />
                        </div>
                        <p className="text-xl font-extrabold text-gray-900">{stats.newThisMonth}</p>
                        <p className="text-[10px] text-gray-400">Bu oy yangi</p>
                    </div>
                </div>
            )}

            {/* Filtrlar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {TYPE_TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setTypeFilter(tab.key); setPage(1); }}
                            className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                typeFilter === tab.key
                                    ? 'bg-gray-900 text-white shadow-md'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-extrabold ${
                                    typeFilter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                                }`}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto">
                    <Filter size={14} className="text-gray-400 shrink-0" />
                    {GROUP_TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setGroupFilter(tab.key); setPage(1); }}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                groupFilter === tab.key
                                    ? tab.key === 'debtor' ? 'bg-red-600 text-white' : tab.key === 'active' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="ml-1 opacity-70">({tab.count})</span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
                        placeholder="Ism, telefon yoki kompaniya nomi..."
                    />
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={28} className="animate-spin text-blue-500" />
                </div>
            )}

            {/* Empty */}
            {!loading && customers.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                    <Users size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-500 font-semibold">Mijozlar topilmadi</p>
                </div>
            )}

            {/* Table */}
            {!loading && customers.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50/80 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Mijoz</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Turi</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase hidden md:table-cell">Aloqa / oxirgi</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase hidden sm:table-cell">Jami</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase hidden lg:table-cell">Faol</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase hidden lg:table-cell">To&apos;langan</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase hidden lg:table-cell">Qarz</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {customers.map(c => {
                                    const typeCfg = CUSTOMER_TYPES[c.customerType] ?? CUSTOMER_TYPES.individual;
                                    const groupCfg = CUSTOMER_GROUPS[c.customerGroup] ?? CUSTOMER_GROUPS.standard;
                                    return (
                                        <tr
                                            key={c.id}
                                            onClick={() => openDrawer(c)}
                                            className={`hover:bg-blue-50/30 transition-colors cursor-pointer group ${!c.isActive ? 'opacity-50' : ''}`}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                                                        c.source === 'guest' ? 'bg-gray-400' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                                    }`}>
                                                        {c.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="font-bold text-gray-800 text-sm truncate">{c.name}</p>
                                                            {c.source === 'guest' && (
                                                                <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold shrink-0">Mehmon</span>
                                                            )}
                                                        </div>
                                                        {c.companyName && (
                                                            <p className="text-[10px] text-purple-600 font-semibold flex items-center gap-0.5">
                                                                <Building2 size={9} />{c.companyName}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit ${typeCfg.bg} ${typeCfg.color}`}>
                                                        {typeCfg.label}
                                                    </span>
                                                    {c.customerGroup !== 'standard' && (
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit flex items-center gap-1 ${groupCfg.bg} ${groupCfg.color}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${groupCfg.dot}`} />
                                                            {groupCfg.label}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className="text-xs text-gray-600 flex items-center gap-1">
                                                    <Phone size={11} className="text-gray-400" />{c.phone}
                                                </span>
                                                <p className="text-[10px] text-gray-400 mt-1">
                                                    {c.lastOrderDate ? `Oxirgi: ${new Date(c.lastOrderDate).toLocaleDateString('uz-UZ')}` : 'Buyurtma yo&apos;q'}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-right hidden sm:table-cell">
                                                <span className="font-extrabold text-gray-900 text-sm">{formatMoney(c.totalRevenue)}</span>
                                                <p className="text-[10px] text-gray-400">{c.totalOrders} buyurtma</p>
                                            </td>
                                            <td className="px-4 py-3 text-center hidden lg:table-cell">
                                                {c.activeOrders > 0 ? (
                                                    <span className="inline-flex items-center justify-center min-w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold">
                                                        {c.activeOrders}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right hidden lg:table-cell">
                                                <span className="text-sm font-bold text-emerald-600">{formatMoney(c.totalPaid)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right hidden lg:table-cell">
                                                {c.totalDebit > 0 ? (
                                                    <span className="text-sm font-bold text-red-600 flex items-center justify-end gap-1">
                                                        <AlertTriangle size={12} />
                                                        {formatMoney(c.totalDebit)}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <p className="text-xs text-gray-500">{total} ta mijozdan {customers.length} ta</p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                                >← Oldingi</button>
                                <span className="text-xs font-bold text-gray-700">{page}/{totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                                >Keyingi →</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            </>
            )}

            {/* Collaborative CRM */}
            {activeView === 'collaboration' && (
                <div className="space-y-5">
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-5">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                                <Handshake size={18} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-base font-extrabold text-gray-900">Hamkorlik CRM</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Mijoz bilan aloqa nuqtalarini bir joyga yig&apos;ish: call-center, chat, marketing va buyurtmalar.
                                    MVPda bu panel real mavjud admin bo&apos;limlariga tezkor o&apos;tish markazi sifatida ishlaydi.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {[
                            { href: '/admin/customers/calls', title: 'Call Center', desc: "Telefon qo'ng'iroqlari va operator ishlari", icon: <Headphones size={18} />, badge: 'Aloqa' },
                            { href: '/admin/chat', title: 'Chat', desc: 'Telegram, sayt va ijtimoiy kanal suhbatlari', icon: <MessageSquare size={18} />, badge: 'Muloqot' },
                            { href: '/admin/marketing/newsletter', title: 'Marketing', desc: 'Newsletter, aksiyalar va mijoz auditoriyasi', icon: <Megaphone size={18} />, badge: 'Kampaniya' },
                            { href: '/admin/orders', title: 'Buyurtmalar', desc: 'Mijoz operatsiyalari va bajarilish jarayoni', icon: <ShoppingCart size={18} />, badge: 'Operatsiya' },
                        ].map(item => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
                                        {item.icon}
                                    </div>
                                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">{item.badge}</span>
                                </div>
                                <h3 className="text-sm font-extrabold text-gray-900 mt-4">{item.title}</h3>
                                <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                                <p className="text-[10px] text-gray-400 mt-4">Mavjud admin bo&apos;limiga o&apos;tish →</p>
                            </Link>
                        ))}
                    </div>

                    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-5">
                        <h3 className="text-sm font-extrabold text-gray-900">Keyingi integratsiya chegarasi</h3>
                        <p className="text-xs text-gray-500 mt-2">
                            Real aloqa timeline, xodim izohlari, task/comment API va kampaniya attribution modeli keyingi bosqichda DB modeli bilan qo&apos;shiladi.
                            Hozircha Customer 360 profili haqiqat manbasi bo&apos;lib qoladi.
                        </p>
                    </div>
                </div>
            )}

            {/* Drawer */}
            <CustomerDrawer
                isOpen={drawerOpen}
                onClose={() => { setDrawerOpen(false); setSelectedCustomer(null); }}
                customer={selectedCustomer}
                onSaved={() => fetchCustomers()}
            />
        </div>
    );
}
