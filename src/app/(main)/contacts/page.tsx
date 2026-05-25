
'use client';

import { useLanguage } from '@/lib/contexts/LanguageContext';

export default function ContactsPage() {
    const { language } = useLanguage();

    const title = { uz: "Kontaktlar", ru: 'Контакты', en: 'Contacts', qr: 'Kontaktlar', zh: '联系方式', tr: 'İletişim', tg: 'Тамос', kk: 'Байланыс', tk: 'Habarlaşmak', fa: 'تماس با ما' };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-12 text-center">
                    {title[language] || title['en']}
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Contact Info */}
                    <div className="bg-white p-8 rounded-lg shadow-lg">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">
                            {language === 'uz' ? "Biz bilan bog'laning" : language === 'ru' ? "Свяжитесь с нами" : "Get in touch"}
                        </h3>

                        <div className="space-y-6">
                            <div className="flex items-start">
                                <div className="text-2xl mr-4">📍</div>
                                <div>
                                    <h4 className="font-medium text-gray-900">Manzil (Address)</h4>
                                    <p className="text-gray-500">Toshkent sh., Chilonzor tumani, Bunyodkor ko&apos;chasi, 42</p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="text-2xl mr-4">📞</div>
                                <div>
                                    <h4 className="font-medium text-gray-900">Telefon (Phone)</h4>
                                    <a href="tel:+998880557888" className="text-gray-500 hover:text-red-600 transition-colors block">+998 88 055-78-88</a>
                                    <a href="tel:+998951050052" className="text-gray-500 hover:text-red-600 transition-colors block">+998 95 105-00-52</a>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="text-2xl mr-4">📧</div>
                                <div>
                                    <h4 className="font-medium text-gray-900">Email</h4>
                                    <p className="text-gray-500">info@pack24.uz</p>
                                    <p className="text-gray-500">sales@pack24.uz</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <h4 className="font-medium text-gray-900 mb-4">Ijtimoiy Tarmoqlar</h4>
                            <div className="flex space-x-4">
                                <a href="#" className="text-gray-400 hover:text-blue-500 text-2xl">telegram</a>
                                <a href="#" className="text-gray-400 hover:text-pink-600 text-2xl">instagram</a>
                                <a href="#" className="text-gray-400 hover:text-blue-700 text-2xl">facebook</a>
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="bg-white p-8 rounded-lg shadow-lg">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">
                            {language === 'uz' ? "Xabar yuborish" : language === 'ru' ? "Отправить сообщение" : "Send Message"}
                        </h3>
                        <form className="space-y-6">
                            <div>
                                <label htmlFor="c_name" className="block text-sm font-medium text-gray-700">Ism (Name)</label>
                                <input type="text" id="c_name" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 border p-3" />
                            </div>
                            <div>
                                <label htmlFor="c_email" className="block text-sm font-medium text-gray-700">Email</label>
                                <input type="email" id="c_email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 border p-3" />
                            </div>
                            <div>
                                <label htmlFor="c_msg" className="block text-sm font-medium text-gray-700">Xabar (Message)</label>
                                <textarea id="c_msg" rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 border p-3"></textarea>
                            </div>
                            <button type="button" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500">
                                {language === 'uz' ? "Yuborish" : language === 'ru' ? "Отправить" : "Send"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
