import { Clock, Mail, MapPin, Phone, Send } from 'lucide-react';
import { getSettings } from '@/lib/settings';
import { pickText } from '@/lib/i18n/config';
import { displayPhone } from '@/lib/format';
import { resolveLocale, type LangParams } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { contactFields, leadLabels } from '@/lib/leadLabels';
import { LeadForm } from '@/components/forms/LeadForm';
import { TrackedLink } from '@/components/site/TrackedLink';

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const s = await getSettings();
  return pageMetadata({ locale, path: '/contacts', title: t.pages.contacts, description: `${pickText(s.address, locale)}, ${displayPhone(s.phone)}` });
}

export default async function ContactsPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const s = await getSettings();
  return (
    <div className="container-site py-10">
      <h1 className="h1">{t.pages.contacts}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4 p-6">
          <p className="flex items-start gap-3"><Phone className="mt-0.5 h-5 w-5 text-brand-500" /><TrackedLink event="phone_click" href={`tel:+${s.phone}`} className="text-lg font-semibold">{displayPhone(s.phone)}</TrackedLink></p>
          {s.phone2 && <p className="flex items-start gap-3"><Phone className="mt-0.5 h-5 w-5 text-brand-500" /><TrackedLink event="phone_click" href={`tel:+${s.phone2}`}>{displayPhone(s.phone2)}</TrackedLink></p>}
          {s.email && <p className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 text-brand-500" /><a href={`mailto:${s.email}`}>{s.email}</a></p>}
          <p className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-brand-500" />{pickText(s.address, locale)}</p>
          <p className="flex items-start gap-3"><Clock className="mt-0.5 h-5 w-5 text-brand-500" />{pickText(s.workHours, locale)}</p>
          {s.telegramBot && <p className="flex items-start gap-3"><Send className="mt-0.5 h-5 w-5 text-brand-500" /><TrackedLink event="telegram_click" href={`https://t.me/${s.telegramBot}`} target="_blank" rel="noopener">@{s.telegramBot}</TrackedLink></p>}
          {s.legalName && (
            <div className="border-t border-slate-200 pt-4 text-sm text-slate-600">
              <p>{s.legalName}</p>
              {s.inn && <p>INN: {s.inn}</p>}
              {s.bankDetails && <p className="whitespace-pre-line">{s.bankDetails}</p>}
            </div>
          )}
        </div>
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">{t.forms.contactTitle}</h2>
          <LeadForm type="contact" labels={leadLabels(t)} fields={[...contactFields(t), { name: 'message', label: t.common.message, type: 'textarea', required: true }]} />
        </div>
      </div>
      {s.mapEmbedUrl.startsWith('https://yandex.') && (
        <iframe src={s.mapEmbedUrl} title={t.pages.address} className="mt-6 h-96 w-full rounded-xl border-0" loading="lazy" />
      )}
    </div>
  );
}
