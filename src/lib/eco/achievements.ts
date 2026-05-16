/**
 * Ekologik yutuqlar (Achievement Badges) tizimi — Litterati uslubida
 * Jami 12 ta badge — avtomatik tekshiriladi va beriladi
 */
import { prisma } from '@/lib/prisma';

export type BadgeKey =
    | 'first_step'       // Birinchi ariza
    | '10kg_club'        // 10 kg topshirdi
    | '50kg_hero'        // 50 kg topshirdi
    | '100kg_warrior'    // 100 kg topshirdi
    | 'streak_7'         // 7 kun ketma-ket
    | 'streak_30'        // 30 kun ketma-ket
    | 'multi_material'   // 3 xil material
    | 'referral_first'   // Birinchi referral
    | 'tree_saver'       // 10 ta daraxt
    | 'co2_warrior'      // 100 kg CO₂
    | 'early_bird'       // Saharda ariza (06:00-09:00)
    | 'eco_legend';      // Legend darajasi

export interface BadgeDefinition {
    key: BadgeKey;
    nameUz: string;
    nameRu: string;
    emoji: string;
    color: string;
    descriptionUz: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
    { key: 'first_step',     nameUz: 'Birinchi qadam',   nameRu: 'Первый шаг',     emoji: '🎯', color: '#3B82F6', descriptionUz: 'Birinchi ariza yuborildi!' },
    { key: '10kg_club',      nameUz: '10kg Klubi',        nameRu: 'Клуб 10кг',      emoji: '💪', color: '#10B981', descriptionUz: 'Jami 10 kg topshirdi' },
    { key: '50kg_hero',      nameUz: 'Eko Qahramon',      nameRu: 'Эко-герой',      emoji: '🦸', color: '#8B5CF6', descriptionUz: 'Jami 50 kg topshirdi' },
    { key: '100kg_warrior',  nameUz: 'Yuz kilogram!',     nameRu: 'Сотник',         emoji: '🏅', color: '#F59E0B', descriptionUz: 'Jami 100 kg topshirdi' },
    { key: 'streak_7',       nameUz: '7 kunlik olov',     nameRu: '7 дней огня',    emoji: '🔥', color: '#F97316', descriptionUz: '7 kun ketma-ket faol' },
    { key: 'streak_30',      nameUz: 'Doimiy qahramon',   nameRu: 'Постоянный',     emoji: '🌋', color: '#EF4444', descriptionUz: '30 kun ketma-ket faol' },
    { key: 'multi_material', nameUz: 'Rang-barang',       nameRu: 'Разнообразие',   emoji: '🎨', color: '#6366F1', descriptionUz: '3 xil material topshirdi' },
    { key: 'referral_first', nameUz: 'Tanituvchi',        nameRu: 'Посол',          emoji: '👥', color: '#14B8A6', descriptionUz: 'Birinchi do\'stni taklif qildi' },
    { key: 'tree_saver',     nameUz: 'Daraxt qo\'riqchisi', nameRu: 'Хранитель лесов', emoji: '🌳', color: '#15803D', descriptionUz: '10 ta daraxt saqlab qoldi' },
    { key: 'co2_warrior',    nameUz: 'CO₂ Jangchi',       nameRu: 'Борец с CO₂',   emoji: '💨', color: '#0EA5E9', descriptionUz: '100 kg CO₂ kamaytirdi' },
    { key: 'early_bird',     nameUz: 'Erta turadigan',    nameRu: 'Ранняя пташка',  emoji: '🐦', color: '#FBBF24', descriptionUz: 'Ertalab ariza yubordi' },
    { key: 'eco_legend',     nameUz: 'Eko Afsona',        nameRu: 'Эко-легенда',    emoji: '⭐', color: '#F59E0B', descriptionUz: 'Afsonaviy darajaga yetdi!' },
];

export function getBadgeInfo(key: BadgeKey): BadgeDefinition | undefined {
    return BADGE_DEFINITIONS.find(b => b.key === key);
}

/**
 * Foydalanuvchi uchun yangi badge tekshirish va berish
 * RecycleRequest completed bo'lganda chaqiriladi
 */
export async function checkAndAwardBadges(userId: number): Promise<BadgeKey[]> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            achievements: true,
            recycleRequests: {
                where: { status: { in: ['collected', 'completed', 'confirmed'] } },
                select: { material: true, volume: true, createdAt: true },
            },
        },
    });

    if (!user) return [];

    const existingBadges = new Set(user.achievements.map(a => a.badgeKey));
    const newBadges: BadgeKey[] = [];

    const totalKg = user.totalRecycledWeight;
    const completedCount = user.recycleRequests.length;
    const materials = new Set(user.recycleRequests.map(r => r.material).filter(Boolean));

    const toAward: BadgeKey[] = [];

    // 🎯 Birinchi qadam
    if (completedCount >= 1 && !existingBadges.has('first_step')) toAward.push('first_step');
    // 💪 10 kg
    if (totalKg >= 10 && !existingBadges.has('10kg_club')) toAward.push('10kg_club');
    // 🦸 50 kg
    if (totalKg >= 50 && !existingBadges.has('50kg_hero')) toAward.push('50kg_hero');
    // 🏅 100 kg
    if (totalKg >= 100 && !existingBadges.has('100kg_warrior')) toAward.push('100kg_warrior');
    // 🎨 3 xil material
    if (materials.size >= 3 && !existingBadges.has('multi_material')) toAward.push('multi_material');
    // 🌳 10 daraxt
    if (user.treesEquivalent >= 10 && !existingBadges.has('tree_saver')) toAward.push('tree_saver');
    // 💨 100 kg CO₂
    if (user.totalCO2Saved >= 100 && !existingBadges.has('co2_warrior')) toAward.push('co2_warrior');
    // ⭐ Legend
    if (user.ecoLevel === 'legend' && !existingBadges.has('eco_legend')) toAward.push('eco_legend');
    // 🔥 Streak — 7 kun
    if (user.ecoStreak >= 7 && !existingBadges.has('streak_7')) toAward.push('streak_7');
    // 🌋 Streak — 30 kun
    if (user.ecoStreak >= 30 && !existingBadges.has('streak_30')) toAward.push('streak_30');
    // 🐦 Early bird — biron ariza 06-09 oralig'ida yaratilganmi
    const hasEarlyBird = user.recycleRequests.some(r => {
        const hour = new Date(r.createdAt).getHours();
        return hour >= 6 && hour < 9;
    });
    if (hasEarlyBird && !existingBadges.has('early_bird')) toAward.push('early_bird');
    // 👥 Referral — kamida bir referral bor
    const referralCount = await prisma.user.count({ where: { referredById: userId } });
    if (referralCount >= 1 && !existingBadges.has('referral_first')) toAward.push('referral_first');

    // Badge'larni saqlash
    if (toAward.length > 0) {
        await prisma.ecoAchievement.createMany({
            data: toAward.map(key => ({ userId, badgeKey: key })),
            skipDuplicates: true,
        });
        newBadges.push(...toAward);
    }

    return newBadges;
}
