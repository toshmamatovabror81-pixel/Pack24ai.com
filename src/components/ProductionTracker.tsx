'use client';

import { useEffect, useState } from 'react';
import {
    Package,
    Factory,
    Printer,
    Wrench,
    ShieldCheck,
    Truck,
    Check,
} from 'lucide-react';
import type { Language } from '@/lib/translations';

// ── Types ────────────────────────────────────────────────────────────────────
export interface ProductionStage {
    stage: string;
    status: 'pending' | 'in_progress' | 'completed';
    startedAt: string | null;
    completedAt: string | null;
    operator: string | null;
    notes: string | null;
}

interface ProductionTrackerProps {
    stages: ProductionStage[];
    currentStage: string;
    progress: number;
    orderStatus: string;
    language: Language;
}

// ── i18n ─────────────────────────────────────────────────────────────────────
const STAGE_LABELS: Record<string, Partial<Record<Language, string>>> = {
    buyurtma:  { uz: 'Buyurtma',    ru: 'Заказ',       en: 'Order',       qr: 'Buyırtpa',    zh: '订单',   tr: 'Sipariş',      tg: 'Фармоиш',      kk: 'Тапсырыс',     tk: 'Sargyt',        fa: 'سفارش' },
    gofra:     { uz: 'Gofra',       ru: 'Гофра',       en: 'Corrugation', qr: 'Gofra',       zh: '瓦楞',   tr: 'Oluklu',       tg: 'Гофра',        kk: 'Гофра',        tk: 'Gofra',        fa: 'کنگره‌ای' },
    pechat:    { uz: 'Pechat',      ru: 'Печать',      en: 'Printing',    qr: 'Baspa',       zh: '印刷',   tr: 'Baskı',        tg: 'Чоп',          kk: 'Басып шығару',  tk: 'Çap',          fa: 'چاپ' },
    yiguv:     { uz: "Yig'uv",      ru: 'Сборка',      en: 'Assembly',    qr: "Jıynaw",      zh: '组装',   tr: 'Montaj',       tg: 'Мавзун',       kk: 'Жинау',        tk: 'Ýygnamak',     fa: 'مونتاژ' },
    qc:        { uz: 'Sifat nazorati', ru: 'Контроль',  en: 'QC',          qr: 'Sifat nazaratı', zh: '质检', tr: 'Kalite Kontrol', tg: 'Назорати сифат', kk: 'Сапа бақылау', tk: 'Hil gözegçiligi', fa: 'کنترل کیفیت' },
    yetkazish: { uz: 'Yetkazish',   ru: 'Доставка',    en: 'Delivery',    qr: 'Jetkeriw',    zh: '配送',   tr: 'Teslimat',     tg: 'Тавзеъ',       kk: 'Жеткізу',      tk: 'Eltip bermek', fa: 'تحویل' },
};

const TX: Record<string, Partial<Record<Language, string>>> = {
    started:   { uz: 'Boshlandi',     ru: 'Начало',       en: 'Started',     qr: 'Baslandı',    zh: '开始',   tr: 'Başladı',      tg: 'Оғоз шуд',     kk: 'Басталды',     tk: 'Başlandy',     fa: 'شروع شد' },
    completed: { uz: 'Tugallandi',    ru: 'Завершено',    en: 'Completed',   qr: 'Tamamlandı',  zh: '完成',   tr: 'Tamamlandı',   tg: 'Анҷом ёфт',    kk: 'Аяқталды',     tk: 'Tamamlandy',   fa: 'تکمیل شد' },
    inProgress:{ uz: 'Jarayonda',     ru: 'В процессе',   en: 'In Progress', qr: 'Járiyanda',   zh: '进行中', tr: 'Devam ediyor', tg: 'Дар ҷараён',   kk: 'Үдерісте',     tk: 'Dowam edýär',  fa: 'در حال انجام' },
    pending:   { uz: 'Kutilmoqda',    ru: 'Ожидание',     en: 'Pending',     qr: 'Kútilmoqda',  zh: '等待中', tr: 'Bekliyor',     tg: 'Дар интизорӣ',  kk: 'Күтілуде',     tk: 'Garaşylýar',   fa: 'در انتظار' },
    progress:  { uz: 'Umumiy jarayon', ru: 'Общий прогресс', en: 'Overall Progress', qr: 'Ulıwma járiyan', zh: '总进度', tr: 'Genel İlerleme', tg: 'Пешрафти умумӣ', kk: 'Жалпы барыс', tk: 'Umumy öňe gidiş', fa: 'پیشرفت کلی' },
};

const t = (key: string, lang: Language): string =>
    TX[key]?.[lang] ?? TX[key]?.['en'] ?? key;

const stageLabel = (key: string, lang: Language): string =>
    STAGE_LABELS[key]?.[lang] ?? STAGE_LABELS[key]?.['en'] ?? key;

// ── Stage config ─────────────────────────────────────────────────────────────
const STAGE_CONFIG: {
    key: string;
    icon: typeof Package;
    emoji: string;
}[] = [
    { key: 'buyurtma',  icon: Package,     emoji: '📋' },
    { key: 'gofra',     icon: Factory,     emoji: '🏭' },
    { key: 'pechat',    icon: Printer,     emoji: '🖨️' },
    { key: 'yiguv',     icon: Wrench,      emoji: '📐' },
    { key: 'qc',        icon: ShieldCheck, emoji: '✅' },
    { key: 'yetkazish', icon: Truck,       emoji: '🚚' },
];

function formatTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' }) +
        ' ' + d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ProductionTracker({
    stages,
    currentStage,
    progress,
    orderStatus,
    language,
}: ProductionTrackerProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Build unified 6-stage array
    const fullStages = STAGE_CONFIG.map((cfg) => {
        if (cfg.key === 'buyurtma') {
            // Buyurtma is always completed if an order exists
            return {
                ...cfg,
                status: 'completed' as const,
                startedAt: null as string | null,
                completedAt: null as string | null,
            };
        }
        if (cfg.key === 'yetkazish') {
            // Delivery depends on order status
            const isDone = orderStatus === 'delivered';
            const isShipping = orderStatus === 'shipping';
            return {
                ...cfg,
                status: isDone ? ('completed' as const) : isShipping ? ('in_progress' as const) : ('pending' as const),
                startedAt: null as string | null,
                completedAt: null as string | null,
            };
        }
        // Production stages from API
        const found = stages.find((s) => s.stage === cfg.key);
        return {
            ...cfg,
            status: (found?.status ?? 'pending') as 'pending' | 'in_progress' | 'completed',
            startedAt: found?.startedAt ?? null,
            completedAt: found?.completedAt ?? null,
        };
    });

    // Find current stage index for progress line
    const activeIdx = fullStages.findIndex(
        (s) => s.status === 'in_progress'
    );
    const lastCompletedIdx = fullStages.reduce(
        (acc, s, i) => (s.status === 'completed' ? i : acc),
        -1
    );
    const progressIdx = activeIdx >= 0 ? activeIdx : lastCompletedIdx;

    return (
        <div
            className={`transition-all duration-700 ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
        >
            {/* Progress bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500">
                        {t('progress', language)}
                    </span>
                    <span className="text-xs font-extrabold text-blue-600">
                        {progress}%
                    </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: mounted ? `${progress}%` : '0%' }}
                    />
                </div>
            </div>

            {/* Desktop: Horizontal Timeline */}
            <div className="hidden md:block">
                <div className="relative flex items-start justify-between">
                    {/* Background line */}
                    <div className="absolute top-[28px] left-[48px] right-[48px] h-1 bg-gray-100 rounded-full" />
                    {/* Progress line */}
                    <div
                        className="absolute top-[28px] left-[48px] h-1 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
                        style={{
                            width: mounted
                                ? `${progressIdx >= 0 ? (progressIdx / (fullStages.length - 1)) * 100 : 0}%`
                                : '0%',
                            maxWidth: `calc(100% - 96px)`,
                        }}
                    />

                    {fullStages.map((stage, i) => {
                        const isCompleted = stage.status === 'completed';
                        const isCurrent = stage.status === 'in_progress';
                        const isPending = stage.status === 'pending';
                        const Icon = stage.icon;

                        return (
                            <div
                                key={stage.key}
                                className={`relative z-10 flex flex-col items-center flex-1 group transition-all duration-500 ${
                                    mounted
                                        ? 'opacity-100 translate-y-0'
                                        : 'opacity-0 translate-y-2'
                                }`}
                                style={{ transitionDelay: `${i * 100}ms` }}
                            >
                                {/* Circle */}
                                <div
                                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 ${
                                        isCompleted
                                            ? 'bg-emerald-500 shadow-lg shadow-emerald-200'
                                            : isCurrent
                                            ? 'bg-blue-500 shadow-lg shadow-blue-200 ring-4 ring-blue-100'
                                            : 'bg-gray-100'
                                    } ${isCurrent ? 'animate-pulse' : ''}`}
                                >
                                    {isCompleted ? (
                                        <Check size={22} className="text-white" strokeWidth={3} />
                                    ) : (
                                        <Icon
                                            size={22}
                                            className={
                                                isCurrent
                                                    ? 'text-white'
                                                    : 'text-gray-400'
                                            }
                                        />
                                    )}
                                </div>

                                {/* Label */}
                                <p
                                    className={`mt-2.5 text-xs font-bold text-center leading-tight ${
                                        isCompleted
                                            ? 'text-emerald-700'
                                            : isCurrent
                                            ? 'text-blue-700'
                                            : 'text-gray-400'
                                    }`}
                                >
                                    {stageLabel(stage.key, language)}
                                </p>

                                {/* Status badge */}
                                {isCurrent && (
                                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                        {t('inProgress', language)}
                                    </span>
                                )}

                                {/* Time info */}
                                {stage.completedAt && (
                                    <span className="mt-1 text-[10px] text-gray-400">
                                        {formatTime(stage.completedAt)}
                                    </span>
                                )}
                                {!stage.completedAt && stage.startedAt && (
                                    <span className="mt-1 text-[10px] text-blue-400">
                                        {formatTime(stage.startedAt)}
                                    </span>
                                )}

                                {/* Pending indicator */}
                                {isPending && !isCurrent && (
                                    <span className="mt-1 text-[10px] text-gray-300">
                                        {t('pending', language)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mobile: Vertical Timeline */}
            <div className="md:hidden space-y-0">
                {fullStages.map((stage, i) => {
                    const isCompleted = stage.status === 'completed';
                    const isCurrent = stage.status === 'in_progress';
                    const isLast = i === fullStages.length - 1;
                    const Icon = stage.icon;

                    return (
                        <div
                            key={stage.key}
                            className={`flex items-stretch gap-3 transition-all duration-500 ${
                                mounted
                                    ? 'opacity-100 translate-x-0'
                                    : 'opacity-0 -translate-x-4'
                            }`}
                            style={{ transitionDelay: `${i * 80}ms` }}
                        >
                            {/* Vertical line + icon */}
                            <div className="flex flex-col items-center">
                                <div
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                                        isCompleted
                                            ? 'bg-emerald-500 shadow-md shadow-emerald-200'
                                            : isCurrent
                                            ? 'bg-blue-500 shadow-md shadow-blue-200 ring-2 ring-blue-100'
                                            : 'bg-gray-100'
                                    } ${isCurrent ? 'animate-pulse' : ''}`}
                                >
                                    {isCompleted ? (
                                        <Check size={18} className="text-white" strokeWidth={3} />
                                    ) : (
                                        <Icon
                                            size={18}
                                            className={
                                                isCurrent ? 'text-white' : 'text-gray-400'
                                            }
                                        />
                                    )}
                                </div>
                                {!isLast && (
                                    <div
                                        className={`w-0.5 flex-1 min-h-[20px] transition-colors duration-500 ${
                                            isCompleted ? 'bg-emerald-300' : 'bg-gray-200'
                                        }`}
                                    />
                                )}
                            </div>

                            {/* Content */}
                            <div className="pt-2 pb-4 flex-1 min-w-0">
                                <p
                                    className={`text-sm font-bold ${
                                        isCompleted
                                            ? 'text-emerald-700'
                                            : isCurrent
                                            ? 'text-blue-700'
                                            : 'text-gray-400'
                                    }`}
                                >
                                    {stageLabel(stage.key, language)}
                                </p>

                                {isCurrent && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 mt-0.5">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                        {t('inProgress', language)}
                                    </span>
                                )}

                                {stage.completedAt && (
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        {t('completed', language)}: {formatTime(stage.completedAt)}
                                    </p>
                                )}
                                {!stage.completedAt && stage.startedAt && (
                                    <p className="text-[10px] text-blue-400 mt-0.5">
                                        {t('started', language)}: {formatTime(stage.startedAt)}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
