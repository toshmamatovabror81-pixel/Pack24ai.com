'use client';

import { useState, useEffect } from 'react';import { X, Phone, Mail, Building2, Shield, MessageCircle, Bell, Copy, CheckCheck, Link2, Briefcase, Clock, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface StaffDetail {
    id: number; name: string; email: string | null; phone: string;
    role: string; isActive: boolean; department: string | null;
    position: string | null; telegramId: string | null;
    telegramVerifiedAt: string | null; telegramNotify: boolean;
    smsNotify: boolean; createdAt: string;
    taskAssignments?: { task: { id: number; title: string; status: string; publicCode: string } }[];
}

interface Props {
    staff: StaffDetail | null;
    onClose: () => void;
    onUpdated: () => void;
}

const DEPT_LABELS: Record<string, string> = {
    warehouse: 'Omborxona', logistics: 'Logistika', production: 'Ishlab chiqarish',
    household: 'Xo\'jalik', sales: 'Sotuv', management: 'Boshqaruv',
};

const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator', manager: 'Menejer', staff: 'Xodim',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: 'Kutilmoqda', color: 'bg-slate-100 text-slate-600' },
    in_progress: { label: 'Jarayonda', color: 'bg-blue-100 text-blue-700' },
    review: { label: 'Tekshiruvda', color: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Bajarildi', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Bekor', color: 'bg-red-100 text-red-600' },
};

export function StaffDetailDrawer({ staff, onClose, onUpdated }: Props) {
    const [detail, setDetail] = useState<StaffDetail | null>(null);
    const [telegramCode, setTelegramCode] = useState<string | null>(null);
    const [codeCopied, setCodeCopied] = useState(false);
    const [loadingCode, setLoadingCode] = useState(false);
    const [togglingTg, setTogglingTg] = useState(false);
    const [togglingSms, setTogglingSms] = useState(false);

    useEffect(() => {
        if (!staff) { setDetail(null); return; }
        fetch(`/api/admin/staff/${staff.id}`)
            .then(r => r.json())
            .then(d => setDetail(d))
            .catch(() => setDetail(staff));
        setTelegramCode(null);
        setCodeCopied(false);
    }, [staff]);

    if (!staff || !detail) return null;

    const generateCode = async () => {
        setLoadingCode(true);
        try {
            const res = await fetch(`/api/admin/staff/${detail.id}/telegram-code`, { method: 'POST' });
            const data = await res.json();
            setTelegramCode(data.code);
        } catch { /* ignore */ }
        finally { setLoadingCode(false); }
    };

    const copyCode = () => {
        if (!telegramCode) return;
        navigator.clipboard.writeText(`/link ${telegramCode}`);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };

    const toggleNotification = async (channel: 'telegram' | 'sms') => {
        if (channel === 'telegram') setTogglingTg(true);
        else setTogglingSms(true);
        try {
            const body = channel === 'telegram'
                ? { telegramNotify: !detail.telegramNotify }
                : { smsNotify: !detail.smsNotify };
            const res = await fetch(`/api/admin/staff/${detail.id}/notifications`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                const updated = await res.json();
                setDetail(prev => prev ? { ...prev, ...updated } : prev);
                onUpdated();
            }
        } finally {
            setTogglingTg(false);
            setTogglingSms(false);
        }
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString('uz-UZ', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
            <div
                className="bg-white w-full max-w-md h-full overflow-y-auto animate-in slide-in-from-right duration-300 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-6 z-10">
                    <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                        <X size={18} className="text-white/80" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-xl font-bold text-white">
                            {detail.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white leading-tight">{detail.name}</h2>
                            <p className="text-indigo-200 text-sm">{detail.position || ROLE_LABELS[detail.role] || detail.role}</p>
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-5">
                    {/* Contact Info */}
                    <div className="space-y-2.5">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aloqa Ma&apos;lumotlari</h3>
                        <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl">
                            <Phone size={16} className="text-emerald-500 shrink-0" />
                            <div className="flex-1">
                                <span className="text-sm font-bold text-slate-800 font-mono">{detail.phone}</span>
                                <span className="text-[10px] text-slate-400 block">Telefon raqam</span>
                            </div>
                            <a href={`tel:${detail.phone}`} className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
                                <Phone size={14} className="text-emerald-600" />
                            </a>
                        </div>
                        {detail.email && (
                            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl">
                                <Mail size={16} className="text-blue-500 shrink-0" />
                                <div className="flex-1">
                                    <span className="text-sm font-bold text-slate-800">{detail.email}</span>
                                    <span className="text-[10px] text-slate-400 block">Email</span>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="bg-slate-50 px-4 py-3 rounded-xl">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <Building2 size={12} className="text-slate-400" />
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Bo&apos;lim</span>
                                </div>
                                <span className="text-sm font-bold text-slate-800">
                                    {DEPT_LABELS[detail.department || ''] || '—'}
                                </span>
                            </div>
                            <div className="bg-slate-50 px-4 py-3 rounded-xl">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <Shield size={12} className="text-slate-400" />
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Rol</span>
                                </div>
                                <span className="text-sm font-bold text-slate-800">
                                    {ROLE_LABELS[detail.role] || detail.role}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Telegram Integration */}
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <MessageCircle size={11} /> Telegram Integratsiya
                        </h3>
                        {detail.telegramId ? (
                            <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <CheckCheck size={16} className="text-emerald-600" />
                                    <span className="text-sm font-bold text-emerald-700">Telegram ulangan</span>
                                </div>
                                <span className="text-[10px] text-emerald-500 mt-1 block">
                                    ID: {detail.telegramId} • {detail.telegramVerifiedAt ? formatDate(detail.telegramVerifiedAt) : ''}
                                </span>
                            </div>
                        ) : (
                            <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl space-y-3">
                                <div className="flex items-center gap-2">
                                    <Link2 size={16} className="text-amber-600" />
                                    <span className="text-sm font-bold text-amber-700">Telegram ulanmagan</span>
                                </div>
                                {!telegramCode ? (
                                    <Button
                                        onClick={generateCode}
                                        disabled={loadingCode}
                                        className="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs py-2.5"
                                    >
                                        <Send size={13} className="mr-2" />
                                        {loadingCode ? 'Yaratilmoqda...' : 'Ulash kodi yaratish'}
                                    </Button>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="bg-white rounded-xl p-3 text-center">
                                            <span className="text-[10px] text-slate-400 block mb-1">Xodim bu kodni botga yuborsin:</span>
                                            <code className="text-2xl font-mono font-black text-indigo-600 tracking-[0.3em]">{telegramCode}</code>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={copyCode}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-medium hover:bg-gray-50 transition-colors"
                                            >
                                                {codeCopied ? <CheckCheck size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                                {codeCopied ? 'Nusxalandi!' : 'Buyruqni nusxalash'}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 text-center">
                                            @pack24AUP_bot ga <code className="bg-white px-1 py-0.5 rounded text-indigo-600">/link {telegramCode}</code> yuboring
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Notification Settings */}
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Bell size={11} /> Bildirishnoma Sozlamalari
                        </h3>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-xl">
                                <div className="flex items-center gap-2.5">
                                    <MessageCircle size={16} className="text-blue-500" />
                                    <div>
                                        <span className="text-sm font-bold text-slate-700 block">Telegram</span>
                                        <span className="text-[10px] text-slate-400">Bot orqali xabar</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleNotification('telegram')}
                                    disabled={togglingTg}
                                    className={`w-11 h-6 rounded-full relative transition-colors ${detail.telegramNotify ? 'bg-blue-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${detail.telegramNotify ? 'left-[22px]' : 'left-0.5'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-xl">
                                <div className="flex items-center gap-2.5">
                                    <Phone size={16} className="text-emerald-500" />
                                    <div>
                                        <span className="text-sm font-bold text-slate-700 block">SMS</span>
                                        <span className="text-[10px] text-slate-400">Telefon raqamga</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleNotification('sms')}
                                    disabled={togglingSms}
                                    className={`w-11 h-6 rounded-full relative transition-colors ${detail.smsNotify ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${detail.smsNotify ? 'left-[22px]' : 'left-0.5'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Assigned Tasks */}
                    {detail.taskAssignments && detail.taskAssignments.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Briefcase size={11} /> Tayinlangan Vazifalar ({detail.taskAssignments.length})
                            </h3>
                            <div className="space-y-2">
                                {detail.taskAssignments.map(a => {
                                    const s = STATUS_LABELS[a.task.status] || { label: a.task.status, color: 'bg-gray-100 text-gray-600' };
                                    return (
                                        <div key={a.task.id} className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl">
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs font-bold text-slate-400">{a.task.publicCode}</span>
                                                <span className="text-sm font-medium text-slate-700 block truncate">{a.task.title}</span>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${s.color}`}>
                                                {s.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Meta */}
                    <div className="pt-3 border-t border-gray-100 flex items-center gap-2 text-[10px] text-slate-400">
                        <Clock size={10} />
                        <span>Yaratilgan: {formatDate(detail.createdAt)}</span>
                        <span>•</span>
                        <span className={detail.isActive ? 'text-emerald-500' : 'text-red-500'}>
                            {detail.isActive ? '● Faol' : '● Nofaol'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
