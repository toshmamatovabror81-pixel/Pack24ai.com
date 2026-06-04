'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import Image from 'next/image';
import Link from 'next/link';
import {
    Leaf,
    Recycle,
    Factory,
    Truck,
    ShieldCheck,
    Package,
    ArrowRight,
    CheckCircle2,
    Clock,
    CircleDashed,
    Loader2,
    AlertCircle,
    Box,
} from 'lucide-react';
import type { Language } from '@/lib/translations';

// ── i18n ─────────────────────────────────────────────────────────────────────
const TX: Record<string, Partial<Record<Language, string>>> = {
    pageTitle:       { uz: 'Mahsulot hayot sikli',       ru: 'Жизненный цикл продукта',         en: 'Product Lifecycle' },
    loading:         { uz: 'Yuklanmoqda...',              ru: 'Загрузка...',                     en: 'Loading...' },
    error:           { uz: "Ma'lumot yuklanmadi",         ru: 'Ошибка загрузки',                 en: 'Failed to load' },
    notFound:        { uz: 'Kod topilmadi',               ru: 'Код не найден',                   en: 'Code not found' },
    retry:           { uz: 'Qayta urinish',              ru: 'Повторить',                       en: 'Retry' },
    ecoImpact:       { uz: 'Ekologik ta\'sir',           ru: 'Экологическое воздействие',       en: 'Eco Impact' },
    recycledContent: { uz: 'Qayta ishlangan material',   ru: 'Переработанное содержание',       en: 'Recycled Content' },
    recyclable:      { uz: 'Qayta ishlanadi',            ru: 'Перерабатываемый',                en: 'Recyclable' },
    co2Saved:        { uz: 'Tejangan CO₂',              ru: 'Сэкономлено CO₂',                en: 'CO₂ Saved' },
    ctaRecycle:      { uz: 'Bu qutini qayta ishlashga topshiring', ru: 'Сдайте эту коробку на переработку', en: 'Submit this box for recycling' },
    poweredBy:       { uz: 'Pack24 tomonidan',           ru: 'От Pack24',                       en: 'Powered by Pack24' },
    product:         { uz: 'Mahsulot',                   ru: 'Продукт',                        en: 'Product' },
    completed:       { uz: 'Bajarildi',                  ru: 'Завершено',                      en: 'Completed' },
    inProgress:      { uz: 'Jarayonda',                  ru: 'В процессе',                     en: 'In Progress' },
    pending:         { uz: 'Kutilmoqda',                 ru: 'Ожидается',                      en: 'Pending' },
    kg:              { uz: 'kg',                         ru: 'кг',                             en: 'kg' },
    yes:             { uz: 'Ha',                         ru: 'Да',                             en: 'Yes' },
};

const STAGE_LABELS: Record<string, Partial<Record<Language, string>>> = {
    material:   { uz: 'Xom ashyo',           ru: 'Сырьё',              en: 'Raw Material' },
    production: { uz: 'Ishlab chiqarish',    ru: 'Производство',       en: 'Production' },
    quality:    { uz: 'Sifat nazorati',      ru: 'Контроль качества',  en: 'Quality Control' },
    delivery:   { uz: 'Yetkazish',           ru: 'Доставка',           en: 'Delivery' },
    usage:      { uz: 'Foydalanish',         ru: 'Использование',      en: 'Usage' },
    recycle:    { uz: 'Qayta ishlash',       ru: 'Переработка',        en: 'Recycling' },
};

const STAGE_ICONS: Record<string, typeof Package> = {
    material: Box,
    production: Factory,
    quality: ShieldCheck,
    delivery: Truck,
    usage: Package,
    recycle: Recycle,
};

const t = (key: string, lang: Language): string =>
    TX[key]?.[lang] ?? TX[key]?.['en'] ?? key;

const tStage = (stage: string, lang: Language): string =>
    STAGE_LABELS[stage]?.[lang] ?? STAGE_LABELS[stage]?.['en'] ?? stage;

// ── Types ────────────────────────────────────────────────────────────────────
interface LifecycleStage {
    stage: string;
    label: string;
    date: string | null;
    status: 'completed' | 'in_progress' | 'pending';
    detail?: string;
}

interface LifecycleData {
    code: string;
    product: {
        name: string;
        image: string | null;
    };
    lifecycle: LifecycleStage[];
    ecoImpact: {
        recycledContent: number;
        recyclable: boolean;
        co2Saved: number;
    };
}

// ── Status icon component ────────────────────────────────────────────────────
function StageStatusIcon({ status }: { status: string }) {
    if (status === 'completed') {
        return (
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-200">
                <CheckCircle2 size={20} className="text-white" />
            </div>
        );
    }
    if (status === 'in_progress') {
        return (
            <div className="relative w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-md shadow-blue-200">
                <Clock size={18} className="text-white" />
                <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-30" />
            </div>
        );
    }
    return (
        <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
            <CircleDashed size={18} className="text-gray-300" />
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function QRLifecyclePage() {
    const { code } = useParams<{ code: string }>();
    const { language } = useLanguage();

    const [data, setData] = useState<LifecycleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchData = async () => {
        if (!code) return;
        setLoading(true);
        setError(false);
        try {
            const res = await fetch(`/api/qr/lifecycle/${code}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const json = await res.json();
            setData(json);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code]);

    // ── Loading state ────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-surface-page flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin text-blue-500" />
                    <p className="text-sm text-gray-400">{t('loading', language)}</p>
                </div>
            </div>
        );
    }

    // ── Error state ──────────────────────────────────────────────────────
    if (error || !data) {
        return (
            <div className="min-h-screen bg-surface-page flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle size={52} className="text-gray-200 mb-4" />
                <h1 className="text-xl font-extrabold text-gray-900 mb-2">
                    {t(error ? 'error' : 'notFound', language)}
                </h1>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 mt-4 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                    {t('retry', language)}
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-page">
            <div className="max-w-lg mx-auto px-4 py-8 pb-20">
                {/* Pack24 Branding */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-navy rounded-full">
                        <Leaf size={16} className="text-emerald-400" />
                        <span className="text-xs font-bold text-white tracking-wider uppercase">
                            Pack24 Lifecycle
                        </span>
                    </div>
                </div>

                {/* Product Info Card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {data.product.image ? (
                                <Image
                                    src={data.product.image}
                                    alt={data.product.name}
                                    className="w-full h-full object-contain"
                                    width={300}
                                    height={300}
                                />
                            ) : (
                                <Box size={24} className="text-gray-300" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                                {t('product', language)}
                            </p>
                            <h2 className="text-lg font-extrabold text-gray-900 truncate">
                                {data.product.name}
                            </h2>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                                {data.code}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Lifecycle Timeline */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                    <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2">
                        <Recycle size={16} className="text-emerald-500" />
                        {t('pageTitle', language)}
                    </h3>

                    <div className="relative">
                        {data.lifecycle.map((stage, idx) => {
                            const Icon = STAGE_ICONS[stage.stage] ?? Package;
                            const isLast = idx === data.lifecycle.length - 1;

                            return (
                                <div key={stage.stage} className="flex gap-4 relative">
                                    {/* Timeline line */}
                                    {!isLast && (
                                        <div className="absolute left-5 top-10 bottom-0 w-px">
                                            <div
                                                className={`w-full h-full ${
                                                    stage.status === 'completed'
                                                        ? 'bg-emerald-300'
                                                        : 'bg-gray-200'
                                                }`}
                                            />
                                        </div>
                                    )}

                                    {/* Status icon */}
                                    <div className="shrink-0 z-10">
                                        <StageStatusIcon status={stage.status} />
                                    </div>

                                    {/* Content */}
                                    <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <Icon
                                                size={14}
                                                className={
                                                    stage.status === 'completed'
                                                        ? 'text-emerald-600'
                                                        : stage.status === 'in_progress'
                                                          ? 'text-blue-600'
                                                          : 'text-gray-400'
                                                }
                                            />
                                            <span
                                                className={`text-sm font-bold ${
                                                    stage.status === 'completed'
                                                        ? 'text-gray-900'
                                                        : stage.status === 'in_progress'
                                                          ? 'text-blue-700'
                                                          : 'text-gray-400'
                                                }`}
                                            >
                                                {tStage(stage.stage, language)}
                                            </span>
                                            {stage.status !== 'pending' && (
                                                <span
                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        stage.status === 'completed'
                                                            ? 'bg-emerald-50 text-emerald-600'
                                                            : 'bg-blue-50 text-blue-600'
                                                    }`}
                                                >
                                                    {t(stage.status === 'completed' ? 'completed' : 'inProgress', language)}
                                                </span>
                                            )}
                                        </div>

                                        {stage.date && (
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {new Date(stage.date).toLocaleDateString(
                                                    language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ',
                                                    { day: 'numeric', month: 'long', year: 'numeric' }
                                                )}
                                            </p>
                                        )}

                                        {stage.detail && (
                                            <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg px-3 py-1.5 inline-block">
                                                {stage.detail}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Eco Impact Card */}
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border border-emerald-100 p-5 mb-6">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Leaf size={16} className="text-emerald-500" />
                        {t('ecoImpact', language)}
                    </h3>

                    <div className="grid grid-cols-3 gap-3">
                        {/* Recycled content */}
                        <div className="bg-white/70 rounded-xl p-3 text-center">
                            <p className="text-2xl font-extrabold text-emerald-600">
                                {data.ecoImpact.recycledContent}%
                            </p>
                            <p className="text-[10px] text-gray-500 font-semibold mt-1 leading-tight">
                                {t('recycledContent', language)}
                            </p>
                        </div>

                        {/* Recyclable badge */}
                        <div className="bg-white/70 rounded-xl p-3 text-center flex flex-col items-center justify-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                                data.ecoImpact.recyclable
                                    ? 'bg-emerald-100'
                                    : 'bg-gray-100'
                            }`}>
                                <Recycle
                                    size={16}
                                    className={
                                        data.ecoImpact.recyclable
                                            ? 'text-emerald-600'
                                            : 'text-gray-400'
                                    }
                                />
                            </div>
                            <p className="text-[10px] text-gray-500 font-semibold leading-tight">
                                {t('recyclable', language)}
                            </p>
                            <p className="text-xs font-bold text-emerald-600">
                                {data.ecoImpact.recyclable ? '✓ ' + t('yes', language) : '—'}
                            </p>
                        </div>

                        {/* CO2 saved */}
                        <div className="bg-white/70 rounded-xl p-3 text-center">
                            <p className="text-2xl font-extrabold text-emerald-600">
                                {data.ecoImpact.co2Saved}
                            </p>
                            <p className="text-[10px] text-gray-500 font-semibold mt-1 leading-tight">
                                {t('co2Saved', language)} ({t('kg', language)})
                            </p>
                        </div>
                    </div>
                </div>

                {/* CTA: Recycle */}
                <Link
                    href="/recycling"
                    className="flex items-center justify-between w-full px-5 py-4 bg-brand-navy text-white rounded-2xl hover:opacity-90 transition-opacity group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                            <Recycle size={20} className="text-emerald-400" />
                        </div>
                        <span className="text-sm font-bold">
                            {t('ctaRecycle', language)}
                        </span>
                    </div>
                    <ArrowRight size={18} className="text-white/60 group-hover:translate-x-1 transition-transform" />
                </Link>

                {/* Footer branding */}
                <div className="text-center mt-8">
                    <p className="text-xs text-gray-300 font-semibold">
                        {t('poweredBy', language)}
                    </p>
                </div>
            </div>
        </div>
    );
}
