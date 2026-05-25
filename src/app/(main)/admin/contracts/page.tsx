'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Building2, CreditCard, AlertTriangle, X, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Contract {
    id: number;
    contractNo: string;
    companyName: string;
    inn: string | null;
    creditLimit: number;
    paymentTermDays: number;
    status: string;
    startDate: string;
    totalInvoiced: number;
    totalPaid: number;
    outstandingDebt: number;
    creditUsagePercent: number;
    user: { id: number; name: string; phone: string };
    _count: { invoices: number };
}

interface UserOption {
    id: number;
    name: string;
    phone: string;
    companyName: string | null;
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
    active:    { label: 'Faol',      bg: 'bg-emerald-50',  text: 'text-emerald-700' },
    suspended: { label: 'To\'xtatilgan', bg: 'bg-amber-50', text: 'text-amber-700' },
    closed:    { label: 'Yopilgan',  bg: 'bg-gray-100',    text: 'text-gray-500' },
};

function fmtMoney(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
    return n.toLocaleString();
}

export default function ContractsPage() {
    const router = useRouter();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (search) params.set('search', search);
            const res = await fetch(`/api/admin/contracts?${params}`);
            const data = await res.json();
            setContracts(Array.isArray(data) ? data : []);
        } catch { toast.error('Yuklashda xato'); }
        finally { setLoading(false); }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [statusFilter]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        load();
    };

    const stats = {
        total: contracts.length,
        active: contracts.filter(c => c.status === 'active').length,
        totalDebt: contracts.reduce((s, c) => s + c.outstandingDebt, 0),
        totalLimit: contracts.reduce((s, c) => s + c.creditLimit, 0),
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">📋 Shartnomalar</h1>
                    <p className="text-sm text-gray-500 mt-1">Korporativ mijozlar bilan shartnomalar boshqaruvi</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-colors shadow-lg shadow-emerald-200"
                >
                    <Plus size={16} /> Yangi shartnoma
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Jami shartnomalar</p>
                    <p className="text-2xl font-extrabold text-gray-900 mt-1">{stats.total}</p>
                </div>
                <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Faol</p>
                    <p className="text-2xl font-extrabold text-emerald-600 mt-1">{stats.active}</p>
                </div>
                <div className="bg-white rounded-2xl border border-red-100 p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Jami qarz</p>
                    <p className="text-2xl font-extrabold text-red-600 mt-1">{fmtMoney(stats.totalDebt)} <span className="text-xs font-normal">so&apos;m</span></p>
                </div>
                <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Jami kredit limiti</p>
                    <p className="text-2xl font-extrabold text-blue-600 mt-1">{fmtMoney(stats.totalLimit)} <span className="text-xs font-normal">so&apos;m</span></p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <form onSubmit={handleSearch} className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Kompaniya, shartnoma raqami yoki INN..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emerald-400"
                    />
                </form>
                {['all', 'active', 'suspended', 'closed'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                            statusFilter === s
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        {s === 'all' ? 'Barchasi' : STATUS_CFG[s]?.label ?? s}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-500" /></div>
            ) : contracts.length === 0 ? (
                <div className="text-center py-20">
                    <FileText size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 font-bold">Shartnomalar topilmadi</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Shartnoma</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Kompaniya</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Mijoz</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Kredit limiti</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Qarz</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Fakturalar</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Status</th>
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {contracts.map(c => {
                                const s = STATUS_CFG[c.status] ?? STATUS_CFG.active;
                                const dangerDebt = c.creditLimit > 0 && c.creditUsagePercent > 80;
                                return (
                                    <tr key={c.id}
                                        onClick={() => router.push(`/admin/contracts/${c.id}`)}
                                        className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer">
                                        <td className="px-4 py-3">
                                            <span className="font-mono font-bold text-sm text-emerald-700">{c.contractNo}</span>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{new Date(c.startDate).toLocaleDateString('uz-UZ')}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Building2 size={14} className="text-gray-400" />
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{c.companyName}</p>
                                                    {c.inn && <p className="text-[10px] text-gray-400">INN: {c.inn}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-gray-700">{c.user.name}</p>
                                            <p className="text-[10px] text-gray-400">{c.user.phone}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <p className="text-sm font-bold text-gray-900">{fmtMoney(c.creditLimit)}</p>
                                            {c.creditLimit > 0 && (
                                                <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-20 ml-auto">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${dangerDebt ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min(c.creditUsagePercent, 100)}%` }}
                                                    />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <p className={`text-sm font-bold ${c.outstandingDebt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                {c.outstandingDebt > 0 ? fmtMoney(c.outstandingDebt) : '0'}
                                            </p>
                                            {dangerDebt && <AlertTriangle size={12} className="inline text-red-500 ml-1" />}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm font-bold text-gray-700">{c._count.invoices}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                                                {s.label}
                                            </span>
                                        </td>
                                        <td className="px-2 py-3">
                                            <ChevronRight size={14} className="text-gray-300" />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            {showModal && <CreateContractModal onClose={() => setShowModal(false)} onCreated={load} />}
        </div>
    );
}

// ─── Modal: Yangi shartnoma yaratish ─────────────────────────────────────────
function CreateContractModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [userSearch, setUserSearch] = useState('');

    const [form, setForm] = useState({
        userId: 0,
        companyName: '',
        inn: '',
        mfo: '',
        bankAccount: '',
        bankName: '',
        directorName: '',
        creditLimit: '',
        paymentTermDays: '15',
        notes: '',
    });

    useEffect(() => {
        setLoading(true);
        fetch('/api/admin/customers?limit=200')
            .then(r => r.json())
            .then(data => {
                const list = data.customers || data;
                setUsers(Array.isArray(list) ? list.map((u: Record<string, unknown>) => ({
                    id: u.id as number,
                    name: u.name as string,
                    phone: u.phone as string,
                    companyName: u.companyName as string | null,
                })) : []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phone.includes(userSearch) ||
        (u.companyName && u.companyName.toLowerCase().includes(userSearch.toLowerCase()))
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.userId || !form.companyName) {
            toast.error('Mijoz va kompaniya nomi majburiy');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/contracts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    creditLimit: Number(form.creditLimit) || 0,
                    paymentTermDays: Number(form.paymentTermDays) || 15,
                }),
            });
            if (res.ok) {
                toast.success('Shartnoma yaratildi ✓');
                onCreated();
                onClose();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Xatolik');
            }
        } catch { toast.error('Server xatosi'); }
        finally { setSaving(false); }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={onClose} />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-lg font-extrabold text-gray-900">📋 Yangi shartnoma</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-5 space-y-4">
                        {/* Mijoz tanlash */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Mijoz</label>
                            <input
                                value={userSearch} onChange={e => setUserSearch(e.target.value)}
                                placeholder="Mijoz qidirish..."
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 mb-2"
                            />
                            {loading ? <Loader2 size={16} className="animate-spin text-gray-400" /> : (
                                <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-xl">
                                    {filteredUsers.slice(0, 10).map(u => (
                                        <button key={u.id} type="button"
                                            onClick={() => {
                                                setForm(f => ({ ...f, userId: u.id, companyName: u.companyName || f.companyName }));
                                                setUserSearch(u.name);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition-colors ${
                                                form.userId === u.id ? 'bg-emerald-50 font-bold' : ''
                                            }`}
                                        >
                                            {u.name} <span className="text-gray-400 text-xs">({u.phone})</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Kompaniya nomi *</label>
                                <input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" required />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">INN (STIR)</label>
                                <input value={form.inn} onChange={e => setForm(f => ({ ...f, inn: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" placeholder="309876543" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Bank nomi</label>
                                <input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">MFO</label>
                                <input value={form.mfo} onChange={e => setForm(f => ({ ...f, mfo: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" placeholder="00873" />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Hisob raqami (H/R)</label>
                            <input value={form.bankAccount} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" placeholder="2020 8000 ..." />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Direktor</label>
                                <input value={form.directorName} onChange={e => setForm(f => ({ ...f, directorName: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">To&apos;lov muddati (kun)</label>
                                <input type="number" value={form.paymentTermDays} onChange={e => setForm(f => ({ ...f, paymentTermDays: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                                <CreditCard size={10} className="inline mr-1" />Kredit limiti (so&apos;m)
                            </label>
                            <input type="number" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                                placeholder="50 000 000" />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Eslatma</label>
                            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm h-16 resize-none focus:outline-none focus:border-emerald-400" />
                        </div>

                        <button type="submit" disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            {saving ? 'Yaratilmoqda...' : 'Shartnoma yaratish'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
