'use client';

// ─── Viloyat bo'yicha Savdo Xaritasi ─────────────────────────────────────────
// O'zbekiston viloyatlari bo'yicha buyurtma va daromad ko'rsatkich jadvali

import { MapPin } from 'lucide-react';

interface RegionData {
    region: string;
    orders: number;
    revenue: number;
}

function fmtM(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString('ru-RU');
}

const REGION_COLORS = [
    'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500',
    'bg-rose-500', 'bg-teal-500', 'bg-indigo-500', 'bg-cyan-500',
    'bg-orange-500', 'bg-lime-500', 'bg-violet-500', 'bg-pink-500',
    'bg-sky-500', 'bg-red-500',
];

export default function RegionSalesMap({
    data,
    loading,
}: {
    data: RegionData[];
    loading: boolean;
}) {
    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-44 mb-5" />
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-10 bg-gray-50 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="font-bold text-gray-800 mb-5">🗺️ Viloyat bo&apos;yicha savdo</p>
                <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                    <MapPin size={32} className="mb-2" />
                    <span className="text-sm">Ma&apos;lumot yo&apos;q</span>
                </div>
            </div>
        );
    }

    const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-5">
                <p className="font-bold text-gray-800">🗺️ Viloyat bo&apos;yicha savdo</p>
                <span className="text-[10px] bg-gray-50 text-gray-500 font-bold px-2 py-0.5 rounded-full">
                    {data.length} viloyat
                </span>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 rounded-xl p-3">
                    <p className="text-[10px] text-emerald-600 font-bold mb-0.5">Jami daromad</p>
                    <p className="text-lg font-extrabold text-emerald-700">{fmtM(totalRevenue)} <span className="text-xs font-normal">so&apos;m</span></p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/30 rounded-xl p-3">
                    <p className="text-[10px] text-blue-600 font-bold mb-0.5">Jami buyurtma</p>
                    <p className="text-lg font-extrabold text-blue-700">{totalOrders}</p>
                </div>
            </div>

            {/* Region bars */}
            <div className="space-y-2">
                {data.map((region, i) => {
                    const pct = (region.revenue / maxRevenue) * 100;
                    const sharePct = totalRevenue > 0
                        ? Math.round((region.revenue / totalRevenue) * 100)
                        : 0;
                    return (
                        <div key={region.region} className="group">
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`w-2 h-2 rounded-full ${REGION_COLORS[i % REGION_COLORS.length]}`} />
                                <span className="text-xs font-bold text-gray-700 flex-1">{region.region}</span>
                                <span className="text-[10px] text-gray-400">{region.orders} ta</span>
                                <span className="text-xs font-extrabold text-gray-800">{fmtM(region.revenue)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-2 rounded-full ${REGION_COLORS[i % REGION_COLORS.length]} transition-all duration-500`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-[9px] font-bold text-gray-400 w-8 text-right">{sharePct}%</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
