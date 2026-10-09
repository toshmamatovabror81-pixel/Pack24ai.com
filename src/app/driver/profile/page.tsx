import { LogOut } from 'lucide-react';
import { requireDriver } from '@/lib/auth/driver';
import { displayPhone, formatDate } from '@/lib/format';
import { Badge } from '@/components/admin/ui';
import { Flash } from '@/components/driver/Flash';
import { SubmitButton } from '@/components/driver/SubmitButton';
import { driverLogout, updateVehicleAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Profil' };

export default async function DriverProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const d = await requireDriver();
  const sp = await searchParams;
  return (
    <>
      <Flash saved={sp.saved} error={sp.error} />
      <section className="card mb-3 p-4">
        <p className="text-xl font-bold">{d.name}</p>
        <p className="text-sm text-slate-600">{displayPhone(d.phone)}</p>
        <p className="mt-2 flex flex-wrap gap-2 text-xs">
          <Badge tone={d.isOnline ? 'green' : 'slate'}>{d.isOnline ? 'Onlayn' : 'Oflayn'}</Badge>
          <Badge tone={d.telegramId ? 'green' : 'amber'}>{d.telegramId ? `Telegram: ${d.telegramName ?? "bog'langan"}` : "Telegram bog'lanmagan"}</Badge>
        </p>
        {!d.telegramId && (
          <p className="mt-2 text-xs text-slate-500">Haydovchi botiga ulanish uchun masulingizdan ro'yxatdan o'tish kodini oling. Botsiz parolni tiklab bo'lmaydi.</p>
        )}
        {d.lastSeenAt && <p className="mt-2 text-xs text-slate-400">Oxirgi faollik: {formatDate(d.lastSeenAt, 'uz', true)}</p>}
      </section>

      <form action={updateVehicleAction} className="card mb-3 space-y-2 p-4">
        <label className="block">
          <span className="label">Mashina</span>
          <input name="vehicleInfo" defaultValue={d.vehicleInfo ?? ''} maxLength={120} placeholder="Masalan: Damas 01A123BC" className="input" />
        </label>
        <SubmitButton className="btn-ghost w-full py-2.5 text-sm" pendingText="Saqlanmoqda…">Saqlash</SubmitButton>
      </form>

      <section className="card mb-3 space-y-3 p-4 text-sm">
        <div>
          <p className="text-xs text-slate-500">Punkt</p>
          {d.point ? (
            <>
              <p className="font-medium">{d.point.cityUz}{d.point.address ? `, ${d.point.address}` : ''}</p>
              <p className="text-xs text-slate-500">{d.point.workingHours} · <a href={`tel:+${d.point.phone.replace(/\D/g, '')}`} className="text-brand-500">{displayPhone(d.point.phone)}</a></p>
            </>
          ) : <p className="text-slate-500">Biriktirilmagan</p>}
        </div>
        <div>
          <p className="text-xs text-slate-500">Masul</p>
          {d.supervisor ? (
            <p className="font-medium">{d.supervisor.name} · <a href={`tel:+${d.supervisor.phone}`} className="text-brand-500">{displayPhone(d.supervisor.phone)}</a></p>
          ) : <p className="text-slate-500">Biriktirilmagan</p>}
        </div>
      </section>

      <form action={driverLogout}>
        <SubmitButton className="btn-ghost w-full py-3 text-red-600" pendingText="…"><LogOut className="h-4 w-4" /> Chiqish</SubmitButton>
      </form>
    </>
  );
}
