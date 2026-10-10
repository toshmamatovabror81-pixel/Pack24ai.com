import type { ProductionStage } from '@prisma/client';

/** Ishlab chiqarish bosqichlari — belgilangan tartibda */
export const STAGE_ORDER: ProductionStage[] = ['gofra', 'pechat', 'yiguv', 'qc'];

/** Xodimlar uchun nomlar; mijozga ko'rinadigan nomlar i18n lug'atida (order.stages) */
export const productionStageNames: Record<ProductionStage, string> = {
  gofra: 'Gofra',
  pechat: 'Pechat',
  yiguv: "Yig'uv",
  qc: 'Sifat nazorati',
};
