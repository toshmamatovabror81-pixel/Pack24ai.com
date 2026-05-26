'use client';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { FlagIcon } from '@/components/FlagIcon';
import { Language, LANGUAGE_NAMES } from '@/lib/translations';
import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const TOP_BAR_DATA = {
    location: {
        uz: 'Toshkent', ru: 'Ташкент', en: 'Tashkent', qr: 'Tashkent',
        zh: '塔什干', tr: 'Taşkent', tg: 'Тошканд', kk: 'Ташкент',
        tk: 'Taşkent', fa: 'تاشکند',
    },
    schedule: {
        uz: 'Har kuni 8 dan 21 gacha', ru: 'Ежедневно с 8 до 21',
        en: 'Daily 8am – 9pm', qr: 'Kúnde 8-den 21-ge',
        zh: '每天 8:00–21:00', tr: 'Her gün 08:00–21:00',
        tg: 'Ҳар рӯз аз 8 то 21', kk: 'Күнде 8-ден 21-ге',
        tk: 'Her gün 8-den 21-e', fa: 'هر روز ۸ تا ۲۱',
    },
    callback: {
        uz: "Menga qo'ng'iroq qiling", ru: 'Перезвоните мне',
        en: 'Call me back', qr: 'Qayta jasaw',
        zh: '回电话给我', tr: 'Beni arayın',
        tg: 'Ба ман занг занед', kk: 'Маған қоңырау шалыңыз',
        tk: 'Maňa jaň ediň', fa: 'با من تماس بگیرید',
    },
    email: 'sales@pack24.uz',
    phone: '+998 88 055-78-88',
} as const;

const CURRENCIES = [
    { code: 'UZS', symbol: "so'm", flag: '🇺🇿' },
    { code: 'USD', symbol: '$',    flag: '🇺🇸' },
    { code: 'RUB', symbol: '₽',   flag: '🇷🇺' },
    { code: 'EUR', symbol: '€',   flag: '🇪🇺' },
] as const;

export default function NavTopBar() {
    const { language, setLanguage } = useLanguage();
    const [langOpen, setLangOpen] = useState(false);
    const [currOpen, setCurrOpen] = useState(false);
    const [currency, setCurrency] = useState('UZS');

    useEffect(() => {
        const saved = localStorage.getItem('pack24_currency');
        if (saved) setCurrency(saved);
    }, []);

    const handleCurrency = (code: string) => {
        setCurrency(code);
        localStorage.setItem('pack24_currency', code);
        setCurrOpen(false);
    };

    const loc = TOP_BAR_DATA.location[language as keyof typeof TOP_BAR_DATA.location] ?? TOP_BAR_DATA.location.ru;
    const sched = TOP_BAR_DATA.schedule[language as keyof typeof TOP_BAR_DATA.schedule] ?? TOP_BAR_DATA.schedule.ru;
    const cb = TOP_BAR_DATA.callback[language as keyof typeof TOP_BAR_DATA.callback] ?? TOP_BAR_DATA.callback.ru;
    const activeCurr = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0];

    return (
        <div className="bg-[#f0f0f0] text-gray-600 text-[13px] py-1.5 border-b border-gray-200">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                {/* Left: location + schedule */}
                <div className="flex items-center space-x-6">
                    <span className="border-b border-dashed border-gray-400 cursor-pointer hover:text-brand-red transition-colors">
                        {loc}
                    </span>
                    <span className="hidden sm:block text-gray-500">{sched}</span>
                </div>

                {/* Right: callback, email, phone, currency, language */}
                <div className="flex items-center space-x-4">
                    <a href="#" className="hidden md:block hover:text-brand-red border-b border-dashed border-gray-400 pb-px transition-colors">
                        {cb}
                    </a>
                    <a href={`mailto:${TOP_BAR_DATA.email}`} className="hidden lg:block hover:text-brand-red text-gray-500">
                        {TOP_BAR_DATA.email}
                    </a>
                    <a href={`tel:${TOP_BAR_DATA.phone}`} className="font-bold text-gray-800 text-[15px] hover:text-brand-red">
                        {TOP_BAR_DATA.phone}
                    </a>

                    {/* Currency Selector */}
                    <div className="relative border-l border-gray-300 pl-3 ml-1">
                        <button
                            onClick={() => { setCurrOpen(!currOpen); setLangOpen(false); }}
                            className="flex items-center gap-1 hover:text-blue-600 text-xs font-semibold"
                            aria-label="Valyutani tanlash"
                        >
                            <span>{activeCurr.flag} {activeCurr.code}</span>
                            <ChevronDown size={10} className={`transition-transform ${currOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {currOpen && (
                            <div className="absolute right-0 top-full mt-1 w-28 bg-white shadow-lg border border-gray-100 z-50 py-1 rounded-lg">
                                {CURRENCIES.map(c => (
                                    <button
                                        key={c.code}
                                        onClick={() => handleCurrency(c.code)}
                                        className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center justify-between text-xs font-medium ${
                                            currency === c.code ? 'text-blue-600' : 'text-gray-700'
                                        }`}
                                    >
                                        <span>{c.flag} {c.code}</span>
                                        <span className="text-gray-400">{c.symbol}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Language Switcher */}
                    <div className="relative border-l border-gray-300 pl-3">
                        <button
                            onClick={() => { setLangOpen(!langOpen); setCurrOpen(false); }}
                            className="flex items-center space-x-1 hover:text-blue-600 text-xs"
                            aria-label="Tilni o'zgartirish"
                        >
                            <FlagIcon lang={language} />
                            <span className="uppercase font-semibold hidden sm:inline">{language}</span>
                            <ChevronDown size={10} className={`transition-transform ${langOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {langOpen && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white shadow-xl border border-gray-100 z-50 py-1 rounded-lg max-h-80 overflow-y-auto">
                                {(Object.keys(LANGUAGE_NAMES) as Language[]).map((ln) => (
                                    <button
                                        key={ln}
                                        onClick={() => { setLanguage(ln); setLangOpen(false); }}
                                        className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2 text-xs ${
                                            language === ln ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-700'
                                        }`}
                                    >
                                        <FlagIcon lang={ln} />
                                        <span>{LANGUAGE_NAMES[ln]}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
