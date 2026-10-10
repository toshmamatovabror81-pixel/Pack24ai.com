import 'server-only';
import { hqAdminByTelegram, supervisorByTelegram } from '@/lib/recycling/staff';
import type { TgUpdate } from './api';
import { hqAllowedIds, type BotKind } from './bots';
import { bot as customerBot } from './bots/customer';
import { bot as driverBot } from './bots/driver';
import { bot as supervisorBot } from './bots/supervisor';
import { bot as hqBot } from './bots/hq';
import type { Bot } from './router';
import { getSession, setSession } from './session';

/** Webhook -> tegishli bot. Har bir bot modul `export const bot = createBot(kind)` beradi. */
export function dispatchUpdate(kind: BotKind, update: TgUpdate): Promise<void> {
  switch (kind) {
    case 'customer': return customerBot.handle(update);
    case 'driver': return driverBot.handle(update);
    case 'supervisor': return dispatchManagement(update);
    case 'hq': return hqBot.handle(update);
  }
}

type Mode = 'supervisor' | 'hq';
const SWITCH: Record<string, Mode> = { hq: 'hq', masul: 'supervisor' };

/**
 * Boshqaruv boti: masul va rahbariyat (HQ) bitta Telegram botda. Kim yozganiga qarab rol tanlanadi:
 * faqat masul -> masul menyusi, faqat rahbariyat -> rahbariyat menyusi, ikkalasi ham -> oxirgi tanlangan rejim
 * (/hq, /masul; standart — rahbariyat). Ro'yxatdan o'tmagan foydalanuvchi masul oqimiga tushadi; u rahbariyat
 * kodini yuborsa, supervisorFlow HQ sessiyasini ochadi va keyingi kontakt shu yerdan HQ oqimiga beriladi.
 */
async function dispatchManagement(update: TgUpdate): Promise<void> {
  const cb = update.callback_query;
  const msg = update.message ?? update.edited_message;
  const from = cb?.from ?? msg?.from;
  if (!from || from.is_bot) return;
  const [sup, hqAdmin] = await Promise.all([supervisorByTelegram(from.id), hqAdminByTelegram(from.id)]);
  const isHq = !!hqAdmin || hqAllowedIds().includes(String(from.id));
  const pick = (m: Mode): Bot => (m === 'hq' ? hqBot : supervisorBot);

  if (!sup && !isHq) {
    const s = await getSession<{ step?: string }>('hq', from.id);
    return pick(s?.step === 'reg_contact' ? 'hq' : 'supervisor').handle(update);
  }
  if (!sup || !isHq) return pick(isHq ? 'hq' : 'supervisor').handle(update);

  // Ikkala rol: /hq va /masul rejimni almashtiradi va o'sha rol menyusini ochadi
  const text = (msg?.text ?? '').trim();
  const cmd = text.startsWith('/') ? text.slice(1).split(/[\s@]/)[0].toLowerCase() : '';
  if (msg && SWITCH[cmd]) {
    await setSession('shmode', from.id, { mode: SWITCH[cmd] });
    return pick(SWITCH[cmd]).handle({ update_id: update.update_id, message: { ...msg, text: '/start' } });
  }
  const saved = await getSession<{ mode?: Mode }>('shmode', from.id);
  const mode: Mode = saved?.mode === 'supervisor' ? 'supervisor' : 'hq';
  // Xabarnoma tugmasi (masalan assign_ — masulga, acc_ok_ — rahbariyatga) joriy rejimda bo'lmasa, uni taniydigan rolga beriladi
  if (cb?.data && !pick(mode).handlesCallback(cb.data)) {
    const other: Mode = mode === 'hq' ? 'supervisor' : 'hq';
    if (pick(other).handlesCallback(cb.data)) return pick(other).handle(update);
  }
  return pick(mode).handle(update);
}
