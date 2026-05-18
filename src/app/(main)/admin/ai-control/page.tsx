'use client';

import { useEffect, useState } from 'react';
import {
    BrainCircuit, MessageSquare, Globe, Zap,
    Clock, BarChart3, TrendingUp, RefreshCw,
    Activity, Users
} from 'lucide-react';

interface AnalyticsData {
    total: number;
    languages: Record<string, number>;
    engines: { gemini: number; legacy: number };
    geminiRate: number;
    avgResponseTimeMs: number;
    avgMessageLength: number;
    hourlyActivity: Array<{ hour: number; count: number }>;
    recentEntries: Array<{
        time: string;
        language: string;
        engine: string;
        responseTimeMs: number;
        messageLength: number;
    }>;
    period: string;
}

const LANG_LABELS: Record<string, string> = {
    uz: "🇺🇿 O'zbek",
    ru: '🇷🇺 Русский',
    en: '🇬🇧 English',
    qr: '🏳️ Qaraqalpaq',
    zh: '🇨🇳 中文',
    tr: '🇹🇷 Türkçe',
    tg: '🇹🇯 Тоҷикӣ',
    kk: '🇰🇿 Қазақ',
    tk: '🇹🇲 Türkmen',
    fa: '🇮🇷 فارسی',
};

export default function AIControlPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/ai/analytics');
            const json = await res.json();
            setData(json);
        } catch {
            console.error('Analytics fetch failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15_000); // Auto-refresh every 15s
        return () => clearInterval(interval);
    }, []);

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw size={24} className="animate-spin text-slate-400" />
            </div>
        );
    }

    const maxHourly = Math.max(...data.hourlyActivity.map(h => h.count), 1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BrainCircuit size={28} className="text-indigo-600" />
                        AI Analytics Dashboard
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Real-time AI chat statistikasi</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                    <RefreshCw size={14} /> Yangilash
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Chats */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <MessageSquare size={20} />
                        </div>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                            Session
                        </span>
                    </div>
                    <p className="text-3xl font-extrabold text-slate-900">{data.total}</p>
                    <p className="text-sm text-slate-500 mt-1">Jami so'rovlar</p>
                </div>

                {/* Gemini Rate */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <Zap size={20} />
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            data.geminiRate > 80
                                ? 'text-emerald-600 bg-emerald-50'
                                : data.geminiRate > 50
                                    ? 'text-yellow-600 bg-yellow-50'
                                    : 'text-red-600 bg-red-50'
                        }`}>
                            {data.geminiRate}%
                        </span>
                    </div>
                    <p className="text-3xl font-extrabold text-slate-900">{data.engines.gemini}</p>
                    <p className="text-sm text-slate-500 mt-1">Gemini javoblar</p>
                    <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                        <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${data.geminiRate}%` }}
                        />
                    </div>
                </div>

                {/* Avg Response Time */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                            <Clock size={20} />
                        </div>
                    </div>
                    <p className="text-3xl font-extrabold text-slate-900">
                        {data.avgResponseTimeMs < 1000
                            ? `${data.avgResponseTimeMs}ms`
                            : `${(data.avgResponseTimeMs / 1000).toFixed(1)}s`
                        }
                    </p>
                    <p className="text-sm text-slate-500 mt-1">O'rtacha javob vaqti</p>
                </div>

                {/* Languages Count */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <Globe size={20} />
                        </div>
                    </div>
                    <p className="text-3xl font-extrabold text-slate-900">{Object.keys(data.languages).length}</p>
                    <p className="text-sm text-slate-500 mt-1">Faol tillar</p>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Hourly Activity Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 size={18} className="text-indigo-600" />
                        <h3 className="font-bold text-slate-900">Soatlik faollik (24 soat)</h3>
                    </div>
                    <div className="flex items-end gap-1 h-32">
                        {data.hourlyActivity.map((h) => (
                            <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                    className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-indigo-400 transition-all duration-300 min-h-[2px]"
                                    style={{ height: `${(h.count / maxHourly) * 100}%` }}
                                    title={`${h.hour}:00 — ${h.count} ta so'rov`}
                                />
                                <span className="text-[8px] text-slate-400">{h.hour}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Language Distribution */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe size={18} className="text-blue-600" />
                        <h3 className="font-bold text-slate-900">Til taqsimoti</h3>
                    </div>
                    <div className="space-y-3">
                        {Object.entries(data.languages)
                            .sort(([, a], [, b]) => b - a)
                            .map(([lang, count]) => {
                                const pct = Math.round((count / data.total) * 100);
                                return (
                                    <div key={lang}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-700 font-medium">
                                                {LANG_LABELS[lang] || lang}
                                            </span>
                                            <span className="text-slate-500">{count} ({pct}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div
                                                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        {Object.keys(data.languages).length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-4">Hali ma&apos;lumot yo&apos;q</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Engine Comparison + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Engine Cards */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={18} className="text-emerald-600" />
                        <h3 className="font-bold text-slate-900">AI Engine nisbati</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap size={16} className="text-emerald-600" />
                                <span className="text-sm font-bold text-emerald-800">Gemini 2.5</span>
                            </div>
                            <p className="text-2xl font-extrabold text-emerald-700">{data.engines.gemini}</p>
                            <p className="text-xs text-emerald-600 mt-1">Flash (LLM)</p>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Activity size={16} className="text-gray-600" />
                                <span className="text-sm font-bold text-gray-800">Legacy</span>
                            </div>
                            <p className="text-2xl font-extrabold text-gray-700">{data.engines.legacy}</p>
                            <p className="text-xs text-gray-500 mt-1">Keyword matcher</p>
                        </div>
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Users size={18} className="text-indigo-600" />
                        <h3 className="font-bold text-slate-900">Oxirgi so'rovlar</h3>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {data.recentEntries.map((e, i) => (
                            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${
                                        e.engine === 'gemini' ? 'bg-emerald-500' : 'bg-gray-400'
                                    }`} />
                                    <span className="text-slate-600 font-mono text-xs">{e.time}</span>
                                    <span className="text-slate-700 font-medium">
                                        {LANG_LABELS[e.language]?.split(' ')[0] || e.language}
                                    </span>
                                </div>
                                <span className="text-xs text-slate-400">{e.responseTimeMs}ms</span>
                            </div>
                        ))}
                        {data.recentEntries.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-4">Hali faollik yo&apos;q</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Console */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white font-mono text-sm leading-relaxed">
                <div className="flex items-center gap-2 mb-4 text-slate-400 border-b border-slate-700 pb-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full" />
                    <span className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <span className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="ml-2">AI System Status</span>
                </div>
                <p className="text-emerald-400">
                    [✓] Gemini 2.5 Flash — {data.engines.gemini > 0 ? 'ACTIVE' : 'STANDBY'}
                </p>
                <p className="text-blue-400">
                    [i] Total requests this session: {data.total}
                </p>
                <p className="text-yellow-400">
                    [i] Avg response: {data.avgResponseTimeMs}ms | Avg msg length: {data.avgMessageLength} chars
                </p>
                <p className="opacity-70">
                    [i] Languages active: {Object.keys(data.languages).join(', ') || 'none'}
                </p>
                <p className="opacity-70">
                    [i] Engine ratio: Gemini {data.geminiRate}% / Legacy {100 - data.geminiRate}%
                </p>
                <div className="mt-2 animate-pulse text-emerald-400">● Ready</div>
            </div>
        </div>
    );
}
