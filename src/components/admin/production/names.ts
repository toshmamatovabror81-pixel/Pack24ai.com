import type { TaskPriority, WorkOrderStageStatus, WorkOrderStatus } from '@prisma/client';

// Bosqichlar tartibi va nomlari React'siz umumiy modulda (botlar ham ishlatadi)
export { productionStageNames, STAGE_ORDER } from '@/lib/productionStages';

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
