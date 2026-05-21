'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { Search, Package, ChevronDown } from 'lucide-react';
import {
    STATUS_COLORS,
    STATUS_LABELS,
    getPointName,
    type RecyclePoint,
    type RecycleRequest,
    type RecyclingSupervisor,
} from '../_lib/types';

type DriverOption = { id: number; name: string };

type Props = {
    points: RecyclePoint[];
    requests: RecycleRequest[];
    supervisors: RecyclingSupervisor[];
    driverOptions: DriverOption[];
    loading: boolean;
    requestFilter: string;
    requestSearch: string;
    selectedPointId: number | null;
    selectedSupervisorId: number | null;
    selectedDriverId: number | null;
    onRequestFilterChange: (value: string) => void;
    onRequestSearchChange: (value: string) => void;
    onSelectedPointIdChange: (value: number | null) => void;
    onSelectedSupervisorIdChange: (value: number | null) => void;
    onSelectedDriverIdChange: (value: number | null) => void;
    onRefreshRequests: () => void | Promise<void>;
};

const STATUS_FILTER_BUTTONS: [string, string][] = [
    ['all', 'Barchasi'],
    ['new', '🔵 Yangi'],
    ['dispatched', '📤 Yuborilgan'],
    ['en_route', '🚚 Yo\'lda'],
    ['collected', '✅ Yig\'ildi'],
    ['completed', '🟢 Bajarildi'],
    ['disputed', '⚠️ Bahsli'],
    ['cancelled', '🔴 Bekor'],
];

export default function RequestsTab({
    points,
    requests,
    supervisors,
    driverOptions,
    loading,
    requestFilter,
    requestSearch,
    selectedPointId,
    selectedSupervisorId,
    selectedDriverId,
    onRequestFilterChange,
    onRequestSearchChange,
    onSelectedPointIdChange,
    onSelectedSupervisorIdChange,
    onSelectedDriverIdChange,
    onRefreshRequests,
}: Props) {
    const requestsHasExtraFilters = Boolean(
        requestSearch.trim() ||
            requestFilter !== 'all' ||
            selectedPointId ||
            selectedSupervisorId ||
            selectedDriverId,
    );

    const filteredRequests = useMemo(() => {
        return requests.filter((r) => {
            if (requestFilter !== 'all' && r.status !== requestFilter) return false;
            if (selectedPointId && r.pointId !== selectedPointId) return false;
            if (selectedSupervisorId && r.supervisorId !== selectedSupervisorId) return false;
            if (selectedDriverId && r.assignedDriverId !== selectedDriverId) return false;
            if (requestSearch.trim()) {
                const s = requestSearch.toLowerCase();
                return (
                    r.name.toLowerCase().includes(s) ||
                    r.phone.toLowerCase().includes(s) ||
                    String(r.id).includes(s)
                );
            }
            return true;
        });
    }, [
        requests,
        requestFilter,
        requestSearch,
        selectedPointId,
        selectedSupervisorId,
        selectedDriverId,
    ]);

    const clearAllFilters = () => {
        onRequestSearchChange('');
        onRequestFilterChange('all');
        onSelectedPointIdChange(null);
        onSelectedSupervisorIdChange(null);
        onSelectedDriverIdChange(null);
    };

    const updateRequestStatus = async (id: number, status: string) => {
        try {
            const res = await fetch(`/api/admin/recycling/requests/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                toast.success(`Ariza #${id} statusi: ${STATUS_LABELS[status] || status}`);
                await onRefreshRequests();
            } else {
                toast.error('Xatolik');
            }
        } catch {
            toast.error('Server xatosi');
        }
    };

    const dispatchToSupervisor = async (requestId: number, supervisorId: number) => {
        const res = await fetch('/api/admin/recycling/dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'dispatch_to_supervisor',
                requestId,
                supervisorId,
            }),
        });
        if (res.ok) {
            toast.success('Masulga yo\'naltirildi ✅');
            await onRefreshRequests();
        } else {
            toast.error('Xatolik');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        value={requestSearch}
                        onChange={(e) => onRequestSearchChange(e.target.value)}
                        placeholder="Ism, telefon yoki ID..."
                        className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                    />
                </div>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
                    {STATUS_FILTER_BUTTONS.map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onRequestFilterChange(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                requestFilter === key
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[160px]">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                        Baza
                    </label>
                    <select
                        value={selectedPointId ?? ''}
                        onChange={(e) => {
                            const v = e.target.value;
                            onSelectedPointIdChange(v ? parseInt(v, 10) : null);
                        }}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
                        title="Baza"
                    >
                        <option value="">Barcha bazalar</option>
                        {points.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.regionUz}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="min-w-[160px]">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                        Masul
                    </label>
                    <select
                        value={selectedSupervisorId ?? ''}
                        onChange={(e) => {
                            const v = e.target.value;
                            onSelectedSupervisorIdChange(v ? parseInt(v, 10) : null);
                        }}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
                        title="Masul"
                    >
                        <option value="">Barcha masullar</option>
                        {supervisors.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="min-w-[160px]">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                        Haydovchi
                    </label>
                    <select
                        value={selectedDriverId ?? ''}
                        onChange={(e) => {
                            const v = e.target.value;
                            onSelectedDriverIdChange(v ? parseInt(v, 10) : null);
                        }}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
                        title="Haydovchi"
                    >
                        <option value="">Barcha haydovchilar</option>
                        {driverOptions.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                </div>
                {requestsHasExtraFilters && (
                    <button
                        type="button"
                        onClick={clearAllFilters}
                        className="px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100"
                    >
                        Barcha filtrlarni tozalash
                    </button>
                )}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                    <Package size={40} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400 font-medium">
                        {requestsHasExtraFilters ? 'Topilmadi' : 'Hali arizalar yo&apos;q'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="hidden lg:grid grid-cols-[50px_1fr_120px_100px_80px_80px_160px_160px] gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <span>ID</span>
                        <span>Mijoz</span>
                        <span>Viloyat</span>
                        <span>Material</span>
                        <span>Hajm</span>
                        <span>Usul</span>
                        <span>Dispatch</span>
                        <span>Status</span>
                    </div>

                    {filteredRequests.map((r) => {
                        const sc = STATUS_COLORS[r.status] || STATUS_COLORS.new;
                        return (
                            <div
                                key={r.id}
                                className="grid grid-cols-1 lg:grid-cols-[50px_1fr_120px_100px_80px_80px_160px_160px] gap-2 lg:gap-3 px-5 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors items-center"
                            >
                                <span className="text-sm font-bold text-gray-400">#{r.id}</span>

                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 text-sm truncate">{r.name}</p>
                                    <p className="text-xs text-gray-400">{r.phone}</p>
                                    {r.address && (
                                        <p className="text-[10px] text-gray-300 truncate">📍 {r.address}</p>
                                    )}
                                </div>

                                <span className="text-xs text-gray-600 font-medium truncate">
                                    📍 {getPointName(points, r.pointId)}
                                </span>
                                <span className="text-xs text-gray-500 truncate">{r.material || '—'}</span>
                                <span className="text-sm font-bold text-gray-700">
                                    {r.volume ? `${r.volume} kg` : '—'}
                                </span>
                                <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${
                                        r.pickupType === 'pickup'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-gray-100 text-gray-600'
                                    }`}
                                >
                                    {r.pickupType === 'pickup' ? '🚛' : '🏭'}
                                </span>

                                <div className="space-y-1">
                                    {r.supervisor ? (
                                        <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded block truncate">
                                            👷 {r.supervisor.name}
                                        </span>
                                    ) : r.status === 'new' ? (
                                        <select
                                            title="Masulga yo'naltirish"
                                            defaultValue=""
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (!v) return;
                                                void dispatchToSupervisor(r.id, Number(v));
                                            }}
                                            className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border-0 w-full cursor-pointer"
                                        >
                                            <option value="">📤 Masulga →</option>
                                            {supervisors.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="text-[10px] text-gray-300">—</span>
                                    )}
                                    {r.assignedDriver && (
                                        <span className="text-[10px] bg-purple-50 text-purple-600 font-bold px-1.5 py-0.5 rounded block truncate">
                                            🚚 {r.assignedDriver.name}
                                        </span>
                                    )}
                                </div>

                                <div className="relative">
                                    <select
                                        value={r.status}
                                        onChange={(e) => void updateRequestStatus(r.id, e.target.value)}
                                        title={`Ariza #${r.id} statusini o'zgartirish`}
                                        className={`w-full text-[10px] font-bold px-2 py-1.5 rounded-lg border-0 cursor-pointer appearance-none ${sc.bg} ${sc.text} focus:outline-none focus:ring-2 focus:ring-emerald-200`}
                                    >
                                        <option value="new">🔵 Yangi</option>
                                        <option value="dispatched">📤 Yo&apos;naltirildi</option>
                                        <option value="assigned">👤 Tayinlandi</option>
                                        <option value="en_route">🚚 Yo&apos;lda</option>
                                        <option value="arrived">📍 Yetdi</option>
                                        <option value="collecting">📦 Yig&apos;ilmoqda</option>
                                        <option value="collected">✅ Yig&apos;ildi</option>
                                        <option value="confirmed">💚 Tasdiqlandi</option>
                                        <option value="completed">🟢 Bajarildi</option>
                                        <option value="disputed">⚠️ Bahsli</option>
                                        <option value="cancelled">🔴 Bekor</option>
                                    </select>
                                    <ChevronDown
                                        size={10}
                                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${sc.text}`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="text-xs text-gray-400 text-right">
                Jami: {filteredRequests.length} ta ariza
                {requestFilter !== 'all' && ` (filtr: ${STATUS_LABELS[requestFilter] || requestFilter})`}
            </p>
        </div>
    );
}
