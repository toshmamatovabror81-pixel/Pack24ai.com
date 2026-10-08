import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { roleNames } from '@/lib/auth/permissions';
import { STAFF_ROLES } from '@/lib/auth/session';
import { displayPhone } from '@/lib/format';
import { Field, Notice, PageHeader } from '@/components/admin/ui';
import { createStaff, updateStaff } from './actions';

export const metadata = { title: 'Xodimlar' };

const errors: Record<string, string> = {
  fields: "Ism va telefon raqamni to'g'ri kiriting",
  password: "Parol kamida 10 belgi bo'lsin",
  exists: 'Bu telefon yoki email bilan xodim bor',
  self: "O'zingizni o'chira yoki adminlikdan tushira olmaysiz",
};

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; first?: string }> }) {
  const me = await requireStaff('staff');
  const sp = await searchParams;
  const staff = await prisma.user.findMany({ where: { role: { in: STAFF_ROLES }, deletedAt: null }, orderBy: { createdAt: 'asc' } });
  return (
    <>
      <PageHeader title="Xodimlar" />
      <Notice show={sp.first === '1'} tone="warn">
        Birinchi admin yaratildi. Endi o&apos;zingiz uchun telefon raqamli xodim akkaunti oching (rol: Administrator) va keyin shu bilan kiring.
      </Notice>
      <Notice show={sp.saved === '1'}>Saqlandi</Notice>
      <Notice show={!!sp.error} tone="warn">{errors[sp.error ?? ''] ?? 'Xato'}</Notice>
      <p className="mb-4 text-sm text-slate-500">
        Administrator: hammasi. Menejer: buyurtmalar, mahsulotlar, mijozlar, arizalar, marketing, kontent, hisobotlar. Xodim: buyurtmalar va arizalar.
      </p>
      <div className="space-y-2">
        {staff.map((u) => (
          <form key={u.id} action={updateStaff} className="card flex flex-wrap items-center gap-3 p-3">
            <input type="hidden" name="id" value={u.id} />
            <div className="min-w-48 flex-1">
              <p className="font-medium">{u.name}{u.id === me.id && <span className="text-xs text-slate-500"> (siz)</span>}</p>
              <p className="text-xs text-slate-500">{u.phone.startsWith('admin:') ? `login: ${u.phone.slice(6)}` : displayPhone(u.phone)}{u.email && ` · ${u.email}`}</p>
            </div>
            <select name="role" defaultValue={u.role} className="input w-auto py-1.5">
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
            </select>
            <input name="password" type="password" placeholder="Yangi parol" autoComplete="new-password" className="input w-40 py-1.5" />
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="isActive" defaultChecked={u.isActive} /> Faol</label>
            <button className="btn-ghost px-3 py-1.5 text-sm">Saqlash</button>
          </form>
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Yangi xodim</h2>
      <form action={createStaff} className="card grid gap-4 p-5 sm:grid-cols-3">
        <Field label="Ism *"><input name="name" required className="input" /></Field>
        <Field label="Telefon * (kirish uchun)"><input name="phone" type="tel" required className="input" /></Field>
        <Field label="Email (ixtiyoriy)"><input name="email" type="email" className="input" /></Field>
        <Field label="Lavozim"><input name="position" className="input" /></Field>
        <Field label="Rol">
          <select name="role" defaultValue="staff" className="input">{STAFF_ROLES.map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}</select>
        </Field>
        <Field label="Parol * (kamida 10 belgi)"><input name="password" type="password" required minLength={10} autoComplete="new-password" className="input" /></Field>
        <div className="sm:col-span-3"><button className="btn-primary">Qo&apos;shish</button></div>
      </form>
    </>
  );
}
