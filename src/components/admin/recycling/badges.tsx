import type { ComplaintStatus, DriverStatus, EventSeverity, RecyclePaymentStatus, RecycleRequestStatus } from '@prisma/client';
import { Badge } from '@/components/admin/ui';
import { paymentStatusLabels, statusLabels, statusTone } from '@/lib/recycling/statuses';
import { formatDate } from '@/lib/format';

/** Makulatura bo'limi uchun umumiy belgilar va yorliqlar (server va client'da ishlaydi) */

export const dt = (d: Date | string | null | undefined) => (d ? formatDate(d, 'uz', true) : '—');

export function RequestStatusBadge({ status }: { status: RecycleRequestStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabels.uz[status]}</Badge>;
}

export const driverStatusLabels: Record<DriverStatus, string> = { active: 'Faol', busy: 'Band', on_route: "Yo'lda", inactive: 'Bloklangan' };
const driverTone: Record<DriverStatus, 'green' | 'amber' | 'blue' | 'slate'> = { active: 'green', busy: 'amber', on_route: 'blue', inactive: 'slate' };
export function DriverStatusBadge({ status }: { status: DriverStatus }) {
  return <Badge tone={driverTone[status]}>{driverStatusLabels[status]}</Badge>;
}

export function PaymentBadge({ status }: { status: RecyclePaymentStatus }) {
  return <Badge tone={status === 'pending' ? 'amber' : 'green'}>{paymentStatusLabels[status]}</Badge>;
}

export const complaintStatusLabels: Record<ComplaintStatus, string> = { open: 'Ochiq', in_progress: "Ko'rilmoqda", resolved: 'Hal qilindi', closed: 'Yopildi' };
export function ComplaintBadge({ status }: { status: ComplaintStatus }) {
  const tone = status === 'open' ? 'red' : status === 'in_progress' ? 'amber' : status === 'resolved' ? 'green' : 'slate';
  return <Badge tone={tone}>{complaintStatusLabels[status]}</Badge>;
}

export const severityTone: Record<EventSeverity, 'slate' | 'green' | 'amber' | 'red'> = { info: 'slate', success: 'green', warning: 'amber', error: 'red' };
export const severityLabels: Record<EventSeverity, string> = { info: "Ma'lumot", success: 'Muvaffaqiyat', warning: 'Ogohlantirish', error: 'Xato' };

/** Haydovchi onlayn hisoblanadigan oyna (oxirgi 2 soat) */
export const ONLINE_WINDOW_MS = 2 * 60 * 60 * 1000;
export const isDriverOnline = (d: { isOnline: boolean; lastSeenAt: Date | null }, now = Date.now()) =>
  d.isOnline && !!d.lastSeenAt && now - d.lastSeenAt.getTime() <= ONLINE_WINDOW_MS;

export function OnlineBadge({ driver }: { driver: { isOnline: boolean; lastSeenAt: Date | null } }) {
  const online = isDriverOnline(driver);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs ${online ? 'text-emerald-700' : 'text-slate-500'}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      {online ? 'Onlayn' : 'Oflayn'}{driver.lastSeenAt && <span className="text-slate-400"> · {formatDate(driver.lastSeenAt, 'uz', true)}</span>}
    </span>
  );
}

export function TelegramBadge({ telegramId, telegramName }: { telegramId: string | null; telegramName: string | null }) {
  if (!telegramId) return <Badge tone="amber">Bog'lanmagan</Badge>;
  return <span className="inline-flex items-center gap-1 whitespace-nowrap"><Badge tone="green">Telegram ✓</Badge>{telegramName && <span className="text-xs text-slate-500">{telegramName}</span>}</span>;
}

/** Ro'yxatdan o'tish kodi — bog'lanmagan bo'lsa katta ko'rinishda */
export function RegistrationCode({ code, big }: { code: string | null; big?: boolean }) {
  if (!code) return <span className="text-slate-400">—</span>;
  return <span className={`inline-block rounded-lg bg-slate-900 px-2 py-0.5 font-mono font-bold tracking-widest text-white ${big ? 'px-4 py-2 text-2xl' : 'text-sm'}`}>{code}</span>;
}

export function StatCard({ label, value, hint, tone = 'slate' }: { label: string; value: React.ReactNode; hint?: string; tone?: 'slate' | 'red' | 'blue' | 'green' | 'amber' }) {
  const tones = { slate: 'text-slate-900', red: 'text-red-600', blue: 'text-blue-700', green: 'text-emerald-700', amber: 'text-amber-700' };
  return (
    <div className="card p-4">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Ma'lumot qatori: sarlavha + qiymat */
export function Info({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
