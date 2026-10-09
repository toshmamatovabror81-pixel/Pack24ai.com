import 'server-only';
import { deleteWebhook, getMe, getWebhookInfo, setMyCommands, setWebhook } from './api';
import { BOT_KINDS, botMeta, botToken, webhookPath, type BotKind } from './bots';
import { webhookSecret } from './security';
import { siteUrl } from '@/lib/site';

export type BotStatus = {
  kind: BotKind;
  title: string;
  description: string;
  envKey: string;
  configured: boolean;
  username?: string;
  webhookUrl?: string;
  pending?: number;
  lastError?: string;
  error?: string;
};

const meCache = new Map<BotKind, { username: string; at: number }>();
let statusCache: { at: number; value: BotStatus[] } | null = null;

/** Admin Sozlamalar sahifasi uchun botlar holati (getMe + getWebhookInfo). Natija 60 s keshlanadi; Telegram javob bermasa 8 s dan keyin xato bilan qaytadi. */
export async function botStatuses(force = false): Promise<BotStatus[]> {
  if (!force && statusCache && statusCache.at > Date.now() - 60_000) return statusCache.value;
  const value = await Promise.race([
    statusesUncached(),
    new Promise<BotStatus[]>((resolve) => setTimeout(() => resolve(BOT_KINDS.map((kind) => ({ kind, title: botMeta[kind].title, description: botMeta[kind].description, envKey: botMeta[kind].envKey, configured: !!botToken(kind), error: 'Telegram javob bermadi (8 s)' }))), 8_000)),
  ]);
  statusCache = { at: Date.now(), value };
  return value;
}

async function statusesUncached(): Promise<BotStatus[]> {
  return Promise.all(
    BOT_KINDS.map(async (kind): Promise<BotStatus> => {
      const m = botMeta[kind];
      const base = { kind, title: m.title, description: m.description, envKey: m.envKey };
      const token = botToken(kind);
      if (!token) return { ...base, configured: false };
      try {
        const cached = meCache.get(kind);
        const username = cached && cached.at > Date.now() - 10 * 60_000 ? cached.username : (await getMe(token)).username ?? '';
        meCache.set(kind, { username, at: Date.now() });
        const wh = await getWebhookInfo(token);
        return { ...base, configured: true, username, webhookUrl: wh.url, pending: wh.pending_update_count, lastError: wh.last_error_message };
      } catch (e) {
        return { ...base, configured: true, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}

/** Barcha sozlangan botlarga webhook va buyruqlar ro'yxatini o'rnatish */
export async function setupWebhooks(baseUrl = siteUrl()): Promise<{ kind: BotKind; ok: boolean; url?: string; error?: string }[]> {
  const secret = webhookSecret();
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET .env da kamida 16 belgi bo\'lishi kerak');
  if (!/^https:\/\//.test(baseUrl)) throw new Error('Webhook faqat https manzilga o\'rnatiladi (APP_URL)');
  const out: { kind: BotKind; ok: boolean; url?: string; error?: string }[] = [];
  for (const kind of BOT_KINDS) {
    const token = botToken(kind);
    if (!token) continue;
    const url = `${baseUrl.replace(/\/$/, '')}${webhookPath(kind)}`;
    try {
      statusCache = null;
      await setWebhook(token, url, secret);
      await setMyCommands(token, botMeta[kind].commands).catch(() => undefined);
      out.push({ kind, ok: true, url });
    } catch (e) {
      out.push({ kind, ok: false, url, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

export async function removeWebhooks(): Promise<void> {
  statusCache = null;
  for (const kind of BOT_KINDS) {
    const token = botToken(kind);
    if (token) await deleteWebhook(token).catch(() => undefined);
  }
}
