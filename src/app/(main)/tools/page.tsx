'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/contexts/LanguageContext';import { Box, Cpu, Scissors, Sparkles, Image, ArrowRight, Star, Zap, Globe, Package } from 'lucide-react';

// ─── Tool Card ───────────────────────────────────────────────────
const TOOLS = [
    {
        id: 'mockup-generator',
        icon: Box,
        color: 'from-blue-500 to-indigo-600',
        badge: 'FREE',
        count: '5000+',
        uz: { title: 'Mockup Generator', sub: '3D mahsulot tasviri yarating', desc: 'Dizayningizni yuklang va darhol 3D ko\'rinishda ko\'ring. Qutilar, shishalar, paketlar va ko\'proq.' },
        ru: { title: 'Генератор мокапов', sub: 'Создайте 3D визуализацию', desc: 'Загрузите дизайн и сразу увидите его в 3D. Коробки, бутылки, пакеты и многое другое.' },
        en: { title: 'Mockup Generator', sub: 'Create 3D product visuals', desc: 'Upload your design and instantly see it in stunning 3D previews. Boxes, bottles, pouches and more.' },
        href: '/tools/mockup-generator',
        categories: ['Box', 'Bottle', 'Pouch', 'Can', 'Tube', 'Bag'],
    },
    {
        id: 'dieline',
        icon: Scissors,
        color: 'from-emerald-500 to-teal-600',
        badge: 'FREE',
        count: '3000+',
        uz: { title: 'Dieline Template', sub: 'Qolip shablonlar yarating', desc: 'O\'lchamlarni sozlang va professional chop etishga tayyor qolip shablonini oling.' },
        ru: { title: 'Шаблоны Dieline', sub: 'Создайте шаблоны раскройки', desc: 'Настройте размеры и получите профессиональный шаблон, готовый к печати.' },
        en: { title: 'Dieline Templates', sub: 'Professional packaging templates', desc: 'Customize dimensions and get a print-ready dieline template in seconds.' },
        href: '/tools/dieline',
        categories: ['Folding Box', 'Tuck End', 'Paper Bag', 'Envelope', 'Tray'],
    },
    {
        id: '3d-modeling',
        icon: Cpu,
        color: 'from-purple-500 to-violet-600',
        badge: 'NEW',
        count: '',
        uz: { title: '3D Modeling Studio', sub: 'Professional 3D loyihalash', desc: 'Tajriba talab qilmaydi. Sahnalar, shablonlar va elementlardan tanlang.' },
        ru: { title: 'Студия 3D моделей', sub: 'Профессиональное 3D проектирование', desc: 'Опыт не нужен. Выбирайте из сцен, шаблонов и элементов.' },
        en: { title: '3D Modeling Studio', sub: 'Professional 3D design', desc: 'No experience needed. Choose from scenes, templates, and elements.' },
        href: '/tools/3d-modeling',
        categories: ['Studio', 'Scene', 'Lighting', 'Angle', 'Material'],
    },
    {
        id: 'ai-design',
        icon: Sparkles,
        color: 'from-orange-500 to-rose-500',
        badge: 'AI',
        count: '',
        uz: { title: 'AI Dizayn Yaratish', sub: 'Orzuingizni tasvirlab bering', desc: 'Brend nomi va uslubini kiriting — AI sekundlar ichida qadoq dizayni yaratadi.' },
        ru: { title: 'AI Дизайн Упаковки', sub: 'Опишите свою мечту', desc: 'Введите название бренда и стиль — AI создаст дизайн упаковки за секунды.' },
        en: { title: 'AI Packaging Design', sub: 'Describe your dream packaging', desc: 'Enter brand name and style — AI creates packaging design in seconds.' },
        href: '/tools/ai-design',
        categories: ['Minimal', 'Luxury', 'Eco', 'Bold', 'Vintage'],
    },
    {
        id: 'ai-background',
        icon: Image,
        color: 'from-cyan-500 to-blue-500',
        badge: 'AI',
        count: '',
        uz: { title: 'AI Fon Generator', sub: 'Professional mahsulot surati', desc: 'Mahsulot rasmini yuklang — AI professional studiya fonini qo\'shadi.' },
        ru: { title: 'AI Генератор фона', sub: 'Профессиональные фото продуктов', desc: 'Загрузите фото продукта — AI добавит профессиональный студийный фон.' },
        en: { title: 'AI Background', sub: 'Professional product photos', desc: 'Upload product image — AI adds professional studio backgrounds instantly.' },
        href: '/tools/ai-background',
        categories: ['Studio', 'Nature', 'Abstract', 'Minimal', 'Gradient'],
    },
] as const;

const BADGE_STYLE: Record<string, string> = {
    FREE: 'bg-emerald-100 text-emerald-700',
    NEW:  'bg-purple-100 text-purple-700',
    AI:   'bg-gradient-to-r from-orange-500 to-rose-500 text-white',
};

// ─── Stats ───────────────────────────────────────────────────────
const PLATFORM_STATS = [
    { icon: Box,     uz: '5000+ Mockup',         ru: '5000+ Мокапов',        en: '5000+ Mockups' },
    { icon: Scissors,uz: '3000+ Dieline',         ru: '3000+ Шаблонов',       en: '3000+ Dielines' },
    { icon: Globe,   uz: '100+ davlat',           ru: '100+ стран',           en: '100+ countries' },
    { icon: Star,    uz: '4.9 ★ baho',           ru: '4.9 ★ рейтинг',        en: '4.9 ★ rating' },
] as const;

// ─── Page ────────────────────────────────────────────────────────
export default function ToolsPage() {
    const { language } = useLanguage();
    const t = (uz: string, ru: string, en: string) =>
        language === 'uz' ? uz : language === 'en' ? en : ru;

    return (
        <div className="min-h-screen bg-surface-page">

            {/* ── HERO ── */}
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-deeper via-[#0f2340] to-[#1a3a60] text-white py-20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.15),_transparent_70%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.1),_transparent_70%)]" />

                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-semibold text-blue-200 mb-6">
                        <Sparkles size={12} className="text-yellow-400" />
                        {t("Professional dizayn asboblari", "Профессиональные инструменты дизайна", "Professional Design Tools")}
                    </div>

                    <h1 className="text-4xl lg:text-6xl font-extrabold mb-6 leading-tight">
                        {language === 'uz' ? (
                            <>Qadoqlash dizayni uchun <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-emerald-300">barcha asboblar</span></>
                        ) : language === 'en' ? (
                            <>All tools for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-emerald-300">packaging design</span></>
                        ) : (
                            <>Все инструменты для <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-emerald-300">дизайна упаковки</span></>
                        )}
                    </h1>
                    <p className="text-lg text-blue-100/80 max-w-2xl mx-auto mb-10">
                        {t(
                            "Mockup, dieline, 3D modeling va AI dizayn — hammasi bir joyda. Bepul boshlang.",
                            "Мокапы, делинги, 3D моделирование и AI дизайн — всё в одном месте. Начните бесплатно.",
                            "Mockups, dielines, 3D modeling and AI design — all in one place. Start for free."
                        )}
                    </p>

                    {/* Stats */}
                    <div className="flex flex-wrap justify-center gap-8">
                        {PLATFORM_STATS.map(({ icon: Icon, uz, ru, en }) => (
                            <div key={uz} className="flex items-center gap-2 text-sm font-semibold text-blue-100">
                                <Icon size={16} className="text-emerald-400" />
                                {language === 'uz' ? uz : language === 'en' ? en : ru}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── TOOLS GRID ── */}
            <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {TOOLS.map((tool) => {
                        const Icon = tool.icon;
                        const content = tool[language as keyof typeof tool] as { title: string; sub: string; desc: string } || tool.en;

                        return (
                            <Link
                                key={tool.id}
                                href={tool.href}
                                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col"
                            >
                                {/* Header gradient */}
                                <div className={`bg-gradient-to-br ${tool.color} p-8 relative overflow-hidden`}>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2" />
                                    <div className="flex items-start justify-between relative z-10">
                                        <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center">
                                            <Icon size={28} className="text-white" />
                                        </div>
                                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${BADGE_STYLE[tool.badge]}`}>
                                            {tool.badge}
                                        </span>
                                    </div>
                                    {tool.count && (
                                        <p className="text-white/60 text-xs font-medium mt-4 relative z-10">
                                            {tool.count} {t("shablon", "шаблонов", "templates")}
                                        </p>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-6 flex flex-col flex-1">
                                    <h2 className="text-xl font-bold text-gray-900 mb-1">{content.title}</h2>
                                    <p className="text-sm font-medium text-gray-500 mb-3">{content.sub}</p>
                                    <p className="text-sm text-gray-600 leading-relaxed mb-4">{content.desc}</p>

                                    {/* Mini categories */}
                                    <div className="flex flex-wrap gap-1.5 mb-5">
                                        {tool.categories.map((cat) => (
                                            <span key={cat} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                                {cat}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mt-auto flex items-center justify-between">
                                        <span className="text-sm font-bold text-blue-600 group-hover:text-blue-700">
                                            {t("Boshlash", "Начать", "Get started")}
                                        </span>
                                        <div className="w-8 h-8 bg-blue-50 group-hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors">
                                            <ArrowRight size={14} className="text-blue-600 group-hover:text-white transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="bg-gradient-to-br from-brand-dark to-[#1e4a7a] rounded-3xl p-12 text-white text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.2),_transparent_70%)]" />
                    <div className="relative z-10">
                        <Zap size={40} className="text-yellow-400 mx-auto mb-4" />
                        <h2 className="text-3xl font-extrabold mb-4">
                            {t("Dizayn sayohatingizni Pack24 bilan boshlang!", "Начните дизайн-путешествие с Pack24!", "Start your design journey with Pack24!")}
                        </h2>
                        <p className="text-blue-100/80 mb-8 max-w-xl mx-auto">
                            {t("Barcha asboblar bepul. Ro'yxatdan o'tish ham shart emas.", "Все инструменты бесплатны. Регистрация не обязательна.", "All tools are free. No registration required.")}
                        </p>
                        <div className="flex flex-wrap gap-4 justify-center">
                            <Link href="/tools/mockup-generator" className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-3.5 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-500/30">
                                {t("Mockup yaratish", "Создать мокап", "Create Mockup")}
                            </Link>
                            <Link href="/catalog" className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-8 py-3.5 rounded-xl transition-all hover:-translate-y-0.5">
                                <span className="flex items-center gap-2">
                                    <Package size={16} /> {t("Mahsulotlarni ko'rish", "Посмотреть товары", "Browse products")}
                                </span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
