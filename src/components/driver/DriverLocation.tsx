'use client';

import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { reportLocation, setOnlineAction } from '@/app/driver/actions';
import { SubmitButton } from './SubmitButton';

const INTERVAL_MS = 60_000;

/**
 * Onlayn tugmasi + GPS. Onlayn bo'lsa brauzer joylashuvi kuzatiladi va 60 soniyada bir serverga yuboriladi.
 * Ruxsat berilmasa yoki GPS yo'q bo'lsa — jim (faqat kichik izoh).
 */
export function DriverLocation({ isOnline }: { isOnline: boolean }) {
  const [gps, setGps] = useState<'idle' | 'sent' | 'denied' | 'none'>('idle');
  const lastSent = useRef(0);

  useEffect(() => {
    if (!isOnline) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGps('none');
      return;
    }
    const onPos = (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastSent.current < INTERVAL_MS) return;
      lastSent.current = now;
      reportLocation(pos.coords.latitude, pos.coords.longitude).then((r) => r.ok && setGps('sent')).catch(() => {});
    };
    const onErr = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) setGps('denied');
    };
    const id = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [isOnline]);

  const hint = !isOnline ? 'Topshiriq olish uchun onlayn bo\'ling' : gps === 'sent' ? 'GPS yuborilmoqda' : gps === 'denied' ? 'GPS ruxsati yo\'q' : gps === 'none' ? 'GPS mavjud emas' : 'GPS kutilmoqda';

  return (
    <div className="card mb-3 flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          {isOnline ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-slate-400" />}
          {isOnline ? 'Onlayn' : 'Oflayn'}
        </p>
        <p className="truncate text-xs text-slate-500">{hint}</p>
      </div>
      <form action={setOnlineAction}>
        <input type="hidden" name="online" value={isOnline ? '0' : '1'} />
        <SubmitButton className={isOnline ? 'btn-ghost px-4 py-2 text-sm' : 'btn-primary px-4 py-2 text-sm'}>{isOnline ? 'Oflayn bo\'lish' : 'Onlayn bo\'lish'}</SubmitButton>
      </form>
    </div>
  );
}
