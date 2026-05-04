'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, MessageCircle, CheckCircle, Clock } from 'lucide-react';

interface Complaint { id: number; requestId: number; fromPhone: string; fromName: string; level: string; message: string; status: string; response: string | null; respondedBy: string | null; resolvedAt: string | null; request: { name: string; phone: string; point: { regionUz: string } | null; assignedDriver: { name: string } | null }; createdAt: string; }

const STATUS_MAP: Record<string, { label: string; icon: React.FC<{ size?: number; className?: string }>; color: string }> = { open: { label: 'Ochiq', icon: AlertTriangle, color: 'bg-red-100 text-red-700' }, in_progress: { label: 'Ko\'rib chiqilmoqda', icon: Clock, color: 'bg-amber-100 text-amber-700' }, resolved: { label: 'Hal qilindi', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' }, closed: { label: 'Yopildi', icon: CheckCircle, color: 'bg-gray-100 text-gray-600' } };

export default function ComplaintsTab({ highlightRequestId = null }: { highlightRequestId?: number | null }) {
    const [items, setItems] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [respondId, setRespondId] = useState<number | null>(null);
    const [responseText, setResponseText] = useState('');
    const [respondedBy, setRespondedBy] = useState('');

    const displayItems = useMemo(() => {
        if (highlightRequestId == null) return items;
        const first = items.filter(c => c.requestId === highlightRequestId);
        const rest = items.filter(c => c.requestId !== highlightRequestId);
        return [...first, ...rest];
    }, [items, highlightRequestId]);

    const fetch_ = useCallback(async () => {
        setLoading(true);
        try { const r = await fetch('/api/admin/recycling/complaints'); if (r.ok) setItems(await r.json()); }
        catch { toast.error('Yuklashda xato'); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { fetch_(); }, [fetch_]);

    const respond = async (id: number, status: string) => {
        const r = await fetch('/api/admin/recycling/complaints', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status, response: responseText, respondedBy }),
        });
        if (r.ok) { toast.success('Javob yuborildi ✅'); setRespondId(null); setResponseText(''); fetch_(); }
        else toast.error('Xatolik');
    };

    if (loading) return <div className="text-center py-10 text-gray-400">Yuklanmoqda...</div>;

    const openCount = items.filter(c => c.status === 'open').length;
    const directorCount = items.filter(c => c.level === 'director' && c.status === 'open').length;

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                    <p className="text-3xl font-black text-red-600">{openCount}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Ochiq shikoyatlar</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                    <p className="text-3xl font-black text-orange-600">{directorCount}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Direktor darajasi</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                    <p className="text-3xl font-black text-emerald-600">{items.filter(c => c.status === 'resolved').length}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Hal qilindi</p>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center"><MessageCircle size={40} className="mx-auto text-gray-200 mb-3" /><p className="text-gray-400">Shikoyatlar yo&apos;q ✨</p></div>
            ) : (
                <div className="space-y-3">
                    {displayItems.map(c => { const st = STATUS_MAP[c.status] || STATUS_MAP.open; const StIcon = st.icon; return (
                        <div key={c.id} className={`bg-white rounded-2xl border p-5 transition-all ${c.status === 'open' ? 'border-red-200 shadow-sm' : 'border-gray-100'}`}>
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color} flex items-center gap-1`}><StIcon size={10} />{st.label}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.level === 'director' ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-700'}`}>{c.level === 'director' ? '🚨 Direktor' : '👷 Masul'}</span>
                                    <span className="text-[10px] text-gray-400">Ariza #{c.requestId}</span>
                                </div>
                                <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString('uz')}</span>
                            </div>

                            <div className="mb-3">
                                <p className="text-sm font-bold text-gray-800">{c.fromName} <span className="font-normal text-gray-400">({c.fromPhone})</span></p>
                                <div className="mt-2 bg-red-50 rounded-xl p-3"><p className="text-sm text-gray-700 italic">&quot;{c.message}&quot;</p></div>
                            </div>

                            {c.response && (
                                <div className="bg-emerald-50 rounded-xl p-3 mb-3">
                                    <p className="text-[10px] font-bold text-emerald-600 mb-1">Javob ({c.respondedBy || 'Admin'}):</p>
                                    <p className="text-sm text-gray-700">{c.response}</p>
                                </div>
                            )}

                            <div className="text-[10px] text-gray-400 mb-3">📍 {c.request.point?.regionUz || '—'} | 🚚 {c.request.assignedDriver?.name || '—'}</div>

                            {c.status === 'open' && (
                                respondId === c.id ? (
                                    <div className="space-y-2 border-t border-gray-100 pt-3">
                                        <textarea value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="Javob yozing..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none h-20" />
                                        <input value={respondedBy} onChange={e => setRespondedBy(e.target.value)} placeholder="Javob beruvchi ismi" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                                        <div className="flex gap-2"><button onClick={() => respond(c.id, 'resolved')} className="bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs">✅ Hal qilindi</button><button onClick={() => respond(c.id, 'in_progress')} className="bg-amber-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs">🔄 Ko&apos;rilmoqda</button><button onClick={() => setRespondId(null)} className="text-gray-500 text-xs">Bekor</button></div>
                                    </div>
                                ) : (
                                    <button onClick={() => setRespondId(c.id)} className="text-xs bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-xl">✍️ Javob berish</button>
                                )
                            )}
                        </div>
                    ); })}
                </div>
            )}
        </div>
    );
}
