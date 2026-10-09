import type { RecyclePoint } from '@prisma/client';
import { displayPhone, toNumber } from '@/lib/format';
import { Field } from '@/components/admin/ui';
import { PointPicker } from './PointPicker';
import { colorHex, POINT_COLORS } from './pointColors';

/** Punkt yaratish/tahrirlash formasi (server komponent; xarita — client) */
export function PointForm({ point, action, submitLabel }: { point?: RecyclePoint | null; action: (fd: FormData) => Promise<void>; submitLabel: string }) {
  const p = point ?? null;
  return (
    <form action={action} className="card grid min-w-0 gap-4 p-5 sm:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Field label="Shahar / tuman (uz) *"><input name="cityUz" required minLength={2} defaultValue={p?.cityUz ?? ''} placeholder="Yunusobod" className="input" /></Field>
      <Field label="Shahar / tuman (ru)"><input name="cityRu" defaultValue={p?.cityRu ?? ''} placeholder="Юнусабад" className="input" /></Field>
      <Field label="Viloyat (uz) *"><input name="regionUz" required minLength={2} defaultValue={p?.regionUz ?? ''} placeholder="Toshkent" className="input" /></Field>
      <Field label="Viloyat (ru)"><input name="regionRu" defaultValue={p?.regionRu ?? ''} placeholder="Ташкент" className="input" /></Field>
      <Field label="Telefon *"><input name="phone" type="tel" required defaultValue={p ? displayPhone(p.phone) : ''} placeholder="+998 90 123 45 67" className="input" /></Field>
      <Field label="Ish vaqti"><input name="workingHours" defaultValue={p?.workingHours ?? '08:00-18:00'} className="input" /></Field>
      <Field label="Manzil" wide><input name="address" defaultValue={p?.address ?? ''} placeholder="Ko'cha, uy, mo'ljal" className="input" /></Field>
      <PointPicker lat={p?.lat ?? null} lng={p?.lng ?? null} hex={colorHex(p?.color)} />
      <Field label="Narx, so'm/kg *" hint="Mijozga to'lanadigan standart narx"><input name="pricePerKg" type="number" min={0} step={1} required defaultValue={p ? toNumber(p.pricePerKg) : 800} className="input" /></Field>
      <Field label="Haydovchi stavkasi, so'm/kg *" hint="Haydovchi daromadi = og'irlik × stavka"><input name="driverRatePerKg" type="number" min={0} step={1} required defaultValue={p ? toNumber(p.driverRatePerKg) : 100} className="input" /></Field>
      <Field label="Holat">
        <select name="status" defaultValue={p?.status ?? 'active'} className="input">
          <option value="active">Faol</option>
          <option value="planned">Rejada (hali ochilmagan)</option>
        </select>
      </Field>
      <Field label="Rang (xarita va ro'yxat)">
        <select name="color" defaultValue={p?.color ?? 'bg-emerald-500'} className="input">
          {POINT_COLORS.map((c) => <option key={c.cls} value={c.cls}>{c.label} ({c.cls})</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="isAccepting" defaultChecked={p?.isAccepting ?? true} /> Hozir makulatura qabul qilyapti (yangi arizalar shu punktga tushadi)</label>
      <div className="sm:col-span-2"><button className="btn-primary">{submitLabel}</button></div>
    </form>
  );
}
