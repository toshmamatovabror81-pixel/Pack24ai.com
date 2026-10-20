import type { StockMovementType } from '@prisma/client';
import { Badge } from '../ui';

export const movementTypeNames: Record<StockMovementType, string> = { IN: 'Kirim', OUT: 'Chiqim', TRANSFER: "Ko'chirish" };

/** Qoldiq o'zgarishi sabablari (adjustInventory formasi) */
export const movementReasons: Record<string, string> = {
  kirim: 'Kirim',
  sotuv: 'Sotuv',
  'hisobdan chiqarish': 'Hisobdan chiqarish',
  inventarizatsiya: 'Inventarizatsiya',
  boshqa: 'Boshqa',
};

export function movementTypeBadge(t: StockMovementType) {
  const tone = t === 'IN' ? 'green' : t === 'OUT' ? 'red' : 'blue';
  return <Badge tone={tone}>{movementTypeNames[t]}</Badge>;
}

/** Qoldiq: chegaradan kam bo'lsa qizil */
export function stockBadge(quantity: number, threshold: number) {
  return <Badge tone={quantity <= threshold ? 'red' : 'green'}>{quantity}</Badge>;
}
