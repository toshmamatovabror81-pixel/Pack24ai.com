import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { roleNames } from '@/lib/auth/permissions';
import { STAFF_ROLES } from '@/lib/auth/session';
import { displayPhone, formatDate } from '@/lib/format';
import { botToken } from '@/lib/telegram/bots';
import { botStatuses } from '@/lib/telegram/setup';
import { Field, Notice, PageHeader } from '@/components/admin/ui';
import { createStaff, issueTelegramCode, unlinkTelegram, updateStaff } from './actions';

export const metadata = { title: 'Xodimlar' };

const errors: Record<string, string> = {
  fields: "Ism va telefon raqamni to'g'ri kiriting",
  password: "Parol kamida 10 belgi bo'lsin",
  exists: 'Bu telefon yoki email bilan xodim bor',
  self: "O'zingizni o'chira yoki adminlikdan tushira olmaysiz",
  tgInactive: "Faol bo'lmagan xodimga Telegram kodi berilmaydi — avval «Faol» belgisini qo'yib saqlang",
  tgCode: "Telegram kodini yaratib bo'lmadi, qayta urinib ko'ring",
  tgNoBot: "Boshqaruv boti tokeni hali kiritilmagan — Telegram kodi berilmadi (bot ulanmaguncha kod ishlamaydi)",
};

/**
 * Boshqaruv botining @username'i sozlamalarda yo'q — Telegram'dan olinadi (botStatuses 60 s keshlaydi).
 * Token yo'q bo'lsa so'rov yuborilmaydi; Telegram 3 s ichida javob bermasa sahifa kutmaydi (bot nomi oddiy matn bilan chiqadi).
 */
async function staffBotUsername(): Promise<string | null> {
  if (!botToken('staff')) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const statuses = await Promise.race([botStatuses(), new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 3_000); })]);
    return statuses?.find((b) => b.kind === 'staff')?.username || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; first?: string; code?: string; for?: string }> }) {
  const me = await requireStaff('staff');
  const sp = await searchParams;
  const [staff, botUsername] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: STAFF_ROLES }, deletedAt: null }, orderBy: { createdAt: 'asc' } }),
    staffBotUsername(),
  ]);
  const bot = botUsername ? <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="font-medium underline">@{botUsername}</a> : 'boshqaruv boti';
  // Token kiritilmaguncha bot hech kimga javob bermaydi: sahifa buni ochiq aytadi va befoyda kod berilmaydi (amalning o'zi ham rad etadi)
  const botReady = !!botToken('staff');
  // "Telegram kodi" bosilgandan keyingi xabar. Kod manzil satrida keladi, lekin faqat bazadagi shu xodimning amaldagi kodi bilan
  // bir xil bo'lsa ko'rsatiladi: ishlatilgan, muddati o'tgan, qayta berilgan yoki qo'lda yozilgan ?code= "amal qiladi" deb chiqmaydi
  // (sahifa yangilanganda ham) — o'rniga kodsiz, betaraf ogohlantirish chiqadi.
  const code = /^\d{6}$/.test(sp.code ?? '') ? sp.code : null;
  const now = new Date();
  const codeFor = code ? staff.find((u) => String(u.id) === sp.for && u.telegramCode === code && u.otpExpiry != null && u.otpExpiry > now) : undefined;
  const codeStale = !!code && !codeFor;
  return (
    <>
      <PageHeader title="Xodimlar" />
      <Notice show={sp.first === '1'} tone="warn">
        Birinchi admin yaratildi. Endi o&apos;zingiz uchun telefon raqamli xodim akkaunti oching (rol: Administrator) va keyin shu bilan kiring.
      </Notice>
      <Notice show={sp.saved === '1'}>Saqlandi</Notice>
      <Notice show={!!sp.error} tone="warn">{errors[sp.error ?? ''] ?? 'Xato'}</Notice>
      <Notice show={!botReady} tone="warn">
        Boshqaruv boti tokeni hali kiritilmagan — xodimlar botga ulana olmaydi va ularga Telegram xabarnomalari ketmaydi, shuning uchun «Telegram kodi» tugmasi yashirilgan.
        Tokenni serverda <code className="font-mono">deploy/bots-setup.sh</code> skripti bilan kiriting; bot holati Sozlamalar &gt; «Telegram botlar» bo&apos;limida ko&apos;rinadi.
      </Notice>
      <Notice show={!!codeFor}>
        {codeFor?.name} uchun Telegram kodi: <b className="font-mono text-base tracking-widest">{code}</b>. Xodim {bot}da /start bosib, shu kodni yozib yuboradi.
        Kod 30 daqiqa amal qiladi va faqat bir marta ishlaydi. U boshqa hech qayerda ko&apos;rsatilmaydi — hozir xodimga ayting.
      </Notice>
      <Notice show={codeStale} tone="warn">
        Bu Telegram kodi endi amal qilmaydi (ishlatilgan, muddati o&apos;tgan yoki o&apos;rniga yangisi berilgan). Kerak bo&apos;lsa xodim qatoridagi «Telegram kodi» tugmasini qayta bosing.
      </Notice>
      <p className="mb-4 text-sm text-slate-500">
        Administrator: hammasi. Menejer: buyurtmalar, mahsulotlar, mijozlar, arizalar, marketing, kontent, hisobotlar. Xodim: buyurtmalar va arizalar.
      </p>
      <p className="mb-4 text-sm text-slate-500">
        Telegram{!botReady && ' (bot tokeni kiritilgandan keyin)'}: xodim {bot}ni ochib /start bosadi va o&apos;z telefon raqamini ulashadi — raqam shu ro&apos;yxatdagi telefon bilan bir xil bo&apos;lsa bot darhol ulanadi.
        Telefoni mos kelmasa (yoki login bilan kiradigan admin bo&apos;lsa) «Telegram kodi» tugmasini bosing va chiqqan 6 xonali kodni xodimga ayting: u kodni botga yozadi.
        Ulangan xodim botda yangi buyurtma va to&apos;lov xabarlarini oladi, buyurtma holatini o&apos;zgartiradi; «Telegram xabar» belgisi olib tashlansa xabarnomalar kelmaydi, «Uzish» botdan butunlay chiqaradi.
      </p>
      <div className="space-y-2">
        {staff.map((u) => (
          <form key={u.id} action={updateStaff} className="card flex flex-wrap items-center gap-3 p-3">
            <input type="hidden" name="id" value={u.id} />
            <div className="min-w-48 flex-1">
              <p className="font-medium">{u.name}{u.id === me.id && <span className="text-xs text-slate-500"> (siz)</span>}</p>
              <p className="text-xs text-slate-500">{u.phone.startsWith('admin:') ? `login: ${u.phone.slice(6)}` : displayPhone(u.phone)}{u.email && ` · ${u.email}`}</p>
              <p className={`text-xs ${u.telegramId ? 'text-emerald-700' : 'text-slate-400'}`}>
                Telegram: {u.telegramId ? `ulangan${u.telegramVerifiedAt ? ` (${formatDate(u.telegramVerifiedAt, 'uz')} dan)` : ''}` : 'ulanmagan'}
              </p>
            </div>
            <select name="role" defaultValue={u.role} className="input w-auto py-1.5">
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
            </select>
            <input name="password" type="password" placeholder="Yangi parol" autoComplete="new-password" className="input w-40 py-1.5" />
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="isActive" defaultChecked={u.isActive} /> Faol</label>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="telegramNotify" defaultChecked={u.telegramNotify} /> Telegram xabar</label>
            {/* Birinchi tugma — "Saqlash": maydonda Enter bosilganda shu ishlaydi (Telegram tugmalari emas) */}
            <button className="btn-ghost px-3 py-1.5 text-sm">Saqlash</button>
            {botReady && <button formAction={issueTelegramCode} className="btn-ghost px-3 py-1.5 text-sm">Telegram kodi</button>}
            {u.telegramId && <button formAction={unlinkTelegram} className="btn-ghost px-3 py-1.5 text-sm text-red-600">Uzish</button>}
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
