'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useState } from 'react';
import BoxConfigurator from '@/components/BoxConfigurator';
import {
    Box, ShoppingBag, Coffee, Package, Layers,
    ChevronRight, Sparkles, Download, ArrowRight,
    Upload, Eye
} from 'lucide-react';

// ─── Pacdora uslubida mockup kategoriyalari ──────────────────────
const MOCKUP_CATS = [
    { id: 'box',    icon: Box,        emoji: '📦', uz: 'Qutichalar',     ru: 'Коробки',        en: 'Boxes',   count: 1667, color: 'bg-amber-50 border-amber-200 hover:border-amber-400' },
    { id: 'pouch',  icon: ShoppingBag,emoji: '🛍️', uz: 'Paketlar',      ru: 'Пакеты',         en: 'Pouches', count: 829,  color: 'bg-blue-50 border-blue-200 hover:border-blue-400' },
    { id: 'bottle', icon: Coffee,      emoji: '🫙', uz: 'Shishalar',     ru: 'Бутылки',        en: 'Bottles', count: 869,  color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400' },
    { id: 'can',    icon: Package,     emoji: '🥫', uz: 'Bankalar',      ru: 'Банки',          en: 'Cans',    count: 660,  color: 'bg-red-50 border-red-200 hover:border-red-400' },
    { id: 'tube',   icon: Layers,      emoji: '🧴', uz: 'Naychalar',     ru: 'Тубусы',         en: 'Tubes',   count: 202,  color: 'bg-pink-50 border-pink-200 hover:border-pink-400' },
    { id: 'bag',    icon: ShoppingBag, emoji: '👜', uz: "Qog'oz sumka",  ru: 'Бумажный пакет', en: 'Bags',    count: 80,   color: 'bg-orange-50 border-orange-200 hover:border-orange-400' },
] as const;

// ─── Demo mockup items for the selected category ─────────────────
const DEMO_ITEMS: Record<string, { emoji: string; name: string; popular?: boolean }[]> = {
    box:    [{ emoji: '📦', name: 'Kraft Box', popular: true }, { emoji: '🎁', name: 'Gift Box', popular: true }, { emoji: '📬', name: 'Mailer Box' }, { emoji: '📤', name: 'Archive Box' }],
    pouch:  [{ emoji: '🛍️', name: 'Stand-up Pouch', popular: true }, { emoji: '✨', name: 'Mylar Bag', popular: true }, { emoji: '🛍️', name: 'Flat Pouch' }, { emoji: '💊', name: 'Zip Pouch' }],
    bottle: [{ emoji: '🫙', name: 'Glass Jar', popular: true }, { emoji: '💧', name: 'Water Bottle' }, { emoji: '🧴', name: 'Pump Bottle', popular: true }, { emoji: '🍶', name: 'Carafe' }],
    can:    [{ emoji: '🥫', name: 'Tin Can', popular: true }, { emoji: '🍺', name: 'Beer Can', popular: true }, { emoji: '☕', name: 'Coffee Can' }, { emoji: '🎨', name: 'Paint Can' }],
    tube:   [{ emoji: '🧴', name: 'Cosmetic Tube', popular: true }, { emoji: '🖊️', name: 'Tube Pen' }, { emoji: '🧪', name: 'Lab Tube' }, { emoji: '🖌️', name: 'Toothpaste' }],
    bag:    [{ emoji: '👜', name: 'Die-Cut Bag', popular: true }, { emoji: '🛍️', name: 'SOS Bag', popular: true }, { emoji: '🎀', name: 'Ribbon Bag' }, { emoji: '🛒', name: 'Flat Bag' }],
};

export default function ConfiguratorPage() {
    const { language } = useLanguage();
    const [activeTab, setActiveTab] = useState<'3d' | 'mockup'>('3d');
    const [selectedCat, setSelectedCat] = useState('box');
    const [selectedItem, setSelectedItem] = useState<number | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);

    const t = (uz: string, ru: string, en?: string) =>
        language === 'uz' ? uz : language === 'en' ? (en ?? ru) : ru;

    const items = DEMO_ITEMS[selectedCat] ?? DEMO_ITEMS.box;

    return (
        <div className="min-h-screen bg-surface-page">

            {/* ── Page header ── */}
            <div className="bg-white border-b border-gray-100 py-5">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-900">
                                {t("Qadoq Dizayn Studio", "Студия дизайна упаковки", "Packaging Design Studio")}
                            </h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {t("3D konfigurator va professional mockup generatorni bir joyda", "3D конфигуратор и генератор мокапов в одном месте", "3D configurator and mockup generator in one place")}
                            </p>
                        </div>

                        {/* Tab switcher */}
                        <div className="flex bg-gray-100 rounded-xl p-1">
                            <button
                                onClick={() => setActiveTab('3d')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                    activeTab === '3d'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <Box size={15} />
                                {t("3D Konfigurator", "3D Конфигуратор", "3D Configurator")}
                            </button>
                            <button
                                onClick={() => setActiveTab('mockup')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                    activeTab === 'mockup'
                                        ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <Sparkles size={15} />
                                {t("Mockup Generator", "Генератор мокапов", "Mockup Generator")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 3D Configurator tab ── */}
            {activeTab === '3d' && (
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <BoxConfigurator />

                    {/* Quick link to Mockup Generator */}
                    <div className="mt-8 bg-gradient-to-br from-orange-50 to-rose-50 border border-orange-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles size={16} className="text-orange-500" />
                                <p className="font-bold text-gray-800">{t("Mockup ham kerakmi?", "Нужен мокап?", "Need a mockup?")}</p>
                            </div>
                            <p className="text-sm text-gray-500">
                                {t("5000+ professional mockup shablondan tanlang", "Выберите из 5000+ профессиональных мокапов", "Choose from 5000+ professional mockups")}
                            </p>
                        </div>
                        <button
                            onClick={() => setActiveTab('mockup')}
                            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity shrink-0"
                        >
                            {t("Mockup ochish", "Открыть Mockup", "Open Mockup")} <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Mockup Generator tab (Pacdora uslubida) ── */}
            {activeTab === 'mockup' && (
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col xl:flex-row gap-8">

                        {/* LEFT: Categories + Items */}
                        <div className="flex-1 min-w-0">
                            {/* Category tiles */}
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
                                {MOCKUP_CATS.map(({ id, emoji, uz, ru, en, count, color }) => (
                                    <button
                                        key={id}
                                        onClick={() => { setSelectedCat(id); setSelectedItem(null); }}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${color} ${
                                            selectedCat === id ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                                        }`}
                                    >
                                        <span className="text-3xl">{emoji}</span>
                                        <span className="text-[11px] font-bold text-gray-700 text-center leading-tight">
                                            {language === 'uz' ? uz : language === 'en' ? en : ru}
                                        </span>
                                        <span className="text-[9px] text-gray-400 font-medium">{count.toLocaleString()}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Upload design bar */}
                            <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
                                <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors shrink-0">
                                    <Upload size={14} />
                                    {t("Dizayn yuklash", "Загрузить дизайн", "Upload Design")}
                                    <input type="file" accept="image/*,.pdf,.ai,.psd" className="hidden" onChange={e => e.target.files?.[0] && setUploadedFile(e.target.files[0])} />
                                </label>
                                {uploadedFile ? (
                                    <p className="text-sm text-blue-700 font-medium">✓ {uploadedFile.name}</p>
                                ) : (
                                    <p className="text-sm text-blue-500">{t("Dizayn faylini yuklang (PNG, PDF, AI, PSD)", "Загрузите файл дизайна (PNG, PDF, AI, PSD)", "Upload your design file (PNG, PDF, AI, PSD)")}</p>
                                )}
                            </div>

                            {/* Items grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {items.map((item, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedItem(i)}
                                        className={`group text-left bg-white rounded-2xl border-2 overflow-hidden hover:shadow-lg transition-all ${
                                            selectedItem === i
                                                ? 'border-blue-500 shadow-lg shadow-blue-50'
                                                : 'border-gray-100 hover:border-blue-200'
                                        }`}
                                    >
                                        <div className="h-32 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative">
                                            <span className="text-5xl group-hover:scale-110 transition-transform">{item.emoji}</span>
                                            {item.popular && (
                                                <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                                    ★ {t("Ommabop", "Топ", "Top")}
                                                </span>
                                            )}
                                            {selectedItem === i && (
                                                <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                                                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                                        <Eye size={14} className="text-white" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <p className="text-xs font-semibold text-gray-800">{item.name}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Link to full mockup page */}
                            <div className="mt-6 text-center">
                                <Link href="/tools/mockup-generator" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold">
                                    {t("5000+ mockupning barchasini ko'rish", "Посмотреть все 5000+ мокапов", "View all 5000+ mockups")}
                                    <ChevronRight size={14} />
                                </Link>
                            </div>
                        </div>

                        {/* RIGHT: Preview panel */}
                        <div className="xl:w-72 flex-shrink-0 space-y-4">
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                                <div className="bg-gradient-to-br from-gray-50 to-gray-100 h-56 flex items-center justify-center">
                                    {selectedItem !== null ? (
                                        <span className="text-8xl">{items[selectedItem]?.emoji}</span>
                                    ) : (
                                        <div className="text-center text-gray-300">
                                            <Box size={40} className="mx-auto mb-2" />
                                            <p className="text-sm">{t("Mockup tanlang", "Выберите мокап", "Select a mockup")}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <p className="text-sm font-bold text-gray-800 mb-3">
                                        {selectedItem !== null ? items[selectedItem]?.name : t("Preview", "Предпросмотр", "Preview")}
                                    </p>
                                    {uploadedFile && selectedItem !== null && (
                                        <p className="text-xs text-emerald-600 font-medium mb-2">✓ {t("Dizayn qo'llanildi", "Дизайн применён", "Design applied")}</p>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            disabled={selectedItem === null}
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
                                        >
                                            <Download size={13} />
                                            {t("Yuklab olish", "Скачать", "Download")}
                                        </button>
                                        <button
                                            disabled={selectedItem === null}
                                            className="border border-gray-200 disabled:opacity-40 text-gray-600 text-xs font-semibold px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                                            aria-label={t("Ko'rish", "Просмотр", "View")}
                                        >
                                            <Eye size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* AI shortcut */}
                            <div className="bg-gradient-to-br from-orange-50 to-rose-50 border border-orange-100 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles size={14} className="text-orange-500" />
                                    <p className="text-sm font-bold text-gray-800">{t("AI Dizayn", "AI Дизайн", "AI Design")}</p>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">
                                    {t("Matn kiritib AI dizayn yarating", "Создайте дизайн с помощью AI", "Create design with AI")}
                                </p>
                                <Link href="/tools/ai-design" className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700">
                                    {t("AI Dizayn ochish", "Открыть AI Дизайн", "Open AI Design")} <ChevronRight size={12} />
                                </Link>
                            </div>

                            {/* Switch to 3D */}
                            <button
                                onClick={() => setActiveTab('3d')}
                                className="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-200 hover:shadow-sm transition-all group"
                            >
                                <div className="text-left">
                                    <p className="text-sm font-semibold text-gray-800">{t("3D Konfigurator", "3D Конфигуратор", "3D Configurator")}</p>
                                    <p className="text-xs text-gray-400">{t("Qutini 3D da sozlang", "Настройте коробку в 3D", "Configure box in 3D")}</p>
                                </div>
                                <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DESIGN TOOLS ───────────────────────────────────── */}
            <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14">
                <div className="bg-gradient-to-br from-brand-deeper to-[#163860] rounded-3xl overflow-hidden">
                    {/* Header */}
                    <div className="px-8 pt-10 pb-6 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-semibold text-blue-200 mb-4">
                            <Sparkles size={12} className="text-yellow-400" />
                            <span>{t("Pacdora asboblari bilan ishlash", "Инструменты дизайна Pacdora", "Pacdora Design Tools")}</span>
                        </div>
                        <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-2">
                            {t("Professional Dizayn Asboblari", "Профессиональные инструменты дизайна", "Professional Design Tools")}
                        </h2>
                        <p className="text-blue-200/70 text-sm max-w-xl mx-auto">
                            {t("Mockup, dieline, 3D modeling va AI dizayn — hammasi bir joyda. Bepul boshlang.", "Мокапы, dieline, 3D моделирование и AI дизайн — всё в одном месте. Начните бесплатно.", "Mockups, dieline, 3D modeling and AI design — all in one place. Start for free.")}
                        </p>
                    </div>

                    {/* Tool cards */}
                    <div className="px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            {
                                icon: Box,
                                href: '/tools/mockup-generator',
                                color: 'from-blue-500/20 to-indigo-500/20 border-blue-400/30 hover:border-blue-400/60',
                                badge: 'FREE',
                                badgeColor: 'bg-emerald-500',
                                count: '5000+',
                                uz: { title: 'Mockup Generator', sub: "3D mahsulot ko'rinishi" },
                                ru: { title: 'Генератор мокапов', sub: '3D визуализация' },
                            },
                            {
                                icon: Layers,
                                href: '/tools/dieline',
                                color: 'from-emerald-500/20 to-teal-500/20 border-emerald-400/30 hover:border-emerald-400/60',
                                badge: 'FREE',
                                badgeColor: 'bg-emerald-500',
                                count: '3000+',
                                uz: { title: 'Dieline Template', sub: 'Qolip shablonlar' },
                                ru: { title: 'Шаблоны Dieline', sub: 'Шаблоны раскройки' },
                            },
                            {
                                icon: Sparkles,
                                href: '/tools/ai-design',
                                color: 'from-orange-500/20 to-rose-500/20 border-orange-400/30 hover:border-orange-400/60',
                                badge: 'AI',
                                badgeColor: 'bg-gradient-to-r from-orange-500 to-rose-500',
                                count: '',
                                uz: { title: 'AI Dizayn', sub: 'Orzuingizni yarating' },
                                ru: { title: 'AI Дизайн', sub: 'Создайте мечту' },
                            },
                            {
                                icon: Eye,
                                href: '/configurator',
                                color: 'from-purple-500/20 to-violet-500/20 border-purple-400/30 hover:border-purple-400/60',
                                badge: 'NEW',
                                badgeColor: 'bg-purple-500',
                                count: '',
                                uz: { title: '3D Studio', sub: 'Professional 3D loyiha' },
                                ru: { title: '3D Студия', sub: 'Профессиональный 3D' },
                            },
                        ].map(({ icon: Icon, href, color, badge, badgeColor, count, uz, ru }) => {
                            const content = language === 'ru' ? ru : uz;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`group bg-gradient-to-br ${color} border rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/5`}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                                            <Icon size={22} className="text-white" />
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`${badgeColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full`}>{badge}</span>
                                            {count && <span className="text-[10px] text-blue-200/60">{count}</span>}
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-white text-sm mb-0.5">{content.title}</h3>
                                    <p className="text-blue-200/60 text-xs mb-3">{content.sub}</p>
                                    <div className="flex items-center gap-1 text-xs font-semibold text-blue-300 group-hover:text-white transition-colors">
                                        {t("Boshlash", "Начать", "Start")} <ArrowRight size={12} />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* CTA */}
                    <div className="border-t border-white/10 px-8 py-6">
                        <Link
                            href="/tools"
                            className="group flex flex-col sm:flex-row items-center justify-between gap-5 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 rounded-2xl px-7 py-5 transition-all duration-200 hover:-translate-y-0.5"
                        >
                            <div className="text-center sm:text-left">
                                <p className="text-base font-extrabold text-white leading-snug">
                                    {t("Mockup, dieline, 3D modeling va AI dizayn —", "Мокапы, dieline, 3D моделирование и AI дизайн —", "Mockups, dieline, 3D modeling and AI design —")}
                                </p>
                                <p className="text-base font-extrabold text-emerald-300">
                                    {t("hammasi bir joyda. Bepul boshlang.", "всё в одном месте. Начните бесплатно.", "all in one place. Start for free.")}
                                </p>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                                <div className="text-center">
                                    <p className="text-xl font-black text-white">5000+</p>
                                    <p className="text-[10px] text-blue-300/70 font-medium">Mockup</p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div className="text-center">
                                    <p className="text-xl font-black text-white">3000+</p>
                                    <p className="text-[10px] text-blue-300/70 font-medium">Dieline</p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors group-hover:shadow-lg group-hover:shadow-emerald-500/30">
                                    {t("Boshlash", "Начать", "Start")} <ArrowRight size={14} />
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

        </div>
    );
}
