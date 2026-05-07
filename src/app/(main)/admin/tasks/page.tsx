'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    CheckCircle2, Clock, Eye, Package, Truck, Factory, Wrench, Search,
    Plus, BarChart3, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
    DndContext, closestCorners, DragEndEvent, DragOverlay, DragStartEvent,
    PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './_components/TaskCard';
import { CreateTaskDialog } from './_components/CreateTaskDialog';
import { TaskDetailDrawer } from './_components/TaskDetailDrawer';
import type { TaskCardData } from './_components/TaskCard';
import {
    TASK_DEPARTMENTS, DEPARTMENT_LABELS, TASK_PRIORITIES, PRIORITY_LABELS,
} from '@/lib/domain/taskConstants';
import type { TaskDepartment, TaskPriority, TaskStatus } from '@/lib/domain/taskConstants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Stats {
    pending: number;
    inProgress: number;
    review: number;
    completed: number;
    overdue: number;
    total: number;
}

interface StaffUser { id: number; name: string }

const COLUMNS: { id: TaskStatus; label: string; icon: React.ReactNode; color: string; countColor: string }[] = [
    {
        id: 'pending',
        label: 'Kutilmoqda',
        icon: <Clock size={16} className="text-slate-400" />,
        color: 'border-t-slate-300',
        countColor: 'bg-slate-100 text-slate-600',
    },
    {
        id: 'in_progress',
        label: 'Jarayonda',
        icon: <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />,
        color: 'border-t-blue-500',
        countColor: 'bg-blue-50 text-blue-600',
    },
    {
        id: 'review',
        label: 'Tekshiruvda',
        icon: <Eye size={16} className="text-amber-500" />,
        color: 'border-t-amber-400',
        countColor: 'bg-amber-50 text-amber-600',
    },
    {
        id: 'completed',
        label: 'Bajarildi',
        icon: <CheckCircle2 size={16} className="text-emerald-500" />,
        color: 'border-t-emerald-500',
        countColor: 'bg-emerald-50 text-emerald-600',
    },
];

const DEPT_ICONS: Record<string, React.ReactNode> = {
    warehouse: <Package size={14} />,
    logistics: <Truck size={14} />,
    production: <Factory size={14} />,
    household: <Wrench size={14} />,
};

// ─── Droppable Column ────────────────────────────────────────────────────────

function KanbanColumn({
    column,
    tasks,
    onTaskClick,
}: {
    column: (typeof COLUMNS)[number];
    tasks: TaskCardData[];
    onTaskClick: (task: TaskCardData) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: column.id });

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col min-h-[400px] border-t-4 rounded-t-xl ${column.color} transition-colors ${
                isOver ? 'bg-indigo-50/50' : ''
            }`}
        >
            {/* Column Header */}
            <div className="flex items-center justify-between px-3 py-3">
                <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                    {column.icon}
                    {column.label}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${column.countColor}`}>
                        {tasks.length}
                    </span>
                </h3>
            </div>

            {/* Cards */}
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3 px-2 pb-4 flex-1">
                    {tasks.map(task => (
                        <TaskCard key={task.id} task={task} onClick={onTaskClick} />
                    ))}
                    {tasks.length === 0 && (
                        <div className="text-center py-10 text-slate-300 text-xs">
                            Bo&apos;sh
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TasksPage() {
    const [tasks, setTasks] = useState<TaskCardData[]>([]);
    const [stats, setStats] = useState<Stats>({ pending: 0, inProgress: 0, review: 0, completed: 0, overdue: 0, total: 0 });
    const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);

    const [departmentFilter, setDepartmentFilter] = useState<TaskDepartment | 'all'>('all');
    const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [selectedTaskDetail, setSelectedTaskDetail] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<number | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    // ─── Data Fetching ───────────────────────────────────────────────────────

    const fetchTasks = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            // Get non-cancelled tasks
            params.set('status', 'pending,in_progress,review,completed');
            if (departmentFilter !== 'all') params.set('department', departmentFilter);
            if (priorityFilter !== 'all') params.set('priority', priorityFilter);
            if (searchQuery) params.set('search', searchQuery);
            params.set('limit', '200');
            params.set('withStaff', 'true');

            const res = await fetch(`/api/admin/tasks?${params}`);
            const data = await res.json();
            setTasks(data.tasks || []);
            if (data.staff) setStaffUsers(data.staff);
        } catch (err) {
            console.error('[Tasks] fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [departmentFilter, priorityFilter, searchQuery]);

    const fetchStats = useCallback(async () => {
        try {
            const params = departmentFilter !== 'all' ? `?department=${departmentFilter}` : '';
            const res = await fetch(`/api/admin/tasks/stats${params}`);
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error('[Tasks] stats error:', err);
        }
    }, [departmentFilter]);

    const fetchTaskDetail = useCallback(async (id: number) => {
        try {
            const res = await fetch(`/api/admin/tasks/${id}`);
            const data = await res.json();
            setSelectedTaskDetail(data);
        } catch (err) {
            console.error('[Tasks] detail error:', err);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
        fetchStats();
    }, [fetchTasks, fetchStats]);

    useEffect(() => {
        if (selectedTaskId) fetchTaskDetail(selectedTaskId);
    }, [selectedTaskId, fetchTaskDetail]);

    const refreshAll = () => {
        fetchTasks();
        fetchStats();
        if (selectedTaskId) fetchTaskDetail(selectedTaskId);
    };

    // ─── DnD Handlers ────────────────────────────────────────────────────────

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as number);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;

        const taskId = active.id as number;
        const newStatus = over.id as TaskStatus;

        // Find the task
        const task = tasks.find(t => t.id === taskId);
        if (!task || task.status === newStatus) return;

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

        try {
            const res = await fetch(`/api/admin/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) {
                // Revert on error
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
            }
            fetchStats();
        } catch {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
        }
    };

    const handleTaskClick = (task: TaskCardData) => {
        setSelectedTaskId(task.id);
    };

    // ─── Task groups ─────────────────────────────────────────────────────────

    const tasksByStatus = (status: string) => tasks.filter(t => t.status === status);
    const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

    return (
        <div className="p-6 max-w-[1800px] mx-auto min-h-screen bg-slate-50/50">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vazifalar Markazi</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Ombor, Logistika, Ishlab chiqarish va Xo&apos;jalik ishlari nazorati</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="bg-white"
                        onClick={refreshAll}
                    >
                        <RefreshCw className="w-4 h-4 mr-2" /> Yangilash
                    </Button>
                    <Button
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                        onClick={() => setShowCreateDialog(true)}
                    >
                        <Plus className="w-4 h-4 mr-2" /> Yangi Vazifa
                    </Button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {[
                    { label: 'Jami', value: stats.total, icon: <BarChart3 size={16} />, bg: 'bg-white', text: 'text-slate-800' },
                    { label: 'Kutilmoqda', value: stats.pending, icon: <Clock size={16} />, bg: 'bg-slate-50', text: 'text-slate-600' },
                    { label: 'Jarayonda', value: stats.inProgress, icon: <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />, bg: 'bg-blue-50', text: 'text-blue-600' },
                    { label: 'Tekshiruvda', value: stats.review, icon: <Eye size={16} />, bg: 'bg-amber-50', text: 'text-amber-600' },
                    { label: 'Bajarildi', value: stats.completed, icon: <CheckCircle2 size={16} />, bg: 'bg-emerald-50', text: 'text-emerald-600' },
                    { label: 'Muddati o\'tgan', value: stats.overdue, icon: <AlertTriangle size={16} />, bg: stats.overdue > 0 ? 'bg-red-50' : 'bg-white', text: stats.overdue > 0 ? 'text-red-600' : 'text-slate-400' },
                ].map((stat) => (
                    <div key={stat.label} className={`${stat.bg} p-3 rounded-xl border border-gray-100 flex items-center gap-3`}>
                        <div className={`${stat.text}`}>{stat.icon}</div>
                        <div>
                            <span className={`text-xl font-bold ${stat.text}`}>{stat.value}</span>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                {/* Department tabs */}
                <div className="flex gap-1 overflow-x-auto">
                    <button
                        onClick={() => setDepartmentFilter('all')}
                        className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            departmentFilter === 'all'
                                ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200'
                                : 'text-slate-500 hover:bg-white/60'
                        }`}
                    >
                        Barchasi
                    </button>
                    {TASK_DEPARTMENTS.map(dept => (
                        <button
                            key={dept}
                            onClick={() => setDepartmentFilter(dept)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                                departmentFilter === dept
                                    ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:bg-white/60'
                            }`}
                        >
                            {DEPT_ICONS[dept]}
                            {DEPARTMENT_LABELS[dept]}
                        </button>
                    ))}
                </div>

                {/* Priority filter */}
                <select
                    value={priorityFilter}
                    onChange={e => setPriorityFilter(e.target.value as TaskPriority | 'all')}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                    <option value="all">Barcha muhimlik</option>
                    {TASK_PRIORITIES.map(p => (
                        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                </select>

                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="ID, sarlavha bo'yicha qidirish..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
            </div>

            {/* Kanban Board */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {COLUMNS.map(col => (
                            <KanbanColumn
                                key={col.id}
                                column={col}
                                tasks={tasksByStatus(col.id)}
                                onTaskClick={handleTaskClick}
                            />
                        ))}
                    </div>

                    <DragOverlay>
                        {activeTask ? (
                            <div className="opacity-80 rotate-2">
                                <TaskCard task={activeTask} onClick={() => {}} />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Create Dialog */}
            <CreateTaskDialog
                open={showCreateDialog}
                onClose={() => setShowCreateDialog(false)}
                onCreated={refreshAll}
                staffUsers={staffUsers}
            />

            {/* Detail Drawer */}
            <TaskDetailDrawer
                task={selectedTaskDetail}
                onClose={() => { setSelectedTaskId(null); setSelectedTaskDetail(null); }}
                onUpdated={refreshAll}
                staffUsers={staffUsers}
            />
        </div>
    );
}
