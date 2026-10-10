import type { BotEventSource, EventSeverity } from '@prisma/client';

/** Hodisalar ro'yxati filtrlari (sahifa va action'lar uchun umumiy) */

export const SOURCES: BotEventSource[] = ['customer', 'driver', 'supervisor', 'pack24admin', 'platform', 'system'];
export const sourceLabels: Record<BotEventSource, string> = { customer: 'Mijoz boti', driver: 'Haydovchi boti', supervisor: 'Boshqaruv boti (masul)', pack24admin: 'Boshqaruv boti (rahbariyat)', platform: 'Sayt / admin', system: 'Tizim' };
export const SEVERITIES: EventSeverity[] = ['info', 'success', 'warning', 'error'];
export type StatusFilter = 'new_' | 'processed' | 'all';
export const statusFilterLabels: Record<StatusFilter, string> = { new_: 'Yangi', processed: "Ko'rilgan", all: 'Hammasi' };

export type EventFilters = { status: StatusFilter; source: BotEventSource | ''; severity: EventSeverity | ''; q: string; page: number };

export function parseEventFilters(sp: Record<string, string | undefined>): EventFilters {
  const status: StatusFilter = sp.status === 'processed' || sp.status === 'all' ? sp.status : 'new_';
  const source = SOURCES.find((s) => s === sp.source) ?? '';
  const severity = SEVERITIES.find((s) => s === sp.severity) ?? '';
  const q = (sp.q ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  return { status, source, severity, q, page };
}

export function eventsUrl(f: Partial<EventFilters>, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if (f.status && f.status !== 'new_') p.set('status', f.status);
  if (f.source) p.set('source', f.source);
  if (f.severity) p.set('severity', f.severity);
  if (f.q) p.set('q', f.q);
  if (f.page && f.page > 1) p.set('page', String(f.page));
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return `/admin/recycling/events${s ? `?${s}` : ''}`;
}
