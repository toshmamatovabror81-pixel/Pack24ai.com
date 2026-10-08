import type { ProductionStage, TaskPriority, WorkOrderStageStatus, WorkOrderStatus } from '@prisma/client';

/** Ishlab chiqarish bosqichlari — belgilangan tartibda */
export const STAGE_ORDER: ProductionStage[] = ['gofra', 'pechat', 'yiguv', 'qc'];

export const productionStageNames: Record<ProductionStage, string> = {
  gofra: 'Gofra',
  pechat: 'Pechat',
  yiguv: "Yig'uv",
  qc: 'Sifat nazorati',
};

export const workOrderStatusNames: Record<WorkOrderStatus, string> = {
  planned: 'Rejalashtirilgan',
  in_progress: 'Jarayonda',
  completed: 'Yakunlangan',
  paused: "To'xtatilgan",
  cancelled: 'Bekor qilingan',
};

export const stageStatusNames: Record<WorkOrderStageStatus, string> = {
  pending: 'Kutilmoqda',
  in_progress: 'Jarayonda',
  completed: 'Yakunlangan',
};

export const priorityNames: Record<TaskPriority, string> = {
  low: 'Past',
  normal: "O'rtacha",
  high: 'Yuqori',
  urgent: 'Shoshilinch',
};
