'use client';

import Image from 'next/image';
import { useState, useEffect, lazy, Suspense } from 'react';
import { useCartStore } from '@/lib/store/useCartStore';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRouter } from 'next/navigation';import { CreditCard, Truck, MapPin, User, Phone, Shield, CheckCircle, Loader2, Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Language } from '@/lib/translations';
import type { LocationData } from '@/components/LocationPicker';

// Lazy load — faqat kerak bo'lganda yuklanadi
const LocationPicker = lazy(() => import('@/components/LocationPicker'));

// ─── i18n: 10 tillik tarjimalar ──────────────────────────────────
const TX: Record<string, Partial<Record<Language, string>>> = {
    pageTitle:      { uz: 'Buyurtma rasmiylashtirish', ru: 'Оформление заказа', en: 'Checkout', qr: 'Buyırtpa rasmiylastırıw', zh: '结算', tr: 'Sipariş Onaylama', tg: 'Расмикунонии фармоиш', kk: 'Тапсырысты рәсімдеу', tk: 'Sargyt resmileşdirmek', fa: 'تکمیل سفارش' },
    items:          { uz: 'ta mahsulot', ru: 'товаров', en: 'items', qr: 'mal', zh: '件商品', tr: 'ürün', tg: 'маҳсулот', kk: 'тауар', tk: 'haryt', fa: 'محصول' },
    contactInfo:    { uz: "Bog'lanish ma'lumotlari", ru: 'Контактные данные', en: 'Contact Information', qr: "Baylanıs ma'lımatları", zh: '联系信息', tr: 'İletişim Bilgileri', tg: "Маълумоти тамос", kk: 'Байланыс мәліметтері', tk: 'Habarlaşmak maglumatlary', fa: 'اطلاعات تماس' },
    fullName:       { uz: 'Ism Familiya', ru: 'Имя и Фамилия', en: 'Full Name', qr: 'Atı Familiyası', zh: '姓名', tr: 'Ad Soyad', tg: 'Ном ва Насаб', kk: 'Аты-жөні', tk: 'Ady Familiýasy', fa: 'نام و نام خانوادگی' },
    namePlaceholder:{ uz: 'Ismingizni kiriting', ru: 'Введите имя', en: 'Enter your name', qr: 'Atıńızdı kiritiń', zh: '输入姓名', tr: 'Adınızı girin', tg: 'Номатонро нависед', kk: 'Атыңызды енгізіңіз', tk: 'Adyňyzy giriziň', fa: 'نام خود را وارد کنید' },
    phone:          { uz: 'Telefon', ru: 'Телефон', en: 'Phone', qr: 'Telefon', zh: '电话', tr: 'Telefon', tg: 'Телефон', kk: 'Телефон', tk: 'Telefon', fa: 'تلفن' },
    phoneFmt:       { uz: '+998XXXXXXXXX formatida kiriting', ru: 'Формат: +998XXXXXXXXX', en: 'Format: +998XXXXXXXXX', qr: '+998XXXXXXXXX formatında', zh: '格式: +998XXXXXXXXX', tr: 'Format: +998XXXXXXXXX', tg: 'Формат: +998XXXXXXXXX', kk: 'Формат: +998XXXXXXXXX', tk: 'Format: +998XXXXXXXXX', fa: 'فرمت: +998XXXXXXXXX' },
    delivery:       { uz: 'Yetkazib berish', ru: 'Доставка', en: 'Delivery', qr: 'Jetkeriw', zh: '配送', tr: 'Teslimat', tg: 'Тавзеъ', kk: 'Жеткізу', tk: 'Eltip bermek', fa: 'تحویل' },
    courier:        { uz: 'Kuryer yetkazib berish', ru: 'Курьерская доставка', en: 'Courier Delivery', qr: 'Kuryer jetkeriw', zh: '快递配送', tr: 'Kurye Teslimatı', tg: 'Тавзеъ бо курер', kk: 'Курьерлік жеткізу', tk: 'Kurýer eltip bermek', fa: 'ارسال با پیک' },
    pickup:         { uz: "O'zingiz olib ketish", ru: 'Самовывоз', en: 'Self-Pickup', qr: "O'zińiz alıp ketiw", zh: '自提', tr: 'Gelip Alma', tg: 'Бурдани мол', kk: 'Өзі алып кету', tk: 'Özüňiz alyp gitmek', fa: 'وصول شخصی' },
    courierTime:    { uz: '1-2 kun', ru: '1-2 дня', en: '1-2 days', qr: '1-2 kún', zh: '1-2天', tr: '1-2 gün', tg: '1-2 рӯз', kk: '1-2 күн', tk: '1-2 gün', fa: '۱-۲ روز' },
    pickupTime:     { uz: 'Bugun', ru: 'Сегодня', en: 'Today', qr: 'Búgin', zh: '今天', tr: 'Bugün', tg: 'Имрӯз', kk: 'Бүгін', tk: 'Şu gün', fa: 'امروز' },
    free:           { uz: 'Bepul', ru: 'Бесплатно', en: 'Free', qr: 'Biypul', zh: '免费', tr: 'Ücretsiz', tg: 'Ройгон', kk: 'Тегін', tk: 'Mugt', fa: 'رایگان' },
    addressLabel:   { uz: 'Yetkazish manzili', ru: 'Адрес доставки', en: 'Shipping Address', qr: 'Jetkeriw mánzili', zh: '配送地址', tr: 'Teslimat Adresi', tg: 'Суроғаи тавзеъ', kk: 'Жеткізу мекенжайы', tk: 'Eltip bermek adresi', fa: 'آدرس ارسال' },
    addressHint:    { uz: "Toshkent sh., Chilonzor t., Bunyodkor ko'ch. 12", ru: 'Ташкент, ул. Бунёдкор, 12', en: 'Tashkent, Bunyodkor str. 12', qr: "Tashkent, Chilanzar", zh: '塔什干，布尼奥德科尔街12号', tr: 'Taşkent, Bunyodkor cad. 12', tg: 'Тошканд, кӯчаи Бунёдкор, 12', kk: 'Ташкент, Буниодкор к. 12', tk: 'Daşkent, Bunyodkor köç. 12', fa: 'تاشکند، خیابان بنیادکار ۱۲' },
    locationLabel:  { uz: '📍 Joylashuv (xaritadan)', ru: '📍 Геолокация (на карте)', en: '📍 Location (from map)', qr: '📍 Joylashuw (xaritadan)', zh: '📍 位置（地图）', tr: '📍 Konum (haritadan)', tg: '📍 Ҷойгиршавӣ (аз харита)', kk: '📍 Орналасу (картадан)', tk: '📍 Ýerleşiş (kartadan)', fa: '📍 مکان (از نقشه)' },
    paymentMethod:  { uz: "To'lov usuli", ru: 'Способ оплаты', en: 'Payment Method', qr: 'Tólew usılı', zh: '付款方式', tr: 'Ödeme Yöntemi', tg: 'Усули пардохт', kk: 'Төлем тәсілі', tk: 'Töleg usuly', fa: 'روش پرداخت' },
    commentLabel:   { uz: 'Izoh (ixtiyoriy)', ru: 'Комментарий (необязательно)', en: 'Comment (optional)', qr: 'Izoh (ixtiyariy)', zh: '备注（可选）', tr: 'Yorum (isteğe bağlı)', tg: 'Шарҳ (ихтиёрӣ)', kk: 'Түсініктеме (міндетті емес)', tk: 'Bellik (islege görä)', fa: 'توضیح (اختیاری)' },
    commentHint:    { uz: "Qo'shimcha ma'lumot...", ru: 'Дополнительная информация...', en: 'Additional information...', qr: "Qosımsha ma'lımat...", zh: '附加信息...', tr: 'Ek bilgi...', tg: 'Маълумоти иловагӣ...', kk: 'Қосымша ақпарат...', tk: 'Goşmaça maglumat...', fa: 'اطلاعات بیشتر...' },
    summary:        { uz: 'Buyurtma xulosasi', ru: 'Сводка заказа', en: 'Order Summary', qr: 'Buyırtpa qulası', zh: '订单摘要', tr: 'Sipariş Özeti', tg: 'Хулосаи фармоиш', kk: 'Тапсырыс қорытындысы', tk: 'Sargyt jemleýjisi', fa: 'خلاصه سفارش' },
    products:       { uz: 'Mahsulotlar', ru: 'Товары', en: 'Products', qr: 'Mallar', zh: '商品', tr: 'Ürünler', tg: 'Маҳсулотҳо', kk: 'Тауарлар', tk: 'Harytlar', fa: 'محصولات' },
    total:          { uz: 'Jami', ru: 'Итого', en: 'Total', qr: 'Jami', zh: '总计', tr: 'Toplam', tg: 'Ҷамъ', kk: 'Жиыны', tk: 'Jemi', fa: 'مجموع' },
    placeOrder:     { uz: 'Buyurtma berish', ru: 'Оформить заказ', en: 'Place Order', qr: 'Buyırtpa beriw', zh: '提交订单', tr: 'Sipariş Ver', tg: 'Фармоиш додан', kk: 'Тапсырыс беру', tk: 'Sargyt bermek', fa: 'ثبت سفارش' },
    placing:        { uz: 'Joylashtirilmoqda...', ru: 'Оформление...', en: 'Placing order...', qr: 'Joylastırılmoqda...', zh: '处理中...', tr: 'İşleniyor...', tg: 'Ҷойгир шуда истодааст...', kk: 'Өңделуде...', tk: 'Ýerleşdirilýär...', fa: 'در حال ثبت...' },
    ssl:            { uz: "Xavfsiz to'lov · SSL himoyasi", ru: 'Безопасная оплата · SSL защита', en: 'Secure payment · SSL protected', qr: "Xawpsiz tólew · SSL", zh: '安全支付 · SSL保护', tr: 'Güvenli ödeme · SSL', tg: 'Пардохти амн · SSL ҳимоя', kk: 'Қауіпсіз төлем · SSL', tk: 'Howpsuz töleg · SSL', fa: 'پرداخت امن · SSL' },
    orderSuccess:   { uz: 'Buyurtma qabul qilindi! 🎉', ru: 'Заказ принят! 🎉', en: 'Order placed! 🎉', qr: 'Buyırtpa qabıllandı! 🎉', zh: '订单已提交！🎉', tr: 'Sipariş alındı! 🎉', tg: 'Фармоиш қабул шуд! 🎉', kk: 'Тапсырыс қабылданды! 🎉', tk: 'Sargyt kabul edildi! 🎉', fa: 'سفارش ثبت شد! 🎉' },
    orderNum:       { uz: 'Buyurtma raqami', ru: 'Номер заказа', en: 'Order number', qr: 'Buyırtpa nomeri', zh: '订单号', tr: 'Sipariş numarası', tg: 'Рақами фармоиш', kk: 'Тапсырыс нөмірі', tk: 'Sargyt belgisi', fa: 'شماره سفارش' },
    operatorCall:   { uz: "Tez orada operator siz bilan bog'lanadi", ru: 'Скоро оператор с вами свяжется', en: 'Our operator will contact you shortly', qr: "Tez arada operator sizben baylanısadı", zh: '接线员将尽快与您联系', tr: 'Operatörümüz yakında sizi arayacak', tg: 'Оператор ба зудӣ бо шумо тамос мегирад', kk: 'Оператор жақында сізбен хабарласады', tk: 'Operator tiz wagtda siz bilen habarlaşar', fa: 'اپراتور ما به زودی با شما تماس خواهد گرفت' },
    myOrders:       { uz: 'Buyurtmalarim', ru: 'Мои заказы', en: 'My Orders', qr: 'Buyırtpalarım', zh: '我的订单', tr: 'Siparişlerim', tg: 'Фармоишҳои ман', kk: 'Менің тапсырыстарым', tk: 'Meniň sargytlarym', fa: 'سفارشات من' },
    catalog:        { uz: 'Katalog', ru: 'Каталог', en: 'Catalog', qr: 'Katalog', zh: '目录', tr: 'Katalog', tg: 'Каталог', kk: 'Каталог', tk: 'Katalog', fa: 'کاتالوگ' },
    payVia:         { uz: "orqali to'lash", ru: 'оплата', en: 'payment', qr: 'arqalı tólew', zh: '支付', tr: 'ödeme', tg: 'пардохт', kk: 'төлеу', tk: 'töleg', fa: 'پرداخت' },
    goToPayment:    { uz: "To'lov sahifasiga o'tish", ru: 'Перейти к оплате', en: 'Go to payment', qr: "Tólew bet'ine ótiw", zh: '前往付款', tr: 'Ödeme sayfasına git', tg: 'Ба саҳифаи пардохт гузаред', kk: 'Төлем бетіне өту', tk: 'Töleg sahypasyna geçiň', fa: 'رفتن به صفحه پرداخت' },
    payLater:       { uz: "To'lovni keyinroq amalga oshirish", ru: 'Оплатить позже', en: 'Pay later', qr: 'Keyinrek tólew', zh: '稍后付款', tr: 'Sonra öde', tg: 'Баъдтар пардохт кунед', kk: 'Кейін төлеу', tk: 'Soň töläň', fa: 'پرداخت بعدی' },
    enterName:      { uz: 'Ismingizni kiriting', ru: 'Введите имя', en: 'Enter your name', qr: 'Atıńızdı kiritiń', zh: '请输入姓名', tr: 'Adınızı girin', tg: 'Номро нависед', kk: 'Атыңызды енгізіңіз', tk: 'Adyňyzy ýazyň', fa: 'نام را وارد کنید' },
    enterPhone:     { uz: 'Telefon raqamini kiriting', ru: 'Введите телефон', en: 'Enter phone number', qr: 'Telefon nomerin kiritiń', zh: '请输入电话', tr: 'Telefonunuzu girin', tg: 'Рақами телефонро нависед', kk: 'Телефон нөмірін енгізіңіз', tk: 'Telefon belgiňizi ýazyň', fa: 'شماره تلفن را وارد کنید' },
    enterAddress:   { uz: 'Yetkazish manzilini kiriting', ru: 'Введите адрес доставки', en: 'Enter shipping address', qr: 'Jetkeriw mánzilin kiritiń', zh: '请输入配送地址', tr: 'Teslimat adresini girin', tg: 'Суроғаи тавзеъро нависед', kk: 'Жеткізу мекенжайын енгізіңіз', tk: 'Eltip bermek adresini ýazyň', fa: 'آدرس ارسال را وارد کنید' },
    errorOccurred:  { uz: 'Xatolik yuz berdi', ru: 'Произошла ошибка', en: 'An error occurred', qr: 'Qátelik júz berdi', zh: '发生错误', tr: 'Bir hata oluştu', tg: 'Хато рӯй дод', kk: 'Қате орын алды', tk: 'Ýalňyşlyk ýüze çykdy', fa: 'خطایی رخ داد' },
    payClickDesc:   { uz: "Click ilovasi yoki bank kartasi orqali", ru: 'Через приложение Click или банковскую карту', en: 'Via Click app or bank card', qr: 'Click', zh: 'Click应用', tr: 'Click', tg: 'Тавассути Click', kk: 'Click арқылы', tk: 'Click arkaly', fa: 'از طریق Click' },
    payPaymeDesc:   { uz: "Payme ilovasi yoki bank kartasi orqali", ru: 'Через приложение Payme или банковскую карту', en: 'Via Payme app or bank card', qr: 'Payme', zh: 'Payme应用', tr: 'Payme', tg: 'Тавассути Payme', kk: 'Payme арқылы', tk: 'Payme arkaly', fa: 'از طریق Payme' },
    payCashDesc:    { uz: "Yetkazib berishda to'lash", ru: 'Оплата при доставке', en: 'Pay on delivery', qr: 'Jetkizgende tólew', zh: '货到付款', tr: 'Teslimatta ödeme', tg: "Ҳангоми тавзеъ пардохт", kk: 'Жеткізу кезінде төлеу', tk: 'Eltip berende tölemek', fa: 'پرداخت هنگام تحویل' },
};

const t = (key: string, lang: Language): string =>
    TX[key]?.[lang] ?? TX[key]?.['en'] ?? key;

// ─── To'lov usullari ────────────────────────────────────────────
const PAYMENT_METHODS = [
    { id: 'click', name: 'Click', logo: '🔵', color: 'border-blue-200 hover:border-blue-500', activeColor: 'border-blue-500 bg-blue-50', descKey: 'payClickDesc' },
    { id: 'payme', name: 'Payme', logo: '🟢', color: 'border-green-200 hover:border-green-500', activeColor: 'border-green-500 bg-green-50', descKey: 'payPaymeDesc' },
    { id: 'cash',  name: 'Naqd pul', logo: '💵', color: 'border-gray-200 hover:border-gray-400', activeColor: 'border-gray-500 bg-gray-50', descKey: 'payCashDesc' },
];

export default function CheckoutPage() {
    const { items, clearCart } = useCartStore();
    const { format } = useCurrencySafe();
    const { language } = useLanguage();
    const router = useRouter();

    const [payMethod, setPayMethod]     = useState('click');
    const [delivery, setDelivery]       = useState('courier');
    const [name, setName]               = useState('');
    const [phone, setPhone]             = useState('');
    const [address, setAddress]         = useState('');
    const [comment, setComment]         = useState('');
    const [placing, setPlacing]         = useState(false);
    const [step, setStep]               = useState<'form' | 'payment' | 'success'>('form');
    const [payUrl, setPayUrl]           = useState('');
    const [orderId, setOrderId]         = useState<number | null>(null);
    const [location, setLocation]       = useState<LocationData | null>(null);

    const deliveryFee = delivery === 'courier' ? 20000 : 0;
    const subtotal    = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const total       = subtotal + deliveryFee;

    // Real-time telefon validatsiya
    const phoneRegexRT = /^\+998[0-9]{9}$/;
    const isPhoneValid = phone.trim() === '' || phoneRegexRT.test(phone.replace(/\s/g, ''));
    const isPhoneFull  = phoneRegexRT.test(phone.replace(/\s/g, ''));

    useEffect(() => {
        if (items.length === 0 && step === 'form') {
            router.push('/catalog');
        }
    }, [items, step, router]);

    const handleOrder = async () => {
        if (!name.trim())  { toast.error(t('enterName', language)); return; }
        if (!phone.trim()) { toast.error(t('enterPhone', language)); return; }
        if (!phoneRegexRT.test(phone.replace(/\s/g, ''))) {
            toast.error(t('phoneFmt', language)); return;
        }
        if (delivery === 'courier' && !address.trim()) {
            toast.error(t('enterAddress', language)); return;
        }

        setPlacing(true);
        try {
            const orderRes = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName:    name,
                    contactPhone:    phone,
                    shippingAddress: address,
                    shippingLocation: location ? `${location.lat},${location.lng}` : null,
                    comment,
                    deliveryMethod:  delivery,
                    paymentMethod:   payMethod,
                    status:          'new',
                    totalAmount:     total,
                    items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
                }),
            });

            if (!orderRes.ok) throw new Error('Order failed');
            const order = await orderRes.json();
            setOrderId(order.id);

            if (payMethod === 'click' || payMethod === 'payme') {
                const payRes = await fetch(`/api/payment/${payMethod}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order.id, amount: total }),
                });
                const payData = await payRes.json();
                if (payData.payUrl) {
                    setPayUrl(payData.payUrl);
                    setStep('payment');
                    clearCart();
                    return;
                }
            }

            clearCart();
            setStep('success');
        } catch (e) {
            toast.error(t('errorOccurred', language));
            console.error(e);
        } finally {
            setPlacing(false);
        }
    };

    // ── SUCCESS ──────────────────────────────────────────────────
    if (step === 'success') {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-lg">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                        <CheckCircle size={40} className="text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
                        {t('orderSuccess', language)}
                    </h1>
                    <p className="text-gray-500 text-sm mb-2">
                        {t('orderNum', language)}: <span className="font-mono font-bold text-gray-800">#{orderId}</span>
                    </p>
                    <p className="text-gray-400 text-sm mb-8">
                        {t('operatorCall', language)}
                    </p>
                    <div className="flex gap-3 justify-center">
                        <Link href={`/orders/${orderId}`} className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-blue-700 transition-colors">
                            {t('pageTitle', language)}
                        </Link>
                        <Link href="/catalog" className="border border-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                            {t('catalog', language)}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ── PAYMENT REDIRECT ─────────────────────────────────────────
    if (step === 'payment' && payUrl) {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-lg">
                    <div className="text-4xl mb-4">{payMethod === 'click' ? '🔵' : '🟢'}</div>
                    <h2 className="text-xl font-extrabold text-gray-900 mb-2">
                        {payMethod === 'click' ? 'Click' : 'Payme'} {t('payVia', language)}
                    </h2>
                    <p className="text-gray-500 text-sm mb-2">{t('total', language)}: <strong>{format(total)}</strong></p>
                    <a
                        href={payUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block w-full py-3.5 rounded-xl font-bold text-white text-sm transition-colors ${payMethod === 'click' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        {t('goToPayment', language)} →
                    </a>
                    <button onClick={() => setStep('success')} className="mt-3 text-xs text-gray-400 hover:text-gray-600">
                        {t('payLater', language)}
                    </button>
                </div>
            </div>
        );
    }

    // ── FORM ─────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#f5f6fa] py-8">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/cart" className="p-2 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                        <ArrowLeft size={16} className="text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-extrabold text-gray-900">{t('pageTitle', language)}</h1>
                        <p className="text-xs text-gray-400">{items.length} {t('items', language)}</p>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* LEFT: Form */}
                    <div className="flex-1 space-y-5">
                        {/* Contact info */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <User size={16} className="text-blue-500" /> {t('contactInfo', language)}
                            </h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="checkout-name" className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">{t('fullName', language)} *</label>
                                    <div className="relative">
                                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input id="checkout-name" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" placeholder={t('namePlaceholder', language)} />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="checkout-phone" className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                                        {t('phone', language)} *
                                        {isPhoneFull && <span className="ml-2 text-emerald-500">✓</span>}
                                    </label>
                                    <div className="relative">
                                        <Phone size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isPhoneValid ? 'text-gray-400' : 'text-red-400'}`} />
                                        <input id="checkout-phone" value={phone} onChange={e => setPhone(e.target.value)} type="tel" className={`w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none transition-colors ${!isPhoneValid ? 'border-red-300 focus:border-red-400 bg-red-50/30' : isPhoneFull ? 'border-emerald-300 focus:border-emerald-400' : 'border-gray-200 focus:border-blue-400'}`} placeholder="+998901234567" />
                                    </div>
                                    {!isPhoneValid && phone.length > 4 && (
                                        <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">⚠ {t('phoneFmt', language)}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Delivery */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Truck size={16} className="text-blue-500" /> {t('delivery', language)}
                            </h2>
                            <div className="grid sm:grid-cols-2 gap-3 mb-4">
                                {[
                                    { id: 'courier', label: t('courier', language), price: 20000, icon: Truck, time: t('courierTime', language) },
                                    { id: 'pickup',  label: t('pickup', language),  price: 0,     icon: MapPin, time: t('pickupTime', language) },
                                ].map(d => (
                                    <button
                                        key={d.id}
                                        type="button"
                                        onClick={() => setDelivery(d.id)}
                                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${delivery === d.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300'}`}
                                    >
                                        <d.icon size={18} className={delivery === d.id ? 'text-blue-600' : 'text-gray-400'} />
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{d.label}</p>
                                            <p className="text-xs text-gray-400">{d.time} · {d.price > 0 ? format(d.price) : t('free', language)}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {delivery === 'courier' && (
                                <div className="space-y-4">
                                    {/* Manzil textarea */}
                                    <div>
                                        <label htmlFor="checkout-address" className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">{t('addressLabel', language)} *</label>
                                        <div className="relative">
                                            <MapPin size={14} className="absolute left-3 top-3 text-gray-400" />
                                            <textarea id="checkout-address" value={address} onChange={e => setAddress(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none" placeholder={t('addressHint', language)} />
                                        </div>
                                    </div>

                                    {/* 📍 YANGI: Xarita + Geolokatsiya */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                                            {t('locationLabel', language)}
                                        </label>
                                        <Suspense fallback={
                                            <div className="w-full h-[260px] rounded-2xl border-2 border-gray-200 bg-gray-50 flex items-center justify-center">
                                                <Loader2 size={24} className="animate-spin text-gray-400" />
                                            </div>
                                        }>
                                            <LocationPicker
                                                language={language}
                                                onLocationSelect={(loc) => setLocation(loc.lat !== 0 ? loc : null)}
                                                initialLocation={location}
                                            />
                                        </Suspense>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Payment */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <CreditCard size={16} className="text-blue-500" /> {t('paymentMethod', language)}
                            </h2>
                            <div className="grid sm:grid-cols-3 gap-3">
                                {PAYMENT_METHODS.map(pm => (
                                    <button
                                        key={pm.id}
                                        type="button"
                                        onClick={() => setPayMethod(pm.id)}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${payMethod === pm.id ? pm.activeColor : pm.color + ' border-gray-100'}`}
                                    >
                                        <span className="text-2xl">{pm.logo}</span>
                                        <span className="font-bold text-sm text-gray-800">{pm.name}</span>
                                        <span className="text-[10px] text-gray-400 text-center">{t(pm.descKey, language)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Comment */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">{t('commentLabel', language)}</label>
                            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none" placeholder={t('commentHint', language)} />
                        </div>
                    </div>

                    {/* RIGHT: Summary */}
                    <div className="lg:w-80 flex-shrink-0">
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm sticky top-20">
                            <h2 className="font-bold text-gray-800 mb-4">{t('summary', language)}</h2>

                            <div className="space-y-3 mb-4">
                                {items.map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 shrink-0">
                                            {item.image
                                                ? <Image src={item.image} alt={item.name} className="w-full h-full object-contain" width={300} height={300} />
                                                : <Package size={14} className="m-auto mt-2 text-gray-300" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                                            <p className="text-[10px] text-gray-400">{item.quantity} × {format(item.price)}</p>
                                        </div>
                                        <p className="text-xs font-bold text-gray-900 shrink-0">{format(item.price * item.quantity)}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span>{t('products', language)}</span>
                                    <span>{format(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>{t('delivery', language)}</span>
                                    <span>{deliveryFee > 0 ? format(deliveryFee) : <span className="text-emerald-600 font-semibold">{t('free', language)}</span>}</span>
                                </div>
                                {location && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>📍</span>
                                        <span className="text-[10px] font-mono text-gray-400">{location.lat}, {location.lng}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-extrabold text-gray-900 text-base pt-1 border-t border-gray-100">
                                    <span>{t('total', language)}</span>
                                    <span>{format(total)}</span>
                                </div>
                            </div>

                            <button
                                onClick={handleOrder}
                                disabled={placing}
                                className="mt-5 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-blue-200"
                            >
                                {placing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                {placing ? t('placing', language) : t('placeOrder', language)}
                            </button>

                            <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-gray-400">
                                <Shield size={11} />
                                {t('ssl', language)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
