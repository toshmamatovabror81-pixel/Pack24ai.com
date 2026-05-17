'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useState, useCallback } from 'react';
import {
    ChevronRight, Sparkles, RefreshCw, Download, Image as ImageIcon,
    ZoomIn, Check, Wand2, Copy, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const STYLE_OPTIONS = [
    { id: 'minimalist',  uz: 'Minimalist',    ru: 'Минималист',    emoji: '⬜' },
    { id: 'luxury',      uz: 'Hashamatli',    ru: 'Роскошный',     emoji: '✨' },
    { id: 'eco',         uz: 'Ekologik',      ru: 'Экологичный',   emoji: '🌿' },
    { id: 'bold',        uz: 'Dadil',         ru: 'Дерзкий',       emoji: '🎨' },
    { id: 'vintage',     uz: 'Vintage',       ru: 'Ретро',         emoji: '🎞️' },
    { id: 'playful',     uz: 'Quvnoq',        ru: 'Игривый',       emoji: '🎉' },
    { id: 'corporate',   uz: 'Korporativ',    ru: 'Корпоративный', emoji: '💼' },
    { id: 'modern',      uz: 'Zamonaviy',     ru: 'Современный',   emoji: '🔷' },
];

const EXAMPLE_PROMPTS = [
    { uz: "Muzqaymoq brendi uchun qadoq",   ru: "Упаковка для бренда мороженого" },
    { uz: "Ekologik qahva to'plami",         ru: "Экологичный кофейный набор" },
    { uz: "Hashamatli parfyum qutisi",       ru: "Роскошная коробка для парфюма" },
    { uz: "Minimalist choy qadoqlash",       ru: "Минималистичная упаковка для чая" },
    { uz: "Vitamin shisha dizayni",          ru: "Дизайн флакона для витаминов" },
];

interface ImageResult {
    index: number;
    seed: number;
    dataUrl: string;
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function AIDesignPage() {
    const { language } = useLanguage();
    const [prompt, setPrompt] = useState('');
    const [selectedStyle, setSelectedStyle] = useState('minimalist');
    const [isGenerating, setIsGenerating] = useState(false);
    const [results, setResults] = useState<ImageResult[]>([]);
    const [selectedImg, setSelectedImg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const t = (uz: string, ru: string) => language === 'ru' ? ru : uz;

    // ── Generate via server-side proxy ────────────────────────
    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setResults([]);
        setSelectedImg(null);
        setError(null);

        try {
            const res = await fetch('/api/tools/ai-design/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt.trim(), style: selectedStyle, count: 4 }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Xato' }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            setResults(data.images ?? []);

            if ((data.images ?? []).length === 0) {
                setError(t('Hech qanday rasm yuklanmadi. Qayta urining.', 'Ни одного изображения не загружено. Попробуйте снова.'));
            } else {
                toast.success(t(
                    `${data.loaded}/${data.total} ta variant yaratildi!`,
                    `Создано ${data.loaded}/${data.total} вариантов!`
                ));
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Noma\'lum xato';
            setError(msg);
            toast.error(t('Yaratishda xato: ' + msg, 'Ошибка: ' + msg));
        } finally {
            setIsGenerating(false);
        }
    }, [prompt, selectedStyle, language]);

    // ── Download ──────────────────────────────────────────────
    const handleDownload = (dataUrl: string, index: number) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `pack24-ai-design-variant-${index}.jpg`;
        a.click();
        toast.success(t('Yuklab olindi!', 'Скачано!'));
    };

    // ── Copy (save as URL hint) ───────────────────────────────
    const handleCopy = (dataUrl: string) => {
        // Copy prompt + style as useful info
        const info = `Prompt: ${prompt} | Style: ${selectedStyle}`;
        navigator.clipboard.writeText(info).then(() => {
            toast.success(t('Prompt nusxalandi!', 'Промпт скопирован!'));
        });
    };

    return (
        <div className="min-h-screen bg-[#f5f6fa]">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 py-6">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <Link href="/tools" className="hover:text-blue-600">{t('Asboblar', 'Инструменты')}</Link>
                        <ChevronRight size={14} />
                        <span className="text-gray-700 font-medium">AI Packaging Design</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center">
                            <Sparkles size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-900">
                                {t('AI Qadoq Dizayni', 'AI Дизайн упаковки')}
                            </h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('Matn orqali professional qadoq dizaynlari yarating', 'Создавайте профессиональные дизайны упаковок по тексту')}
                                {' '}· <span className="text-emerald-500 font-semibold">{t('Bepul · API talab qilmaydi', 'Бесплатно · Без API ключа')}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col xl:flex-row gap-8">

                    {/* ── LEFT ───────────────────────────────────────────── */}
                    <div className="flex-1 min-w-0 space-y-6">

                        {/* Prompt input */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                            <label className="block text-sm font-bold text-gray-800 mb-3">
                                {t('Qadoqni tasvirlab bering', 'Опишите упаковку')}
                            </label>
                            <div className="relative">
                                <textarea
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value.slice(0, 300))}
                                    placeholder={t(
                                        "Masalan: Organik asal brendi uchun minimalist stil qadoq, yashil va oltin ranglar, ekologik material...",
                                        "Например: Минималистичная упаковка для бренда органического мёда, зелёные и золотые цвета..."
                                    )}
                                    rows={4}
                                    className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
                                />
                                <div className="absolute bottom-3 right-3 text-xs text-gray-300">{prompt.length}/300</div>
                            </div>

                            {/* Example prompts */}
                            <div className="mt-3">
                                <p className="text-xs text-gray-400 mb-2">{t('Namunalar:', 'Примеры:')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {EXAMPLE_PROMPTS.map((p, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setPrompt(language === 'ru' ? p.ru : p.uz)}
                                            className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full border border-orange-100 transition-colors"
                                        >
                                            {language === 'ru' ? p.ru : p.uz}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={!prompt.trim() || isGenerating}
                                className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition-all hover:opacity-90 active:scale-[0.98] shadow-lg shadow-orange-200"
                            >
                                {isGenerating ? (
                                    <><RefreshCw size={16} className="animate-spin" /> {t('Yaratilmoqda... (30s gacha)', 'Генерация... (до 30 сек)')}</>
                                ) : (
                                    <><Wand2 size={16} /> {t('4 ta variant yaratish', 'Создать 4 варианта')}</>
                                )}
                            </button>

                            {isGenerating && (
                                <div className="mt-3 flex items-center gap-2 text-xs text-orange-500">
                                    <RefreshCw size={11} className="animate-spin" />
                                    {t(
                                        'AI rasm generatsiya qilmoqda. Bu 10-30 soniya davom etishi mumkin...',
                                        'AI генерирует изображения. Это может занять 10-30 секунд...'
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Style selector */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                            <p className="text-sm font-bold text-gray-800 mb-4">
                                {t('Dizayn uslubi', 'Стиль дизайна')}
                            </p>
                            <div className="grid grid-cols-4 gap-2">
                                {STYLE_OPTIONS.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setSelectedStyle(s.id)}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all relative ${
                                            selectedStyle === s.id
                                                ? 'border-orange-500 bg-orange-50'
                                                : 'border-gray-100 hover:border-orange-200 hover:bg-orange-50/50'
                                        }`}
                                    >
                                        <span className="text-2xl">{s.emoji}</span>
                                        <span className="text-[10px] font-semibold text-gray-700 text-center">
                                            {language === 'ru' ? s.ru : s.uz}
                                        </span>
                                        {selectedStyle === s.id && (
                                            <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                                                <Check size={9} className="text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Error state */}
                        {error && !isGenerating && (
                            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-red-800">{t('Xato yuz berdi', 'Произошла ошибка')}</p>
                                    <p className="text-xs text-red-600 mt-0.5">{error}</p>
                                    <button onClick={handleGenerate}
                                        className="mt-2 text-xs font-bold text-red-600 hover:text-red-800 underline">
                                        {t('Qayta urining', 'Попробовать снова')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Results */}
                        {results.length > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-sm font-bold text-gray-800">
                                        {t('AI yaratgan variantlar', 'Варианты от AI')}
                                        <span className="ml-2 text-xs text-emerald-500 font-normal">
                                            {results.length} {t("ta", "")}
                                        </span>
                                    </p>
                                    <button onClick={handleGenerate}
                                        className="text-xs text-orange-600 flex items-center gap-1 hover:text-orange-700">
                                        <RefreshCw size={12} /> {t('Qayta yaratish', 'Перегенерировать')}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {results.map((r) => (
                                        <div key={r.seed} className="relative group rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                                            <img
                                                src={r.dataUrl}
                                                alt={`Variant ${r.index}`}
                                                className="w-full h-48 object-cover"
                                            />
                                            {/* Hover overlay */}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                                <p className="text-white text-xs font-bold">Variant {r.index}</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setSelectedImg(r.dataUrl)}
                                                        aria-label={t('Kattalashtirish', 'Увеличить')}
                                                        className="p-2 bg-white/90 rounded-xl hover:bg-white"
                                                    >
                                                        <ZoomIn size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(r.dataUrl, r.index)}
                                                        aria-label={t('Yuklab olish', 'Скачать')}
                                                        className="p-2 bg-white/90 rounded-xl hover:bg-white"
                                                    >
                                                        <Download size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleCopy(r.dataUrl)}
                                                        aria-label={t('Nusxa olish', 'Копировать')}
                                                        className="p-2 bg-white/90 rounded-xl hover:bg-white"
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-400 text-center mt-3">
                                    {t('Pollinations AI tomonidan yaratildi · Bepul foydalanish', 'Создано с помощью Pollinations AI · Бесплатно')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── RIGHT ──────────────────────────────────────────── */}
                    <div className="xl:w-72 flex-shrink-0 space-y-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <p className="text-sm font-bold text-gray-800 mb-4">
                                {t('Qanday ishlaydi?', 'Как это работает?')}
                            </p>
                            <div className="space-y-4">
                                {[
                                    { step: '1', uz: "Qadoqni tasvirlab bering (inglizcha aniqroq)", ru: "Опишите упаковку (на английском точнее)", icon: '✏️' },
                                    { step: '2', uz: "Dizayn uslubini tanlang (minimalist, hashamatli, eco...)", ru: "Выберите стиль дизайна", icon: '🎨' },
                                    { step: '3', uz: "\"4 ta variant yaratish\" tugmasini bosing", ru: "Нажмите «Создать 4 варианта»", icon: '✨' },
                                    { step: '4', uz: "10-30 soniya kuting va yuklab oling", ru: "Подождите 10-30 секунд и скачайте", icon: '📥' },
                                ].map(({ step, uz, ru, icon }) => (
                                    <div key={step} className="flex items-start gap-3">
                                        <div className="w-7 h-7 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0">
                                            {step}
                                        </div>
                                        <p className="text-xs text-gray-600 leading-relaxed pt-0.5">
                                            <span className="mr-1">{icon}</span>
                                            {language === 'ru' ? ru : uz}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tips */}
                        <div className="bg-gradient-to-br from-orange-50 to-rose-50 border border-orange-100 rounded-2xl p-5">
                            <p className="text-xs font-bold text-orange-700 mb-2">💡 {t('Maslahat', 'Совет')}</p>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                {t(
                                    "Ingliz tilida tavsif ko'proq aniqlik beradi. Masalan: \"luxury perfume box, black and gold, minimalist\"",
                                    "Описание на английском даёт больше точности. Например: \"luxury perfume box, black and gold, minimalist\""
                                )}
                            </p>
                        </div>

                        {/* API info */}
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                            <p className="text-xs font-bold text-blue-700 mb-1">⚡ {t('Texnologiya', 'Технология')}</p>
                            <p className="text-[10px] text-blue-600 leading-relaxed">
                                {t(
                                    'Pollinations.ai tomonidan quvvatlangan. Bepul, tezkor, API key siz. Server orqali yuklash — CORS muammosiz.',
                                    'Работает на Pollinations.ai. Бесплатно, быстро, без API ключа. Загрузка через сервер — без проблем CORS.'
                                )}
                            </p>
                        </div>

                        <Link href="/tools/mockup-generator" className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-orange-200 hover:shadow-sm transition-all group">
                            <div>
                                <p className="text-sm font-semibold text-gray-800">
                                    {t("3D Mockupga qo'llash", "Применить к 3D Mockup")}
                                </p>
                                <p className="text-xs text-gray-400">Mockup Generator</p>
                            </div>
                            <ChevronRight size={16} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
                        </Link>

                        <Link href="/tools" className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-orange-200 hover:shadow-sm transition-all group">
                            <div>
                                <p className="text-sm font-semibold text-gray-800">{t('Boshqa asboblar', 'Другие инструменты')}</p>
                                <p className="text-xs text-gray-400">Mockup, Dieline, 3D...</p>
                            </div>
                            <ChevronRight size={16} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Lightbox */}
            {selectedImg && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setSelectedImg(null)}
                >
                    <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                        <img src={selectedImg} alt="Kattalashtirish" className="w-full rounded-2xl shadow-2xl" />
                        <div className="flex gap-2 mt-3 justify-center">
                            <button
                                onClick={() => { const idx = results.findIndex(r => r.dataUrl === selectedImg); handleDownload(selectedImg, idx + 1); }}
                                className="flex items-center gap-2 bg-white text-gray-800 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-50"
                            >
                                <Download size={14} /> {t('Yuklab olish', 'Скачать')}
                            </button>
                            <button
                                onClick={() => setSelectedImg(null)}
                                className="bg-gray-800 text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-700"
                            >
                                {t('Yopish', 'Закрыть')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
