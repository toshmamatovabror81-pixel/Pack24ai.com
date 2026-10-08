import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { displayPhone } from '@/lib/format';
import { paymeConfigured } from '@/lib/payments/payme';
import { clickConfigured } from '@/lib/payments/click';
import { Badge, Field, I18nFields, Notice, PageHeader } from '@/components/admin/ui';
import { updateSettings } from './actions';

export const metadata = { title: 'Sozlamalar' };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireStaff('settings');
  const s = await getSettings();
  const integrations = [
    { name: 'Payme', ok: paymeConfigured(), env: 'PAYME_MERCHANT_ID, PAYME_SECRET_KEY' },
    { name: 'Click', ok: clickConfigured(), env: 'CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY' },
    { name: 'Telegram xabarlar', ok: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_ADMIN_CHAT_ID, env: 'TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID' },
  ];
  return (
    <>
      <PageHeader title="Sozlamalar" />
      <Notice show={(await searchParams).saved === '1'}>Saqlandi. Saytda bir necha daqiqada yangilanadi.</Notice>
      <section className="card mb-6 p-5">
        <h2 className="mb-3 font-semibold">Ulanishlar</h2>
        <ul className="space-y-2 text-sm">
          {integrations.map((i) => (
            <li key={i.name} className="flex flex-wrap items-center gap-3">
              {i.ok ? <Badge tone="green">Ulangan</Badge> : <Badge tone="amber">Sozlanmagan</Badge>}
              <span className="font-medium">{i.name}</span>
              {!i.ok && <span className="text-xs text-slate-500">serverdagi .env faylida: {i.env}</span>}
            </li>
          ))}
        </ul>
      </section>
      <form action={updateSettings} className="space-y-6">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Kompaniya</h2>
          <Field label="Brend nomi"><input name="companyName" defaultValue={s.companyName} className="input" /></Field>
          <Field label="Yuridik nomi" hint="Footer, oferta va fakturada"><input name="legalName" defaultValue={s.legalName} placeholder='"PACK24" MChJ' className="input" /></Field>
          <Field label="INN (STIR)"><input name="inn" defaultValue={s.inn} className="input" /></Field>
          <Field label="Bank rekvizitlari"><textarea name="bankDetails" defaultValue={s.bankDetails} rows={3} className="input" /></Field>
        </section>
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Aloqa</h2>
          <Field label="Asosiy telefon"><input name="phone" defaultValue={displayPhone(s.phone)} className="input" /></Field>
          <Field label="Qo'shimcha telefon"><input name="phone2" defaultValue={s.phone2 ? displayPhone(s.phone2) : ''} className="input" /></Field>
          <Field label="Email"><input name="email" type="email" defaultValue={s.email} className="input" /></Field>
          <Field label="Telegram bot (buyurtma)"><input name="telegramBot" defaultValue={s.telegramBot} placeholder="Pack24AI_bot" className="input" /></Field>
          <Field label="Telegram kanal"><input name="telegramChannel" defaultValue={s.telegramChannel} className="input" /></Field>
          <Field label="Instagram"><input name="instagram" defaultValue={s.instagram} className="input" /></Field>
          <I18nFields name="address" label="Manzil" value={s.address} />
          <I18nFields name="workHours" label="Ish vaqti" value={s.workHours} />
          <Field label="Yandex xarita (iframe manzili)" hint="Yandex Xaritalar > Ulashish > Kartani saytga joylash > src manzili" wide><input name="mapEmbedUrl" defaultValue={s.mapEmbedUrl} className="input" /></Field>
        </section>
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Yetkazib berish va analitika</h2>
          <Field label="Kuryer narxi, so'm"><input name="deliveryFee" inputMode="numeric" defaultValue={s.deliveryFee} className="input" /></Field>
          <Field label="Shu summadan yuqori bepul, so'm" hint="0: har doim pullik"><input name="freeDeliveryFrom" inputMode="numeric" defaultValue={s.freeDeliveryFrom} className="input" /></Field>
          <Field label="Yandex Metrika ID" hint="Faqat raqamlar"><input name="yandexMetrikaId" defaultValue={s.yandexMetrikaId} className="input" /></Field>
          <Field label="Google Analytics 4 ID" hint="G-XXXXXXX"><input name="ga4Id" defaultValue={s.ga4Id} className="input" /></Field>
        </section>
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Sahifa matnlari (Markdown)</h2>
          <I18nFields name="deliveryText" label="Yetkazib berish" value={s.deliveryText} textarea rows={5} />
          <I18nFields name="paymentText" label="To'lov usullari" value={s.paymentText} textarea rows={5} />
          <I18nFields name="offerText" label="Ommaviy oferta" value={s.offerText} textarea rows={8} />
          <I18nFields name="privacyText" label="Maxfiylik siyosati" value={s.privacyText} textarea rows={8} />
          <I18nFields name="vacanciesText" label="Bo'sh ish o'rinlari" value={s.vacanciesText} textarea rows={4} />
        </section>
        <button className="btn-primary">Saqlash</button>
      </form>
    </>
  );
}
