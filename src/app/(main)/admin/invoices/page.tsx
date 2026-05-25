'use client';

import { useState, useEffect } from 'react';
import { FileText, Search, Download, DollarSign, AlertTriangle, Loader2, CheckCircle, Clock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface Invoice {
    id: number;
    invoiceNo: string;
    subtotal: number;
    vatPercent: number;
    vatAmount: number;
    totalAmount: number;
    paidAmount: number;
    status: string;
    dueDate: string;
    createdAt: string;
    contract: { contractNo: string; companyName: string; inn: string | null };
    order: { id: number; status: string; customerName: string | null; totalAmount: number };
}

interface Stats {
    total: number;
    totalAmount: number;
    totalPaid: number;
    issued: number;
    paid: number;
    overdue: number;
    partial: number;
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    issued:    { label: 'Chiqarilgan', bg: 'bg-blue-50',    text: 'text-blue-700',    icon: <Clock size={12} /> },
    paid:      { label: 'To\'langan',  bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <CheckCircle size={12} /> },
    partial:   { label: 'Qisman',     bg: 'bg-amber-50',   text: 'text-amber-700',   icon: <DollarSign size={12} /> },
    overdue:   { label: 'Muddati o\'tgan', bg: 'bg-red-50', text: 'text-red-700',    icon: <AlertTriangle size={12} /> },
    cancelled: { label: 'Bekor',      bg: 'bg-gray-100',   text: 'text-gray-500',    icon: <X size={12} /> },
};

function fmtMoney(n: number) {
    return n.toLocaleString('uz-UZ');
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [payModal, setPayModal] = useState<Invoice | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.set('status', statusFilter);
            const res = await fetch(`/api/admin/invoices?${params}`);
            const data = await res.json();
            setInvoices(data.invoices || []);
            setStats(data.stats || null);
        } catch { toast.error('Yuklashda xato'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [statusFilter]);

    const outstanding = (stats?.totalAmount ?? 0) - (stats?.totalPaid ?? 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900">🧾 Hisob-fakturalar</h1>
                <p className="text-sm text-gray-500 mt-1">Korporativ fakturalar, QQS va to&apos;lovlar boshqaruvi</p>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-5 gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Jami fakturalar</p>
                        <p className="text-2xl font-extrabold text-gray-900 mt-1">{stats.total}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Jami summa</p>
                        <p className="text-xl font-extrabold text-blue-600 mt-1">{fmtMoney(stats.totalAmount)} <span className="text-[10px] font-normal">so&apos;m</span></p>
                    </div>
                    <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">To&apos;langan</p>
                        <p className="text-xl font-extrabold text-emerald-600 mt-1">{fmtMoney(stats.totalPaid)} <span className="text-[10px] font-normal">so&apos;m</span></p>
                    </div>
                    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${outstanding > 0 ? 'border-red-200' : 'border-gray-100'}`}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Qoldig&apos;i</p>
                        <p className={`text-xl font-extrabold mt-1 ${outstanding > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {fmtMoney(outstanding)} <span className="text-[10px] font-normal">so&apos;m</span>
                        </p>
                    </div>
                    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${stats.overdue > 0 ? 'border-red-200' : 'border-gray-100'}`}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Muddati o&apos;tgan</p>
                        <p className={`text-2xl font-extrabold mt-1 ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>{stats.overdue}</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-2">
                {['all', 'issued', 'partial', 'overdue', 'paid', 'cancelled'].map(s => {
                    const cfg = STATUS_CFG[s];
                    return (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                                statusFilter === s
                                    ? 'bg-gray-900 text-white border-gray-900'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {cfg?.icon}
                            {s === 'all' ? 'Barchasi' : cfg?.label ?? s}
                        </button>
                    );
                })}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
            ) : invoices.length === 0 ? (
                <div className="text-center py-20">
                    <FileText size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 font-bold">Fakturalar topilmadi</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Faktura</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Kompaniya</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Summa</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">QQS</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Jami</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">To&apos;langan</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Muddat</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Status</th>
                                <th className="w-24"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map(inv => {
                                const s = STATUS_CFG[inv.status] ?? STATUS_CFG.issued;
                                const remaining = inv.totalAmount - inv.paidAmount;
                                const isOverdue = new Date(inv.dueDate) < new Date() && inv.status !== 'paid';
                                return (
                                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-mono font-bold text-sm text-blue-700">{inv.invoiceNo}</span>
                                            <p className="text-[10px] text-gray-400 mt-0.5">Buyurtma #{inv.order.id}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-bold text-gray-900">{inv.contract.companyName}</p>
                                            <p className="text-[10px] text-gray-400">{inv.contract.contractNo}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-700">{fmtMoney(inv.subtotal)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-500">{fmtMoney(inv.vatAmount)}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmtMoney(inv.totalAmount)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <p className={`text-sm font-bold ${inv.paidAmount > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                {inv.paidAmount > 0 ? fmtMoney(inv.paidAmount) : '—'}
                                            </p>
                                            {remaining > 0 && inv.status !== 'cancelled' && (
                                                <p className="text-[10px] text-red-500 font-bold">-{fmtMoney(remaining)}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <p className={`text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                                                {new Date(inv.dueDate).toLocaleDateString('uz-UZ')}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                                                {s.icon}{s.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                                    <button
                                                        onClick={() => setPayModal(inv)}
                                                        className="p-1.5 hover:bg-emerald-50 rounded-lg transition-colors"
                                                        title="To'lov kiritish"
                                                    >
                                                        <DollarSign size={14} className="text-emerald-600" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => window.open(`/api/admin/invoices/${inv.id}/pdf`, '_blank')}
                                                    className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="PDF yuklab olish"
                                                >
                                                    <Download size={14} className="text-blue-600" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Payment Modal */}
            {payModal && (
                <PaymentModal
                    invoice={payModal}
                    onClose={() => setPayModal(null)}
                    onPaid={() => { setPayModal(null); load(); }}
                />
            )}
        </div>
    );
}

// ─── Modal: To'lov kiritish ──────────────────────────────────────────────────
function PaymentModal({ invoice, onClose, onPaid }: { invoice: Invoice; onClose: () => void; onPaid: () => void }) {
    const [amount, setAmount] = useState('');
    const [saving, setSaving] = useState(false);
    const remaining = invoice.totalAmount - invoice.paidAmount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const val = Number(amount);
        if (!val || val <= 0) { toast.error('Summa kiritilmagan'); return; }
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add_payment', amount: val }),
            });
            if (res.ok) {
                toast.success("To'lov kiritildi ✓");
                onPaid();
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
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                    <div className="p-5 border-b border-gray-100">
                        <h2 className="text-lg font-extrabold text-gray-900">💰 To&apos;lov kiritish</h2>
                        <p className="text-sm text-gray-500 mt-1">{invoice.invoiceNo} — {invoice.contract.companyName}</p>
                    </div>
                    <form onSubmit={handleSubmit} className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Jami</p>
                                <p className="text-lg font-extrabold text-gray-900">{fmtMoney(invoice.totalAmount)}</p>
                            </div>
                            <div className={`rounded-xl p-3 text-center ${remaining > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Qoldiq</p>
                                <p className={`text-lg font-extrabold ${remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {fmtMoney(remaining)}
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">To&apos;lov summasi (so&apos;m)</label>
                            <input
                                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-lg font-bold focus:outline-none focus:border-emerald-400"
                                placeholder={remaining.toString()} autoFocus
                            />
                            <button type="button" onClick={() => setAmount(remaining.toString())}
                                className="text-xs text-emerald-600 font-bold mt-1.5 hover:underline">
                                To&apos;liq to&apos;lash ({fmtMoney(remaining)} so&apos;m)
                            </button>
                        </div>

                        <button type="submit" disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            {saving ? 'Saqlanmoqda...' : "To'lovni saqlash"}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
