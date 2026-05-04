'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Phone, MapPin, Users, Copy } from 'lucide-react';

interface Supervisor { id: number; name: string; phone: string; telegramId: string | null; telegramName: string | null; registrationCode: string | null; pointId: number | null; point: { id: number; regionUz: string } | null; isActive: boolean; _count?: { drivers: number; requests: number }; }
interface Point { id: number; regionUz: string; }

const EMPTY = { name: '', phone: '', telegramId: '', pointId: '' };

export default function SupervisorsTab({
    points,
    selectedSupervisorId,
}: {
    points: Point[];
    selectedSupervisorId?: number | null;
}) {
    const [items, setItems] = useState<Supervisor[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(EMPTY);
    const [editId, setEditId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetch_ = useCallback(async () => {
        setLoading(true);
        try { const r = await fetch('/api/admin/recycling/supervisors'); if (r.ok) setItems(await r.json()); }
        catch { toast.error('Yuklashda xato'); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { fetch_(); }, [fetch_]);

    const save = async () => {
        if (!form.name.trim() || !form.phone.trim()) { toast.error('Ism va telefon majburiy'); return; }
        setSaving(true);
        try {
            const url = editId ? `/api/admin/recycling/supervisors/${editId}` : '/api/admin/recycling/supervisors';
            const r = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, pointId: form.pointId ? Number(form.pointId) : null }) });
            if (r.ok) { toast.success(editId ? 'Yangilandi ✓' : 'Qo\'shildi ✓'); setForm(EMPTY); setShowForm(false); setEditId(null); fetch_(); }
            else { const e = await r.json(); toast.error(e.error || 'Xatolik'); }
        } finally { setSaving(false); }
    };

    const del = async (id: number) => {
        if (!confirm('O\'chirishni tasdiqlaysizmi?')) return;
        const r = await fetch(`/api/admin/recycling/supervisors/${id}`, { method: 'DELETE' });
        if (r.ok) { toast.success('O\'chirildi'); fetch_(); } else toast.error('Xatolik');
    };

    const edit = (s: Supervisor) => { setEditId(s.id); setForm({ name: s.name, phone: s.phone, telegramId: s.telegramId || '', pointId: s.pointId?.toString() || '' }); setShowForm(true); };

    const visibleItems = selectedSupervisorId
        ? items.filter((supervisor) => supervisor.id === selectedSupervisorId)
        : items;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-500">{visibleItems.length} ta masul shaxs</p>
                    {selectedSupervisorId && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">Filter: #{selectedSupervisorId}</span>
                    )}
                </div>
                <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(!showForm); }} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-sm"><Plus size={14} /> Yangi masul</button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <p className="font-bold text-gray-800 text-sm">{editId ? 'Masul tahrirlash' : 'Yangi masul shaxs'}</p>
                    <div className="grid grid-cols-2 gap-3">
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ism *" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Telefon *" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        <input value={form.telegramId} onChange={e => setForm({ ...form, telegramId: e.target.value })} placeholder="Telegram ID (masalan: 123456789)" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        <select value={form.pointId} onChange={e => setForm({ ...form, pointId: e.target.value })} title="Baza tanlash" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                            <option value="">Baza tanlang</option>
                            {points.map(p => <option key={p.id} value={p.id}>{p.regionUz}</option>)}
                        </select>
                    </div>
                    <p className="text-[10px] text-gray-400">💡 Telegram ID ni topish: Masul shaxs @userinfobot ga /start yozsin → ID raqami chiqadi. Yoki botga /start yozsa avtomatik ulanadi.</p>
                    <div className="flex gap-2">
                        <button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50">{saving ? 'Saqlanmoqda...' : editId ? 'Yangilash' : 'Saqlash'}</button>
                        <button onClick={() => { setShowForm(false); setEditId(null); }} className="bg-gray-100 text-gray-600 font-bold px-4 py-2 rounded-xl text-sm">Bekor</button>
                    </div>
                </div>
            )}

            {loading ? <div className="text-center py-10 text-gray-400">Yuklanmoqda...</div> : visibleItems.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center"><Users size={40} className="mx-auto text-gray-200 mb-3" /><p className="text-gray-400">Masul shaxslar yo&apos;q</p></div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Masul</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Aloqa</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Baza</th>
                                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">Telegram</th>
                                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">Haydovchilar</th>
                                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">Arizalar</th>
                                <th className="px-4 py-3 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {visibleItems.map(s => (
                                <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${s.isActive ? 'bg-blue-500' : 'bg-gray-400'}`}>{s.name.charAt(0)}</div><div><p className="text-sm font-bold text-gray-800">{s.name}</p>{s.telegramName && <p className="text-[10px] text-gray-400">@{s.telegramName}</p>}</div></div></td>
                                    <td className="px-4 py-3"><span className="text-xs text-gray-600 flex items-center gap-1"><Phone size={11} />{s.phone}</span></td>
                                    <td className="px-4 py-3">{s.point ? <span className="text-xs text-emerald-600 flex items-center gap-1"><MapPin size={11} />{s.point.regionUz}</span> : <span className="text-xs text-gray-300">—</span>}</td>
                                    <td className="px-4 py-3 text-center">{s.telegramId ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">🟢 Ulangan</span> : s.registrationCode ? <button onClick={() => { navigator.clipboard.writeText(s.registrationCode!); toast.success('Kod nusxalandi: ' + s.registrationCode); }} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer inline-flex items-center gap-1" title="Nusxalash"><Copy size={9} />{s.registrationCode}</button> : <span className="text-[10px] text-gray-300">—</span>}</td>
                                    <td className="px-4 py-3 text-center"><span className="text-sm font-bold text-gray-700">{s._count?.drivers ?? 0}</span></td>
                                    <td className="px-4 py-3 text-center"><span className="text-sm font-bold text-gray-700">{s._count?.requests ?? 0}</span></td>
                                    <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => edit(s)} title="Tahrirlash" className="p-1.5 rounded-lg hover:bg-gray-100"><Pencil size={13} className="text-gray-400" /></button><button onClick={() => del(s.id)} title="O'chirish" className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={13} className="text-red-400" /></button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
