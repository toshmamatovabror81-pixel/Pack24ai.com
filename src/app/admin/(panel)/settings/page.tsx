import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { DEFAULT_CONTRACT_TEXT } from '@/lib/documents';
import { displayPhone } from '@/lib/format';
import { paymeConfigured } from '@/lib/payments/payme';
import { clickConfigured } from '@/lib/payments/click';
import { BOT_KINDS, botMeta, botToken } from '@/lib/telegram/bots';
import { botStatuses, type BotStatus } from '@/lib/telegram/setup';
import { Badge, Field, I18nFields, Notice, PageHeader, Table } from '@/components/admin/ui';
import { updateSettings } from './actions';
import { removeTelegramWebhooks, setupTelegramWebhooks } from './telegramActions';

export const metadata = { title: 'Sozlamalar' };

/**
 * Botlar holati (getMe + getWebhookInfo, har bot uchun 2 so'rov): har sahifa yuklanishida Telegram'ga bormasin —
 * 60 s kesh, 5 s dan uzoq kutilmaydi (Telegram yetib bo'lmasa sahifa osilmaydi), «Holatni yangilash» (?tg=status) keshni chetlab o'tadi.
 */
const STATUS_TTL_MS = 60_000;
const STATUS_TIMEOUT_MS = 5_000;
let statusCache: { at: number; statuses: BotStatus[] } | null = null;

async function loadBotStatuses(force: boolean): Promise<{ statuses: BotStatus[]; error: string | null; at: number | null }> {
  if (!force && statusCache && statusCache.at > Date.now() - STATUS_TTL_MS) return { statuses: statusCache.statuses, error: null, at: statusCache.at };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const statuses = await Promise.race([
      botStatuses(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Telegram ${STATUS_TIMEOUT_MS / 1000} s ichida javob bermadi`)), STATUS_TIMEOUT_MS); }),
    ]);
    statusCache = { at: Date.now(), statuses };
    return { statuses, error: null, at: statusCache.at };
  } catch (e) {
    // Xato bo'lsa eski kesh (bo'lsa) ko'rsatiladi
    return { statuses: statusCache?.statuses ?? [], error: e instanceof Error ? e.message : String(e), at: statusCache?.at ?? null };
  } finally {
    clearTimeout(timer);
  }
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; tg?: string }> }) {
  await requireStaff('settings');
  const s = await getSettings();
  const sp = await searchParams;
  const integrations = [
    { name: 'Payme', ok: paymeConfigured(), env: 'PAYME_MERCHANT_ID, PAYME_SECRET_KEY' },
    { name: 'Click', ok: clickConfigured(), env: 'CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY' },
    { name: 'Telegram xabarlar', ok: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_ADMIN_CHAT_ID, env: 'TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID' },
    ...BOT_KINDS.map((k) => ({ name: botMeta[k].title, ok: !!botToken(k), env: botMeta[k].envKey })),
  ];
  // Botlar holati: faqat kamida bitta token sozlangan bo'lsa Telegram'ga so'rov yuboriladi (keshli, vaqt chegarasi bilan); xato sahifani yiqitmaydi
  const tg = sp.tg;
  const anyBot = BOT_KINDS.some((k) => !!botToken(k));
  const forceStatus = tg === 'status' || tg === 'ok' || tg === 'removed';
  const live = anyBot ? await loadBotStatuses(forceStatus) : { statuses: [], error: null, at: null };
  const statusError = live.error;
  // Holat olinmagan bo'lsa ham jadval statik ustunlar bilan ko'rinadi
  const statuses: BotStatus[] = live.statuses.length ? live.statuses : BOT_KINDS.map((k) => ({ kind: k, title: botMeta[k].title, description: botMeta[k].description, envKey: botMeta[k].envKey, configured: !!botToken(k) }));
  const statusAge = live.at ? Math.max(0, Math.round((Date.now() - live.at) / 1000)) : null;
  const webhookSecretOk = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim().length >= 16;
  return (
    <>
      <PageHeader title="Sozlamalar" />
      <Notice show={sp.saved === '1'}>Saqlandi. Saytda bir necha daqiqada yangilanadi.</Notice>
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
          <Field label="Direktor" hint="Shartnoma va hisob-fakturada imzo"><input name="directorName" defaultValue={s.directorName} className="input" /></Field>
          <Field label="Bank rekvizitlari"><textarea name="bankDetails" defaultValue={s.bankDetails} rows={3} className="input" /></Field>
        </section>
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Aloqa</h2>
          <Field label="Asosiy telefon"><input name="phone" defaultValue={displayPhone(s.phone)} className="input" /></Field>
          <Field label="Qo'shimcha telefon"><input name="phone2" defaultValue={s.phone2 ? displayPhone(s.phone2) : ''} className="input" /></Field>
          <Field label="Email"><input name="email" type="email" defaultValue={s.email} className="input" /></Field>
          <Field label="Telegram bot (mijozlar uchun)" hint="Saytdagi Telegram tugmasi shu botga olib boradi"><input name="telegramBot" defaultValue={s.telegramBot} placeholder="Pack24AI_bot" className="input" /></Field>
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
          <h2 className="font-semibold sm:col-span-2">B2B hujjatlar va ombor</h2>
          <Field label="QQS foizi, %" hint="Narxlar QQS bilan; hisob-fakturada QQS summadan ajratib ko'rsatiladi"><input name="vatPercent" type="number" min={0} max={30} step="0.1" defaultValue={s.vatPercent} className="input" /></Field>
          <Field label="Kam qoldiq chegarasi, dona" hint="Omborda shundan kam qolsa ogohlantirish"><input name="lowStockThreshold" type="number" min={0} defaultValue={s.lowStockThreshold} className="input" /></Field>
          <Field label="Shartnoma matni (Markdown)" wide hint="O'rinbosarlar: {{contractNo}}, {{date}}, {{sellerName}}, {{sellerInn}}, {{sellerDirector}}, {{sellerAddress}}, {{sellerBank}}, {{company}}, {{inn}}, {{director}}, {{address}}, {{phone}}, {{bankName}}, {{mfo}}, {{bankAccount}}, {{creditLimit}}, {{paymentTermDays}}, {{vatPercent}}, {{endDate}}. Bo'sh qoldirilsa standart matn ishlatiladi.">
            <textarea name="contractText" rows={12} defaultValue={s.contractText || DEFAULT_CONTRACT_TEXT} className="input font-mono text-xs" />
          </Field>
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

      <section id="telegram" className="card mt-8 p-5">
        <h2 className="mb-1 font-semibold">Telegram botlar</h2>
        <p className="mb-3 text-sm text-slate-500">
          Tokenlar faqat serverdagi <code className="font-mono">.env</code> faylida: {BOT_KINDS.map((k) => <span key={k}><code className="font-mono">{botMeta[k].envKey}</code> ({botMeta[k].title.toLowerCase()}), </span>)}<code className="font-mono">TELEGRAM_WEBHOOK_SECRET</code> (kamida 16 belgi).
          Webhook manzili <code className="font-mono">APP_URL/api/telegram/&lt;bot&gt;</code> — faqat https. Token o'zgarganda «Webhook'larni o'rnatish»ni qayta bosing.
        </p>
        <Notice show={tg === 'ok'}>Webhook'lar va bot buyruqlari o'rnatildi.</Notice>
        <Notice show={tg === 'removed'}>Webhook'lar o'chirildi — botlar xabar qabul qilmaydi.</Notice>
        <Notice show={!!tg && tg !== 'ok' && tg !== 'removed' && tg !== 'status'} tone="warn">Webhook xatosi: {tg}</Notice>
        <Notice show={anyBot && !webhookSecretOk} tone="warn">TELEGRAM_WEBHOOK_SECRET sozlanmagan yoki 16 belgidan qisqa — webhook'lar ishlamaydi.</Notice>
        <Notice show={!!statusError} tone="warn">Holatni olib bo'lmadi: {statusError}{live.at ? ' — oxirgi muvaffaqiyatli holat ko\'rsatilmoqda' : ''}</Notice>
        {!anyBot ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Hech bir bot tokeni sozlanmagan. .env ga tokenlarni yozib, serverni qayta ishga tushiring.</p>
        ) : (
          <Table head={['Bot', 'env kaliti', 'Sozlangan', 'Username', 'Webhook', 'Kutilayotgan', 'Oxirgi xato']} empty={!statuses.length}>
            {statuses.map((b) => (
              <tr key={b.kind} className="hover:bg-slate-50">
                <td className="px-4 py-3"><span className="font-medium">{b.title}</span><span className="block text-xs text-slate-500">{b.description}</span></td>
                <td className="px-4 py-3 font-mono text-xs">{b.envKey}</td>
                <td className="px-4 py-3">{!b.configured ? <Badge tone="amber">Sozlanmagan</Badge> : b.error ? <Badge tone="red">Xato</Badge> : live.at ? <Badge tone="green">Ulangan</Badge> : <Badge tone="slate">Token bor</Badge>}</td>
                <td className="px-4 py-3">{b.username ? <a href={`https://t.me/${b.username}`} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">@{b.username}</a> : '—'}</td>
                <td className="max-w-xs break-all px-4 py-3 text-xs">{b.error ? <span className="text-red-600">{b.error}</span> : b.webhookUrl ? b.webhookUrl : !b.configured || !live.at ? '—' : <span className="text-amber-700">o'rnatilmagan</span>}</td>
                <td className="px-4 py-3 text-center">{b.pending ?? '—'}</td>
                <td className="max-w-xs px-4 py-3 text-xs text-red-600">{b.lastError ?? <span className="text-slate-400">—</span>}</td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <form action={setupTelegramWebhooks}><button className="btn-primary px-4 py-2 text-sm" disabled={!anyBot}>Webhook'larni o'rnatish</button></form>
          <form action={removeTelegramWebhooks}><button className="btn-ghost px-4 py-2 text-sm" disabled={!anyBot}>Webhook'larni o'chirish</button></form>
          {anyBot && <Link href="/admin/settings?tg=status#telegram" className="btn-ghost px-4 py-2 text-sm">Holatni yangilash</Link>}
          {anyBot && <span className="text-xs text-slate-400">{statusAge == null ? 'Holat olinmagan' : statusAge < 5 ? 'Holat hozir olindi' : `Holat ${statusAge} s oldin olingan`} · kesh {STATUS_TTL_MS / 1000} s</span>}
        </div>
      </section>
    </>
  );
}
