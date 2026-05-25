'use client';

import { Package, Truck, Factory, Wrench, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';import type { TaskPriority, TaskDepartment } from '@/lib/domain/taskConstants';

export interface TaskCardData {
    id: number;
    publicCode: string | null;
    title: string;
    description: string;
    department: string;
    status: string;
    priority: string;
    dueAt: string | null;
    progress: number;
    assignees: { user: { id: number; name: string } }[];
    subtasks: { id: number; done: boolean }[];
    _count: { comments: number; attachments: number };
}

const DEPT_CONFIG: Record<TaskDepartment, { icon: typeof Package; color: string; bg: string }> = {
    warehouse: { icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    logistics: { icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50' },
    production: { icon: Factory, color: 'text-amber-600', bg: 'bg-amber-50' },
    household: { icon: Wrench, color: 'text-teal-600', bg: 'bg-teal-50' },
    general: { icon: CheckCircle2, color: 'text-slate-600', bg: 'bg-slate-50' },
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-400',
    normal: 'bg-slate-300',
    low: 'bg-blue-300',
};

function isOverdue(dueAt: string | null, status: string): boolean {
    if (!dueAt || status === 'completed' || status === 'cancelled') return false;
    return new Date(dueAt) < new Date();
}

function formatDeadline(dueAt: string | null): string {
    if (!dueAt) return '';
    const d = new Date(dueAt);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Bugun';
    if (days === 1) return 'Ertaga';
    if (days < 0) return `${Math.abs(days)} kun o'tdi`;
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
}

export function TaskCard({ task, onClick }: { task: TaskCardData; onClick: (task: TaskCardData) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id, data: { task } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const dept = DEPT_CONFIG[task.department as TaskDepartment] || DEPT_CONFIG.general;
    const DeptIcon = dept.icon;
    const overdue = isOverdue(task.dueAt, task.status);
    const doneSubtasks = task.subtasks.filter(s => s.done).length;
    const totalSubtasks = task.subtasks.length;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onClick(task)}
            className={`bg-white p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative overflow-hidden select-none ${
                isDragging ? 'opacity-50 shadow-xl ring-2 ring-indigo-300 z-50' : 'border-gray-100'
            } ${overdue ? 'border-red-200' : ''}`}
        >
            {/* Priority indicator line */}
            <div className={`absolute top-0 left-0 w-1 h-full rounded-l-2xl ${PRIORITY_COLORS[task.priority as TaskPriority] || ''}`} />

            {/* Header */}
            <div className="flex justify-between items-start mb-2.5 pl-2">
                <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg ${dept.bg}`}>
                        <DeptIcon size={13} className={dept.color} />
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {task.publicCode || `#${task.id}`}
                    </span>
                </div>

                {task.priority === 'urgent' && (
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                )}
                {task.priority === 'high' && (
                    <AlertTriangle size={13} className="text-orange-400" />
                )}
            </div>

            {/* Title */}
            <h4 className="font-bold text-slate-800 text-sm mb-1.5 leading-snug pl-2 line-clamp-2">
                {task.title}
            </h4>

            {task.description && (
                <p className="text-[11px] text-slate-400 mb-3 line-clamp-1 pl-2">{task.description}</p>
            )}

            {/* Progress bar (if subtasks exist) */}
            {totalSubtasks > 0 && (
                <div className="mb-3 pl-2 pr-1">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>{doneSubtasks}/{totalSubtasks} subtask</span>
                        <span className="font-bold">{Math.round((doneSubtasks / totalSubtasks) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                        <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${(doneSubtasks / totalSubtasks) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2.5 border-t border-gray-50 pl-2">
                <div className="flex items-center -space-x-1.5">
                    {task.assignees.slice(0, 3).map((a) => (
                        <div
                            key={a.user.id}
                            title={a.user.name}
                            className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 border-2 border-white"
                        >
                            {a.user.name.charAt(0)}
                        </div>
                    ))}
                    {task.assignees.length > 3 && (
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 border-2 border-white">
                            +{task.assignees.length - 3}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {(task._count.comments > 0 || task._count.attachments > 0) && (
                        <span className="text-[10px] text-slate-400">
                            {task._count.comments > 0 && `💬${task._count.comments}`}
                            {task._count.attachments > 0 && ` 📎${task._count.attachments}`}
                        </span>
                    )}
                    {task.dueAt && (
                        <div className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                            overdue ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                            <Clock size={10} className="inline mr-0.5 -mt-px" />
                            {formatDeadline(task.dueAt)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
