import Link from 'next/link';
import type { RequestWithRefs } from '@/lib/recycling/notifications';
import { acceptTaskAction, arrivedAction, collectingAction, enRouteAction, rejectTaskAction } from '@/app/driver/actions';
import { SubmitButton } from './SubmitButton';
import { REJECT_REASONS } from './labels';

/** Holatga qarab tugmalar. back=task bo'lsa action topshiriq sahifasiga qaytaradi. accepted — qabul allaqachon yuborilgan. */
export function TaskActions({ task, back, accepted = false }: { task: RequestWithRefs; back: 'list' | 'task'; accepted?: boolean }) {
  const hidden = (
    <>
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="back" value={back} />
    </>
  );
  if (task.status === 'assigned') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {accepted ? (
            <span className="flex items-center justify-center rounded-lg bg-emerald-50 px-3 text-sm font-medium text-emerald-800">✅ Qabul qilindi</span>
          ) : (
            <form action={acceptTaskAction}>
              {hidden}
              <SubmitButton className="btn-primary w-full px-3 py-3 text-sm">✅ Qabul qilaman</SubmitButton>
            </form>
          )}
          <form action={enRouteAction}>
            {hidden}
            <SubmitButton className="btn-accent w-full px-3 py-3 text-sm">🚚 Yo'lga chiqdim</SubmitButton>
          </form>
        </div>
        <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <summary className="cursor-pointer select-none text-slate-600">❌ Rad etaman</summary>
          <form action={rejectTaskAction} className="mt-2 space-y-2">
            {hidden}
            <select name="reason" className="input" defaultValue="band" aria-label="Sabab">
              {REJECT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input name="reasonText" maxLength={200} placeholder="Izoh (ixtiyoriy)" className="input" />
            <SubmitButton className="btn-ghost w-full py-2.5 text-sm text-red-600">Rad etish</SubmitButton>
          </form>
        </details>
      </div>
    );
  }
  if (task.status === 'en_route') {
    return (
      <form action={arrivedAction}>
        {hidden}
        <SubmitButton className="btn-primary w-full py-3">📍 Yetib keldim</SubmitButton>
      </form>
    );
  }
  if (task.status === 'arrived' || task.status === 'collecting') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {task.status === 'arrived' ? (
          <form action={collectingAction}>
            {hidden}
            <SubmitButton className="btn-ghost w-full px-3 py-3 text-sm">📦 Yig'ishni boshladim</SubmitButton>
          </form>
        ) : (
          <span className="flex items-center justify-center rounded-lg bg-blue-50 px-3 text-sm text-blue-800">📦 Yig'ilmoqda</span>
        )}
        <Link href={back === 'task' ? '#weigh' : `/driver/tasks/${task.id}#weigh`} className="btn-primary px-3 py-3 text-sm">⚖️ Tortish</Link>
      </div>
    );
  }
  return null;
}
