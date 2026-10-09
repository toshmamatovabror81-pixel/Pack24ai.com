import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { displayPhone, formatDate } from '@/lib/format';
import { str, type SearchParams } from '@/lib/params';
import { hqAllowedIds } from '@/lib/telegram/bots';
import { Badge, Field, Notice, PageHeader, Table } from '@/components/admin/ui';
import { RecyclingNav } from '@/components/admin/recycling/RecyclingNav';
import { ConfirmButton } from '@/components/admin/recycling/ConfirmButton';
import { CopyButton } from '@/components/admin/recycling/CopyButton';
import { RegistrationCode, TelegramBadge } from '@/components/admin/recycling/badges';
import { recyclingNavBadges } from '../events/navBadges';
import { createHqAdminAction, resetHqAdminTelegramAction, toggleHqAdminAction } from './actions';

export const metadata = { title: 'HQ adminlar' };
export const dynamic = 'force-dynamic';

export default async function HqAdminsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff('recycling');
  const sp = await searchParams;
  const [admins, badges] = await Promise.all([
    prisma.telegramHqAdmin.findMany({ orderBy: [{ isActive: 'desc' }, { id: 'asc' }] }),
    recyclingNavBadges(),
  ]);
  const envIds = hqAllowedIds();
  const createdId = Number(str(sp.created)) || 0;
  const resetId = Number(str(sp.reset)) || 0;
  const highlight = admins.find((a) => a.id === (createdId || resetId));
  const error = str(sp.error);

  return (
    <>
      <PageHeader title={`HQ adminlar (${admins.length})`} />
      <RecyclingNav badges={badges} />
      <Notice show={str(sp.saved) === '1'}>Saqlandi</Notice>
      <Notice show={!!error} tone="warn">{error}</Notice>
      {highlight && highlight.registrationCode && (
        <div className="card mb-4 border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">{createdId ? 'HQ admin yaratildi.' : 'Telegram uzildi, yangi kod berildi.'} <b>{highlight.name}</b> ga shu kodni bering:</p>
          <p className="my-3 flex flex-wrap items-center gap-3"><RegistrationCode code={highlight.registrationCode} big /><CopyButton text={highlight.registrationCode} label="Kodni nusxalash" /></p>
          <p className="text-amber-900">HQ admin boti → <b>/start</b> → kodni yuboradi → «Telefonni ulashish» (raqam <b>{displayPhone(highlight.phone)}</b> bilan mos bo'lishi shart). Kod bir martalik.</p>
        </div>
      )}
      <p className="mb-4 text-sm text-slate-500">
        HQ admin — HQ botida kirish so'rovlarini tasdiqlaydi, hodisalar va shikoyatlarni ko'radi, masul/haydovchilarni boshqaradi. Botga kirish: ro'yxatdan o'tish kodi + telefon.
      </p>
      <div className="card mb-4 border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Eslatma: serverdagi <code className="font-mono">.env</code> faylidagi <code className="font-mono">HQ_ALLOWED_TELEGRAM_IDS</code> ro'yxatidagi Telegram ID'lar ham HQ botida <b>doim</b> ruxsatli (kod kerak emas, bu ro'yxatda ko'rinmaydi).
        {envIds.length ? <> Hozir: {envIds.map((id) => <code key={id} className="ml-1 rounded bg-white px-1 font-mono">{id}</code>)}</> : <> Hozir bo'sh.</>}
      </div>
      <Table head={['Ism', 'Telefon', 'Telegram', 'Kod', 'Holat', "Ro'yxatdan o'tdi", 'Oxirgi faollik', 'Amallar']} empty={!admins.length}>
        {admins.map((a) => (
          <tr key={a.id} className={`hover:bg-slate-50 ${a.isActive ? '' : 'opacity-60'}`}>
            <td className="px-4 py-3 font-semibold">{a.name}<span className="block text-xs font-normal text-slate-400">#{a.id}</span></td>
            <td className="whitespace-nowrap px-4 py-3"><a href={`tel:+${a.phone}`} className="text-brand-500">{displayPhone(a.phone)}</a></td>
            <td className="px-4 py-3"><TelegramBadge telegramId={a.telegramId} telegramName={a.telegramName} /></td>
            <td className="px-4 py-3">{a.telegramId ? <span className="text-xs text-slate-400">ulangan</span> : <RegistrationCode code={a.registrationCode} />}</td>
            <td className="px-4 py-3">{a.isActive ? <Badge tone="green">Faol</Badge> : <Badge tone="slate">Nofaol</Badge>}</td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{a.registeredAt ? formatDate(a.registeredAt, 'uz', true) : '—'}</td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{a.lastSeenAt ? formatDate(a.lastSeenAt, 'uz', true) : '—'}</td>
            <td className="whitespace-nowrap px-4 py-3">
              <form action={toggleHqAdminAction} className="inline">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="isActive" value={a.isActive ? 'false' : 'true'} />
                <button className="btn-ghost px-3 py-1 text-xs">{a.isActive ? 'Nofaol qilish' : 'Faollashtirish'}</button>
              </form>{' '}
              <form action={resetHqAdminTelegramAction} className="inline">
                <input type="hidden" name="id" value={a.id} />
                <ConfirmButton message={a.telegramId ? 'Telegram uzilsinmi? Yangi kod beriladi, admin qayta kirishi kerak.' : 'Yangi kod berilsinmi? Eski kod bekor bo\'ladi.'} className="btn-ghost px-3 py-1 text-xs">{a.telegramId ? 'Telegramni uzish' : 'Yangi kod'}</ConfirmButton>
              </form>
            </td>
          </tr>
        ))}
      </Table>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Yangi HQ admin</h2>
      <form action={createHqAdminAction} className="card grid gap-4 p-5 sm:grid-cols-3">
        <Field label="Ism *"><input name="name" required minLength={2} className="input" /></Field>
        <Field label="Telefon *" hint="Botda shu raqam bilan ulashadi"><input name="phone" type="tel" required placeholder="+998 90 123 45 67" className="input" /></Field>
        <div className="flex items-end"><button className="btn-primary">Yaratish va kod olish</button></div>
      </form>
    </>
  );
}
