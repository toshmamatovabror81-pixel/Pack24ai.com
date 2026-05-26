'use client';

import { useLanguage } from '@/lib/contexts/LanguageContext';
import Link from 'next/link';
import { useState } from 'react';
import {
    ChevronRight, MapPin, Clock, Briefcase,
    Banknote, Calendar, ChevronDown, Send, User, Phone, Mail
} from 'lucide-react';

const VACANCIES = [
    {
        id: 1,
        title: { uz: "Komplektatorchi", ru: "Комплектовщик" },
        salary: { uz: "3 000 000 — 6 000 000 so'm", ru: "3 000 000 — 6 000 000 сум" },
        experience: { uz: "1 yildan", ru: "от 1 года" },
        schedule: { uz: "To'liq stavka, 5/2 yoki 2/2 jadval", ru: "Полная занятость, график 5/2, 2/2" },
        location: "Toshkent",
        published: "05.03.2026",
        color: 'bg-blue-50 border-blue-200',
        badge: 'bg-blue-100 text-blue-700',
        icon: '📦',
        description: {
            uz: [
                "Buyurtmalarni katalog va qadoqlash ro'yxatiga ko'ra yig'ish",
                "Tayyor buyurtmalarni tekshirish va qadoqlash",
                "Inventarizatsiyada qatnashish",
                "Omborda tartib va tozalikni saqlash",
            ],
            ru: [
                "Сборка заказов по каталогу и упаковочному листу",
                "Проверка и упаковка готовых заказов",
                "Участие в инвентаризации",
                "Поддержание порядка и чистоты на складе",
            ],
        },
        requirements: {
            uz: [
                "Kamida 1 yil omborxona ishi tajribasi",
                "Mas'uliyatlilik va aniqlik",
                "Jismoniy chidamlilik",
            ],
            ru: [
                "Опыт работы на складе от 1 года",
                "Ответственность и внимательность",
                "Физическая выносливость",
            ],
        },
        conditions: {
            uz: [
                "Rasmiy rasmiylashtirilish",
                "Barqaror maosh ва bonuslar",
                "Qulay ish joyi va jamoasi",
                "Karyera o'sishi imkoniyati",
            ],
            ru: [
                "Официальное трудоустройство",
                "Стабильная зарплата и бонусы",
                "Удобное место работы и дружный коллектив",
                "Возможности карьерного роста",
            ],
        },
    },
    {
        id: 2,
        title: { uz: "Sotuv menejeri", ru: "Менеджер по продажам" },
        salary: { uz: "5 000 000 — 12 000 000 so'm", ru: "5 000 000 — 12 000 000 сум" },
        experience: { uz: "Tajribasiz bo'lsa ham mumkin", ru: "Опыт не обязателен" },
        schedule: { uz: "To'liq stavka, 5/2", ru: "Полная занятость, 5/2" },
        location: "Toshkent",
        published: "01.03.2026",
        color: 'bg-emerald-50 border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-700',
        icon: '📞',
        description: {
            uz: [
                "Kelayotgan buyurtmalar va so'rovlar bilan ishlash",
                "Mavjud mijozlarni saqlash va yangilarini jalb etish",
                "Buyurtmalarni rasmiylashtirishda yordam berish",
                "CRM tizimida ma'lumotlarni yuritish",
            ],
            ru: [
                "Работа с входящими заказами и запросами",
                "Удержание существующих клиентов и привлечение новых",
                "Помощь в оформлении заказов",
                "Ведение данных в CRM-системе",
            ],
        },
        requirements: {
            uz: [
                "Yaxshi muloqot ko'nikmalari",
                "PC bilan ishlash qobiliyati",
                "Mas'uliyatlilik va tashabbuskorlik",
            ],
            ru: [
                "Хорошие коммуникативные навыки",
                "Уверенный пользователь ПК",
                "Ответственность и инициативность",
            ],
        },
        conditions: {
            uz: [
                "Rasmiy rasmiylashtirilish",
                "Ish bo'yicha o'qitish",
                "Maosh + savdo bonuslari",
                "Karyera o'sishi",
            ],
            ru: [
                "Официальное трудоустройство",
                "Обучение в процессе работы",
                "Оклад + бонус от продаж",
                "Карьерный рост",
            ],
        },
    },
    {
        id: 3,
        title: { uz: "Kuryer-haydovchi", ru: "Курьер-водитель" },
        salary: { uz: "4 000 000 — 8 000 000 so'm", ru: "4 000 000 — 8 000 000 сум" },
        experience: { uz: "1 yildan (B toifali guvohnoma)", ru: "от 1 года (права категории B)" },
        schedule: { uz: "To'liq stavka, smenali", ru: "Полная занятость, сменный график" },
        location: "Toshkent",
        published: "20.02.2026",
        color: 'bg-orange-50 border-orange-200',
        badge: 'bg-orange-100 text-orange-700',
        icon: '🚚',
        description: {
            uz: [
                "Toshkent shahri va atrofida tovarlarni yetkazib berish",
                "Yo'l varaqalarini to'ldirish",
                "Avtomashinani tartibli saqlash",
            ],
            ru: [
                "Доставка товаров по Ташкенту и пригороду",
                "Заполнение путевых листов",
                "Содержание автомобиля в чистоте и порядке",
            ],
        },
        requirements: {
            uz: [
                "B toifali haydovchilik guvohnomasi",
                "Shahar ko'chalarini bilish",
                "Mas'uliyatlilik",
            ],
            ru: [
                "Водительское удостоверение категории B",
                "Знание городских маршрутов",
                "Ответственность",
            ],
        },
        conditions: {
            uz: [
                "Rasmiy rasmiylashtirilish",
                "Korporativ avtomobil",
                "Yonilg'i kompensatsiya",
                "Barqaror maosh",
            ],
            ru: [
                "Официальное трудоустройство",
                "Корпоративный автомобиль",
                "Компенсация ГСМ",
                "Стабильная зарплата",
            ],
        },
    },
];

export default function VacanciesPage() {
    const { language } = useLanguage();
    const t  = (uz: string, ru: string) => language === 'ru' ? ru : uz;

    const [openId,    setOpenId]    = useState<number | null>(null);
    const [applyId,   setApplyId]   = useState<number | null>(null);
    const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });

    const toggle = (id: number) => setOpenId(prev => prev === id ? null : id);

    return (
        <div className="min-h-screen bg-surface-page">
            {/* Breadcrumb */}
            <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <nav className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-blue-600">{t("Bosh sahifa", "Главная")}</Link>
                    <ChevronRight size={14} />
                    <span className="text-gray-900 font-medium">{t("Vakansiyalar", "Вакансии")}</span>
                </nav>
            </div>

            <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{t("Vakansiyalar", "Вакансии")}</h1>
                <p className="text-sm text-gray-400 mb-8">{VACANCIES.length} {t("ta bo'sh o'rin", "открытых вакансии")}</p>

                {/* Vacancies list */}
                <div className="space-y-4 mb-10">
                    {VACANCIES.map(vac => {
                        const isOpen    = openId === vac.id;
                        const isApplying = applyId === vac.id;
                        const title     = language === 'ru' ? vac.title.ru       : vac.title.uz;
                        const salary    = language === 'ru' ? vac.salary.ru      : vac.salary.uz;
                        const exp       = language === 'ru' ? vac.experience.ru  : vac.experience.uz;
                        const sched     = language === 'ru' ? vac.schedule.ru    : vac.schedule.uz;
                        const desc      = language === 'ru' ? vac.description.ru : vac.description.uz;
                        const reqs      = language === 'ru' ? vac.requirements.ru: vac.requirements.uz;
                        const conds     = language === 'ru' ? vac.conditions.ru  : vac.conditions.uz;

                        return (
                            <div key={vac.id} className={`bg-white rounded-2xl border overflow-hidden ${vac.color}`}>
                                {/* Header — clickable */}
                                <button
                                    className="w-full text-left p-6 flex items-start gap-4 hover:bg-white/60 transition-colors"
                                    onClick={() => toggle(vac.id)}
                                >
                                    <div className="text-3xl shrink-0">{vac.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3 flex-wrap">
                                            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${vac.badge}`}>
                                                {t("Faol", "Активна")}
                                            </span>
                                        </div>

                                        {/* Meta */}
                                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2">
                                            <span className="flex items-center gap-1.5 text-sm text-gray-600">
                                                <Banknote size={14} className="text-emerald-500" />
                                                {salary}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-sm text-gray-600">
                                                <Briefcase size={14} className="text-blue-500" />
                                                {exp}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-sm text-gray-600">
                                                <Clock size={14} className="text-purple-500" />
                                                {sched}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-sm text-gray-600">
                                                <MapPin size={14} className="text-red-400" />
                                                {vac.location}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                                <Calendar size={12} />
                                                {t("Chop etilgan", "Опубликована")} {vac.published}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronDown
                                        size={18}
                                        className={`text-gray-400 shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {/* Expanded details */}
                                {isOpen && (
                                    <div className="border-t border-gray-100 bg-white px-6 py-5 space-y-5">
                                        {/* Description */}
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-700 mb-2">
                                                {t("Vazifalar", "Обязанности")}
                                            </h3>
                                            <ul className="space-y-1.5">
                                                {desc.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                                        <span className="text-blue-400 font-bold shrink-0 mt-0.5">•</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Requirements */}
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-700 mb-2">
                                                {t("Talablar", "Требования")}
                                            </h3>
                                            <ul className="space-y-1.5">
                                                {reqs.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                                        <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Conditions */}
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-700 mb-2">
                                                {t("Biz taklif qilamiz", "Мы предлагаем")}
                                            </h3>
                                            <ul className="space-y-1.5">
                                                {conds.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                                        <span className="text-purple-400 font-bold shrink-0 mt-0.5">★</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Apply button */}
                                        <button
                                            onClick={() => setApplyId(isApplying ? null : vac.id)}
                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5 text-sm"
                                        >
                                            <Send size={15} />
                                            {t("Ariza topshirish", "Откликнуться")}
                                        </button>

                                        {/* Apply form */}
                                        {isApplying && (
                                            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 mt-2">
                                                <h4 className="font-bold text-gray-900 text-sm mb-4">
                                                    {t(`«${title}» vakansiyasiga ariza`, `Заявка на вакансию «${title}»`)}
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {[
                                                        { id: 'name',  icon: User,  type: 'text', label: t("Ism Familiya", "Имя Фамилия"), key: 'name' as const },
                                                        { id: 'phone', icon: Phone, type: 'tel',  label: t("Telefon", "Телефон"),      key: 'phone' as const },
                                                        { id: 'email', icon: Mail,  type: 'email',label: "Email",                        key: 'email' as const },
                                                    ].map(({ id, icon: Icon, type, label, key }) => (
                                                        <div key={id} className="relative">
                                                            <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                            <input
                                                                id={id}
                                                                type={type}
                                                                placeholder={label}
                                                                value={form[key]}
                                                                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                                                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                                            />
                                                        </div>
                                                    ))}
                                                    <div className="sm:col-span-2 relative">
                                                        <textarea
                                                            rows={3}
                                                            placeholder={t("Qo'shimcha ma'lumot (ixtiyoriy)", "Дополнительная информация (необязательно)")}
                                                            value={form.message}
                                                            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 mt-3 justify-end">
                                                    <button
                                                        onClick={() => setApplyId(null)}
                                                        className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-white"
                                                    >
                                                        {t("Bekor qilish", "Отмена")}
                                                    </button>
                                                    <button
                                                        onClick={() => { setApplyId(null); setForm({ name:'', phone:'', email:'', message:'' }); }}
                                                        className="px-5 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                                                    >
                                                        {t("Yuborish", "Отправить")}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Bottom CTA */}
                <div className="bg-gradient-to-br from-brand-navy to-[#163860] rounded-2xl p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                        <h3 className="text-xl font-bold mb-2">
                            {t("Sizga mos vakansiya topilmadimi?", "Не нашли подходящую вакансию?")}
                        </h3>
                        <p className="text-blue-200/80 text-sm">
                            {t(
                                "CV ni sales@pack24.uz manziliga yuboring — biz siz bilan bog'lanamiz.",
                                "Отправьте резюме на sales@pack24.uz — мы с вами свяжемся."
                            )}
                        </p>
                    </div>
                    <a
                        href="mailto:sales@pack24.uz"
                        className="shrink-0 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5 text-sm"
                    >
                        <Send size={15} />
                        {t("CV yuborish", "Отправить резюме")}
                    </a>
                </div>
            </div>
        </div>
    );
}
