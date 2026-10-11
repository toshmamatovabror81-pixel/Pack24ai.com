import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { tashkentClock } from '@/lib/tashkent';
import { prisma } from '@/lib/db';

/**
 * Anthropic Claude ulanishi. Kalit faqat serverdagi .env da (ANTHROPIC_API_KEY, deploy/ai-setup.sh yozadi); kalit bo'lmasa
 * AI bo'limlari jim o'chadi — botlar va tekshiruv AI'siz ishlayveradi. Model ANTHROPIC_MODEL bilan almashtiriladi.
 */

export const AI_DEFAULT_MODEL = 'claude-opus-5-5';
/** Rad etilgan so'rovni server tomonda boshqa modelda qayta bajarish ("default" rejimi) qo'llab-quvvatlanadigan modellar */
const FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

export const aiConfigured = (): boolean => !!(process.env.ANTHROPIC_API_KEY ?? '').trim();
export const aiModel = (): string => (process.env.ANTHROPIC_MODEL ?? '').trim() || AI_DEFAULT_MODEL;

let client: Anthropic | null = null;
/** Bitta mijoz butun jarayon uchun; so'rov 45 s da uziladi, tarmoq xatosida bir marta qayta uriniladi */
export function aiClient(): Anthropic {
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

/** So'rovga qo'shiladigan zaxira sozlamasi: model xavfsizlik sababli rad etsa, API o'zi tavsiya etilgan modelda qayta bajaradi */
export function fallbackParams(model: string): { betas: ['server-side-fallback-2026-07-01']; fallbacks: 'default' } | Record<string, never> {
  return FALLBACK_MODELS.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {};
}

const limit = (name: string, fallback: number) => {
  // Bo'sh qiymat (.env dagi KEY="" satri) "kiritilmagan" degani: Number('') 0 beradi va AI butunlay o'chib qolardi
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};
/** Kuniga jami AI so'rovlari chegarasi (xarajat nazorati) va bitta mijoz uchun chegara */
export const aiDailyLimit = () => limit('AI_DAILY_LIMIT', 300);
export const aiCustomerDailyLimit = () => limit('AI_CUSTOMER_DAILY_LIMIT', 20);
/** Telefonini ulamagan chat (istalgan Telegram foydalanuvchisi) uchun chegara: begonalar umumiy chegarani tugatib qo'ymasin */
export const aiGuestDailyLimit = () => Math.min(3, aiCustomerDailyLimit());

/** Bugungi (Toshkent) AI so'rovlari soni */
export async function aiRequestsToday(now = new Date()): Promise<number> {
  const row = await prisma.aiUsage.findUnique({ where: { day: tashkentClock(now).day }, select: { requests: true } });
  return row?.requests ?? 0;
}

/**
 * Kunlik umumiy chegaradan bitta so'rovni band qilish. So'rov yuborilishidan OLDIN va bitta shartli UPDATE bilan sanaladi:
 * bir vaqtda kelgan savollar chegaradan oshib ketmaydi, javobsiz qolgan (vaqti tugagan, xato bergan) so'rov ham hisobda qoladi —
 * Anthropic uni baribir hisoblaydi. false — bugungi chegara tugagan. `force` — chegaraga qaramay sanaydi (kunlik avtomatik xulosa);
 * `cap` — umumiy chegaradan pastroq shift (telefonini ulamagan chatlar umumiy chegaraning faqat bir qismini ishlata oladi).
 */
export async function reserveAiRequest(now = new Date(), opts: { force?: boolean; cap?: number } = {}): Promise<boolean> {
  const day = tashkentClock(now).day;
  // INSERT ... ON CONFLICT DO NOTHING: kunning birinchi ikki so'rovi bir vaqtda kelsa ham unique xatosi bo'lmaydi
  await prisma.aiUsage.createMany({ data: [{ day }], skipDuplicates: true });
  const max = Math.min(aiDailyLimit(), opts.cap ?? Infinity);
  const taken = await prisma.aiUsage.updateMany({ where: opts.force ? { day } : { day, requests: { lt: max } }, data: { requests: { increment: 1 } } });
  return taken.count === 1;
}

/** Band qilingan so'rovni qaytarish: API so'rovni rad etgani aniq bo'lsa (xato kodi bilan javob) — pul sarflanmagan, chegara ham kamaymasin */
export async function releaseAiRequest(now = new Date()): Promise<void> {
  await prisma.aiUsage.updateMany({ where: { day: tashkentClock(now).day, requests: { gt: 0 } }, data: { requests: { decrement: 1 } } }).catch((e) => console.error('[ai] sarf hisobi', e));
}

/** Token sarfini (va kerak bo'lsa so'rovlar sonini) kunlik hisobga qo'shish; xato AI javobini to'xtatmaydi */
export async function recordAiUsage(usage: { requests?: number; inputTokens?: number; outputTokens?: number }, now = new Date()): Promise<void> {
  const day = tashkentClock(now).day;
  const requests = usage.requests ?? 0;
  const inputTokens = Math.max(0, Math.round(usage.inputTokens ?? 0));
  const outputTokens = Math.max(0, Math.round(usage.outputTokens ?? 0));
  try {
    await prisma.aiUsage.upsert({
      where: { day },
      create: { day, requests, inputTokens, outputTokens },
      update: { requests: { increment: requests }, inputTokens: { increment: inputTokens }, outputTokens: { increment: outputTokens } },
    });
  } catch (e) {
    console.error('[ai] sarf hisobi', e);
  }
}

/** Xato matnida kalit bo'lsa (masalan oraliq server so'rov sarlavhasini qaytarsa) — yashiriladi: javobda ham, logda ham */
export function withoutKeys(text: string): string {
  const key = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  return (key ? text.split(key).join('***') : text).replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-***');
}

/**
 * Kalit va modelni haqiqiy, juda qisqa so'rov bilan sinash (deploy/ai-setup.sh uchun): kalit yaroqsiz, model nomi xato yoki
 * hisobda mablag' yo'q bo'lsa aynan shu yerda ko'rinadi. Xato matni egasi tushunadigan tilda qaytariladi, kalit hech qachon chiqmaydi.
 */
export async function testAi(): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  if (!aiConfigured()) return { ok: false, error: 'ANTHROPIC_API_KEY kiritilmagan' };
  const model = aiModel();
  try {
    const res = await aiClient().messages.create({ model, max_tokens: 512, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 'Reply with the single word OK.' }] }, { timeout: 30_000, maxRetries: 0 });
    await recordAiUsage({ requests: 1, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens });
    return { ok: true, model: res.model };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: 'kalit yaroqsiz (401): console.anthropic.com > API Keys da yangi kalit yarating' };
    if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, error: 'bu kalitga ruxsat berilmagan (403)' };
    if (e instanceof Anthropic.NotFoundError) return { ok: false, error: `model topilmadi: ${model}` };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "so'rovlar chegarasi (429): birozdan keyin qayta urinib ko'ring" };
    if (e instanceof Anthropic.APIConnectionError) return { ok: false, error: "Anthropic serveriga ulanib bo'lmadi (tarmoq yoki vaqt tugadi)" };
    if (e instanceof Anthropic.APIError) {
      // API javobining ichki matni (bo'lsa): butun JSON emas, faqat sababi
      const inner = (e.error as { error?: { type?: string; message?: string } } | undefined)?.error;
      if (e.status === 402 || inner?.type === 'billing_error' || /credit balance/i.test(e.message)) return { ok: false, error: "hisobda mablag' yetarli emas: console.anthropic.com > Billing" };
      return { ok: false, error: `API xatosi ${e.status ?? ''}: ${withoutKeys(inner?.message ?? e.message).slice(0, 200)}` };
    }
    console.error('[ai] sinov', e);
    return { ok: false, error: 'kutilmagan xato (docker compose logs web)' };
  }
}
