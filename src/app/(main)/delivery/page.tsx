'use client';

import { useLanguage } from '@/lib/contexts/LanguageContext';
import Link from 'next/link';
import {
    Truck, MapPin, Clock, Phone, Package,
    CheckCircle, ChevronRight, Store, Car, Box, Info
} from 'lucide-react';

export default function DeliveryPage() {
    const { language } = useLanguage();
    const t = (uz: string, ru: string) => language === 'ru' ? ru : uz;

    return (
        <div className="min-h-screen bg-surface-page">
            {/* ── Breadcrumb ── */}
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <nav className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-blue-600 transition-colors">
                        {t("Bosh sahifa", "Главная")}
                    </Link>
                    <ChevronRight size={14} />
                    <span className="text-gray-900 font-medium">{t("Yetkazib berish", "Доставка")}</span>
                </nav>
            </div>

            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-8">
                    {t("Yetkazib berish", "Доставка")}
                </h1>

                {/* ── 1. O'z-o'ziga olib ketish ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                                <Store size={20} className="text-orange-500" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {t("Ombordan o'z-o'ziga olib ketish", "Самовывоз со склада в Ташкенте")}
                            </h2>
                        </div>
                        <span className="text-emerald-600 font-bold text-lg">
                            {t("Bepul", "Бесплатно")}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                        {/* Left info */}
                        <div className="p-6 space-y-5">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                    {t("Ombor manzili:", "Адрес склада:")}
                                </p>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    {t(
                                        "Toshkent shahri, Yunusobod tumani, Amir Temur ko'chasi, 15-uy",
                                        "г. Ташкент, Юнусабадский район, ул. Амира Темура, 15"
                                    )}
                                    <br />
                                    {t("42-darvoza — mijozlar xizmat ko'rsatish hududi", "Ворота 42 — зона обслуживания клиентов")}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                    {t("O'z-o'ziga olib ketish ish vaqti:", "Режим работы склада для самовывоза:")}
                                </p>
                                <p className="text-sm text-gray-700">
                                    {t(
                                        "Ish kunlari: 08:00 dan 21:00 gacha, Dam olish kunlari: 09:00 dan 21:00 gacha",
                                        "По будням: с 08:00 до 21:00, По выходным: с 09:00 до 21:00"
                                    )}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                    {t("Ombor telefoni:", "Телефон склада:")}
                                </p>
                                <a href="tel:+998712005683" className="text-sm text-blue-600 font-medium hover:underline">
                                    +998 71 200-56-83
                                </a>
                                <span className="text-sm text-gray-500 ml-2">{t("Administrator", "Администратор")}</span>
                            </div>
                        </div>

                        {/* Map placeholder */}
                        <div className="relative bg-gray-100 min-h-[240px] lg:min-h-0">
                            <iframe
                                src="https://yandex.com/map-widget/v1/?ll=69.279737%2C41.299496&z=15&pt=69.279737,41.299496,pm2rdl"
                                width="100%"
                                height="100%"
                                className="absolute inset-0 w-full h-full min-h-[240px] border-0"
                                allowFullScreen
                                title="Ombor xaritasi"
                            />
                        </div>
                    </div>
                </div>

                {/* ── 2. Yetkazib berish punktlari ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                                <MapPin size={20} className="text-red-500" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {t("Yetkazib berish punktlari", "Пункты выдачи")}
                            </h2>
                        </div>
                        <span className="text-gray-700 font-bold text-lg">
                            {t("30 000 so'mdan", "от 30 000 сум")}
                        </span>
                    </div>

                    <div className="p-6">
                        <p className="text-sm text-gray-600 mb-5">
                            {t(
                                "O'zbekistonning 100 dan ortiq shaharlaridagi yetkazib berish punktlariga tezkor yetkazib berish. Aniq narx buyurtma rasmiylashtirishda menejer tomonidan aniqlanadi va aholi punkti, og'irlik hamda buyurtma hajmiga bog'liq.",
                                "Экспресс-доставка до пунктов выдачи в более чем 100 городах Узбекистана. Точная стоимость уточняется менеджером при формировании заказа и зависит от населённого пункта, веса и объёма заказа."
                            )}
                        </p>

                        <ul className="space-y-2 mb-6">
                            {[
                                t("Toshkent bo'yicha yetkazib berish — 30 000 so'mdan", "Доставка по Ташкенту — от 30 000 сум"),
                                t("Viloyatlar bo'yicha yetkazib berish — Zoomtrans, Express 24, Uzpost orqali", "Доставка по регионам — через Zoomtrans, Express 24, Uzpost"),
                                t("Yetkazib berish muddati: Toshkent — 1 kun, viloyatlar — 1-3 kun", "Срок доставки: Ташкент — 1 день, регионы — 1-3 дня"),
                                t("Gofrokarton o'rashga stretch-plyonka — BEPUL", "Упаковка гофрокороба в стрейч-плёнку — БЕСПЛАТНО"),
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                    <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                                    {item}
                                </li>
                            ))}
                        </ul>

                        {/* Delivery zone info */}
                        <div className="bg-blue-50 rounded-xl p-4 flex gap-3">
                            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-700">
                                {t(
                                    "Toshkent shahrida 500 000 so'mdan ortiq xaridda yetkazib berish BEPUL.",
                                    "При заказе от 500 000 сум доставка по Ташкенту — БЕСПЛАТНО."
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── 3. Kuryerlik & Pochta – 2 column ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Kuryerlik */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Car size={20} className="text-blue-500" />
                                </div>
                                <h2 className="text-base font-bold text-gray-900">
                                    {t("Kuryer orqali", "Курьером")}
                                </h2>
                            </div>
                            <span className="text-gray-700 font-bold">
                                {t("30 000 so'mdan", "от 30 000 сум")}
                            </span>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">
                                {t(
                                    "Narx yetkazib berish manziliga va buyurtma hajmiga bog'liq. Aniq narxni operator buyurtma rasmiylashtirishda aytadi.",
                                    "Стоимость зависит от адреса доставки и объёма отправки. Точную стоимость назовёт оператор при формировании заказа."
                                )}
                            </p>
                            <ul className="space-y-2">
                                {[
                                    t("Toshkent ichida: 1 kun ichida", "В пределах Ташкента: в течение 1 дня"),
                                    t("Buyurtma summasi 1 mln so'mdan: BEPUL", "При заказе от 1 млн сум: БЕСПЛАТНО"),
                                    t("Yuk ko'tarish: 5 tg gacha", "Подъём: до 5 этажа"),
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                        <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Pochta / Transport */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                    <Box size={20} className="text-purple-500" />
                                </div>
                                <h2 className="text-base font-bold text-gray-900">
                                    {t("Transport kompaniyalar", "Транспортные компании")}
                                </h2>
                            </div>
                            <span className="text-gray-700 font-bold">
                                {t("50 000 so'mdan", "от 50 000 сум")}
                            </span>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">
                                {t(
                                    "Viloyatlar bo'yicha yetkazib berish transportkompaniya tariflari asosida hisoblanadi. O'rash, komplektatsiya va omborga yetkazib berish — BEPUL.",
                                    "Стоимость рассчитывается по тарифам транспортных компаний. Упаковка, комплектация и доставка до терминала — БЕСПЛАТНО."
                                )}
                            </p>
                            <ul className="space-y-2">
                                {[
                                    'Zoomtrans',
                                    'Express 24',
                                    'Uzpost',
                                    t("Yetkazib muddati: 1-5 ish kuni", "Срок доставки: 1-5 рабочих дней"),
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                        <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* ── 4. Qo'shimcha ma'lumot ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <Package size={20} className="text-emerald-500" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">
                            {t("Qo'shimcha ma'lumot", "Дополнительная информация")}
                        </h2>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                {
                                    icon: Clock,
                                    color: 'bg-blue-50 text-blue-600',
                                    title: t("Buyurtma qabul vaqti", "Время приёма заказов"),
                                    desc: t("Har kuni 08:00 – 22:00", "Ежедневно 08:00 – 22:00"),
                                },
                                {
                                    icon: Truck,
                                    color: 'bg-emerald-50 text-emerald-600',
                                    title: t("Minimal buyurtma", "Минимальный заказ"),
                                    desc: t("Cheklovsiz", "Без ограничений"),
                                },
                                {
                                    icon: Phone,
                                    color: 'bg-orange-50 text-orange-600',
                                    title: t("Yetkazib berish bo'yicha", "По вопросам доставки"),
                                    desc: "+998 71 200-56-83",
                                },
                            ].map(({ icon: Icon, color, title, desc }, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                                        <Icon size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 mb-0.5">{title}</p>
                                        <p className="text-sm font-semibold text-gray-800">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── CTA ── */}
                <div className="bg-gradient-to-br from-brand-navy to-[#163860] rounded-2xl p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                        <h3 className="text-xl font-bold mb-2">
                            {t("Buyurtma bering — biz yetkazamiz!", "Оформите заказ — мы доставим!")}
                        </h3>
                        <p className="text-blue-200/80 text-sm">
                            {t(
                                "Savollaringiz bo'lsa, operatorimiz bilan bog'laning.",
                                "По любым вопросам обращайтесь к нашему оператору."
                            )}
                        </p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                        <Link
                            href="/catalog"
                            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5"
                        >
                            {t("Katalogga o'tish", "Перейти в каталог")}
                        </Link>
                        <a
                            href="tel:+998712005683"
                            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5"
                        >
                            <Phone size={16} />
                            {t("Qo'ng'iroq", "Позвонить")}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
