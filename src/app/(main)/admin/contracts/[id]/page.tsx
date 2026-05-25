'use client';

import { useState, useEffect, use } from 'react';import { Building2, ArrowLeft, FileText, AlertTriangle, Loader2, CheckCircle, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Contract {
    id: number;
    contractNo: string;
    companyName: string;
    inn: string | null;
    mfo: string | null;
    bankAccount: string | null;
    bankName: string | null;
    directorName: string | null;
    creditLimit: number;
    paymentTermDays: number;
    status: string;
    startDate: string;
    notes: string | null;
    totalInvoiced: number;
    totalPaid: number;
    outstandingDebt: number;
    creditUsagePercent: number;
    user: { id: number; name: string; phone: string };
    _count: { invoices: number };
}

interface Invoice {
    id: number;
    invoiceNo: string;
    subtotal: number;
    vatAmount: number;
    totalAmount: number;
    paidAmount: number;
    status: string;
    dueDate: string;
    createdAt: string;
    contract?: { contractNo: string; companyName: string };
    order: { id: number; customerName: string | null; totalAmount: number; status: string };
}

const INV_STATUS: Record<string, { label: string; bg: string; text: string }> = {
    issued:    { label: 'Chiqarilgan', bg: 'bg-blue-50',    text: 'text-blue-700' },
    paid:      { label: "To'langan",  bg: 'bg-emerald-50', text: 'text-emerald-700' },
    partial:   { label: 'Qisman',     bg: 'bg-amber-50',   text: 'text-amber-700' },
    overdue:   { label: "Muddati o'tgan", bg: 'bg-red-50', text: 'text-red-700' },
    cancelled: { label: 'Bekor',      bg: 'bg-gray-100',   text: 'text-gray-500' },
};

const CONTRACT_STATUS: Record<string, { label: string; bg: string; text: string }> = {
    active:    { label: 'Faol',            bg: 'bg-emerald-50', text: 'text-emerald-700' },
    suspended: { label: "To'xtatilgan",    bg: 'bg-amber-50',   text: 'text-amber-700' },
    closed:    { label: 'Yopilgan',        bg: 'bg-gray-100',   text: 'text-gray-500' },
};

function fmtMoney(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M so\'m';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K so\'m';
    return n.toLocaleString() + ' so\'m';
}

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [contract, setContract] = useState<Contract | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvModal, setShowInvModal] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const cRes = await fetch(`/api/admin/contracts/${id}`);
            if (cRes.ok) {
                const data = await cRes.json();
                setContract(data);
                // API allaqachon invoices ni include qilib qaytaradi
                setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
            }
        } catch { toast.error('Yuklashda xato'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [id]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 size={28} className="animate-spin text-emerald-500" />
        </div>
    );

    if (!contract) return (
        <div className="text-center py-20">
            <p className="text-gray-500">Shartnoma topilmadi</p>
            <Link href="/admin/contracts" className="text-emerald-600 font-bold text-sm mt-2 block">← Orqaga</Link>
        </div>
    );

    const cs = CONTRACT_STATUS[contract.status] ?? CONTRACT_STATUS.active;
    const dangerDebt = contract.creditLimit > 0 && contract.creditUsagePercent > 80;
    const outstandingInvoices = invoices.filter(i => !['paid', 'cancelled'].includes(i.status));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/contracts"
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <ArrowLeft size={18} className="text-gray-500" />
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-xl font-extrabold text-gray-900 font-mono">{contract.contractNo}</h1>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cs.bg} ${cs.text}`}>
                            {cs.label}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{contract.companyName}</p>
                </div>
                {contract.status === 'active' && (
                    <button
                        onClick={() => setShowInvModal(true)}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-colors shadow-sm"
                    >
                        <Plus size={15} /> Faktura yaratish
                    </button>
                )}
            </div>

            {/* Kredit alert */}
            {dangerDebt && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                    <AlertTriangle size={18} className="text-red-500 shrink-0" />
                    <p className="text-sm text-red-700 font-medium">
                        Kredit limitining <strong>{contract.creditUsagePercent}%</strong> ishlatilgan.
                        Qolgan limit: <strong>{fmtMoney(contract.creditLimit - contract.outstandingDebt)}</strong>
                    </p>
                </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Kredit limiti</p>
                    <p className="text-xl font-extrabold text-blue-600 mt-1">{fmtMoney(contract.creditLimit)}</p>
                    {contract.creditLimit > 0 && (
                        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${dangerDebt ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(contract.creditUsagePercent, 100)}%` }}
                            />
                        </div>
                    )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Jami fakturalar</p>
                    <p className="text-xl font-extrabold text-gray-900 mt-1">{fmtMoney(contract.totalInvoiced)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{contract._count.invoices} ta faktura</p>
                </div>
                <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">To&apos;langan</p>
                    <p className="text-xl font-extrabold text-emerald-600 mt-1">{fmtMoney(contract.totalPaid)}</p>
                </div>
                <div className={`bg-white rounded-2xl border p-4 shadow-sm ${contract.outstandingDebt > 0 ? 'border-red-200' : 'border-gray-100'}`}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Qarz qoldig&apos;i</p>
                    <p className={`text-xl font-extrabold mt-1 ${contract.outstandingDebt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {fmtMoney(contract.outstandingDebt)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Company info */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <Building2 size={15} className="text-emerald-600" /> Kompaniya ma&apos;lumotlari
                    </h2>
                    <div className="space-y-2 text-sm">
                        {[
                            { l: 'Nomi', v: contract.companyName },
                            { l: 'INN (STIR)', v: contract.inn },
                            { l: 'MFO', v: contract.mfo },
                            { l: 'H/R', v: contract.bankAccount },
                            { l: 'Bank', v: contract.bankName },
                            { l: 'Direktor', v: contract.directorName },
                            { l: "To'lov muddati", v: `${contract.paymentTermDays} kun` },
                        ].map(({ l, v }) => v ? (
                            <div key={l} className="flex items-start justify-between gap-2">
                                <span className="text-gray-400 shrink-0">{l}:</span>
                                <span className="font-semibold text-gray-800 text-right">{v}</span>
                            </div>
                        ) : null)}
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Bog&apos;liq mijoz</p>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                                {contract.user.name[0]}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">{contract.user.name}</p>
                                <p className="text-xs text-gray-400">{contract.user.phone}</p>
                            </div>
                        </div>
                    </div>

                    {contract.notes && (
                        <div className="border-t border-gray-100 pt-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Eslatma</p>
                            <p className="text-sm text-gray-600">{contract.notes}</p>
                        </div>
                    )}
                </div>

                {/* Invoices */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <h2 className="font-bold text-gray-800 flex items-center gap-2">
                            <FileText size={15} className="text-blue-600" /> Fakturalar
                        </h2>
                        {outstandingInvoices.length > 0 && (
                            <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2.5 py-1 rounded-full">
                                {outstandingInvoices.length} ta to&apos;lanmagan
                            </span>
                        )}
                    </div>

                    {invoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <FileText size={36} className="text-gray-200 mb-3" />
                            <p className="text-gray-400 text-sm font-medium">Hali faktura yo&apos;q</p>
                            {contract.status === 'active' && (
                                <button
                                    onClick={() => setShowInvModal(true)}
                                    className="mt-3 text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                                >
                                    <Plus size={12} /> Faktura yaratish
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Faktura</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Buyurtma</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Jami</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">To&apos;langan</th>
                                    <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Muddat</th>
                                    <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Status</th>
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(inv => {
                                    const s = INV_STATUS[inv.status] ?? INV_STATUS.issued;
                                    const isOverdue = new Date(inv.dueDate) < new Date() && !['paid', 'cancelled'].includes(inv.status);
                                    return (
                                        <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className="font-mono font-bold text-sm text-blue-700">{inv.invoiceNo}</span>
                                                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(inv.createdAt).toLocaleDateString('uz-UZ')}</p>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700">#{inv.order.id}</td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                                                {fmtMoney(inv.totalAmount)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-sm font-bold ${inv.paidAmount > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                                                    {inv.paidAmount > 0 ? fmtMoney(inv.paidAmount) : '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                                                    {new Date(inv.dueDate).toLocaleDateString('uz-UZ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                                            </td>
                                            <td className="px-2 py-3">
                                                <button
                                                    onClick={() => window.open(`/api/admin/invoices/${inv.id}/pdf`, '_blank')}
                                                    className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="PDF"
                                                >
                                                    <FileText size={13} className="text-blue-500" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Create Invoice Modal */}
            {showInvModal && (
                <CreateInvoiceModal
                    contractId={contract.id}
                    contractNo={contract.contractNo}
                    creditLimit={contract.creditLimit}
                    outstandingDebt={contract.outstandingDebt}
                    userId={contract.user.id}
                    onClose={() => setShowInvModal(false)}
                    onCreated={() => { setShowInvModal(false); load(); }}
                />
            )}
        </div>
    );
}

// ─── Modal: Faktura yaratish ──────────────────────────────────────────────────
function CreateInvoiceModal({
    contractId, contractNo, creditLimit, outstandingDebt, userId, onClose, onCreated,
}: {
    contractId: number;
    contractNo: string;
    creditLimit: number;
    outstandingDebt: number;
    userId: number;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [orders, setOrders] = useState<{ id: number; totalAmount: number; status: string; customerName: string | null }[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(0);
    const [vatPercent, setVatPercent] = useState(12);
    const remainingCredit = creditLimit - outstandingDebt;

    useEffect(() => {
        fetch(`/api/orders?userId=${userId}&limit=20&status=processing`)
            .then(r => r.json())
            .then(d => setOrders(Array.isArray(d) ? d : d.orders || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [userId]);

    const selected = orders.find(o => o.id === selectedOrder);
    const totalWithVat = selected ? Math.round(selected.totalAmount * (1 + vatPercent / 100)) : 0;
    const willExceedLimit = creditLimit > 0 && (outstandingDebt + totalWithVat) > creditLimit;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder) { toast.error('Buyurtma tanlang'); return; }
        if (willExceedLimit) { toast.error('Kredit limiti oshib ketadi!'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contractId, orderId: selectedOrder, vatPercent }),
            });
            if (res.ok) {
                toast.success('Faktura yaratildi ✓');
                onCreated();
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
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-extrabold text-gray-900">🧾 Faktura yaratish</h2>
                            <p className="text-xs text-gray-400 mt-0.5">Shartnoma: {contractNo}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-5 space-y-4">
                        {creditLimit > 0 && (
                            <div className={`rounded-xl p-3 ${willExceedLimit ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                                <p className={`text-xs font-bold ${willExceedLimit ? 'text-red-700' : 'text-gray-500'}`}>
                                    {willExceedLimit
                                        ? '⚠️ Kredit limiti oshib ketadi!'
                                        : `Mavjud kredit: ${fmtMoney(remainingCredit)}`
                                    }
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Buyurtma</label>
                            {loading ? (
                                <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 size={14} className="animate-spin" /> Yuklanmoqda...</div>
                            ) : orders.length === 0 ? (
                                <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-3">
                                    Bu mijozning &quot;Jarayonda&quot; statusdagi buyurtmalari topilmadi
                                </p>
                            ) : (
                                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl">
                                    {orders.map(o => (
                                        <button key={o.id} type="button"
                                            onClick={() => setSelectedOrder(o.id)}
                                            className={`w-full text-left px-4 py-3 flex items-center justify-between border-b last:border-b-0 border-gray-100 text-sm transition-colors hover:bg-emerald-50 ${selectedOrder === o.id ? 'bg-emerald-50 font-bold' : ''}`}
                                        >
                                            <span>Buyurtma #{o.id} — {o.customerName || 'Mijoz'}</span>
                                            <span className="text-emerald-600 font-bold">{fmtMoney(o.totalAmount)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">QQS (%)</label>
                            <input type="number" value={vatPercent} onChange={e => setVatPercent(Number(e.target.value))}
                                min={0} max={30}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                        </div>

                        {selected && (
                            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Subtotal:</span>
                                    <span className="font-bold">{fmtMoney(selected.totalAmount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">QQS ({vatPercent}%):</span>
                                    <span className="font-bold">{fmtMoney(Math.round(selected.totalAmount * vatPercent / 100))}</span>
                                </div>
                                <div className="flex justify-between border-t border-gray-200 pt-1.5 font-extrabold text-gray-900">
                                    <span>Jami:</span>
                                    <span className={willExceedLimit ? 'text-red-600' : 'text-emerald-600'}>{fmtMoney(totalWithVat)}</span>
                                </div>
                            </div>
                        )}

                        <button type="submit" disabled={saving || !selectedOrder || willExceedLimit}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-colors">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            {saving ? 'Yaratilmoqda...' : 'Faktura yaratish'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
