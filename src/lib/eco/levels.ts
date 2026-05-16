/**
 * Eco Level (Daraja) tizimi — Alipay Ant Forest uslubida
 * 7 ta daraja: seed → sprout → sapling → tree → forest → guardian → legend
 */

export type EcoLevelKey = 'seed' | 'sprout' | 'sapling' | 'tree' | 'forest' | 'guardian' | 'legend';

export interface EcoLevel {
    key: EcoLevelKey;
    nameUz: string;
    nameRu: string;
    emoji: string;
    color: string;
    minKg: number;       // Bu darajaga kirish uchun minimal kg
    maxKg: number | null; // Keyingi darajaga o'tish chegarasi (null = max)
    pointsMultiplier: number; // Ball koeffitsienti
    description: string;
}

export const ECO_LEVELS: EcoLevel[] = [
    {
        key: 'seed',
        nameUz: 'Urug\'',
        nameRu: 'Семя',
        emoji: '🌱',
        color: '#4ADE80',
        minKg: 0,
        maxKg: 10,
        pointsMultiplier: 1.0,
        description: 'Ekologik yo\'lingiz boshlanmoqda!',
    },
    {
        key: 'sprout',
        nameUz: 'Kurtakcha',
        nameRu: 'Росток',
        emoji: '🌿',
        color: '#22C55E',
        minKg: 10,
        maxKg: 50,
        pointsMultiplier: 1.2,
        description: 'Siz o\'sib bormoqdasiz! Davom eting.',
    },
    {
        key: 'sapling',
        nameUz: 'Ko\'chat',
        nameRu: 'Саженец',
        emoji: '🪴',
        color: '#16A34A',
        minKg: 50,
        maxKg: 150,
        pointsMultiplier: 1.5,
        description: 'Sizning hissangiz ko\'rinmoqda!',
    },
    {
        key: 'tree',
        nameUz: 'Daraxt',
        nameRu: 'Дерево',
        emoji: '🌳',
        color: '#15803D',
        minKg: 150,
        maxKg: 500,
        pointsMultiplier: 1.8,
        description: 'Siz haqiqiy ekologik qahramon!',
    },
    {
        key: 'forest',
        nameUz: 'O\'rmon',
        nameRu: 'Лес',
        emoji: '🌲',
        color: '#166534',
        minKg: 500,
        maxKg: 1500,
        pointsMultiplier: 2.0,
        description: 'Sizning o\'rmoningiz o\'sib bormoqda!',
    },
    {
        key: 'guardian',
        nameUz: 'Qo\'riqchi',
        nameRu: 'Страж',
        emoji: '🛡️',
        color: '#14532D',
        minKg: 1500,
        maxKg: 5000,
        pointsMultiplier: 2.5,
        description: 'Siz tabiatning haqiqiy qo\'riqchisisiz!',
    },
    {
        key: 'legend',
        nameUz: 'Afsonaviy',
        nameRu: 'Легенда',
        emoji: '⭐',
        color: '#FBBF24',
        minKg: 5000,
        maxKg: null,
        pointsMultiplier: 3.0,
        description: 'Siz ekologik afsonaga aylandingiz!',
    },
];

/** Topshirilgan kg bo'yicha darajani aniqlash */
export function getLevelByWeight(totalKg: number): EcoLevel {
    for (let i = ECO_LEVELS.length - 1; i >= 0; i--) {
        if (totalKg >= ECO_LEVELS[i].minKg) {
            return ECO_LEVELS[i];
        }
    }
    return ECO_LEVELS[0];
}

/** Keyingi darajagacha qolgan kg */
export function kgToNextLevel(totalKg: number): number | null {
    const current = getLevelByWeight(totalKg);
    if (current.maxKg === null) return null; // allaqachon max daraja
    return current.maxKg - totalKg;
}

/** Daraja ichida progress (0-100%) */
export function levelProgress(totalKg: number): number {
    const current = getLevelByWeight(totalKg);
    if (current.maxKg === null) return 100;
    const range = current.maxKg - current.minKg;
    const done = totalKg - current.minKg;
    return Math.min(100, Math.round((done / range) * 100));
}

/** Material koeffitsientlari (ecoPoints/kg) */
export const MATERIAL_POINTS: Record<string, number> = {
    'Makulatura': 8,
    'Karton': 6,
    'Plastik': 12,
    'Shisha': 5,
    'Metall': 15,
    'default': 8,
};

/** Ball hisoblash */
export function calcEcoPoints(material: string, kg: number, levelMultiplier = 1.0): number {
    const base = MATERIAL_POINTS[material] ?? MATERIAL_POINTS['default'];
    return Math.round(base * kg * levelMultiplier);
}
