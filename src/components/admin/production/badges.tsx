import type { ProductionStage, TaskPriority, WorkOrderStageStatus, WorkOrderStatus } from '@prisma/client';
import { Badge } from '@/components/admin/ui';
import { priorityNames, productionStageNames, stageStatusNames, workOrderStatusNames } from './names';

export function workOrderStatusBadge(s: WorkOrderStatus) {
  const tone = s === 'planned' ? 'blue' : s === 'completed' ? 'green' : s === 'cancelled' ? 'red' : s === 'paused' ? 'slate' : 'amber';
  return <Badge tone={tone}>{workOrderStatusNames[s]}</Badge>;
}

export function stageStatusBadge(s: WorkOrderStageStatus) {
  const tone = s === 'completed' ? 'green' : s === 'in_progress' ? 'amber' : 'slate';
  return <Badge tone={tone}>{stageStatusNames[s]}</Badge>;
}

export function productionStageBadge(s: ProductionStage) {
  return <Badge tone={s === 'qc' ? 'green' : 'blue'}>{productionStageNames[s]}</Badge>;
}

export function priorityBadge(p: TaskPriority) {
  const tone = p === 'urgent' ? 'red' : p === 'high' ? 'amber' : p === 'low' ? 'slate' : 'blue';
  return <Badge tone={tone}>{priorityNames[p]}</Badge>;
}

/** 0-100% progress chizig'i */
export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className="inline-flex items-center gap-2">
      <span className="block h-2 w-24 overflow-hidden rounded-full bg-slate-200">
        <span className={`block h-2 rounded-full ${v >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${v}%` }} />
      </span>
      <span className="text-xs text-slate-600">{v}%</span>
    </span>
  );
}

/** Muddat o'tganmi: sana bugungidan (Toshkent vaqti) oldin; yakunlangan/bekor qilinganlar hisobga olinmaydi */
export function isOverdue(deadline: Date, status: WorkOrderStatus, now = new Date()) {
  if (status === 'completed' || status === 'cancelled') return false;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(now);
  return deadline.toISOString().slice(0, 10) < today;
}
