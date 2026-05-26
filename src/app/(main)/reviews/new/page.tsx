'use client';

import { useLanguage } from '@/lib/contexts/LanguageContext';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, Star, Send, CheckCircle } from 'lucide-react';

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hovered, setHovered] = useState(0);
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
                <button
                    key={s}
                    type="button"
                    onClick={() => onChange(s)}
                    onMouseEnter={() => setHovered(s)}
                    onMouseLeave={() => setHovered(0)}
                    aria-label={`${s} yulduz`}
                    className="focus:outline-none transition-transform hover:scale-110"
                >
                    <Star
                        size={28}
                        className={`transition-colors ${
                            s <= (hovered || value)
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-200 fill-gray-200'
                        }`}
                    />
                </button>
            ))}
        </div>
    );
}

export default function NewReviewPage() {
    const { language } = useLanguage();
    const t = (uz: string, ru: string) => language === 'ru' ? ru : uz;

    const [submitted, setSubmitted] = useState(false);
    const [form, setForm] = useState({
        name: '',
        category: 'store' as 'store' | 'manager',
        rating: 0,
        managerRating: 0,
        warehouseRating: 0,
        siteRating: 0,
        text: '',
        recommends: true,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.name.trim()) e.name = t("Ism kiritish shart", "Имя обязательно");
        if (form.rating === 0)  e.rating = t("Reytingni tanlang", "Выберите оценку");
        if (!form.text.trim())  e.text = t("Sharh matni shart", "Текст отзыва обязателен");
        if (form.text.trim().length < 20) e.text = t("Kamida 20 ta belgi kiriting", "Минимум 20 символов");
        return e;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
                <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center max-w-md w-full shadow-sm">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                        <CheckCircle size={36} className="text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
                        {t("Rahmat!", "Спасибо!")}
                    </h1>
                    <p className="text-gray-500 text-sm mb-6">
                        {t(
                            "Sizning sharh moderatsiyadan o'tgandan so'ng e'lon qilinadi.",
                            "Ваш отзыв будет опубликован после проверки модератора."
                        )}
                    </p>
                    <Link
                        href="/reviews"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
                    >
                        {t("Sharhlarga qaytish", "Вернуться к отзывам")}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-page">
            {/* Breadcrumb */}
            <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-4">
                <nav className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-blue-600">{t("Bosh sahifa", "Главная")}</Link>
                    <ChevronRight size={14} />
                    <Link href="/reviews" className="hover:text-blue-600">{t("Sharhlar", "Отзывы")}</Link>
                    <ChevronRight size={14} />
                    <span className="text-gray-900 font-medium">{t("Sharh qoldirish", "Написать отзыв")}</span>
                </nav>
            </div>

            <div className="max-w-[700px] mx-auto px-4 sm:px-6 pb-16">
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">
                    {t("Sharh qoldirish", "Написать отзыв")}
                </h1>
                <p className="text-gray-500 text-sm mb-8">
                    {t("Sizning fikringiz boshqa mijozlarga yordam beradi", "Ваш отзыв поможет другим покупателям")}
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Name */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <label className="block text-sm font-bold text-gray-800 mb-2">
                            {t("Ismingiz", "Ваше имя")} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })); }}
                            placeholder={t("Ism Familiya", "Имя Фамилия")}
                            className={`w-full border ${errors.name ? 'border-red-400' : 'border-gray-200'} rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors`}
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>

                    {/* Category */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <label className="block text-sm font-bold text-gray-800 mb-3">
                            {t("Sharh turi", "Тип отзыва")}
                        </label>
                        <div className="flex gap-3">
                            {([
                                { key: 'store',   uz: "Do'kon haqida",    ru: "О магазине" },
                                { key: 'manager', uz: "Menejer haqida",   ru: "О менеджере" },
                            ] as const).map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, category: opt.key }))}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                                        form.category === opt.key
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                                    }`}
                                >
                                    {language === 'ru' ? opt.ru : opt.uz}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Overall Rating */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <label className="block text-sm font-bold text-gray-800 mb-3">
                            {t("Umumiy baholash", "Общая оценка")} <span className="text-red-500">*</span>
                        </label>
                        <StarPicker value={form.rating} onChange={v => { setForm(f => ({ ...f, rating: v })); setErrors(er => ({ ...er, rating: '' })); }} />
                        {errors.rating && <p className="text-red-500 text-xs mt-2">{errors.rating}</p>}

                        {/* Sub-ratings */}
                        <div className="mt-5 space-y-4 pt-4 border-t border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                {t("Batafsil baholash", "Детальная оценка")}
                            </p>
                            {[
                                { key: 'managerRating',   uz: "Menejer ishi",   ru: "Работа менеджера" },
                                { key: 'warehouseRating', uz: "Ombor ishi",     ru: "Работа склада" },
                                { key: 'siteRating',      uz: "Sayt qulayligi", ru: "Удобство сайта" },
                            ].map(item => (
                                <div key={item.key} className="flex items-center justify-between gap-4">
                                    <span className="text-sm text-gray-600 w-36 shrink-0">
                                        {language === 'ru' ? item.ru : item.uz}
                                    </span>
                                    <StarPicker
                                        value={form[item.key as keyof typeof form] as number}
                                        onChange={v => setForm(f => ({ ...f, [item.key]: v }))}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Text */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <label className="block text-sm font-bold text-gray-800 mb-2">
                            {t("Sharh matni", "Текст отзыва")} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            rows={5}
                            value={form.text}
                            onChange={e => { setForm(f => ({ ...f, text: e.target.value })); setErrors(er => ({ ...er, text: '' })); }}
                            placeholder={t(
                                "Xizmat haqida fikringizni yozing (kamida 20 ta belgi)...",
                                "Напишите ваше мнение об услуге (минимум 20 символов)..."
                            )}
                            className={`w-full border ${errors.text ? 'border-red-400' : 'border-gray-200'} rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors resize-none`}
                        />
                        <div className="flex justify-between items-center mt-1">
                            {errors.text
                                ? <p className="text-red-500 text-xs">{errors.text}</p>
                                : <span />
                            }
                            <span className="text-xs text-gray-400">{form.text.length}/500</span>
                        </div>
                    </div>

                    {/* Recommends */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div
                                onClick={() => setForm(f => ({ ...f, recommends: !f.recommends }))}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                                    form.recommends ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                                }`}
                            >
                                {form.recommends && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                                {t("Pack24'ni do'stlarimga tavsiya qilaman", "Рекомендую Pack24 своим друзьям")}
                            </span>
                        </label>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3">
                        <Link
                            href="/reviews"
                            className="flex-1 text-center py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:border-gray-400 transition-colors"
                        >
                            {t("Bekor qilish", "Отмена")}
                        </Link>
                        <button
                            type="submit"
                            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-blue-500/20"
                        >
                            <Send size={15} />
                            {t("Sharh yuborish", "Отправить отзыв")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
