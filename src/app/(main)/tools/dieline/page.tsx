'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useState } from 'react';import { ChevronRight, Settings, Download, FileText, Layers } from 'lucide-react';

// ─── Template kategoriyalari ───────────────────────────────────────
const DIELINE_CATEGORIES = [
    { id: 'all',        uz: 'Barchasi',             ru: 'Все',              en: 'All',              count: 3000 },
    { id: 'folding',    uz: 'Buklanadigan quti',     ru: 'Складная коробка', en: 'Folding Box',      count: 650 },
    { id: 'tuck',       uz: 'Tuck End quti',         ru: 'Tuck End Box',     en: 'Tuck End Box',     count: 420 },
    { id: 'bag',        uz: 'Qog\'oz sumka',         ru: 'Бумажный пакет',   en: 'Paper Bag',        count: 310 },
    { id: 'lid',        uz: 'Qopqoqli quti',         ru: 'Коробка с крышкой',en: 'Box with Lid',     count: 280 },
    { id: 'display',    uz: 'Display quti',           ru: 'Дисплейная коробка',en: 'Display Box',     count: 190 },
    { id: 'envelope',   uz: 'Konvert',               ru: 'Конверт',          en: 'Envelope',         count: 250 },
    { id: 'tray',       uz: 'Lоток',                 ru: 'Поднос/Лоток',     en: 'Tray Box',         count: 175 },
];

const DEMO_TEMPLATES = [
    { id: 1, cat: 'folding',  name: 'Standard Folding Box',   dims: '100×80×50',  emoji: '📦', popular: true },
    { id: 2, cat: 'tuck',     name: 'Straight Tuck End',       dims: '80×60×40',   emoji: '🧱', popular: true },
    { id: 3, cat: 'bag',      name: 'SOS Paper Bag',           dims: '200×100×80', emoji: '🛍️', popular: false },
    { id: 4, cat: 'lid',      name: 'Two-Piece Gift Box',      dims: '150×150×60', emoji: '🎁', popular: true },
    { id: 5, cat: 'display',  name: 'Counter Display Box',     dims: '300×200×150',emoji: '🪟', popular: false },
    { id: 6, cat: 'envelope', name: 'C5 Envelope',             dims: '229×162',    emoji: '✉️', popular: true },
    { id: 7, cat: 'folding',  name: 'Pillow Box',              dims: '120×80×40',  emoji: '🎀', popular: false },
    { id: 8, cat: 'tray',     name: 'Full-Depth Tray',         dims: '250×150×50', emoji: '📤', popular: false },
    { id: 9, cat: 'bag',      name: 'Die-Cut Handle Bag',      dims: '250×120×80', emoji: '👜', popular: true },
];

const MATERIALS = [
    { id: 'cardboard',    uz: 'Karton (300 gsm)',     ru: 'Картон (300 гр/м²)',  en: 'Cardboard (300 gsm)' },
    { id: 'kraft',        uz: 'Kraft qog\'oz',        ru: 'Крафт-бумага',        en: 'Kraft paper' },
    { id: 'corrugated',   uz: 'Gofrokarton',          ru: 'Гофрокартон',         en: 'Corrugated' },
    { id: 'white',        uz: 'Oq karton',            ru: 'Белый картон',        en: 'White board' },
    { id: 'recycled',     uz: 'Qayta ishlangan',      ru: 'Переработанный',      en: 'Recycled' },
];

export default function DielinePage() {
    const { language } = useLanguage();
    const [activeCategory, setActiveCategory] = useState('all');
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
    const [material, setMaterial] = useState('cardboard');
    const [dims, setDims] = useState({ w: 100, h: 80, d: 50 });

    const t = (uz: string, ru: string, en: string) =>
        language === 'uz' ? uz : language === 'en' ? en : ru;

    const filtered = DEMO_TEMPLATES.filter(t =>
        activeCategory === 'all' || t.cat === activeCategory
    );

    return (
        <div className="min-h-screen bg-surface-page">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 py-6">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <Link href="/tools" className="hover:text-blue-600">{t("Asboblar", "Инструменты", "Tools")}</Link>
                        <ChevronRight size={14} />
                        <span className="text-gray-700 font-medium">Dieline Templates</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-900">
                                {t("Dieline Template Maker", "Мастер шаблонов Dieline", "Dieline Template Maker")}
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                {t("3000+ professional chop etishga tayyor shablon", "3000+ шаблонов готовых к печати", "3000+ print-ready templates")}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col xl:flex-row gap-8">
                    {/* LEFT: Templates */}
                    <div className="flex-1 min-w-0">
                        {/* Category tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                            {DIELINE_CATEGORIES.map(({ id, uz, ru, en, count }) => (
                                <button
                                    key={id}
                                    onClick={() => setActiveCategory(id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                        activeCategory === id
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                    }`}
                                >
                                    {language === 'uz' ? uz : language === 'en' ? en : ru}
                                    <span className={`text-[10px] ${activeCategory === id ? 'text-emerald-200' : 'text-gray-400'}`}>
                                        {count.toLocaleString()}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Templates grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filtered.map((tmpl) => (
                                <button
                                    key={tmpl.id}
                                    onClick={() => { setSelectedTemplate(tmpl.id); setDims({ w: 100, h: 80, d: 50 }); }}
                                    className={`group text-left bg-white rounded-2xl border-2 overflow-hidden hover:shadow-lg transition-all ${
                                        selectedTemplate === tmpl.id
                                            ? 'border-emerald-500 shadow-lg shadow-emerald-50'
                                            : 'border-gray-100 hover:border-emerald-200'
                                    }`}
                                >
                                    <div className="h-32 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative">
                                        <span className="text-4xl group-hover:scale-110 transition-transform">{tmpl.emoji}</span>
                                        {tmpl.popular && (
                                            <span className="absolute top-2 right-2 bg-emerald-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                                {t("Mashhur", "Популярное", "Popular")}
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <p className="text-xs font-semibold text-gray-800 line-clamp-1 mb-0.5">{tmpl.name}</p>
                                        <p className="text-[10px] text-gray-400 font-mono">{tmpl.dims} mm</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: Customizer */}
                    <div className="xl:w-80 flex-shrink-0 space-y-4">
                        {/* Dimension customizer */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <Settings size={16} className="text-emerald-600" />
                                <p className="font-bold text-gray-800 text-sm">{t("O'lchamlar", "Размеры", "Dimensions")}</p>
                            </div>
                            <div className="space-y-3">
                                {(['w', 'h', 'd'] as const).map((dim) => (
                                    <div key={dim} className="flex items-center gap-3">
                                        <label className="text-xs font-bold text-gray-500 w-8 uppercase">
                                            {dim === 'w' ? t("Keng.", "Шир.", "W") : dim === 'h' ? t("Balan.", "Выс.", "H") : t("Chuq.", "Гл.", "D")}
                                        </label>
                                        <input
                                            type="range"
                                            min={20} max={500}
                                            value={dims[dim]}
                                            title={dim === 'w' ? 'Kenglik (mm)' : dim === 'h' ? 'Balandlik (mm)' : 'Chuqurlik (mm)'}
                                            aria-label={dim === 'w' ? 'Kenglik (mm)' : dim === 'h' ? 'Balandlik (mm)' : 'Chuqurlik (mm)'}
                                            onChange={(e) => setDims(prev => ({ ...prev, [dim]: +e.target.value }))}
                                            className="flex-1 accent-emerald-500"
                                        />
                                        <span className="text-xs font-mono text-gray-700 w-14 text-right">{dims[dim]} mm</span>
                                    </div>
                                ))}
                            </div>

                            {/* Material */}
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs font-bold text-gray-500 mb-2">{t("Material", "Материал", "Material")}</p>
                                <select
                                    value={material}
                                    onChange={(e) => setMaterial(e.target.value)}
                                    aria-label="Material tanlash"
                                    title="Material tanlash"
                                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400"
                                >
                                    {MATERIALS.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {language === 'uz' ? m.uz : language === 'en' ? m.en : m.ru}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Preview box (visual) */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <p className="text-sm font-bold text-gray-800 mb-3">{t("Umumiy ko'rinish", "Предпросмотр", "Preview")}</p>
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl h-36 flex items-center justify-center relative overflow-hidden">
                                {selectedTemplate ? (
                                    <>
                                        <span className="text-6xl">
                                            {DEMO_TEMPLATES.find(t => t.id === selectedTemplate)?.emoji}
                                        </span>
                                        <div className="absolute bottom-2 left-2 right-2 bg-white/80 backdrop-blur-sm rounded-lg p-1.5 text-center">
                                            <p className="text-[10px] font-mono text-gray-600">
                                                {dims.w} × {dims.h} × {dims.d} mm
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-gray-300">
                                        <Layers size={32} className="mx-auto mb-1" />
                                        <p className="text-xs">{t("Shablon tanlang", "Выберите шаблон", "Select template")}</p>
                                    </div>
                                )}
                            </div>

                            {/* Download buttons */}
                            <div className="flex gap-2 mt-4">
                                <button disabled={!selectedTemplate} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors">
                                    <Download size={13} /> PDF
                                </button>
                                <button disabled={!selectedTemplate} className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 disabled:opacity-40 text-gray-600 text-xs font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                                    <FileText size={13} /> SVG
                                </button>
                            </div>
                        </div>

                        <Link href="/tools" className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-emerald-200 hover:shadow-sm transition-all group">
                            <div>
                                <p className="text-sm font-semibold text-gray-800">{t("Boshqa asboblar", "Другие инструменты", "More tools")}</p>
                                <p className="text-xs text-gray-400">Mockup, 3D, AI...</p>
                            </div>
                            <ChevronRight size={16} className="text-gray-400 group-hover:text-emerald-600 transition-colors" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
