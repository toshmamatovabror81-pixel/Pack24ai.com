'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import { useSession } from 'next-auth/react';
import {
    Globe, Leaf, TrendingUp, ShieldCheck, DollarSign,
    ArrowRight, Loader2, ChevronDown, BadgeCheck, Recycle, Scale,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CarbonCredit {
    id: number;
    seller: string;
    amount: number;
    pricePerKg: number;
    currency: string;
    listedAt: string;
    status: string;
    verified: boolean;
}

interface MarketStats {
    totalAvailable: number;
    avgPrice: number;
    totalTraded: number;
    activeListings: number;
}

interface ApiResponse {
    credits: CarbonCredit[];
    marketStats: MarketStats;
}

// ─── i18n ─────────────────────────────────────────────────────────────────────
const TX: Record<string, Record<string, string>> = {
    heroTitle: {
        uz: '🌍 Carbon Credit Bozori',
        ru: '🌍 Рынок углеродных кредитов',
        en: '🌍 Carbon Credit Marketplace',
    },
    heroSubtitle: {
        uz: 'Qayta ishlash orqali topilgan karbon kreditlarni sotib oling yoki soting',
        ru: 'Покупайте и продавайте углеродные кредиты, полученные через переработку',
        en: 'Buy and sell carbon credits earned through recycling',
    },
    totalAvailable: {
        uz: 'Jami mavjud',
        ru: 'Всего доступно',
        en: 'Total Available',
    },
    avgPrice: {
        uz: 'O\'rtacha narx',
        ru: 'Средняя цена',
        en: 'Avg Price',
    },
    totalTraded: {
        uz: 'Jami sotilgan',
        ru: 'Всего продано',
        en: 'Total Traded',
    },
    activeListings: {
        uz: 'Faol e\'lonlar',
        ru: 'Активные объявления',
        en: 'Active Listings',
    },
    availableCredits: {
        uz: 'Mavjud kreditlar',
        ru: 'Доступные кредиты',
        en: 'Available Credits',
    },
    seller: {
        uz: 'Sotuvchi',
        ru: 'Продавец',
        en: 'Seller',
    },
    amount: {
        uz: 'Miqdor',
        ru: 'Количество',
        en: 'Amount',
    },
    price: {
        uz: 'Narx',
        ru: 'Цена',
        en: 'Price',
    },
    listedDate: {
        uz: 'Sanasi',
        ru: 'Дата',
        en: 'Date',
    },
    status: {
        uz: 'Holati',
        ru: 'Статус',
        en: 'Status',
    },
    buy: {
        uz: 'Sotib olish',
        ru: 'Купить',
        en: 'Buy',
    },
    verified: {
        uz: 'Tasdiqlangan',
        ru: 'Подтверждено',
        en: 'Verified',
    },
    howItWorks: {
        uz: 'Qanday ishlaydi?',
        ru: 'Как это работает?',
        en: 'How It Works?',
    },
    step1Title: {
        uz: 'Qayta ishlang',
        ru: 'Перерабатывайте',
        en: 'Recycle',
    },
    step1Desc: {
        uz: 'Makulatura va boshqa materiallarni qayta ishlash uchun topshiring',
        ru: 'Сдавайте макулатуру и другие материалы на переработку',
        en: 'Submit wastepaper and other materials for recycling',
    },
    step2Title: {
        uz: 'Kreditlar hosil qiling',
        ru: 'Получите кредиты',
        en: 'Earn Credits',
    },
    step2Desc: {
        uz: 'Har bir qayta ishlangan kilogramm uchun karbon kreditlar oling',
        ru: 'Получайте углеродные кредиты за каждый переработанный килограмм',
        en: 'Earn carbon credits for every kilogram recycled',
    },
    step3Title: {
        uz: 'Bozorda soting',
        ru: 'Продавайте на рынке',
        en: 'Sell on Market',
    },
    step3Desc: {
        uz: 'Kreditlaringizni bozorda boshqa korxonalarga soting',
        ru: 'Продавайте свои кредиты другим предприятиям на рынке',
        en: 'Sell your credits to other businesses on the marketplace',
    },
    sellCredits: {
        uz: 'Kredit sotishga qo\'yish',
        ru: 'Выставить кредиты на продажу',
        en: 'List Credits for Sale',
    },
    amountLabel: {
        uz: 'CO₂ miqdori (kg)',
        ru: 'Количество CO₂ (кг)',
        en: 'CO₂ Amount (kg)',
    },
    priceLabel: {
        uz: 'Narx (UZS/kg)',
        ru: 'Цена (UZS/кг)',
        en: 'Price (UZS/kg)',
    },
    submitListing: {
        uz: 'E\'lonni joylashtirish',
        ru: 'Разместить объявление',
        en: 'Submit Listing',
    },
    submitting: {
        uz: 'Yuborilmoqda...',
        ru: 'Отправка...',
        en: 'Submitting...',
    },
    loginToSell: {
        uz: 'Kredit sotish uchun tizimga kiring',
        ru: 'Войдите для продажи кредитов',
        en: 'Login to sell credits',
    },
    faq: {
        uz: 'Ko\'p beriladigan savollar',
        ru: 'Часто задаваемые вопросы',
        en: 'Frequently Asked Questions',
    },
    faq1Q: {
        uz: 'Carbon credit nima?',
        ru: 'Что такое углеродный кредит?',
        en: 'What is a carbon credit?',
    },
    faq1A: {
        uz: 'Carbon credit — bu 1 kg CO₂ ga teng bo\'lgan atrofga muhit birligidir. Qayta ishlash orqali CO₂ chiqindilarini kamaytirganingizda kreditlar hosil bo\'ladi.',
        ru: 'Углеродный кредит — это экологическая единица, эквивалентная 1 кг CO₂. Кредиты генерируются при сокращении выбросов CO₂ через переработку.',
        en: 'A carbon credit is an environmental unit equivalent to 1 kg of CO₂. Credits are generated when you reduce CO₂ emissions through recycling.',
    },
    faq2Q: {
        uz: 'Kreditlarni qanday olish mumkin?',
        ru: 'Как получить кредиты?',
        en: 'How can I earn credits?',
    },
    faq2A: {
        uz: 'Pack24 platformasi orqali makulatura yoki boshqa qayta ishlanadigan materiallarni topshiring. Har bir kg uchun tizim avtomatik ravishda karbon kreditlar hisoblaydi.',
        ru: 'Сдавайте макулатуру или другие перерабатываемые материалы через платформу Pack24. Система автоматически рассчитает углеродные кредиты за каждый кг.',
        en: 'Submit wastepaper or other recyclable materials through the Pack24 platform. The system automatically calculates carbon credits for each kg.',
    },
    faq3Q: {
        uz: 'Kreditlar narxi qanday belgilanadi?',
        ru: 'Как определяется цена кредитов?',
        en: 'How is the credit price determined?',
    },
    faq3A: {
        uz: 'Narxni sotuvchi o\'zi belgilaydi. Bozor talab va taklif asosida ishlaydi — narxlar erkin shakllanadi.',
        ru: 'Цену устанавливает продавец. Рынок работает на основе спроса и предложения — цены формируются свободно.',
        en: 'The seller sets the price. The market operates on supply and demand — prices are formed freely.',
    },
    faq4Q: {
        uz: 'Kreditlarni kim sotib oladi?',
        ru: 'Кто покупает кредиты?',
        en: 'Who buys credits?',
    },
    faq4A: {
        uz: 'Korxonalar o\'z karbon izini kamaytirish, ESG hisobotlarini yaxshilash va ekologik mas\'uliyatni ko\'rsatish uchun kredit sotib oladi.',
        ru: 'Предприятия покупают кредиты для сокращения углеродного следа, улучшения ESG-отчётности и демонстрации экологической ответственности.',
        en: 'Businesses buy credits to reduce their carbon footprint, improve ESG reporting, and demonstrate environmental responsibility.',
    },
    loadError: {
        uz: 'Ma\'lumotlarni yuklashda xatolik yuz berdi',
        ru: 'Ошибка при загрузке данных',
        en: 'Error loading data',
    },
    retry: {
        uz: 'Qayta urinish',
        ru: 'Повторить',
        en: 'Retry',
    },
    loading: {
        uz: 'Bozor ma\'lumotlari yuklanmoqda...',
        ru: 'Загрузка данных рынка...',
        en: 'Loading market data...',
    },
    sold: {
        uz: 'Sotilgan',
        ru: 'Продано',
        en: 'Sold',
    },
    available: {
        uz: 'Mavjud',
        ru: 'Доступно',
        en: 'Available',
    },
    successMsg: {
        uz: 'E\'lon muvaffaqiyatli joylashtirildi!',
        ru: 'Объявление успешно размещено!',
        en: 'Listing submitted successfully!',
    },
    kgCO2: {
        uz: 'kg CO₂',
        ru: 'кг CO₂',
        en: 'kg CO₂',
    },
    perKg: {
        uz: '/kg',
        ru: '/кг',
        en: '/kg',
    },
};

function t(key: string, lang: string): string {
    return TX[key]?.[lang] || TX[key]?.['uz'] || key;
}

// ─── FAQ Component ────────────────────────────────────────────────────────────
function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-emerald-100 dark:border-emerald-900/40 rounded-xl overflow-hidden transition-all">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors"
            >
                <span className="font-semibold text-gray-900 dark:text-white pr-4">{question}</span>
                <ChevronDown className={`w-5 h-5 text-emerald-600 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <p className="px-5 pb-5 text-gray-600 dark:text-gray-400 leading-relaxed">{answer}</p>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CarbonMarketPage() {
    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const { data: session } = useSession();
    const lang = language || 'uz';

    const [credits, setCredits] = useState<CarbonCredit[]>([]);
    const [stats, setStats] = useState<MarketStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Sell form state
    const [sellAmount, setSellAmount] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const fetchCredits = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/carbon/credits');
            if (!res.ok) throw new Error('Fetch failed');
            const data: ApiResponse = await res.json();
            setCredits(data.credits);
            setStats(data.marketStats);
        } catch {
            setError(t('loadError', lang));
        } finally {
            setLoading(false);
        }
    }, [lang]);

    useEffect(() => {
        fetchCredits();
    }, [fetchCredits]);

    const handleSubmitListing = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(false);

        try {
            const res = await fetch('/api/carbon/credits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: Number(sellAmount),
                    pricePerKg: Number(sellPrice),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setSubmitError(data.error || 'Xatolik');
                return;
            }

            setSubmitSuccess(true);
            setSellAmount('');
            setSellPrice('');
            setTimeout(() => setSubmitSuccess(false), 5000);
        } catch {
            setSubmitError('Server bilan bog\'lanishda xatolik');
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Loading Skeleton ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-background">
                <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 py-20 px-4">
                    <div className="max-w-6xl mx-auto text-center space-y-4">
                        <div className="h-10 w-80 mx-auto bg-white/10 rounded-xl animate-pulse" />
                        <div className="h-5 w-96 mx-auto bg-white/5 rounded-lg animate-pulse" />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 animate-pulse">
                                    <div className="h-4 w-20 bg-white/10 rounded mb-3" />
                                    <div className="h-8 w-24 bg-white/10 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="max-w-6xl mx-auto px-4 py-10 space-y-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                    ))}
                </div>
                <div className="flex items-center justify-center py-8 gap-2 text-emerald-600">
                    <Leaf className="w-5 h-5 animate-bounce" />
                    <span className="text-sm">{t('loading', lang)}</span>
                </div>
            </div>
        );
    }

    // ─── Error State ──────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
                <Globe className="w-16 h-16 text-emerald-300" />
                <p className="text-lg text-gray-600 dark:text-gray-400">{error}</p>
                <button
                    onClick={fetchCredits}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-full transition-colors"
                >
                    {t('retry', lang)}
                </button>
            </div>
        );
    }

    const availableCredits = credits.filter(c => c.status === 'available');

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-background">

            {/* ═══ HERO SECTION ═══ */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 py-16 sm:py-24 px-4">
                {/* Decorative elements */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-500 rounded-full blur-[120px]" />
                    <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-400 rounded-full blur-[150px]" />
                </div>

                <div className="relative z-10 max-w-6xl mx-auto text-center space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-300 text-sm font-medium backdrop-blur-sm">
                        <Leaf className="w-4 h-4" />
                        Pack24 Eco Platform
                    </div>

                    <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
                        {t('heroTitle', lang)}
                    </h1>
                    <p className="text-lg text-emerald-200/80 max-w-2xl mx-auto">
                        {t('heroSubtitle', lang)}
                    </p>

                    {/* ═══ STAT CARDS ═══ */}
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-10 max-w-4xl mx-auto">
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-6 hover:bg-white/10 transition-colors group">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Scale className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs sm:text-sm text-emerald-300/70">{t('totalAvailable', lang)}</span>
                                </div>
                                <p className="text-xl sm:text-3xl font-bold text-white">
                                    {stats.totalAvailable.toLocaleString()} <span className="text-sm font-normal text-emerald-400">kg</span>
                                </p>
                            </div>

                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-6 hover:bg-white/10 transition-colors group">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <DollarSign className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs sm:text-sm text-emerald-300/70">{t('avgPrice', lang)}</span>
                                </div>
                                <p className="text-xl sm:text-3xl font-bold text-white">
                                    {format(stats.avgPrice)}
                                </p>
                            </div>

                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-6 hover:bg-white/10 transition-colors group">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <TrendingUp className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs sm:text-sm text-emerald-300/70">{t('totalTraded', lang)}</span>
                                </div>
                                <p className="text-xl sm:text-3xl font-bold text-white">
                                    {stats.totalTraded.toLocaleString()} <span className="text-sm font-normal text-emerald-400">kg</span>
                                </p>
                            </div>

                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-6 hover:bg-white/10 transition-colors group">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Globe className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs sm:text-sm text-emerald-300/70">{t('activeListings', lang)}</span>
                                </div>
                                <p className="text-xl sm:text-3xl font-bold text-white">
                                    {stats.activeListings}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <div className="max-w-6xl mx-auto px-4 py-10 sm:py-16 space-y-16">

                {/* ═══ AVAILABLE CREDITS TABLE ═══ */}
                <section>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {t('availableCredits', lang)}
                        </h2>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('seller', lang)}</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('amount', lang)}</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('price', lang)}</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('listedDate', lang)}</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('status', lang)}</th>
                                    <th className="text-right px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {availableCredits.map((credit) => (
                                    <tr key={credit.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900 dark:text-white">{credit.seller}</span>
                                                {credit.verified && (
                                                    <BadgeCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-semibold text-gray-900 dark:text-white">
                                                {credit.amount.toLocaleString()}
                                            </span>
                                            <span className="text-xs text-gray-500 ml-1">{t('kgCO2', lang)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                                {format(credit.pricePerKg)}
                                            </span>
                                            <span className="text-xs text-gray-500">{t('perKg', lang)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                            {new Date(credit.listedAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                {t('available', lang)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm hover:shadow">
                                                {t('buy', lang)}
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {availableCredits.map((credit) => (
                            <div key={credit.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-900 dark:text-white">{credit.seller}</span>
                                        {credit.verified && <BadgeCheck className="w-4 h-4 text-emerald-500" />}
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                                        {t('available', lang)}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400 text-xs">{t('amount', lang)}</span>
                                        <p className="font-semibold text-gray-900 dark:text-white">{credit.amount.toLocaleString()} {t('kgCO2', lang)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400 text-xs">{t('price', lang)}</span>
                                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">{format(credit.pricePerKg)}{t('perKg', lang)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                                    <span className="text-xs text-gray-500">
                                        {new Date(credit.listedAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ', {
                                            day: 'numeric', month: 'short',
                                        })}
                                    </span>
                                    <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors">
                                        {t('buy', lang)}
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══ HOW IT WORKS ═══ */}
                <section>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
                            <Recycle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {t('howItWorks', lang)}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Step 1 */}
                        <div className="relative group">
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-6 sm:p-8 text-center hover:shadow-lg hover:-translate-y-1 transition-all">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/50 group-hover:scale-110 transition-transform">
                                    <Recycle className="w-8 h-8 text-white" />
                                </div>
                                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold mb-3">1</div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{t('step1Title', lang)}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t('step1Desc', lang)}</p>
                            </div>
                            {/* Arrow connector (desktop) */}
                            <div className="hidden md:flex absolute top-1/2 -right-3 w-6 items-center justify-center text-emerald-400 z-10">
                                <ArrowRight className="w-6 h-6" />
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="relative group">
                            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 border border-teal-100 dark:border-teal-900/30 rounded-2xl p-6 sm:p-8 text-center hover:shadow-lg hover:-translate-y-1 transition-all">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-200/50 dark:shadow-teal-900/50 group-hover:scale-110 transition-transform">
                                    <Leaf className="w-8 h-8 text-white" />
                                </div>
                                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-teal-600 text-white text-sm font-bold mb-3">2</div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{t('step2Title', lang)}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t('step2Desc', lang)}</p>
                            </div>
                            <div className="hidden md:flex absolute top-1/2 -right-3 w-6 items-center justify-center text-teal-400 z-10">
                                <ArrowRight className="w-6 h-6" />
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="group">
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-6 sm:p-8 text-center hover:shadow-lg hover:-translate-y-1 transition-all">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50 dark:shadow-amber-900/50 group-hover:scale-110 transition-transform">
                                    <DollarSign className="w-8 h-8 text-white" />
                                </div>
                                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white text-sm font-bold mb-3">3</div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{t('step3Title', lang)}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t('step3Desc', lang)}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ SELL CREDITS SECTION ═══ */}
                <section>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {t('sellCredits', lang)}
                        </h2>
                    </div>

                    {session?.user ? (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8 shadow-sm max-w-xl">
                            <form onSubmit={handleSubmitListing} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        {t('amountLabel', lang)}
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100000"
                                        required
                                        value={sellAmount}
                                        onChange={(e) => setSellAmount(e.target.value)}
                                        placeholder="500"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        {t('priceLabel', lang)}
                                    </label>
                                    <input
                                        type="number"
                                        min="100"
                                        max="1000000"
                                        required
                                        value={sellPrice}
                                        onChange={(e) => setSellPrice(e.target.value)}
                                        placeholder="15000"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                                    />
                                </div>

                                {submitError && (
                                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                                        {submitError}
                                    </div>
                                )}

                                {submitSuccess && (
                                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                                        <BadgeCheck className="w-4 h-4" />
                                        {t('successMsg', lang)}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-sm"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {t('submitting', lang)}
                                        </>
                                    ) : (
                                        <>
                                            {t('submitListing', lang)}
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-gray-50 to-emerald-50/30 dark:from-gray-900 dark:to-emerald-950/10 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center max-w-xl">
                            <ShieldCheck className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-400 mb-4">{t('loginToSell', lang)}</p>
                            <a
                                href="/login"
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-full transition-colors"
                            >
                                {lang === 'ru' ? 'Войти' : lang === 'en' ? 'Login' : 'Kirish'}
                                <ArrowRight className="w-4 h-4" />
                            </a>
                        </div>
                    )}
                </section>

                {/* ═══ FAQ SECTION ═══ */}
                <section>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
                            <Globe className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {t('faq', lang)}
                        </h2>
                    </div>

                    <div className="space-y-3 max-w-3xl">
                        <FAQItem question={t('faq1Q', lang)} answer={t('faq1A', lang)} />
                        <FAQItem question={t('faq2Q', lang)} answer={t('faq2A', lang)} />
                        <FAQItem question={t('faq3Q', lang)} answer={t('faq3A', lang)} />
                        <FAQItem question={t('faq4Q', lang)} answer={t('faq4A', lang)} />
                    </div>
                </section>
            </div>
        </div>
    );
}
