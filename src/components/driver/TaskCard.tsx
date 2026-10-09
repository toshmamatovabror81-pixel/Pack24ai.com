import Link from 'next/link';
import { Map as MapIcon, MapPin, Navigation, Phone } from 'lucide-react';
import type { RequestWithRefs } from '@/lib/recycling/notifications';
import { googleMapsUrl, yandexMapsUrl } from '@/lib/recycling/geo';
import { materialLabels, statusLabels, statusTone, volumeSizeLabels } from '@/lib/recycling/statuses';
import { displayPhone, formatDate } from '@/lib/format';
import { Badge } from '@/components/admin/ui';
import { TaskActions } from './TaskActions';

/** Topshiriq kartasi: ro'yxatda (detail=false) va topshiriq sahifasida (detail=true) */
export function TaskCard({ task, detail = false, accepted = false }: { task: RequestWithRefs; detail?: boolean; accepted?: boolean }) {
  const hasCoords = task.pickupLat != null && task.pickupLng != null;
  const material = task.material ? materialLabels.uz[task.material] : null;
  const kg = task.volume ? `~${task.volume} kg` : task.volumeSize ? volumeSizeLabels.uz[task.volumeSize] : null;
  return (
    <article className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        {detail ? (
          <span className="text-lg font-bold">Ariza #{task.id}</span>
        ) : (
          <Link href={`/driver/tasks/${task.id}`} className="text-lg font-bold text-brand-500">Ariza #{task.id} →</Link>
        )}
        <Badge tone={statusTone[task.status]}>{statusLabels.uz[task.status]}</Badge>
      </div>

      <div className="space-y-1.5 text-sm">
        <p className="flex items-center justify-between gap-2">
          <span className="font-semibold">{task.name}</span>
          <a href={`tel:+${task.phone}`} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 font-medium text-brand-600">
            <Phone className="h-3.5 w-3.5" />{displayPhone(task.phone)}
          </a>
        </p>
        {task.pickupType === 'pickup' ? (
          <p className="flex items-start gap-1.5 text-slate-700"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>{task.address ?? 'Manzil: xaritadagi nuqta'}</span></p>
        ) : (
          <p className="flex items-start gap-1.5 text-slate-700"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>Mijoz punktga o'zi olib keladi</span></p>
        )}
        {hasCoords && (
          <p className="flex gap-2">
            <a href={googleMapsUrl(task.pickupLat!, task.pickupLng!)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700"><MapIcon className="h-3.5 w-3.5" />Google xarita</a>
            <a href={yandexMapsUrl(task.pickupLat!, task.pickupLng!)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700"><Navigation className="h-3.5 w-3.5" />Yandex xarita</a>
          </p>
        )}
        <p className="text-slate-700">♻️ {[material, kg].filter(Boolean).join(' · ') || "Material ko'rsatilmagan"}</p>
        {task.point && <p className="text-slate-500">🏭 {task.point.cityUz}{task.point.address ? `, ${task.point.address}` : ''}</p>}
        {detail && task.photoUrl && (
          <a href={task.photoUrl} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={task.photoUrl} alt="Makulatura rasmi" className="max-h-56 w-full object-cover" />
          </a>
        )}
        <p className="text-xs text-slate-400">Tayinlandi: {task.assignedAt ? formatDate(task.assignedAt, 'uz', true) : '—'}</p>
      </div>

      <TaskActions task={task} back={detail ? 'task' : 'list'} accepted={accepted} />
    </article>
  );
}
