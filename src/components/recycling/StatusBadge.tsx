import type { RecycleRequestStatus } from '@prisma/client';
import type { Locale } from '@/lib/i18n/config';
import { statusLabels, statusTone } from '@/lib/recycling/statuses';

/** Mijoz sahifalari uchun rangli holat belgisi (server komponent, JS kerak emas) */
const tones = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-800',
};

export function StatusBadge({ status, locale, size = 'md' }: { status: RecycleRequestStatus; locale: Locale; size?: 'sm' | 'md' }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full font-medium ${tones[statusTone[status]]} ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}>
      {statusLabels[locale][status]}
    </span>
  );
}
