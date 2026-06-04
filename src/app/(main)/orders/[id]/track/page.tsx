'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import Image from 'next/image';
import Link from 'next/link';
import {
    ArrowLeft,
    Loader2,
    Package,
    RefreshCw,
    Box,
    Factory,
    Printer,
    Wrench,
    ShieldCheck,
    Truck,
    Clock,
    AlertCircle,
    QrCode,
} from 'lucide-react';
import ProductionTracker from '@/components/ProductionTracker';
import type { ProductionStage } from '@/components/ProductionTracker';
import QRCodeGenerator from '@/components/admin/QRCodeGenerator';
import type { Language } from '@/lib/translations';

// ── i18n ─────────────────────────────────────────────────────────────────────
const TX: Record<string, Partial<Record<Language, string>>> = {
    pageTitle:      { uz: 'Ishlab chiqarish holati',  ru: 'Статус производства',    en: 'Production Status',    qr: "Islep shıǵarıw halatı",  zh: '生产状态',     tr: 'Üretim Durumu',       tg: 'Ҳолати истеҳсол',      kk: 'Өндіріс күйі',       tk: 'Önümçilik ýagdaýy',    fa: 'وضعیت تولید' },
    order:          { uz: 'Buyurtma',                  ru: 'Заказ',                  en: 'Order',                qr: 'Buyırtpa',                zh: '订单',         tr: 'Sipariş',             tg: 'Фармоиш',              kk: 'Тапсырыс',            tk: 'Sargyt',               fa: 'سفارش' },
    backToOrders:   { uz: 'Buyurtmalarga',              ru: 'К заказам',              en: 'Back to Orders',       qr: 'Buyırtpalarga',           zh: '返回订单',     tr: 'Siparişlere',         tg: 'Ба фармоишҳо',         kk: 'Тапсырыстарға',       tk: 'Sargytlara',           fa: 'به سفارشات' },
    loading:        { uz: 'Yuklanmoqda...',             ru: 'Загрузка...',            en: 'Loading...',           qr: "Júklenmoqda...",          zh: '加载中...',     tr: 'Yükleniyor...',       tg: 'Боркунӣ...',           kk: 'Жүктелуде...',        tk: 'Ýüklenýär...',         fa: 'بارگذاری...' },
    error:          { uz: "Ma'lumot yuklanmadi",        ru: 'Ошибка загрузки',        en: 'Failed to load',       qr: "Maǵlıwmat júklenmedi",   zh: '加载失败',     tr: 'Yüklenemedi',         tg: 'Хатои боркунӣ',        kk: 'Жүктелмеді',          tk: 'Ýüklenmedi',           fa: 'خطا در بارگذاری' },
    retry:          { uz: 'Qayta urinish',             ru: 'Повторить',              en: 'Retry',                qr: 'Qayta urınıs',            zh: '重试',         tr: 'Tekrar dene',         tg: 'Аз нав',               kk: 'Қайталау',            tk: 'Gaýtadan synanyş',     fa: 'تلاش مجدد' },
    notFound:       { uz: "Buyurtma topilmadi",        ru: 'Заказ не найден',        en: 'Order not found',      qr: "Buyırtpa tabılmadı",      zh: '订单未找到',   tr: 'Sipariş bulunamadı',  tg: 'Фармоиш ёфт нашуд',   kk: 'Тапсырыс табылмады', tk: 'Sargyt tapylmady',     fa: 'سفارش پیدا نشد' },
    currentStage:   { uz: 'Hozirgi bosqich',           ru: 'Текущий этап',           en: 'Current Stage',        qr: 'Házirgi basqısh',         zh: '当前阶段',     tr: 'Mevcut Aşama',        tg: 'Марҳилаи ҷорӣ',        kk: 'Ағымдағы кезең',      tk: 'Häzirki tapgyr',       fa: 'مرحله فعلی' },
    products:       { uz: 'Mahsulotlar',               ru: 'Товары',                 en: 'Products',             qr: 'Mallar',                  zh: '商品',         tr: 'Ürünler',             tg: 'Маҳсулотҳо',           kk: 'Тауарлар',            tk: 'Harytlar',             fa: 'محصولات' },
    pcs:            { uz: 'dona',                      ru: 'шт.',                    en: 'pcs',                  qr: 'dana',                    zh: '件',           tr: 'adet',                tg: 'дона',                 kk: 'дана',                tk: 'sany',                 fa: 'عدد' },
    autoRefresh:    { uz: 'Avtomatik yangilanadi',     ru: 'Автообновление',         en: 'Auto-refreshing',      qr: 'Avto jańalanıw',          zh: '自动刷新',     tr: 'Otomatik yenileme',   tg: 'Навсозии худкор',      kk: 'Авто жаңарту',        tk: 'Awtomatiki täzeleniş', fa: 'بروزرسانی خودکار' },
    production:     { uz: 'Ishlab chiqarish',          ru: 'Производство',           en: 'Production',           qr: 'Islep shıǵarıw',          zh: '生产',         tr: 'Üretim',              tg: 'Истеҳсол',             kk: 'Өндіріс',             tk: 'Önümçilik',            fa: 'تولید' },
    qrLifecycle:   { uz: 'QR Lifecycle',               ru: 'QR Жизненный цикл',     en: 'QR Lifecycle',         qr: 'QR Lifecycle',             zh: 'QR 生命周期',  tr: 'QR Yaşam Döngüsü',   tg: 'QR Давраи ҳаёт',      kk: 'QR Өмірлік цикл',     tk: 'QR Durmuş sikli',      fa: 'چرخه عمر QR' },
    viewQr:        { uz: 'QR kodni ko\'rish',          ru: 'Показать QR код',        en: 'View QR Code',         qr: 'QR kodtı kóriw',          zh: '查看二维码',    tr: 'QR Kodu Göster',      tg: 'Дидани рамзи QR',     kk: 'QR кодты көру',       tk: 'QR kody görmek',       fa: 'مشاهده کد QR' },
    openLifecycle: { uz: 'Hayot siklini ochish',       ru: 'Открыть жизненный цикл', en: 'Open Lifecycle',       qr: 'Ómirlik tsikldı ashıw',   zh: '打开生命周期',  tr: 'Yaşam Döngüsünü Aç', tg: 'Кушодани давраи ҳаёт', kk: 'Өмірлік циклді ашу', tk: 'Durmuş siklini aç',    fa: 'باز کردن چرخه عمر' },
};

const STAGE_DESCRIPTIONS: Record<string, Partial<Record<Language, string>>> = {
    gofra:     { uz: "Gofra qog'oz ishlab chiqarilmoqda. Bu bosqichda quti uchun asos material tayyorlanadi.",      ru: 'Производится гофрокартон. Подготавливается основной материал для коробки.',      en: 'Corrugated cardboard is being produced. Base material for the box is being prepared.' },
    pechat:    { uz: "Qutiga logotip va dizayn chop etilmoqda. Yuqori sifatli bosma texnologiyalari qo'llaniladi.", ru: 'На коробку наносится логотип и дизайн. Используются высококачественные технологии печати.', en: 'Logo and design are being printed on the box. High-quality printing technologies are used.' },
    yiguv:     { uz: "Quti yig'ilmoqda va shakllantirilmoqda. Har bir quti sinchkovlik bilan tekshiriladi.",        ru: 'Коробка собирается и формируется. Каждая коробка тщательно проверяется.',        en: 'Box is being assembled and shaped. Each box is carefully inspected.' },
    qc:        { uz: "Sifat nazorati o'tkazilmoqda. Standartlarga muvofiqlik tekshirilmoqda.",                      ru: 'Проводится контроль качества. Проверяется соответствие стандартам.',               en: 'Quality control is in progress. Compliance with standards is being verified.' },
    buyurtma:  { uz: 'Buyurtmangiz qabul qilindi va ishlab chiqarishga jo\'natildi.',                              ru: 'Ваш заказ принят и отправлен в производство.',                                   en: 'Your order has been received and sent to production.' },
    yetkazish: { uz: "Buyurtmangiz yo'lga chiqdi! Tez orada yetkazib beriladi.",                                   ru: 'Ваш заказ в пути! Скоро будет доставлен.',                                       en: 'Your order is on its way! It will be delivered soon.' },
};

const STAGE_ICONS: Record<string, typeof Package> = {
    buyurtma: Package,
    gofra: Factory,
    pechat: Printer,
    yiguv: Wrench,
    qc: ShieldCheck,
    yetkazish: Truck,
};

const STATUS_LABELS: Record<string, Partial<Record<Language, string>>> = {
    new:        { uz: 'Yangi',          ru: 'Новый',        en: 'New',          qr: 'Jańa',         zh: '新',     tr: 'Yeni',        tg: 'Нав',         kk: 'Жаңа',       tk: 'Täze',       fa: 'جدید' },
    processing: { uz: 'Jarayonda',      ru: 'В обработке',  en: 'Processing',   qr: 'Járiyanda',    zh: '处理中', tr: 'İşleniyor',   tg: 'Дар коркард', kk: 'Өңделуде',   tk: 'Işlenýär',   fa: 'در حال پردازش' },
    shipping:   { uz: "Yo'lda",         ru: 'В пути',       en: 'Shipping',     qr: 'Jolda',        zh: '运输中', tr: 'Yolda',       tg: 'Дар роҳ',     kk: 'Жолда',      tk: 'Ýolda',      fa: 'در راه' },
    delivered:  { uz: 'Yetkazildi',     ru: 'Доставлен',    en: 'Delivered',    qr: 'Jetkizildi',   zh: '已送达', tr: 'Teslim edildi', tg: 'Расонда шуд', kk: 'Жеткізілді', tk: 'Eltip berildi', fa: 'تحویل شد' },
    cancelled:  { uz: 'Bekor qilindi',  ru: 'Отменён',      en: 'Cancelled',    qr: 'Biykar etildi', zh: '已取消', tr: 'İptal edildi', tg: 'Бекор шуд', kk: 'Бас тартылды', tk: 'Ýatyryldy', fa: 'لغو شد' },
};

const t = (key: string, lang: Language): string =>
    TX[key]?.[lang] ?? TX[key]?.['en'] ?? key;

function statusColor(status: string): string {
    switch (status) {
        case 'new': return 'bg-blue-50 text-blue-600';
        case 'processing': return 'bg-amber-50 text-amber-600';
        case 'shipping': return 'bg-indigo-50 text-indigo-600';
        case 'delivered': return 'bg-emerald-50 text-emerald-600';
        case 'cancelled': return 'bg-red-50 text-red-600';
        default: return 'bg-gray-50 text-gray-600';
    }
}

// ── Types ────────────────────────────────────────────────────────────────────
interface OrderData {
    id: number;
    status: string;
    customerName: string | null;
    contactPhone: string | null;
    totalAmount: number | null;
    createdAt: string;
    items: {
        id: number;
        quantity: number;
        price: number;
        product: {
            id: number;
            name: string;
            image: string;
        } | null;
    }[];
}

interface ProductionData {
    orderId: number;
    orderStatus: string;
    currentStage: string;
    progress: number;
    stages: ProductionStage[];
    workOrderId: number | null;
    workOrderStatus: string | null;
}

// ── QR toggle state per item ─────────────────────────────────────────────────
function QRLifecycleSection({ orderId, items, language }: { orderId: number; items: OrderData['items']; language: Language }) {
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                <QrCode size={16} className="text-blue-500" />
                <h2 className="font-bold text-gray-800 text-sm">
                    {t('qrLifecycle', language)}
                </h2>
            </div>
            <div className="divide-y divide-gray-50">
                {items.map((item, idx) => {
                    const qrValue = `https://pack24.uz/qr/P24-${orderId}-${idx}`;
                    const isOpen = openIdx === idx;

                    return (
                        <div key={item.id} className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                                        {item.product?.image ? (
                                            <Image
                                                src={item.product.image}
                                                alt={item.product.name}
                                                className="w-full h-full object-contain"
                                                width={100}
                                                height={100}
                                            />
                                        ) : (
                                            <Box size={16} className="text-gray-300" />
                                        )}
                                    </div>
                                    <p className="text-sm font-semibold text-gray-800 truncate">
                                        {item.product?.name ?? 'Mahsulot'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                        isOpen
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                                    }`}
                                >
                                    <QrCode size={12} />
                                    {t('viewQr', language)}
                                </button>
                            </div>

                            {isOpen && (
                                <div className="mt-4 flex flex-col items-center gap-3 py-3 bg-gray-50/50 rounded-xl">
                                    <QRCodeGenerator value={qrValue} size={160} showLabel />
                                    <a
                                        href={`/qr/P24-${orderId}-${idx}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                                    >
                                        {t('openLifecycle', language)}
                                        <ArrowLeft size={12} className="rotate-180" />
                                    </a>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ProductionTrackPage() {
    const { id } = useParams<{ id: string }>();
    const { language } = useLanguage();
    const { status: sessionStatus } = useSession();
    const router = useRouter();

    const [order, setOrder] = useState<OrderData | null>(null);
    const [production, setProduction] = useState<ProductionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const [orderRes, prodRes] = await Promise.all([
                fetch(`/api/orders/${id}`),
                fetch(`/api/orders/${id}/production`),
            ]);

            if (!orderRes.ok) throw new Error('Order fetch failed');
            if (!prodRes.ok) throw new Error('Production fetch failed');

            const [orderData, prodData] = await Promise.all([
                orderRes.json(),
                prodRes.json(),
            ]);

            setOrder(orderData);
            setProduction(prodData);
            setError(false);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [id]);

    // Redirect to login if unauthenticated
    useEffect(() => {
        if (sessionStatus === 'unauthenticated') {
            router.push('/login');
        }
    }, [sessionStatus, router]);

    // Initial fetch
    useEffect(() => {
        if (sessionStatus === 'authenticated') {
            fetchData();
        }
    }, [sessionStatus, fetchData]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (sessionStatus !== 'authenticated') return;
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [sessionStatus, fetchData]);

    // ── Loading state ────────────────────────────────────────────────────
    if (loading || sessionStatus === 'loading') {
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
    if (error || !order || !production) {
        return (
            <div className="min-h-screen bg-surface-page flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle size={52} className="text-gray-200 mb-4" />
                <h1 className="text-xl font-extrabold text-gray-900 mb-2">
                    {t(error ? 'error' : 'notFound', language)}
                </h1>
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={() => { setLoading(true); setError(false); fetchData(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
                    >
                        <RefreshCw size={14} />
                        {t('retry', language)}
                    </button>
                    <Link
                        href="/my-orders"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        <ArrowLeft size={14} />
                        {t('backToOrders', language)}
                    </Link>
                </div>
            </div>
        );
    }

    // Determine which stage is "active" for the info card
    const activeStageKey =
        production.stages.find((s) => s.status === 'in_progress')?.stage ??
        (order.status === 'shipping' ? 'yetkazish' : null) ??
        (order.status === 'delivered' ? 'yetkazish' : null) ??
        production.currentStage;

    const ActiveIcon = STAGE_ICONS[activeStageKey] ?? Package;
    const createdDate = new Date(order.createdAt);

    return (
        <div className="min-h-screen bg-surface-page">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16">
                {/* Back + Header */}
                <div className="mb-6">
                    <Link
                        href="/my-orders"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors mb-4"
                    >
                        <ArrowLeft size={16} />
                        {t('backToOrders', language)}
                    </Link>

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-900">
                                {t('order', language)} #{order.id}
                            </h1>
                            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1">
                                <Clock size={12} />
                                {createdDate.toLocaleDateString('uz-UZ', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                })}
                            </p>
                        </div>
                        <span
                            className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusColor(order.status)}`}
                        >
                            {STATUS_LABELS[order.status]?.[language] ??
                                STATUS_LABELS[order.status]?.['en'] ??
                                order.status}
                        </span>
                    </div>
                </div>

                {/* Production Tracker Card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="font-bold text-gray-800 flex items-center gap-2">
                            <Factory size={16} className="text-blue-500" />
                            {t('production', language)}
                        </h2>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                            <RefreshCw size={10} className="animate-spin" />
                            {t('autoRefresh', language)}
                        </span>
                    </div>

                    <ProductionTracker
                        stages={production.stages}
                        currentStage={production.currentStage}
                        progress={production.progress}
                        orderStatus={order.status}
                        language={language}
                    />
                </div>

                {/* Current Stage Detail Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                            <ActiveIcon size={22} className="text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">
                                {t('currentStage', language)}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                {STAGE_DESCRIPTIONS[activeStageKey]?.[language] ??
                                    STAGE_DESCRIPTIONS[activeStageKey]?.['en'] ??
                                    ''}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Order Items */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                        <Package size={16} className="text-blue-500" />
                        <h2 className="font-bold text-gray-800 text-sm">
                            {t('products', language)}
                        </h2>
                        <span className="text-xs text-gray-400 ml-auto">
                            {order.items.length} {t('pcs', language)}
                        </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {order.items.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors"
                            >
                                <div className="w-14 h-14 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden shrink-0">
                                    {item.product?.image ? (
                                        <Image
                                            src={item.product.image}
                                            alt={item.product.name}
                                            className="w-full h-full object-contain"
                                            width={300}
                                            height={300}
                                        />
                                    ) : (
                                        <Box
                                            size={20}
                                            className="m-auto mt-3 text-gray-300"
                                        />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">
                                        {item.product?.name ?? 'Mahsulot'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {item.quantity} {t('pcs', language)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* QR Lifecycle Section */}
                <div className="mt-6">
                    <QRLifecycleSection
                        orderId={order.id}
                        items={order.items}
                        language={language}
                    />
                </div>
            </div>
        </div>
    );
}
