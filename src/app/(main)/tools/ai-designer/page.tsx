'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Sparkles,
    Palette,
    Package,
    Ruler,
    Target,
    DollarSign,
    Leaf,
    ArrowRight,
    ArrowLeft,
    Loader2,
    CheckCircle2,
    Printer,
    ShoppingCart,
} from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// ─── i18n ─────────────────────────────────────────────────────
type LangKey = 'uz' | 'ru' | 'en';

const TX: Record<string, Record<LangKey, string>> = {
    pageTitle: {
        uz: 'AI Qadoqlash Dizayneri',
        ru: 'AI Дизайнер Упаковки',
        en: 'AI Packaging Designer',
    },
    pageDesc: {
        uz: 'Mahsulotingiz uchun professional qadoqlash dizayni yarating',
        ru: 'Создайте профессиональный дизайн упаковки для вашего продукта',
        en: 'Create professional packaging design for your product',
    },
    step1Title: {
        uz: 'Mahsulot turi',
        ru: 'Тип продукта',
        en: 'Product Type',
    },
    step2Title: {
        uz: "O'lcham va material",
        ru: 'Размер и материал',
        en: 'Size & Material',
    },
    step3Title: {
        uz: 'Uslub va auditoriya',
        ru: 'Стиль и аудитория',
        en: 'Style & Audience',
    },
    selectProduct: {
        uz: 'Mahsulot turini tanlang',
        ru: 'Выберите тип продукта',
        en: 'Select product type',
    },
    dimensions: {
        uz: "O'lchamlar (mm)",
        ru: 'Размеры (мм)',
        en: 'Dimensions (mm)',
    },
    length: { uz: 'Uzunlik', ru: 'Длина', en: 'Length' },
    width: { uz: 'Kenglik', ru: 'Ширина', en: 'Width' },
    height: { uz: 'Balandlik', ru: 'Высота', en: 'Height' },
    material: { uz: 'Material', ru: 'Материал', en: 'Material' },
    selectMaterial: {
        uz: 'Material tanlang',
        ru: 'Выберите материал',
        en: 'Select material',
    },
    style: { uz: 'Uslub', ru: 'Стиль', en: 'Style' },
    selectStyle: {
        uz: 'Dizayn uslubini tanlang',
        ru: 'Выберите стиль дизайна',
        en: 'Select design style',
    },
    targetAudience: {
        uz: 'Maqsadli auditoriya',
        ru: 'Целевая аудитория',
        en: 'Target Audience',
    },
    targetPlaceholder: {
        uz: 'Masalan: 25-35 yosh, premium segment',
        ru: 'Например: 25-35 лет, премиум сегмент',
        en: 'e.g., 25-35 age, premium segment',
    },
    budget: { uz: 'Byudjet', ru: 'Бюджет', en: 'Budget' },
    budgetLow: { uz: 'Tejamkor', ru: 'Экономный', en: 'Budget' },
    budgetMedium: { uz: "O'rtacha", ru: 'Средний', en: 'Medium' },
    budgetHigh: { uz: 'Premium', ru: 'Премиум', en: 'Premium' },
    next: { uz: 'Keyingi', ru: 'Далее', en: 'Next' },
    back: { uz: 'Orqaga', ru: 'Назад', en: 'Back' },
    generate: {
        uz: 'AI dizayn yaratish',
        ru: 'Создать AI дизайн',
        en: 'Generate AI Design',
    },
    generating: {
        uz: 'AI dizayn yaratmoqda...',
        ru: 'AI создает дизайн...',
        en: 'AI generating design...',
    },
    results: { uz: 'Natijalar', ru: 'Результаты', en: 'Results' },
    aiInsight: { uz: 'AI tavsiya', ru: 'AI рекомендация', en: 'AI Insight' },
    ecoScore: { uz: 'Eko ball', ru: 'Эко балл', en: 'Eco Score' },
    estimatedCost: {
        uz: 'Taxminiy narx',
        ru: 'Примерная стоимость',
        en: 'Estimated Cost',
    },
    perUnit: { uz: '/ dona', ru: '/ шт', en: '/ unit' },
    printType: { uz: 'Bosma turi', ru: 'Тип печати', en: 'Print Type' },
    order: {
        uz: 'Buyurtma berish',
        ru: 'Заказать',
        en: 'Place Order',
    },
    tryAgain: {
        uz: 'Qayta yaratish',
        ru: 'Пересоздать',
        en: 'Regenerate',
    },
    errorAuth: {
        uz: "Iltimos, avval tizimga kiring",
        ru: 'Пожалуйста, сначала войдите в систему',
        en: 'Please log in first',
    },
    errorGeneric: {
        uz: "Xatolik yuz berdi. Qayta urinib ko'ring.",
        ru: 'Произошла ошибка. Попробуйте снова.',
        en: 'An error occurred. Please try again.',
    },
    thinkingLine1: {
        uz: 'AI materiallarni tahlil qilmoqda...',
        ru: 'AI анализирует материалы...',
        en: 'AI analyzing materials...',
    },
    thinkingLine2: {
        uz: 'Dizayn variantlari generatsiya qilinmoqda...',
        ru: 'Генерация вариантов дизайна...',
        en: 'Generating design variants...',
    },
    thinkingLine3: {
        uz: 'Narx va eko-ballni hisoblash...',
        ru: 'Расчет стоимости и эко-рейтинга...',
        en: 'Calculating cost and eco-rating...',
    },
};

// ─── Options ──────────────────────────────────────────────────
const PRODUCT_TYPES: Record<LangKey, string>[] = [
    { uz: 'Oziq-ovqat', ru: 'Продукты питания', en: 'Food' },
    { uz: 'Kosmetika', ru: 'Косметика', en: 'Cosmetics' },
    { uz: 'Elektronika', ru: 'Электроника', en: 'Electronics' },
    { uz: 'Kiyim', ru: 'Одежда', en: 'Clothing' },
    { uz: "Sovg'a", ru: 'Подарки', en: 'Gifts' },
    { uz: 'Boshqa', ru: 'Другое', en: 'Other' },
];

const MATERIALS: Record<LangKey, string>[] = [
    { uz: '1 qatlamli gofra', ru: '1-слойный гофрокартон', en: '1-layer corrugated' },
    { uz: '3 qatlamli gofra', ru: '3-слойный гофрокартон', en: '3-layer corrugated' },
    { uz: '5 qatlamli gofra', ru: '5-слойный гофрокартон', en: '5-layer corrugated' },
    { uz: 'Karton', ru: 'Картон', en: 'Cardboard' },
    { uz: 'Kraft', ru: 'Крафт', en: 'Kraft' },
];

const STYLES: Record<LangKey, string>[] = [
    { uz: 'Minimalist', ru: 'Минимализм', en: 'Minimalist' },
    { uz: 'Premium', ru: 'Премиум', en: 'Premium' },
    { uz: 'Eko', ru: 'Эко', en: 'Eco' },
    { uz: 'Rangli', ru: 'Яркий', en: 'Colorful' },
];

const MATERIAL_KEYS = [
    '1-qatlamli',
    '3-qatlamli',
    '5-qatlamli',
    'karton',
    'kraft',
];

const STYLE_KEYS = ['Minimalist', 'Premium', 'Eko', 'Rangli'];

// ─── Types ────────────────────────────────────────────────────
interface EstimatedCost {
    min: number;
    max: number;
    currency: string;
}

interface Suggestion {
    title: string;
    description: string;
    material: string;
    printType: string;
    estimatedCost: EstimatedCost;
    ecoScore: number;
    features: string[];
}

// ─── Eco Score Circle ─────────────────────────────────────────
function EcoScoreCircle({ score }: { score: number }) {
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color =
        score >= 80
            ? 'text-emerald-500'
            : score >= 60
              ? 'text-yellow-500'
              : 'text-red-500';
    const strokeColor =
        score >= 80 ? '#10b981' : score >= 60 ? '#eab308' : '#ef4444';

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width="72" height="72" className="-rotate-90">
                <circle
                    cx="36"
                    cy="36"
                    r={radius}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="5"
                />
                <circle
                    cx="36"
                    cy="36"
                    r={radius}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="5"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-lg font-bold ${color}`}>{score}</span>
            </div>
        </div>
    );
}

// ─── Step Indicator ───────────────────────────────────────────
function StepIndicator({
    currentStep,
    lang,
}: {
    currentStep: number;
    lang: LangKey;
}) {
    const steps = [
        { icon: Package, label: TX.step1Title[lang] },
        { icon: Ruler, label: TX.step2Title[lang] },
        { icon: Palette, label: TX.step3Title[lang] },
    ];

    return (
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
            {steps.map((step, i) => {
                const Icon = step.icon;
                const isActive = i + 1 === currentStep;
                const isCompleted = i + 1 < currentStep;
                return (
                    <React.Fragment key={i}>
                        {i > 0 && (
                            <div
                                className={`h-0.5 w-8 sm:w-16 transition-colors duration-300 ${
                                    isCompleted
                                        ? 'bg-violet-500'
                                        : 'bg-gray-200'
                                }`}
                            />
                        )}
                        <div className="flex flex-col items-center gap-1.5">
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                                    isActive
                                        ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30'
                                        : isCompleted
                                          ? 'bg-violet-100 text-violet-600'
                                          : 'bg-gray-100 text-gray-400'
                                }`}
                            >
                                {isCompleted ? (
                                    <CheckCircle2 size={18} />
                                ) : (
                                    <Icon size={18} />
                                )}
                            </div>
                            <span
                                className={`text-[11px] font-medium hidden sm:block ${
                                    isActive
                                        ? 'text-violet-700'
                                        : isCompleted
                                          ? 'text-violet-500'
                                          : 'text-gray-400'
                                }`}
                            >
                                {step.label}
                            </span>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ─── Page Component ───────────────────────────────────────────
export default function AIDesignerPage() {
    const { language } = useLanguage();
    const lang = (['uz', 'ru', 'en'].includes(language) ? language : 'en') as LangKey;

    const t = (key: string) => TX[key]?.[lang] ?? TX[key]?.['en'] ?? key;

    // ── State ──
    const [step, setStep] = useState(1);
    const [productType, setProductType] = useState('');
    const [dimensions, setDimensions] = useState({ length: 300, width: 200, height: 150 });
    const [material, setMaterial] = useState('');
    const [style, setStyle] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [budget, setBudget] = useState('medium');

    const [isLoading, setIsLoading] = useState(false);
    const [thinkingStep, setThinkingStep] = useState(0);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [aiInsight, setAiInsight] = useState('');
    const [error, setError] = useState('');
    const [showResults, setShowResults] = useState(false);

    // ── Validation ──
    const canGoNext = () => {
        if (step === 1) return !!productType;
        if (step === 2) return !!material && dimensions.length > 0 && dimensions.width > 0 && dimensions.height > 0;
        if (step === 3) return !!style;
        return false;
    };

    // ── Generate ──
    const handleGenerate = async () => {
        setIsLoading(true);
        setError('');
        setThinkingStep(0);

        // Thinking animation
        const interval = setInterval(() => {
            setThinkingStep((prev) => (prev < 2 ? prev + 1 : prev));
        }, 1500);

        try {
            const res = await fetch('/api/ai/design', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productType,
                    dimensions,
                    material: MATERIAL_KEYS[MATERIALS.findIndex((m) => m[lang] === material)] || material,
                    style: STYLE_KEYS[STYLES.findIndex((s) => s[lang] === style)] || style,
                    targetAudience,
                    budget,
                }),
            });

            clearInterval(interval);

            if (res.status === 401) {
                setError(t('errorAuth'));
                setIsLoading(false);
                return;
            }

            if (!res.ok) {
                throw new Error('API error');
            }

            const data = await res.json();
            setSuggestions(data.suggestions || []);
            setAiInsight(data.aiInsight || '');
            setShowResults(true);
        } catch {
            clearInterval(interval);
            setError(t('errorGeneric'));
        } finally {
            setIsLoading(false);
            setThinkingStep(0);
        }
    };

    const handleReset = () => {
        setShowResults(false);
        setSuggestions([]);
        setAiInsight('');
        setStep(1);
    };

    // ─── Render Results ────────
    if (showResults && suggestions.length > 0) {
        return (
            <div className="min-h-screen bg-surface-page">
                {/* Header */}
                <section className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white py-12 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.1),_transparent_70%)]" />
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-semibold text-purple-200 mb-4">
                            <Sparkles size={12} className="text-yellow-400" />
                            {t('results')}
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-extrabold mb-3">
                            {t('pageTitle')}
                        </h1>
                    </div>
                </section>

                <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                    {/* AI Insight */}
                    {aiInsight && (
                        <Card className="mb-8 border-violet-200 bg-violet-50/50">
                            <div className="flex items-start gap-3 p-5">
                                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0">
                                    <Sparkles size={18} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-violet-900 mb-1">{t('aiInsight')}</h3>
                                    <p className="text-sm text-violet-700 leading-relaxed">{aiInsight}</p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Suggestion Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {suggestions.map((s, i) => (
                            <Card
                                key={i}
                                noPadding
                                className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col"
                            >
                                {/* Card Header Gradient */}
                                <div
                                    className={`p-6 relative overflow-hidden ${
                                        i === 0
                                            ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                                            : i === 1
                                              ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                                              : 'bg-gradient-to-br from-orange-500 to-rose-500'
                                    }`}
                                >
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2" />
                                    <h3 className="text-xl font-bold text-white relative z-10">
                                        {s.title}
                                    </h3>
                                    <p className="text-white/80 text-sm mt-2 relative z-10 line-clamp-3">
                                        {s.description}
                                    </p>
                                </div>

                                {/* Card Body */}
                                <div className="p-6 flex flex-col flex-1">
                                    {/* Material & Print */}
                                    <div className="space-y-3 mb-5">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Package size={14} className="text-gray-400 shrink-0" />
                                            <span className="text-gray-600">{s.material}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Printer size={14} className="text-gray-400 shrink-0" />
                                            <span className="text-gray-500">{t('printType')}:</span>
                                            <span className="font-medium text-gray-700">{s.printType}</span>
                                        </div>
                                    </div>

                                    {/* Eco Score & Cost */}
                                    <div className="flex items-center justify-between mb-5 p-4 bg-gray-50 rounded-xl">
                                        <div className="text-center">
                                            <EcoScoreCircle score={s.ecoScore} />
                                            <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1 justify-center">
                                                <Leaf size={10} /> {t('ecoScore')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-gray-400 mb-1">
                                                <DollarSign size={12} />
                                                <span className="text-[11px]">{t('estimatedCost')}</span>
                                            </div>
                                            <p className="text-lg font-bold text-gray-900">
                                                {s.estimatedCost.min.toLocaleString()} – {s.estimatedCost.max.toLocaleString()}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {s.estimatedCost.currency} {t('perUnit')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Features */}
                                    <div className="flex flex-wrap gap-1.5 mb-5">
                                        {s.features.map((f, j) => (
                                            <span
                                                key={j}
                                                className="text-[11px] bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full font-medium border border-violet-100"
                                            >
                                                {f}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Order Button */}
                                    <div className="mt-auto">
                                        <Link
                                            href="/contact"
                                            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold py-3 px-4 rounded-xl hover:opacity-90 transition-all hover:-translate-y-0.5 shadow-md shadow-violet-500/20"
                                        >
                                            <ShoppingCart size={16} />
                                            {t('order')}
                                        </Link>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>

                    {/* Regenerate */}
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={handleReset}
                            className="gap-2"
                        >
                            <Sparkles size={16} />
                            {t('tryAgain')}
                        </Button>
                    </div>
                </section>
            </div>
        );
    }

    // ─── Render Wizard ────────
    return (
        <div className="min-h-screen bg-surface-page">
            {/* Hero */}
            <section className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white py-16 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.1),_transparent_70%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(139,92,246,0.3),_transparent_70%)]" />
                <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-semibold text-purple-200 mb-6">
                        <Sparkles size={12} className="text-yellow-400" />
                        AI
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-extrabold mb-4">{t('pageTitle')}</h1>
                    <p className="text-lg text-purple-100/80 max-w-xl mx-auto">{t('pageDesc')}</p>
                </div>
            </section>

            {/* Wizard */}
            <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
                <StepIndicator currentStep={step} lang={lang} />

                {/* Loading Overlay */}
                {isLoading && (
                    <Card className="mb-8 border-violet-200">
                        <div className="flex flex-col items-center py-12 px-6">
                            <div className="relative mb-6">
                                <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center animate-pulse">
                                    <Sparkles size={32} className="text-white" />
                                </div>
                                <Loader2 size={80} className="absolute -top-0 -left-0 text-violet-300 animate-spin" />
                            </div>
                            <p className="text-lg font-semibold text-gray-900 mb-4">{t('generating')}</p>
                            <div className="space-y-2 w-full max-w-sm">
                                {[t('thinkingLine1'), t('thinkingLine2'), t('thinkingLine3')].map(
                                    (line, i) => (
                                        <div
                                            key={i}
                                            className={`flex items-center gap-2 text-sm transition-all duration-500 ${
                                                i <= thinkingStep
                                                    ? 'text-violet-700 opacity-100'
                                                    : 'text-gray-300 opacity-50'
                                            }`}
                                        >
                                            {i <= thinkingStep ? (
                                                <CheckCircle2 size={14} className="text-violet-500 shrink-0" />
                                            ) : (
                                                <Loader2 size={14} className="text-gray-300 shrink-0 animate-spin" />
                                            )}
                                            {line}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </Card>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                        {error}
                    </div>
                )}

                {!isLoading && (
                    <Card className="p-6 sm:p-8">
                        {/* Step 1: Product Type */}
                        {step === 1 && (
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                                    <Package size={20} className="text-violet-600" />
                                    {t('step1Title')}
                                </h2>
                                <p className="text-sm text-gray-500 mb-6">{t('selectProduct')}</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {PRODUCT_TYPES.map((pt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setProductType(pt[lang])}
                                            className={`p-4 rounded-xl border-2 text-sm font-medium transition-all hover:-translate-y-0.5 ${
                                                productType === pt[lang]
                                                    ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-md shadow-violet-500/10'
                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-violet-300'
                                            }`}
                                        >
                                            {pt[lang]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Dimensions & Material */}
                        {step === 2 && (
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                                    <Ruler size={20} className="text-violet-600" />
                                    {t('step2Title')}
                                </h2>
                                <p className="text-sm text-gray-500 mb-6">{t('dimensions')}</p>

                                <div className="grid grid-cols-3 gap-3 mb-6">
                                    {(['length', 'width', 'height'] as const).map((dim) => (
                                        <div key={dim}>
                                            <label className="block text-xs font-medium text-gray-500 mb-1.5">
                                                {t(dim)} (mm)
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={2000}
                                                value={dimensions[dim]}
                                                onChange={(e) =>
                                                    setDimensions((prev) => ({
                                                        ...prev,
                                                        [dim]: Math.max(0, parseInt(e.target.value) || 0),
                                                    }))
                                                }
                                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                                        <Package size={12} />
                                        {t('material')}
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {MATERIALS.map((m, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setMaterial(m[lang])}
                                                className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                                                    material === m[lang]
                                                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                                                        : 'border-gray-200 bg-white text-gray-700 hover:border-violet-300'
                                                }`}
                                            >
                                                {m[lang]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Style & Audience */}
                        {step === 3 && (
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                                    <Palette size={20} className="text-violet-600" />
                                    {t('step3Title')}
                                </h2>
                                <p className="text-sm text-gray-500 mb-6">{t('selectStyle')}</p>

                                {/* Style */}
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {STYLES.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setStyle(s[lang])}
                                            className={`p-4 rounded-xl border-2 text-sm font-medium transition-all hover:-translate-y-0.5 ${
                                                style === s[lang]
                                                    ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-md shadow-violet-500/10'
                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-violet-300'
                                            }`}
                                        >
                                            {s[lang]}
                                        </button>
                                    ))}
                                </div>

                                {/* Target Audience */}
                                <div className="mb-6">
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                                        <Target size={12} />
                                        {t('targetAudience')}
                                    </label>
                                    <input
                                        type="text"
                                        value={targetAudience}
                                        onChange={(e) => setTargetAudience(e.target.value)}
                                        placeholder={t('targetPlaceholder')}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                    />
                                </div>

                                {/* Budget */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                                        <DollarSign size={12} />
                                        {t('budget')}
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['low', 'medium', 'high'] as const).map((b) => (
                                            <button
                                                key={b}
                                                onClick={() => setBudget(b)}
                                                className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                                                    budget === b
                                                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                                                        : 'border-gray-200 bg-white text-gray-700 hover:border-violet-300'
                                                }`}
                                            >
                                                {t(`budget${b.charAt(0).toUpperCase() + b.slice(1)}`)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                            {step > 1 ? (
                                <Button
                                    variant="ghost"
                                    onClick={() => setStep((s) => s - 1)}
                                    className="gap-2 text-gray-600"
                                >
                                    <ArrowLeft size={16} />
                                    {t('back')}
                                </Button>
                            ) : (
                                <div />
                            )}

                            {step < 3 ? (
                                <Button
                                    variant="primary"
                                    onClick={() => setStep((s) => s + 1)}
                                    disabled={!canGoNext()}
                                    className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0"
                                >
                                    {t('next')}
                                    <ArrowRight size={16} />
                                </Button>
                            ) : (
                                <Button
                                    variant="primary"
                                    onClick={handleGenerate}
                                    disabled={!canGoNext() || isLoading}
                                    className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0"
                                >
                                    <Sparkles size={16} />
                                    {t('generate')}
                                </Button>
                            )}
                        </div>
                    </Card>
                )}
            </section>
        </div>
    );
}
