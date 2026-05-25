'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBannerStore, Banner, BannerGradient, BannerLocation } from '@/lib/store/useBannerStore';
import {
    Plus, Trash2, Edit, Check, Link as LinkIcon,
    ArrowUp, ArrowDown, X, Save, Eye, EyeOff, LayoutDashboard
} from 'lucide-react';

const GRADIENTS: { value: BannerGradient; label: string }[] = [
    { value: 'from-blue-600 to-indigo-700',    label: '🔵 Ko\'k - Ko\'k to\'q' },
    { value: 'from-emerald-500 to-teal-600',   label: '🟢 Yashil - Moviy' },
    { value: 'from-[#0c2340] to-[#163860]',    label: '🌑 To\'q Ko\'k (Hero)' },
    { value: 'from-purple-600 to-violet-700',  label: '🟣 Binafsha' },
    { value: 'from-orange-500 to-red-500',     label: '🟠 To\'q sariq - Qizil' },
    { value: 'from-emerald-600 to-teal-700',   label: '♻️ Yashil (Qayta ishlash)' },
    { value: 'from-rose-500 to-pink-600',      label: '🌸 Atirgul - Pushti' },
    { value: 'from-amber-500 to-orange-600',   label: '🟡 Sariq - To\'q sariq' },
];

const LOCATIONS: { value: BannerLocation; label: string }[] = [
    { value: 'hero',    label: '🏠 Bosh sahifa slider' },
    { value: 'promo',   label: '🎯 Promo (2 ta karta)' },
    { value: 'sidebar', label: '📌 Sidebar' },
];

const EMPTY_FORM = {
    title: { uz: '', ru: '' },
    subtitle: { uz: '', ru: '' },
    badge: { uz: '', ru: '' },
    highlightText: { uz: '', ru: '' },
    link: '/',
    gradient: 'from-blue-600 to-indigo-700' as BannerGradient,
    emoji: '',
    location: 'hero' as BannerLocation,
    order: 1,
    isActive: true,
};

export default function BannersPage() {
    const { banners, addBanner, updateBanner, deleteBanner, toggleActive, reorder } = useBannerStore();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [filterLoc, setFilterLoc] = useState<BannerLocation | 'all'>('all');

    const sortedBanners = [...banners]
        .sort((a, b) => a.order - b.order)
        .filter(b => filterLoc === 'all' || b.location === filterLoc);

    const openAdd = () => {
        setForm(EMPTY_FORM);
        setEditId(null);
        setShowForm(true);
    };

    const openEdit = (b: Banner) => {
        setForm({
            title: b.title,
            subtitle: b.subtitle,
            badge: b.badge ?? { uz: '', ru: '' },
            highlightText: b.highlightText ?? { uz: '', ru: '' },
            link: b.link,
            gradient: b.gradient,
            emoji: b.emoji ?? '',
            location: b.location,
            order: b.order,
            isActive: b.isActive,
        });
        setEditId(b.id);
        setShowForm(true);
    };

    const handleSave = () => {
        const payload = {
            ...form,
            badge: form.badge.uz ? form.badge : undefined,
            highlightText: form.highlightText.uz ? form.highlightText : undefined,
            emoji: form.emoji || undefined,
        };
        if (editId) {
            updateBanner(editId, payload);
        } else {
            addBanner(payload);
        }
        setShowForm(false);
        setEditId(null);
    };

    const f = (field: 'title' | 'subtitle' | 'badge' | 'highlightText', lang: 'uz' | 'ru', value: string) =>
        setForm(prev => ({ ...prev, [field]: { ...prev[field], [lang]: value } }));

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <Link href="/admin" className="hover:text-gray-700"><LayoutDashboard size={14} /></Link>
                        <span>/</span>
                        <span>Bannerlar</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Bannerlarni Boshqarish</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Bosh sahifa slideri va promo bannerlarini tahrirlang</p>
                </div>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-2 bg-[#0c2340] hover:bg-[#102a45] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
                >
                    <Plus size={16} /> Banner qo&apos;shish
                </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-5">
                {[{ value: 'all', label: 'Barchasi' }, ...LOCATIONS].map((loc) => (
                    <button
                        key={loc.value}
                        onClick={() => setFilterLoc(loc.value as BannerLocation | 'all')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                            filterLoc === loc.value
                                ? 'bg-[#0c2340] text-white shadow'
                                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                    >
                        {loc.label}
                    </button>
                ))}
            </div>

            {/* Add / Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-gray-900">{editId ? 'Bannerni tahrirlash' : "Yangi banner qo'shish"}</h2>
                            <button onClick={() => setShowForm(false)} aria-label="Yopish" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>

                        <div className="space-y-4">
                            {/* Titles */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Sarlavha (UZ)</label>
                                    <input value={form.title.uz} onChange={e => f('title', 'uz', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" placeholder="Sarlavha o'zbek tilida" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Sarlavha (RU)</label>
                                    <input value={form.title.ru} onChange={e => f('title', 'ru', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" placeholder="Заголовок на русском" />
                                </div>
                            </div>

                            {/* Subtitles */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Tavsif (UZ)</label>
                                    <textarea value={form.subtitle.uz} onChange={e => f('subtitle', 'uz', e.target.value)} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none" placeholder="Qisqa tavsif o'zbek tilida" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Tavsif (RU)</label>
                                    <textarea value={form.subtitle.ru} onChange={e => f('subtitle', 'ru', e.target.value)} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none" placeholder="Краткое описание на русском" />
                                </div>
                            </div>

                            {/* Badge */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Belgi (UZ, ixtiyoriy)</label>
                                    <input value={form.badge.uz} onChange={e => f('badge', 'uz', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" placeholder="Yangilik" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Belgi (RU, ixtiyoriy)</label>
                                    <input value={form.badge.ru} onChange={e => f('badge', 'ru', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" placeholder="Новинка" />
                                </div>
                            </div>

                            {/* Highlight text */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Ajratilgan so&apos;z (UZ)</label>
                                    <input value={form.highlightText.uz} onChange={e => f('highlightText', 'uz', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" placeholder="kolleksiya" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Ajratilgan so&apos;z (RU)</label>
                                    <input value={form.highlightText.ru} onChange={e => f('highlightText', 'ru', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" placeholder="коллекция" />
                                </div>
                            </div>

                            {/* Link, Emoji, Order */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Havola (Link)</label>
                                    <input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" placeholder="/catalog?filter=new" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Emoji</label>
                                    <input value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 text-2xl text-center" placeholder="📦" />
                                </div>
                            </div>

                            {/* Gradient */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Rang (Gradient)</label>
                                <select title="Rang tanlash" value={form.gradient} onChange={e => setForm(p => ({ ...p, gradient: e.target.value as BannerGradient }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white">
                                    {GRADIENTS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                                </select>
                                <div className={`mt-2 h-10 rounded-xl bg-gradient-to-r ${form.gradient}`} />
                            </div>

                            {/* Location & Order & Status */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Joylashuv</label>
                                    <select title="Joylashuv tanlash" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value as BannerLocation }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white">
                                        {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Tartib #</label>
                                    <input type="number" min={1} placeholder="1" aria-label="Tartib raqami" value={form.order} onChange={e => setForm(p => ({ ...p, order: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
                                </div>
                                <div className="flex flex-col justify-center gap-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Holat</label>
                                    <button
                                        type="button"
                                        onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${form.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                                    >
                                        {form.isActive ? <><Check size={14} /> Faol</> : <><EyeOff size={14} /> Nofaol</>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                            <button onClick={handleSave} className="flex items-center gap-2 bg-[#0c2340] hover:bg-[#102a45] text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
                                <Save size={15} /> Saqlash
                            </button>
                            <button onClick={() => setShowForm(false)} className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
                                <X size={15} /> Bekor
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Banner list */}
            <div className="grid gap-4">
                {sortedBanners.length === 0 && (
                    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400 text-sm">
                        Banner topilmadi. Yangi banner qo&apos;shish uchun yuqoridagi tugmani bosing.
                    </div>
                )}
                {sortedBanners.map((banner) => (
                    <div key={banner.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col md:flex-row transition-opacity ${banner.isActive ? '' : 'opacity-60'}`}>
                        {/* Preview */}
                        <div className={`w-full md:w-56 h-32 md:h-auto bg-gradient-to-br ${banner.gradient} flex items-center justify-center relative shrink-0`}>
                            <span className="text-5xl">{banner.emoji || '🖼️'}</span>
                            <div className="absolute top-2 left-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${banner.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {banner.isActive ? 'Faol' : 'Nofaol'}
                                </span>
                            </div>
                            <div className="absolute top-2 right-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-gray-700">
                                    #{banner.order} • {LOCATIONS.find(l => l.value === banner.location)?.label.split(' ')[0]}
                                </span>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                            <div>
                                <div className="flex items-start gap-2 flex-wrap mb-1">
                                    {banner.badge && (
                                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{banner.badge.uz}</span>
                                    )}
                                </div>
                                <h3 className="font-extrabold text-gray-900 text-base truncate">{banner.title.uz}</h3>
                                <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{banner.subtitle.uz}</p>
                                <div className="flex items-center gap-1 text-xs text-blue-600 mt-2">
                                    <LinkIcon size={10} />
                                    <span className="truncate">{banner.link}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-4 flex-wrap">
                                <button onClick={() => openEdit(banner)} className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs px-3 py-2 rounded-xl transition-colors">
                                    <Edit size={13} /> Tahrirlash
                                </button>
                                <button onClick={() => toggleActive(banner.id)} className={`flex items-center gap-1.5 font-semibold text-xs px-3 py-2 rounded-xl transition-colors border ${banner.isActive ? 'border-orange-100 bg-orange-50 text-orange-700 hover:bg-orange-100' : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                                    {banner.isActive ? <><EyeOff size={13} /> O&apos;chirish</> : <><Eye size={13} /> Yoqish</>}
                                </button>
                                <button onClick={() => reorder(banner.id, 'up')} className="p-2 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl transition-colors" title="Yuqoriga"><ArrowUp size={13} /></button>
                                <button onClick={() => reorder(banner.id, 'down')} className="p-2 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl transition-colors" title="Pastga"><ArrowDown size={13} /></button>
                                <button onClick={() => deleteBanner(banner.id)} className="flex items-center gap-1.5 border border-red-100 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs px-3 py-2 rounded-xl transition-colors ml-auto">
                                    <Trash2 size={13} /> O&apos;chirish
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Live preview hint */}
            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3 text-sm text-blue-700">
                <Eye size={16} className="shrink-0" />
                <span>O&apos;zgarishlar darhol <Link href="/" target="_blank" className="font-bold underline">bosh sahifa</Link> da ko&apos;rinadi — sahifani yangilang.</span>
            </div>
        </div>
    );
}
