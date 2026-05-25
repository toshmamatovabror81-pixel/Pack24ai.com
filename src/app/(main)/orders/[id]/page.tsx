'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import { useCartStore } from '@/lib/store/useCartStore';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Package, Clock, Loader2, ChevronRight,
    Truck, MapPin, CheckCircle, XCircle,
    Phone, CreditCard, ArrowLeft, Box, ClipboardCheck, Star,
    RotateCcw, AlertTriangle, X, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import type { Language } from '@/lib/translations';

// ── i18n ─────────────────────────────────────────────────────────
const TX: Record<string, Partial<Record<Language, string>>> = {
    pageTitle:     { uz: "Buyurtma holati", ru: 'Статус заказа', en: 'Order Status', qr: "Buyırtpa halatı", zh: '订单状态', tr: 'Sipariş Durumu', tg: 'Ҳолати фармоиш', kk: 'Тапсырыс күйі', tk: 'Sargyt ýagdaýy', fa: 'وضعیت سفارش' },
    orderNum:      { uz: 'Buyurtma', ru: 'Заказ', en: 'Order', qr: 'Buyırtpa', zh: '订单', tr: 'Sipariş', tg: 'Фармоиш', kk: 'Тапсырыс', tk: 'Sargyt', fa: 'سفارش' },
    notFound:      { uz: "Buyurtma topilmadi", ru: 'Заказ не найден', en: 'Order not found', qr: "Buyırtpa tabılmadı", zh: '订单未找到', tr: 'Sipariş bulunamadı', tg: 'Фармоиш ёфт нашуд', kk: 'Тапсырыс табылмады', tk: 'Sargyt tapylmady', fa: 'سفارش پیدا نشد' },
    loading:       { uz: "Yuklanmoqda...", ru: 'Загрузка...', en: 'Loading...', qr: "Júklenmoqda...", zh: '加载中...', tr: 'Yükleniyor...', tg: 'Боркунӣ...', kk: 'Жүктелуде...', tk: 'Ýüklenýär...', fa: 'بارگذاری...' },
    products:      { uz: 'Mahsulotlar', ru: 'Товары', en: 'Products', qr: 'Mallar', zh: '商品', tr: 'Ürünler', tg: 'Маҳсулотҳо', kk: 'Тауарлар', tk: 'Harytlar', fa: 'محصولات' },
    total:         { uz: 'Jami', ru: 'Итого', en: 'Total', qr: 'Jami', zh: '总计', tr: 'Toplam', tg: 'Ҷамъ', kk: 'Жиыны', tk: 'Jemi', fa: 'مجموع' },
    delivery:      { uz: 'Yetkazish', ru: 'Доставка', en: 'Delivery', qr: 'Jetkeriw', zh: '配送', tr: 'Teslimat', tg: 'Тавзеъ', kk: 'Жеткізу', tk: 'Eltip bermek', fa: 'تحویل' },
    payment:       { uz: "To'lov", ru: 'Оплата', en: 'Payment', qr: 'Tólew', zh: '付款', tr: 'Ödeme', tg: 'Пардохт', kk: 'Төлем', tk: 'Töleg', fa: 'پرداخت' },
    address:       { uz: 'Manzil', ru: 'Адрес', en: 'Address', qr: 'Manzil', zh: '地址', tr: 'Adres', tg: 'Суроға', kk: 'Мекенжай', tk: 'Adres', fa: 'آدرس' },
    contact:       { uz: "Bog'lanish", ru: 'Контакт', en: 'Contact', qr: "Baylanıs", zh: '联系方式', tr: 'İletişim', tg: 'Тамос', kk: 'Байланыс', tk: 'Habarlaşmak', fa: 'تماس' },
    comment:       { uz: 'Izoh', ru: 'Комментарий', en: 'Comment', qr: 'Izoh', zh: '备注', tr: 'Yorum', tg: 'Шарҳ', kk: 'Түсініктеме', tk: 'Bellik', fa: 'توضیح' },
    backOrders:    { uz: 'Buyurtmalarga', ru: 'К заказам', en: 'Back to Orders', qr: 'Buyırtpalarga', zh: '返回订单', tr: 'Siparişlere', tg: 'Ба фармоишҳо', kk: 'Тапсырыстарға', tk: 'Sargytlara', fa: 'به سفارشات' },
    catalog:       { uz: 'Katalogga', ru: 'В каталог', en: 'Go to Catalog', qr: 'Katalogqa', zh: '去目录', tr: 'Kataloğa git', tg: 'Ба каталог', kk: 'Каталогқа', tk: 'Kataloga git', fa: 'به کاتالوگ' },
    operatorHelp:  { uz: "Savollar bo'lsa, qo'ng'iroq qiling", ru: 'По вопросам звоните', en: 'For questions, call us', qr: "Sorawlarıńız bolsa, qońıraw qılıń", zh: '如有疑问请致电', tr: 'Sorular için bizi arayın', tg: 'Барои саволҳо занг занед', kk: 'Сұрақтарыңыз болса, қоңырау шалыңыз', tk: 'Soraglaryňyz bolsa, jaň ediň', fa: 'برای سوالات تماس بگیرید' },
    pcs:           { uz: 'dona', ru: 'шт.', en: 'pcs', qr: 'dana', zh: '件', tr: 'adet', tg: 'дона', kk: 'дана', tk: 'sany', fa: 'عدد' },
    cancel:        { uz: 'Buyurtmani bekor qilish', ru: 'Отменить заказ', en: 'Cancel Order', qr: 'Buyırtpanı biykar etiw', zh: '取消订单', tr: 'Siparişi iptal et', tg: 'Бекор кардани фармоиш', kk: 'Тапсырысты бас тарту', tk: 'Sargydy ýatyrmak', fa: 'لغو سفارش' },
    reorder:       { uz: 'Qayta buyurtma berish', ru: 'Повторить заказ', en: 'Reorder', qr: 'Qayta buyırtpa beriw', zh: '重新下单', tr: 'Tekrar sipariş ver', tg: 'Фармоиши такрорӣ', kk: 'Қайта тапсырыс беру', tk: 'Gaýtadan sargyt bermek', fa: 'سفارش مجدد' },
    cancelConfirm: { uz: "Buyurtmani bekor qilmoqchimisiz?", ru: 'Отменить заказ?', en: 'Cancel this order?', qr: 'Buyırtpanı biykar etesizbе?', zh: '确定取消订单？', tr: 'Siparişi iptal et?', tg: 'Фармоишро бекор мекунед?', kk: 'Тапсырысты бас тарту?', tk: 'Sargydy ýatyrmak?', fa: 'لغو سفارش؟' },
    cancelWarning: { uz: "Bu amalni ortga qaytarib bo'lmaydi", ru: 'Это действие необратимо', en: 'This action cannot be undone', qr: 'Bu ámeldi qaytarıp bolmaydı', zh: '此操作无法撤销', tr: 'Bu işlem geri alınamaz', tg: 'Ин амал бебозгашт аст', kk: 'Бұл әрекетті кері қайтару мүмкін емес', tk: 'Bu hereket yzyna gaýtarylyp bilinmez', fa: 'این عملیات قابل بازگشت نیست' },
    yes:           { uz: 'Ha, bekor qilish', ru: 'Да, отменить', en: 'Yes, cancel', qr: 'Áwа, biykar etiw', zh: '是的，取消', tr: 'Evet, iptal et', tg: 'Бале, бекор кунед', kk: 'Иә, бас тарту', tk: 'Hawa, ýatyrmak', fa: 'بله، لغو کن' },
    no:            { uz: "Yo'q", ru: 'Нет', en: 'No', qr: 'Joq', zh: '不', tr: 'Hayır', tg: 'Не', kk: 'Жоқ', tk: 'Ýok', fa: 'خیر' },
    cancelSuccess: { uz: "Buyurtma bekor qilindi", ru: 'Заказ отменён', en: 'Order cancelled', qr: 'Buyırtpa biykar etildi', zh: '订单已取消', tr: 'Sipariş iptal edildi', tg: 'Фармоиш бекор шуд', kk: 'Тапсырыс бас тартылды', tk: 'Sargyt ýatyryldy', fa: 'سفارش لغو شد' },
    cancelError:   { uz: "Bekor qilib bo'lmadi", ru: 'Не удалось отменить', en: 'Failed to cancel', qr: 'Biykar etip bolmadı', zh: '取消失败', tr: 'İptal edilemedi', tg: 'Бекор нашуд', kk: 'Бас тарту сәтсіз', tk: 'Ýatyryp bolmady', fa: 'لغو نشد' },
    reorderSuccess:{ uz: "Mahsulotlar savatga qo'shildi!", ru: 'Товары добавлены в корзину!', en: 'Items added to cart!', qr: 'Mallar sawatqa qosıldı!', zh: '商品已加入购物车！', tr: 'Ürünler sepete eklendi!', tg: 'Маҳсулот ба сабад илова шуд!', kk: 'Тауарлар себетке қосылды!', tk: 'Harytlar sebede goşuldy!', fa: 'محصولات به سبد اضافه شد!' },
    copyId:        { uz: 'Nusxalandi', ru: 'Скопировано', en: 'Copied', qr: 'Nusxalandı', zh: '已复制', tr: 'Kopyalandı', tg: 'Нусхабардорӣ шуд', kk: 'Көшірілді', tk: 'Göçürildi', fa: 'کپی شد' },
    now:           { uz: 'Hozir', ru: 'Сейчас', en: 'Now', qr: 'Házir', zh: '现在', tr: 'Şimdi', tg: 'Ҳозир', kk: 'Қазір', tk: 'Häzir', fa: 'اکنون' },
};

const t = (key: string, lang: Language): string =>
    TX[key]?.[lang] ?? TX[key]?.['en'] ?? key;

// ── Buyurtma bosqichlari ─────────────────────────────────────────
const ORDER_STEPS: {
    key: string;
    icon: typeof Package;
    labels: Partial<Record<Language, string>>;
}[] = [
    {
        key: 'new',
        icon: ClipboardCheck,
        labels: { uz: 'Qabul qilindi', ru: 'Принят', en: 'Accepted', qr: 'Qabıllandı', zh: '已接受', tr: 'Kabul edildi', tg: 'Қабул шуд', kk: 'Қабылданды', tk: 'Kabul edildi', fa: 'پذیرفته شد' },
    },
    {
        key: 'processing',
        icon: Box,
        labels: { uz: 'Tayyorlanmoqda', ru: 'Готовится', en: 'Processing', qr: 'Tayarlanmoqda', zh: '处理中', tr: 'Hazırlanıyor', tg: 'Омода мешавад', kk: 'Дайындалуда', tk: 'Taýýarlanýar', fa: 'در حال آماده‌سازی' },
    },
    {
        key: 'shipping',
        icon: Truck,
        labels: { uz: "Yo'lda", ru: 'В пути', en: 'Shipping', qr: "Jolda", zh: '运输中', tr: 'Yolda', tg: 'Дар роҳ', kk: 'Жолда', tk: 'Ýolda', fa: 'در راه' },
    },
    {
        key: 'delivered',
        icon: CheckCircle,
        labels: { uz: 'Yetkazildi', ru: 'Доставлен', en: 'Delivered', qr: 'Jetkizildi', zh: '已送达', tr: 'Teslim edildi', tg: 'Расонда шуд', kk: 'Жеткізілді', tk: 'Eltip berildi', fa: 'تحویل داده شد' },
    },
];

const CANCELLED_STEP = {
    key: 'cancelled',
    icon: XCircle,
    labels: { uz: 'Bekor qilindi', ru: 'Отменён', en: 'Cancelled', qr: 'Biykar etildi', zh: '已取消', tr: 'İptal edildi', tg: 'Бекор шуд', kk: 'Бас тартылды', tk: 'Ýatyryldy', fa: 'لغو شد' },
};

const DELIVERY_LABELS: Record<string, Partial<Record<Language, string>>> = {
    courier: { uz: '🚚 Kuryer', ru: '🚚 Курьер', en: '🚚 Courier', zh: '🚚 快递' },
    pickup:  { uz: '📦 Olib ketish', ru: '📦 Самовывоз', en: '📦 Self-Pickup', zh: '📦 自提' },
};

const PAYMENT_LABELS: Record<string, Partial<Record<Language, string>>> = {
    click:   { uz: '🔵 Click', ru: '🔵 Click', en: '🔵 Click' },
    payme:   { uz: '🟢 Payme', ru: '🟢 Payme', en: '🟢 Payme' },
    cash:    { uz: "💵 Naqd pul", ru: '💵 Наличные', en: '💵 Cash', zh: '💵 现金' },
};

const PAYMENT_STATUS_LABELS: Record<string, Partial<Record<Language, string>>> = {
    pending:  { uz: "Kutilmoqda", ru: 'Ожидается', en: 'Pending', zh: '待处理' },
    awaiting: { uz: "To'lov kutilmoqda", ru: 'Ожидание оплаты', en: 'Awaiting', zh: '等待中' },
    paid:     { uz: "To'langan", ru: 'Оплачен', en: 'Paid', zh: '已支付' },
    failed:   { uz: "Muvaffaqiyatsiz", ru: 'Ошибка', en: 'Failed', zh: '失败' },
};

interface OrderData {
    id: number;
    status: string;
    customerName: string | null;
    contactPhone: string | null;
    shippingAddress: string | null;
    shippingLocation: string | null;
    comment: string | null;
    deliveryMethod: string | null;
    paymentMethod: string | null;
    paymentStatus: string;
    totalAmount: number | null;
    createdAt: string;
    updatedAt: string;
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

export default function OrderTrackingPage() {
    const { id } = useParams<{ id: string }>();
    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const router = useRouter();
    const addToCart = useCartStore(s => s.addToCart);

    const [order, setOrder] = useState<OrderData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [cancelModal, setCancelModal] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/orders/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
            })
            .then(data => { setOrder(data); setLoading(false); })
            .catch(() => { setError(true); setLoading(false); });
    }, [id]);

    // Cancel handler
    const handleCancel = async () => {
        if (!order) return;
        setCancelling(true);
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel' }),
            });
            if (res.ok) {
                const updated = await res.json();
                setOrder(updated);
                toast.success(t('cancelSuccess', language));
            } else {
                const err = await res.json();
                toast.error(err.error || t('cancelError', language));
            }
        } catch {
            toast.error(t('cancelError', language));
        } finally {
            setCancelling(false);
            setCancelModal(false);
        }
    };

    // Reorder handler
    const handleReorder = () => {
        if (!order) return;
        let added = 0;
        for (const item of order.items) {
            if (item.product) {
                addToCart({
                    productId: item.product.id,
                    name: item.product.name,
                    price: item.price,
                    image: item.product.image,
                    quantity: item.quantity,
                });
                added++;
            }
        }
        if (added > 0) {
            toast.success(t('reorderSuccess', language));
            router.push('/cart');
        }
    };

    // Copy order ID
    const copyOrderId = () => {
        navigator.clipboard.writeText(`#${order?.id}`).then(() => {
            toast.success(t('copyId', language));
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin text-blue-500" />
                    <p className="text-sm text-gray-400">{t('loading', language)}</p>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex flex-col items-center justify-center p-8 text-center">
                <Package size={52} className="text-gray-200 mb-4" />
                <h1 className="text-xl font-extrabold text-gray-900 mb-2">{t('notFound', language)}</h1>
                <Link href="/my-orders" className="mt-4 text-blue-600 font-bold text-sm hover:underline flex items-center gap-1">
                    <ArrowLeft size={14} /> {t('backOrders', language)}
                </Link>
            </div>
        );
    }

    const isCancelled = order.status === 'cancelled';
    const currentStepIdx = ORDER_STEPS.findIndex(s => s.key === order.status);
    const activeIdx = currentStepIdx >= 0 ? currentStepIdx : (isCancelled ? -1 : 0);
    const createdDate = new Date(order.createdAt);
    const canCancel = ['new', 'processing'].includes(order.status);
    const canReorder = ['delivered', 'cancelled'].includes(order.status);

    return (
        <div className="min-h-screen bg-[#f5f6fa]">
            {/* Cancel Confirmation Modal */}
            {cancelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCancelModal(false)} />
                    <div className="relative bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                        <button onClick={() => setCancelModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
                            <X size={18} />
                        </button>
                        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle size={28} className="text-red-500" />
                        </div>
                        <h3 className="text-lg font-extrabold text-gray-900 text-center mb-1">{t('cancelConfirm', language)}</h3>
                        <p className="text-sm text-gray-400 text-center mb-6">{t('cancelWarning', language)}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setCancelModal(false)}
                                className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                {t('no', language)}
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={cancelling}
                                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 font-bold text-sm text-white transition-colors flex items-center justify-center gap-2"
                            >
                                {cancelling && <Loader2 size={14} className="animate-spin" />}
                                {t('yes', language)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Breadcrumb */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <nav className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Link href="/" className="hover:text-blue-600">🏠</Link>
                    <ChevronRight size={12} />
                    <Link href="/my-orders" className="hover:text-blue-600">{t('backOrders', language)}</Link>
                    <ChevronRight size={12} />
                    <span className="text-gray-800 font-medium">#{order.id}</span>
                </nav>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-extrabold text-gray-900">
                                {t('orderNum', language)} #{order.id}
                            </h1>
                            <button onClick={copyOrderId} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Copy">
                                <Copy size={14} className="text-gray-400" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock size={12} />
                            {createdDate.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                            {' · '}
                            {createdDate.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">{t('total', language)}</p>
                        <p className="text-xl font-extrabold text-blue-700">{format(order.totalAmount ?? 0)}</p>
                    </div>
                </div>

                {/* ─── STEPPER ────────────────────────────────────────── */}
                {isCancelled ? (
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-6 flex items-center gap-4">
                        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                            <XCircle size={28} className="text-red-500" />
                        </div>
                        <div>
                            <p className="font-extrabold text-red-700 text-lg">
                                {CANCELLED_STEP.labels[language] ?? CANCELLED_STEP.labels.en}
                            </p>
                            <p className="text-sm text-red-400">
                                {createdDate.toLocaleDateString('uz-UZ')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                        {/* Desktop Stepper */}
                        <div className="hidden sm:flex items-start justify-between relative">
                            {/* Progress bar background */}
                            <div className="absolute top-[26px] left-[52px] right-[52px] h-1 bg-gray-100 rounded-full" />
                            {/* Progress bar filled */}
                            <div
                                className="absolute top-[26px] left-[52px] h-1 bg-blue-500 rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${activeIdx >= 0 ? (activeIdx / (ORDER_STEPS.length - 1)) * (100 - (100 / ORDER_STEPS.length)) : 0}%` }}
                            />

                            {ORDER_STEPS.map((step, i) => {
                                const isCompleted = i <= activeIdx;
                                const isCurrent = i === activeIdx;
                                const Icon = step.icon;
                                return (
                                    <div key={step.key} className="flex flex-col items-center z-10 flex-1">
                                        <div className={`w-[52px] h-[52px] rounded-2xl flex items-center justify-center transition-all duration-500 ${
                                            isCurrent
                                                ? 'bg-blue-600 shadow-lg shadow-blue-200 ring-4 ring-blue-100 scale-110'
                                                : isCompleted
                                                    ? 'bg-blue-500'
                                                    : 'bg-gray-100'
                                        }`}>
                                            <Icon size={22} className={isCompleted ? 'text-white' : 'text-gray-400'} />
                                        </div>
                                        <p className={`mt-3 text-xs font-bold text-center leading-tight ${
                                            isCurrent ? 'text-blue-700' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                                        }`}>
                                            {step.labels[language] ?? step.labels.en}
                                        </p>
                                        {isCurrent && (
                                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">
                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                                {t('now', language)}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Mobile Stepper */}
                        <div className="sm:hidden space-y-0">
                            {ORDER_STEPS.map((step, i) => {
                                const isCompleted = i <= activeIdx;
                                const isCurrent = i === activeIdx;
                                const Icon = step.icon;
                                const isLast = i === ORDER_STEPS.length - 1;
                                return (
                                    <div key={step.key} className="flex items-stretch gap-3">
                                        {/* Vertical line + icon */}
                                        <div className="flex flex-col items-center">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                                                isCurrent
                                                    ? 'bg-blue-600 shadow-md shadow-blue-200 ring-2 ring-blue-100'
                                                    : isCompleted
                                                        ? 'bg-blue-500'
                                                        : 'bg-gray-100'
                                            }`}>
                                                <Icon size={18} className={isCompleted ? 'text-white' : 'text-gray-400'} />
                                            </div>
                                            {!isLast && (
                                                <div className={`w-0.5 flex-1 min-h-[24px] transition-colors ${
                                                    i < activeIdx ? 'bg-blue-400' : 'bg-gray-200'
                                                }`} />
                                            )}
                                        </div>
                                        {/* Label */}
                                        <div className="pt-2 pb-4">
                                            <p className={`text-sm font-bold ${
                                                isCurrent ? 'text-blue-700' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                                            }`}>
                                                {step.labels[language] ?? step.labels.en}
                                            </p>
                                            {isCurrent && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 mt-0.5">
                                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                                    {t('now', language)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ─── LEFT: Mahsulotlar ro'yxati ──────────────────── */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                                <Package size={16} className="text-blue-500" />
                                <h2 className="font-bold text-gray-800 text-sm">{t('products', language)}</h2>
                                <span className="text-xs text-gray-400 ml-auto">{order.items.length} {t('pcs', language)}</span>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {order.items.map(item => (
                                    <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors">
                                        <Link href={`/product/${item.product?.id ?? '#'}`} className="shrink-0">
                                            <div className="w-14 h-14 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                                                {item.product?.image
                                                    ? <Image src={item.product.image} alt={item.product.name} className="w-full h-full object-contain" width={300} height={300} />
                                                    : <Box size={20} className="m-auto mt-3 text-gray-300" />
                                                }
                                            </div>
                                        </Link>
                                        <div className="flex-1 min-w-0">
                                            <Link href={`/product/${item.product?.id ?? '#'}`} className="text-sm font-semibold text-gray-800 hover:text-blue-600 truncate block">
                                                {item.product?.name ?? 'Mahsulot'}
                                            </Link>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {item.quantity} {t('pcs', language)} × {format(item.price)}
                                            </p>
                                        </div>
                                        <p className="font-bold text-gray-900 text-sm shrink-0">{format(item.price * item.quantity)}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="px-5 py-4 bg-gray-50 flex items-center justify-between">
                                <span className="font-bold text-gray-700">{t('total', language)}</span>
                                <span className="font-extrabold text-lg text-blue-700">{format(order.totalAmount ?? 0)}</span>
                            </div>
                        </div>

                        {/* Action buttons for completed/cancelled orders */}
                        {(canCancel || canReorder) && (
                            <div className="flex flex-col sm:flex-row gap-3">
                                {canReorder && (
                                    <button
                                        onClick={handleReorder}
                                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-blue-200"
                                    >
                                        <RotateCcw size={16} />
                                        {t('reorder', language)}
                                    </button>
                                )}
                                {canCancel && (
                                    <button
                                        onClick={() => setCancelModal(true)}
                                        className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-3.5 rounded-xl text-sm transition-colors"
                                    >
                                        <XCircle size={16} />
                                        {t('cancel', language)}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ─── RIGHT: Buyurtma tafsilotlari ────────────────── */}
                    <div className="space-y-4">
                        {/* Delivery & Payment */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                            {order.deliveryMethod && (
                                <div className="flex items-start gap-3">
                                    <Truck size={16} className="text-blue-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">{t('delivery', language)}</p>
                                        <p className="text-sm font-semibold text-gray-800">
                                            {DELIVERY_LABELS[order.deliveryMethod]?.[language] ?? DELIVERY_LABELS[order.deliveryMethod]?.en ?? order.deliveryMethod}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {order.paymentMethod && (
                                <div className="flex items-start gap-3">
                                    <CreditCard size={16} className="text-blue-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">{t('payment', language)}</p>
                                        <p className="text-sm font-semibold text-gray-800">
                                            {PAYMENT_LABELS[order.paymentMethod]?.[language] ?? PAYMENT_LABELS[order.paymentMethod]?.en ?? order.paymentMethod}
                                        </p>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                                            order.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600'
                                                : order.paymentStatus === 'failed' ? 'bg-red-50 text-red-600'
                                                : 'bg-amber-50 text-amber-600'
                                        }`}>
                                            {PAYMENT_STATUS_LABELS[order.paymentStatus]?.[language] ?? PAYMENT_STATUS_LABELS[order.paymentStatus]?.en ?? order.paymentStatus}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {order.shippingAddress && (
                                <div className="flex items-start gap-3">
                                    <MapPin size={16} className="text-blue-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">{t('address', language)}</p>
                                        <p className="text-sm text-gray-700">{order.shippingAddress}</p>
                                        {order.shippingLocation && (
                                            <a
                                                href={`https://www.google.com/maps?q=${order.shippingLocation}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 font-semibold hover:underline inline-flex items-center gap-1 mt-0.5"
                                            >
                                                🗺️ Xaritada ko&apos;rish →
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {order.contactPhone && (
                                <div className="flex items-start gap-3">
                                    <Phone size={16} className="text-blue-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">{t('contact', language)}</p>
                                        <p className="text-sm font-semibold text-gray-800">{order.customerName}</p>
                                        <p className="text-xs text-gray-500">{order.contactPhone}</p>
                                    </div>
                                </div>
                            )}

                            {order.comment && (
                                <div className="flex items-start gap-3">
                                    <Star size={16} className="text-amber-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">{t('comment', language)}</p>
                                        <p className="text-sm text-gray-600 italic">&quot;{order.comment}&quot;</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Operator contact */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5 text-center">
                            <p className="text-xs text-blue-600 font-semibold mb-2">{t('operatorHelp', language)}</p>
                            <a href="tel:+998880557888" className="inline-flex items-center gap-2 text-blue-700 font-extrabold text-lg hover:underline">
                                <Phone size={16} />
                                +998 88 055-78-88
                            </a>
                        </div>

                        {/* Navigation */}
                        <div className="flex gap-3">
                            <Link href="/my-orders" className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                                <ArrowLeft size={14} />
                                {t('backOrders', language)}
                            </Link>
                            <Link href="/catalog" className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-700 transition-colors">
                                {t('catalog', language)}
                                <ChevronRight size={14} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
