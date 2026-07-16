
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { toast } from 'sonner';

const T = {
    title:        { uz: 'Kontaktlar', ru: 'Контакты', en: 'Contacts' },
    getInTouch:   { uz: "Biz bilan bog'laning", ru: 'Свяжитесь с нами', en: 'Get in touch' },
    address:      { uz: 'Manzil', ru: 'Адрес', en: 'Address' },
    addressVal:   { uz: "Toshkent sh., Chilonzor tumani, Bunyodkor ko'chasi, 42", ru: 'г. Ташкент, Чиланзарский р-н, ул. Бунёдкор, 42', en: 'Tashkent, Chilanzar district, Bunyodkor str., 42' },
    phone:        { uz: 'Telefon', ru: 'Телефон', en: 'Phone' },
    social:       { uz: 'Ijtimoiy tarmoqlar', ru: 'Социальные сети', en: 'Social media' },
    workHours:    { uz: 'Ish vaqti', ru: 'Часы работы', en: 'Working hours' },
    workHoursVal: { uz: 'Dushanba–Shanba: 9:00–18:00', ru: 'Пн–Сб: 9:00–18:00', en: 'Mon–Sat: 9:00–18:00' },
    sendMsg:      { uz: 'Xabar yuborish', ru: 'Отправить сообщение', en: 'Send a message' },
    name:         { uz: 'Ism', ru: 'Имя', en: 'Name' },
    namePh:       { uz: 'Ismingizni kiriting', ru: 'Введите ваше имя', en: 'Your name' },
    phoneField:   { uz: 'Telefon raqam', ru: 'Номер телефона', en: 'Phone number' },
    phonePh:      { uz: '+998 90 000-00-00', ru: '+998 90 000-00-00', en: '+998 90 000-00-00' },
    message:      { uz: 'Xabar', ru: 'Сообщение', en: 'Message' },
    messagePh:    { uz: 'Xabaringizni yozing...', ru: 'Напишите ваше сообщение...', en: 'Write your message...' },
    send:         { uz: 'Yuborish', ru: 'Отправить', en: 'Send' },
    sending:      { uz: 'Yuborilmoqda...', ru: 'Отправка...', en: 'Sending...' },
    success:      { uz: "Xabaringiz yuborildi! Tez orada siz bilan bog'lanamiz.", ru: 'Сообщение отправлено! Мы свяжемся с вами в ближайшее время.', en: "Your message has been sent! We'll get back to you soon." },
    error:        { uz: "Xatolik yuz berdi. Iltimos qayta urinib ko'ring.", ru: 'Произошла ошибка. Пожалуйста, попробуйте ещё раз.', en: 'An error occurred. Please try again.' },
    calcNote:     { uz: 'Kalkulator natijasi', ru: 'Результат калькулятора', en: 'Calculator result' },
};

const t = (key: keyof typeof T, lang: string): string =>
    T[key]?.[lang as 'uz'] ?? T[key]?.uz ?? '';

function ContactsContent() {
    const { language } = useLanguage();
    const searchParams = useSearchParams();

    const calcL = searchParams.get('l');
    const calcW = searchParams.get('w');
    const calcH = searchParams.get('h');
    const calcPt = searchParams.get('pt');
    const calcQty = searchParams.get('qty');
    const fromCalc = searchParams.get('calc') === '1' && calcL && calcW && calcH;

    const calcMessage = fromCalc
        ? `${t('calcNote', language)}: ${calcL}×${calcW}×${calcH} mm, ${calcPt ?? 'offset'} print${calcQty ? `, ${calcQty} dona` : ''}`
        : '';

    const [form, setForm] = useState({ name: '', phone: '', message: calcMessage });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (calcMessage) setForm((f) => ({ ...f, message: calcMessage }));
    }, [calcMessage]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.phone.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/support/call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.name, phone: form.phone, message: form.message }),
            });
            if (res.ok) {
                toast.success(t('success', language));
                setForm({ name: '', phone: '', message: '' });
            } else {
                toast.error(t('error', language));
            }
        } catch {
            toast.error(t('error', language));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-12 text-center">
                    {t('title', language)}
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Contact Info */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">
                            {t('getInTouch', language)}
                        </h3>

                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="text-2xl shrink-0">📍</div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">{t('address', language)}</h4>
                                    <p className="text-gray-500 text-sm mt-0.5">{t('addressVal', language)}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="text-2xl shrink-0">📞</div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">{t('phone', language)}</h4>
                                    <a href="tel:+998880557888" className="text-gray-500 hover:text-blue-600 transition-colors block text-sm mt-0.5">+998 88 055-78-88</a>
                                    <a href="tel:+998951050052" className="text-gray-500 hover:text-blue-600 transition-colors block text-sm">+998 95 105-00-52</a>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="text-2xl shrink-0">📧</div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">Email</h4>
                                    <a href="mailto:info@pack24.uz" className="text-gray-500 hover:text-blue-600 transition-colors block text-sm mt-0.5">info@pack24.uz</a>
                                    <a href="mailto:sales@pack24.uz" className="text-gray-500 hover:text-blue-600 transition-colors block text-sm">sales@pack24.uz</a>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="text-2xl shrink-0">🕐</div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">{t('workHours', language)}</h4>
                                    <p className="text-gray-500 text-sm mt-0.5">{t('workHoursVal', language)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <h4 className="font-semibold text-gray-900 mb-4">{t('social', language)}</h4>
                            <div className="flex gap-3">
                                <a
                                    href="https://t.me/pack24uz"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-sm font-semibold"
                                >
                                    Telegram
                                </a>
                                <a
                                    href="https://instagram.com/pack24.uz"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors text-sm font-semibold"
                                >
                                    Instagram
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">
                            {t('sendMsg', language)}
                        </h3>

                        {fromCalc && (
                            <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 font-medium">
                                📦 {calcMessage}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="c_name" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('name', language)} *
                                </label>
                                <input
                                    type="text"
                                    id="c_name"
                                    required
                                    placeholder={t('namePh', language)}
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                                />
                            </div>
                            <div>
                                <label htmlFor="c_phone" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('phoneField', language)} *
                                </label>
                                <input
                                    type="tel"
                                    id="c_phone"
                                    required
                                    placeholder={t('phonePh', language)}
                                    value={form.phone}
                                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                                />
                            </div>
                            <div>
                                <label htmlFor="c_msg" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('message', language)}
                                </label>
                                <textarea
                                    id="c_msg"
                                    rows={4}
                                    placeholder={t('messagePh', language)}
                                    value={form.message}
                                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                {loading ? t('sending', language) : t('send', language)}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ContactsPage() {
    return (
        <Suspense>
            <ContactsContent />
        </Suspense>
    );
}
