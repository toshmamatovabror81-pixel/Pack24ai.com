'use client';

import { useState } from 'react';
import { Download, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { EXPORT_TYPES } from '../_lib/types';

type Props = {
    online: boolean;
    loading: boolean;
    period: number;
    startDate: string;
    endDate: string;
    onPeriodChange: (d: number) => void;
    onStartDateChange: (v: string) => void;
    onEndDateChange: (v: string) => void;
    onRefresh: () => void;
};

export default function ReportsHeader({
    online,
    loading,
    period,
    startDate,
    endDate,
    onPeriodChange,
    onStartDateChange,
    onEndDateChange,
    onRefresh,
}: Props) {
    const [showExport, setShowExport] = useState(false);

    const openExport = (type: string) => {
        const params = new URLSearchParams({ type, period: String(period) });
        if (startDate && endDate) {
            params.set('from', startDate);
            params.set('to', endDate);
        }
        window.open(`/api/admin/export?${params.toString()}`, '_blank');
        setShowExport(false);
    };

    return (
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-extrabold text-gray-900">Hisobotlar & Analitika</h1>
                    {online
                        ? <span title="Tarmoq ulanishi bor"><Wifi size={14} className="text-emerald-500" /></span>
                        : <span title="Tarmoq yo'q"><WifiOff size={14} className="text-red-400" /></span>
                    }
                </div>
                <p className="text-sm text-gray-400 mt-0.5">Biznes ko&apos;rsatkichlari va tendentsiyalar</p>
            </div>
            <div className="flex items-center gap-3">
                <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
                    {[7, 30, 90].map(d => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => {
                                onPeriodChange(d);
                                onStartDateChange('');
                                onEndDateChange('');
                            }}
                            className={`px-4 py-2 text-sm font-semibold transition-colors ${
                                period === d ? 'bg-brand-green text-white' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {d} kun
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-2 py-1">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="text-xs text-gray-700 outline-none"
                        aria-label="Boshlanish sanasi"
                    />
                    <span className="text-gray-300 text-xs">—</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        className="text-xs text-gray-700 outline-none"
                        aria-label="Tugash sanasi"
                    />
                    <button
                        type="button"
                        onClick={() => { onStartDateChange(''); onEndDateChange(''); }}
                        className="text-[10px] text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded-md"
                    >
                        Tozalash
                    </button>
                </div>
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={loading}
                    title="Yangilash"
                    aria-label="Ma'lumotlarni yangilash"
                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={15} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowExport(!showExport)}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
                    >
                        <Download size={14} /> Export
                    </button>
                    {showExport && (
                        <div className="absolute right-0 top-12 bg-white rounded-xl border border-gray-200 shadow-xl py-2 z-50 min-w-[200px]">
                            {EXPORT_TYPES.map(item => (
                                <button
                                    key={item.type}
                                    type="button"
                                    onClick={() => openExport(item.type)}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    {item.label}
                                </button>
                            ))}
                            <div className="border-t border-gray-100 mt-1 pt-1 px-4 py-2">
                                <p className="text-[10px] text-gray-400">
                                    {startDate && endDate
                                        ? `Davr: ${startDate} - ${endDate}`
                                        : `Davr: so'nggi ${period} kun`}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
