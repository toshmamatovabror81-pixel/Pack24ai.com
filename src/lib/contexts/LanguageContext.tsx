"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language, materialTranslations, LANGUAGE_NAMES } from '../translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
    tm: (key: string) => string;
    languageNames: typeof LANGUAGE_NAMES;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'pack24_lang';
const SUPPORTED: Language[] = ['uz', 'ru', 'en', 'qr', 'zh', 'tr', 'tg', 'kk', 'tk', 'fa'];

/** Brauzer tilini Pack24 tillariga moslashtirish */
function detectBrowserLang(): Language {
    if (typeof window === 'undefined') return 'uz';
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && SUPPORTED.includes(stored)) return stored;
    const nav = navigator.language?.slice(0, 2).toLowerCase();
    const map: Record<string, Language> = {
        uz: 'uz', ru: 'ru', en: 'en', zh: 'zh',
        tr: 'tr', kk: 'kk', tg: 'tg', tk: 'tk', fa: 'fa',
    };
    return map[nav] ?? 'uz';
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [language, setLangState] = useState<Language>('uz');

    // Hydration uchun — client mount'da til aniqlanadi
    useEffect(() => {
        setLangState(detectBrowserLang());
    }, []);

    const setLanguage = (lang: Language) => {
        setLangState(lang);
        localStorage.setItem(STORAGE_KEY, lang);
        // RTL til uchun document dir o'zgartirish (Fors/Dari tili)
        document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
    };

    const t = (key: string): string => translations[language]?.[key] ?? key;
    const tm = (key: string): string => materialTranslations[language]?.[key] ?? key;

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, tm, languageNames: LANGUAGE_NAMES }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};
