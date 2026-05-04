'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Archive, Bell, CheckCheck, ClipboardCheck, Link2, RefreshCcw, Shield, UserPlus } from 'lucide-react';
import {
    getAdminCollectionHref,
    getAdminDriverHref,
    getAdminEventHref,
    getAdminPointHref,
    getAdminRequestHref,
    getAdminSupervisorHref,
} from '@/lib/platform/eventLinks';
import {
    buildBotEventFeedApiQuery,
    buildPathWithBeBotEventFilters,
    readBotEventFeedFiltersFromUrl,
} from '@/lib/platform/botEventFeedUrl';

type BotEventRow = {
    id: number;
    sourceBot: string;
    eventType: string;
    entityType: string | null;
    entityId: number | null;
    severity: string;
    title: string;
    message: string;
    status: string;
    requestId: number | null;
    collectionId: number | null;
    supervisorId: number | null;
    driverId: number | null;
    pointId: number | null;
    createdAt: string;
};

type BotEventsResponse = {
    items: BotEventRow[];
    summary: {
        total: number;
        unread: number;
        critical: number;
        bySource: Array<{ sourceBot: string; count: number }>;
        byEventType: Array<{ eventType: string; count: number }>;
        byEntityType: Array<{ entityType: string; count: number }>;
    };
};

type HqAdmin = {
    id: number;
    name: string;
    phone: string;
    telegramId: string | null;
    telegramName: string | null;
    registrationCode: string | null;
    isActive: boolean;
    registeredAt: string | null;
    lastSeenAt: string | null;
    createdAt: string;
};

type BotAccessRequestRow = {
    id: number;
    role: string;
    status: string;
    name: string;
    phone: string;
    telegramId: string | null;
    telegramName: string | null;
    vehicleInfo: string | null;
    requestedPoint?: { id: number; regionUz: string } | null;
    requestedSupervisor?: { id: number; name: string } | null;
    createdSupervisor?: { id: number; name: string } | null;
    createdDriver?: { id: number; name: string } | null;
    createdAt: string;
};

type BotAccessRequestsResponse = {
    items: BotAccessRequestRow[];
    summary: Array<{ role: string; status: string; _count: { _all: number } }>;
};

const SOURCE_LABELS: Record<string, string> = {
    customer: 'Customer Bot',
    driver: 'Driver Bot',
    supervisor: 'Supervisor Bot',
    platform: 'Platform',
    pack24admin: 'Pack24Admin Bot',
};

const SOURCE_COLORS: Record<string, string> = {
    customer: 'bg-blue-100 text-blue-700',
    driver: 'bg-cyan-100 text-cyan-700',
    supervisor: 'bg-purple-100 text-purple-700',
    platform: 'bg-gray-100 text-gray-700',
    pack24admin: 'bg-emerald-100 text-emerald-700',
};

const SEVERITY_COLORS: Record<string, string> = {
    info: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
};

function formatEntityLabel(event: BotEventRow) {
    if (!event.entityType) return null;
    return event.entityId ? `${event.entityType} #${event.entityId}` : event.entityType;
}

export default function BotEventsTab() {
    const router = useRouter();
    const pathname = usePathname();

    const [events, setEvents] = useState<BotEventRow[]>([]);
    const [summary, setSummary] = useState<BotEventsResponse['summary']>({
        total: 0,
        unread: 0,
        critical: 0,
        bySource: [],
        byEventType: [],
        byEntityType: [],
    });
    const [hqAdmins, setHqAdmins] = useState<HqAdmin[]>([]);
    const [accessRequests, setAccessRequests] = useState<BotAccessRequestRow[]>([]);
    const [accessSummary, setAccessSummary] = useState<BotAccessRequestsResponse['summary']>([]);
    const [loading, setLoading] = useState(true);
    const [loadingAdmins, setLoadingAdmins] = useState(true);
    const [loadingAccessRequests, setLoadingAccessRequests] = useState(true);
    const [accessRole, setAccessRole] = useState('all');
    const [accessStatus, setAccessStatus] = useState('pending');
    const [sourceBot, setSourceBot] = useState('all');
    const [severity, setSeverity] = useState('all');
    const [status, setStatus] = useState('all');
    const [eventType, setEventType] = useState('all');
    const [entityType, setEntityType] = useState('all');
    const [entityId, setEntityId] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [search, setSearch] = useState('');
    const [savingAdmin, setSavingAdmin] = useState(false);
    const [adminForm, setAdminForm] = useState({ name: '', phone: '' });
    const [urlReady, setUrlReady] = useState(false);

    useEffect(() => {
        const initial = readBotEventFeedFiltersFromUrl(
            new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search),
        );
        setSourceBot(initial.sourceBot);
        setEventType(initial.eventType);
        setEntityType(initial.entityType);
        setEntityId(initial.entityId);
        setFromDate(initial.fromDate);
        setToDate(initial.toDate);
        setSeverity(initial.severity);
        setStatus(initial.status);
        setSearch(initial.search);
        setUrlReady(true);
    }, []);

    const buildEventsQuery = useCallback(
        () =>
            buildBotEventFeedApiQuery({
                sourceBot,
                eventType,
                entityType,
                entityId,
                fromDate,
                toDate,
                severity,
                status,
                search,
            }),
        [entityId, entityType, eventType, fromDate, search, severity, sourceBot, status, toDate],
    );

    const buildPageUrlWithBeFilters = useCallback(() => {
        if (typeof window === 'undefined') {
            return pathname;
        }
        return buildPathWithBeBotEventFilters(
            pathname,
            window.location.search,
            {
                sourceBot,
                eventType,
                entityType,
                entityId,
                fromDate,
                toDate,
                severity,
                status,
                search,
            },
            { recyclingTab: 'bot-events' },
        );
    }, [entityId, entityType, eventType, fromDate, pathname, search, severity, sourceBot, status, toDate]);

    const copyFeedLink = async () => {
        const href = buildPageUrlWithBeFilters();
        const absolute = typeof window === 'undefined' ? href : new URL(href, window.location.origin).href;

        try {
            await navigator.clipboard.writeText(absolute);
            toast.success('Havola nusxalandi');
        } catch {
            toast.error('Nusxalab bo\'lmadi');
        }
    };

    const fetchEvents = useCallback(async () => {
        if (!urlReady) return;
        setLoading(true);
        try {
            const query = buildEventsQuery();
            const res = await fetch(`/api/admin/bot-events?${query.toString()}`);
            if (!res.ok) throw new Error();
            const data: BotEventsResponse = await res.json();
            setEvents(data.items);
            setSummary(data.summary);
        } catch {
            toast.error('Bot eventlarni yuklab bo\'lmadi');
        } finally {
            setLoading(false);
        }
    }, [buildEventsQuery, urlReady]);

    useEffect(() => {
        if (!urlReady) return;
        if (typeof window === 'undefined') return;

        const nextUrl = buildPageUrlWithBeFilters();
        if (nextUrl === `${window.location.pathname}${window.location.search}`) return;

        router.replace(nextUrl, { scroll: false });
    }, [buildPageUrlWithBeFilters, router, urlReady]);

    const fetchAdmins = useCallback(async () => {
        setLoadingAdmins(true);
        try {
            const res = await fetch('/api/admin/bot-events/hq-admins');
            if (!res.ok) throw new Error();
            setHqAdmins(await res.json());
        } catch {
            toast.error('HQ adminlarni yuklab bo\'lmadi');
        } finally {
            setLoadingAdmins(false);
        }
    }, []);

    const fetchAccessRequests = useCallback(async () => {
        setLoadingAccessRequests(true);
        try {
            const query = new URLSearchParams({ role: accessRole, status: accessStatus });
            const res = await fetch(`/api/admin/bot-access-requests?${query.toString()}`);
            if (!res.ok) throw new Error();
            const data: BotAccessRequestsResponse = await res.json();
            setAccessRequests(data.items);
            setAccessSummary(data.summary);
        } catch {
            toast.error('Bot arizalarini yuklab bo\'lmadi');
        } finally {
            setLoadingAccessRequests(false);
        }
    }, [accessRole, accessStatus]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    useEffect(() => {
        fetchAdmins();
    }, [fetchAdmins]);

    useEffect(() => {
        fetchAccessRequests();
    }, [fetchAccessRequests]);

    const updateEventStatus = async (id: number, nextStatus: 'read' | 'archived') => {
        try {
            const res = await fetch(`/api/admin/bot-events/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus }),
            });
            if (!res.ok) throw new Error();
            toast.success(nextStatus === 'read' ? 'Event o\'qildi deb belgilandi' : 'Event arxivlandi');
            fetchEvents();
        } catch {
            toast.error('Event holatini yangilab bo\'lmadi');
        }
    };

    const handleAccessRequestAction = async (id: number, action: 'approve' | 'reject') => {
        if (action === 'reject' && !confirm('Bu arizani rad etasizmi?')) return;

        try {
            const res = await fetch(`/api/admin/bot-access-requests/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    reason: action === 'reject' ? 'Admin panel orqali rad etildi' : undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Action xatosi');
            toast.success(action === 'approve' ? 'Ariza tasdiqlandi' : 'Ariza rad etildi');
            fetchAccessRequests();
            fetchEvents();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Arizani yangilab bo\'lmadi');
        }
    };

    const submitAdmin = async () => {
        if (!adminForm.name.trim() || !adminForm.phone.trim()) {
            toast.error('Ism va telefon majburiy');
            return;
        }

        setSavingAdmin(true);
        try {
            const res = await fetch('/api/admin/bot-events/hq-admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(adminForm),
            });
            if (!res.ok) throw new Error();
            toast.success('HQ admin qo\'shildi');
            setAdminForm({ name: '', phone: '' });
            fetchAdmins();
        } catch {
            toast.error('HQ admin qo\'shib bo\'lmadi');
        } finally {
            setSavingAdmin(false);
        }
    };

    const updateAdmin = async (id: number, body: Record<string, unknown>, successMessage: string) => {
        try {
            const res = await fetch(`/api/admin/bot-events/hq-admins/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error();
            toast.success(successMessage);
            fetchAdmins();
        } catch {
            toast.error('HQ adminni yangilab bo\'lmadi');
        }
    };

    const deleteAdmin = async (id: number) => {
        if (!confirm('Bu HQ adminni o\'chirasizmi?')) return;

        try {
            const res = await fetch(`/api/admin/bot-events/hq-admins/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            toast.success('HQ admin o\'chirildi');
            fetchAdmins();
        } catch {
            toast.error('HQ adminni o\'chirib bo\'lmadi');
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Jami eventlar', value: summary.total, icon: Bell, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Yangi eventlar', value: summary.unread, icon: RefreshCcw, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Muhim alertlar', value: summary.critical, icon: Shield, color: 'text-red-600', bg: 'bg-red-50' },
                ].map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="bg-white border border-gray-100 rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bg}`}>
                                    <Icon size={18} className={card.color} />
                                </div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{card.label}</p>
                            </div>
                            <p className="text-3xl font-black text-gray-900">{card.value}</p>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-6">
                <div className="space-y-4">
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
                        <div className="flex flex-wrap gap-2 items-center justify-between">
                            <div>
                                <h3 className="text-lg font-extrabold text-gray-900">Bot Event Feed</h3>
                                <p className="text-sm text-gray-500">Customer, driver, supervisor va platforma signalari</p>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={copyFeedLink}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-700"
                                >
                                    <Link2 size={14} />
                                    Linkni nusxalash
                                </button>
                                <button
                                    type="button"
                                    onClick={fetchEvents}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700"
                                >
                                    <RefreshCcw size={14} />
                                    Yangilash
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-8 gap-3">
                            <select value={sourceBot} onChange={(e) => setSourceBot(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
                                <option value="all">Barcha manbalar</option>
                                <option value="customer">Customer</option>
                                <option value="driver">Driver</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="platform">Platform</option>
                                <option value="pack24admin">Pack24Admin</option>
                            </select>
                            <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
                                <option value="all">Barcha event turlari</option>
                                {summary.byEventType.map((item) => (
                                    <option key={item.eventType} value={item.eventType}>
                                        {item.eventType} ({item.count})
                                    </option>
                                ))}
                            </select>
                            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
                                <option value="all">Barcha entity turlari</option>
                                {summary.byEntityType.map((item) => (
                                    <option key={item.entityType} value={item.entityType}>
                                        {item.entityType} ({item.count})
                                    </option>
                                ))}
                            </select>
                            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
                                <option value="all">Barcha severity</option>
                                <option value="info">Info</option>
                                <option value="success">Success</option>
                                <option value="warning">Warning</option>
                                <option value="error">Error</option>
                            </select>
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
                                <option value="all">Barcha status</option>
                                <option value="new">New</option>
                                <option value="read">Read</option>
                                <option value="archived">Archived</option>
                            </select>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Qidirish..."
                                className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                            />
                            <input
                                value={entityId}
                                onChange={(e) => setEntityId(e.target.value.replace(/[^\d]/g, ''))}
                                placeholder="Entity ID..."
                                className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                            />
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                            />
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {summary.bySource.map((item) => (
                                <span
                                    key={item.sourceBot}
                                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${SOURCE_COLORS[item.sourceBot] || 'bg-gray-100 text-gray-700'}`}
                                >
                                    {SOURCE_LABELS[item.sourceBot] || item.sourceBot}: {item.count}
                                </span>
                            ))}
                        </div>
                        {summary.byEventType.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {summary.byEventType.slice(0, 8).map((item) => (
                                    <button
                                        key={item.eventType}
                                        onClick={() => setEventType(item.eventType)}
                                        className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                            eventType === item.eventType
                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                    >
                                        {item.eventType}: {item.count}
                                    </button>
                                ))}
                                {eventType !== 'all' && (
                                    <button
                                        onClick={() => setEventType('all')}
                                        className="text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-gray-300"
                                    >
                                        Tozalash
                                    </button>
                                )}
                            </div>
                        )}
                        {summary.byEntityType.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {summary.byEntityType.slice(0, 8).map((item) => (
                                    <button
                                        key={item.entityType}
                                        onClick={() => setEntityType(item.entityType)}
                                        className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                            entityType === item.entityType
                                                ? 'bg-slate-100 border-slate-300 text-slate-800'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                    >
                                        {item.entityType}: {item.count}
                                    </button>
                                ))}
                                {(entityType !== 'all' || entityId.trim()) && (
                                    <button
                                        onClick={() => {
                                            setEntityType('all');
                                            setEntityId('');
                                        }}
                                        className="text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-gray-300"
                                    >
                                        Entity filtrni tozalash
                                    </button>
                                )}
                            </div>
                        )}
                        {(fromDate || toDate) && (
                            <div className="flex flex-wrap gap-2">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                                    Davr: {fromDate || '...'} - {toDate || '...'}
                                </span>
                                <button
                                    onClick={() => {
                                        setFromDate('');
                                        setToDate('');
                                    }}
                                    className="text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-gray-300"
                                >
                                    Sana filtrini tozalash
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-400">
                                Yuklanmoqda...
                            </div>
                        ) : events.length === 0 ? (
                            <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-400">
                                Event topilmadi
                            </div>
                        ) : events.map((event) => (
                            <div key={event.id} className="bg-white border border-gray-100 rounded-2xl p-5">
                                {(() => {
                                    const eventHref = getAdminEventHref(event);
                                    const requestHref = getAdminRequestHref(event.requestId);
                                    const collectionHref = getAdminCollectionHref(event.collectionId);
                                    const driverHref = getAdminDriverHref(event.driverId);
                                    const supervisorHref = getAdminSupervisorHref(event.supervisorId);
                                    const pointHref = getAdminPointHref(event.pointId);
                                    return (
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-2">
                                            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${SOURCE_COLORS[event.sourceBot] || 'bg-gray-100 text-gray-700'}`}>
                                                {SOURCE_LABELS[event.sourceBot] || event.sourceBot}
                                            </span>
                                            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                                                {event.eventType}
                                            </span>
                                            {formatEntityLabel(event) && (
                                                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                                                    {formatEntityLabel(event)}
                                                </span>
                                            )}
                                            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${SEVERITY_COLORS[event.severity] || 'bg-gray-100 text-gray-700'}`}>
                                                {event.severity}
                                            </span>
                                            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                                {event.status}
                                            </span>
                                        </div>
                                        <h4 className="text-base font-bold text-gray-900">{event.title}</h4>
                                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.message}</p>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                                            <span>{new Date(event.createdAt).toLocaleString('ru-RU')}</span>
                                            {requestHref && (
                                                <a
                                                    href={requestHref}
                                                    className="font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                >
                                                    Ariza #{event.requestId}
                                                </a>
                                            )}
                                            {collectionHref && (
                                                <a
                                                    href={collectionHref}
                                                    className="font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100"
                                                >
                                                    Yig{`'`}ish #{event.collectionId}
                                                </a>
                                            )}
                                            {driverHref && (
                                                <a
                                                    href={driverHref}
                                                    className="font-semibold px-2 py-1 rounded-full bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                                                >
                                                    Haydovchi #{event.driverId}
                                                </a>
                                            )}
                                            {supervisorHref && (
                                                <a
                                                    href={supervisorHref}
                                                    className="font-semibold px-2 py-1 rounded-full bg-violet-50 text-violet-700 hover:bg-violet-100"
                                                >
                                                    Masul #{event.supervisorId}
                                                </a>
                                            )}
                                            {pointHref && (
                                                <a
                                                    href={pointHref}
                                                    className="font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                                                >
                                                    Baza #{event.pointId}
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {eventHref && (
                                            <a
                                                href={eventHref}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold"
                                            >
                                                Ochish
                                            </a>
                                        )}
                                        {event.status === 'new' && (
                                            <button
                                                onClick={() => updateEventStatus(event.id, 'read')}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold"
                                            >
                                                <CheckCheck size={14} />
                                                Read
                                            </button>
                                        )}
                                        {event.status !== 'archived' && (
                                            <button
                                                onClick={() => updateEventStatus(event.id, 'archived')}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold"
                                            >
                                                <Archive size={14} />
                                                Archive
                                            </button>
                                        )}
                                    </div>
                                </div>
                                    );
                                })()}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-extrabold text-gray-900">Staff Approval</h3>
                                <p className="text-sm text-gray-500">Admin va driver bot arizalarini tasdiqlash</p>
                            </div>
                            <ClipboardCheck size={18} className="text-emerald-600" />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {accessSummary.map((item) => (
                                <span key={`${item.role}-${item.status}`} className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                    {item.role}/{item.status}: {item._count._all}
                                </span>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <select value={accessRole} onChange={(e) => setAccessRole(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
                                <option value="all">Barcha rollar</option>
                                <option value="supervisor">Admin</option>
                                <option value="driver">Driver</option>
                            </select>
                            <select value={accessStatus} onChange={(e) => setAccessStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="all">Barchasi</option>
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={fetchAccessRequests}
                            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700"
                        >
                            <RefreshCcw size={14} />
                            Arizalarni yangilash
                        </button>
                    </div>

                    <div className="space-y-3">
                        {loadingAccessRequests ? (
                            <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-sm text-gray-400">
                                Arizalar yuklanmoqda...
                            </div>
                        ) : accessRequests.length === 0 ? (
                            <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-sm text-gray-400">
                                Staff arizalari topilmadi
                            </div>
                        ) : accessRequests.map((request) => (
                            <div key={request.id} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${request.role === 'driver' ? 'bg-cyan-100 text-cyan-700' : 'bg-violet-100 text-violet-700'}`}>
                                                {request.role === 'driver' ? 'Driver' : 'Admin'}
                                            </span>
                                            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                                                {request.status}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-gray-900">{request.name}</h4>
                                        <p className="text-sm text-gray-600">{request.phone}</p>
                                        <p className="text-xs text-gray-400">Telegram: {request.telegramId || 'ulanmagan'}</p>
                                        {request.vehicleInfo && <p className="text-xs text-gray-400">Mashina: {request.vehicleInfo}</p>}
                                        <p className="text-xs text-gray-400">
                                            Baza: {request.requestedPoint?.regionUz || '—'} | Admin: {request.requestedSupervisor?.name || '—'}
                                        </p>
                                        <p className="text-xs text-gray-400">{new Date(request.createdAt).toLocaleString('ru-RU')}</p>
                                    </div>
                                </div>

                                {request.status === 'pending' && (
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => handleAccessRequestAction(request.id, 'approve')}
                                            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-sm font-semibold text-emerald-700"
                                        >
                                            Tasdiqlash
                                        </button>
                                        <button
                                            onClick={() => handleAccessRequestAction(request.id, 'reject')}
                                            className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-sm font-semibold text-red-700"
                                        >
                                            Rad etish
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
                        <div>
                            <h3 className="text-lg font-extrabold text-gray-900">HQ Adminlar</h3>
                            <p className="text-sm text-gray-500">Telefon orqali `pack24admin_bot` ga ulanadigan foydalanuvchilar</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <input
                                value={adminForm.name}
                                onChange={(e) => setAdminForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="Ism"
                                className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                            />
                            <input
                                value={adminForm.phone}
                                onChange={(e) => setAdminForm((prev) => ({ ...prev, phone: e.target.value }))}
                                placeholder="+998901234567"
                                className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                            />
                            <button
                                onClick={submitAdmin}
                                disabled={savingAdmin}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold"
                            >
                                <UserPlus size={14} />
                                HQ admin qo{`'`}shish
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {loadingAdmins ? (
                            <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-sm text-gray-400">
                                Yuklanmoqda...
                            </div>
                        ) : hqAdmins.length === 0 ? (
                            <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-sm text-gray-400">
                                HQ adminlar hali qo{`'`}shilmagan
                            </div>
                        ) : hqAdmins.map((admin) => (
                            <div key={admin.id} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h4 className="font-bold text-gray-900">{admin.name}</h4>
                                        <p className="text-sm text-gray-600">{admin.phone}</p>
                                        <p className="text-xs text-gray-400">
                                            Kod: {admin.registrationCode || '—'}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            Telegram: {admin.telegramId || 'ulanmagan'}
                                        </p>
                                    </div>
                                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${admin.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {admin.isActive ? 'Faol' : 'Nofaol'}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => updateAdmin(admin.id, { isActive: !admin.isActive }, admin.isActive ? "HQ admin o'chirib qo'yildi" : 'HQ admin faollashtirildi')}
                                        className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700"
                                    >
                                        {admin.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button
                                        onClick={() => updateAdmin(admin.id, { resetRegistrationCode: true }, 'Yangi registration code yaratildi')}
                                        className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-sm font-semibold text-amber-700"
                                    >
                                        Kodni yangilash
                                    </button>
                                    {admin.telegramId && (
                                        <button
                                            onClick={() => updateAdmin(admin.id, { unlinkTelegram: true }, 'Telegram ulanishi uzildi')}
                                            className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-sm font-semibold text-purple-700"
                                        >
                                            Unlink Telegram
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteAdmin(admin.id)}
                                        className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-sm font-semibold text-red-700"
                                    >
                                        O{`'`}chirish
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
