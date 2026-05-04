'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Phone, Truck, MapPin, User, Copy, ShieldCheck } from 'lucide-react';

interface Driver { id: number; name: string; phone: string; telegramId: string | null; telegramName: string | null; registrationCode: string | null; supervisorId: number | null; supervisor: { id: number; name: string } | null; pointId: number | null; point: { id: number; regionUz: string } | null; status: string; isOnline: boolean; vehicleInfo: string | null; isSupervisor?: boolean; _count?: { collections: number; assignedRequests: number }; }
interface Supervisor { id: number; name: string; }
interface Point { id: number; regionUz: string; }

const STATUS_MAP: Record<string, { label: string; color: string }> = { active: { label: 'Faol', color: 'bg-emerald-100 text-emerald-700' }, inactive: { label: 'Faol emas', color: 'bg-gray-100 text-gray-600' }, on_route: { label: 'Yo\'lda', color: 'bg-blue-100 text-blue-700' }, busy: { label: 'Band', color: 'bg-amber-100 text-amber-700' } };
const EMPTY = { name: '', phone: '', telegramId: '', supervisorId: '', pointId: '', vehicleInfo: '', status: 'active' };

export default function DriversTab({
    points,
    supervisors,
    selectedDriverId,
}: {
    points: Point[];
    supervisors: Supervisor[];
    selectedDriverId?: number | null;
}) {
    const [items, setItems] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(EMPTY);
    const [editId, setEditId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [promoting, setPromoting] = useState<number | null>(null);

    const fetch_ = useCallback(async () => {
        setLoading(true);
        try { const r = await fetch('/api/admin/recycling/drivers'); if (r.ok) setItems(await r.json()); }
        catch { toast.error('Yuklashda xato'); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { fetch_(); }, [fetch_]);

    const save = async () => {
        if (!form.name.trim() || !form.phone.trim()) { toast.error('Ism va telefon majburiy'); return; }
        setSaving(true);
        try {
            const url = editId ? `/api/admin/recycling/drivers/${editId}` : '/api/admin/recycling/drivers';
            const payload = { ...form, supervisorId: form.supervisorId ? Number(form.supervisorId) : null, pointId: form.pointId ? Number(form.pointId) : null };
            const r = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (r.ok) { toast.success(editId ? 'Yangilandi ✓' : 'Qo\'shildi ✓'); setForm(EMPTY); setShowForm(false); setEditId(null); fetch_(); }
            else { const e = await r.json(); toast.error(e.error || 'Xatolik'); }
        } finally { setSaving(false); }
    };

    const del = async (id: number) => {
        if (!confirm('O\'chirishni tasdiqlaysizmi?')) return;
        const r = await fetch(`/api/admin/recycling/drivers/${id}`, { method: 'DELETE' });
        if (r.ok) { toast.success('O\'chirildi'); fetch_(); } else toast.error('Xatolik');
    };

    const edit = (d: Driver) => { setEditId(d.id); setForm({ name: d.name, phone: d.phone, telegramId: d.telegramId || '', supervisorId: d.supervisorId?.toString() || '', pointId: d.pointId?.toString() || '', vehicleInfo: d.vehicleInfo || '', status: d.status }); setShowForm(true); };

    const promoteDriver = async (d: Driver) => {
        if (!confirm(`"${d.name}" ni masul hodim sifatida ro'yxatga olasizmi?\n\nHaydovchi ma'lumotlari (ism, telefon, baza) Supervisor jadvaliga ko'chiriladi va admin botga kirish kodi beriladi.`)) return;
        setPromoting(d.id);
        try {
            const r = await fetch(`/api/admin/recycling/drivers/${d.id}/promote`, { method: 'POST' });
            const data = await r.json();
            if (r.ok) {
                const code = data.supervisor?.registrationCode;
                if (code) {
                    navigator.clipboard.writeText(code).catch(() => {});
                    toast.success(`✅ ${d.name} masul hodim bo'ldi! Kirish kodi: ${code} (nusxalandi)`, { duration: 8000 });
                } else {
                    toast.success(data.message || 'Masul hodim sifatida ro\'yxatga olindi');
                }
                fetch_();
            } else {
                toast.error(data.error || 'Xatolik yuz berdi');
            }
        } catch {
            toast.error('Tarmoq xatosi');
        } finally {
            setPromoting(null);
        }
    };

    const visibleItems = selectedDriverId
        ? items.filter((driver) => driver.id === selectedDriverId)
        : items;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-500">{visibleItems.length} ta haydovchi</p>
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full">🟢 {items.filter(d => d.isOnline).length} online</span>
                    {selectedDriverId && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">Filter: #{selectedDriverId}</span>
                    )}
                </div>
                <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(!showForm); }} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-sm"><Plus size={14} /> Yangi haydovchi</button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <p className="font-bold text-gray-800 text-sm">{editId ? 'Haydovchi tahrirlash' : 'Yangi haydovchi'}</p>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ism *" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Telefon *" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        <input value={form.telegramId} onChange={e => setForm({ ...form, telegramId: e.target.value })} placeholder="Telegram ID (masalan: 123456789)" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        <select value={form.supervisorId} onChange={e => setForm({ ...form, supervisorId: e.target.value })} title="Masul tanlash" className="border border-gray-200 rounded-xl px-3 py-2 text-sm"><option value="">Masul tanlang</option>{supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                        <select value={form.pointId} onChange={e => setForm({ ...form, pointId: e.target.value })} title="Baza tanlash" className="border border-gray-200 rounded-xl px-3 py-2 text-sm"><option value="">Baza tanlang</option>{points.map(p => <option key={p.id} value={p.id}>{p.regionUz}</option>)}</select>
                        <input value={form.vehicleInfo} onChange={e => setForm({ ...form, vehicleInfo: e.target.value })} placeholder="Mashina (masalan: Damas)" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                    <p className="text-[10px] text-gray-400">💡 Telegram ID ni topish: Haydovchi @userinfobot ga /start yozsin → ID raqami chiqadi. Yoki Pack24 botga /start yozsa avtomatik ulanadi.</p>
                    <div className="flex gap-2">
                        <button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50">{saving ? '...' : editId ? 'Yangilash' : 'Saqlash'}</button>
                        <button onClick={() => { setShowForm(false); setEditId(null); }} className="bg-gray-100 text-gray-600 font-bold px-4 py-2 rounded-xl text-sm">Bekor</button>
                    </div>
                </div>
            )}

            {loading ? <div className="text-center py-10 text-gray-400">Yuklanmoqda...</div> : visibleItems.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center"><Truck size={40} className="mx-auto text-gray-200 mb-3" /><p className="text-gray-400">Haydovchilar yo&apos;q</p></div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Haydovchi</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase hidden md:table-cell">Masul</th>
                                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">Telegram</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase hidden lg:table-cell">Baza</th>
                                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">Yig'ishlar</th>
                                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase hidden md:table-cell">Lavozim</th>
                                <th className="px-4 py-3 w-24"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {visibleItems.map(d => { const st = STATUS_MAP[d.status] || STATUS_MAP.active; return (
                                <tr key={d.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="relative"><div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">{d.name.charAt(0)}</div>{d.isOnline && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />}</div><div><p className="text-sm font-bold text-gray-800">{d.name}</p><p className="text-[10px] text-gray-400 flex items-center gap-0.5"><Phone size={9} />{d.phone}</p></div></div></td>
                                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                                    <td className="px-4 py-3 hidden md:table-cell">{d.supervisor ? <span className="text-xs text-gray-600 flex items-center gap-1"><User size={11} />{d.supervisor.name}</span> : <span className="text-xs text-gray-300">—</span>}</td>
                                    <td className="px-4 py-3 text-center">{d.telegramId ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">🟢 Ulangan</span> : d.registrationCode ? <button onClick={() => { navigator.clipboard.writeText(d.registrationCode!); toast.success('Kod nusxalandi: ' + d.registrationCode); }} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer inline-flex items-center gap-1" title="Nusxalash"><Copy size={9} />{d.registrationCode}</button> : <span className="text-[10px] text-gray-300">—</span>}</td>
                                    <td className="px-4 py-3 hidden lg:table-cell">{d.point ? <span className="text-xs text-emerald-600 flex items-center gap-1"><MapPin size={11} />{d.point.regionUz}</span> : <span className="text-xs text-gray-300">—</span>}</td>
                                    <td className="px-4 py-3 text-center"><span className="text-sm font-bold text-gray-700">{d._count?.collections ?? 0}</span></td>
                                    <td className="px-4 py-3 text-center hidden md:table-cell">
                                        {d.isSupervisor
                                            ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700"><ShieldCheck size={10} />Masul</span>
                                            : <span className="text-[10px] text-gray-300">Haydovchi</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            {!d.isSupervisor && (
                                                <button
                                                    onClick={() => promoteDriver(d)}
                                                    disabled={promoting === d.id}
                                                    title="Masul hodim sifatida ro'yxatga olish"
                                                    className="p-1.5 rounded-lg hover:bg-purple-50 disabled:opacity-40"
                                                >
                                                    <ShieldCheck size={13} className="text-purple-400" />
                                                </button>
                                            )}
                                            <button onClick={() => edit(d)} title="Tahrirlash" className="p-1.5 rounded-lg hover:bg-gray-100"><Pencil size={13} className="text-gray-400" /></button>
                                            <button onClick={() => del(d.id)} title="O'chirish" className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={13} className="text-red-400" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ); })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
