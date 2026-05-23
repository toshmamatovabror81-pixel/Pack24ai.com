/**
 * Pack24 — Kanonik tarif katalogi (Driver / Customer / Bot uchun bitta source of truth)
 *
 * Yandex Pro uslubida haydovchilar tarif (material turi) ni yoqishadi -
 * shu yoqilgan tariflar bo'yicha ariza filterlanadi.
 *
 * `Driver.acceptedMaterials String[]` shu yerdagi ID larni saqlaydi.
 * Eski RecycleRequest.material qiymatlari `LEGACY_MATERIAL_TO_TARIFF` orqali yangi
 * tariflarga maplanadi (backward compat).
 */

export type TariffId =
    | 'maklatura'
    | 'sellofan'
    | 'bakalashka'
    | 'aluminiy'
    | 'shisha'
    | 'qurilish';

export interface Tariff {
    id: TariffId;
    label: { uz: string; ru: string; en: string };
    emoji: string;
    icon: string;
    description: { uz: string; ru: string };
    pricePerKg: number;
    legacyAliases: string[];
}

export const TARIFFS: Tariff[] = [
    {
        id: 'maklatura',
        label: { uz: 'Maklatura', ru: 'Макулатура', en: 'Paper waste' },
        emoji: '📄',
        icon: 'document-text',
        description: { uz: "Qog'oz, karton, gazeta, kitob", ru: 'Бумага, картон, газета, книги' },
        pricePerKg: 700,
        legacyAliases: ['qogoz', "qog'oz", 'qog`oz', 'karton', 'gazeta', 'jurnal', 'ofis', 'kitob', 'mix', 'Makulatura', 'Karton'],
    },
    {
        id: 'sellofan',
        label: { uz: 'Sellofan plyonka', ru: 'Целлофановая плёнка', en: 'Cellophane film' },
        emoji: '🛍️',
        icon: 'cube-outline',
        description: { uz: 'Sellofan plyonka, paketlar', ru: 'Целлофан, плёнки, пакеты' },
        pricePerKg: 800,
        legacyAliases: ['sellofan', 'plyonka', 'plenka', 'paket'],
    },
    {
        id: 'bakalashka',
        label: { uz: 'Bakalashka (PET)', ru: 'Бакалашка (ПЭТ)', en: 'PET bottles' },
        emoji: '🧴',
        icon: 'flask',
        description: { uz: 'Plastik shisha (PET), idishlar', ru: 'Пластиковые бутылки (ПЭТ)' },
        pricePerKg: 1000,
        legacyAliases: ['plastik', 'pet', 'bakalashka', 'Plastik'],
    },
    {
        id: 'aluminiy',
        label: { uz: 'Aluminiy banka', ru: 'Алюминиевая банка', en: 'Aluminum cans' },
        emoji: '🥫',
        icon: 'beer',
        description: { uz: 'Aluminiy va metall bankalar', ru: 'Алюминиевые и металлические банки' },
        pricePerKg: 2500,
        legacyAliases: ['aluminiy', 'aluminium', 'banka', 'temir', 'metall', 'metal', 'Metall'],
    },
    {
        id: 'shisha',
        label: { uz: 'Shisha', ru: 'Стекло', en: 'Glass' },
        emoji: '🫙',
        icon: 'wine',
        description: { uz: 'Shisha banka, shisha singan idishlar', ru: 'Стеклотара' },
        pricePerKg: 300,
        legacyAliases: ['shisha', 'Shisha', 'steklo', 'glass'],
    },
    {
        id: 'qurilish',
        label: { uz: 'Qurilish chiqindilari', ru: 'Строительные отходы', en: 'Construction waste' },
        emoji: '🧱',
        icon: 'hammer',
        description: { uz: "G'isht, beton, sement, qurilish chiqindilari", ru: 'Кирпич, бетон, цемент' },
        pricePerKg: 200,
        legacyAliases: ['qurilish', 'beton', 'gisht', 'sement', 'construction'],
    },
];

export const TARIFF_IDS: TariffId[] = TARIFFS.map(t => t.id);

const TARIFF_BY_ID = new Map<string, Tariff>(TARIFFS.map(t => [t.id, t]));

export function getTariff(id: string): Tariff | undefined {
    return TARIFF_BY_ID.get(id);
}

export function isValidTariffId(id: string): id is TariffId {
    return TARIFF_BY_ID.has(id);
}

/**
 * Eski `material` qiymatini yangi TariffId ga aylantiradi.
 * Topilmagan bo'lsa - null.
 */
export function mapLegacyMaterial(material: string | null | undefined): TariffId | null {
    if (!material) return null;
    const m = material.trim().toLowerCase();
    if (!m) return null;
    if (isValidTariffId(m)) return m;
    for (const t of TARIFFS) {
        if (t.legacyAliases.some(a => a.toLowerCase() === m)) return t.id;
    }
    return null;
}

/**
 * Berilgan tariflar uchun barcha legacy alias-larni qaytaradi.
 * `prisma.recycleRequest.findMany` da `material: { in: [...] }` filtri uchun ishlatiladi.
 */
export function aliasesForTariffs(ids: string[]): string[] {
    const out = new Set<string>();
    for (const id of ids) {
        const t = TARIFF_BY_ID.get(id);
        if (!t) continue;
        out.add(t.id);
        t.legacyAliases.forEach(a => out.add(a));
    }
    return Array.from(out);
}

/**
 * Tariflar ro'yxatini tozalaydi: faqat haqiqiy ID lar qoladi, takror olib tashlanadi.
 */
export function sanitizeTariffIds(ids: unknown): TariffId[] {
    if (!Array.isArray(ids)) return [];
    const out = new Set<TariffId>();
    for (const raw of ids) {
        if (typeof raw !== 'string') continue;
        const v = raw.trim().toLowerCase();
        if (isValidTariffId(v)) out.add(v);
    }
    return Array.from(out);
}
