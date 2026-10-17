import type { OrderStatus, ProductionStage, WorkOrderStatus } from '@prisma/client';
import { formatDate } from './format';
import type { Locale } from './i18n/config';
import { statusKey } from './orderStatus';

/** Lug'atning shu modulga kerakli qismi (`getDict(locale).order`) */
type OrderDict = {
  production: string;
  deadline: string;
  stages: Record<ProductionStage, string>;
  statuses: Record<ReturnType<typeof statusKey>, string>;
};

export type StageWorkOrder = { productName: string; quantity: number; status: WorkOrderStatus; currentStage: ProductionStage; progress: number; deadline: Date };

/** Ish buyurtmasi foizi: yakunlangan bo'lsa 100, aks holda 0..100 oralig'ida */
export const workOrderPercent = (wo: Pick<StageWorkOrder, 'status' | 'progress'>) => (wo.status === 'completed' ? 100 : Math.min(100, Math.max(0, Math.round(wo.progress))));

/**
 * Mijozga "buyurtma qaysi bosqichda" javobi (oddiy matn satrlari; HTML uchun chaqiruvchi qochiradi).
 * Buyurtma hali yo'lga chiqmagan (yangi / tayyorlanmoqda) va unga ishlab chiqarish topshirig'i ochilgan bo'lsa,
 * holat ostida har topshiriqning bosqichi, foizi va muddati ko'rsatiladi; boshqa hollarda faqat holat.
 * Sayt (buyurtma sahifasi) ham xuddi shu qoidani ishlatadi.
 */
export function orderStageLines(order: { status: OrderStatus }, workOrders: StageWorkOrder[], t: OrderDict, locale: Locale): { status: string; production: string[] } {
  const status = t.statuses[statusKey(order.status)];
  const active = order.status === 'new_' || order.status === 'processing';
  const production = active
    ? workOrders
        .filter((w) => w.status !== 'cancelled')
        .map((w) => {
          const pct = workOrderPercent(w);
          const stage = w.status === 'completed' ? `${pct}%` : `${t.stages[w.currentStage]}, ${pct}%`;
          return `${w.productName} × ${w.quantity}: ${stage} · ${t.deadline}: ${formatDate(w.deadline, locale)}`;
        })
    : [];
  return { status, production };
}
