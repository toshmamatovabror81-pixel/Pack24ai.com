'use client';

import { useState } from 'react';
import { X, Plus, Calendar, Users, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TASK_DEPARTMENTS, TASK_PRIORITIES, DEPARTMENT_LABELS, PRIORITY_LABELS } from '@/lib/domain/taskConstants';
import type { TaskDepartment, TaskPriority } from '@/lib/domain/taskConstants';

interface StaffUser {
    id: number;
    name: string;
}

interface CreateTaskDialogProps {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
    staffUsers: StaffUser[];
}

export function CreateTaskDialog({ open, onClose, onCreated, staffUsers }: CreateTaskDialogProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [department, setDepartment] = useState<TaskDepartment>('general');
    const [priority, setPriority] = useState<TaskPriority>('normal');
    const [dueAt, setDueAt] = useState('');
    const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
    const [subtasks, setSubtasks] = useState<string[]>([]);
    const [newSubtask, setNewSubtask] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const toggleAssignee = (id: number) => {
        setSelectedAssignees(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const addSubtask = () => {
        if (newSubtask.trim()) {
            setSubtasks(prev => [...prev, newSubtask.trim()]);
            setNewSubtask('');
        }
    };

    const removeSubtask = (index: number) => {
        setSubtasks(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    department,
                    priority,
                    dueAt: dueAt || undefined,
                    assigneeIds: selectedAssignees.length > 0 ? selectedAssignees : undefined,
                    subtasks: subtasks.length > 0 ? subtasks : undefined,
                }),
            });
            if (res.ok) {
                onCreated();
                resetForm();
                onClose();
            }
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setDepartment('general');
        setPriority('normal');
        setDueAt('');
        setSelectedAssignees([]);
        setSubtasks([]);
        setNewSubtask('');
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-slate-900">Yangi Vazifa</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Title */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Sarlavha *</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Vazifa nomini kiriting..."
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Tavsif</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Batafsil ma'lumot..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all resize-none"
                        />
                    </div>

                    {/* Department + Priority row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Bo&apos;lim</label>
                            <select
                                value={department}
                                onChange={e => setDepartment(e.target.value as TaskDepartment)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white"
                            >
                                {TASK_DEPARTMENTS.map(d => (
                                    <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Muhimlik</label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value as TaskPriority)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white"
                            >
                                {TASK_PRIORITIES.map(p => (
                                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Deadline */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                            <Calendar size={12} /> Muddat
                        </label>
                        <input
                            type="datetime-local"
                            value={dueAt}
                            onChange={e => setDueAt(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                        />
                    </div>

                    {/* Assignees */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                            <Users size={12} /> Mas&apos;ullar
                        </label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                            {staffUsers.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => toggleAssignee(u.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                        selectedAssignees.includes(u.id)
                                            ? 'bg-indigo-500 text-white shadow-sm'
                                            : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {u.name}
                                </button>
                            ))}
                            {staffUsers.length === 0 && (
                                <p className="text-xs text-slate-400">Xodimlar topilmadi</p>
                            )}
                        </div>
                    </div>

                    {/* Subtasks */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                            <ListChecks size={12} /> Kichik vazifalar
                        </label>
                        <div className="space-y-1.5 mb-2">
                            {subtasks.map((st, i) => (
                                <div key={i} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                                    <span className="text-xs text-slate-600 flex-1">{st}</span>
                                    <button onClick={() => removeSubtask(i)} className="text-slate-400 hover:text-red-500">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={newSubtask}
                                onChange={e => setNewSubtask(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                                placeholder="Kichik vazifa qo'shish..."
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                            />
                            <button
                                onClick={addSubtask}
                                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                <Plus size={14} className="text-slate-600" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
                    <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!title.trim() || submitting}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 disabled:opacity-50"
                    >
                        {submitting ? 'Saqlanmoqda...' : '+ Vazifa Yaratish'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
