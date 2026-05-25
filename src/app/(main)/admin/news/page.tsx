'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Newspaper } from 'lucide-react';

interface NewsItem {
    id: number;
    titleUz: string;
    titleRu: string;
    descUz: string;
    descRu: string;
    emoji: string;
    badge: string;
    publishedAt: string;
}

const EMOJIS = ['📦', '🎉', '🚀', '💡', '🏭', '♻️', '🎁', '🛡️', '📊', '🌿', '💰', '🔥'];
const BADGES_PRESET = ['Yangilik', 'E\'lon', 'Sovg\'a', 'Aksiya', 'Muhim', 'Новость', 'Акция', 'Важно'];

const EMPTY_FORM = { titleUz: '', titleRu: '', descUz: '', descRu: '', emoji: '📦', badge: 'Yangilik' };

export default function AdminNewsPage() {
    const [news, setNews]           = useState<NewsItem[]>([]);
    const [loading, setLoading]     = useState(true);
    const [showForm, setShowForm]   = useState(false);
    const [editing, setEditing]     = useState<number | null>(null);
    const [form, setForm]           = useState(EMPTY_FORM);
    const [saving, setSaving]       = useState(false);
    const [deleting, setDeleting]   = useState<number | null>(null);

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchNews = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/news?limit=50');
            if (res.ok) {
                const data = await res.json();
                setNews(data.news ?? []);
            }
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { fetchNews(); }, []);

    // ── Submit (Create / Update) ──────────────────────────────────────────
    const handleSubmit = async () => {
        if (!form.titleRu.trim()) { toast.error('Sarlavha (RU) majburiy!'); return; }
        setSaving(true);
        try {
            const method = editing ? 'PUT' : 'POST';
            const url    = editing ? `/api/news/${editing}` : '/api/news';
            const res    = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                toast.success(editing ? 'Yangilik yangilandi ✓' : 'Yangilik qo\'shildi ✓');
                setForm(EMPTY_FORM); setShowForm(false); setEditing(null);
                fetchNews();
            } else {
                toast.error('Xatolik yuz berdi');
            }
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ────────────────────────────────────────────────────────────
    const handleDelete = async (id: number) => {
        if (!confirm('Bu yangilikni o\'chirishni tasdiqlaysizmi?')) return;
        setDeleting(id);
        try {
            const res = await fetch(`/api/news/${id}`, { method: 'DELETE' });
            if (res.ok) { toast.success('O\'chirildi'); fetchNews(); }
            else toast.error('Xatolik');
        } finally {
            setDeleting(null);
        }
    };

    // ── Edit init ──────────────────────────────────────────────────────────
    const startEdit = (item: NewsItem) => {
        setEditing(item.id);
        setForm({ titleUz: item.titleUz, titleRu: item.titleRu, descUz: item.descUz, descRu: item.descRu, emoji: item.emoji, badge: item.badge });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
                        <Newspaper className="text-blue-600" size={24} /> Yangiliklar
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">{news.length} ta yangilik</p>
                </div>
                <button
                    onClick={() => { setShowForm(!showForm); setEditing(null); setForm(EMPTY_FORM); }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors"
                >
                    <Plus size={16} /> Yangi qo&apos;shish
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-5">
                        {editing ? 'Yangilikni tahrirlash' : 'Yangi yangilik'}
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Emoji picker */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Emoji</label>
                            <div className="flex flex-wrap gap-2">
                                {EMOJIS.map(e => (
                                    <button
                                        key={e}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, emoji: e }))}
                                        className={`w-10 h-10 rounded-xl text-xl transition-all ${form.emoji === e ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-50 hover:bg-gray-100'}`}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Badge */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Badge</label>
                            <select
                                value={form.badge}
                                onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}
                                title="Badge tanlash"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                            >
                                {BADGES_PRESET.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        {/* Titles */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sarlavha (UZ)</label>
                            <input
                                value={form.titleUz}
                                onChange={e => setForm(f => ({ ...f, titleUz: e.target.value }))}
                                placeholder="O'zbekcha sarlavha"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sarlavha (RU) *</label>
                            <input
                                value={form.titleRu}
                                onChange={e => setForm(f => ({ ...f, titleRu: e.target.value }))}
                                placeholder="Русский заголовок"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                            />
                        </div>

                        {/* Descriptions */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tavsif (UZ)</label>
                            <textarea
                                value={form.descUz}
                                onChange={e => setForm(f => ({ ...f, descUz: e.target.value }))}
                                placeholder="O'zbekcha tavsif..."
                                rows={3}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tavsif (RU)</label>
                            <textarea
                                value={form.descRu}
                                onChange={e => setForm(f => ({ ...f, descRu: e.target.value }))}
                                placeholder="Описание на русском..."
                                rows={3}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none"
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    {form.titleRu && (
                        <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">Preview</p>
                            <div className="flex items-start gap-3">
                                <span className="text-3xl">{form.emoji}</span>
                                <div>
                                    <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">{form.badge}</span>
                                    <p className="font-bold text-gray-900 text-sm mt-1">{form.titleRu || form.titleUz}</p>
                                    {form.descRu && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{form.descRu}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 mt-5">
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
                        >
                            {saving ? 'Saqlanmoqda...' : editing ? 'Saqlash' : "Qo'shish"}
                        </button>
                        <button
                            onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); }}
                            className="border border-gray-200 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                        >
                            Bekor qilish
                        </button>
                    </div>
                </div>
            )}

            {/* News list */}
            {loading ? (
                <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
                </div>
            ) : news.length === 0 ? (
                <div className="text-center py-20">
                    <Newspaper size={40} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400 font-medium">Yangiliklar yo&apos;q</p>
                    <button onClick={() => setShowForm(true)} className="text-blue-600 text-sm font-semibold mt-2 hover:underline">
                        Birinchi yangilikni qo&apos;shing →
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {news.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-4 hover:shadow-sm transition-shadow">
                            <span className="text-3xl shrink-0">{item.emoji}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{item.badge}</span>
                                    <span className="text-[10px] text-gray-400">{new Date(item.publishedAt).toLocaleDateString('ru-RU')}</span>
                                </div>
                                <p className="font-bold text-gray-900 text-sm">{item.titleRu}</p>
                                {item.titleUz && item.titleUz !== item.titleRu && (
                                    <p className="text-xs text-gray-400">{item.titleUz}</p>
                                )}
                                {item.descRu && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.descRu}</p>}
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={() => startEdit(item)}
                                    aria-label="Tahrirlash"
                                    className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-xl transition-colors"
                                >
                                    <Pencil size={15} />
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    disabled={deleting === item.id}
                                    aria-label="O'chirish"
                                    className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition-colors disabled:opacity-40"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
