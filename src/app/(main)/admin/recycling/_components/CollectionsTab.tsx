'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { DollarSign, Scale, TrendingUp, Clock, Truck, Package } from 'lucide-react';

interface Collection { id: number; requestId: number; driverId: number; actualWeight: number; discountPercent: number; effectiveWeight: number; pricePerKg: number; totalAmount: number; discountReason: string | null; materialType: string | null; customerConfirmed: boolean | null; paymentStatus: string; paymentToDriver: number | null; paymentToCustomer: number | null; paidBy: string | null; deliveredToPoint: boolean; driver: { name: string }; request: { name: string; phone: string; point: { regionUz: string } | null }; createdAt: string; }

interface FinanceData { summary: { totalCollections: number; periodCollections: number; pendingPayments: number; totalWeight: number; totalEffectiveWeight: number; totalAmount: number; totalPaidToDrivers: number; totalPaidToCustomers: number; avgDiscount: number; }; byDriver: { name: string; collections: number; totalWeight: number; totalAmount: number; paid: number }[]; byPoint: { name: string; collections: number; totalWeight: number; totalAmount: number }[]; byMaterial: { material: string; count: number; weight: number; amount: number }[]; dailyReport: { date: string; weight: number; amount: number; count: number }[]; }

const fmt = (n: number) => n.toLocaleString('ru-RU');
const PAY_STATUS: Record<string, { label: string; color: string }> = { pending: { label: 'Kutilmoqda', color: 'bg-amber-100 text-amber-700' }, paid_to_driver: { label: 'Haydovchiga', color: 'bg-blue-100 text-blue-700' }, paid_to_customer: { label: 'Mijozga', color: 'bg-emerald-100 text-emerald-700' }, paid_both: { label: 'Ikkalasiga', color: 'bg-purple-100 text-purple-700' }, completed: { label: 'Yakunlangan', color: 'bg-green-100 text-green-700' } };

export default function CollectionsTab() {
    const [finance, setFinance] = useState<FinanceData | null>(null);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const [payingId, setPayingId] = useState<number | null>(null);
    const [payForm, setPayForm] = useState({ paymentStatus: 'paid_to_customer', paymentToDriver: '', paymentToCustomer: '', paidBy: '' });
    const [collectionFilterId, setCollectionFilterId] = useState<number | null>(null);

    const fetch_ = useCallback(async () => {
        setLoading(true);
        try {
            const [fR, cR] = await Promise.all([fetch('/api/admin/recycling/finance'), fetch('/api/admin/recycling/collections')]);
            if (fR.ok) setFinance(await fR.json());
            if (cR.ok) setCollections(await cR.json());
        } catch { toast.error('Yuklashda xato'); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { fetch_(); }, [fetch_]);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const rawCollectionId = params.get('collectionId');
        const parsed = rawCollectionId ? Number(rawCollectionId) : NaN;
        setCollectionFilterId(Number.isInteger(parsed) && parsed > 0 ? parsed : null);
    }, []);

    const pay = async (id: number) => {
        const r = await fetch(`/api/admin/recycling/collections/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payForm) });
        if (r.ok) { toast.success('To\'lov amalga oshdi ✅'); setPayingId(null); fetch_(); } else toast.error('Xatolik');
    };

    const confirm = async (id: number, confirmed: boolean) => {
        const r = await fetch(`/api/admin/recycling/collections/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerConfirmed: confirmed }) });
        if (r.ok) { toast.success(confirmed ? 'Tasdiqlandi' : 'Inkor qilindi'); fetch_(); } else toast.error('Xatolik');
    };

    const filteredCollections = collectionFilterId
        ? collections.filter((collection) => collection.id === collectionFilterId)
        : collections;

    if (loading) return <div className="text-center py-10 text-gray-400">Yuklanmoqda...</div>;

    return (
        <div className="space-y-6">
            {/* KPI */}
            {finance && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Jami summa', value: `${fmt(finance.summary.totalAmount)} so'm`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Jami og\'irlik', value: `${fmt(finance.summary.totalWeight)} kg`, icon: Scale, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'O\'rt. chegirma', value: `${finance.summary.avgDiscount}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
                        { label: 'Kutilayotgan to\'lov', value: finance.summary.pendingPayments, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
                    ].map((s, i) => { const Icon = s.icon; return (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                            <div className="flex items-center gap-2 mb-3"><div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center`}><Icon size={18} className={s.color} /></div><span className="text-[10px] font-bold text-gray-400 uppercase">{s.label}</span></div>
                            <p className="text-2xl font-black text-gray-900">{s.value}</p>
                        </div>
                    ); })}
                </div>
            )}

            {/* Grafiklar */}
            {finance && finance.dailyReport.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="text-sm font-bold text-gray-500 mb-3">Kunlik yig&apos;ish (kg)</h3>
                        <ResponsiveContainer width="100%" height={200}><AreaChart data={finance.dailyReport}><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Area type="monotone" dataKey="weight" stroke="#10b981" fill="#d1fae5" /></AreaChart></ResponsiveContainer>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="text-sm font-bold text-gray-500 mb-3">Haydovchi bo&apos;yicha</h3>
                        <ResponsiveContainer width="100%" height={200}><BarChart data={finance.byDriver.slice(0, 8)}><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="totalWeight" fill="#6366f1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Yig'ishlar jadvali */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5"><Package size={15} /> Yig&apos;ishlar ({filteredCollections.length})</h3>
                        {collectionFilterId && (
                            <button
                                onClick={() => setCollectionFilterId(null)}
                                className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700"
                            >
                                Filter: #{collectionFilterId} x
                            </button>
                        )}
                    </div>
                </div>
                {filteredCollections.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">Yig&apos;ishlar yo&apos;q</div> : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50"><tr>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">#</th>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Mijoz</th>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Haydovchi</th>
                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Og&apos;irlik</th>
                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Chegirma</th>
                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500">Summa</th>
                                <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-500">Tasdiqlash</th>
                                <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-500">To&apos;lov</th>
                                <th className="px-3 py-2 w-16"></th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredCollections.map(c => { const ps = PAY_STATUS[c.paymentStatus] || PAY_STATUS.pending; return (
                                    <tr key={c.id} className="hover:bg-blue-50/30 text-sm">
                                        <td className="px-3 py-2 text-gray-400">#{c.requestId}</td>
                                        <td className="px-3 py-2 font-medium text-gray-800">{c.request.name}</td>
                                        <td className="px-3 py-2 flex items-center gap-1 text-gray-600"><Truck size={12} />{c.driver.name}</td>
                                        <td className="px-3 py-2 text-right">{c.actualWeight} kg {c.discountPercent > 0 && <span className="text-[10px] text-gray-400">→ {c.effectiveWeight.toFixed(1)}</span>}</td>
                                        <td className="px-3 py-2 text-right">{c.discountPercent > 0 ? <span className="text-amber-600">{c.discountPercent}%</span> : '—'}</td>
                                        <td className="px-3 py-2 text-right font-bold text-emerald-700">{fmt(c.totalAmount)}</td>
                                        <td className="px-3 py-2 text-center">{c.customerConfirmed === null ? <div className="flex gap-1 justify-center"><button onClick={() => confirm(c.id, true)} className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">✅</button><button onClick={() => confirm(c.id, false)} className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">❌</button></div> : c.customerConfirmed ? <span className="text-[10px] text-emerald-600">✅</span> : <span className="text-[10px] text-red-600">❌</span>}</td>
                                        <td className="px-3 py-2 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ps.color}`}>{ps.label}</span></td>
                                        <td className="px-3 py-2">{c.paymentStatus === 'pending' && <button onClick={() => { setPayingId(c.id); setPayForm({ ...payForm, paymentToCustomer: c.totalAmount.toString() }); }} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">💰</button>}</td>
                                    </tr>
                                ); })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* To'lov modal */}
            {payingId && (() => {
                const payCollection = collections.find(c => c.id === payingId);
                return (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in" onClick={() => setPayingId(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-[420px] overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-white">
                            <h3 className="font-bold text-lg">💰 To&apos;lov amalga oshirish</h3>
                            {payCollection && (
                                <div className="flex items-center gap-3 mt-2 text-emerald-100 text-xs">
                                    <span>Ariza #{payCollection.requestId}</span>
                                    <span>•</span>
                                    <span>{payCollection.request.name}</span>
                                    <span>•</span>
                                    <span className="font-bold text-white">{fmt(payCollection.totalAmount)} so&apos;m</span>
                                </div>
                            )}
                        </div>

                        <div className="p-6 space-y-4">
                            {/* To'lov turi */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">To&apos;lov turi</label>
                                <select value={payForm.paymentStatus} onChange={e => setPayForm({ ...payForm, paymentStatus: e.target.value })} title="To'lov turi" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none transition-all">
                                    <option value="paid_to_customer">💵 Mijozga to&apos;lash</option>
                                    <option value="paid_to_driver">🚚 Haydovchiga to&apos;lash</option>
                                    <option value="paid_both">👥 Ikkalasiga to&apos;lash</option>
                                </select>
                            </div>

                            {/* Summa inputlari */}
                            {(payForm.paymentStatus === 'paid_to_driver' || payForm.paymentStatus === 'paid_both') && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Haydovchiga (so&apos;m)</label>
                                    <input type="number" value={payForm.paymentToDriver} onChange={e => setPayForm({ ...payForm, paymentToDriver: e.target.value })} placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all" />
                                </div>
                            )}
                            {(payForm.paymentStatus === 'paid_to_customer' || payForm.paymentStatus === 'paid_both') && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Mijozga (so&apos;m)</label>
                                    <input type="number" value={payForm.paymentToCustomer} onChange={e => setPayForm({ ...payForm, paymentToCustomer: e.target.value })} placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none transition-all" />
                                </div>
                            )}

                            {/* Masul */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Kim to&apos;ladi</label>
                                <input value={payForm.paidBy} onChange={e => setPayForm({ ...payForm, paidBy: e.target.value })} placeholder="Masul ismi" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-gray-200 focus:border-gray-400 outline-none transition-all" />
                            </div>

                            {/* Tugmalar */}
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => pay(payingId)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">✅ Tasdiqlash</button>
                                <button onClick={() => setPayingId(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm transition-colors">Bekor</button>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}
