/** Toshkent (UTC+5, yozgi vaqt yo'q) bo'yicha sana (YYYY-MM-DD) va soat */
export function tashkentClock(now: Date): { day: string; hour: number } {
  const t = new Date(now.getTime() + 5 * 3_600_000);
  return { day: t.toISOString().slice(0, 10), hour: t.getUTCHours() };
}
