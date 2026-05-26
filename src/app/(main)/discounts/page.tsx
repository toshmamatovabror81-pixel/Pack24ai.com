'use client';

import { useLanguage } from '@/lib/contexts/LanguageContext';
import Link from 'next/link';
import {
    ChevronRight, Percent, Star, Crown,
    TrendingUp, Mail, Phone, CheckCircle, Trophy
} from 'lucide-react';

const DISCOUNT_TIERS = [
    {
        discount: '3%',
        range: { uz: "500 000 — 2 000 000 so'm", ru: "500 000 — 2 000 000 сум" },
        desc: {
            uz: "500 000 dan 2 000 000 so'mgacha bo'lgan buyurtmalarda chegirma 3% ni tashkil qiladi.",
            ru: "При сумме заказа от 500 000 до 2 000 000 сум скидка составляет 3%.",
        },
        color: 'border-blue-400 bg-blue-50',
        badge: 'bg-blue-100 text-blue-700',
        icon: '🎯',
    },
    {
        discount: '5%',
        range: { uz: "2 000 000 — 5 000 000 so'm", ru: "2 000 000 — 5 000 000 сум" },
        desc: {
            uz: "2 000 000 dan 5 000 000 so'mgacha bo'lgan buyurtmalarda chegirma 5% ni tashkil qiladi.",
            ru: "При сумме заказа от 2 000 000 до 5 000 000 сум скидка составляет 5%.",
        },
        color: 'border-emerald-400 bg-emerald-50',
        badge: 'bg-emerald-100 text-emerald-700',
        icon: '✨',
    },
    {
        discount: '7%',
        range: { uz: "5 000 000 — 15 000 000 so'm", ru: "5 000 000 — 15 000 000 сум" },
        desc: {
            uz: "5 000 000 dan 15 000 000 so'mgacha bo'lgan buyurtmalarda chegirma 7% ni tashkil qiladi.",
            ru: "При сумме заказа от 5 000 000 до 15 000 000 сум скидка составляет 7%.",
        },
        color: 'border-purple-400 bg-purple-50',
        badge: 'bg-purple-100 text-purple-700',
        icon: '💎',
    },
    {
        discount: '10%',
        range: { uz: "15 000 000 — 30 000 000 so'm", ru: "15 000 000 — 30 000 000 сум" },
        desc: {
            uz: "15 000 000 dan 30 000 000 so'mgacha bo'lgan buyurtmalarda chegirma 10% ni tashkil qiladi.",
            ru: "При сумме заказа от 15 000 000 до 30 000 000 сум скидка составляет 10%.",
        },
        color: 'border-orange-400 bg-orange-50',
        badge: 'bg-orange-100 text-orange-700',
        icon: '🏅',
    },
    {
        discount: '15%',
        range: { uz: "30 000 000 so'mdan", ru: "от 30 000 000 сум" },
        desc: {
            uz: "30 000 000 so'mdan ortiq buyurtmada chegirma 15% va asosiy mijoz maqomi beriladi. Bu maqom keyingi barcha buyurtmalarda ham saqlanib qoladi.",
            ru: "При сумме заказа от 30 000 000 сум скидка составляет 15% и присваивается статус ключевого клиента, позволяющий сохранить скидку на все последующие заказы.",
        },
        color: 'border-yellow-400 bg-yellow-50',
        badge: 'bg-yellow-100 text-yellow-700',
        icon: '🥇',
        highlight: true,
    },
    {
        discount: 'VIP',
        range: { uz: "60 000 000 so'mdan", ru: "от 60 000 000 сум" },
        desc: {
            uz: "Sotuv bo'limi boshlig'i orqali shaxsiy doimiy chegirmalar va hamkorlik shartlari belgilanadi.",
            ru: "Персональные постоянные скидки и условия работы будут присвоены через начальника отдела продаж.",
        },
        color: 'border-red-400 bg-red-50',
        badge: 'bg-red-100 text-red-700',
        icon: '👑',
    },
];

export default function DiscountsPage() {
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
                    <span className="text-gray-900 font-medium">{t("Chegirmalar", "Скидки")}</span>
                </nav>
            </div>

            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
                    {t("Chegirmalar", "Скидки")}
                </h1>
                <p className="text-gray-500 text-sm mb-8">
                    {t("Buyurtma summasiga qarab chegirma qanday beriladi", "Как получить скидку")}
                </p>

                {/* ── Discount tiers ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                            <Percent size={20} className="text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {t("Chegirma olish qanday amalga oshiriladi", "Как получить скидку")}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {t("Chegirma buyurtma summasiga bog'liq", "Размер скидки зависит от суммы заказа")}
                            </p>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-100">
                        {DISCOUNT_TIERS.map((tier, i) => (
                            <div
                                key={i}
                                className={`flex items-start gap-5 p-6 border-l-4 ${tier.color} ${tier.highlight ? 'relative' : ''}`}
                            >
                                {tier.highlight && (
                                    <div className="absolute top-3 right-4 flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                                        <Star size={10} className="fill-amber-500 text-amber-500" />
                                        {t("Asosiy mijoz maqomi", "Статус ключевого клиента")}
                                    </div>
                                )}
                                <div className="text-3xl shrink-0">{tier.icon}</div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                        <span className={`text-sm font-bold px-3 py-0.5 rounded-full ${tier.badge}`}>
                                            {t("Chegirma", "Скидка")} {tier.discount}
                                        </span>
                                        <span className="text-sm font-semibold text-gray-700">
                                            {language === 'ru' ? tier.range.ru : tier.range.uz}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                        {language === 'ru' ? tier.desc.ru : tier.desc.uz}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Individual & Wholesale ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <Crown size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {t("Individual narxlar va o'zaro foydali shartlar", "Индивидуальные цены и взаимовыгодные условия")}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {t("Kam to'laganingiz yaxshi", "Хорошо, когда меньше платишь")}
                            </p>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-100">
                        {[
                            {
                                icon: TrendingUp,
                                iconBg: 'bg-blue-100 text-blue-600',
                                title: t("Ulgurji va tender uchun individual narxlar", "Индивидуальные цены для оптовиков и тендеров"),
                                desc: t(
                                    "Katta ulgurji va tenderlar uchun eksklyuziv shartlar va individual narxlarni taklif qila olamiz.",
                                    "При крупном опте и для тендеров можем предложить вам эксклюзивные условия и индивидуальные цены."
                                ),
                            },
                            {
                                icon: Trophy,
                                iconBg: 'bg-emerald-100 text-emerald-600',
                                title: t("Korporativ hamkorlik", "Корпоративное сотрудничество"),
                                desc: t(
                                    "Tenderlar va davlat xaridlarida ishtirok etmaymiz, lekin o'zaro foydali hamkorlik shartlarini taklif eta olamiz.",
                                    "В тендерах и гос. закупках не участвуем, но можем предложить вам взаимовыгодные условия."
                                ),
                            },
                            {
                                icon: Mail,
                                iconBg: 'bg-purple-100 text-purple-600',
                                title: t("So'rov asosida hisob-kitob qilamiz", "Производим расчёт по заявке"),
                                desc: t(
                                    "sales@pack24.uz elektron pochta manziliga erkin shaklda xat yuboring va menejerimiz qulay usulda siz bilan bog'lanadi.",
                                    "Отправьте в свободной форме письмо на эл. почту sales@pack24.uz и менеджер свяжется с вами любым удобным способом."
                                ),
                            },
                        ].map(({ icon: Icon, iconBg, title, desc }, i) => (
                            <div key={i} className="flex gap-5 p-6">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                                    <Icon size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-1 text-sm">{title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── How to use ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
                        <CheckCircle size={18} className="text-emerald-500" />
                        <h2 className="text-base font-bold text-gray-900">
                            {t("Chegirmalar qanday ishlaydi?", "Как работают скидки?")}
                        </h2>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                {
                                    step: '1',
                                    title: t("Katalogdan tanlang", "Выберите в каталоге"),
                                    desc: t("Kerakli mahsulotlarni savatga soling.", "Добавьте нужные товары в корзину."),
                                },
                                {
                                    step: '2',
                                    title: t("Buyurtma bering", "Оформите заказ"),
                                    desc: t("Buyurtma summasi chegirma chegarasiga yetganda chegirma avtomatik qo'shiladi.", "При достижении суммой заказа порога скидки — скидка применяется автоматически."),
                                },
                                {
                                    step: '3',
                                    title: t("Chegirmani oling", "Получите скидку"),
                                    desc: t("Chegirma yakuniy summadan ayiriladi. Jami tejash ko'ringanda buyurtmani tasdiqlang.", "Скидка вычитается из итоговой суммы. Подтвердите заказ, увидев итоговую экономию."),
                                },
                            ].map(({ step, title, desc }, i) => (
                                <div key={i} className="bg-gray-50 rounded-xl p-4 flex gap-3">
                                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                                        {step}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm mb-0.5">{title}</p>
                                        <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
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
                            {t("Chegirma haqida savolingiz bormi?", "Есть вопросы по скидкам?")}
                        </h3>
                        <p className="text-blue-200/80 text-sm">
                            {t(
                                "Menejerimiz bilan bog'laning — individual shartlarni muhokama qilamiz.",
                                "Свяжитесь с нашим менеджером — обсудим индивидуальные условия."
                            )}
                        </p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                        <Link
                            href="/catalog"
                            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5"
                        >
                            {t("Xarid qilish", "Начать покупки")}
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
