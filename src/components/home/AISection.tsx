'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { Language } from '@/lib/translations';

type L = Record<Language, string>;

const T: Record<string, L> = {
    badge: {
        uz: '✨ Pack24 AI',
        ru: '✨ Pack24 AI',
        en: '✨ Pack24 AI',
        qr: '✨ Pack24 AI',
        zh: '✨ Pack24 AI',
        tr: '✨ Pack24 AI',
        tg: '✨ Pack24 AI',
        kk: '✨ Pack24 AI',
        tk: '✨ Pack24 AI',
        fa: '✨ Pack24 AI',
    },
    heading: {
        uz: "Sun'iy intellekt bilan qadoq maslahat",
        ru: 'Консультация по упаковке с ИИ',
        en: 'Packaging Advice Powered by AI',
        qr: "Jasıq intellekt arqalı qadowlaw másláhátı",
        zh: '人工智能驱动的包装咨询',
        tr: 'Yapay Zeka ile Ambalaj Danışmanlığı',
        tg: 'Машварати бастабандӣ бо AI',
        kk: 'AI арқылы қаптама кеңесі',
        tk: 'AI arkaly gaplama maslahaty',
        fa: 'مشاوره بسته‌بندی با هوش مصنوعی',
    },
    sub: {
        uz: "Pack24 AI 24/7 ishlaydi. Narx, yetkazish, pechat — har qanday savolga darhol javob.",
        ru: 'Pack24 AI работает 24/7. Цена, доставка, печать — мгновенный ответ на любой вопрос.',
        en: 'Pack24 AI works 24/7. Price, delivery, printing — instant answers to any question.',
        qr: "Pack24 AI 24/7 isleydi. Baha, jetkiziw, pechat — hár qanday sorawǵa tez jawap.",
        zh: 'Pack24 AI 24/7运行。价格、配送、印刷——任何问题即时解答。',
        tr: 'Pack24 AI 7/24 çalışıyor. Fiyat, teslimat, baskı — her soruya anında yanıt.',
        tg: 'Pack24 AI 24/7 кор мекунад. Нарх, таҳвил, чоп — ба ҳар савол фавран ҷавоб.',
        kk: 'Pack24 AI 24/7 жұмыс істейді. Баға, жеткізу, баспа — кез келген сұраққа тез жауап.',
        tk: 'Pack24 AI 24/7 işleýär. Baha, eltip bermek, çap — islendik soraga çalt jogap.',
        fa: 'Pack24 AI ۲۴/۷ کار می‌کند. قیمت، تحویل، چاپ — پاسخ فوری به هر سوال.',
    },
    cta: {
        uz: 'AI bilan gaplashing',
        ru: 'Поговорить с AI',
        en: 'Chat with AI',
        qr: 'AI menen sóylesing',
        zh: '与AI对话',
        tr: 'AI ile konuş',
        tg: 'Бо AI гуфтугӯ кунед',
        kk: 'AI-мен сөйлесу',
        tk: 'AI bilen gürleş',
        fa: 'با AI صحبت کنید',
    },
};

const FEATURES = [
    {
        icon: '⚡',
        color: 'from-yellow-500/20 to-orange-500/10',
        border: 'border-yellow-500/20',
        iconBg: 'bg-yellow-500/15',
        title: { uz: 'Tezkor javob', ru: 'Мгновенный ответ', en: 'Instant Response', qr: 'Tez jawap', zh: '即时响应', tr: 'Anında Yanıt', tg: 'Посухи фаврӣ', kk: 'Жедел жауап', tk: 'Çalt jogap', fa: 'پاسخ فوری' } as L,
        sub: { uz: '< 1 soniyada', ru: '< 1 секунды', en: '< 1 second', qr: '< 1 sekunda', zh: '< 1秒', tr: '< 1 saniye', tg: '< 1 сония', kk: '< 1 секунд', tk: '< 1 sekunt', fa: '< ۱ ثانیه' } as L,
    },
    {
        icon: '🌍',
        color: 'from-blue-500/20 to-cyan-500/10',
        border: 'border-blue-500/20',
        iconBg: 'bg-blue-500/15',
        title: { uz: '10 ta til', ru: '10 языков', en: '10 Languages', qr: '10 til', zh: '10种语言', tr: '10 Dil', tg: '10 забон', kk: '10 тіл', tk: '10 dil', fa: '۱۰ زبان' } as L,
        sub: { uz: "Ko'p tilli", ru: 'Мультиязычный', en: 'Multilingual', qr: "Kóp tilli", zh: '多语言', tr: 'Çok dilli', tg: 'Бисёрзабонӣ', kk: 'Көптілді', tk: 'Köp dilli', fa: 'چند زبانه' } as L,
    },
    {
        icon: '🧠',
        color: 'from-purple-500/20 to-pink-500/10',
        border: 'border-purple-500/20',
        iconBg: 'bg-purple-500/15',
        title: { uz: 'Aqlli maslahat', ru: 'Умный советник', en: 'Smart Advisor', qr: 'Aqıllı másláhátshi', zh: '智能顾问', tr: 'Akıllı Danışman', tg: 'Маслаҳатгари ҳушманд', kk: 'Ақылды кеңесші', tk: 'Akylly maslahatçy', fa: 'مشاور هوشمند' } as L,
        sub: { uz: 'Kontekstga asoslangan', ru: 'Контекстный', en: 'Context-aware', qr: 'Kontekstke asaslanǵan', zh: '上下文感知', tr: 'Bağlam odaklı', tg: 'Контексти', kk: 'Контекстке негізделген', tk: 'Kontekste esaslanýan', fa: 'آگاه از زمینه' } as L,
    },
    {
        icon: '🕐',
        color: 'from-emerald-500/20 to-teal-500/10',
        border: 'border-emerald-500/20',
        iconBg: 'bg-emerald-500/15',
        title: { uz: '24/7 Online', ru: '24/7 онлайн', en: '24/7 Online', qr: '24/7 Online', zh: '24/7在线', tr: '24/7 Online', tg: '24/7 онлайн', kk: '24/7 онлайн', tk: '24/7 onlaýn', fa: '۲۴/۷ آنلاین' } as L,
        sub: { uz: 'Hech qachon uhmaydi', ru: 'Никогда не спит', en: 'Never sleeps', qr: 'Heshqashon uqlamaydi', zh: '从不休眠', tr: 'Hiç uyumaz', tg: 'Ҳеҷ гоҳ намехобад', kk: 'Ешқашан ұйықтамайды', tk: 'Hiç uklamaýar', fa: 'هرگز نمی‌خوابد' } as L,
    },
];

// Mock chat messages for animated demo
const DEMO_MESSAGES = [
    { sender: 'user', uz: 'Narxi qancha?', ru: 'Сколько стоит?', en: 'What is the price?' },
    { sender: 'ai', uz: 'Tanlangan konfiguratsiya bo\'yicha jami narx ~500,000 UZS. Miqdorga qarab chegirma beramiz! 💰', ru: 'Стоимость ~500,000 UZS. Скидка зависит от объема! 💰', en: 'Price ~500,000 UZS. Discounts available for bulk orders! 💰' },
    { sender: 'user', uz: 'Minimal buyurtma qancha?', ru: 'Минимальный заказ?', en: 'What is the MOQ?' },
    { sender: 'ai', uz: 'Bizda Zero MOQ! 72 donadan buyurtma qilishingiz mumkin 🎉', ru: 'У нас Zero MOQ! Заказывайте от 72 штук 🎉', en: 'Zero MOQ! Order from just 72 units 🎉' },
];

export default function AISection() {
    const { language } = useLanguage();
    const t = (key: string) => T[key]?.[language] ?? T[key]?.['uz'] ?? key;
    const lbl = (l: L) => l[language] ?? l['en'] ?? l['uz'];

    const [visibleMsgs, setVisibleMsgs] = useState(0);
    const [isInView, setIsInView] = useState(false);
    const sectionRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setIsInView(true); },
            { threshold: 0.3 }
        );
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isInView) return;
        if (visibleMsgs >= DEMO_MESSAGES.length) return;
        const timer = setTimeout(
            () => setVisibleMsgs(prev => prev + 1),
            visibleMsgs === 0 ? 600 : 1200
        );
        return () => clearTimeout(timer);
    }, [isInView, visibleMsgs]);

    const getDemoText = (msg: typeof DEMO_MESSAGES[0]) => {
        const lang = language as keyof typeof msg;
        return (msg[lang] as string) ?? msg.en;
    };

    return (
        <section ref={sectionRef} className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div
                className="rounded-3xl overflow-hidden relative"
                style={{
                    background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 40%, #0f0a1e 100%)',
                    border: '1px solid rgba(255,255,255,0.06)',
                }}
            >
                {/* Background glow blobs */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />
                <div className="absolute top-1/2 left-1/2 w-[600px] h-[300px] pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.04) 0%, transparent 70%)' }} />

                <div className="relative z-10 p-6 lg:p-12">
                    <div className="flex flex-col xl:flex-row gap-12 items-center">

                        {/* ── LEFT: Text + Features ── */}
                        <div className="flex-1 min-w-0">
                            {/* Badge */}
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-6"
                                style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(129,140,248,0.3)', color: 'rgba(199,210,254,0.95)' }}>
                                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                {t('badge')} — {language === 'uz' ? "Sun'iy Intellekt" : language === 'ru' ? 'Искусственный интеллект' : 'Artificial Intelligence'}
                            </div>

                            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4 leading-tight">
                                {t('heading')}
                            </h2>
                            <p className="text-base text-white/50 mb-8 leading-relaxed max-w-lg">
                                {t('sub')}
                            </p>

                            {/* Feature cards */}
                            <div className="grid grid-cols-2 gap-3 mb-8">
                                {FEATURES.map((f, i) => (
                                    <div
                                        key={i}
                                        className={`p-4 rounded-2xl border bg-gradient-to-br ${f.color} ${f.border} transition-all hover:scale-[1.02]`}
                                    >
                                        <div className={`w-9 h-9 ${f.iconBg} rounded-xl flex items-center justify-center text-xl mb-2`}>
                                            {f.icon}
                                        </div>
                                        <p className="text-sm font-bold text-white/90 leading-tight">{lbl(f.title)}</p>
                                        <p className="text-[11px] text-white/40 mt-0.5">{lbl(f.sub)}</p>
                                    </div>
                                ))}
                            </div>

                            {/* CTA */}
                            <button
                                onClick={() => {
                                    const btn = document.getElementById('ai-chat-toggle');
                                    btn?.click();
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
                                style={{
                                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                    boxShadow: '0 8px 30px rgba(79,70,229,0.4)',
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                                </svg>
                                {t('cta')}
                                <span className="px-2 py-0.5 bg-white/15 rounded-lg text-[10px]">24/7</span>
                            </button>
                        </div>

                        {/* ── RIGHT: Animated Chat Demo ── */}
                        <div className="shrink-0 w-full xl:w-[380px]">
                            <div
                                className="rounded-[24px] overflow-hidden"
                                style={{
                                    background: 'rgba(15,23,42,0.7)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                                }}
                            >
                                {/* Chat header */}
                                <div
                                    className="flex items-center gap-3 px-5 py-4 border-b border-white/8"
                                    style={{ background: 'linear-gradient(135deg, rgba(30,27,75,0.9), rgba(30,58,95,0.9))' }}
                                >
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                                            </svg>
                                        </div>
                                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#1e1b4b]" />
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">Pack24 AI</p>
                                        <p className="text-green-300/70 text-[11px]">● Online</p>
                                    </div>
                                    {/* Mac-style dots */}
                                    <div className="ml-auto flex gap-1.5">
                                        {['bg-red-500/70', 'bg-yellow-500/70', 'bg-green-500/70'].map((c, i) => (
                                            <div key={i} className={`w-3 h-3 rounded-full ${c}`} />
                                        ))}
                                    </div>
                                </div>

                                {/* Chat messages */}
                                <div className="p-4 flex flex-col gap-3 min-h-[240px]">
                                    {DEMO_MESSAGES.slice(0, visibleMsgs).map((msg, i) => (
                                        <div
                                            key={i}
                                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                            style={{ animation: 'fadeInUp 0.4s ease-out' }}
                                        >
                                            <div
                                                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed
                                                    ${msg.sender === 'user'
                                                        ? 'text-white rounded-tr-sm'
                                                        : 'text-gray-200 rounded-tl-sm border border-white/10'
                                                    }`}
                                                style={
                                                    msg.sender === 'user'
                                                        ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }
                                                        : { background: 'rgba(255,255,255,0.07)' }
                                                }
                                            >
                                                {getDemoText(msg)}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Typing dot when loading next */}
                                    {isInView && visibleMsgs < DEMO_MESSAGES.length && visibleMsgs % 2 === 1 && (
                                        <div className="flex justify-start">
                                            <div
                                                className="px-4 py-3 rounded-2xl rounded-tl-sm border border-white/10 flex gap-1.5 items-center"
                                                style={{ background: 'rgba(255,255,255,0.07)' }}
                                            >
                                                {[0, 1, 2].map(i => (
                                                    <span
                                                        key={i}
                                                        className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                                                        style={{ animation: 'typingBounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Input preview */}
                                <div
                                    className="px-4 pb-4 pt-2 flex gap-2 border-t border-white/8"
                                    style={{ background: 'rgba(15,23,42,0.6)' }}
                                >
                                    <div
                                        className="flex-1 rounded-xl px-4 py-2.5 text-[12px] text-white/20"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                                    >
                                        {language === 'uz' ? 'Savol yozing...' : language === 'ru' ? 'Введите вопрос...' : 'Type a question...'}
                                    </div>
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                                            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Stats row below chat */}
                            <div className="grid grid-cols-3 gap-3 mt-4">
                                {[
                                    { n: '10+', l: { uz: 'Til', ru: 'Языков', en: 'Languages', qr: 'Til', zh: '语言', tr: 'Dil', tg: 'Забон', kk: 'Тіл', tk: 'Dil', fa: 'زبان' } as L },
                                    { n: '24/7', l: { uz: 'Online', ru: 'Онлайн', en: 'Online', qr: 'Online', zh: '在线', tr: 'Online', tg: 'Онлайн', kk: 'Онлайн', tk: 'Onlaýn', fa: 'آنلاین' } as L },
                                    { n: '<1s', l: { uz: 'Javob', ru: 'Ответ', en: 'Response', qr: 'Jawap', zh: '响应', tr: 'Yanıt', tg: 'Ҷавоб', kk: 'Жауап', tk: 'Jogap', fa: 'پاسخ' } as L },
                                ].map(({ n, l }, i) => (
                                    <div key={i} className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                        <p className="text-lg font-black text-white">{n}</p>
                                        <p className="text-[10px] text-white/40 font-medium mt-0.5">{lbl(l)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes typingBounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                    40%           { transform: translateY(-5px); opacity: 1; }
                }
            `}</style>
        </section>
    );
}
