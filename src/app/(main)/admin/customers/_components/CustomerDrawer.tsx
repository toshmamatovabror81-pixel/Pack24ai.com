'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X, Phone, Building2, MapPin, Calendar, ShoppingCart,
    Loader2,
    Save, FileText, Printer,
    DollarSign,
    ArrowDownLeft, ArrowUpRight, MessageSquare, Headphones, Bot, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

// ── Configs ──────────────────────────────────────────────────────
const TYPE_OPTIONS = [
    { value: 'individual', label: '👤 Jismoniy shaxs', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'corporate',  label: '🏢 Korporativ',     color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { value: 'wholesale',  label: '📦 Ulgurji',        color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { value: 'dealer',     label: '🤝 Diler',          color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

const GROUP_OPTIONS = [
    { value: 'standard', label: 'Standard',    dot: 'bg-gray-400' },
    { value: 'vip',      label: '💎 VIP',      dot: 'bg-amber-500' },
    { value: 'new',      label: '🟢 Yangi',    dot: 'bg-green-500' },
    { value: 'inactive', label: '⚪ Faol emas', dot: 'bg-gray-300' },
    { value: 'blocked',  label: '🔴 Bloklangan',dot: 'bg-red-500' },
];

const ORDER_STATUS: Record<string, { bg: string; text: string; label: string }> = {
    new:        { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Yangi' },
    processing: { bg: 'bg-indigo-50',  text: 'text-indigo-700',  label: 'Jarayonda' },
    shipping:   { bg: 'bg-purple-50',  text: 'text-purple-700',  label: "Yo'lda" },
    delivered:  { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Yetkazildi' },
    cancelled:  { bg: 'bg-red-50',     text: 'text-red-700',     label: 'Bekor' },
};

interface CustomerDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    customer: CustomerSummary | null;
    onSaved?: () => void;
}

interface CustomerSummary {
    id: number | string;
    source: 'registered' | 'guest';
    name: string;
    phone: string;
}

interface CustomerOrderItem {
    product?: {
        name?: string | null;
    } | null;
}

interface CustomerOrder {
    id: number;
    status: string;
    paymentStatus: string;
    paymentMethod?: string | null;
    createdAt: string;
    updatedAt: string;
    totalAmount?: number | null;
    items?: CustomerOrderItem[];
}

interface CustomerFinancials {
    totalOrders: number;
    totalRevenue: number;
    totalPaid: number;
    totalDebit: number;
    deliveredCount: number;
    activeCount: number;
}

interface CustomerLedgerEntry {
    date: string;
    orderId: number;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    status: string;
    paymentStatus: string;
}

interface CustomerDetail {
    id: number | string;
    name: string;
    phone: string;
    telegramId?: string | null;
    isActive: boolean;
    customerType?: string | null;
    customerGroup?: string | null;
    companyName?: string | null;
    address?: string | null;
    notes?: string | null;
    orders?: CustomerOrder[];
    financials?: CustomerFinancials;
    ledger?: CustomerLedgerEntry[];
    currentBalance?: number;
}

function formatMoney(amount: number): string {
    return amount.toLocaleString('uz-UZ') + " so'm";
}

export default function CustomerDrawer({ isOpen, onClose, customer, onSaved }: CustomerDrawerProps) {
    const [detail, setDetail] = useState<CustomerDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState<'info' | 'orders' | 'finance' | 'communication'>('info');
    const printRef = useRef<HTMLDivElement>(null);

    // Editable fields
    const [editType, setEditType] = useState('individual');
    const [editGroup, setEditGroup] = useState('standard');
    const [editCompany, setEditCompany] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editActive, setEditActive] = useState(true);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (isOpen && customer) {
            setLoading(true);
            setTab('info');
            fetch(`/api/admin/customers/${customer.id}`)
                .then(r => r.json())
                .then(data => {
                    setDetail(data);
                    setEditType(data.customerType || 'individual');
                    setEditGroup(data.customerGroup || 'standard');
                    setEditCompany(data.companyName || '');
                    setEditAddress(data.address || '');
                    setEditNotes(data.notes || '');
                    setEditActive(data.isActive ?? true);
                    setEditName(data.name || '');
                })
                .catch(e => console.error('[Drawer]', e))
                .finally(() => setLoading(false));
        }
    }, [isOpen, customer]);

    if (!isOpen || !customer) return null;

    const isGuest = customer.source === 'guest';

    const handleSave = async () => {
        if (isGuest) {
            toast.error("Mehmon mijozni tahrirlash imkoni yo'q");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/customers/${customer.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName.trim(), customerType: editType, customerGroup: editGroup,
                    companyName: editCompany.trim() || null, address: editAddress.trim() || null,
                    notes: editNotes.trim() || null, isActive: editActive,
                }),
            });
            if (res.ok) { toast.success("Saqlandi ✓"); onSaved?.(); }
            else { const err = await res.json(); toast.error(err.error || "Xatolik"); }
        } catch { toast.error("Server xatoligi"); }
        finally { setSaving(false); }
    };

    // Akt Sverka chop etish
    const handlePrintSverka = () => {
        if (!printRef.current) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
            <html><head>
            <title>Akt sverka — ${detail?.name || customer.name}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; font-size: 13px; color: #333; }
                h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
                h2 { font-size: 14px; text-align: center; color: #666; margin-top: 0; }
                .info { display: flex; justify-content: space-between; margin: 20px 0; padding: 12px; background: #f9f9f9; border-radius: 8px; }
                .info div { text-align: center; }
                .info .label { font-size: 10px; color: #888; text-transform: uppercase; }
                .info .value { font-weight: bold; font-size: 15px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #f0f0f0; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #ddd; }
                td { padding: 7px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
                .debit { color: #c00; font-weight: bold; }
                .credit { color: #080; font-weight: bold; }
                .summary { margin-top: 30px; padding: 16px; border: 2px solid #333; border-radius: 8px; }
                .summary h3 { margin: 0 0 10px; }
                .sign-area { display: flex; justify-content: space-between; margin-top: 60px; }
                .sign-area div { text-align: center; width: 200px; border-top: 1px solid #333; padding-top: 8px; font-size: 12px; }
                @media print { body { margin: 20px; } }
            </style>
            </head><body>
            <h1>АКТ СВЕРКИ ВЗАИМОРАСЧЁТОВ</h1>
            <h2>Pack24 — ${detail?.name || customer.name}</h2>
            <div class="info">
                <div><div class="label">Mijoz</div><div class="value">${detail?.name || customer.name}</div></div>
                <div><div class="label">Telefon</div><div class="value">${customer.phone}</div></div>
                ${detail?.companyName ? `<div><div class="label">Kompaniya</div><div class="value">${detail.companyName}</div></div>` : ''}
                <div><div class="label">Sana</div><div class="value">${new Date().toLocaleDateString('uz-UZ')}</div></div>
            </div>
            <table>
                <thead>
                    <tr><th>Sana</th><th>Tavsif</th><th>Debit (so'm)</th><th>Kredit (so'm)</th><th>Qoldiq (so'm)</th></tr>
                </thead>
                <tbody>
                    ${(detail?.ledger || []).map((l: CustomerLedgerEntry) => `
                        <tr>
                            <td>${new Date(l.date).toLocaleDateString('uz-UZ')}</td>
                            <td>${l.description}</td>
                            <td class="debit">${l.debit > 0 ? l.debit.toLocaleString() : ''}</td>
                            <td class="credit">${l.credit > 0 ? l.credit.toLocaleString() : ''}</td>
                            <td>${l.balance.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="summary">
                <h3>YAKUNIY QOLDIQ</h3>
                <p><strong>Jami debit:</strong> ${formatMoney(detail?.financials?.totalRevenue ?? 0)}</p>
                <p><strong>Jami kredit:</strong> ${formatMoney(detail?.financials?.totalPaid ?? 0)}</p>
                <p style="font-size:16px"><strong>Qoldiq: ${formatMoney(Math.abs(detail?.currentBalance ?? 0))} ${(detail?.currentBalance ?? 0) > 0 ? '(Mijoz qarzdor)' : (detail?.currentBalance ?? 0) < 0 ? '(Biz qarzdormiz)' : '(Hisob teng)'}</strong></p>
            </div>
            <div class="sign-area">
                <div>Pack24 vakili</div>
                <div>${detail?.name || customer.name}</div>
            </div>
            </body></html>
        `);
        win.document.close();
        win.print();
    };

    const hasChanges = detail && !isGuest && (
        editType !== (detail.customerType ?? 'individual') ||
        editGroup !== (detail.customerGroup ?? 'standard') ||
        editCompany !== (detail.companyName || '') ||
        editAddress !== (detail.address || '') ||
        editNotes !== (detail.notes || '') ||
        editActive !== detail.isActive ||
        editName !== detail.name
    );

    const fin = detail?.financials;

    return (
        <>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={onClose} />

            <div className="fixed inset-y-0 right-0 w-full sm:w-[560px] bg-white shadow-2xl z-50 border-l border-gray-100 flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-lg ${
                                isGuest ? 'bg-gray-400' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                            }`}>
                                {(detail?.name || customer.name)?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-extrabold text-gray-900">{detail?.name || customer.name}</h2>
                                    {isGuest && <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">Mehmon</span>}
                                </div>
                                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wide mt-0.5">Customer 360</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} />{customer.phone}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl" aria-label="Yopish"><X size={18} className="text-gray-500" /></button>
                    </div>

                    {/* Financial stats */}
                    {fin && (
                        <div className="grid grid-cols-4 gap-2 mt-4">
                            <div className="bg-white rounded-xl border border-gray-100 p-2.5 text-center">
                                <p className="text-sm font-extrabold text-gray-900">{fin.totalOrders}</p>
                                <p className="text-[9px] text-gray-400">Buyurtmalar</p>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-100 p-2.5 text-center">
                                <p className="text-sm font-extrabold text-blue-600">{(fin.totalRevenue / 1000000).toFixed(1)}M</p>
                                <p className="text-[9px] text-gray-400">Jami</p>
                            </div>
                            <div className="bg-white rounded-xl border border-emerald-100 p-2.5 text-center">
                                <p className="text-sm font-extrabold text-emerald-600">{(fin.totalPaid / 1000000).toFixed(1)}M</p>
                                <p className="text-[9px] text-gray-400">To&apos;langan</p>
                            </div>
                            <div className={`rounded-xl border p-2.5 text-center ${fin.totalDebit > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                                <p className={`text-sm font-extrabold ${fin.totalDebit > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                    {fin.totalDebit > 0 ? (fin.totalDebit / 1000000).toFixed(1) + 'M' : '0'}
                                </p>
                                <p className="text-[9px] text-gray-400">Qarz</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    {([
                        { key: 'info' as const, label: '📋 Profil' },
                        { key: 'orders' as const, label: `🛒 Buyurtmalar (${detail?.orders?.length ?? 0})` },
                        { key: 'finance' as const, label: '💰 Moliya' },
                        { key: 'communication' as const, label: '🤝 Aloqa' },
                    ]).map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex-1 py-3 text-[11px] font-bold transition-colors ${
                                tab === t.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >{t.label}</button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
                    ) : tab === 'info' ? (
                        /* ─── Profil tab ──────────────────────────────────────── */
                        <>
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                                <h3 className="text-sm font-extrabold text-gray-900">Customer 360 profili</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Identitet, segment, kompaniya, manzil, status va xodim eslatmalari shu profil orqali boshqariladi.
                                </p>
                            </div>
                            {isGuest && (
                                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                                    <p className="text-sm font-bold text-amber-800">Mehmon mijoz</p>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Tahrirlash yopiq: mehmonni ro&apos;yxatdan o&apos;tkazish yoki buyurtmalarni user bilan link qilish keyingi CRM bosqichiga qoldirilgan.
                                    </p>
                                </div>
                            )}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Ism</label>
                                <input value={editName} onChange={e => setEditName(e.target.value)} disabled={isGuest}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 disabled:bg-gray-50" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Mijoz turi</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {TYPE_OPTIONS.map(opt => (
                                        <button key={opt.value} onClick={() => !isGuest && setEditType(opt.value)} disabled={isGuest}
                                            className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 ${
                                                editType === opt.value ? `${opt.color} ring-2 ring-offset-1 ring-blue-300` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}>{opt.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Guruh</label>
                                <div className="flex flex-wrap gap-2">
                                    {GROUP_OPTIONS.map(opt => (
                                        <button key={opt.value} onClick={() => !isGuest && setEditGroup(opt.value)} disabled={isGuest}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 ${
                                                editGroup === opt.value ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}>
                                            <span className={`w-2 h-2 rounded-full ${opt.dot}`} />{opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {(editType === 'corporate' || editType === 'wholesale' || editType === 'dealer') && (
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5"><Building2 size={10} className="inline mr-1" />Kompaniya nomi</label>
                                    <input value={editCompany} onChange={e => setEditCompany(e.target.value)} disabled={isGuest}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 disabled:bg-gray-50" placeholder="Kompaniya..." />
                                </div>
                            )}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5"><MapPin size={10} className="inline mr-1" />Manzil</label>
                                <input value={editAddress} onChange={e => setEditAddress(e.target.value)} disabled={isGuest}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 disabled:bg-gray-50" placeholder="Manzil..." />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5"><FileText size={10} className="inline mr-1" />Eslatmalar</label>
                                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} disabled={isGuest}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm h-20 resize-none focus:outline-none focus:border-blue-400 disabled:bg-gray-50" placeholder="Muhim eslatma..." />
                            </div>
                            {!isGuest && (
                                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 border">
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">Holat</p>
                                        <p className="text-xs text-gray-400">{editActive ? '✅ Faol' : '🚫 Bloklangan'}</p>
                                    </div>
                                    <button onClick={() => setEditActive(!editActive)}
                                        className={`relative w-12 h-7 rounded-full transition-colors ${editActive ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                        <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${editActive ? 'left-[22px]' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            )}
                        </>
                    ) : tab === 'orders' ? (
                        /* ─── Buyurtmalar tab ─────────────────────────────────── */
                        <div className="space-y-3">
                            {!detail?.orders?.length ? (
                                <div className="text-center py-12"><ShoppingCart size={36} className="mx-auto text-gray-200 mb-3" /><p className="text-sm text-gray-400">Buyurtmalar yo&apos;q</p></div>
                            ) : detail.orders.map((o: CustomerOrder) => {
                                const s = ORDER_STATUS[o.status] ?? ORDER_STATUS.new;
                                const items = o.items ?? [];
                                return (
                                    <div key={o.id} className="bg-white rounded-xl border border-gray-100 p-3.5 hover:border-blue-200 transition-all">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-gray-800 text-sm">#{o.id}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    o.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                                }`}>{o.paymentStatus === 'paid' ? "To'langan" : "To'lanmagan"}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                                            <span className="flex items-center gap-1"><Calendar size={10} />{new Date(o.createdAt).toLocaleDateString('uz-UZ')}</span>
                                            <span className="font-bold text-gray-900">{formatMoney(o.totalAmount ?? 0)}</span>
                                        </div>
                                        {items.length > 0 && (
                                            <p className="text-[10px] text-gray-400 truncate">{items.map((i: CustomerOrderItem) => i.product?.name).filter(Boolean).join(', ')}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : tab === 'finance' ? (
                        /* ─── Hisob-kitob (Debitor/Kreditor + Akt Sverka) ─────── */
                        <div className="space-y-4" ref={printRef}>
                            {/* Balance card */}
                            <div className={`rounded-2xl p-5 border-2 ${
                                (detail?.currentBalance ?? 0) > 0
                                    ? 'bg-red-50 border-red-300'
                                    : (detail?.currentBalance ?? 0) < 0
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'bg-emerald-50 border-emerald-300'
                            }`}>
                                <p className="text-xs font-bold text-gray-600 uppercase mb-1">Joriy qoldiq</p>
                                <p className={`text-3xl font-extrabold ${
                                    (detail?.currentBalance ?? 0) > 0 ? 'text-red-600' : (detail?.currentBalance ?? 0) < 0 ? 'text-blue-600' : 'text-emerald-600'
                                }`}>
                                    {formatMoney(Math.abs(detail?.currentBalance ?? 0))}
                                </p>
                                <p className="text-xs font-bold mt-1">
                                    {(detail?.currentBalance ?? 0) > 0
                                        ? '⚠️ Mijoz qarzdor (Debitor)'
                                        : (detail?.currentBalance ?? 0) < 0
                                        ? '📌 Biz qarzdormiz (Kreditor)'
                                        : '✅ Hisob teng (Nol)'}
                                </p>
                            </div>

                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white rounded-xl border p-3 text-center">
                                    <ArrowUpRight size={16} className="mx-auto text-red-500 mb-1" />
                                    <p className="text-sm font-extrabold text-gray-900">{formatMoney(fin?.totalRevenue ?? 0)}</p>
                                    <p className="text-[9px] text-gray-400">Jami debit</p>
                                </div>
                                <div className="bg-white rounded-xl border p-3 text-center">
                                    <ArrowDownLeft size={16} className="mx-auto text-emerald-500 mb-1" />
                                    <p className="text-sm font-extrabold text-gray-900">{formatMoney(fin?.totalPaid ?? 0)}</p>
                                    <p className="text-[9px] text-gray-400">Jami kredit</p>
                                </div>
                                <div className="bg-white rounded-xl border p-3 text-center">
                                    <ShoppingCart size={16} className="mx-auto text-blue-500 mb-1" />
                                    <p className="text-sm font-extrabold text-gray-900">{fin?.deliveredCount ?? 0}/{fin?.totalOrders ?? 0}</p>
                                    <p className="text-[9px] text-gray-400">Yetkazilgan</p>
                                </div>
                            </div>

                            {/* Akt sverka button */}
                            <button
                                onClick={handlePrintSverka}
                                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold py-3 rounded-xl text-sm hover:bg-gray-800 transition-colors"
                            >
                                <Printer size={16} />
                                Akt Sverka chop etish
                            </button>

                            {/* Ledger table */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-600 uppercase mb-3">📒 Operatsiyalar jurnali</h3>
                                <div className="space-y-2">
                                    {(detail?.ledger || []).map((entry: CustomerLedgerEntry, idx: number) => (
                                        <div key={idx} className={`rounded-xl border p-3 text-xs ${
                                            entry.debit > 0 ? 'border-red-100 bg-red-50/30' :
                                            entry.credit > 0 ? 'border-emerald-100 bg-emerald-50/30' :
                                            'border-gray-100 bg-gray-50/30'
                                        }`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-gray-500">{new Date(entry.date).toLocaleDateString('uz-UZ')}</span>
                                                <span className="font-bold">
                                                    {entry.debit > 0 && <span className="text-red-600">+{entry.debit.toLocaleString()}</span>}
                                                    {entry.credit > 0 && <span className="text-emerald-600">-{entry.credit.toLocaleString()}</span>}
                                                </span>
                                            </div>
                                            <p className="text-gray-700 font-medium truncate">{entry.description}</p>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                                    ORDER_STATUS[entry.status]?.bg ?? 'bg-gray-50'
                                                } ${ORDER_STATUS[entry.status]?.text ?? 'text-gray-500'}`}>
                                                    {ORDER_STATUS[entry.status]?.label ?? entry.status}
                                                </span>
                                                <span className="text-gray-500 font-mono text-[10px]">Qoldiq: {entry.balance.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {(!detail?.ledger || detail.ledger.length === 0) && (
                                        <div className="text-center py-8"><DollarSign size={32} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">Operatsiyalar yo&apos;q</p></div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ─── Aloqa tab ───────────────────────────────────────── */
                        <div className="space-y-4">
                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                                <h3 className="text-sm font-extrabold text-gray-900">Hamkorlik CRM aloqa markazi</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Bu MVPda aloqa kanallari mavjud admin bo&apos;limlariga ulanadi. Real timeline va xodim izohlari keyingi bosqichda DB modeli bilan qo&apos;shiladi.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white rounded-xl border border-gray-100 p-3">
                                    <Phone size={16} className="text-blue-500 mb-2" />
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Telefon</p>
                                    <p className="text-sm font-extrabold text-gray-900">{customer.phone}</p>
                                </div>
                                <div className="bg-white rounded-xl border border-gray-100 p-3">
                                    <Bot size={16} className={detail?.telegramId ? 'text-emerald-500 mb-2' : 'text-gray-300 mb-2'} />
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Telegram</p>
                                    <p className="text-sm font-extrabold text-gray-900">{detail?.telegramId ? 'Ulangan' : 'Aniqlanmagan'}</p>
                                </div>
                                <div className="bg-white rounded-xl border border-gray-100 p-3">
                                    <UserCheck size={16} className={detail?.isActive ? 'text-emerald-500 mb-2' : 'text-red-500 mb-2'} />
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">CRM status</p>
                                    <p className="text-sm font-extrabold text-gray-900">{detail?.isActive ? 'Faol' : 'Bloklangan'}</p>
                                </div>
                                <div className="bg-white rounded-xl border border-gray-100 p-3">
                                    <ShoppingCart size={16} className="text-purple-500 mb-2" />
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Faol buyurtma</p>
                                    <p className="text-sm font-extrabold text-gray-900">{fin?.activeCount ?? 0}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Link href="/admin/customers/calls" className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:border-emerald-200 transition-colors">
                                    <Headphones size={17} className="text-emerald-600" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-900">Call Center</p>
                                        <p className="text-xs text-gray-400">Telefon muloqotlarini ko&apos;rish</p>
                                    </div>
                                    <span className="text-xs text-gray-300">→</span>
                                </Link>
                                <Link href={`/admin/chat?customer=${encodeURIComponent(customer.phone)}`} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:border-emerald-200 transition-colors">
                                    <MessageSquare size={17} className="text-blue-600" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-900">Chat</p>
                                        <p className="text-xs text-gray-400">Mijoz aloqa kanaliga o&apos;tish</p>
                                    </div>
                                    <span className="text-xs text-gray-300">→</span>
                                </Link>
                            </div>

                            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-4">
                                <p className="text-xs font-bold text-gray-500 uppercase">Keyingi aloqa eslatmasi</p>
                                <p className="text-sm text-gray-500 mt-2">
                                    Doimiy timeline hali yo&apos;q. Hozircha muhim qaydlar `Profil` tabidagi eslatmalar maydonida saqlanadi.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {tab === 'info' && !isGuest && (
                    <div className="p-4 border-t border-gray-100 bg-white">
                        <button onClick={handleSave} disabled={saving || !hasChanges}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Saqlanmoqda...' : hasChanges ? "O'zgarishlarni saqlash" : "O'zgarish yo'q"}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
