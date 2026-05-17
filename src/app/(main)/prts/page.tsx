'use client';

import { useState, useEffect } from 'react';
import {
    Leaf, Recycle, Trophy, CloudSun, Truck, Gift,
    CheckCircle, Loader2, TrendingUp, Award, TreePine, Droplets
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/LanguageContext';

// ─── Types ──────────────────────────────────────────────────────────────────
interface EcoStats {
    points: number;
    totalWeight: number;
    treesSaved: string;
    co2Offset: string;
    waterSaved: string;
    recentRequests: any[];
}

interface MonthlyData {
    month: string;
    qogoz: number;
    karton: number;
    aralash: number;
}

const REWARDS = [
    { id: 'coffee', cost: 150, emoji: '☕', title: 'Kofe chegirma', desc: 'Sevimli kofexonada 50% chegirma', color: 'from-amber-500 to-orange-500' },
    { id: 'transport', cost: 300, emoji: '🚌', title: 'Bepul yo\'llanma', desc: 'Jamoat transporti 1 kunlik bepul', color: 'from-blue-500 to-indigo-500' },
    { id: 'cinema', cost: 500, emoji: '🎬', title: 'Kino chipta', desc: 'Istalgan filmga 1 ta chipta', color: 'from-purple-500 to-pink-500' },
    { id: 'tree', cost: 1000, emoji: '🌳', title: 'Daraxt ekish', desc: 'Sizning nomingizdan daraxt ekiladi', color: 'from-emerald-500 to-teal-500' },
];

const WASTE_TYPES = [
    { value: 'plastic', label: '🧴 Plastik', color: '#3B82F6' },
    { value: 'paper', label: '📄 Qog\'oz', color: '#10B981' },
    { value: 'electronic', label: '💻 Elektronika', color: '#8B5CF6' },
    { value: 'mixed', label: '🗑️ Aralash', color: '#F59E0B' },
];

type TabId = 'dashboard' | 'pickup' | 'rewards';

export default function PRTSPage() {
    const { t, language } = useLanguage();
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');
    const [stats, setStats] = useState<EcoStats | null>(null);
    const [chartData, setChartData] = useState<MonthlyData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pickup state
    const [pickupForm, setPickupForm] = useState({ type: '', weight: '', address: '' });
    const [pickupSubmitting, setPickupSubmitting] = useState(false);
    const [pickupDone, setPickupDone] = useState(false);

    // Redeem state
    const [redeemingId, setRedeemingId] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            fetch('/api/eco/stats').then(r => r.ok ? r.json() : Promise.reject('Tizimga kiring')),
            fetch('/api/prts/monthly-stats').then(r => r.ok ? r.json() : { chartData: [] }),
        ])
            .then(([ecoData, monthlyData]) => {
                setStats(ecoData);
                setChartData(monthlyData.chartData || []);
                setLoading(false);
            })
            .catch(err => {
                setError(typeof err === 'string' ? err : 'Ma\'lumotlarni yuklab bo\'lmadi');
                setLoading(false);
            });
    }, []);

    const handlePickupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pickupForm.type) { toast.error('Chiqindi turini tanlang'); return; }
        if (!pickupForm.weight || Number(pickupForm.weight) <= 0) { toast.error('Og\'irlikni kiriting'); return; }
        if (!pickupForm.address.trim()) { toast.error('Manzilni kiriting'); return; }

        setPickupSubmitting(true);
        await new Promise(r => setTimeout(r, 1500));
        setPickupSubmitting(false);
        setPickupDone(true);
        toast.success('Buyurtma muvaffaqiyatli qabul qilindi! 🎉');
    };

    const handleRedeem = async (rewardId: string) => {
        setRedeemingId(rewardId);
        try {
            const res = await fetch('/api/prts/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rewardId }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`🎁 ${data.reward} — muvaffaqiyatli almashtirildi!`);
                if (stats) setStats({ ...stats, points: data.remaining });
            } else {
                toast.error(data.error || 'Xatolik yuz berdi');
            }
        } catch {
            toast.error('Server bilan aloqa yo\'q');
        }
        setRedeemingId(null);
    };

    const TABS = [
        { id: 'dashboard' as TabId, label: 'Dashboard', icon: TrendingUp },
        { id: 'pickup' as TabId, label: t('recycling.submit'), icon: Truck },
        { id: 'rewards' as TabId, label: t('recycling.eco_shop'), icon: Gift },
    ];

    // ─── Loading ──────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex h-[70vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Leaf className="h-10 w-10 animate-bounce text-emerald-500" />
                    <p className="text-sm text-gray-400 font-medium">{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col h-[60vh] items-center justify-center gap-4">
                <Recycle className="h-12 w-12 text-emerald-300" />
                <p className="text-gray-500">{error}</p>
                <a href="/login" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
                    {t('auth.login')}
                </a>
            </div>
        );
    }

    const points = stats?.points || 0;
    const totalWeight = stats?.totalWeight || 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
            {/* ── Hero Banner ──────────────────────────────────────────────── */}
            <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-400/10 rounded-full blur-2xl -translate-x-1/2 translate-y-1/2" />
                <div className="absolute right-8 bottom-2 text-[140px] opacity-[0.06] select-none leading-none">🌿</div>

                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 relative z-10">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-4 py-1.5 text-sm font-bold text-emerald-200 mb-3">
                                <Leaf size={14} /> PRTS — Recycle Track System
                            </div>
                            <h1 className="text-3xl lg:text-4xl font-extrabold mb-2">
                                Xush kelibsiz, <span className="text-emerald-300">Eko-qahramon!</span> 🌿
                            </h1>
                            <p className="text-emerald-100/70 max-w-lg">
                                Chiqindilarni to&apos;g&apos;ri saralang, tabiatni asrang va mukofotlar yutib oling!
                            </p>
                        </div>
                        <div className="flex items-center gap-3 bg-white/15 backdrop-blur border border-white/20 rounded-2xl px-6 py-4">
                            <Trophy className="h-8 w-8 text-amber-400" />
                            <div>
                                <p className="text-3xl font-black">{points.toLocaleString()}</p>
                                <p className="text-xs text-emerald-200">{t('recycling.my_points')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Tab Navigation ───────────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-5 relative z-20">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-1.5 flex gap-1">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                                    isActive
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                                }`}
                            >
                                <Icon size={18} />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Tab Content ──────────────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* ═══ DASHBOARD TAB ═══ */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { icon: Recycle, label: t('recycling.history'), value: `${totalWeight} kg`, color: 'from-emerald-500 to-teal-500', iconBg: 'bg-emerald-100 text-emerald-600' },
                                { icon: CloudSun, label: 'CO₂', value: `${stats?.co2Offset || '0'} kg`, color: 'from-blue-500 to-cyan-500', iconBg: 'bg-blue-100 text-blue-600' },
                                { icon: Trophy, label: t('recycling.my_points'), value: points.toLocaleString(), color: 'from-amber-500 to-orange-500', iconBg: 'bg-amber-100 text-amber-600' },
                            ].map((kpi, i) => (
                                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
                                            <kpi.icon size={20} />
                                        </div>
                                        <div className={`h-1.5 w-12 rounded-full bg-gradient-to-r ${kpi.color} opacity-60`} />
                                    </div>
                                    <p className="text-2xl font-black text-gray-900">{kpi.value}</p>
                                    <p className="text-sm text-gray-400 mt-1">{kpi.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Qo'shimcha statistika */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { icon: TreePine, value: stats?.treesSaved || '0', label: 'Daraxt saqlandi', color: 'text-green-600 bg-green-50' },
                                { icon: Droplets, value: `${stats?.waterSaved || '0'} L`, label: 'Suv tejaldi', color: 'text-cyan-600 bg-cyan-50' },
                                { icon: Award, value: String(stats?.recentRequests?.length || 0), label: 'So\'nggi arizalar', color: 'text-purple-600 bg-purple-50' },
                                { icon: Recycle, value: `${(totalWeight * 0.017).toFixed(0)}`, label: 'Tonna ekvivalent', color: 'text-teal-600 bg-teal-50' },
                            ].map((s, i) => (
                                <div key={i} className={`${s.color} rounded-xl p-4 text-center`}>
                                    <s.icon size={20} className="mx-auto mb-2" />
                                    <p className="text-lg font-black">{s.value}</p>
                                    <p className="text-[11px] font-medium opacity-70">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Bar Chart */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                            <h3 className="text-lg font-extrabold text-gray-900 mb-1">📊 Oylik statistika</h3>
                            <p className="text-sm text-gray-400 mb-6">Material turlari bo&apos;yicha topshirilgan chiqindilar (kg)</p>
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} barCategoryGap="20%">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                                        <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                            labelStyle={{ fontWeight: 700 }}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                                        <Bar dataKey="qogoz" name="📄 Qog'oz" fill="#10B981" radius={[6, 6, 0, 0]} />
                                        <Bar dataKey="karton" name="📦 Karton" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                                        <Bar dataKey="aralash" name="🗑️ Aralash" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ PICKUP TAB ═══ */}
                {activeTab === 'pickup' && (
                    <div className="max-w-2xl mx-auto animate-in fade-in duration-300">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
                                <div className="flex items-center gap-3 mb-2">
                                    <Truck size={24} />
                                    <h2 className="text-xl font-extrabold">Chiqindi olib ketish</h2>
                                </div>
                                <p className="text-emerald-100/80 text-sm">Chiqindingizni uydan olib ketish uchun buyurtma bering — biz kelamiz!</p>
                            </div>

                            <div className="p-6">
                                {pickupDone ? (
                                    <div className="text-center py-10">
                                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                                            <CheckCircle size={40} className="text-emerald-500" />
                                        </div>
                                        <h3 className="text-xl font-extrabold text-gray-900 mb-2">{t('recycling.success')} 🎉</h3>
                                        <p className="text-gray-500 text-sm mb-6">{t('recycling.success_msg')}</p>
                                        <button
                                            onClick={() => { setPickupDone(false); setPickupForm({ type: '', weight: '', address: '' }); }}
                                            className="text-sm font-semibold text-emerald-600 hover:underline"
                                        >
                                            {t('recycling.submit')}
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handlePickupSubmit} className="space-y-5">
                                        {/* Chiqindi turi */}
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">{t('recycling.material')} *</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {WASTE_TYPES.map(wt => (
                                                    <button
                                                        key={wt.value}
                                                        type="button"
                                                        onClick={() => setPickupForm(f => ({ ...f, type: wt.value }))}
                                                        className={`p-3 rounded-xl border-2 text-sm font-semibold text-left transition-all ${
                                                            pickupForm.type === wt.value
                                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                                                : 'border-gray-100 text-gray-600 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        {wt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Og'irlik */}
                                        <div>
                                            <label htmlFor="prts-weight" className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">{t('recycling.weight')} *</label>
                                            <input
                                                id="prts-weight"
                                                type="number"
                                                min="1"
                                                value={pickupForm.weight}
                                                onChange={e => setPickupForm(f => ({ ...f, weight: e.target.value }))}
                                                placeholder="Masalan: 25"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400 transition-colors"
                                            />
                                        </div>

                                        {/* Manzil */}
                                        <div>
                                            <label htmlFor="prts-address" className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">{t('recycling.address')} *</label>
                                            <textarea
                                                id="prts-address"
                                                value={pickupForm.address}
                                                onChange={e => setPickupForm(f => ({ ...f, address: e.target.value }))}
                                                placeholder="To'liq manzilni kiriting..."
                                                rows={3}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400 transition-colors resize-none"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={pickupSubmitting}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
                                        >
                                            {pickupSubmitting ? (
                                                <><Loader2 size={18} className="animate-spin" /> Yuborilmoqda...</>
                                            ) : (
                                                <><Truck size={18} /> Buyurtma berish</>
                                            )}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ REWARDS TAB ═══ */}
                {activeTab === 'rewards' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Ballar banneri */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-8 text-white shadow-lg">
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent_70%)]" />
                            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div>
                                    <p className="text-emerald-200 text-sm font-bold mb-1">Sizning ballaringiz</p>
                                    <p className="text-5xl font-black">{points.toLocaleString()}</p>
                                    <p className="text-emerald-200/70 text-sm mt-1">PRTS Ball</p>
                                </div>
                                <Trophy className="h-16 w-16 text-amber-400/80" />
                            </div>
                        </div>

                        {/* Mukofotlar */}
                        <div>
                            <h3 className="text-lg font-extrabold text-gray-900 mb-4">🎁 Mukofotlar</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {REWARDS.map(reward => {
                                    const canAfford = points >= reward.cost;
                                    const isRedeeming = redeemingId === reward.id;
                                    return (
                                        <div key={reward.id} className={`bg-white rounded-2xl border p-6 transition-all ${canAfford ? 'border-gray-100 hover:shadow-lg hover:-translate-y-0.5' : 'border-gray-50 opacity-60'}`}>
                                            <div className="flex items-start justify-between mb-4">
                                                <span className="text-4xl">{reward.emoji}</span>
                                                <span className={`text-xs font-black px-3 py-1 rounded-full bg-gradient-to-r ${reward.color} text-white`}>
                                                    {reward.cost} ball
                                                </span>
                                            </div>
                                            <h4 className="text-lg font-extrabold text-gray-900 mb-1">{reward.title}</h4>
                                            <p className="text-sm text-gray-400 mb-4">{reward.desc}</p>
                                            <button
                                                onClick={() => handleRedeem(reward.id)}
                                                disabled={!canAfford || isRedeeming}
                                                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                                                    canAfford
                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                }`}
                                            >
                                                {isRedeeming ? (
                                                    <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Almashtirilmoqda...</span>
                                                ) : canAfford ? (
                                                    '🎁 Almashtirish'
                                                ) : (
                                                    `🔒 ${reward.cost - points} ball yetishmaydi`
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
