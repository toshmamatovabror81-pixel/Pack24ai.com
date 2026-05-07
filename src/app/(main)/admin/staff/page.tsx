'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
    Search, Plus, Pencil, Trash2, Check, X, Eye, EyeOff, User,
    Phone, Send, MessageCircle, Bell, BellOff, RefreshCw,
    Package, Truck, Factory, Wrench, Briefcase, Shield,
} from 'lucide-react';
import { StaffDetailDrawer } from './_components/StaffDetailDrawer';

interface StaffUser {
    id: number; name: string; email: string | null; phone: string;
    role: string; isActive: boolean; department: string | null;
    position: string | null; telegramId: string | null;
    telegramVerifiedAt: string | null; telegramNotify: boolean;
    smsNotify: boolean; createdAt: string;
    _count: { taskAssignments: number; tasksCreated: number };
}

interface Stats { total: number; active: number; inactive: number; withTelegram: number; byDepartment: { department: string; count: number }[] }

const DEPARTMENTS = [
    { value: 'warehouse', label: 'Omborxona', icon: Package },
    { value: 'logistics', label: 'Logistika', icon: Truck },
    { value: 'production', label: 'Ishlab chiqarish', icon: Factory },
    { value: 'household', label: 'Xo\'jalik', icon: Wrench },
    { value: 'sales', label: 'Sotuv', icon: Briefcase },
    { value: 'management', label: 'Boshqaruv', icon: Shield },
];

const ROLES = [
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Menejer' },
    { value: 'staff', label: 'Xodim' },
];

export default function StaffPage() {
    const [staff, setStaff] = useState<StaffUser[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formRole, setFormRole] = useState('staff');
    const [formDept, setFormDept] = useState('');
    const [formPosition, setFormPosition] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchStaff = useCallback(async () => {
        try {
            const params = new URLSearchParams({ withStats: 'true', limit: '100' });
            if (searchTerm) params.set('search', searchTerm);
            if (deptFilter !== 'all') params.set('department', deptFilter);
            const res = await fetch(`/api/admin/staff?${params}`);
            const data = await res.json();
            setStaff(data.staff || []);
            if (data.stats) setStats(data.stats);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [searchTerm, deptFilter]);

    useEffect(() => { fetchStaff(); }, [fetchStaff]);

    const resetForm = () => {
        setFormName(''); setFormPhone(''); setFormEmail('');
        setFormRole('staff'); setFormDept(''); setFormPosition('');
        setFormPassword(''); setEditingId(null);
    };

    const openEdit = (s: StaffUser) => {
        setFormName(s.name); setFormPhone(s.phone); setFormEmail(s.email || '');
        setFormRole(s.role); setFormDept(s.department || ''); setFormPosition(s.position || '');
        setFormPassword(''); setEditingId(s.id); setIsModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formName.trim() || !formPhone.trim()) return;
        setSubmitting(true);
        try {
            const body: Record<string, unknown> = {
                name: formName.trim(), phone: formPhone.trim(),
                email: formEmail.trim() || null, role: formRole,
                department: formDept || null, position: formPosition.trim() || null,
            };
            if (formPassword) body.password = formPassword;
            if (!editingId && !formPassword) body.password = Math.random().toString(36).slice(2, 10);

            const url = editingId ? `/api/admin/staff/${editingId}` : '/api/admin/staff';
            const res = await fetch(url, {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) { resetForm(); setIsModalOpen(false); fetchStaff(); }
            else { const d = await res.json(); alert(d.error || 'Xatolik'); }
        } finally { setSubmitting(false); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Xodimni o\'chirmoqchimisiz?')) return;
        await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
        fetchStaff();
    };

    const toggleActive = async (s: StaffUser) => {
        await fetch(`/api/admin/staff/${s.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !s.isActive }),
        });
        fetchStaff();
    };

    const getDeptIcon = (dept: string | null) => {
        const d = DEPARTMENTS.find(x => x.value === dept);
        return d ? <d.icon size={14} /> : <User size={14} />;
    };

    return (
        <div className="p-6 bg-slate-50/50 min-h-screen max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Xodimlar Markazi</h1>
                    <p className="text-slate-500 text-sm">Barcha bo&apos;limlar xodimlari va aloqa boshqaruvi</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="bg-white" onClick={fetchStaff}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Yangilash
                    </Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                        onClick={() => { resetForm(); setIsModalOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Xodim qo&apos;shish
                    </Button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {[
                        { label: 'Jami', value: stats.total, color: 'text-slate-800', bg: 'bg-white' },
                        { label: 'Faol', value: stats.active, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Nofaol', value: stats.inactive, color: 'text-red-500', bg: 'bg-red-50' },
                        { label: 'Telegram', value: stats.withTelegram, color: 'text-blue-600', bg: 'bg-blue-50' },
                    ].map(s => (
                        <div key={s.label} className={`${s.bg} p-4 rounded-xl border border-gray-100`}>
                            <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold mt-0.5">{s.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="flex gap-1">
                    <button onClick={() => setDeptFilter('all')} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${deptFilter === 'all' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/60'}`}>Barchasi</button>
                    {DEPARTMENTS.map(d => (
                        <button key={d.value} onClick={() => setDeptFilter(d.value)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${deptFilter === d.value ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/60'}`}>
                            <d.icon size={13} /> {d.label}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Ism, telefon, lavozim..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" /></div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-slate-400 uppercase tracking-wider">
                                <th className="py-3 px-5 font-medium">Xodim</th>
                                <th className="py-3 px-4 font-medium">Telefon</th>
                                <th className="py-3 px-4 font-medium">Bo&apos;lim</th>
                                <th className="py-3 px-4 font-medium">Rol</th>
                                <th className="py-3 px-4 font-medium">Telegram</th>
                                <th className="py-3 px-4 font-medium">Bildirishnoma</th>
                                <th className="py-3 px-4 font-medium">Vazifalar</th>
                                <th className="py-3 px-4 font-medium">Holat</th>
                                <th className="py-3 px-5 font-medium text-right">Harakatlar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {staff.map(s => (
                                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="py-3 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-sm font-bold text-indigo-600">
                                                {s.name.charAt(0)}
                                            </div>
                                            <div>
                                                <button onClick={() => setSelectedStaff(s)} className="font-bold text-sm text-slate-900 block hover:text-indigo-600 transition-colors text-left">{s.name}</button>
                                                {s.position && <span className="text-[10px] text-slate-400">{s.position}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-slate-600 font-mono">{s.phone}</td>
                                    <td className="py-3 px-4">
                                        <span className="flex items-center gap-1.5 text-xs text-slate-600">
                                            {getDeptIcon(s.department)}
                                            {DEPARTMENTS.find(d => d.value === s.department)?.label || '—'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <Badge className={`text-[10px] px-2 py-0.5 border-none ${s.role === 'admin' ? 'bg-purple-50 text-purple-700' : s.role === 'manager' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                                            {ROLES.find(r => r.value === s.role)?.label || s.role}
                                        </Badge>
                                    </td>
                                    <td className="py-3 px-4">
                                        {s.telegramId ? (
                                            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                                                <MessageCircle size={12} /> Ulangan
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400">Ulanmagan</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            {s.telegramNotify ? <Bell size={12} className="text-blue-500" /> : <BellOff size={12} className="text-slate-300" />}
                                            {s.smsNotify ? <Phone size={12} className="text-emerald-500" /> : <Phone size={12} className="text-slate-300" />}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="text-xs text-slate-600 font-bold">{s._count.taskAssignments}</span>
                                        <span className="text-[10px] text-slate-400"> tayinlangan</span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <button onClick={() => toggleActive(s)} className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-all ${s.isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                                            {s.isActive ? 'Faol' : 'Nofaol'}
                                        </button>
                                    </td>
                                    <td className="py-3 px-5 text-right">
                                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {s.telegramId && (
                                                <button title="Telegram xabar" className="p-1.5 rounded-lg border border-blue-100 text-blue-500 hover:bg-blue-50"><Send size={13} /></button>
                                            )}
                                            <a href={`tel:${s.phone}`} title="Qo'ng'iroq" className="p-1.5 rounded-lg border border-emerald-100 text-emerald-500 hover:bg-emerald-50"><Phone size={13} /></a>
                                            <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg border border-indigo-100 text-indigo-600 hover:bg-indigo-50"><Pencil size={13} /></button>
                                            <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {staff.length === 0 && (
                                <tr><td colSpan={9} className="py-16 text-center text-slate-400 text-sm">Xodimlar topilmadi</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Xodimni tahrirlash' : 'Yangi xodim'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} className="text-slate-400" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">F.I.O *</label>
                                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ism sharif"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" autoFocus />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Telefon *</label>
                                    <input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+998"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Email</label>
                                    <input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@pack24.uz"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Bo&apos;lim</label>
                                    <select value={formDept} onChange={e => setFormDept(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                                        <option value="">Tanlanmagan</option>
                                        {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Rol</label>
                                    <select value={formRole} onChange={e => setFormRole(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Lavozim</label>
                                <input value={formPosition} onChange={e => setFormPosition(e.target.value)} placeholder="Omborchi, Operator, h.k."
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Parol {editingId ? '(o\'zgartirish)' : '*'}</label>
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} value={formPassword} onChange={e => setFormPassword(e.target.value)}
                                        placeholder={editingId ? 'Bo\'sh qoldiring — o\'zgarmaydi' : 'Avtomatik yaratiladi'}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 pr-10" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="flex justify-between mt-1">
                                    <button type="button" onClick={() => setFormPassword(Math.random().toString(36).slice(2, 10))} className="text-xs text-blue-600 hover:underline">Avtomatik yaratish</button>
                                    <button type="button" className="text-xs text-emerald-600 font-medium hover:underline flex items-center gap-1"><Send size={10} /> Telegram orqali yuborish</button>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 p-5 border-t border-gray-100">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">Bekor qilish</Button>
                            <Button onClick={handleSubmit} disabled={!formName.trim() || !formPhone.trim() || submitting}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 disabled:opacity-50">
                                <Check className="w-4 h-4 mr-2" /> {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {/* Staff Detail Drawer */}
            <StaffDetailDrawer
                staff={selectedStaff}
                onClose={() => setSelectedStaff(null)}
                onUpdated={fetchStaff}
            />
        </div>
    );
}
