// ─── Product Translations Module — Barrel Export ─────────────────────────────
import type { Language } from '../translations';
import { CATEGORY_NAMES } from './categories';
import { PRODUCT_UI, TERM_MAP, SPEC_KEY_MAP, RU_TERM_MAP } from './terms';

export type ProductSpecEntry = { key: string; value: string };

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasCyrillic(text: string): boolean {
    return /[\u0400-\u04FF]/.test(text);
}

function applyTermReplacements(
    text: string,
    termMap: Record<string, Partial<Record<Language, string>>>,
    lang: Language,
): string {
    let translated = text;
    const entries = Object.entries(termMap).sort((a, b) => b[0].length - a[0].length);

    for (const [sourceTerm, translations] of entries) {
        const langTerm = translations[lang] ?? translations.ru ?? translations.en;
        if (!langTerm) continue;
        const pattern = new RegExp(
            `(?<![\\p{L}])${escapeRegExp(sourceTerm)}(?![\\p{L}])`,
            'giu',
        );
        translated = translated.replace(pattern, langTerm);
    }

    return translated;
}

function lookupLocalizedMap(
    map: Record<string, Partial<Record<Language, string>>>,
    rawKey: string,
    lang: Language,
): string | undefined {
    const normalized = rawKey.trim().toLowerCase();
    const direct = map[normalized]?.[lang] ?? map[normalized]?.ru ?? map[normalized]?.en;
    if (direct) return direct;

    for (const [key, translations] of Object.entries(map)) {
        if (key === normalized || rawKey.trim().toLowerCase() === key) {
            return translations[lang] ?? translations.ru ?? translations.en;
        }
    }
    return undefined;
}

/** Umumiy matn tarjimasi — nom, tavsif, qiymatlar uchun */
export function translateProductText(text: string, lang: Language): string {
    if (!text?.trim()) return text;

    if (lang === 'uz') {
        if (hasCyrillic(text)) {
            return applyTermReplacements(text, RU_TERM_MAP, 'uz');
        }
        return text;
    }

    if (hasCyrillic(text) && lang === 'ru') {
        return text;
    }

    return applyTermReplacements(text, TERM_MAP, lang);
}

// ── Kategotiya tarjimasi ─────────────────────────────────────────────────────
export function translateCategory(categorySlugOrName: string, lang: Language): string {
    const slug = categorySlugOrName.toLowerCase().replace(/\s+/g, '-');
    const entry = CATEGORY_NAMES[slug];
    if (entry) return entry[lang] ?? entry.uz ?? categorySlugOrName;

    for (const [, names] of Object.entries(CATEGORY_NAMES)) {
        for (const val of Object.values(names)) {
            if (val.toLowerCase() === categorySlugOrName.toLowerCase()) {
                return names[lang] ?? names.uz ?? categorySlugOrName;
            }
        }
    }
    return categorySlugOrName;
}

// ── Mahsulot nomi tarjimasi ──────────────────────────────────────────────────
export function translateProductName(name: string, lang: Language): string {
    return translateProductText(name, lang);
}

export function translateProductDescription(description: string | undefined | null, lang: Language): string {
    if (!description) return '';
    return translateProductText(description, lang);
}

export function translateSpecKey(key: string, lang: Language): string {
    if (!key?.trim()) return key;
    return lookupLocalizedMap(SPEC_KEY_MAP, key, lang) ?? translateProductText(key, lang);
}

export function translateSpecValue(value: string, lang: Language): string {
    return translateProductText(value, lang);
}

export function normalizeProductSpecifications(
    specs: Record<string, string> | ProductSpecEntry[] | undefined | null,
): ProductSpecEntry[] {
    if (!specs) return [];
    if (Array.isArray(specs)) {
        return specs
            .map((item) => ({
                key: String(item.key ?? ''),
                value: String(item.value ?? ''),
            }))
            .filter((item) => item.key);
    }
    return Object.entries(specs).map(([key, value]) => ({
        key,
        value: String(value),
    }));
}

export function translateSpecifications(
    specs: Record<string, string> | ProductSpecEntry[] | undefined | null,
    lang: Language,
): ProductSpecEntry[] {
    return normalizeProductSpecifications(specs).map(({ key, value }) => ({
        key: translateSpecKey(key, lang),
        value: translateSpecValue(value, lang),
    }));
}

// ── UI matn tarjimasi ────────────────────────────────────────────────────────
export function getProductUI(key: keyof typeof PRODUCT_UI, lang: Language): string {
    return PRODUCT_UI[key]?.[lang] ?? PRODUCT_UI[key]?.uz ?? key;
}

// ── Re-exportlar ─────────────────────────────────────────────────────────────
export { CATEGORY_NAMES } from './categories';
export { PRODUCT_UI, TERM_MAP, SPEC_KEY_MAP, RU_TERM_MAP } from './terms';
