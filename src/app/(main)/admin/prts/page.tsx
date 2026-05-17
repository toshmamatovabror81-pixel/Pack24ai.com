'use client';

import { useState, useEffect } from 'react';
import {
    Leaf, Trophy, Users, TreePine, Wind, Droplets,
    Loader2, RefreshCw, Download, Medal, Zap, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

interface LeaderEntry {
    rank: number;
    id: number;
    name: string;
    ecoLevel: string;
    ecoPoints: number;
    totalKg: number;
    co2Saved: number;
    trees: number;
    streak: number;
    badgeCount: number;
}

interface LeaderboardData {
    leaderboard: LeaderEntry[];
    total: number;
}

const LEVEL_CFG: Record<string, { emoji: string; color: string; bg: string }> = {
    bronze:    { emoji: '🥉', color: 'text-amber-700',  bg: 'bg-amber-50' },
    silver:    { emoji: '🥈', color: 'text-slate-600',  bg: 'bg-slate-50' },
    gold:      { emoji: '🥇', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    platinum:  { emoji: '💎', color: 'text-blue-600',   bg: 'bg-blue-50' },
    eco_hero:  { emoji: '🌍', color: 'text-emerald-700',bg: 'bg-emerald-50' },
    starter:   { emoji: '🌱', color: 'text-green-600',  bg: 'bg-green-50' },
};

function RANK_BADGE({ rank }: { rank: number }) {
    if (rank === 1) return <span className="text-xl">🥇</span>;
    if (rank === 2) return <span className="text-xl">🥈</span>;
    if (rank === 3) return <span className="text-xl">🥉</span>;
    return <span className="font-bold text-gray-400 text-sm">#{rank}</span>;
}

export default function AdminPRTSPage() {
    const [data, setData] = useState<LeaderboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'week' | 'month' | 'all'>('all');

    // Global platform eco totals (computed from leaderboard)
    const totalKg = data?.leaderboard.reduce((s, u) => s + u.totalKg, 0) ?? 0;
    const totalPoints = data?.leaderboard.reduce((s, u) => s + u.ecoPoints, 0) ?? 0;
    const totalCO2 = Math.round(totalKg * 1.5);
    const totalTrees = Math.floor(totalCO2 / 60);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/eco/leaderboard?limit=50&period=${period}`);
            if (res.ok) setData(await res.json());
        } catch { toast.error('Yuklashda xato'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [period]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-sm">
                            <Leaf size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold text-gray-900">PRTS Monitor</h1>
                            <p className="text-xs text-gray-400 mt-0.5">Pack24 Recycling Track System — Eko monitoring</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {(['week', 'month', 'all'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${period === p
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            {p === 'week' ? 'Hafta' : p === 'month' ? 'Oy' : 'Barcha'}
                        </button>
                    ))}
                    <button onClick={load}
                        className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                        <RefreshCw size={15} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Global Impact Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { icon: Users,    label: 'Ishtirokchilar', val: data?.total ?? 0, unit: 'nafar', color: 'text-blue-600', bg: 'bg-blue-50' },
                    { icon: Leaf,     label: "Qayta ishlangan", val: totalKg,         unit: 'kg',    color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { icon: Wind,     label: 'CO₂ tejaldi',    val: totalCO2,         unit: 'kg',    color: 'text-sky-600', bg: 'bg-sky-50' },
                    { icon: TreePine, label: 'Daraxt ekviv.',  val: totalTrees,       unit: 'ta',    color: 'text-green-600', bg: 'bg-green-50' },
                ].map(({ icon: Icon, label, val, unit, color, bg }) => (
                    <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                            <Icon size={17} className={color} />
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
                        <p className={`text-2xl font-extrabold mt-1 ${color}`}>
                            {val.toLocaleString()}
                            <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
                        </p>
                    </div>
                ))}
            </div>

            {/* Eco Level Stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingUp size={15} className="text-emerald-600" /> Eko Darajalar Taqsimoti
                </h2>
                {loading ? (
                    <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-emerald-500" /></div>
                ) : (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                        {Object.entries(
                            (data?.leaderboard ?? []).reduce((acc, u) => {
                                acc[u.ecoLevel] = (acc[u.ecoLevel] || 0) + 1;
                                return acc;
                            }, {} as Record<string, number>)
                        ).map(([level, count]) => {
                            const cfg = LEVEL_CFG[level] ?? { emoji: '🌱', color: 'text-gray-600', bg: 'bg-gray-50' };
                            return (
                                <div key={level} className={`${cfg.bg} rounded-xl p-3 text-center`}>
                                    <div className="text-2xl mb-1">{cfg.emoji}</div>
                                    <div className={`text-sm font-extrabold ${cfg.color}`}>{count}</div>
                                    <div className="text-[10px] text-gray-500 capitalize mt-0.5">{level}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Leaderboard + Quick stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Leaderboard Table */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <h2 className="font-bold text-gray-800 flex items-center gap-2">
                            <Trophy size={15} className="text-amber-500" /> Liderlar Jadvali
                        </h2>
                        <span className="text-[10px] font-bold text-gray-400">
                            {data?.total ?? 0} ta ishtirokchi
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 size={28} className="animate-spin text-emerald-500" />
                        </div>
                    ) : !data?.leaderboard.length ? (
                        <div className="flex flex-col items-center py-16 text-center">
                            <Leaf size={36} className="text-gray-200 mb-3" />
                            <p className="text-gray-400 text-sm">Hali eco-faollik qayd etilmagan</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="w-12 py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-center">#</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-left">Foydalanuvchi</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Ball</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-right">Kg</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-right hidden md:table-cell">CO₂</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase text-center hidden md:table-cell">ESG</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.leaderboard.map(u => {
                                    const cfg = LEVEL_CFG[u.ecoLevel] ?? LEVEL_CFG.starter;
                                    return (
                                        <tr key={u.id}
                                            className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${u.rank <= 3 ? 'bg-amber-50/30' : ''}`}>
                                            <td className="py-3 px-4 text-center">
                                                <RANK_BADGE rank={u.rank} />
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center text-sm font-bold ${cfg.color} shrink-0`}>
                                                        {cfg.emoji}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-gray-900">{u.name}</p>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            {u.streak > 0 && (
                                                                <span className="text-[10px] text-orange-500 font-bold">🔥{u.streak}</span>
                                                            )}
                                                            {u.badgeCount > 0 && (
                                                                <span className="text-[10px] text-purple-500 font-bold">🏆{u.badgeCount}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <span className="font-extrabold text-emerald-600 text-sm">{u.ecoPoints.toLocaleString()}</span>
                                            </td>
                                            <td className="py-3 px-4 text-right text-sm font-semibold text-gray-700">
                                                {u.totalKg} kg
                                            </td>
                                            <td className="py-3 px-4 text-right text-sm text-gray-500 hidden md:table-cell">
                                                {Math.round(u.co2Saved)} kg
                                            </td>
                                            <td className="py-3 px-4 text-center hidden md:table-cell">
                                                <button
                                                    onClick={() => window.open(`/api/eco/esg-report?userId=${u.id}&year=${new Date().getFullYear()}`, '_blank')}
                                                    className="p-1.5 hover:bg-emerald-50 rounded-lg transition-colors group"
                                                    title="ESG Hisobot"
                                                >
                                                    <Download size={13} className="text-emerald-500 group-hover:text-emerald-700" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Quick stats side panel */}
                <div className="space-y-4">
                    {/* Top Performers */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                            <Medal size={14} className="text-amber-500" /> Top 3
                        </h3>
                        <div className="space-y-3">
                            {(data?.leaderboard.slice(0, 3) ?? []).map(u => (
                                <div key={u.id} className="flex items-center gap-3">
                                    <RANK_BADGE rank={u.rank} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{u.name}</p>
                                        <div className="flex gap-1 mt-0.5">
                                            <div className="h-1.5 bg-gray-100 rounded-full flex-1 overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full"
                                                    style={{ width: `${data?.leaderboard[0] ? Math.round((u.totalKg / data.leaderboard[0].totalKg) * 100) : 0}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-600 shrink-0">{u.totalKg}kg</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PRTS Rewards info */}
                    <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-5 text-white">
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={16} className="text-emerald-200" />
                            <h3 className="font-bold text-sm">PRTS Mukofotlar</h3>
                        </div>
                        <div className="space-y-2">
                            {[
                                { id: 'coffee', cost: 150, label: '☕ Kofe chegirma 50%' },
                                { id: 'transport', cost: 300, label: '🚌 Transport bepul' },
                                { id: 'cinema', cost: 500, label: '🎬 Kino chipta' },
                                { id: 'tree', cost: 1000, label: '🌳 Daraxt ekish' },
                            ].map(r => (
                                <div key={r.id} className="flex items-center justify-between text-xs">
                                    <span className="text-emerald-100">{r.label}</span>
                                    <span className="font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">{r.cost} ball</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-3 border-t border-emerald-600/40 text-[10px] text-emerald-200">
                            Jami tarqatilgan: <strong className="text-white">{totalPoints.toLocaleString()} ball</strong>
                        </div>
                    </div>

                    {/* ESG Report shortcut */}
                    <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
                        <h3 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                            <Leaf size={13} className="text-emerald-600" /> Platforma ESG
                        </h3>
                        <p className="text-[11px] text-gray-500 mb-3">
                            Pack24 platformasi qo'shgan umumiy ekologik ta'sir:
                        </p>
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Chiqindi kamaytirish:</span>
                                <span className="font-bold text-emerald-600">{totalKg.toLocaleString()} kg</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">CO₂ ekvivalent:</span>
                                <span className="font-bold text-sky-600">{totalCO2.toLocaleString()} kg</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Daraxt ekvivalenti:</span>
                                <span className="font-bold text-green-600">{totalTrees} ta</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
