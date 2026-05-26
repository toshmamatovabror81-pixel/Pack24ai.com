'use client';

import { useLanguage } from '@/lib/contexts/LanguageContext';
import Link from 'next/link';
import {
    ChevronRight, Building2, User, CreditCard,
    Banknote, Smartphone, ShieldCheck, Wallet, CheckCircle, Lock
} from 'lucide-react';

export default function PaymentPage() {
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
                    <span className="text-gray-900 font-medium">{t("To'lov", "Оплата")}</span>
                </nav>
            </div>

            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-8">
                    {t("To'lov", "Оплата")}
                </h1>

                {/* ── Yuridik shaxslar ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Building2 size={20} className="text-blue-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">
                            {t("Yuridik shaxslar", "Юридические лица")}
                        </h2>
                    </div>

                    <div className="divide-y divide-gray-100">
                        {/* Step 1 */}
                        <div className="flex gap-5 p-6">
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">1</div>
                            <div>
                                <h3 className="font-bold text-gray-900 mb-1">
                                    {t("Hisob-faktura yuboramiz", "Выставляем счёт на оплату")}
                                </h3>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {t(
                                        "Hisob-faktura yuborilgan kundan boshlab 5 ish kuni davomida amal qiladi. QQS bilan ishlaymiz. Agar hisob dam olish yoki bayram kunida to'lansa, tovar birinchi ish kunida — omborida mavjud bo'lsa — jo'natiladi.",
                                        "Счёт действителен 5 рабочих дней с момента выставления. Работаем с НДС. Если счёт оплачен в выходной или праздничный день, отгрузка производится в первый рабочий день при наличии товара на складе."
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-5 p-6">
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">2</div>
                            <div>
                                <h3 className="font-bold text-gray-900 mb-1">
                                    {t("Buyurtmani kuryer orqali jo'natamiz yoki ombordan beramiz", "Отправляем заказ курьером через ТК или выдаём на складе")}
                                </h3>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {t(
                                        "Pulimiz hisob raqamimizga tushishi bilan darhol jo'natamiz. Ombordan olish uchun tashkilot muhrli ishonchnoma talab qilinadi (direktor o'zi olsa — muhr kifoya).",
                                        "Осуществляем отправку сразу после поступления оплаты на наш р/с. Для получения товара на складе требуется оригинал доверенности или печать организации, если заказ будет получать директор."
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex gap-5 p-6">
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">3</div>
                            <div>
                                <h3 className="font-bold text-gray-900 mb-1">
                                    {t("Tovar bilan birga hujjatlar beramiz", "С товаром прикладываем накладную или отправляем почтой")}
                                </h3>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {t(
                                        "Tovar bilan birga hisob-faktura va yetkazib berish hujjatlari beriladi. Kerak bo'lsa, shartnoma va hisob originallarini pochta orqali yuboramiz.",
                                        "При необходимости можем выслать оригинал договора и счёта почтой по указанному адресу."
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Jismoniy shaxslar ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-gray-50">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <User size={20} className="text-emerald-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">
                            {t("Jismoniy shaxslar", "Физические лица")}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100">
                        {[
                            {
                                icon: Smartphone,
                                iconBg: 'bg-purple-100 text-purple-600',
                                commission: t("Komissiya — 0%", "Комиссия — 0%"),
                                commissionColor: 'text-emerald-600',
                                title: t("Payme / Click / Uzum orqali onlayn to'lov", "Онлайн оплата с сайта"),
                                desc: t(
                                    "Menejer bilan buyurtmani kelishganingizdan so'ng to'lash mumkin. To'lov vositasi sifatida Payme, Click, Uzum yoki VISA/Humo/UzCard plastik kartalari qabul qilinadi.",
                                    "Возможна после согласования заказа у менеджера. Принимаются карты VISA, Humo, UzCard, а также Payme и Click."
                                ),
                            },
                            {
                                icon: Banknote,
                                iconBg: 'bg-emerald-100 text-emerald-600',
                                commission: t("Komissiya — 0%", "Комиссия — 0%"),
                                commissionColor: 'text-emerald-600',
                                title: t("Ombordan naqd yoki karta bilan to'lash", "Наличными или картой на складе при самовывозе"),
                                desc: t(
                                    "Menejer bilan kelishganingizdan so'ng to'lash mumkin. VISA, Humo, UzCard plastik kartalari hamda naqd pul qabul qilinadi.",
                                    "Возможна после согласования заказа у менеджера. Принимаются карты VISA, Humo, UzCard, а также наличные."
                                ),
                            },
                            {
                                icon: CreditCard,
                                iconBg: 'bg-orange-100 text-orange-600',
                                commission: t("Komissiya — 0%", "Комиссия — 0%"),
                                commissionColor: 'text-emerald-600',
                                title: t("Kuryerga naqd pul bilan to'lash", "Оплата наличными курьеру"),
                                desc: t(
                                    "Transport kompaniyasi tanlovi, buyurtma summasi va yetkazib berish shahriga bog'liq. Batafsil ma'lumotni menejerdan so'rang.",
                                    "Возможность зависит от выбора транспортной компании, суммы заказа и города доставки. Подробности уточняйте у менеджера."
                                ),
                            },
                            {
                                icon: Wallet,
                                iconBg: 'bg-blue-100 text-blue-600',
                                commission: t("Komissiya — 0%", "Комиссия — 0%"),
                                commissionColor: 'text-emerald-600',
                                title: t("Uzum Nasiya / Bo'lib to'lash", "Рассрочка через Uzum Nasiya"),
                                desc: t(
                                    "Uzum Nasiya orqali 3–12 oyga bo'lib to'lash imkoniyati. Foizsiz va komissiyasiz. Menejer bilan kelishing.",
                                    "Рассрочка на 3–12 месяцев через Uzum Nasiya. Без процентов и комиссий. Согласуйте с менеджером."
                                ),
                            },
                        ].map(({ icon: Icon, iconBg, commission, commissionColor, title, desc }, i) => (
                            <div key={i} className="bg-white p-6 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                                        <Icon size={20} />
                                    </div>
                                    <span className={`text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 ${commissionColor}`}>
                                        {commission}
                                    </span>
                                </div>
                                <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
                                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Xavfsizlik ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
                        <Lock size={18} className="text-gray-500" />
                        <h2 className="text-base font-bold text-gray-900">
                            {t("To'lov xavfsizligi", "Безопасность платежей")}
                        </h2>
                    </div>
                    <div className="p-6">
                        <div className="flex items-start gap-4">
                            <ShieldCheck size={40} className="text-emerald-500 shrink-0 mt-1" />
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {t(
                                    "Sizning to'lov kartangiz ma'lumotlari PCI DSS xavfsizlik standartlari asosida kafolatli himoyalangan. Karta ma'lumotlari xavfsiz bank sahifasida kiritiladi va SSL shifrlash texnologiyasi orqali uzatiladi. Qo'shimcha autentifikatsiya uchun 3D Secure protokoli ishlatiladi (Verified by Visa / Mastercard SecureCode). Humo va UzCard kartalar uchun EMV 3DS protokoli qo'llaniladi.",
                                    "Данные Вашей платёжной карты гарантированно защищены в соответствии со стандартами безопасности PCI DSS. Данные карты вводятся на защищённой банковской платёжной странице, передача информации происходит с применением технологии шифрования SSL. Для дополнительной аутентификации используется протокол 3D-Secure (Verified by Visa / Mastercard SecureCode) и EMV 3DS для карт Humo/UzCard."
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Rekvizitlar ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
                        <Building2 size={18} className="text-gray-500" />
                        <h2 className="text-base font-bold text-gray-900">
                            {t("Bizning rekvizitlarimiz", "Наши реквизиты")}
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {/* Компания 1 */}
                        <div className="p-6">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                {t(
                                    "Pack24 MChJ (QQS to'lovchisi)",
                                    "Pack24 ООО (работает с НДС)"
                                )}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                {[
                                    [t("STIR:", "ИНН:"), "310 185 785"],
                                    [t("KTUT:", "ОКЭД:"), "46900"],
                                    [t("Hisob raqam:", "р/сч:"), "2020 8000 5052 2010 0003"],
                                    [t("Bank:", "Банк:"), t("Xalq banki", "Народный банк Узбекистана")],
                                    [t("MFO:", "МФО:"), "00873"],
                                    [t("Yuridik manzil:", "Юр. адрес:"), t("Toshkent sh., Yunusobod t., Amir Temur ko'ch. 15", "г. Ташкент, Юнусабадский р-н, пр. Амира Темура, 15")],
                                ].map(([label, value], i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="font-semibold text-gray-500 shrink-0">{label}</span>
                                        <span className="text-gray-800">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Компания 2 */}
                        <div className="p-6">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                {t(
                                    "Pack24 Yetkazib berish XK (QQS to'lovchisi)",
                                    "Pack24 Доставка ИП (работает с НДС)"
                                )}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                {[
                                    [t("STIR:", "ИНН:"), "310 185 786"],
                                    [t("KTUT:", "ОКЭД:"), "53200"],
                                    [t("Hisob raqam:", "р/сч:"), "2020 8000 6078 2010 0007"],
                                    [t("Bank:", "Банк:"), t("Kapitalbank", "Капиталбанк")],
                                    [t("MFO:", "МФО:"), "01598"],
                                    [t("Yuridik manzil:", "Юр. адрес:"), t("Toshkent sh., Mirzo Ulug'bek t., Bog'ishamol ko'ch. 40", "г. Ташкент, Мирзо-Улугбекский р-н, ул. Богишамол, 40")],
                                ].map(([label, value], i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="font-semibold text-gray-500 shrink-0">{label}</span>
                                        <span className="text-gray-800">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Qo'shimcha info ── */}
                <div className="bg-blue-50 rounded-2xl border border-blue-100 p-6 flex items-start gap-4">
                    <CheckCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800">
                        {t(
                            "To'lov yoki rekvizitlar bo'yicha savollar bo'lsa, bizning menejerlarimizga murojaat qiling: ",
                            "По вопросам оплаты или реквизитов обращайтесь к нашим менеджерам: "
                        )}
                        <a href="tel:+998880557888" className="font-bold underline hover:no-underline">
                            +998 88 055-78-88
                        </a>
                        {t(" yoki ", " или ")}
                        <a href="mailto:sales@pack24.uz" className="font-bold underline hover:no-underline">
                            sales@pack24.uz
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
