import { prisma } from '@/lib/prisma';
import { getLevelByWeight, calcEcoPoints } from '@/lib/eco/levels';
import { calcEcoImpact } from '@/lib/eco/co2Calculator';
import { checkAndAwardBadges } from '@/lib/eco/achievements';

export async function processEcoProgress(userId: number, material: string | null, kg: number) {
    if (!userId || !kg || kg <= 0) {
        throw new Error('Yaroqsiz userId yoki kg');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Foydalanuvchi topilmadi');

    const materialName = material || 'Makulatura';

    // Yangi umumiy og'irlik
    const newTotalKg = user.totalRecycledWeight + kg;

    // Daraja hisoblash
    const newLevel = getLevelByWeight(newTotalKg);

    // CO₂ va daraxt hisoblash
    const impact = calcEcoImpact(materialName, kg);
    const newCO2 = Math.round((user.totalCO2Saved + impact.co2SavedKg) * 10) / 10;
    const newTrees = Math.floor(newCO2 / 60); // 1 daraxt ≈ 60 kg CO₂

    // Ball hisoblash (level koeffitsienti bilan)
    const earnedPoints = calcEcoPoints(materialName, kg, newLevel.pointsMultiplier);

    // Streak hisoblash
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastActivity = user.lastEcoActivity ? new Date(user.lastEcoActivity) : null;
    if (lastActivity) lastActivity.setHours(0, 0, 0, 0);

    let newStreak = user.ecoStreak;
    if (!lastActivity) {
        newStreak = 1;
    } else {
        const diffDays = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
            newStreak = user.ecoStreak + 1; // Ketma-ket kun
        } else if (diffDays === 0) {
            newStreak = user.ecoStreak; // Bugun allaqachon hisoblangan
        } else {
            newStreak = 1; // Streak uzildi
        }
    }

    // Foydalanuvchini yangilash
    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            totalRecycledWeight: newTotalKg,
            ecoLevel: newLevel.key,
            ecoPoints: { increment: earnedPoints },
            totalCO2Saved: newCO2,
            treesEquivalent: newTrees,
            ecoStreak: newStreak,
            lastEcoActivity: new Date(),
        },
        select: {
            ecoPoints: true,
            ecoLevel: true,
            totalRecycledWeight: true,
            totalCO2Saved: true,
            treesEquivalent: true,
            ecoStreak: true,
        },
    });

    // Badge tekshirish
    const newBadges = await checkAndAwardBadges(userId);

    return {
        success: true,
        earnedPoints,
        levelUp: user.ecoLevel !== newLevel.key,
        newLevel: newLevel.key,
        newBadges,
        stats: updated,
        impact: {
            co2Saved: impact.co2SavedKg,
            waterSaved: impact.waterSavedL,
            energySaved: impact.energySavedKwh,
        },
    };
}
