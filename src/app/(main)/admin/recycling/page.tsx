'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    Recycle, MapPin, Plus, Pencil, Trash2, Phone, Package,
    CheckCircle, Clock, XCircle, Search, Truck,
    ChevronDown, AlertTriangle, Download
} from 'lucide-react';
import SupervisorsTab from './_components/SupervisorsTab';
import DriversTab from './_components/DriversTab';
import CollectionsTab from './_components/CollectionsTab';
import ComplaintsTab from './_components/ComplaintsTab';
import MonthlyJournalTab from './_components/MonthlyJournalTab';
import BotEventsTab from './_components/BotEventsTab';
import { removeBotEventFeedParamsFromSearchString, urlHasBotEventFeedParams } from '@/lib/platform/botEventFeedUrl';

// ─── Типлар ──────────────────────────────────────────────────────────────────

interface RecyclePoint {
    id: number;
    regionUz: string;
    regionRu: string;
    cityUz: string;
    cityRu: string;
    phone: string;
    status: string;
    color: string;
    _count?: { requests: number };
    createdAt: string;
}

interface RecycleRequest {
    id: number;
    name: string;
    phone: string;
    regionId: number;
    point?: RecyclePoint;
    material: string | null;
    volume: number | null;
    pickupType: string;
    status: string;
    address?: string | null;
    customerTgId?: string | null;
    supervisorId?: number | null;
    supervisor?: { id: number; name: string } | null;
    assignedDriverId?: number | null;
    assignedDriver?: { id: number; name: string; phone: string } | null;
    dispatchedAt?: string | null;
    assignedAt?: string | null;
    driverEnRouteAt?: string | null;
    driverArrivedAt?: string | null;
    collectedAt?: string | null;
    confirmedAt?: string | null;
    completedAt?: string | null;
    collections?: { id: number }[];
    complaints?: { id: number }[];
    createdAt: string;
}

interface Supervisor {
    id: number;
    name: string;
    phone: string;
    pointId: number | null;
}

// ─── Ренглар ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    new:         { bg: 'bg-blue-100',    text: 'text-blue-700',    icon: Clock },
    dispatched:  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  icon: Package },
    assigned:    { bg: 'bg-purple-100',  text: 'text-purple-700',  icon: Truck },
    en_route:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    icon: Truck },
    arrived:     { bg: 'bg-teal-100',    text: 'text-teal-700',    icon: MapPin },
    collecting:  { bg: 'bg-amber-100',   text: 'text-amber-700',   icon: Package },
    collected:   { bg: 'bg-orange-100',  text: 'text-orange-700',  icon: Package },
    confirmed:   { bg: 'bg-lime-100',    text: 'text-lime-700',    icon: CheckCircle },
    completed:   { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
    disputed:    { bg: 'bg-pink-100',    text: 'text-pink-700',    icon: AlertTriangle },
    processing:  { bg: 'bg-yellow-100',  text: 'text-yellow-700',  icon: Package },
    cancelled:   { bg: 'bg-red-100',     text: 'text-red-700',     icon: XCircle },
};

const POINT_COLORS = [
    'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500',
    'bg-red-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
    'bg-cyan-500', 'bg-lime-500', 'bg-yellow-500', 'bg-violet-500',
];

const STATUS_LABELS: Record<string, string> = {
    new: 'Yangi',
    dispatched: 'Yo\'naltirildi',
    assigned: 'Tayinlandi',
    en_route: 'Yo\'lda',
    arrived: 'Yetib keldi',
    collecting: 'Yig\'ilmoqda',
    collected: 'Yig\'ildi',
    confirmed: 'Tasdiqlandi',
    completed: 'Bajarildi',
    disputed: 'Bahsli',
    processing: 'Jarayonda',
    cancelled: 'Bekor',
};

const EMPTY_POINT = { regionUz: '', regionRu: '', cityUz: '', cityRu: '', phone: '', address: '', lat: '', lng: '', status: 'planned', color: 'bg-blue-500' };

type AdminRecyclingTab =
    | 'dashboard'
    | 'points'
    | 'requests'
    | 'supervisors'
    | 'drivers'
    | 'collections'
    | 'complaints'
    | 'journal'
    | 'bot-events';

function readPositiveQueryInt(params: URLSearchParams, key: string) {
    const raw = params.get(key);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Arizalar yorog‘i: URL `requestStatus=…` (masalan, `new`, `completed`) */
const REQUEST_TAB_STATUS_VALUES = new Set([
    'all',
    'new',
    'dispatched',
    'en_route',
    'arrived',
    'collecting',
    'collected',
    'confirmed',
    'completed',
    'disputed',
    'cancelled',
    'processing',
    'assigned',
]);

function readRequestStatusFromParams(params: URLSearchParams): string {
    const raw = params.get('requestStatus')?.trim() ?? '';
    if (!raw || raw === 'all') return 'all';
    if (REQUEST_TAB_STATUS_VALUES.has(raw)) return raw;
    return 'all';
}

function readInitialRecyclingFilters(): {
    activeTab: AdminRecyclingTab;
    requestSearch: string;
    requestFilter: string;
    selectedPointId: number | null;
    selectedSupervisorId: number | null;
    selectedDriverId: number | null;
} {
    if (typeof window === 'undefined') {
        return {
            activeTab: 'dashboard',
            requestSearch: '',
            requestFilter: 'all',
            selectedPointId: null,
            selectedSupervisorId: null,
            selectedDriverId: null,
        };
    }

    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const requestId = params.get('requestId')?.trim() ?? '';
    const allowedTabs = new Set<AdminRecyclingTab>([
        'dashboard',
        'points',
        'requests',
        'supervisors',
        'drivers',
        'collections',
        'complaints',
        'journal',
        'bot-events',
    ]);

    if (urlHasBotEventFeedParams(params)) {
        return {
            activeTab: 'bot-events',
            requestSearch: requestId,
            requestFilter: readRequestStatusFromParams(params),
            selectedPointId: readPositiveQueryInt(params, 'pointId'),
            selectedSupervisorId: readPositiveQueryInt(params, 'supervisorId'),
            selectedDriverId: readPositiveQueryInt(params, 'driverId'),
        };
    }

    const hasExplicitTab = Boolean(tab && allowedTabs.has(tab as AdminRecyclingTab));

    if (!hasExplicitTab) {
        const stRaw = params.get('requestStatus')?.trim() ?? '';
        const impliedRequests =
            (stRaw && stRaw !== 'all' && REQUEST_TAB_STATUS_VALUES.has(stRaw)) || Boolean(requestId);
        if (impliedRequests) {
            return {
                activeTab: 'requests',
                requestSearch: requestId,
                requestFilter: readRequestStatusFromParams(params),
                selectedPointId: readPositiveQueryInt(params, 'pointId'),
                selectedSupervisorId: readPositiveQueryInt(params, 'supervisorId'),
                selectedDriverId: readPositiveQueryInt(params, 'driverId'),
            };
        }
    }

    return {
        activeTab: hasExplicitTab ? (tab as AdminRecyclingTab) : 'dashboard',
        requestSearch: requestId,
        requestFilter: readRequestStatusFromParams(params),
        selectedPointId: readPositiveQueryInt(params, 'pointId'),
        selectedSupervisorId: readPositiveQueryInt(params, 'supervisorId'),
        selectedDriverId: readPositiveQueryInt(params, 'driverId'),
    };
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminRecyclingPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [recyclingUrlReady, setRecyclingUrlReady] = useState(false);

    // ─── State ────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<AdminRecyclingTab>('dashboard');
    const [supervisors, setSupervisors] = useState<Supervisor[]>([]);

    // Points
    const [points, setPoints] = useState<RecyclePoint[]>([]);
    const [loadingPoints, setLoadingPoints] = useState(true);
    const [showPointForm, setShowPointForm] = useState(false);
    const [editingPoint, setEditingPoint] = useState<number | null>(null);
    const [pointForm, setPointForm] = useState(EMPTY_POINT);
    const [savingPoint, setSavingPoint] = useState(false);

    // Requests
    const [requests, setRequests] = useState<RecycleRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [requestFilter, setRequestFilter] = useState('all');
    const [requestSearch, setRequestSearch] = useState('');
    const [selectedPointId, setSelectedPointId] = useState<number | null>(null);
    const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | null>(null);
    const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
    const [driverOptions, setDriverOptions] = useState<Array<{ id: number; name: string }>>([]);

    const requestsHasExtraFilters = Boolean(
        requestSearch.trim() || requestFilter !== 'all' || selectedPointId || selectedSupervisorId || selectedDriverId,
    );

    const complaintsHighlightRequestId = useMemo(() => {
        if (activeTab !== 'complaints') return null;
        const s = requestSearch.trim();
        if (!/^\d+$/.test(s)) return null;
        const n = parseInt(s, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    }, [activeTab, requestSearch]);

    const syncJournalFiltersFromChild = useCallback((pointId: number | null, supervisorId: number | null) => {
        setSelectedPointId(pointId);
        setSelectedSupervisorId(supervisorId);
    }, []);

    // ─── Fetch Points ─────────────────────────────────────────────────────
    const fetchPoints = useCallback(async () => {
        setLoadingPoints(true);
        try {
            const res = await fetch('/api/admin/recycling/points');
            if (res.ok) {
                const data = await res.json();
                setPoints(data);
            }
        } catch {
            toast.error('Bazalarni yuklashda xatolik');
        } finally {
            setLoadingPoints(false);
        }
    }, []);

    // ─── Fetch Requests ───────────────────────────────────────────────────
    const fetchRequests = useCallback(async () => {
        setLoadingRequests(true);
        try {
            const res = await fetch('/api/admin/recycling/requests');
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch {
            toast.error('Arizalarni yuklashda xatolik');
        } finally {
            setLoadingRequests(false);
        }
    }, []);

    const fetchSupervisors = useCallback(async () => {
        try { const r = await fetch('/api/admin/recycling/supervisors'); if (r.ok) setSupervisors(await r.json()); } catch { /* ignore */ }
    }, []);

    const fetchDriverOptions = useCallback(async () => {
        try {
            const r = await fetch('/api/admin/recycling/drivers');
            if (r.ok) {
                const data = (await r.json()) as { id: number; name: string }[];
                setDriverOptions(data.map((d) => ({ id: d.id, name: d.name })));
            }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        fetchPoints();
        fetchRequests();
        fetchSupervisors();
        fetchDriverOptions();
    }, [fetchPoints, fetchRequests, fetchSupervisors, fetchDriverOptions]);

    useEffect(() => {
        const initialFilters = readInitialRecyclingFilters();
        setActiveTab(initialFilters.activeTab);
        setRequestSearch(initialFilters.requestSearch);
        setRequestFilter(initialFilters.requestFilter);
        setSelectedPointId(initialFilters.selectedPointId);
        setSelectedSupervisorId(initialFilters.selectedSupervisorId);
        setSelectedDriverId(initialFilters.selectedDriverId);
        setRecyclingUrlReady(true);
    }, []);

    // Barcha yorliqlar: URLda `tab=`. `be*` filtrlari faqat Bot Events tabida — boshqa yorliqqa o‘tganingizda olib tashlanadi.
    // `bot-events` yorlig‘ining query yozuvi — BotEventsTab ichida (jamo bo‘lmasin).
    // `tab=requests`: `requestId` (qidiruv) va baza / masul / haydovchi filtrlari URLda saqlanadi.
    useEffect(() => {
        if (!recyclingUrlReady) return;
        if (activeTab === 'bot-events') return;
        if (typeof window === 'undefined') return;

        const raw = window.location.search.replace(/^\?/, '');
        const cleaned = removeBotEventFeedParamsFromSearchString(raw);
        const next = new URLSearchParams(cleaned);
        next.set('tab', activeTab);

        if (activeTab === 'requests') {
            if (requestSearch.trim()) {
                next.set('requestId', requestSearch.trim());
            } else {
                next.delete('requestId');
            }
            if (selectedPointId) {
                next.set('pointId', String(selectedPointId));
            } else {
                next.delete('pointId');
            }
            if (selectedSupervisorId) {
                next.set('supervisorId', String(selectedSupervisorId));
            } else {
                next.delete('supervisorId');
            }
            if (selectedDriverId) {
                next.set('driverId', String(selectedDriverId));
            } else {
                next.delete('driverId');
            }
            if (requestFilter !== 'all') {
                next.set('requestStatus', requestFilter);
            } else {
                next.delete('requestStatus');
            }
        }

        const qs = next.toString();
        const nextFull = qs ? `${pathname}?${qs}` : pathname;
        const current = `${window.location.pathname}${window.location.search}`;
        if (nextFull === current) return;
        router.replace(nextFull, { scroll: false });
    }, [
        activeTab,
        pathname,
        recyclingUrlReady,
        router,
        requestSearch,
        requestFilter,
        selectedPointId,
        selectedSupervisorId,
        selectedDriverId,
    ]);

    // ─── Point CRUD ───────────────────────────────────────────────────────
    const handlePointSubmit = async () => {
        if (!pointForm.regionUz.trim() || !pointForm.cityUz.trim() || !pointForm.phone.trim()) {
            toast.error("Viloyat, shahar va telefon majburiy!");
            return;
        }
        setSavingPoint(true);
        try {
            const method = editingPoint ? 'PUT' : 'POST';
            const url = editingPoint
                ? `/api/admin/recycling/points/${editingPoint}`
                : '/api/admin/recycling/points';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pointForm),
            });
            if (res.ok) {
                toast.success(editingPoint ? 'Baza yangilandi ✓' : 'Baza qo\'shildi ✓');
                setPointForm(EMPTY_POINT);
                setShowPointForm(false);
                setEditingPoint(null);
                fetchPoints();
            } else {
                toast.error('Xatolik yuz berdi');
            }
        } finally {
            setSavingPoint(false);
        }
    };

    const handlePointDelete = async (id: number) => {
        if (!confirm('Bu bazani o\'chirishni tasdiqlaysizmi?')) return;
        try {
            const res = await fetch(`/api/admin/recycling/points/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Baza o\'chirildi');
                fetchPoints();
            } else {
                toast.error('Xatolik');
            }
        } catch {
            toast.error('Server xatosi');
        }
    };

    const startEditPoint = (point: RecyclePoint) => {
        setEditingPoint(point.id);
        setPointForm({
            regionUz: point.regionUz,
            regionRu: point.regionRu,
            cityUz: point.cityUz,
            cityRu: point.cityRu,
            phone: point.phone,
            address: (point as RecyclePoint & { address?: string }).address || '',
            lat: String((point as RecyclePoint & { lat?: number | null }).lat ?? ''),
            lng: String((point as RecyclePoint & { lng?: number | null }).lng ?? ''),
            status: point.status,
            color: point.color,
        });
        setShowPointForm(true);
        setActiveTab('points');
    };

    // ─── Request Status Update ────────────────────────────────────────────
    const updateRequestStatus = async (id: number, status: string) => {
        try {
            const res = await fetch(`/api/admin/recycling/requests/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                toast.success(`Ariza #${id} statusi: ${STATUS_LABELS[status]}`);
                fetchRequests();
            } else {
                toast.error('Xatolik');
            }
        } catch {
            toast.error('Server xatosi');
        }
    };

    // ─── Filtered Requests ────────────────────────────────────────────────
    const filteredRequests = requests.filter(r => {
        if (requestFilter !== 'all' && r.status !== requestFilter) return false;
        if (selectedPointId && r.regionId !== selectedPointId) return false;
        if (selectedSupervisorId && r.supervisorId !== selectedSupervisorId) return false;
        if (selectedDriverId && r.assignedDriverId !== selectedDriverId) return false;
        if (requestSearch.trim()) {
            const s = requestSearch.toLowerCase();
            return r.name.toLowerCase().includes(s) ||
                   r.phone.toLowerCase().includes(s) ||
                   String(r.id).includes(s);
        }
        return true;
    });
    const filteredPoints = selectedPointId
        ? points.filter((point) => point.id === selectedPointId)
        : points;

    // ─── Stats ────────────────────────────────────────────────────────────
    const stats = {
        totalPoints: points.length,
        activePoints: points.filter(p => p.status === 'active').length,
        totalRequests: requests.length,
        newRequests: requests.filter(r => r.status === 'new').length,
        processingRequests: requests.filter(r => r.status === 'processing').length,
        completedRequests: requests.filter(r => r.status === 'completed').length,
        totalVolume: requests.reduce((acc, r) => acc + (r.volume || 0), 0),
    };

    // ─── Helper ───────────────────────────────────────────────────────────
    const getPointName = (regionId: number) => {
        const point = points.find(p => p.id === regionId);
        return point ? point.regionUz : `#${regionId}`;
    };

    // ═══════════════════════════════════════════════════════════════════════
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
                        <Recycle className="text-emerald-600" size={26} />
                        Qayta Ishlash (Makulatura)
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Bazalar va arizalarni boshqarish
                    </p>
                </div>
                <button
                    onClick={() => window.open('/api/admin/export?type=recycling&period=365', '_blank')}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
                >
                    <Download size={14} /> Export CSV
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
                {([
                    ['dashboard', '📊 Dashboard'],
                    ['points', '📍 Bazalar'],
                    ['requests', '📋 Arizalar'],
                    ['supervisors', '👷 Masullar'],
                    ['drivers', '🚚 Haydovchilar'],
                    ['collections', '💰 Hisob-kitob'],
                    ['journal', '🧾 Oylik jurnal'],
                    ['bot-events', '🤖 Bot Events'],
                    ['complaints', '⚠️ Shikoyatlar'],
                ] as const).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                            activeTab === key
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {label}
                        {key === 'requests' && stats.newRequests > 0 && (
                            <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {stats.newRequests}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* DASHBOARD TAB */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Jami bazalar',    value: stats.totalPoints,        icon: MapPin,      color: 'text-blue-600',    bg: 'bg-blue-50' },
                            { label: 'Faol bazalar',    value: stats.activePoints,       icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            { label: 'Jami arizalar',   value: stats.totalRequests,      icon: Package,     color: 'text-purple-600',  bg: 'bg-purple-50' },
                            { label: 'Yangi arizalar',  value: stats.newRequests,        icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
                        ].map((s, i) => {
                            const Icon = s.icon;
                            return (
                                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center`}>
                                            <Icon size={20} className={s.color} />
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{s.label}</span>
                                    </div>
                                    <p className="text-3xl font-black text-gray-900">{s.value}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Secondary Stats */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                            <h3 className="text-sm font-bold text-gray-500 mb-3">Ariza statuslari</h3>
                            <div className="space-y-2">
                                {Object.entries(STATUS_LABELS).map(([key, label]) => {
                                    const count = requests.filter(r => r.status === key).length;
                                    const pct = stats.totalRequests > 0 ? (count / stats.totalRequests * 100) : 0;
                                    const sc = STATUS_COLORS[key];
                                    return (
                                        <div key={key} className="flex items-center gap-3">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{label}</span>
                                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                                                <div className={`h-2 rounded-full ${sc.bg.replace('100', '500')}`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-sm font-bold text-gray-700 w-8 text-right">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                            <h3 className="text-sm font-bold text-gray-500 mb-3">Umumiy hajm</h3>
                            <div className="flex items-end gap-2">
                                <p className="text-4xl font-black text-emerald-600">{(stats.totalVolume / 1000).toFixed(1)}</p>
                                <p className="text-lg font-bold text-gray-400 mb-1">tonna</p>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                ≈ {Math.round(stats.totalVolume / 1000 * 17)} ta daraxt saqlanadi 🌳
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                            <h3 className="text-sm font-bold text-gray-500 mb-3">Topshirish usullari</h3>
                            <div className="space-y-3 mt-2">
                                {[
                                    { type: 'base', label: 'Bazaga olib kelish', icon: MapPin, count: requests.filter(r => r.pickupType === 'base').length },
                                    { type: 'pickup', label: 'Kuryer chiqishi', icon: Truck, count: requests.filter(r => r.pickupType === 'pickup').length },
                                ].map(item => {
                                    const Icon = item.icon;
                                    return (
                                        <div key={item.type} className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                                                <Icon size={16} className="text-gray-400" />
                                            </div>
                                            <span className="text-sm text-gray-700 flex-1">{item.label}</span>
                                            <span className="text-sm font-bold text-gray-900">{item.count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Recent Requests */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-500">So{`'`}nggi arizalar</h3>
                            <button
                                onClick={() => setActiveTab('requests')}
                                className="text-xs font-semibold text-blue-600 hover:underline"
                            >
                                Barchasini ko{`'`}rish →
                            </button>
                        </div>
                        {requests.slice(0, 5).map(r => (
                            <div key={r.id} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
                                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                                    <Recycle size={16} className="text-emerald-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-gray-900 truncate">{r.name}</p>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[r.status]?.bg || 'bg-gray-100'} ${STATUS_COLORS[r.status]?.text || 'text-gray-600'}`}>
                                            {STATUS_LABELS[r.status] || r.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400">{r.phone} • {getPointName(r.regionId)}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-bold text-gray-700">{r.volume ? `${r.volume} kg` : '—'}</p>
                                    <p className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString('ru-RU')}</p>
                                </div>
                            </div>
                        ))}
                        {requests.length === 0 && (
                            <p className="text-center text-sm text-gray-400 py-8">Hali arizalar yo{`'`}q</p>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* POINTS TAB */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === 'points' && (
                <div className="space-y-4">
                    {/* Add button */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                setShowPointForm(!showPointForm);
                                setEditingPoint(null);
                                setPointForm(EMPTY_POINT);
                            }}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors"
                        >
                            <Plus size={16} /> Yangi baza
                        </button>
                    </div>

                    {/* Point Form */}
                    {showPointForm && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-5">
                                {editingPoint ? 'Bazani tahrirlash' : 'Yangi baza qo\'shish'}
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Viloyat (UZ) *
                                    </label>
                                    <input
                                        value={pointForm.regionUz}
                                        onChange={e => setPointForm(f => ({ ...f, regionUz: e.target.value }))}
                                        placeholder="Toshkent"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Viloyat (RU)
                                    </label>
                                    <input
                                        value={pointForm.regionRu}
                                        onChange={e => setPointForm(f => ({ ...f, regionRu: e.target.value }))}
                                        placeholder="Ташкент"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Shahar (UZ) *
                                    </label>
                                    <input
                                        value={pointForm.cityUz}
                                        onChange={e => setPointForm(f => ({ ...f, cityUz: e.target.value }))}
                                        placeholder="Toshkent sh."
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Shahar (RU)
                                    </label>
                                    <input
                                        value={pointForm.cityRu}
                                        onChange={e => setPointForm(f => ({ ...f, cityRu: e.target.value }))}
                                        placeholder="г. Ташкент"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Telefon *
                                    </label>
                                    <input
                                        value={pointForm.phone}
                                        onChange={e => setPointForm(f => ({ ...f, phone: e.target.value }))}
                                        placeholder="+998 71 234-56-78"
                                        type="tel"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Manzil (to{`'`}liq)
                                    </label>
                                    <input
                                        value={(pointForm as typeof pointForm & { address: string }).address}
                                        onChange={e => setPointForm(f => ({ ...f, address: e.target.value }))}
                                        placeholder={"Toshkent sh., Yunusobod tumani, 5-ko'cha 12-uy"}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        📍 Kenglik (Latitude)
                                    </label>
                                    <input
                                        value={(pointForm as typeof pointForm & { lat: string }).lat}
                                        onChange={e => setPointForm(f => ({ ...f, lat: e.target.value }))}
                                        placeholder="41.2995"
                                        type="number"
                                        step="0.0001"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        📍 Uzunlik (Longitude)
                                    </label>
                                    <input
                                        value={(pointForm as typeof pointForm & { lng: string }).lng}
                                        onChange={e => setPointForm(f => ({ ...f, lng: e.target.value }))}
                                        placeholder="69.2401"
                                        type="number"
                                        step="0.0001"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Google Maps dan nusxalash: O{`'`}ng klik → &quot;Bu joy haqida&quot;
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Status
                                    </label>
                                    <select
                                        value={pointForm.status}
                                        onChange={e => setPointForm(f => ({ ...f, status: e.target.value }))}
                                        title="Status tanlash"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 bg-white"
                                    >
                                        <option value="active">✅ Faol</option>
                                        <option value="planned">🟡 Rejalashtirilgan</option>
                                    </select>
                                </div>

                                {/* Color picker */}
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Rang</label>
                                    <div className="flex flex-wrap gap-2">
                                        {POINT_COLORS.map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setPointForm(f => ({ ...f, color: c }))}
                                                className={`w-8 h-8 rounded-lg ${c} transition-all ${
                                                    pointForm.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                                                }`}
                                                title={c}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-5">
                                <button
                                    onClick={handlePointSubmit}
                                    disabled={savingPoint}
                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
                                >
                                    {savingPoint ? 'Saqlanmoqda...' : editingPoint ? 'Saqlash' : <>Qo{`'`}shish</>}
                                </button>
                                <button
                                    onClick={() => { setShowPointForm(false); setEditingPoint(null); setPointForm(EMPTY_POINT); }}
                                    className="border border-gray-200 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                                >
                                    Bekor qilish
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Points Grid */}
                    {loadingPoints ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />)}
                        </div>
                    ) : filteredPoints.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                            <MapPin size={40} className="mx-auto text-gray-200 mb-3" />
                            <p className="text-gray-400 font-medium">Hali bazalar yo{`'`}q</p>
                            <button onClick={() => setShowPointForm(true)} className="text-emerald-600 text-sm font-semibold mt-2 hover:underline">
                                Birinchi bazani qo{`'`}shing →
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPoints.map(point => (
                                <div key={point.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all group">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 ${point.color} rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-md`}>
                                                {point.id}
                                            </div>
                                            <div>
                                                <p className="font-extrabold text-gray-900">{point.regionUz}</p>
                                                <p className="text-xs text-gray-400">{point.cityUz}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            point.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {point.status === 'active' ? '✅ Faol' : '🟡 Reja'}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
                                        <Phone size={12} />
                                        {point.phone}
                                    </div>

                                    {point.regionRu && (
                                        <p className="text-xs text-gray-400 mb-3">{point.regionRu} / {point.cityRu}</p>
                                    )}

                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => startEditPoint(point)}
                                            className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <Pencil size={12} /> Tahrirlash
                                        </button>
                                        <button
                                            onClick={() => handlePointDelete(point.id)}
                                            className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={12} /> O{`'`}chirish
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* REQUESTS TAB */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === 'requests' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                value={requestSearch}
                                onChange={e => setRequestSearch(e.target.value)}
                                placeholder="Ism, telefon yoki ID..."
                                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                            />
                        </div>
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
                            {[
                                ['all', 'Barchasi'],
                                ['new', '🔵 Yangi'],
                                ['dispatched', '📤 Yuborilgan'],
                                ['en_route', '🚚 Yo\'lda'],
                                ['collected', '✅ Yig\'ildi'],
                                ['completed', '🟢 Bajarildi'],
                                ['disputed', '⚠️ Bahsli'],
                                ['cancelled', '🔴 Bekor'],
                            ].map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setRequestFilter(key)}
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
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Baza</label>
                            <select
                                value={selectedPointId ?? ''}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setSelectedPointId(v ? parseInt(v, 10) : null);
                                }}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
                                title="Baza"
                            >
                                <option value="">Barcha bazalar</option>
                                {points.map((p) => (
                                    <option key={p.id} value={p.id}>{p.regionUz}</option>
                                ))}
                            </select>
                        </div>
                        <div className="min-w-[160px]">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Masul</label>
                            <select
                                value={selectedSupervisorId ?? ''}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setSelectedSupervisorId(v ? parseInt(v, 10) : null);
                                }}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
                                title="Masul"
                            >
                                <option value="">Barcha masullar</option>
                                {supervisors.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="min-w-[160px]">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Haydovchi</label>
                            <select
                                value={selectedDriverId ?? ''}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setSelectedDriverId(v ? parseInt(v, 10) : null);
                                }}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
                                title="Haydovchi"
                            >
                                <option value="">Barcha haydovchilar</option>
                                {driverOptions.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        {requestsHasExtraFilters && (
                            <button
                                type="button"
                                onClick={() => {
                                    setRequestSearch('');
                                    setRequestFilter('all');
                                    setSelectedPointId(null);
                                    setSelectedSupervisorId(null);
                                    setSelectedDriverId(null);
                                }}
                                className="px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100"
                            >
                                Barcha filtrlarni tozalash
                            </button>
                        )}
                    </div>

                    {/* Requests List */}
                    {loadingRequests ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                            <Package size={40} className="mx-auto text-gray-200 mb-3" />
                            <p className="text-gray-400 font-medium">
                                {requestsHasExtraFilters ? (
                                    'Topilmadi'
                                ) : (
                                    <>Hali arizalar yo{`'`}q</>
                                )}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            {/* Table Header */}
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

                            {filteredRequests.map(r => {
                                const sc = STATUS_COLORS[r.status] || STATUS_COLORS.new;
                                return (
                                    <div key={r.id} className="grid grid-cols-1 lg:grid-cols-[50px_1fr_120px_100px_80px_80px_160px_160px] gap-2 lg:gap-3 px-5 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors items-center">
                                        <span className="text-sm font-bold text-gray-400">#{r.id}</span>

                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 text-sm truncate">{r.name}</p>
                                            <p className="text-xs text-gray-400">{r.phone}</p>
                                            {r.address && <p className="text-[10px] text-gray-300 truncate">📍 {r.address}</p>}
                                        </div>

                                        <span className="text-xs text-gray-600 font-medium truncate">📍 {getPointName(r.regionId)}</span>
                                        <span className="text-xs text-gray-500 truncate">{r.material || '—'}</span>
                                        <span className="text-sm font-bold text-gray-700">{r.volume ? `${r.volume} kg` : '—'}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${r.pickupType === 'pickup' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {r.pickupType === 'pickup' ? '🚛' : '🏭'}
                                        </span>

                                        {/* Dispatch info */}
                                        <div className="space-y-1">
                                            {r.supervisor ? (
                                                <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded block truncate">👷 {r.supervisor.name}</span>
                                            ) : r.status === 'new' ? (
                                                <select
                                                    title="Masulga yo'naltirish"
                                                    defaultValue=""
                                                    onChange={async (e) => {
                                                        if (!e.target.value) return;
                                                        const res = await fetch('/api/admin/recycling/dispatch', {
                                                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ action: 'dispatch_to_supervisor', requestId: r.id, supervisorId: Number(e.target.value) }),
                                                        });
                                                        if (res.ok) { toast.success('Masulga yo\'naltirildi ✅'); fetchRequests(); }
                                                    }}
                                                    className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border-0 w-full cursor-pointer"
                                                >
                                                    <option value="">📤 Masulga →</option>
                                                    {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            ) : <span className="text-[10px] text-gray-300">—</span>}
                                            {r.assignedDriver && (
                                                <span className="text-[10px] bg-purple-50 text-purple-600 font-bold px-1.5 py-0.5 rounded block truncate">🚚 {r.assignedDriver.name}</span>
                                            )}
                                        </div>

                                        {/* Status dropdown */}
                                        <div className="relative">
                                            <select
                                                value={r.status}
                                                onChange={e => updateRequestStatus(r.id, e.target.value)}
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
                                            <ChevronDown size={10} className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${sc.text}`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Total count */}
                    <p className="text-xs text-gray-400 text-right">
                        Jami: {filteredRequests.length} ta ariza
                        {requestFilter !== 'all' && ` (filtr: ${STATUS_LABELS[requestFilter] || requestFilter})`}
                    </p>
                </div>
            )}

            {/* MASUL SHAXSLAR TAB */}
            {activeTab === 'supervisors' && (
                <SupervisorsTab
                    points={points.map(p => ({ id: p.id, regionUz: p.regionUz }))}
                    selectedSupervisorId={selectedSupervisorId}
                />
            )}

            {/* HAYDOVCHILAR TAB */}
            {activeTab === 'drivers' && (
                <DriversTab
                    points={points.map(p => ({ id: p.id, regionUz: p.regionUz }))}
                    supervisors={supervisors.map(s => ({ id: s.id, name: s.name }))}
                    selectedDriverId={selectedDriverId}
                />
            )}

            {/* HISOB-KITOB TAB */}
            {activeTab === 'collections' && <CollectionsTab />}

            {/* OYLIK JURNAL TAB */}
            {activeTab === 'journal' && (
                <MonthlyJournalTab
                    points={points.map(p => ({ id: p.id, name: p.regionUz }))}
                    supervisors={supervisors.map(s => ({ id: s.id, name: s.name }))}
                    urlPointId={selectedPointId}
                    urlSupervisorId={selectedSupervisorId}
                    onFilterUrlChange={syncJournalFiltersFromChild}
                />
            )}

            {/* BOT EVENTS TAB */}
            {activeTab === 'bot-events' && <BotEventsTab />}

            {/* SHIKOYATLAR TAB */}
            {activeTab === 'complaints' && (
                <ComplaintsTab highlightRequestId={complaintsHighlightRequestId} />
            )}
        </div>
    );
}
