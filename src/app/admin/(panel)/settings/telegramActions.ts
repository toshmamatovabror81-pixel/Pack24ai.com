'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { BOT_KINDS, botMeta } from '@/lib/telegram/bots';
import { removeWebhooks, setupWebhooks } from '@/lib/telegram/setup';

/** Sozlamalar: botlar uchun webhook o'rnatish / o'chirish. Natija ?tg=ok | ?tg=removed | ?tg=<xato matni> */

const BASE = '/admin/settings';
const back = (tg: string) => `${BASE}?tg=${encodeURIComponent(tg)}#telegram`;

export async function setupTelegramWebhooks() {
  await requireStaff('settings');
  let to = back('ok');
  try {
    const res = await setupWebhooks();
    if (!res.length) to = back(`Hech bir bot tokeni sozlanmagan (.env: ${BOT_KINDS.map((k) => botMeta[k].envKey).join(', ')})`);
    const failed = res.filter((r) => !r.ok);
    if (failed.length) to = back(failed.map((f) => `${botMeta[f.kind].title}: ${f.error ?? 'xato'}`).join(' · '));
  } catch (e) {
    to = back(e instanceof Error ? e.message : String(e));
  }
  revalidatePath(BASE);
  redirect(to);
}

export async function removeTelegramWebhooks() {
  await requireStaff('settings');
  let to = back('removed');
  try {
    await removeWebhooks();
  } catch (e) {
    to = back(e instanceof Error ? e.message : String(e));
  }
  revalidatePath(BASE);
  redirect(to);
}
