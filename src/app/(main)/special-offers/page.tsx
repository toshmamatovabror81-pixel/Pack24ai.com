
'use client';

import { useLanguage } from '@/lib/contexts/LanguageContext';

export default function SpecialOffersPage() {
    const { language } = useLanguage();

    const title: Record<string, string> = { uz: "Maxsus Takliflar", ru: 'Спецпредложения', en: 'Special Offers', qr: 'Arnawlı usınıslar', zh: '特别优惠', tr: 'Özel Teklifler', tg: 'Пешниҳодҳои хосс', kk: 'Арнайы ұсыныс', tk: 'Ýörite teklip', fa: 'پیشنهادات ویژه' };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-8">
                    {title[language as string] || title['en']}
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Banner 1 */}
                    <div className="relative h-64 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-xl overflow-hidden flex items-center px-8">
                        <div className="text-white z-10">
                            <h2 className="text-3xl font-bold mb-2">Startap Paketi</h2>
                            <p className="mb-4 text-purple-100">Logo dizayni + 100 ta quti = Maxsus narx!</p>
                            <button className="bg-white text-purple-600 font-bold py-2 px-4 rounded-full shadow hover:bg-gray-100 transition">
                                Tafsilotlar
                            </button>
                        </div>
                        <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-10 translate-y-10">
                            <div className="text-9xl">🚀</div>
                        </div>
                    </div>

                    {/* Banner 2 */}
                    <div className="relative h-64 bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl shadow-xl overflow-hidden flex items-center px-8">
                        <div className="text-white z-10">
                            <h2 className="text-3xl font-bold mb-2">Bayram Qadoqlari</h2>
                            <p className="mb-4 text-pink-100">Yangi yil va bayramlar uchun eksklyuziv dizaynlar.</p>
                            <button className="bg-white text-pink-500 font-bold py-2 px-4 rounded-full shadow hover:bg-gray-100 transition">
                                Ko&apos;rish
                            </button>
                        </div>
                        <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-10 translate-y-10">
                            <div className="text-9xl">🎁</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
