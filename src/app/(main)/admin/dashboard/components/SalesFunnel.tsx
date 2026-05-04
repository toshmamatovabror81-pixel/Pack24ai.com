'use client';

// ─── Sotuv Funnel (Pipeline) Komponenti ──────────────────────────────────────
// Buyurtma status'lari bo'yicha pipeline vizualizatsiya

interface FunnelData {
    draft: number;
    new: number;
    processing: number;
    shipping: number;
    delivered: number;
    cancelled: number;
}

const STAGES = [
    { key: 'new',        label: 'Yangi',       color: '#3b82f6', bgLight: '#eff6ff' },
    { key: 'processing', label: 'Jarayonda',   color: '#8b5cf6', bgLight: '#f5f3ff' },
    { key: 'shipping',   label: "Yo'lda",      color: '#f59e0b', bgLight: '#fffbeb' },
    { key: 'delivered',  label: 'Yetkazildi',  color: '#10b981', bgLight: '#ecfdf5' },
] as const;

export default function SalesFunnel({ data, loading }: { data: FunnelData | null; loading: boolean }) {
    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-36 mb-5" />
                <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-12 bg-gray-50 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (!data) return null;

    const total = data.new + data.processing + data.shipping + data.delivered;
    const maxValue = Math.max(data.new, data.processing, data.shipping, data.delivered, 1);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-5">
                <p className="font-bold text-gray-800">📊 Sotuv Funnel</p>
                {data.cancelled > 0 && (
                    <span className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded-full">
                        ❌ {data.cancelled} bekor
                    </span>
                )}
            </div>

            <div className="space-y-2.5">
                {STAGES.map((stage, i) => {
                    const value = data[stage.key as keyof FunnelData] ?? 0;
                    const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
                    const convPct = i > 0
                        ? (() => {
                            const prevKey = STAGES[i - 1].key as keyof FunnelData;
                            const prevVal = data[prevKey] ?? 0;
                            return prevVal > 0 ? Math.round((value / prevVal) * 100) : 0;
                        })()
                        : null;

                    return (
                        <div key={stage.key}>
                            {/* Konversiya arrow */}
                            {convPct !== null && (
                                <div className="flex items-center justify-center my-1">
                                    <span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                                        ↓ {convPct}%
                                    </span>
                                </div>
                            )}
                            <div
                                className="rounded-xl p-3 flex items-center justify-between transition-all hover:scale-[1.01]"
                                style={{
                                    backgroundColor: stage.bgLight,
                                    width: `${Math.max(pct, 30)}%`,
                                    minWidth: '200px',
                                    marginLeft: 'auto',
                                    marginRight: 'auto',
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: stage.color }}
                                    />
                                    <span className="text-xs font-bold" style={{ color: stage.color }}>
                                        {stage.label}
                                    </span>
                                </div>
                                <span className="text-sm font-extrabold text-gray-900">{value}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">Jami pipeline</span>
                <span className="text-sm font-extrabold text-gray-900">{total} buyurtma</span>
            </div>
            {total > 0 && (
                <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">Umumiy konversiya:</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        data.delivered / total >= 0.5
                            ? 'bg-emerald-50 text-emerald-600'
                            : data.delivered / total >= 0.2
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-red-50 text-red-500'
                    }`}>
                        {Math.round((data.delivered / total) * 100)}% yetkazildi
                    </span>
                </div>
            )}
        </div>
    );
}
