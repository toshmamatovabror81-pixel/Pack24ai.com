import { uz } from './translations/uz';
import { ru } from './translations/ru';
import { en } from './translations/en';
import { qr } from './translations/qr';
import { zh } from './translations/zh';
import { tr } from './translations/tr';
import { tg } from './translations/tg';
import { kk } from './translations/kk';
import { tk } from './translations/tk';
import { fa } from './translations/fa';

export type Language = 'uz' | 'ru' | 'en' | 'qr' | 'zh' | 'tr' | 'tg' | 'kk' | 'tk' | 'fa';

export type TranslationKeys = {
    [key: string]: string;
};

export const LANGUAGE_NAMES: Record<Language, string> = {
    uz: "O'zbek",
    ru: 'Русский',
    en: 'English',
    qr: 'Qaraqalpaq',
    zh: '中文',
    tr: 'Türkçe',
    tg: 'Тоҷикӣ',
    kk: 'Қазақша',
    tk: 'Türkmençe',
    fa: 'دری / پښتو',
};

export const translations: Record<Language, TranslationKeys> = {
    uz, ru, en, qr, zh, tr, tg, kk, tk, fa
};

export const materialTranslations: Record<Language, Record<string, string>> = {
    uz: { 'm-3': '3 qavatli (E/B-Flute)', 'm-5': '5 qavatli (EB-Flute)' },
    ru: { 'm-3': '3-слойный (E/B-Flute)', 'm-5': '5-слойный (EB-Flute)' },
    en: { 'm-3': '3-ply (E/B-Flute)', 'm-5': '5-ply (EB-Flute)' },
    qr: { 'm-3': '3 qabatlı (E/B-Flute)', 'm-5': '5 qabatlı (EB-Flute)' },
    zh: { 'm-3': '3层 (E/B-Flute)', 'm-5': '5层 (EB-Flute)' },
    tr: { 'm-3': '3 katlı (E/B-Flute)', 'm-5': '5 katlı (EB-Flute)' },
    tg: { 'm-3': '3 қабата (E/B-Flute)', 'm-5': '5 қабата (EB-Flute)' },
    kk: { 'm-3': '3 қабатты (E/B-Flute)', 'm-5': '5 қабатты (EB-Flute)' },
    tk: { 'm-3': '3 gatlak (E/B-Flute)', 'm-5': '5 gatlak (EB-Flute)' },
    fa: { 'm-3': '۳ لایه (E/B-Flute)', 'm-5': '۵ لایه (EB-Flute)' },
};
