'use client';

type Win = Window & {
  ym?: (id: number, action: string, goal: string, params?: object) => void;
  gtag?: (...args: unknown[]) => void;
  __P24_YM?: number;
};

/** Yandex Metrika maqsadi + GA4 hodisasi. Hisoblagichlar o'rnatilmagan bo'lsa jim o'tadi. */
export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const w = window as Win;
  try {
    if (w.ym && w.__P24_YM) w.ym(w.__P24_YM, 'reachGoal', event, params);
    if (w.gtag) w.gtag('event', event, params);
  } catch {
    /* analitika saytni buzmasin */
  }
}
