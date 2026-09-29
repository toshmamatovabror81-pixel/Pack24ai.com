'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
    Building2,
    TrendingUp,
    Package,
    DollarSign,
    FileText,
    Calendar,
    ShieldCheck,
    Leaf,
    ArrowRight,
    Loader2,
    Download,
    Phone,
    ChevronRight,
    Truck,
    BarChart3,
    TreePine,
    Droplets,
    Recycle,
} from 'lucide-react';

// ─── i18n ────────────────────────────────────────────────────────────────────
type LangKey = 'uz' | 'ru' | 'en';

const TX: Record<string, Record<LangKey, string>> = {
    home: { uz: 'Bosh sahifa', ru: 'Главная', en: 'Home' },
    pageTitle: { uz: 'Korporativ Dashboard', ru: 'Корпоративный дашборд', en: 'Corporate Dashboard' },
    pageSubtitle: {
        uz: 'Kompaniyangiz buyurtmalari, shartnomalari va ekologik ta\'sirini kuzating',
        ru: 'Отслеживайте заказы, контракты и экологический вклад вашей компании',
        en: 'Track your company orders, contracts and environmental impact',
    },
    totalOrders: { uz: 'Jami buyurtmalar', ru: 'Всего заказов', en: 'Total Orders' },
    totalSpent: { uz: 'Jami xarajat', ru: 'Общие расходы', en: 'Total Spent' },
    avgOrder: { uz: 'O\'rtacha buyurtma', ru: 'Средний заказ', en: 'Avg Order' },
    onTimeDelivery: { uz: 'O\'z vaqtida yetkazish', ru: 'Доставка вовремя', en: 'On-Time Delivery' },
    monthlyOrders: { uz: 'Oylik buyurtmalar', ru: 'Заказы по месяцам', en: 'Monthly Orders' },
    monthlyOrdersDesc: {
        uz: 'Oxirgi 12 oydagi buyurtmalar statistikasi',
        ru: 'Статистика заказов за последние 12 месяцев',
        en: 'Order statistics for the last 12 months',
    },
    topProducts: { uz: 'Top mahsulotlar', ru: 'Топ товары', en: 'Top Products' },
    topProductsDesc: {
        uz: 'Eng ko\'p buyurtma qilingan mahsulotlar',
        ru: 'Наиболее заказываемые товары',
        en: 'Most ordered products',
    },
    activeContracts: { uz: 'Aktiv shartnomalar', ru: 'Активные контракты', en: 'Active Contracts' },
    contractNo: { uz: 'Shartnoma №', ru: 'Контракт №', en: 'Contract #' },
    paymentTerms: { uz: 'To\'lov muddati', ru: 'Условия оплаты', en: 'Payment Terms' },
    creditLimit: { uz: 'Kredit limiti', ru: 'Кредитный лимит', en: 'Credit Limit' },
    validUntil: { uz: 'Amal qilish muddati', ru: 'Срок действия', en: 'Valid Until' },
    days: { uz: 'kun', ru: 'дней', en: 'days' },
    pendingInvoices: { uz: 'To\'lanmagan fakturalar', ru: 'Неоплаченные счета', en: 'Pending Invoices' },
    invoiceNo: { uz: 'Faktura №', ru: 'Счёт №', en: 'Invoice #' },
    amount: { uz: 'Summa', ru: 'Сумма', en: 'Amount' },
    dueDate: { uz: 'To\'lov sanasi', ru: 'Дата оплаты', en: 'Due Date' },
    status: { uz: 'Holat', ru: 'Статус', en: 'Status' },
    ecoImpact: { uz: 'Ekologik ta\'sir', ru: 'Экологический вклад', en: 'Eco Impact' },
    ecoImpactDesc: {
        uz: 'Kompaniyangizning qayta ishlash va ekologik ta\'siri',
        ru: 'Показатели переработки и экологического вклада вашей компании',
        en: 'Your company recycling and environmental impact metrics',
    },
    recycled: { uz: 'Qayta ishlangan', ru: 'Переработано', en: 'Recycled' },
    co2Saved: { uz: 'CO₂ tejalgan', ru: 'CO₂ сэкономлено', en: 'CO₂ Saved' },
    treesEquiv: { uz: 'Daraxtlar ekvivalenti', ru: 'Эквивалент деревьев', en: 'Trees Equivalent' },
    quickActions: { uz: 'Tezkor harakatlar', ru: 'Быстрые действия', en: 'Quick Actions' },
    newOrder: { uz: 'Yangi buyurtma', ru: 'Новый заказ', en: 'New Order' },
    downloadReport: { uz: 'ESG hisobot yuklash', ru: 'Скачать ESG отчёт', en: 'Download ESG Report' },
    contactManager: { uz: 'Menejer bilan bog\'lanish', ru: 'Связаться с менеджером', en: 'Contact Manager' },
    loading: { uz: 'Yuklanmoqda...', ru: 'Загрузка...', en: 'Loading...' },
    unauthorized: {
        uz: 'Faqat korporativ mijozlar uchun',
        ru: 'Только для корпоративных клиентов',
        en: 'Corporate clients only',
    },
    loginRequired: {
        uz: 'Iltimos, tizimga kiring',
        ru: 'Пожалуйста, войдите в систему',
        en: 'Please log in',
    },
    noContracts: { uz: 'Shartnomalar yo\'q', ru: 'Нет контрактов', en: 'No contracts' },
    noInvoices: { uz: 'Fakturalar yo\'q', ru: 'Нет счетов', en: 'No invoices' },
    noProducts: { uz: 'Ma\'lumot yo\'q', ru: 'Нет данных', en: 'No data' },
    orders: { uz: 'buyurtma', ru: 'заказов', en: 'orders' },
    kg: { uz: 'kg', ru: 'кг', en: 'kg' },
    avgDays: { uz: 'O\'rtacha kunlar', ru: 'Среднее кол-во дней', en: 'Avg Days' },
};

// ─── Status badge helpers ────────────────────────────────────────────────────
const contractStatusBadge = (status: string) => {
    const map: Record<string, string> = {
        active: 'bg-emerald-100 text-emerald-700',
        expired: 'bg-red-100 text-red-700',
        pending: 'bg-amber-100 text-amber-700',
        draft: 'bg-gray-100 text-gray-600',
    };
    return map[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
};

const invoiceStatusBadge = (status: string) => {
    const map: Record<string, string> = {
        pending: 'bg-amber-100 text-amber-700',
        overdue: 'bg-red-100 text-red-700',
        partial: 'bg-blue-100 text-blue-700',
        sent: 'bg-sky-100 text-sky-700',
    };
    return map[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardData {
    user: {
        id: number;
        name: string;
        companyName: string | null;
    };
    orders: {
        total: number;
        totalAmount: number;
        avgOrderValue: number;
    };
    ordersByMonth: { month: string; count: number; amount: number }[];
    topProducts: { productId: number; name: string; quantity: number }[];
    contracts: {
        id: number;
        contractNo: string;
        companyName: string;
        status: string;
        paymentTermDays: number;
        creditLimit: number;
        startDate: string;
        endDate: string;
    }[];
    pendingInvoices: {
        id: number;
        invoiceNo: string;
        subtotal: number;
        vatAmount: number;
        totalAmount: number;
        status: string;
        dueDate: string;
        paidAmount: number;
        createdAt: string;
    }[];
    ecoStats: {
        totalRecycledWeight: number;
        co2Saved: number;
        treesEquivalent: number;
    };
    deliveryStats: {
        totalDelivered: number;
        onTimePercent: number;
        avgDeliveryDays: number;
    };
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}

function KPICardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <KPICardSkeleton key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <Skeleton className="h-6 w-48 mb-4" />
                    <Skeleton className="h-48 w-full" />
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <Skeleton className="h-6 w-48 mb-4" />
                    <Skeleton className="h-48 w-full" />
                </div>
            </div>
        </div>
    );
}

// ─── Month label helper ──────────────────────────────────────────────────────
const MONTH_NAMES: Record<LangKey, string[]> = {
    uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
    ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

function monthLabel(month: string, lang: LangKey): string {
    const parts = month.split('-');
    const monthIdx = parseInt(parts[1], 10) - 1;
    return MONTH_NAMES[lang][monthIdx] ?? month;
}

// ─── Page Component ──────────────────────────────────────────────────────────
export default function CorporateDashboardPage() {
    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const { data: session, status: sessionStatus } = useSession();
    const lang = (['uz', 'ru', 'en'].includes(language) ? language : 'uz') as LangKey;
    const t = (key: string): string => TX[key]?.[lang] ?? key;

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (sessionStatus === 'loading') return;
        if (sessionStatus === 'unauthenticated') {
            setLoading(false);
            setError('unauthenticated');
            return;
        }

        (async () => {
            try {
                const res = await fetch('/api/corporate/dashboard');
                const json = await res.json();
                if (!res.ok) {
                    throw new Error(json.error || 'Error');
                }
                setData(json);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Error');
            } finally {
                setLoading(false);
            }
        })();
    }, [sessionStatus]);

    // ── Auth guard ──
    if (sessionStatus === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-surface-page">
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center gap-3 mb-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="text-gray-500">{t('loading')}</span>
                    </div>
                    <DashboardSkeleton />
                </div>
            </div>
        );
    }

    if (error === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-surface-page flex items-center justify-center">
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-md">
                    <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck className="h-8 w-8 text-amber-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{t('loginRequired')}</h2>
                    <p className="text-gray-500 text-sm mb-6">{t('unauthorized')}</p>
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5"
                    >
                        {t('loginRequired')}
                        <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-surface-page flex items-center justify-center">
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-md">
                    <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Building2 className="h-8 w-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{error || 'Error'}</h2>
                    <p className="text-gray-500 text-sm">{t('unauthorized')}</p>
                </div>
            </div>
        );
    }

    const maxMonthlyCount = Math.max(...data.ordersByMonth.map((m) => m.count), 1);
    const maxProductQty = Math.max(...data.topProducts.map((p) => p.quantity), 1);

    return (
        <div className="min-h-screen bg-surface-page">
            {/* ── Header ── */}
            <div className="bg-gradient-to-br from-[#0f1c3f] via-[#152d5c] to-[#1a3a6e] text-white">
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-blue-200/70 mb-6">
                        <Link href="/" className="hover:text-white transition-colors">
                            {t('home')}
                        </Link>
                        <ChevronRight size={14} />
                        <span className="text-white font-medium">{t('pageTitle')}</span>
                    </nav>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10">
                            <Building2 className="h-7 w-7 text-blue-300" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold">
                                {data.user.companyName || data.user.name}
                            </h1>
                            <p className="text-blue-200/80 text-sm mt-1">{t('pageSubtitle')}</p>
                        </div>
                        {data.contracts.some((c) => c.status === 'active') && (
                            <span className="ml-auto px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wide">
                                ✓ Active Contract
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pb-16 space-y-6">
                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Orders */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Package size={20} className="text-blue-600" />
                            </div>
                            <span className="text-sm text-gray-500 font-medium">{t('totalOrders')}</span>
                        </div>
                        <p className="text-3xl font-extrabold text-gray-900">
                            {data.orders.total.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{t('orders')}</p>
                    </div>

                    {/* Total Spent */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                <DollarSign size={20} className="text-emerald-600" />
                            </div>
                            <span className="text-sm text-gray-500 font-medium">{t('totalSpent')}</span>
                        </div>
                        <p className="text-3xl font-extrabold text-gray-900">
                            {format(data.orders.totalAmount)}
                        </p>
                    </div>

                    {/* Avg Order */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                <TrendingUp size={20} className="text-purple-600" />
                            </div>
                            <span className="text-sm text-gray-500 font-medium">{t('avgOrder')}</span>
                        </div>
                        <p className="text-3xl font-extrabold text-gray-900">
                            {format(data.orders.avgOrderValue)}
                        </p>
                    </div>

                    {/* On-Time Delivery */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                                <Truck size={20} className="text-cyan-600" />
                            </div>
                            <span className="text-sm text-gray-500 font-medium">{t('onTimeDelivery')}</span>
                        </div>
                        <p className="text-3xl font-extrabold text-gray-900">
                            {data.deliveryStats.onTimePercent}%
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            {t('avgDays')}: {data.deliveryStats.avgDeliveryDays}
                        </p>
                    </div>
                </div>

                {/* ── Charts Row ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Monthly Orders Bar Chart */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                                <BarChart3 size={20} className="text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{t('monthlyOrders')}</h2>
                                <p className="text-xs text-gray-500">{t('monthlyOrdersDesc')}</p>
                            </div>
                        </div>
                        <div className="p-6">
                            {data.ordersByMonth.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-12">{t('noProducts')}</div>
                            ) : (
                                <div className="flex items-end gap-1.5 h-48">
                                    {data.ordersByMonth.map((m, i) => {
                                        const pct = Math.max((m.count / maxMonthlyCount) * 100, 4);
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                                <span className="text-[10px] font-bold text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {m.count}
                                                </span>
                                                <div
                                                    className="w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-indigo-400 transition-all duration-300 group-hover:from-indigo-600 group-hover:to-indigo-500 min-h-[4px] cursor-pointer"
                                                    style={{ height: `${pct}%` }}
                                                    title={`${monthLabel(m.month, lang)}: ${m.count} ${t('orders')} — ${format(m.amount)}`}
                                                />
                                                <span className="text-[9px] text-gray-400 font-medium">
                                                    {monthLabel(m.month, lang)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Products Horizontal Bar */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                <Package size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{t('topProducts')}</h2>
                                <p className="text-xs text-gray-500">{t('topProductsDesc')}</p>
                            </div>
                        </div>
                        <div className="p-6">
                            {data.topProducts.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-12">{t('noProducts')}</div>
                            ) : (
                                <div className="space-y-3">
                                    {data.topProducts.slice(0, 7).map((p, i) => {
                                        const pct = Math.max((p.quantity / maxProductQty) * 100, 6);
                                        const colors = [
                                            'from-blue-500 to-blue-400',
                                            'from-emerald-500 to-emerald-400',
                                            'from-purple-500 to-purple-400',
                                            'from-amber-500 to-amber-400',
                                            'from-cyan-500 to-cyan-400',
                                            'from-rose-500 to-rose-400',
                                            'from-indigo-500 to-indigo-400',
                                        ];
                                        return (
                                            <div key={p.productId}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-medium text-gray-900 truncate max-w-[200px]">
                                                        {p.name}
                                                    </span>
                                                    <span className="text-gray-500 font-semibold shrink-0 ml-2">
                                                        {p.quantity.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full bg-gradient-to-r ${colors[i % colors.length]} transition-all duration-500`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Active Contracts ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                            <FileText size={20} className="text-teal-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">{t('activeContracts')}</h2>
                    </div>
                    {data.contracts.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-sm">{t('noContracts')}</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {data.contracts.map((c) => (
                                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-gray-900">
                                                {t('contractNo')}{c.contractNo}
                                            </span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${contractStatusBadge(c.status)}`}>
                                                {c.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500">{c.companyName}</p>
                                    </div>
                                    <div className="flex items-center gap-6 text-sm">
                                        <div>
                                            <span className="text-gray-400 text-xs">{t('paymentTerms')}</span>
                                            <p className="font-semibold text-gray-900">{c.paymentTermDays} {t('days')}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 text-xs">{t('creditLimit')}</span>
                                            <p className="font-semibold text-gray-900">{format(c.creditLimit)}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 text-xs">{t('validUntil')}</span>
                                            <p className="font-semibold text-gray-900">
                                                {c.endDate ? new Date(c.endDate).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US') : '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Pending Invoices ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                            <Calendar size={20} className="text-orange-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">{t('pendingInvoices')}</h2>
                        {data.pendingInvoices.length > 0 && (
                            <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
                                {data.pendingInvoices.length}
                            </span>
                        )}
                    </div>
                    {data.pendingInvoices.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-sm">{t('noInvoices')}</div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/50">
                                            <th className="px-6 py-3 text-left font-semibold text-gray-600">{t('invoiceNo')}</th>
                                            <th className="px-6 py-3 text-right font-semibold text-gray-600">{t('amount')}</th>
                                            <th className="px-6 py-3 text-left font-semibold text-gray-600">{t('dueDate')}</th>
                                            <th className="px-6 py-3 text-center font-semibold text-gray-600">{t('status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {data.pendingInvoices.map((inv) => (
                                            <tr key={inv.id} className="hover:bg-gray-50/50">
                                                <td className="px-6 py-4 font-medium text-gray-900">{inv.invoiceNo}</td>
                                                <td className="px-6 py-4 text-right font-semibold text-gray-900">
                                                    {format(inv.totalAmount)}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    {inv.dueDate
                                                        ? new Date(inv.dueDate).toLocaleDateString(
                                                              lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US'
                                                          )
                                                        : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span
                                                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${invoiceStatusBadge(inv.status)}`}
                                                    >
                                                        {inv.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* Mobile cards */}
                            <div className="sm:hidden divide-y divide-gray-100">
                                {data.pendingInvoices.map((inv) => (
                                    <div key={inv.id} className="p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-gray-900">{inv.invoiceNo}</span>
                                            <span
                                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${invoiceStatusBadge(inv.status)}`}
                                            >
                                                {inv.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-500">{t('amount')}</span>
                                            <span className="font-bold text-gray-900">{format(inv.totalAmount)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-500">{t('dueDate')}</span>
                                            <span className="text-gray-600">
                                                {inv.dueDate
                                                    ? new Date(inv.dueDate).toLocaleDateString(
                                                          lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US'
                                                      )
                                                    : '—'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* ── Eco Impact ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <Leaf size={20} className="text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{t('ecoImpact')}</h2>
                            <p className="text-xs text-gray-500">{t('ecoImpactDesc')}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                        {/* Recycled Weight */}
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Recycle className="h-6 w-6 text-emerald-600" />
                            </div>
                            <p className="text-3xl font-extrabold text-gray-900">
                                {(data.ecoStats.totalRecycledWeight ?? 0).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{t('recycled')} ({t('kg')})</p>
                        </div>
                        {/* CO2 Saved */}
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Droplets className="h-6 w-6 text-sky-600" />
                            </div>
                            <p className="text-3xl font-extrabold text-gray-900">
                                {(data.ecoStats.co2Saved ?? 0).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{t('co2Saved')} ({t('kg')})</p>
                        </div>
                        {/* Trees Equivalent */}
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <TreePine className="h-6 w-6 text-green-600" />
                            </div>
                            <p className="text-3xl font-extrabold text-gray-900">
                                {(data.ecoStats.treesEquivalent ?? 0).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{t('treesEquiv')}</p>
                        </div>
                    </div>
                </div>

                {/* ── Quick Actions ── */}
                <div className="bg-gradient-to-br from-[#0f1c3f] via-[#152d5c] to-[#1a3a6e] rounded-2xl p-8 text-white">
                    <h3 className="text-xl font-bold mb-6">{t('quickActions')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Link
                            href="/catalog"
                            className="flex items-center gap-3 bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/10 rounded-xl p-4 transition-all hover:-translate-y-0.5 group"
                        >
                            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                <Package size={20} className="text-emerald-300" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-sm">{t('newOrder')}</p>
                            </div>
                            <ArrowRight size={16} className="text-white/50 group-hover:text-white transition-colors" />
                        </Link>

                        <button
                            type="button"
                            onClick={() => {
                                // ESG report download placeholder
                                window.open('/api/corporate/dashboard?format=csv', '_blank');
                            }}
                            className="flex items-center gap-3 bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/10 rounded-xl p-4 transition-all hover:-translate-y-0.5 group text-left"
                        >
                            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                <Download size={20} className="text-blue-300" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-sm">{t('downloadReport')}</p>
                            </div>
                            <ArrowRight size={16} className="text-white/50 group-hover:text-white transition-colors" />
                        </button>

                        <Link
                            href="/contacts"
                            className="flex items-center gap-3 bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/10 rounded-xl p-4 transition-all hover:-translate-y-0.5 group"
                        >
                            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                <Phone size={20} className="text-purple-300" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-sm">{t('contactManager')}</p>
                            </div>
                            <ArrowRight size={16} className="text-white/50 group-hover:text-white transition-colors" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
