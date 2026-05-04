import type { Lang } from '../../i18n';

// ─── Material narxlari (so'm/kg) ─────────────────────────────────────────────
export const MAT: Record<string, { label: Record<Lang, string>; emoji: string; price: number }> = {
    qogoz:   { label: { uz: "Qog'oz (rangsiz)", ru: 'Бумага (белая)', en: 'Paper (white)' }, emoji: '📄', price: 600 },
    karton:  { label: { uz: 'Karton', ru: 'Картон', en: 'Cardboard' }, emoji: '📦', price: 700 },
    plastik: { label: { uz: 'Plastik', ru: 'Пластик', en: 'Plastic' }, emoji: '🧴', price: 1000 },
    temir:   { label: { uz: 'Temir/Metallar', ru: 'Металлы', en: 'Metals' }, emoji: '🔩', price: 2000 },
    shisha:  { label: { uz: 'Shisha', ru: 'Стекло', en: 'Glass' }, emoji: '🫙', price: 300 },
    gazeta:  { label: { uz: 'Gazeta', ru: 'Газета', en: 'Newspaper' }, emoji: '📰', price: 400 },
    mix:     { label: { uz: 'Aralash', ru: 'Смешанное', en: 'Mixed' }, emoji: '🗑️', price: 500 },
};

// ─── Session types ────────────────────────────────────────────────────────────
export interface CustomerSession {
    step: 'lang' | 'reg_phone' | 'reg_otp' | 'reg_name' | 'menu' | 'location' | 'choose_method' | 'volume' | 'photo' | 'done';
    lang: Lang;
    name?: string;
    phone?: string;
    otpCode?: string;
    otpExpiry?: number;
    otpAttempts?: number;
    lat?: number;
    lng?: number;
    pickupType?: 'base' | 'pickup';
    volumeSize?: string;
}

export const fmtN = (n: number) => n.toLocaleString('ru-RU');
