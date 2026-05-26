'use client';

import { useState, useRef } from 'react';
import {
    X, CheckCircle2, Circle, Clock, Plus, Send, Paperclip,
    Trash2, Download, Image as ImageIcon, FileText, Users, AlertTriangle,
    Bell, Phone, MessageCircle, PhoneCall,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { STATUS_LABELS, DEPARTMENT_LABELS, PRIORITY_LABELS } from '@/lib/domain/taskConstants';
import type { TaskStatus, TaskDepartment, TaskPriority } from '@/lib/domain/taskConstants';

export interface TaskDetail {
    id: number;
    publicCode: string | null;
    title: string;
    description: string;
    department: string;
    status: string;
    priority: string;
    dueAt: string | null;
    progress: number;
    completedAt: string | null;
    createdAt: string;
    createdBy: { id: number; name: string } | null;
    assignees: { user: { id: number; name: string; phone: string } }[];
    subtasks: { id: number; title: string; done: boolean }[];
    comments: { id: number; body: string; createdAt: string; author: { id: number; name: string } }[];
    attachments: { id: number; fileName: string; fileUrl: string; mimeType: string | null; fileSize: number | null; createdAt: string }[];
    order: { id: number; status: string; customerName: string } | null;
}

interface StaffUser { id: number; name: string }

interface Props {
    task: TaskDetail | null;
    onClose: () => void;
    onUpdated: () => void;
    staffUsers: StaffUser[];
}

const NEXT_STATUSES: Record<TaskStatus, { label: string; status: TaskStatus; color: string }[]> = {
    pending: [
        { label: 'Boshlash', status: 'in_progress', color: 'bg-blue-500 hover:bg-blue-600' },
        { label: 'Bekor qilish', status: 'cancelled', color: 'bg-red-500 hover:bg-red-600' },
    ],
    in_progress: [
        { label: 'Tekshiruvga', status: 'review', color: 'bg-amber-500 hover:bg-amber-600' },
        { label: 'Yakunlash', status: 'completed', color: 'bg-emerald-500 hover:bg-emerald-600' },
        { label: 'Bekor qilish', status: 'cancelled', color: 'bg-red-500 hover:bg-red-600' },
    ],
    review: [
        { label: 'Tasdiqlash', status: 'completed', color: 'bg-emerald-500 hover:bg-emerald-600' },
        { label: 'Qaytarish', status: 'in_progress', color: 'bg-blue-500 hover:bg-blue-600' },
    ],
    completed: [],
    cancelled: [],
};

export function TaskDetailDrawer({ task, onClose, onUpdated, staffUsers }: Props) {
    const [newComment, setNewComment] = useState('');
    const [newSubtask, setNewSubtask] = useState('');
    const [loading, setLoading] = useState(false);
    const [showAssigneeList, setShowAssigneeList] = useState(false);
    const [notifications, setNotifications] = useState<{id:number;channel:string;status:string;sentAt:string;acceptedAt:string|null;escalatedToSms:boolean;escalatedToCall:boolean;escalationNote:string|null;user:{id:number;name:string;phone:string}}[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!task) return null;

    // Load notifications when task changes
    const loadNotifications = async () => {
        try {
            const res = await fetch(`/api/admin/tasks/${task.id}/notifications`);
            if (res.ok) setNotifications(await res.json());
        } catch { /* ignore */ }
    };
    if (task && notifications.length === 0 && task.assignees.length > 0) {
        loadNotifications();
    }

    const updateStatus = async (newStatus: TaskStatus) => {
        setLoading(true);
        try {
            await fetch(`/api/admin/tasks/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            onUpdated();
        } finally { setLoading(false); }
    };

    const toggleSubtask = async (subtaskId: number) => {
        await fetch(`/api/admin/tasks/${task.id}/subtasks`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subtaskId }),
        });
        onUpdated();
    };

    const addSubtask = async () => {
        if (!newSubtask.trim()) return;
        await fetch(`/api/admin/tasks/${task.id}/subtasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newSubtask.trim() }),
        });
        setNewSubtask('');
        onUpdated();
    };

    const deleteSubtask = async (subtaskId: number) => {
        await fetch(`/api/admin/tasks/${task.id}/subtasks?subtaskId=${subtaskId}`, { method: 'DELETE' });
        onUpdated();
    };

    const addComment = async () => {
        if (!newComment.trim()) return;
        await fetch(`/api/admin/tasks/${task.id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: newComment.trim() }),
        });
        setNewComment('');
        onUpdated();
    };

    const addAssignee = async (userId: number) => {
        await fetch(`/api/admin/tasks/${task.id}/assignees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });
        setShowAssigneeList(false);
        onUpdated();
    };

    const removeAssignee = async (userId: number) => {
        await fetch(`/api/admin/tasks/${task.id}/assignees?userId=${userId}`, { method: 'DELETE' });
        onUpdated();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        await fetch(`/api/admin/tasks/${task.id}/attachments`, {
            method: 'POST',
            body: formData,
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        onUpdated();
    };

    const deleteAttachment = async (attachmentId: number) => {
        await fetch(`/api/admin/tasks/${task.id}/attachments?attachmentId=${attachmentId}`, { method: 'DELETE' });
        onUpdated();
    };

    const deleteTask = async () => {
        if (!confirm('Vazifani o\'chirmoqchimisiz?')) return;
        await fetch(`/api/admin/tasks/${task.id}`, { method: 'DELETE' });
        onClose();
        onUpdated();
    };

    const statusActions = NEXT_STATUSES[task.status as TaskStatus] || [];
    const assignedIds = new Set(task.assignees.map(a => a.user.id));
    const availableStaff = staffUsers.filter(u => !assignedIds.has(u.id));
    const isImageType = (mime: string | null) => mime?.startsWith('image/');

    const formatDate = (d: string) => new Date(d).toLocaleDateString('uz-UZ', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
            <div
                className="bg-white w-full max-w-lg h-full overflow-y-auto animate-in slide-in-from-right duration-300 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
                    <div>
                        <span className="text-xs font-bold text-slate-400">{task.publicCode || `#${task.id}`}</span>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">{task.title}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-5 space-y-6">
                    {/* Status + Meta */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Status</span>
                            <span className="text-sm font-bold text-slate-800">
                                {STATUS_LABELS[task.status as TaskStatus] || task.status}
                            </span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Bo&apos;lim</span>
                            <span className="text-sm font-bold text-slate-800">
                                {DEPARTMENT_LABELS[task.department as TaskDepartment] || task.department}
                            </span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Muhimlik</span>
                            <span className={`text-sm font-bold ${task.priority === 'urgent' ? 'text-red-600' : task.priority === 'high' ? 'text-orange-600' : 'text-slate-800'}`}>
                                {task.priority === 'urgent' && <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />}
                                {PRIORITY_LABELS[task.priority as TaskPriority] || task.priority}
                            </span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block flex items-center gap-1">
                                <Clock size={10} /> Muddat
                            </span>
                            <span className={`text-sm font-bold ${task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'completed' ? 'text-red-600' : 'text-slate-800'}`}>
                                {task.dueAt ? formatDate(task.dueAt) : '—'}
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    {task.description && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Tavsif</h3>
                            <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-xl">{task.description}</p>
                        </div>
                    )}

                    {/* Status Actions */}
                    {statusActions.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            {statusActions.map(action => (
                                <Button
                                    key={action.status}
                                    onClick={() => updateStatus(action.status)}
                                    disabled={loading}
                                    className={`text-white text-xs px-4 py-2 ${action.color}`}
                                >
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    )}

                    {/* Assignees */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Users size={12} /> Mas&apos;ullar ({task.assignees.length})
                            </h3>
                            <button
                                onClick={() => setShowAssigneeList(!showAssigneeList)}
                                className="text-indigo-500 text-xs font-bold hover:text-indigo-700"
                            >
                                + Qo&apos;shish
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {task.assignees.map(a => (
                                <div key={a.user.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg group">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                                            {a.user.name.charAt(0)}
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-slate-700 block leading-tight">{a.user.name}</span>
                                            <span className="text-[10px] text-slate-400">{a.user.phone}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeAssignee(a.user.id)}
                                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {showAssigneeList && availableStaff.length > 0 && (
                            <div className="mt-2 border border-gray-200 rounded-xl p-2 max-h-32 overflow-y-auto space-y-1">
                                {availableStaff.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => addAssignee(u.id)}
                                        className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-indigo-50 transition-colors"
                                    >
                                        {u.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Subtasks */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">
                            Kichik Vazifalar ({task.subtasks.filter(s => s.done).length}/{task.subtasks.length})
                        </h3>
                        <div className="space-y-1">
                            {task.subtasks.map(sub => (
                                <div key={sub.id} className="flex items-center gap-2 group py-1">
                                    <button onClick={() => toggleSubtask(sub.id)} className="shrink-0">
                                        {sub.done
                                            ? <CheckCircle2 size={18} className="text-emerald-500" />
                                            : <Circle size={18} className="text-slate-300 hover:text-indigo-400 transition-colors" />
                                        }
                                    </button>
                                    <span className={`text-sm flex-1 ${sub.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                        {sub.title}
                                    </span>
                                    <button
                                        onClick={() => deleteSubtask(sub.id)}
                                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                            <input
                                value={newSubtask}
                                onChange={e => setNewSubtask(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                                placeholder="Yangi kichik vazifa..."
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <button onClick={addSubtask} className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors">
                                <Plus size={14} className="text-indigo-600" />
                            </button>
                        </div>
                    </div>

                    {/* Attachments */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Paperclip size={12} /> Fayllar ({task.attachments.length})
                            </h3>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-indigo-500 text-xs font-bold hover:text-indigo-700"
                            >
                                + Yuklash
                            </button>
                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                        </div>
                        <div className="space-y-2">
                            {task.attachments.map(att => (
                                <div key={att.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl group">
                                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                                        {isImageType(att.mimeType) ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={att.fileUrl} alt={att.fileName} className="w-full h-full object-cover rounded-lg" />
                                        ) : att.mimeType?.includes('pdf') ? (
                                            <FileText size={18} className="text-red-500" />
                                        ) : (
                                            <ImageIcon size={18} className="text-slate-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 truncate">{att.fileName}</p>
                                        <p className="text-[10px] text-slate-400">{formatFileSize(att.fileSize)}</p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <a href={att.fileUrl} download className="p-1.5 rounded-md hover:bg-white transition-colors">
                                            <Download size={13} className="text-slate-500" />
                                        </a>
                                        <button onClick={() => deleteAttachment(att.id)} className="p-1.5 rounded-md hover:bg-white transition-colors">
                                            <Trash2 size={13} className="text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Comments */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Izohlar ({task.comments.length})</h3>
                        <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                            {task.comments.map(c => (
                                <div key={c.id} className="bg-slate-50 p-3 rounded-xl">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600">
                                            {c.author.name.charAt(0)}
                                        </div>
                                        <span className="text-xs font-bold text-slate-700">{c.author.name}</span>
                                        <span className="text-[10px] text-slate-400">{formatDate(c.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 pl-7">{c.body}</p>
                                </div>
                            ))}
                            {task.comments.length === 0 && (
                                <p className="text-xs text-slate-400 text-center py-4">Izohlar yo&apos;q</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addComment())}
                                placeholder="Izoh yozish..."
                                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <button onClick={addComment} className="p-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-colors">
                                <Send size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Notification History */}
                    {notifications.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                                <Bell size={12} /> Bildirishnoma Tarixi ({notifications.length})
                            </h3>
                            <div className="space-y-2">
                                {notifications.map(n => (
                                    <div key={n.id} className="bg-slate-50 px-3 py-2.5 rounded-xl">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                {n.channel === 'telegram' && <MessageCircle size={13} className="text-blue-500" />}
                                                {n.channel === 'sms' && <Phone size={13} className="text-emerald-500" />}
                                                {n.channel === 'call' && <PhoneCall size={13} className="text-orange-500" />}
                                                <span className="text-xs font-bold text-slate-700">{n.user.name}</span>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                n.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                                                n.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                                n.status === 'escalated' ? 'bg-amber-100 text-amber-700' :
                                                n.status === 'failed' ? 'bg-red-100 text-red-600' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {n.status === 'accepted' ? '✅ Qabul' :
                                                 n.status === 'sent' ? '📤 Yuborildi' :
                                                 n.status === 'escalated' ? '⚠️ Eskalatsiya' :
                                                 n.status === 'failed' ? '❌ Xato' : n.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                            <span>{new Date(n.sentAt).toLocaleString('uz-UZ', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</span>
                                            {n.escalatedToSms && <span className="text-amber-500">→ SMS</span>}
                                            {n.escalatedToCall && <span className="text-orange-500">→ Qo&apos;ng&apos;iroq</span>}
                                            {n.escalationNote && <span className="italic">{n.escalationNote}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Meta info + Delete */}
                    <div className="pt-4 border-t border-gray-100 space-y-2">
                        <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Yaratilgan: {formatDate(task.createdAt)}</span>
                            {task.createdBy && <span>Muallif: {task.createdBy.name}</span>}
                        </div>
                        {task.completedAt && (
                            <div className="text-[10px] text-emerald-500">
                                ✅ Yakunlangan: {formatDate(task.completedAt)}
                            </div>
                        )}
                        <button
                            onClick={deleteTask}
                            className="w-full mt-3 py-2.5 rounded-xl border border-red-100 text-red-500 text-xs font-bold hover:bg-red-50 transition-colors"
                        >
                            <Trash2 size={14} className="inline mr-1.5 -mt-0.5" />
                            Vazifani o&apos;chirish
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
