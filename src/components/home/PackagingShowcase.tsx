'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
    ArrowRight, ExternalLink, Sparkles
} from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';

/* ═══════════════════════════════════════════════════════════════════════════
   Pacdora AI partner config
   ═══════════════════════════════════════════════════════════════════════════ */
const PACDORA = 'https://www.pacdora.com';
const P = (path: string) => `${PACDORA}${path}`;
const CDN = (id: string) => `https://cdn.pacdora.com/ui/topic/${id}.webp`;

/* ═══════════════════════════════════════════════════════════════════════════
   i18n
   ═══════════════════════════════════════════════════════════════════════════ */
const T: Record<string, Record<string, string>> = {
    headline1:     { uz: 'Qadoqlash dizaynini', ru: 'Создавайте дизайн упаковки', en: 'Create packaging designs' },
    headline2:     { uz: 'AI bilan yarating', ru: 'с помощью AI', en: 'with AI' },
    subtitle:      { uz: 'Pack24 × Pacdora AI hamkorligi — 3D mockup, dieline va dizayn shablonlari to\'g\'ridan-to\'g\'ri platformamizdan', ru: 'Партнёрство Pack24 × Pacdora AI — 3D мокапы, развёртки и шаблоны дизайна', en: 'Pack24 × Pacdora AI partnership — 3D mockups, dielines & design templates' },
    badge:         { uz: 'Pacdora AI bilan ishlaydi', ru: 'Работает на Pacdora AI', en: 'Powered by Pacdora AI' },
    freeForUsers:  { uz: '✦ Pack24 foydalanuvchilari uchun bepul kirish', ru: '✦ Бесплатный доступ для пользователей Pack24', en: '✦ Free access for Pack24 users' },
    topMockup:     { uz: 'Mashhur mockup kategoriyalar', ru: 'Популярные категории мокапов', en: 'Top mockup categories' },
    topDieline:    { uz: 'Mashhur dieline shablon kategoriyalar', ru: 'Популярные категории развёрток', en: 'Top dieline template categories' },
    topDesign:     { uz: 'Mashhur dizayn shablon kategoriyalar', ru: 'Популярные категории дизайна', en: 'Top design template categories' },
    stunningTools: { uz: 'Pack24 × Pacdora AI vositalari', ru: 'Инструменты Pack24 × Pacdora AI', en: 'Pack24 × Pacdora AI tools' },
    trustedBy:     { uz: 'Dunyo bo\'ylab ishonch bildirgan brendlar', ru: 'Бренды, которые нам доверяют', en: 'Trusted by brands worldwide' },
    viewTemplates: { uz: '3000+ dieline shablonlarni ko\'rish →', ru: 'Смотреть 3000+ шаблонов →', en: 'View 3000+ dieline templates →' },
    toolTitle:     { uz: 'Eng yaxshi onlayn mockup generator', ru: 'Лучший онлайн генератор мокапов', en: 'The best online mockup generator' },
    toolDesc:      { uz: 'Pacdora AI mockup generatori mahsulot dizaynini inqilob qiladi. Qadoqlash, kitob yoki futbolka — dizayningizni yuklang va 3D ko\'rinishda darhol ko\'ring.', ru: 'Генератор мокапов Pacdora AI революционизирует дизайн. Загрузите свой дизайн и мгновенно увидьте в 3D.', en: 'Pacdora AI mockup generator revolutionizes product design. Upload your design and instantly see it in 3D.' },
    toolCta1:      { uz: 'Mockup yaratish', ru: 'Создать мокап', en: 'Create a mockup' },
    toolCta2:      { uz: 'Batafsil', ru: 'Подробнее', en: 'Learn more' },
    card1Title:    { uz: 'Mockup\nGenerator', ru: 'Генератор\nМокапов', en: 'Mockup\nGenerator' },
    card1Desc:     { uz: 'Mahsulot qadoqlashingizni 3D mockup sifatida yarating', ru: 'Создайте 3D мокап вашей упаковки', en: 'Create 3D mockups of your packaging' },
    card2Title:    { uz: '3D Modeling\nSoftware', ru: '3D\nМоделирование', en: '3D Modeling\nSoftware' },
    card2Desc:     { uz: 'Professional 3D qadoqlash modellash vositasi', ru: 'Профессиональный инструмент 3D-моделирования', en: 'Professional 3D packaging modeling tool' },
    card3Title:    { uz: 'Dieline\nTemplate Maker', ru: 'Создатель\nРазвёрток', en: 'Dieline\nTemplate Maker' },
    card3Desc:     { uz: 'Ishlab chiqarish uchun tayyor dieline chizmalar', ru: 'Готовые развёртки для производства', en: 'Production-ready dieline templates' },
};
const t = (key: string, lang: string) => T[key]?.[lang] || T[key]?.uz || '';

/* ═══════════════════════════════════════════════════════════════════════════
   Data — HAQIQIY Pacdora rasmlar va linklar
   ═══════════════════════════════════════════════════════════════════════════ */

const featureCards = [
    { titleKey: 'card1Title', descKey: 'card1Desc', href: P('/mockups'), img: CDN('4d427c21-4856-4677-bd5a-a716e3e3b6ae'), video: 'https://cdn.pacdora.com/ui/topic/fa4c2cf4-7421-477a-964e-7053828a5251.mp4', gradient: 'from-amber-50 to-orange-50', hoverBorder: 'hover:border-amber-300' },
    { titleKey: 'card2Title', descKey: 'card2Desc', href: P('/3d-creator'), img: CDN('61a8a135-c098-473b-aef4-1cad540e1573'), gradient: 'from-blue-50 to-indigo-50', hoverBorder: 'hover:border-blue-300' },
    { titleKey: 'card3Title', descKey: 'card3Desc', href: P('/dielines'), img: CDN('cb3c491a-56ca-4b86-9f12-fdb42436d7f0'), gradient: 'from-emerald-50 to-teal-50', hoverBorder: 'hover:border-emerald-300' },
];

// ── Haqiqiy Pacdora bosh sahifadagi "Top mockup categories" rasmlar ──
const mockupCategories = [
    { name: { uz: 'Quti Mockuplar', ru: 'Коробки', en: 'Box Mockups' }, count: 1766, path: '/mockups/box-mockups', img: CDN('aeed5802-c6f7-4c13-9cef-e2aa026b79b4') },
    { name: { uz: 'Sumka / Paketlar', ru: 'Пакеты', en: 'Pouch / Bag' }, count: 837, path: '/mockups/pouch-and-sachet-and-bag--mockups', img: CDN('b8b62c27-8c05-4fbd-a4d5-c98404033d73') },
    { name: { uz: 'Butilka Mockuplar', ru: 'Бутылки', en: 'Bottle Mockups' }, count: 1908, path: '/mockups/bottle-mockups', img: CDN('45ee7eeb-7d65-48dd-a4f8-d0f6598a57eb') },
    { name: { uz: 'Banka Mockuplar', ru: 'Банки', en: 'Can Mockups' }, count: 662, path: '/mockups/can-and-jar-mockups', img: CDN('b9a399c4-8c49-497e-9b78-9351b39789a3') },
    { name: { uz: 'Tuba Mockuplar', ru: 'Тюбики', en: 'Tube Mockups' }, count: 203, path: '/mockups/tube-mockups', img: CDN('b489caaa-b5d5-4b5b-aa7a-a9b7f1d4d75e') },
    { name: { uz: 'Stakan / Idishlar', ru: 'Стаканы', en: 'Cup / Container' }, count: 355, path: '/mockups/container-cup-bowl-mockups', img: CDN('598269a1-889e-40d2-b8d4-8c88659b1d35') },
    { name: { uz: 'Oziq-ovqat qadoq', ru: 'Пищевая', en: 'Food Packaging' }, count: 459, path: '/mockups/food-packaging-mockups', img: CDN('37ab96e1-d515-4919-8fa2-10ee0385d53b') },
    { name: { uz: 'Suv butilkalar', ru: 'Вода', en: 'Water Bottles' }, count: 201, path: '/mockups/water-bottle-mockup', img: 'https://cdn.pacdora.com/image-resize/1800xauto_outside/ui/topic/7242162d-c361-4a4d-9080-584d318f1b73.png' },
    { name: { uz: 'Sovg\'a qutilari', ru: 'Подарочные', en: 'Gift Boxes' }, count: 150, path: '/mockups/gift-box-mockups', img: CDN('60e948a6-5c53-4c3c-a2be-c7d7a2681079') },
    { name: { uz: 'Qog\'oz sumkalar', ru: 'Бумажные', en: 'Paper Bags' }, count: 85, path: '/mockups/paper-bag-mockups', img: 'https://cdn.pacdora.com/image-resize/1800xauto_outside/ui/topic/5e5bd001-ccb7-46d7-ac7a-8f7c60dbdd5a.png' },
    { name: { uz: 'Pizza qadoqlari', ru: 'Пицца', en: 'Pizza Packaging' }, count: 81, path: '/mockups/pizza-packaging-mockups', img: 'https://cdn.pacdora.com/image-resize/1800xauto_outside/ui/topic/91cbcab3-eb41-428b-81f8-622da9970cf3.png' },
    { name: { uz: 'Dori qadoqlar', ru: 'Фарм', en: 'Supplement' }, count: 199, path: '/mockups/medicine-bottle-mockups', img: 'https://cdn.pacdora.com/image-resize/1800xauto_outside/ui/topic/d93d5d56-30b7-4945-9f4a-a3005f51b8f4.png' },
];

const dielineCategories = [
    { name: { uz: 'Bukiluvchan quti', ru: 'Складная коробка', en: 'Folding Box' }, path: '/dielines/folding-box-dielines', img: CDN('26655c3f-4e14-4560-94c6-60aa67d12c90') },
    { name: { uz: 'Tuck End quti', ru: 'Tuck End коробка', en: 'Tuck End Box' }, path: '/dielines/tuck-end-box-dielines', img: CDN('1d41c6b0-fcc3-4d61-9bc9-f94b63a7ceec') },
    { name: { uz: 'Qog\'oz sumka', ru: 'Бумажный пакет', en: 'Paper Bag' }, path: '/dielines/paper-bag-dielines', img: CDN('4018edb7-78fa-4ceb-a5e8-f9e5b1312510') },
    { name: { uz: 'Qopqoqli quti', ru: 'Коробка с крышкой', en: 'Box with Lid' }, path: '/dielines/box-with-lid-dielines', img: CDN('afa6fd8a-900f-4b93-95a4-8312acb269db') },
    { name: { uz: 'Vitrina qutisi', ru: 'Витрина', en: 'Display Box' }, path: '/dielines/display-box-dielines', img: CDN('6e7cfc70-4b0a-40b7-bbd6-4389dd2eab42') },
    { name: { uz: 'Tray quti', ru: 'Лоток', en: 'Tray Box' }, path: '/dielines/tray-box-dielines', img: CDN('15189d17-ba39-4459-94ff-c7b7048d94da') },
    { name: { uz: 'Rigid quti', ru: 'Жёсткая коробка', en: 'Rigid Box' }, path: '/dielines/rigid-box-dielines', img: CDN('a4200254-ad4f-44fb-8ed3-b7e508f13f21') },
    { name: { uz: 'Konvert', ru: 'Конверт', en: 'Envelope' }, path: '/dielines/envelope-dielines', img: CDN('0a241ba0-45a3-4514-b37a-86bba7d1c53c') },
];

const designCategories = [
    { name: { uz: 'Snack qadoqlar', ru: 'Снеки', en: 'Snack Packaging' }, path: '/design-templates/snack-packaging', img: CDN('4bb14a33-ceca-41f9-b8b4-eaefb1e6f67e') },
    { name: { uz: 'Gazlangan ichimlik', ru: 'Газировка', en: 'Soda Can' }, path: '/design-templates/soda-can', img: CDN('cf8fa48d-252d-4b4b-98d3-6914d7268707') },
    { name: { uz: 'Energetik ichimlik', ru: 'Энергетики', en: 'Energy Drink' }, path: '/design-templates/energy-drink', img: CDN('9f1b938b-a9e3-4c44-9911-0a48f0620016') },
    { name: { uz: 'Hayvon ozuqasi', ru: 'Корм', en: 'Pet Food' }, path: '/design-templates/pet-food', img: CDN('af9db0ef-ab80-4932-9948-bfbbf51b8869') },
    { name: { uz: 'Guruch qadoqlash', ru: 'Рис', en: 'Rice Packaging' }, path: '/design-templates/rice-packaging', img: CDN('c8c744a8-ddc9-4041-a4b5-617bb34572d5') },
];

const partnerLogos = ['LIX', 'amazon', 'Google', 'Canva', 'Apple', 'Tesla', 'STARBUCKS', 'HUAWEI', 'Figma'];

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function PackagingShowcase() {
    const { language } = useLanguage();

    return (
        <section className="relative overflow-hidden bg-white">

            {/* ━━━ 1. Hero + 3 Feature cards with REAL images ━━━ */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
                <div className="flex justify-center mb-6">
                    <a href={PACDORA} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-4 py-2 rounded-full hover:shadow-md transition-all">
                        <Sparkles size={14} />
                        {t('badge', language)}
                        <ExternalLink size={12} className="opacity-50" />
                    </a>
                </div>
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
                        {t('headline1', language)}{' '}
                        <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                            {t('headline2', language)}
                        </span>
                    </h2>
                    <p className="mt-4 text-base sm:text-lg text-gray-500 font-medium">{t('subtitle', language)}</p>
                    <p className="mt-2 text-sm text-emerald-600 font-semibold">{t('freeForUsers', language)}</p>
                </div>

                {/* 3 Feature cards — Pacdora real images */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                    {featureCards.map((card) => {
                        const lines = t(card.titleKey, language).split('\n');
                        return (
                            <a key={card.titleKey} href={card.href} target="_blank" rel="noopener noreferrer"
                               className={`group relative rounded-3xl border-2 border-gray-100 ${card.hoverBorder} bg-gradient-to-br ${card.gradient} overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col`}>
                                {/* Media — video or image */}
                                <div className="relative w-full h-48 lg:h-56 overflow-hidden">
                                    {'video' in card && card.video ? (
                                        <video autoPlay loop muted playsInline className="w-full h-full object-cover" poster={card.img}>
                                            <source src={card.video} type="video/mp4" />
                                        </video>
                                    ) : (
                                        <Image src={card.img} alt={t(card.titleKey, language).replace('\n', ' ')} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 33vw" />
                                    )}
                                </div>
                                {/* Content */}
                                <div className="p-6">
                                    <h3 className="text-xl lg:text-2xl font-extrabold text-gray-900 leading-tight mb-2">
                                        {lines.map((line, i) => (<span key={i}>{line}{i < lines.length - 1 && <br />}</span>))}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-4 leading-relaxed">{t(card.descKey, language)}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="w-8 h-8 rounded-full border-2 border-gray-900 flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white transition-all duration-300">
                                            <ArrowRight size={16} />
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                            <ExternalLink size={10} /> Pacdora AI
                                        </span>
                                    </div>
                                </div>
                            </a>
                        );
                    })}
                </div>
            </div>

            {/* ━━━ 2. Top mockup categories (4×3 grid) with REAL images ━━━ */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <SectionHeading text={t('topMockup', language)} />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 mt-8">
                    {mockupCategories.map((cat) => {
                        const name = cat.name[language as keyof typeof cat.name] || cat.name.uz;
                        return (
                            <a key={cat.path} href={P(cat.path)} target="_blank" rel="noopener noreferrer"
                               className="group bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col">
                                {/* Real Pacdora image */}
                                <div className="relative w-full h-32 sm:h-36 bg-gray-50">
                                    <Image src={cat.img} alt={name} fill className="object-contain p-2 group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 640px) 50vw, 25vw" />
                                </div>
                                <div className="p-4 flex-1 flex flex-col justify-between border-t border-gray-100">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 leading-tight">{name}</h3>
                                        <span className="text-xs text-purple-500 font-semibold">{cat.count}</span>
                                    </div>
                                    <ArrowRight size={16} className="mt-3 text-gray-400 group-hover:text-gray-900 transition-colors" />
                                </div>
                            </a>
                        );
                    })}
                </div>
            </div>

            {/* ━━━ 3. Top dieline templates (4×2 grid) with REAL images ━━━ */}
            <div className="bg-gray-50">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <SectionHeading text={t('topDieline', language)} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 mt-8">
                        {dielineCategories.map((cat) => {
                            const name = cat.name[language as keyof typeof cat.name] || cat.name.uz;
                            return (
                                <a key={cat.path} href={P(cat.path)} target="_blank" rel="noopener noreferrer"
                                   className="group bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col">
                                    <div className="relative w-full h-32 sm:h-40 bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={cat.img}
                                            alt=""
                                            className="max-w-full max-h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                                            loading="lazy"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    </div>
                                    <div className="p-4 border-t border-gray-100">
                                        <h3 className="text-sm font-bold text-gray-900 leading-tight mb-2">{name}</h3>
                                        <ArrowRight size={16} className="text-gray-400 group-hover:text-gray-900 transition-colors" />
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                    <div className="mt-8">
                        <a href={P('/dielines')} target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold px-6 py-3 rounded-full text-sm transition-colors">
                            {t('viewTemplates', language)} <ExternalLink size={14} />
                        </a>
                    </div>
                </div>
            </div>

            {/* ━━━ 4. Stunning tools (split layout — Pacdora style with video) ━━━ */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <SectionHeading text={t('stunningTools', language)} />
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 items-stretch">
                    {/* Left — Video showcase (3/5 width) */}
                    <a href={P('/mockups')} target="_blank" rel="noopener noreferrer"
                       className="lg:col-span-3 group relative rounded-3xl overflow-hidden bg-[#d8d0f0] block">
                        {/* Video */}
                        <video
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover min-h-[320px] lg:min-h-[420px]"
                            poster={CDN('6c715545-713f-41ca-9de3-357b08624921')}
                        >
                            <source src="https://cdn.pacdora.com/ui/topic/fa4c2cf4-7421-477a-964e-7053828a5251.mp4" type="video/mp4" />
                        </video>
                        {/* Bottom tabs */}
                        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm px-6 py-3 flex items-center gap-6 text-sm text-gray-500">
                            {['Mockup', 'Dieline', 'Video', 'Code', 'Share'].map((tab, i) => (
                                <span key={tab} className={`cursor-default ${i === 0 ? 'text-gray-900 font-semibold border-b-2 border-gray-900 pb-0.5' : 'hover:text-gray-700'}`}>{tab}</span>
                            ))}
                        </div>
                    </a>

                    {/* Right — Text content (2/5 width) */}
                    <div className="lg:col-span-2 flex flex-col justify-center py-4 lg:py-8">
                        <h3 className="text-2xl lg:text-3xl font-extrabold text-gray-900 leading-tight mb-5">{t('toolTitle', language)}</h3>
                        <p className="text-gray-500 leading-relaxed mb-3 text-sm lg:text-base">{t('toolDesc', language)}</p>
                        <p className="text-sm text-gray-400 mb-8 italic">Start your creative journey by picking a perfect mockup.</p>
                        <div className="flex flex-wrap gap-3">
                            <a href={P('/mockups')} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold px-7 py-3.5 rounded-lg text-sm transition-colors">
                                {t('toolCta1', language)}
                            </a>
                            <Link href="/catalog"
                                  className="inline-flex items-center gap-2 bg-white border-2 border-gray-900 hover:bg-gray-50 text-gray-900 font-semibold px-7 py-3.5 rounded-lg text-sm transition-colors">
                                {t('toolCta2', language)}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* ━━━ 5. Top design template categories with REAL images ━━━ */}
            <div className="bg-gray-50">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <SectionHeading text={t('topDesign', language)} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 mt-8">
                        {designCategories.map((cat) => {
                            const name = cat.name[language as keyof typeof cat.name] || cat.name.uz;
                            return (
                                <a key={cat.path} href={P(cat.path)} target="_blank" rel="noopener noreferrer"
                                   className="group bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col">
                                    <div className="relative w-full h-32 bg-gradient-to-br from-gray-50 to-white">
                                        <Image src={cat.img} alt={name} fill className="object-contain p-3 group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 640px) 50vw, 20vw" />
                                    </div>
                                    <div className="p-4 border-t border-gray-100">
                                        <h3 className="text-sm font-bold text-gray-900 leading-tight mb-2">{name}</h3>
                                        <ArrowRight size={16} className="text-gray-400 group-hover:text-gray-900 transition-colors" />
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ━━━ 6. Partner logos ━━━ */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-100">
                <div className="flex flex-col items-center">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-8">{t('trustedBy', language)}</p>
                    <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                        {partnerLogos.map((name) => (
                            <span key={name} className="text-lg sm:text-xl font-extrabold text-gray-300 hover:text-gray-500 transition-colors duration-300 select-none cursor-default">{name}</span>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

function SectionHeading({ text }: { text: string }) {
    return (
        <h2 className="flex items-center gap-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900">
            <span className="text-indigo-500 text-3xl lg:text-4xl">→</span>
            {text}
        </h2>
    );
}
