'use client';

import { useEffect, useState } from 'react';
import DriverShell from '@/components/driver/DriverShell';
import { useDriverStore, type DriverTask } from '@/lib/store/useDriverStore';

type TabType = 'active' | 'completed';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    assigned:   { label: 'Tayinlangan',         color: 'bg-blue-500/20 text-blue-400'    },
    en_route:   { label: "Yo'ldaman",           color: 'bg-amber-500/20 text-amber-400'  },
    arrived:    { label: 'Yetib keldim',         color: 'bg-emerald-500/20 text-emerald-400' },
    collecting: { label: "Yig'ish jarayonida",  color: 'bg-teal-500/20 text-teal-400'    },
    done:       { label: 'Bajarildi',            color: 'bg-slate-700 text-slate-400'     },
    completed:  { label: 'Yakunlandi',           color: 'bg-slate-700 text-slate-400'     },
    collected:  { label: "Yig'ildi",             color: 'bg-slate-700 text-slate-400'     },
    paid:       { label: "To'landi",             color: 'bg-slate-700 text-slate-400'     },
};

const NEXT_STATUS: Record<string, string> = {
    assigned:   'en_route',
    en_route:   'arrived',
    arrived:    'collecting',
    collecting: 'done',
};

const NEXT_LABEL: Record<string, string> = {
    assigned:   "Yo'lga chiqish",
    en_route:   'Yetib keldim',
    arrived:    "Yig'ish boshlash",
    collecting: 'Bajarildi',
};

export default function DriverTasksPage() {
    const [tab, setTab] = useState<TabType>('active');
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    const tasks         = useDriverStore((s) => s.tasks);
    const isLoading     = useDriverStore((s) => s.isLoadingTasks);
    const tasksError    = useDriverStore((s) => s.tasksError);
    const fetchTasks    = useDriverStore((s) => s.fetchTasks);
    const updateStatus  = useDriverStore((s) => s.updateTaskStatus);

    useEffect(() => {
        fetchTasks(tab);
    }, [tab, fetchTasks]);

    const handleStatusUpdate = async (task: DriverTask) => {
        const next = NEXT_STATUS[task.status];
        if (!next) return;
        setUpdatingId(task.id);
        await updateStatus(task.id, next);
        setUpdatingId(null);
    };

    return (
        <DriverShell>
            <div className="px-4 py-5">

                {/* Header */}
                <h1 className="text-xl font-black text-white mb-4">Vazifalar</h1>

                {/* Tabs */}
                <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 mb-5">
                    {(['active', 'completed'] as const).map((t) => (
                        <button
                            key={t}
                            id={`tasks-tab-${t}`}
                            onClick={() => setTab(t)}
                            className={`
                                flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200
                                ${tab === t
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                                    : 'text-slate-500 hover:text-slate-300'
                                }
                            `}
                        >
                            {t === 'active' ? 'Faol' : 'Tarix'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-32 bg-slate-800 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : tasksError ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
                        <p className="text-red-400 text-sm">{tasksError}</p>
                        <button
                            onClick={() => fetchTasks(tab)}
                            className="mt-3 text-xs text-emerald-400 font-semibold"
                        >
                            Qaytadan urinish
                        </button>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
                        <EmptyIcon />
                        <p className="text-slate-400 text-sm mt-3">
                            {tab === 'active' ? 'Faol vazifa yo\'q' : 'Tarix bo\'sh'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tasks.map((task) => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                tab={tab}
                                isUpdating={updatingId === task.id}
                                onStatusUpdate={() => handleStatusUpdate(task)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </DriverShell>
    );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, tab, isUpdating, onStatusUpdate }: {
    task: DriverTask;
    tab: TabType;
    isUpdating: boolean;
    onStatusUpdate: () => void;
}) {
    const st = STATUS_MAP[task.status] ?? { label: task.status, color: 'bg-slate-700 text-slate-400' };
    const nextLabel = NEXT_LABEL[task.status];

    return (
        <div
            id={`task-card-${task.id}`}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3"
        >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-600">#{task.id}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>
                            {st.label}
                        </span>
                    </div>
                    <p className="text-sm font-bold text-white mt-1 truncate">{task.name}</p>
                    <p className="text-xs text-slate-400">{task.phone}</p>
                </div>
            </div>

            {/* Details */}
            <div className="space-y-1">
                {task.address && (
                    <p className="text-xs text-slate-400 flex items-start gap-1.5">
                        <span className="shrink-0">📍</span>
                        <span className="truncate">{task.address}</span>
                    </p>
                )}
                {task.material && (
                    <p className="text-xs text-slate-400">
                        ♻️ {task.material}{task.volume ? ` · ${task.volume} kg` : ''}
                    </p>
                )}
                {task.point && (
                    <p className="text-xs text-slate-500">
                        🏭 {task.point.regionUz}
                        {task.point.pricePerKg && ` · ${task.point.pricePerKg.toLocaleString()} so'm/kg`}
                    </p>
                )}
            </div>

            {/* Status advance button — only for active tasks */}
            {tab === 'active' && nextLabel && (
                <button
                    id={`task-${task.id}-advance`}
                    onClick={onStatusUpdate}
                    disabled={isUpdating}
                    className="
                        w-full py-2.5 rounded-xl text-xs font-bold
                        bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
                        hover:bg-emerald-500/20 active:scale-[0.98]
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all duration-200 flex items-center justify-center gap-2
                    "
                >
                    {isUpdating ? (
                        <span className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    ) : null}
                    {nextLabel}
                </button>
            )}

            {/* Completed task total */}
            {tab === 'completed' && task.collections.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Yig'ildi:</span>
                        <span className="text-emerald-400 font-bold">
                            {task.collections.reduce((s, c) => s + c.actualWeight, 0)} kg
                            · {task.collections.reduce((s, c) => s + c.totalAmount, 0).toLocaleString()} so'm
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

function EmptyIcon() {
    return (
        <svg className="w-10 h-10 text-slate-700 mx-auto" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect width="6" height="4" x="9" y="3" rx="1" />
            <path d="M9 12h6M9 16h4" />
        </svg>
    );
}
