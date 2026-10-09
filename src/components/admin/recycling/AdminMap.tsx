'use client';

import dynamic from 'next/dynamic';
import type { AdminMapData } from './mapTypes';

/** Leaflet faqat brauzerda ishlaydi — server render qilinmaydi */
const Inner = dynamic(() => import('./AdminMapInner'), {
  ssr: false,
  loading: () => <div className="flex h-[70vh] min-h-[420px] w-full animate-pulse items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">Xarita yuklanmoqda…</div>,
});

export function AdminMap({ data }: { data: AdminMapData }) {
  return <Inner data={data} />;
}
