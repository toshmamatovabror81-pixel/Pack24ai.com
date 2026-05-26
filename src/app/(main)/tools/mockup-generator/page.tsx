'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useState } from 'react';
import {
    Upload, Grid3x3, Search, ChevronRight, Star,
    Package, Layers, FlaskConical, Coffee, ShoppingBag,
    ArrowRight, Sparkles, Download, Eye
} from 'lucide-react';

// ─── Mockup kategoriyalari ─────────────────────────────────────────
const MOCKUP_CATEGORIES = [
    { id: 'all',   icon: Grid3x3,    uz: 'Barchasi',            ru: 'Все',                  en: 'All',              count: 5000 },
    { id: 'box',   icon: Package,    uz: 'Qutichalar',          ru: 'Коробки',              en: 'Boxes',            count: 1667 },
    { id: 'pouch', icon: ShoppingBag,uz: 'Paketlar',            ru: 'Пакеты',               en: 'Pouches & Bags',   count: 829 },
    { id: 'bottle',icon: FlaskConical, uz: 'Shishalar', ru: 'Бутылки', en: 'Bottles', count: 869 },
    { id: 'can',   icon: Coffee,     uz: 'Bankalar',            ru: 'Банки',                en: 'Cans',             count: 660 },
    { id: 'tube',  icon: Layers,     uz: 'Naychalar',           ru: 'Тубы',                 en: 'Tubes',            count: 202 },
    { id: 'food',  icon: Package,    uz: 'Oziq-ovqat',          ru: 'Пищевая упаковка',     en: 'Food Packaging',   count: 437 },
    { id: 'bag',   icon: ShoppingBag,uz: 'Qog\'oz sumkalar',    ru: 'Бумажные пакеты',      en: 'Paper Bags',       count: 80 },
];

// ─── Demo mockup items ─────────────────────────────────────────────
const DEMO_MOCKUPS = [
    { id: 1, cat: 'box',    name: 'Kraft Box Mockup',          color: 'from-amber-100 to-amber-200',   emoji: '📦', popular: true },
    { id: 2, cat: 'pouch',  name: 'Stand-up Pouch',            color: 'from-blue-100 to-blue-200',     emoji: '🛍️', popular: true },
    { id: 3, cat: 'bottle', name: 'Glass Bottle',              color: 'from-emerald-100 to-emerald-200',emoji: '🫙', popular: false },
    { id: 4, cat: 'box',    name: 'Gift Box Mockup',           color: 'from-purple-100 to-purple-200', emoji: '🎁', popular: true },
    { id: 5, cat: 'can',    name: 'Tin Can',                   color: 'from-gray-100 to-gray-200',     emoji: '🥫', popular: false },
    { id: 6, cat: 'bag',    name: 'Paper Shopping Bag',        color: 'from-orange-100 to-orange-200', emoji: '🛍️', popular: true },
    { id: 7, cat: 'tube',   name: 'Cosmetic Tube',             color: 'from-pink-100 to-pink-200',     emoji: '🧴', popular: false },
    { id: 8, cat: 'food',   name: 'Pizza Box Mockup',          color: 'from-red-100 to-red-200',       emoji: '🍕', popular: true },
    { id: 9, cat: 'bottle', name: 'Water Bottle',              color: 'from-cyan-100 to-cyan-200',     emoji: '💧', popular: false },
    { id: 10,cat: 'box',    name: 'Mailer Box',                color: 'from-teal-100 to-teal-200',     emoji: '📬', popular: false },
    { id: 11,cat: 'pouch',  name: 'Mylar Foil Bag',            color: 'from-indigo-100 to-indigo-200', emoji: '✨', popular: true },
    { id: 12,cat: 'food',   name: 'Coffee Cup',                color: 'from-yellow-100 to-yellow-200', emoji: '☕', popular: false },
];

// ─── AI Prompt demos ──────────────────────────────────────────────
const AI_PROMPTS = [
    'Create packaging for an ice cream brand',
    'Eco-friendly coffee brand packaging',
    'Luxury perfume box design',
    'Minimalist tea packaging',
];

export default function MockupGeneratorPage() {
    const { language } = useLanguage();
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [selectedMockup, setSelectedMockup] = useState<number | null>(null);
    const [aiPrompt, setAiPrompt] = useState('');

    const t = (uz: string, ru: string, en: string) =>
        language === 'uz' ? uz : language === 'en' ? en : ru;

    const filteredMockups = DEMO_MOCKUPS.filter(m =>
        (activeCategory === 'all' || m.cat === activeCategory) &&
        (searchQuery === '' || m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setUploadedFile(e.target.files[0]);
    };

    return (
        <div className="min-h-screen bg-surface-page">

            {/* ── Header ── */}
            <div className="bg-white border-b border-gray-100 py-6">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <Link href="/tools" className="hover:text-blue-600 transition-colors">
                            {t("Asboblar", "Инструменты", "Tools")}
                        </Link>
                        <ChevronRight size={14} />
                        <span className="text-gray-700 font-medium">Mockup Generator</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-900">
                                {t("Mockup Generator", "Генератор мокапов", "Mockup Generator")}
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">
                                {t("5000+ professional mockup shablonlar", "5000+ профессиональных мокапов", "5000+ professional mockup templates")}
                            </p>
                        </div>
                        <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm">
                            <Upload size={16} />
                            {t("Dizayn yuklash", "Загрузить дизайн", "Upload Design")}
                            <input type="file" accept="image/*,.pdf,.ai,.psd" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                    {uploadedFile && (
                        <div className="mt-3 inline-flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200">
                            <span>✓</span> {uploadedFile.name}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col xl:flex-row gap-8">

                    {/* ── LEFT: Categories + Grid ── */}
                    <div className="flex-1 min-w-0">
                        {/* Search */}
                        <div className="relative mb-6">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder={t("Mockup qidirish...", "Поиск мокапов...", "Search mockups...")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                            />
                        </div>

                        {/* Category tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
                            {MOCKUP_CATEGORIES.map(({ id, icon: Icon, uz, ru, en, count }) => (
                                <button
                                    key={id}
                                    onClick={() => setActiveCategory(id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                        activeCategory === id
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                    }`}
                                >
                                    <Icon size={13} />
                                    {language === 'uz' ? uz : language === 'en' ? en : ru}
                                    <span className={`text-[10px] ${activeCategory === id ? 'text-blue-200' : 'text-gray-400'}`}>
                                        {count.toLocaleString()}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Mockup grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredMockups.map((mockup) => (
                                <button
                                    key={mockup.id}
                                    onClick={() => setSelectedMockup(mockup.id)}
                                    className={`group text-left bg-white rounded-2xl border-2 overflow-hidden hover:shadow-lg transition-all ${
                                        selectedMockup === mockup.id
                                            ? 'border-blue-500 shadow-lg shadow-blue-100'
                                            : 'border-gray-100 hover:border-blue-200'
                                    }`}
                                >
                                    {/* Preview */}
                                    <div className={`bg-gradient-to-br ${mockup.color} h-36 flex items-center justify-center relative`}>
                                        <span className="text-5xl group-hover:scale-110 transition-transform">{mockup.emoji}</span>
                                        {mockup.popular && (
                                            <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                                <Star size={8} className="fill-yellow-900" /> {t("Ommabop", "Популярно", "Popular")}
                                            </span>
                                        )}
                                        {selectedMockup === mockup.id && (
                                            <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                                                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                                    <Eye size={14} className="text-white" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">{mockup.name}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── RIGHT: Preview Panel ── */}
                    <div className="xl:w-80 flex-shrink-0 space-y-4">

                        {/* 3D Preview */}
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 h-64 flex items-center justify-center relative">
                                {selectedMockup ? (
                                    <>
                                        <span className="text-8xl">
                                            {DEMO_MOCKUPS.find(m => m.id === selectedMockup)?.emoji}
                                        </span>
                                        {uploadedFile && (
                                            <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-xl p-2 text-center">
                                                <p className="text-xs text-gray-600 font-medium">✓ {t("Dizayn qo'llanildi", "Дизайн применён", "Design applied")}</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <Package size={40} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">{t("Mockup tanlang", "Выберите мокап", "Select a mockup")}</p>
                                    </div>
                                )}
                            </div>
                            <div className="p-4">
                                <p className="text-sm font-semibold text-gray-800 mb-3">
                                    {selectedMockup
                                        ? DEMO_MOCKUPS.find(m => m.id === selectedMockup)?.name
                                        : t("Preview", "Предпросмотр", "Preview")}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        disabled={!selectedMockup}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-bold py-2.5 rounded-xl transition-colors hover:bg-blue-700"
                                    >
                                        <Download size={13} />
                                        {t("Yuklab olish", "Скачать", "Download")}
                                    </button>
                                    <button
                                        disabled={!selectedMockup}
                                        className="flex items-center justify-center gap-1.5 border border-gray-200 disabled:opacity-40 text-gray-600 text-xs font-semibold px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        <Eye size={13} />
                                        {t("Ko'rish", "Просмотр", "View")}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* AI Design shortcut */}
                        <div className="bg-gradient-to-br from-orange-50 to-rose-50 border border-orange-100 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles size={16} className="text-orange-500" />
                                <p className="text-sm font-bold text-gray-800">
                                    {t("AI bilan dizayn yarating", "Создайте дизайн с AI", "Create with AI")}
                                </p>
                            </div>
                            <div className="space-y-2 mb-3">
                                {AI_PROMPTS.map((prompt) => (
                                    <button
                                        key={prompt}
                                        onClick={() => setAiPrompt(prompt)}
                                        className="w-full text-left text-xs text-gray-600 hover:text-orange-600 hover:bg-orange-50 px-3 py-2 rounded-lg transition-colors border border-transparent hover:border-orange-100 flex items-center justify-between group"
                                    >
                                        <span className="line-clamp-1">{prompt}</span>
                                        <ArrowRight size={10} className="text-gray-300 group-hover:text-orange-400 shrink-0 ml-1" />
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    placeholder={t("Qadoqni tasvirlab bering...", "Опишите упаковку...", "Describe packaging...")}
                                    className="flex-1 text-xs border border-orange-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400 bg-white"
                                />
                                <button
                                    aria-label="AI bilan yaratish"
                                    title="AI bilan yaratish"
                                    className="bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-bold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity">
                                    <Sparkles size={13} />
                                </button>
                            </div>
                        </div>

                        {/* Quick link to /tools */}
                        <Link href="/tools" className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-200 hover:shadow-sm transition-all group">
                            <div>
                                <p className="text-sm font-semibold text-gray-800">{t("Boshqa asboblar", "Другие инструменты", "More tools")}</p>
                                <p className="text-xs text-gray-400">{t("Dieline, 3D, AI...", "Dieline, 3D, AI...", "Dieline, 3D, AI...")}</p>
                            </div>
                            <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
