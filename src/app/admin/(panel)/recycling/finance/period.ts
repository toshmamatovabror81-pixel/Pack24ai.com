import { str } from '@/lib/params';
import { dayEnd, parseDayStart, tashkentDayStart } from '@/components/admin/recycling/helpers';

/** Moliya davri: bugun / 7 kun / shu oy / tanlangan from–to (Toshkent kunlari). Jurnal sanalari (UTC yarim tun) ham shu oraliqqa tushadi. */

export type PeriodKey = 'today' | '7d' | 'month' | 'custom';
export const PERIOD_KEYS: PeriodKey[] = ['today', '7d', 'month', 'custom'];
export const periodLabels: Record<PeriodKey, string> = { today: 'Bugun', '7d': '7 kun', month: 'Shu oy', custom: 'Davr' };

const TZ_MS = 5 * 60 * 60 * 1000;
/** Haqiqiy vaqt nuqtasi → Toshkent kalendar sanasi 'YYYY-MM-DD' */
export const tashkentDateKey = (d: Date) => new Date(d.getTime() + TZ_MS).toISOString().slice(0, 10);

export type ResolvedPeriod = { key: PeriodKey; from: Date; to: Date; fromStr: string; toStr: string; pointId: number | null };

export function resolvePeriod(sp: Record<string, string | string[] | undefined>, now = new Date()): ResolvedPeriod {
  const raw = str(sp.period);
  const todayStart = tashkentDayStart(now);
  const tomorrow = dayEnd(todayStart);
  const pid = Number(str(sp.point));
  const pointId = Number.isSafeInteger(pid) && pid > 0 ? pid : null;
  let key: PeriodKey = PERIOD_KEYS.find((k) => k === raw) ?? 'today';
  let from = todayStart;
  let to = tomorrow;
  if (key === '7d') from = new Date(todayStart.getTime() - 6 * 86_400_000);
  else if (key === 'month') {
    const local = new Date(now.getTime() + TZ_MS);
    from = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - TZ_MS);
  } else if (key === 'custom') {
    const f = parseDayStart(str(sp.from));
    const t = parseDayStart(str(sp.to));
    if (!f && !t) key = 'today';
    else {
      from = f ?? t!;
      to = dayEnd(t ?? f!);
      if (to <= from) to = dayEnd(from);
    }
  }
  // Oxirgi kun (to - 1 kun) ni ko'rsatish uchun
  return { key, from, to, fromStr: tashkentDateKey(from), toStr: tashkentDateKey(new Date(to.getTime() - 1)), pointId };
}

export function financeUrl(p: { key: PeriodKey; fromStr: string; toStr: string; pointId: number | null }, extra: Record<string, string> = {}, path = '/admin/recycling/finance'): string {
  const q = new URLSearchParams({ period: p.key });
  if (p.key === 'custom') { q.set('from', p.fromStr); q.set('to', p.toStr); }
  if (p.pointId) q.set('point', String(p.pointId));
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return `${path}?${q}`;
}
