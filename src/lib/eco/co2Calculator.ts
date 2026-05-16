/**
 * CO₂ va ekologik ta'sir kalkulyatori
 * Ilmiy asosda: har kg qayta ishlangan materialning atrof-muhitga ta'siri
 */

export interface EcoImpact {
    co2SavedKg: number;      // Tejangan CO₂ (kg)
    treesEquivalent: number; // Ekvivalent daraxt soni
    waterSavedL: number;     // Tejangan suv (litr)
    energySavedKwh: number;  // Tejangan elektr (kWh)
}

/**
 * Materialga qarab ekologik koeffitsientlar
 * Manbalar: EPA (AQSh Atrof-muhit agentligi), WRAP (UK Chiqindilarni kamaytirish)
 */
const MATERIAL_IMPACT: Record<string, {
    co2PerKg: number;    // kg CO₂ / kg material
    waterPerKg: number;  // litr / kg material
    energyPerKg: number; // kWh / kg material
}> = {
    'Makulatura': { co2PerKg: 1.5,  waterPerKg: 50,  energyPerKg: 4.0  },
    'Karton':     { co2PerKg: 1.1,  waterPerKg: 35,  energyPerKg: 3.2  },
    'Plastik':    { co2PerKg: 1.8,  waterPerKg: 10,  energyPerKg: 5.8  },
    'Shisha':     { co2PerKg: 0.3,  waterPerKg: 1.5, energyPerKg: 0.8  },
    'Metall':     { co2PerKg: 2.1,  waterPerKg: 2.0, energyPerKg: 6.5  },
    'default':    { co2PerKg: 1.5,  waterPerKg: 30,  energyPerKg: 4.0  },
};

/** 1 daraxt ≈ 60 kg CO₂/yil yutadi */
const CO2_PER_TREE_YEAR = 60;

/** Material va kg bo'yicha ekologik ta'sir hisoblash */
export function calcEcoImpact(material: string, kg: number): EcoImpact {
    const coeff = MATERIAL_IMPACT[material] ?? MATERIAL_IMPACT['default'];
    const co2SavedKg = Math.round(coeff.co2PerKg * kg * 10) / 10;
    return {
        co2SavedKg,
        treesEquivalent: Math.floor(co2SavedKg / CO2_PER_TREE_YEAR) || 0,
        waterSavedL: Math.round(coeff.waterPerKg * kg),
        energySavedKwh: Math.round(coeff.energyPerKg * kg * 10) / 10,
    };
}

/** Jami statistika uchun — bir nechta ariza bo'yicha */
export function calcTotalImpact(entries: { material: string; kg: number }[]): EcoImpact {
    return entries.reduce(
        (acc, e) => {
            const impact = calcEcoImpact(e.material, e.kg);
            return {
                co2SavedKg: Math.round((acc.co2SavedKg + impact.co2SavedKg) * 10) / 10,
                treesEquivalent: acc.treesEquivalent + impact.treesEquivalent,
                waterSavedL: acc.waterSavedL + impact.waterSavedL,
                energySavedKwh: Math.round((acc.energySavedKwh + impact.energySavedKwh) * 10) / 10,
            };
        },
        { co2SavedKg: 0, treesEquivalent: 0, waterSavedL: 0, energySavedKwh: 0 }
    );
}

/** Chiroyli ko'rsatish uchun formatlash */
export function formatCO2(kg: number): string {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
    return `${kg} kg`;
}
