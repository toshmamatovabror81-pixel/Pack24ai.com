'use client';

import { useEffect } from 'react';
import DriverShell from '@/components/driver/DriverShell';
import { useDriverStore } from '@/lib/store/useDriverStore';
import Link from 'next/link';

export default function DriverDashboardPage() {
    const driver = useDriverStore((s) => s.driver);
    const tasks = useDriverStore((s) => s.tasks);
    const stats = useDriverStore((s) => s.stats);
    const isLoadingTasks = useDriverStore((s) => s.isLoadingTasks);
    const fetchTasks = useDriverStore((s) => s.fetchTasks);
    const fetchStats = useDriverStore((s) => s.fetchStats);

    useEffect(() => {
        fetchTasks('active');
        fetchStats();
    }, [fetchTasks, fetchStats]);

    const activeTasks = tasks.filter((t) =>
        ['assigned', 'en_route', 'arrived', 'collecting'].includes(t.status)
    );

    return (
        <DriverShell>
            <div className="px-4 py-5 space-y-5">

                {/* Greeting */}
                <div>
                    <p className="text-slate-400 text-sm">Xush kelibsiz,</p>
                    <h1 className="text-2xl font-black text-white">{driver?.name ?? '...'}</h1>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-2 gap-3">
                    <StatsCard
                        label="Bugun yig'ildi"
                        value={`${stats?.today.totalWeight ?? 0} kg`}
                        sub={`${stats?.today.collections ?? 0} ta`}
                        color="emerald"
                        icon={<WeightIcon />}
                    />
                    <StatsCard
                        label="Bugun daromad"
                        value={`${(stats?.today.totalAmount ?? 0).toLocaleString()}`}
                        sub="so'm"
                        color="teal"
                        icon={<MoneyIcon />}
                    />
                    <StatsCard
                        label="Jami yig'ildi"
                        value={`${stats?.total.totalWeight ?? 0} kg`}
                        sub={`${stats?.total.workDays ?? 0} ish kuni`}
                        color="sky"
                        icon={<TotalIcon />}
                    />
                    <StatsCard
                        label="Jami buyurtmalar"
                        value={`${stats?.total.collections ?? 0}`}
                        sub="ta yig'ish"
                        color="violet"
                        icon={<CollectIcon />}
                    />
                </div>

                {/* Weekly bar chart */}
                {stats?.weekly && (
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
                        <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Haftalik yig&apos;ish (kg)</p>
                        <WeeklyChart data={stats.weekly} />
                    </div>
                )}

                {/* Active tasks */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold text-white">Faol vazifalar</h2>
                        <Link href="/driver/tasks" className="text-xs text-emerald-400 font-semibold">
                            Barchasi →
                        </Link>
                    </div>

                    {isLoadingTasks ? (
                        <div className="space-y-3">
                            {[1, 2].map((i) => (
                                <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : activeTasks.length === 0 ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
                            <p className="text-slate-500 text-sm">Hozircha faol vazifa yo&apos;q</p>
                            <p className="text-slate-600 text-xs mt-1">Online bo&apos;ling, yangi buyurtmalar keladi</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeTasks.slice(0, 3).map((task) => (
                                <TaskCard key={task.id} task={task} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DriverShell>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; text: string; icon: string }> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'text-emerald-500' },
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', icon: 'text-teal-500' },
    sky: { bg: 'bg-sky-500/10', text: 'text-sky-400', icon: 'text-sky-500' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', icon: 'text-violet-500' },
};

function StatsCard({ label, value, sub, color, icon }: {
    label: string; value: string; sub: string; color: string; icon: React.ReactNode;
}) {
    const c = COLOR_MAP[color] ?? COLOR_MAP.emerald;
    return (
        <div className={`${c.bg} border border-slate-800 rounded-2xl p-4`}>
            <div className={`${c.icon} mb-2`}>{icon}</div>
            <p className={`text-xl font-black ${c.text}`}>{value}</p>
            <p className="text-slate-500 text-xs">{sub}</p>
            <p className="text-slate-400 text-[11px] mt-1 leading-tight">{label}</p>
        </div>
    );
}

function WeeklyChart({ data }: { data: number[] }) {
    const max = Math.max(...data, 1);
    const days = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const today = new Date().getDay(); // 0=Sunday
    const todayIdx = (today + 6) % 7; // Monday=0

    return (
        <div className="flex items-end justify-between gap-1 h-16">
            {data.map((val, i) => {
                const height = Math.round((val / max) * 100);
                const isToday = i === todayIdx;
                return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                        <div className="w-full flex items-end justify-center" style={{ height: '48px' }}>
                            <div
                                className={`w-full rounded-t-md transition-all duration-500 ${isToday ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                style={{ height: `${Math.max(height, 4)}%` }}
                            />
                        </div>
                        <span className={`text-[9px] font-bold ${isToday ? 'text-emerald-400' : 'text-slate-600'}`}>
                            {days[i]}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    assigned: { label: 'Tayinlangan', color: 'bg-blue-500/20 text-blue-400' },
    en_route: { label: 'Yo\'ldaman', color: 'bg-amber-500/20 text-amber-400' },
    arrived: { label: 'Yetib keldim', color: 'bg-emerald-500/20 text-emerald-400' },
    collecting: { label: 'Yig\'ish jarayonida', color: 'bg-teal-500/20 text-teal-400' },
};

function TaskCard({ task }: { task: ReturnType<typeof useDriverStore.getState>['tasks'][0] }) {
    const st = STATUS_LABELS[task.status] ?? { label: task.status, color: 'bg-slate-700 text-slate-300' };
    return (
        <Link href={`/driver/tasks/${task.id}`} className="block">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-emerald-500/30 transition-all active:scale-[0.98]">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{task.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{task.phone}</p>
                        {task.address && (
                            <p className="text-xs text-slate-500 mt-1 truncate">📍 {task.address}</p>
                        )}
                        {task.material && (
                            <p className="text-xs text-slate-500 mt-0.5">♻️ {task.material} {task.volume ? `· ${task.volume} kg` : ''}</p>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap shrink-0 ${st.color}`}>
                        {st.label}
                    </span>
                </div>
                {task.point && (
                    <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                        🏭 {task.point.regionUz}
                        {task.point.pricePerKg && ` · ${task.point.pricePerKg.toLocaleString()} so'm/kg`}
                    </div>
                )}
            </div>
        </Link>
    );
}

// ─── Stat Icons ───────────────────────────────────────────────────────────────

function WeightIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 20h12M6 20a2 2 0 0 1-2-2V9l3-3h10l3 3v9a2 2 0 0 1-2 2M8 3h8" /></svg>;
}
function MoneyIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>;
}
function TotalIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
}
function CollectIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}
