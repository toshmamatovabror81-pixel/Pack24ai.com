'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Recycle, Download } from 'lucide-react';
import SupervisorsTab from './_components/SupervisorsTab';
import DriversTab from './_components/DriversTab';
import TeamReportTab from './_components/TeamReportTab';
import CollectionsTab from './_components/CollectionsTab';
import ComplaintsTab from './_components/ComplaintsTab';
import MonthlyJournalTab from './_components/MonthlyJournalTab';
import BotEventsTab from './_components/BotEventsTab';
import FinanceTab from './_components/FinanceTab';
import PayoutsTab from './_components/PayoutsTab';
import DashboardTab from './_components/DashboardTab';
import MapTab from './_components/MapTab';
import PointsTab from './_components/PointsTab';
import RequestsTab from './_components/RequestsTab';
import { removeBotEventFeedParamsFromSearchString } from '@/lib/platform/botEventFeedUrl';
import { readInitialRecyclingFilters } from './_lib/urlFilters';
import {
    computeRecyclingStats,
    type AdminRecyclingTab,
    type RecyclePoint,
    type RecycleRequest,
    type RecyclingSupervisor,
} from './_lib/types';

export default function AdminRecyclingPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [recyclingUrlReady, setRecyclingUrlReady] = useState(false);
    const [activeTab, setActiveTab] = useState<AdminRecyclingTab>('dashboard');
    const [supervisors, setSupervisors] = useState<RecyclingSupervisor[]>([]);
    const [points, setPoints] = useState<RecyclePoint[]>([]);
    const [loadingPoints, setLoadingPoints] = useState(true);
    const [requests, setRequests] = useState<RecycleRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [requestFilter, setRequestFilter] = useState('all');
    const [requestSearch, setRequestSearch] = useState('');
    const [selectedPointId, setSelectedPointId] = useState<number | null>(null);
    const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | null>(null);
    const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
    const [driverOptions, setDriverOptions] = useState<Array<{ id: number; name: string }>>([]);

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

    const fetchPoints = useCallback(async () => {
        setLoadingPoints(true);
        try {
            const res = await fetch('/api/admin/recycling/points');
            if (res.ok) setPoints(await res.json());
        } catch {
            toast.error('Bazalarni yuklashda xatolik');
        } finally {
            setLoadingPoints(false);
        }
    }, []);

    const fetchRequests = useCallback(async () => {
        setLoadingRequests(true);
        try {
            const res = await fetch('/api/admin/recycling/requests');
            if (res.ok) setRequests(await res.json());
        } catch {
            toast.error('Arizalarni yuklashda xatolik');
        } finally {
            setLoadingRequests(false);
        }
    }, []);

    const fetchSupervisors = useCallback(async () => {
        try {
            const r = await fetch('/api/admin/recycling/supervisors');
            if (r.ok) setSupervisors(await r.json());
        } catch { /* ignore */ }
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
        const f = readInitialRecyclingFilters();
        setActiveTab(f.activeTab);
        setRequestSearch(f.requestSearch);
        setRequestFilter(f.requestFilter);
        setSelectedPointId(f.selectedPointId);
        setSelectedSupervisorId(f.selectedSupervisorId);
        setSelectedDriverId(f.selectedDriverId);
        setRecyclingUrlReady(true);
    }, []);

    useEffect(() => {
        if (!recyclingUrlReady || activeTab === 'bot-events' || typeof window === 'undefined') return;
        const raw = window.location.search.replace(/^\?/, '');
        const next = new URLSearchParams(removeBotEventFeedParamsFromSearchString(raw));
        next.set('tab', activeTab);
        if (activeTab === 'requests') {
            if (requestSearch.trim()) next.set('requestId', requestSearch.trim());
            else next.delete('requestId');
            if (selectedPointId) next.set('pointId', String(selectedPointId));
            else next.delete('pointId');
            if (selectedSupervisorId) next.set('supervisorId', String(selectedSupervisorId));
            else next.delete('supervisorId');
            if (selectedDriverId) next.set('driverId', String(selectedDriverId));
            else next.delete('driverId');
            if (requestFilter !== 'all') next.set('requestStatus', requestFilter);
            else next.delete('requestStatus');
        }
        const qs = next.toString();
        const nextFull = qs ? `${pathname}?${qs}` : pathname;
        const current = `${window.location.pathname}${window.location.search}`;
        if (nextFull !== current) router.replace(nextFull, { scroll: false });
    }, [activeTab, pathname, recyclingUrlReady, router, requestSearch, requestFilter, selectedPointId, selectedSupervisorId, selectedDriverId]);

    const stats = computeRecyclingStats(points, requests);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
                        <Recycle className="text-emerald-600" size={26} />
                        Qayta Ishlash (Makulatura)
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">Bazalar va arizalarni boshqarish</p>
                </div>
                <button
                    type="button"
                    onClick={() => window.open('/api/admin/export?type=recycling&period=365', '_blank')}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
                >
                    <Download size={14} /> Export CSV
                </button>
            </div>

            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
                {([
                    ['dashboard', '📊 Dashboard'],
                    ['map', '🗺️ Xarita'],
                    ['points', '📍 Bazalar'],
                    ['requests', '📋 Arizalar'],
                    ['supervisors', '👷 Masullar'],
                    ['drivers', '🚚 Haydovchilar'],
                    ['team', '👥 Jamoa hisoboti'],
                    ['collections', '💰 Hisob-kitob'],
                    ['finance', '💹 Moliya'],
                    ['payouts', '💳 To\'lovlar'],
                    ['journal', '🧾 Oylik jurnal'],
                    ['bot-events', '🤖 Bot Events'],
                    ['complaints', '⚠️ Shikoyatlar'],
                ] as const).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTab(key)}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                            activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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

            {activeTab === 'dashboard' && (
                <DashboardTab points={points} requests={requests} onOpenRequests={() => setActiveTab('requests')} />
            )}
            {activeTab === 'map' && <MapTab />}
            {activeTab === 'points' && (
                <PointsTab
                    points={points}
                    loading={loadingPoints}
                    selectedPointId={selectedPointId}
                    onRefresh={fetchPoints}
                    onSwitchToPointsTab={() => setActiveTab('points')}
                />
            )}
            {activeTab === 'requests' && (
                <RequestsTab
                    points={points}
                    requests={requests}
                    supervisors={supervisors}
                    driverOptions={driverOptions}
                    loading={loadingRequests}
                    requestFilter={requestFilter}
                    requestSearch={requestSearch}
                    selectedPointId={selectedPointId}
                    selectedSupervisorId={selectedSupervisorId}
                    selectedDriverId={selectedDriverId}
                    onRequestFilterChange={setRequestFilter}
                    onRequestSearchChange={setRequestSearch}
                    onSelectedPointIdChange={setSelectedPointId}
                    onSelectedSupervisorIdChange={setSelectedSupervisorId}
                    onSelectedDriverIdChange={setSelectedDriverId}
                    onRefreshRequests={fetchRequests}
                />
            )}
            {activeTab === 'supervisors' && (
                <SupervisorsTab points={points.map(p => ({ id: p.id, regionUz: p.regionUz }))} selectedSupervisorId={selectedSupervisorId} />
            )}
            {activeTab === 'drivers' && (
                <DriversTab
                    points={points.map(p => ({ id: p.id, regionUz: p.regionUz }))}
                    supervisors={supervisors.map(s => ({ id: s.id, name: s.name }))}
                    selectedDriverId={selectedDriverId}
                />
            )}
            {activeTab === 'team' && <TeamReportTab />}
            {activeTab === 'collections' && <CollectionsTab />}
            {activeTab === 'finance' && <FinanceTab />}
            {activeTab === 'payouts' && <PayoutsTab />}
            {activeTab === 'journal' && (
                <MonthlyJournalTab
                    points={points.map(p => ({ id: p.id, name: p.regionUz }))}
                    supervisors={supervisors.map(s => ({ id: s.id, name: s.name }))}
                    urlPointId={selectedPointId}
                    urlSupervisorId={selectedSupervisorId}
                    onFilterUrlChange={syncJournalFiltersFromChild}
                />
            )}
            {activeTab === 'bot-events' && <BotEventsTab />}
            {activeTab === 'complaints' && <ComplaintsTab highlightRequestId={complaintsHighlightRequestId} />}
        </div>
    );
}
