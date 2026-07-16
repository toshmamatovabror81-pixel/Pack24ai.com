'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, Sparkles, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { toast } from 'sonner';

const T: Record<string, Record<string, string>> = {
    title:      { uz: 'Bepul maket buyurtma qilish', ru: 'Заказать бесплатный макет', en: 'Order a free mockup' },
    subtitle:   { uz: "Pack24 mutaxassislari Pacdora AI yordamida qadoqlashingiz uchun professional 3D maket va dieline'ni BEPUL tayyorlab beradi", ru: 'Специалисты Pack24 бесплатно подготовят профессиональный 3D-макет и развёртку вашей упаковки с помощью Pacdora AI', en: 'Pack24 specialists will prepare a professional 3D mockup and dieline for your packaging for FREE using Pacdora AI' },
    free:       { uz: '✦ Pack24 mijozlari uchun 100% bepul', ru: '✦ 100% бесплатно для клиентов Pack24', en: '✦ 100% free for Pack24 customers' },
    name:       { uz: 'Ismingiz', ru: 'Ваше имя', en: 'Your name' },
    phone:      { uz: 'Telefon raqam', ru: 'Номер телефона', en: 'Phone number' },
    ptype:      { uz: 'Qadoqlash turi', ru: 'Тип упаковки', en: 'Packaging type' },
    ptypePh:    { uz: 'Tanlang...', ru: 'Выберите...', en: 'Select...' },
    dims:       { uz: "O'lchamlar (mm)", ru: 'Размеры (мм)', en: 'Dimensions (mm)' },
    dimsPh:     { uz: 'Masalan: 300×200×150', ru: 'Например: 300×200×150', en: 'E.g.: 300×200×150' },
    qty:        { uz: 'Taxminiy miqdor (dona)', ru: 'Примерное количество (шт)', en: 'Approximate quantity (pcs)' },
    msg:        { uz: 'Qo\'shimcha izoh (logo, rang, dizayn istaklari)', ru: 'Дополнительный комментарий (лого, цвет, пожелания)', en: 'Additional notes (logo, colors, design wishes)' },
    msgPh:      { uz: 'Dizayn haqidagi istaklaringizni yozing. Logo va rasmlarni keyinroq Telegram orqali yuborishingiz mumkin.', ru: 'Опишите пожелания к дизайну. Лого и изображения можно отправить позже через Telegram.', en: 'Describe your design wishes. Logo and images can be sent later via Telegram.' },
    send:       { uz: "So'rov yuborish", ru: 'Отправить заявку', en: 'Submit request' },
    sending:    { uz: 'Yuborilmoqda...', ru: 'Отправка...', en: 'Sending...' },
    error:      { uz: "Xatolik yuz berdi. Qayta urinib ko'ring.", ru: 'Произошла ошибка. Попробуйте ещё раз.', en: 'An error occurred. Please try again.' },
    successTitle: { uz: "So'rovingiz qabul qilindi!", ru: 'Заявка принята!', en: 'Request received!' },
    successMsg: { uz: "Mutaxassislarimiz tez orada siz bilan bog'lanadi va maketingizni tayyorlashni boshlaydi.", ru: 'Наши специалисты скоро свяжутся с вами и приступят к подготовке макета.', en: 'Our specialists will contact you soon and start preparing your mockup.' },
    backHome:   { uz: 'Bosh sahifaga qaytish', ru: 'Вернуться на главную', en: 'Back to home' },
    step1:      { uz: "So'rov yuborasiz", ru: 'Отправляете заявку', en: 'Submit a request' },
    step2:      { uz: 'Mutaxassis maket tayyorlaydi', ru: 'Специалист готовит макет', en: 'Specialist prepares the mockup' },
    step3:      { uz: '3D maket + dieline olasiz', ru: 'Получаете 3D-макет + развёртку', en: 'Receive 3D mockup + dieline' },
};
const t = (key: string, lang: string) => T[key]?.[lang] || T[key]?.uz || '';

const PACKAGING_TYPES: Record<string, Record<string, string>> = {
    box:      { uz: 'Karton quti', ru: 'Картонная коробка', en: 'Cardboard box' },
    pouch:    { uz: 'Paket / Sumka', ru: 'Пакет / Сумка', en: 'Pouch / Bag' },
    bottle:   { uz: 'Butilka etiketkasi', ru: 'Этикетка бутылки', en: 'Bottle label' },
    can:      { uz: 'Banka / Konteyner', ru: 'Банка / Контейнер', en: 'Can / Container' },
    food:     { uz: 'Oziq-ovqat qadoqlash', ru: 'Пищевая упаковка', en: 'Food packaging' },
    gift:     { uz: "Sovg'a qutisi", ru: 'Подарочная коробка', en: 'Gift box' },
    pizza:    { uz: 'Pizza qutisi', ru: 'Коробка для пиццы', en: 'Pizza box' },
    other:    { uz: 'Boshqa', ru: 'Другое', en: 'Other' },
};

export default function MockupRequestPage() {
    const { language } = useLanguage();
    const [form, setForm] = useState({ name: '', phone: '', packagingType: '', dimensions: '', quantity: '', message: '' });
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.phone.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/mockup-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    packagingType: form.packagingType
                        ? (PACKAGING_TYPES[form.packagingType]?.uz ?? form.packagingType)
                        : '',
                }),
            });
            if (res.ok) {
                setDone(true);
            } else {
                toast.error(t('error', language));
            }
        } catch {
            toast.error(t('error', language));
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center bg-gray-50 px-4">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-10 text-center">
                    <CheckCircle2 size={56} className="mx-auto text-emerald-500 mb-4" />
                    <h1 className="text-2xl font-extrabold text-gray-900 mb-2">{t('successTitle', language)}</h1>
                    <p className="text-gray-500 text-sm mb-8">{t('successMsg', language)}</p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
                    >
                        <ArrowLeft size={16} /> {t('backHome', language)}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-4 py-2 rounded-full mb-5">
                        <Sparkles size={14} /> Pack24 × Pacdora AI
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">{t('title', language)}</h1>
                    <p className="text-gray-500 max-w-xl mx-auto">{t('subtitle', language)}</p>
                    <p className="mt-2 text-sm text-emerald-600 font-semibold">{t('free', language)}</p>
                </div>

                {/* 3 steps */}
                <div className="grid grid-cols-3 gap-3 mb-10">
                    {(['step1', 'step2', 'step3'] as const).map((key, i) => (
                        <div key={key} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                            <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm mb-2">{i + 1}</span>
                            <p className="text-xs font-semibold text-gray-700 leading-snug">{t(key, language)}</p>
                        </div>
                    ))}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-10 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label htmlFor="mr_name" className="block text-sm font-medium text-gray-700 mb-1">{t('name', language)} *</label>
                            <input
                                id="mr_name" type="text" required maxLength={100}
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                            />
                        </div>
                        <div>
                            <label htmlFor="mr_phone" className="block text-sm font-medium text-gray-700 mb-1">{t('phone', language)} *</label>
                            <input
                                id="mr_phone" type="tel" required maxLength={30} placeholder="+998 90 000-00-00"
                                value={form.phone}
                                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div>
                            <label htmlFor="mr_type" className="block text-sm font-medium text-gray-700 mb-1">{t('ptype', language)}</label>
                            <select
                                id="mr_type"
                                value={form.packagingType}
                                onChange={(e) => setForm((f) => ({ ...f, packagingType: e.target.value }))}
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                            >
                                <option value="">{t('ptypePh', language)}</option>
                                {Object.entries(PACKAGING_TYPES).map(([key, labels]) => (
                                    <option key={key} value={key}>{labels[language] ?? labels.uz}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="mr_dims" className="block text-sm font-medium text-gray-700 mb-1">{t('dims', language)}</label>
                            <input
                                id="mr_dims" type="text" maxLength={60} placeholder={t('dimsPh', language)}
                                value={form.dimensions}
                                onChange={(e) => setForm((f) => ({ ...f, dimensions: e.target.value }))}
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                            />
                        </div>
                        <div>
                            <label htmlFor="mr_qty" className="block text-sm font-medium text-gray-700 mb-1">{t('qty', language)}</label>
                            <input
                                id="mr_qty" type="text" inputMode="numeric" maxLength={20} placeholder="1000"
                                value={form.quantity}
                                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="mr_msg" className="block text-sm font-medium text-gray-700 mb-1">{t('msg', language)}</label>
                        <textarea
                            id="mr_msg" rows={4} maxLength={2000} placeholder={t('msgPh', language)}
                            value={form.message}
                            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                            className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all resize-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        <Package size={16} />
                        {loading ? t('sending', language) : t('send', language)}
                    </button>
                </form>
            </div>
        </div>
    );
}
