/** Punkt rangi: Tailwind klassi (admin ro'yxat, mijoz sahifasi) va xarita uchun HEX */
export const POINT_COLORS: { cls: string; hex: string; label: string }[] = [
  { cls: 'bg-emerald-500', hex: '#10b981', label: 'Yashil' },
  { cls: 'bg-blue-500', hex: '#3b82f6', label: "Ko'k" },
  { cls: 'bg-amber-500', hex: '#f59e0b', label: 'Sariq' },
  { cls: 'bg-orange-500', hex: '#f97316', label: "To'q sariq" },
  { cls: 'bg-red-500', hex: '#ef4444', label: 'Qizil' },
  { cls: 'bg-violet-500', hex: '#8b5cf6', label: 'Binafsha' },
  { cls: 'bg-pink-500', hex: '#ec4899', label: 'Pushti' },
  { cls: 'bg-cyan-500', hex: '#06b6d4', label: 'Moviy' },
  { cls: 'bg-teal-500', hex: '#14b8a6', label: 'Zangori' },
  { cls: 'bg-indigo-500', hex: '#6366f1', label: 'Indigo' },
  { cls: 'bg-slate-500', hex: '#64748b', label: 'Kulrang' },
];

export const isPointColor = (v: unknown): v is string => typeof v === 'string' && POINT_COLORS.some((c) => c.cls === v);
export const colorHex = (cls: string | null | undefined) => POINT_COLORS.find((c) => c.cls === cls)?.hex ?? '#10b981';
