import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';

/**
 * AI ulanishi (src/lib/ai/client.ts) testlari bazasiz va tarmoqsiz ishlaydi: prisma soxta, Anthropic SDK esa haqiqiy —
 * faqat uning fetch'i shu fayldagi soxta "API"ga ulangan. Shuning uchun xato sinflarini (401 -> AuthenticationError va h.k.)
 * SDK'ning o'zi yasaydi, api.anthropic.com ga esa hech narsa ketmaydi.
 */
const h = vi.hoisted(() => ({
  prisma: { aiUsage: { findUnique: vi.fn(), upsert: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() } },
  http: vi.fn<(url: string, init: RequestInit) => Promise<Response>>(),
  constructed: [] as unknown[],
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: h.prisma }));
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const real = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  class Offline extends real.default {
    constructor(options: ConstructorParameters<typeof real.default>[0] = {}) {
      h.constructed.push(options);
      super({ ...options, fetch: (url, init) => h.http(String(url), init ?? {}) });
    }
  }
  return { ...real, default: Offline };
});

const { AI_DEFAULT_MODEL, aiClient, aiConfigured, aiCustomerDailyLimit, aiDailyLimit, aiGuestDailyLimit, aiModel, aiRequestsToday, fallbackParams, recordAiUsage, releaseAiRequest, reserveAiRequest, testAi } = await import('@/lib/ai/client');

/** Soxta kalit: haqiqiy kalit kabi sk-ant- bilan boshlanadi, lekin hech qayerda ishlamaydi (gitleaks ruxsat bergan ko'rinishda) */
const KEY = 'sk-ant-ci-dummy-anthropic-secret';
/** Sozlangan kalitdan BOSHQA kalit (masalan eski yoki oraliq server qo'shgan): u ham xato matnida ko'rinmasligi kerak */
const OTHER_KEY = 'sk-ant-ci-dummy-other-secret';
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
/** Toshkent vaqti bilan 10.10.2026, 12:00 */
const NOW = new Date('2026-10-10T07:00:00Z');
const DAY = '2026-10-10';
const BILLING = "hisobda mablag' yetarli emas: console.anthropic.com > Billing";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
const apiError = (status: number, type: string, message: string) => json(status, { type: 'error', error: { type, message } });
const okMessage = (patch: Record<string, unknown> = {}) =>
  json(200, { id: 'msg_01', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: 'OK' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 14, output_tokens: 4 }, ...patch });
/** Har so'rovga yangi Response: tanasi faqat bir marta o'qiladi */
const respond = (make: () => Response) => h.http.mockImplementation(async () => make());
const sent = (i = 0) => {
  const [url, init] = h.http.mock.calls[i];
  return { url, method: init.method, headers: new Headers(init.headers), body: JSON.parse(String(init.body)) as Record<string, unknown> };
};

type UsageWhere = { day: string; requests?: { lt?: number; gt?: number } };
type UsageUpdate = { where: UsageWhere; data: { requests: { increment?: number; decrement?: number } } };
/**
 * AiUsage jadvali o'rnida (kun -> so'rovlar soni). Haqiqiy bazadagi kabi: takror kun faqat skipDuplicates bilan xatosiz o'tadi,
 * shartli UPDATE esa sharti (lt / gt) to'g'ri bo'lgan qatornigina o'zgartiradi va o'zgargan qatorlar sonini qaytaradi.
 */
const usageTable = (initial: Record<string, number> = {}) => {
  const rows = new Map<string, number>(Object.entries(initial));
  h.prisma.aiUsage.createMany.mockImplementation(async ({ data, skipDuplicates }: { data: { day: string }[]; skipDuplicates?: boolean }) => {
    let count = 0;
    for (const { day } of data) {
      if (rows.has(day)) {
        if (!skipDuplicates) throw new Error('Unique constraint failed on the fields: (`day`)');
        continue;
      }
      rows.set(day, 0);
      count += 1;
    }
    return { count };
  });
  h.prisma.aiUsage.updateMany.mockImplementation(async ({ where, data }: UsageUpdate) => {
    const current = rows.get(where.day);
    if (current === undefined) return { count: 0 };
    const { lt, gt } = where.requests ?? {};
    if ((lt !== undefined && !(current < lt)) || (gt !== undefined && !(current > gt))) return { count: 0 };
    rows.set(where.day, current + (data.requests.increment ?? 0) - (data.requests.decrement ?? 0));
    return { count: 1 };
  });
  return rows;
};
const reserveWhere = (i = -1) => (h.prisma.aiUsage.updateMany.mock.calls.at(i)![0] as UsageUpdate).where;

beforeEach(() => {
  h.http.mockReset();
  h.prisma.aiUsage.findUnique.mockReset().mockResolvedValue(null);
  h.prisma.aiUsage.upsert.mockReset().mockResolvedValue({});
  h.prisma.aiUsage.createMany.mockReset().mockResolvedValue({ count: 1 });
  h.prisma.aiUsage.updateMany.mockReset().mockResolvedValue({ count: 1 });
  // Tashqi muhitdagi sozlamalar (masalan ishlab chiquvchi kompyuteridagi ANTHROPIC_BASE_URL) testga ta'sir qilmasin
  for (const name of ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_CUSTOM_HEADERS', 'ANTHROPIC_LOG', 'AI_DAILY_LIMIT', 'AI_CUSTOMER_DAILY_LIMIT']) vi.stubEnv(name, undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('AI ulanishi: kalit va model', () => {
  it("kalit yo'q, bo'sh yoki faqat bo'shliq bo'lsa AI o'chiq; kalit bo'lsa yoqiq", () => {
    expect(aiConfigured()).toBe(false);
    for (const empty of ['', '   ', '\n']) {
      vi.stubEnv('ANTHROPIC_API_KEY', empty);
      expect(aiConfigured(), JSON.stringify(empty)).toBe(false);
    }
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    expect(aiConfigured()).toBe(true);
  });

  it("model: standart claude-opus-5-5; ANTHROPIC_MODEL bo'lsa o'sha (chetidagi bo'shliqlarsiz); bo'sh qiymat — standart", () => {
    expect(AI_DEFAULT_MODEL).toBe('claude-opus-5-5');
    expect(aiModel()).toBe('claude-opus-5-5');
    vi.stubEnv('ANTHROPIC_MODEL', '  claude-haiku-5-5 \n');
    expect(aiModel()).toBe('claude-haiku-5-5');
    // .env.example dagi bo'sh satr (ANTHROPIC_MODEL="") standartni buzmaydi
    for (const empty of ['', '   ']) {
      vi.stubEnv('ANTHROPIC_MODEL', empty);
      expect(aiModel(), JSON.stringify(empty)).toBe('claude-opus-5-5');
    }
  });

  it("bitta mijoz butun jarayon uchun: 45 s vaqt chegarasi va ko'pi bilan bitta qayta urinish", () => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    const first = aiClient();
    expect(aiClient()).toBe(first);
    expect(aiClient()).toBe(first);
    expect(h.constructed).toHaveLength(1);
    expect(h.constructed[0]).toMatchObject({ timeout: 45_000, maxRetries: 1 });
    // Kalit kodda yozilmaydi — SDK uni muhitdan o'zi oladi
    expect(JSON.stringify(h.constructed[0])).not.toContain('sk-ant');
  });
});

describe('AI ulanishi: kunlik chegaralar', () => {
  const both = (value: string | undefined) => {
    vi.stubEnv('AI_DAILY_LIMIT', value);
    vi.stubEnv('AI_CUSTOMER_DAILY_LIMIT', value);
    return [aiDailyLimit(), aiCustomerDailyLimit()];
  };

  it("sozlanmagan bo'lsa: kuniga jami 300 ta, bitta mijozga 20 ta so'rov", () => {
    expect(both(undefined)).toEqual([300, 20]);
  });

  it("to'g'ri son o'z holicha olinadi; kasr son pastga yaxlitlanadi; har biri o'z o'zgaruvchisidan o'qiladi", () => {
    expect(both('50')).toEqual([50, 50]);
    expect(both(' 7 ')).toEqual([7, 7]);
    expect(both('12.9')).toEqual([12, 12]);
    vi.stubEnv('AI_DAILY_LIMIT', '1000');
    vi.stubEnv('AI_CUSTOMER_DAILY_LIMIT', '3');
    expect([aiDailyLimit(), aiCustomerDailyLimit()]).toEqual([1000, 3]);
  });

  it("0 — haqiqiy chegara (AI'ni kalitni o'chirmasdan to'xtatish), standartga aylanmaydi", () => {
    for (const zero of ['0', ' 0 ', '0.0', '0.9']) expect(both(zero), JSON.stringify(zero)).toEqual([0, 0]);
  });

  it("manfiy son yoki son bo'lmagan qiymat: standart chegara", () => {
    for (const bad of ['-5', '-0.5', 'abc', '10ta', 'NaN', 'Infinity', '-Infinity']) expect(both(bad), bad).toEqual([300, 20]);
  });

  // .env.example dan ko'chirilgan AI_DAILY_LIMIT="" satri: Number('') === 0 bo'lgani uchun ilgari chegara 0 bo'lib, AI butunlay o'chib qolardi
  it("bo'sh qiymat (AI_DAILY_LIMIT=\"\" yoki faqat bo'shliq) sozlanmagan hisoblanadi: standart 300 / 20", () => {
    for (const empty of ['', ' ', '   ', '\t', '\n', ' \r\n ']) expect(both(empty), JSON.stringify(empty)).toEqual([300, 20]);
    // Bittasi bo'sh, ikkinchisi kiritilgan: har biri alohida hal qilinadi
    vi.stubEnv('AI_DAILY_LIMIT', '');
    vi.stubEnv('AI_CUSTOMER_DAILY_LIMIT', '5');
    expect([aiDailyLimit(), aiCustomerDailyLimit()]).toEqual([300, 5]);
    vi.stubEnv('AI_DAILY_LIMIT', '40');
    vi.stubEnv('AI_CUSTOMER_DAILY_LIMIT', '  ');
    expect([aiDailyLimit(), aiCustomerDailyLimit()]).toEqual([40, 20]);
  });

  it("telefonini ulamagan chat chegarasi: ko'pi bilan 3, mijoz chegarasi undan past bo'lsa — o'sha", () => {
    const guest = (customer: string | undefined) => {
      vi.stubEnv('AI_CUSTOMER_DAILY_LIMIT', customer);
      return aiGuestDailyLimit();
    };
    expect(guest(undefined)).toBe(3);
    expect(guest('')).toBe(3);
    expect(guest('50')).toBe(3);
    expect(guest('3')).toBe(3);
    expect(guest('2')).toBe(2);
    expect(guest('1')).toBe(1);
    // Mijozlar uchun AI to'xtatilgan bo'lsa, begonalarga ham javob berilmaydi
    expect(guest('0')).toBe(0);
    expect(guest('abc')).toBe(3);
    // Umumiy chegara bunga ta'sir qilmaydi (u reserveAiRequest dagi cap orqali cheklanadi)
    vi.stubEnv('AI_DAILY_LIMIT', '1');
    expect(guest(undefined)).toBe(3);
  });
});

describe('AI ulanishi: zaxira model sozlamasi', () => {
  it("server tomonda qayta bajarishni qo'llaydigan modellar uchun beta sarlavha va fallbacks birga qaytadi", () => {
    for (const model of ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-opus-5', 'claude-fable-5-1']) expect(fallbackParams(model), model).toEqual(FALLBACK);
    // Standart model ham shular ichida: sozlanmagan o'rnatishda zaxira yoqiq bo'ladi
    expect(fallbackParams(aiModel())).toEqual(FALLBACK);
  });

  it("qo'llamaydigan yoki notanish model uchun hech narsa qo'shilmaydi (aks holda API so'rovni rad etadi)", () => {
    for (const model of ['claude-haiku-5-5', 'claude-opus-4-1', 'gpt-x', '', 'CLAUDE-OPUS-5-5', 'claude-opus-5-5 ']) {
      expect(fallbackParams(model), JSON.stringify(model)).toEqual({});
      expect(Object.keys({ model, ...fallbackParams(model) })).toEqual(['model']);
    }
  });
});

describe('AI ulanishi: kunlik chegaradan joy band qilish (reserveAiRequest)', () => {
  it("kun qatori takrorga chidamli yaratiladi, keyin BITTA shartli UPDATE: so'rovlar chegaradan kam bo'lsagina +1", async () => {
    expect(await reserveAiRequest(NOW)).toBe(true);
    expect(h.prisma.aiUsage.createMany.mock.calls).toEqual([[{ data: [{ day: DAY }], skipDuplicates: true }]]);
    expect(h.prisma.aiUsage.updateMany.mock.calls).toEqual([[{ where: { day: DAY, requests: { lt: 300 } }, data: { requests: { increment: 1 } } }]]);
    // Avval qator, keyin sanash: kunning birinchi so'rovi ham sanaladi
    expect(h.prisma.aiUsage.createMany.mock.invocationCallOrder[0]).toBeLessThan(h.prisma.aiUsage.updateMany.mock.invocationCallOrder[0]);
    // "O'qib, keyin yozish" yo'q — aks holda bir vaqtda kelgan ikki savol bitta joyni ikki marta olardi
    expect(h.prisma.aiUsage.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.aiUsage.upsert).not.toHaveBeenCalled();
  });

  it("UPDATE hech qatorni o'zgartirmasa (chegara tugagan): false", async () => {
    h.prisma.aiUsage.updateMany.mockResolvedValue({ count: 0 });
    expect(await reserveAiRequest(NOW)).toBe(false);
    expect(h.prisma.aiUsage.updateMany).toHaveBeenCalledTimes(1);
  });

  it("shart AI_DAILY_LIMIT dan olinadi; cap undan past bo'lsa — cap, baland bo'lsa — baribir umumiy chegara", async () => {
    const whereFor = async (opts: { cap?: number }, daily?: string) => {
      vi.stubEnv('AI_DAILY_LIMIT', daily);
      await reserveAiRequest(NOW, opts);
      return reserveWhere();
    };
    expect(await whereFor({}, '50')).toEqual({ day: DAY, requests: { lt: 50 } });
    expect(await whereFor({ cap: 150 })).toEqual({ day: DAY, requests: { lt: 150 } });
    expect(await whereFor({ cap: 500 })).toEqual({ day: DAY, requests: { lt: 300 } });
    expect(await whereFor({ cap: 300 })).toEqual({ day: DAY, requests: { lt: 300 } });
    expect(await whereFor({ cap: 3 }, '7')).toEqual({ day: DAY, requests: { lt: 3 } });
    expect(await whereFor({ cap: 0 })).toEqual({ day: DAY, requests: { lt: 0 } });
    expect(await whereFor({}, '0')).toEqual({ day: DAY, requests: { lt: 0 } });
    // Bo'sh qiymat chegarani 0 qilib qo'ymaydi
    expect(await whereFor({}, '')).toEqual({ day: DAY, requests: { lt: 300 } });
    // Har bir band qilish — aynan bitta UPDATE
    expect(h.prisma.aiUsage.updateMany).toHaveBeenCalledTimes(8);
    for (const [args] of h.prisma.aiUsage.updateMany.mock.calls) expect((args as UsageUpdate).data).toEqual({ requests: { increment: 1 } });
  });

  it("force (kunlik avtomatik xulosa): shartsiz sanaladi — chegara ham, cap ham qaralmaydi", async () => {
    vi.stubEnv('AI_DAILY_LIMIT', '0');
    expect(await reserveAiRequest(NOW, { force: true })).toBe(true);
    expect(await reserveAiRequest(NOW, { force: true, cap: 0 })).toBe(true);
    expect(h.prisma.aiUsage.updateMany.mock.calls).toEqual([
      [{ where: { day: DAY }, data: { requests: { increment: 1 } } }],
      [{ where: { day: DAY }, data: { requests: { increment: 1 } } }],
    ]);
    // Qator baribir avval yaratiladi (kunning birinchi so'rovi tekshiruv bo'lishi mumkin)
    expect(h.prisma.aiUsage.createMany).toHaveBeenCalledTimes(2);
    // force: false — oddiy shartli yo'l
    vi.stubEnv('AI_DAILY_LIMIT', undefined);
    await reserveAiRequest(NOW, { force: false });
    expect(reserveWhere()).toEqual({ day: DAY, requests: { lt: 300 } });
  });

  it("kun Toshkent vaqti bilan: UTC 19:00 dan boshlab ertangi kun qatori", async () => {
    await reserveAiRequest(new Date('2026-10-10T18:59:59Z'));
    expect(h.prisma.aiUsage.createMany.mock.calls.at(-1)![0]).toEqual({ data: [{ day: '2026-10-10' }], skipDuplicates: true });
    expect(reserveWhere().day).toBe('2026-10-10');
    await reserveAiRequest(new Date('2026-10-10T19:00:00Z'));
    expect(h.prisma.aiUsage.createMany.mock.calls.at(-1)![0]).toEqual({ data: [{ day: '2026-10-11' }], skipDuplicates: true });
    expect(reserveWhere().day).toBe('2026-10-11');
  });

  it("chegara 3: uchta joy beriladi, to'rtinchisi rad etiladi va hisob chegaradan oshmaydi", async () => {
    vi.stubEnv('AI_DAILY_LIMIT', '3');
    const rows = usageTable();
    expect([await reserveAiRequest(NOW), await reserveAiRequest(NOW), await reserveAiRequest(NOW)]).toEqual([true, true, true]);
    expect([await reserveAiRequest(NOW), await reserveAiRequest(NOW)]).toEqual([false, false]);
    expect(rows.get(DAY)).toBe(3);
    // Ertangi kun — alohida qator, sanoq noldan
    expect(await reserveAiRequest(new Date('2026-10-10T19:00:00Z'))).toBe(true);
    expect(Object.fromEntries(rows)).toEqual({ [DAY]: 3, '2026-10-11': 1 });
  });

  it("bir vaqtda kelgan so'rovlar: chegaradan ortiq joy berilmaydi", async () => {
    vi.stubEnv('AI_DAILY_LIMIT', '4');
    const rows = usageTable({ [DAY]: 1 });
    const granted = await Promise.all(Array.from({ length: 12 }, () => reserveAiRequest(NOW)));
    expect(granted.filter(Boolean)).toHaveLength(3);
    expect(rows.get(DAY)).toBe(4);
  });

  it("chegara 0: hech qachon joy berilmaydi (qator bo'lmasa ham, bo'lsa ham); faqat force o'tadi", async () => {
    vi.stubEnv('AI_DAILY_LIMIT', '0');
    const rows = usageTable();
    expect([await reserveAiRequest(NOW), await reserveAiRequest(NOW), await reserveAiRequest(NOW, { cap: 100 })]).toEqual([false, false, false]);
    expect(rows.get(DAY)).toBe(0);
    expect(await reserveAiRequest(NOW, { force: true })).toBe(true);
    expect(rows.get(DAY)).toBe(1);
    expect(await reserveAiRequest(NOW)).toBe(false);
  });

  it("cap: telefonsiz chatlar umumiy hisob shiftga yetguncha joy oladi, qolgani mijozlarga qoladi", async () => {
    vi.stubEnv('AI_DAILY_LIMIT', '6');
    const rows = usageTable();
    const guest = () => reserveAiRequest(NOW, { cap: 3 });
    expect([await guest(), await guest(), await guest(), await guest()]).toEqual([true, true, true, false]);
    expect(rows.get(DAY)).toBe(3);
    // Mijozlar (cap yo'q) umumiy chegaragacha davom etadi
    expect([await reserveAiRequest(NOW), await reserveAiRequest(NOW), await reserveAiRequest(NOW), await reserveAiRequest(NOW)]).toEqual([true, true, true, false]);
    expect(rows.get(DAY)).toBe(6);
    expect(await guest()).toBe(false);
  });

  it("force chegara tugaganda ham sanaydi; shundan keyin oddiy so'rov baribir rad etiladi", async () => {
    vi.stubEnv('AI_DAILY_LIMIT', '2');
    const rows = usageTable({ [DAY]: 2 });
    expect(await reserveAiRequest(NOW)).toBe(false);
    expect(await reserveAiRequest(NOW, { force: true })).toBe(true);
    expect(rows.get(DAY)).toBe(3);
    expect(await reserveAiRequest(NOW)).toBe(false);
    expect(rows.get(DAY)).toBe(3);
  });

  it("baza xatosi yashirilmaydi: joy berilgan deb hisoblanmaydi (chaqiruvchi so'rov yubormaydi)", async () => {
    h.prisma.aiUsage.createMany.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    await expect(reserveAiRequest(NOW)).rejects.toThrow('ECONNREFUSED');
    expect(h.prisma.aiUsage.updateMany).not.toHaveBeenCalled();
    h.prisma.aiUsage.updateMany.mockRejectedValueOnce(new Error('deadlock detected'));
    await expect(reserveAiRequest(NOW)).rejects.toThrow('deadlock');
  });
});

describe("AI ulanishi: band qilingan joyni qaytarish (releaseAiRequest)", () => {
  it("bitta shartli UPDATE: so'rovlar 0 dan katta bo'lsagina -1; qator yaratilmaydi", async () => {
    await expect(releaseAiRequest(NOW)).resolves.toBeUndefined();
    expect(h.prisma.aiUsage.updateMany.mock.calls).toEqual([[{ where: { day: DAY, requests: { gt: 0 } }, data: { requests: { decrement: 1 } } }]]);
    expect(h.prisma.aiUsage.createMany).not.toHaveBeenCalled();
    expect(h.prisma.aiUsage.upsert).not.toHaveBeenCalled();
    // Kun — Toshkent vaqti bilan
    await releaseAiRequest(new Date('2026-10-10T19:00:00Z'));
    expect(reserveWhere()).toEqual({ day: '2026-10-11', requests: { gt: 0 } });
  });

  it("band qilingan joy qaytadi va keyingi so'rovga beriladi; hisob noldan pastga tushmaydi", async () => {
    vi.stubEnv('AI_DAILY_LIMIT', '2');
    const rows = usageTable();
    expect([await reserveAiRequest(NOW), await reserveAiRequest(NOW), await reserveAiRequest(NOW)]).toEqual([true, true, false]);
    await releaseAiRequest(NOW);
    expect(rows.get(DAY)).toBe(1);
    expect([await reserveAiRequest(NOW), await reserveAiRequest(NOW)]).toEqual([true, false]);
    // Ortiqcha qaytarishlar (masalan ikki marta chaqirilgan) hisobni manfiy qilmaydi
    for (let i = 0; i < 5; i += 1) await releaseAiRequest(NOW);
    expect(rows.get(DAY)).toBe(0);
    // Qatori yo'q kun: hech narsa yaratilmaydi
    await releaseAiRequest(new Date('2026-10-12T07:00:00Z'));
    expect(rows.has('2026-10-12')).toBe(false);
    // Manfiy hisob bo'lmagani uchun chegara ham kengaymaydi
    expect([await reserveAiRequest(NOW), await reserveAiRequest(NOW), await reserveAiRequest(NOW)]).toEqual([true, true, false]);
  });

  it("baza xatosi tashqariga chiqmaydi (javob yo'li to'xtamaydi), lekin logga yoziladi", async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.prisma.aiUsage.updateMany.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    await expect(releaseAiRequest(NOW)).resolves.toBeUndefined();
    await expect(releaseAiRequest()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe('AI ulanishi: sarf hisobi', () => {
  it("so'rov va tokenlar Toshkent kuni bo'yicha bitta qatorga qo'shiladi", async () => {
    // 10.10.2026, 23:59:59 (Toshkent) — hali o'sha kun
    await recordAiUsage({ requests: 1, inputTokens: 1200, outputTokens: 300 }, new Date('2026-10-10T18:59:59Z'));
    expect(h.prisma.aiUsage.upsert).toHaveBeenCalledTimes(1);
    expect(h.prisma.aiUsage.upsert).toHaveBeenLastCalledWith({
      where: { day: '2026-10-10' },
      create: { day: '2026-10-10', requests: 1, inputTokens: 1200, outputTokens: 300 },
      update: { requests: { increment: 1 }, inputTokens: { increment: 1200 }, outputTokens: { increment: 300 } },
    });
    // UTC bo'yicha hali 10-oktabr, Toshkentda esa 11-oktabr 00:00 — yangi kun qatori
    await recordAiUsage({ requests: 1, inputTokens: 5, outputTokens: 5 }, new Date('2026-10-10T19:00:00Z'));
    expect(h.prisma.aiUsage.upsert.mock.calls[1][0]).toMatchObject({ where: { day: '2026-10-11' }, create: { day: '2026-10-11' } });
  });

  it("berilmagan maydon 0; kasr token yaxlitlanadi; manfiy token hisobni kamaytirmaydi", async () => {
    await recordAiUsage({ inputTokens: 10.6, outputTokens: -50 }, NOW);
    expect(h.prisma.aiUsage.upsert).toHaveBeenLastCalledWith({
      where: { day: DAY },
      create: { day: DAY, requests: 0, inputTokens: 11, outputTokens: 0 },
      update: { requests: { increment: 0 }, inputTokens: { increment: 11 }, outputTokens: { increment: 0 } },
    });
  });

  // Yordamchi so'rovni reserveAiRequest bilan sanaydi, tokenlarni esa keyin shu yerga yozadi — so'rov ikki marta sanalmasligi kerak
  it("faqat tokenlar berilsa so'rovlar soni o'zgarmaydi (so'rov band qilishda allaqachon sanalgan)", async () => {
    await recordAiUsage({ inputTokens: 900, outputTokens: 40 }, NOW);
    const args = h.prisma.aiUsage.upsert.mock.calls[0][0] as { create: { requests: number }; update: { requests: { increment: number } } };
    expect(args.create.requests).toBe(0);
    expect(args.update.requests).toEqual({ increment: 0 });
    expect(h.prisma.aiUsage.updateMany).not.toHaveBeenCalled();
    expect(h.prisma.aiUsage.createMany).not.toHaveBeenCalled();
  });

  it("baza xatosi tashqariga chiqmaydi: AI javobi sarf hisobi tufayli to'xtamaydi", async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.prisma.aiUsage.upsert.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    await expect(recordAiUsage({ requests: 1, inputTokens: 1, outputTokens: 1 })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });

  it("bugungi so'rovlar soni: Toshkent kuni qatoridan; qator yo'q bo'lsa 0", async () => {
    expect(await aiRequestsToday(new Date('2026-10-10T19:30:00Z'))).toBe(0);
    expect(h.prisma.aiUsage.findUnique).toHaveBeenLastCalledWith({ where: { day: '2026-10-11' }, select: { requests: true } });
    h.prisma.aiUsage.findUnique.mockResolvedValue({ requests: 137 });
    expect(await aiRequestsToday(NOW)).toBe(137);
    expect(h.prisma.aiUsage.findUnique).toHaveBeenLastCalledWith({ where: { day: DAY }, select: { requests: true } });
  });
});

describe('AI ulanishi: kalitni sinash (testAi)', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
  });

  const errorOf = async (): Promise<string> => {
    const result = await testAi();
    expect(result.ok).toBe(false);
    return result.ok ? '' : result.error;
  };
  /** Kalit ko'rinishidagi hech narsa qolmagan: sk-ant- dan keyin kalit belgisi kelmaydi (yashirilgan "sk-ant-***" mumkin) */
  const expectNoKeys = (value: unknown) => {
    const out = JSON.stringify(value);
    expect(out).not.toContain(KEY);
    expect(out).not.toContain(OTHER_KEY);
    expect(out).not.toMatch(/sk-ant-[A-Za-z0-9_-]/);
    expect(out).not.toContain('ci-dummy');
  };

  it("kalit kiritilmagan: so'rov yuborilmaydi", async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '  ');
    expect(await testAi()).toEqual({ ok: false, error: 'ANTHROPIC_API_KEY kiritilmagan' });
    expect(h.http).not.toHaveBeenCalled();
    expect(h.prisma.aiUsage.upsert).not.toHaveBeenCalled();
  });

  it("muvaffaqiyat: bitta qisqa so'rov, API qaytargan model nomi, sarf hisobga yoziladi", async () => {
    respond(() => okMessage({ model: 'claude-opus-5-5-20260801' }));
    expect(await testAi()).toEqual({ ok: true, model: 'claude-opus-5-5-20260801' });
    expect(h.http).toHaveBeenCalledTimes(1);
    const req = sent();
    expect(req.method).toBe('POST');
    expect(new URL(req.url).pathname).toBe('/v1/messages');
    // Kalit faqat so'rov sarlavhasida ketadi — manzilda ham, tanada ham yo'q
    expect(req.headers.get('x-api-key')).toBe(KEY);
    expect(req.url).not.toContain(KEY);
    expect(JSON.stringify(req.body)).not.toContain(KEY);
    expect(req.body).toMatchObject({ model: 'claude-opus-5-5', output_config: { effort: 'low' }, messages: [{ role: 'user' }] });
    // Sinov arzon bo'lishi kerak: javob uzunligi cheklangan
    expect(req.body.max_tokens).toBeLessThanOrEqual(1024);
    expect(h.prisma.aiUsage.upsert).toHaveBeenCalledTimes(1);
    expect(h.prisma.aiUsage.upsert.mock.calls[0][0]).toMatchObject({ create: { requests: 1, inputTokens: 14, outputTokens: 4 }, update: { requests: { increment: 1 } } });
    // Sinov mijozlar chegarasidan joy olmaydi (skript chegara tugagan kuni ham ishlashi kerak) — faqat sarfga yoziladi
    expect(h.prisma.aiUsage.updateMany).not.toHaveBeenCalled();
  });

  it('ANTHROPIC_MODEL dagi model sinaladi', async () => {
    vi.stubEnv('ANTHROPIC_MODEL', ' claude-haiku-5-5 ');
    respond(() => okMessage({ model: 'claude-haiku-5-5' }));
    expect(await testAi()).toEqual({ ok: true, model: 'claude-haiku-5-5' });
    expect(sent().body.model).toBe('claude-haiku-5-5');
  });

  it("sarf hisobini yozib bo'lmasa ham sinov natijasi muvaffaqiyatli", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.prisma.aiUsage.upsert.mockRejectedValue(new Error('baza ulanmadi'));
    respond(() => okMessage());
    expect(await testAi()).toEqual({ ok: true, model: 'claude-opus-5-5' });
  });

  /** API javobi (yoki tarmoq xatosi) -> sabab turi va egasi tushunadigan matn bo'laklari */
  const failures: { name: string; kind: string; api: () => Response | Promise<Response>; model?: string; expect: string[] }[] = [
    { name: '401 AuthenticationError', kind: 'kalit', api: () => apiError(401, 'authentication_error', 'invalid x-api-key'), expect: ['kalit yaroqsiz', '401', 'console.anthropic.com'] },
    { name: '403 PermissionDeniedError', kind: 'ruxsat', api: () => apiError(403, 'permission_error', 'Your API key does not have permission to use the specified resource.'), expect: ['ruxsat berilmagan', '403'] },
    { name: '404 NotFoundError', kind: 'model', api: () => apiError(404, 'not_found_error', 'model: claude-opus-9'), model: 'claude-opus-9', expect: ['model topilmadi', 'claude-opus-9'] },
    { name: '429 RateLimitError', kind: 'chegara', api: () => apiError(429, 'rate_limit_error', 'Number of requests has exceeded your rate limit'), expect: ["so'rovlar chegarasi", '429'] },
    { name: 'tarmoq xatosi (APIConnectionError)', kind: 'tarmoq', api: () => Promise.reject(new TypeError('fetch failed')), expect: ["ulanib bo'lmadi"] },
    { name: 'vaqt tugadi (APIConnectionTimeoutError)', kind: 'tarmoq', api: () => Promise.reject(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })), expect: ["ulanib bo'lmadi", 'vaqt tugadi'] },
    { name: "400 hisobda mablag' yo'q (matni bo'yicha)", kind: "mablag'", api: () => apiError(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'), expect: [BILLING] },
    { name: "402 to'lov talab qilinadi", kind: "mablag'", api: () => apiError(402, 'billing_error', 'There is an issue with billing or payment for your account.'), expect: [BILLING] },
    { name: '402 (xato turi boshqa)', kind: "mablag'", api: () => apiError(402, 'invalid_request_error', 'Payment Required'), expect: [BILLING] },
    { name: '400 billing_error turi', kind: "mablag'", api: () => apiError(400, 'billing_error', 'Your payment method was declined.'), expect: [BILLING] },
    { name: '400 boshqa xato', kind: '400', api: () => apiError(400, 'invalid_request_error', 'max_tokens: must be greater than thinking.budget_tokens'), expect: ['API xatosi 400: max_tokens: must be greater than thinking.budget_tokens'] },
    { name: '500 server xatosi', kind: '500', api: () => apiError(500, 'api_error', 'Internal server error'), expect: ['API xatosi 500: Internal server error'] },
    { name: "529 server band", kind: '529', api: () => apiError(529, 'overloaded_error', 'Overloaded'), expect: ['API xatosi 529: Overloaded'] },
  ];

  it.each(failures)('$name: tushunarli xato matni, kalit matnda yo\'q, qayta urinilmaydi', async ({ api, model, expect: parts }) => {
    if (model) vi.stubEnv('ANTHROPIC_MODEL', model);
    h.http.mockImplementation(async () => api());
    const result = await testAi();
    expect(result.ok).toBe(false);
    const error = result.ok ? '' : result.error;
    for (const part of parts) expect(error).toContain(part);
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(JSON.stringify(result)).not.toContain('sk-ant');
    // Egasi bir satrda ko'radi: butun JSON javobi emas, faqat sababi
    expect(error).not.toContain('{"type"');
    // Skript 45 s kutadi: sinov bitta so'rov bilan tugaydi (429 / 5xx da ham qayta urinmaydi) va muvaffaqiyatsiz so'rov sarfga yozilmaydi
    expect(h.http).toHaveBeenCalledTimes(1);
    expect(h.prisma.aiUsage.upsert).not.toHaveBeenCalled();
  });

  it("har xil sabab har xil matn beradi: egasi kalit, model, mablag' va tarmoq muammosini ajrata oladi", async () => {
    const byKind = new Map<string, Set<string>>();
    for (const { api, model, kind } of failures) {
      vi.stubEnv('ANTHROPIC_MODEL', model);
      h.http.mockImplementation(async () => api());
      const text = await errorOf();
      byKind.set(kind, (byKind.get(kind) ?? new Set()).add(text));
    }
    // Bir sababning hamma ko'rinishi (tarmoq / vaqt tugashi; mablag'ning to'rt xil javobi) bitta matn beradi
    for (const [kind, texts] of byKind) expect([...texts], kind).toHaveLength(1);
    // Har xil sabab — har xil matn
    const texts = [...byKind.values()].map((set) => [...set][0]);
    expect(new Set(texts).size).toBe(byKind.size);
    expect(byKind.size).toBe(9);
    // Mablag' yetishmasligi umumiy "API xatosi" bo'lib ko'rinmaydi
    expect([...byKind.get("mablag'")!]).toEqual([BILLING]);
    expect(texts.filter((t) => t.includes('API xatosi'))).toHaveLength(3);
  });

  it("SDK xato sinflari to'g'ridan-to'g'ri: har biri o'z matniga tushadi", async () => {
    const headers = new Headers();
    const body = (type: string, message: string) => ({ type: 'error', error: { type, message } });
    const cases: [Error, string][] = [
      [new Anthropic.AuthenticationError(401, body('authentication_error', 'invalid x-api-key'), undefined, headers), 'kalit yaroqsiz (401)'],
      [new Anthropic.PermissionDeniedError(403, body('permission_error', 'forbidden'), undefined, headers), 'ruxsat berilmagan (403)'],
      [new Anthropic.NotFoundError(404, body('not_found_error', 'model: x'), undefined, headers), `model topilmadi: ${AI_DEFAULT_MODEL}`],
      [new Anthropic.RateLimitError(429, body('rate_limit_error', 'slow down'), undefined, headers), "so'rovlar chegarasi (429)"],
      [new Anthropic.APIConnectionError({ message: 'Connection error.' }), "ulanib bo'lmadi"],
      [new Anthropic.APIConnectionTimeoutError(), "ulanib bo'lmadi"],
      [new Anthropic.BadRequestError(400, body('invalid_request_error', 'Your credit balance is too low'), undefined, headers), BILLING],
      [new Anthropic.APIError(402, body('billing_error', 'payment required'), undefined, headers), BILLING],
      [new Anthropic.APIError(402, undefined, 'Payment Required', headers), BILLING],
      [new Anthropic.BadRequestError(400, body('billing_error', 'declined'), undefined, headers), BILLING],
      [new Anthropic.InternalServerError(503, body('api_error', 'unavailable'), undefined, headers), 'API xatosi 503: unavailable'],
      // Tanasi bo'lmagan xato: SDK'ning o'z matni ishlatiladi
      [new Anthropic.InternalServerError(502, undefined, 'Bad Gateway', headers), 'API xatosi 502: 502 Bad Gateway'],
      [new Anthropic.APIUserAbortError(), 'API xatosi'],
    ];
    const create = vi.spyOn(aiClient().messages, 'create');
    for (const [thrown, part] of cases) {
      create.mockRejectedValueOnce(thrown);
      const result = await testAi();
      expect(result, thrown.constructor.name).toMatchObject({ ok: false });
      expect(result.ok ? '' : result.error, `${thrown.constructor.name}: ${thrown.message}`).toContain(part);
    }
    expect(h.http).not.toHaveBeenCalled();
  });

  it("uzun API xato matni qisqartiriladi (skript uni bir satrda ko'rsatadi)", async () => {
    respond(() => apiError(400, 'invalid_request_error', `prompt is too long: ${'x'.repeat(5000)}`));
    const error = await errorOf();
    expect(error).toContain('API xatosi 400: prompt is too long: xxx');
    expect(error.length).toBeLessThanOrEqual('API xatosi 400: '.length + 200);
  });

  // Oraliq server (ANTHROPIC_BASE_URL) yoki API xato matnida so'rov sarlavhasini (x-api-key) takrorlasa, kalit /api/ai/status javobiga
  // va ai-setup.sh ekraniga chiqib ketardi
  it("API xato matni kalitni takrorlasa ham qaytarilgan matnda kalit bo'lmaydi", async () => {
    respond(() => apiError(400, 'invalid_request_error', `bad header x-api-key: ${KEY} (rejected)`));
    const result = await testAi();
    expect(result).toEqual({ ok: false, error: 'API xatosi 400: bad header x-api-key: *** (rejected)' });
    expectNoKeys(result);
    // Bir necha marta takrorlangan kalit ham to'liq yashiriladi
    respond(() => apiError(500, 'api_error', `${KEY} != ${KEY}; header was "${KEY}"`));
    const twice = await testAi();
    expect(twice).toEqual({ ok: false, error: 'API xatosi 500: *** != ***; header was "***"' });
    expectNoKeys(twice);
  });

  it("sozlangan kalitdan boshqa sk-ant-... satri ham yashiriladi; sk-ant- bilan boshlanmaydigan sozlangan kalit ham", async () => {
    respond(() => apiError(400, 'invalid_request_error', `expected ${OTHER_KEY}, got ${KEY}`));
    const result = await testAi();
    expect(result).toEqual({ ok: false, error: 'API xatosi 400: expected sk-ant-***, got ***' });
    expectNoKeys(result);

    // Oraliq server uchun berilgan, boshqa ko'rinishdagi kalit: aynan o'zi bo'yicha yashiriladi
    const proxyKey = 'ci-dummy-proxy-gateway-secret';
    vi.stubEnv('ANTHROPIC_API_KEY', `  ${proxyKey}\n`);
    respond(() => apiError(400, 'invalid_request_error', `unknown token ${proxyKey}`));
    const proxied = await testAi();
    expect(proxied).toEqual({ ok: false, error: 'API xatosi 400: unknown token ***' });
    expectNoKeys(proxied);
  });

  it("Anthropic ko'rinishida bo'lmagan xato javobi (oraliq server JSON'i yoki oddiy matn) ham kalitsiz qaytadi", async () => {
    const bodies: (() => Response)[] = [
      () => json(400, { message: `invalid key ${KEY}` }),
      () => json(400, { detail: { header: `x-api-key: ${KEY}`, other: OTHER_KEY } }),
      () => json(500, { error: `upstream said: ${KEY}` }),
      () => new Response(`upstream rejected x-api-key=${KEY} and ${OTHER_KEY}`, { status: 502, headers: { 'content-type': 'text/plain' } }),
    ];
    for (const body of bodies) {
      respond(body);
      const result = await testAi();
      const error = result.ok ? '' : result.error;
      expect(error).toMatch(/^API xatosi (400|500|502): /);
      expect(error).toContain('***');
      expectNoKeys(result);
      expect(error.length).toBeLessThanOrEqual(220);
    }
  });

  it("kalit qisqartirish chegarasiga to'g'ri kelsa ham bo'lagi chiqmaydi: avval yashiriladi, keyin kesiladi", async () => {
    // Ikkinchisi — sk-ant- bilan boshlanmaydigan kalit: kesilgan bo'lagini "sk-ant-..." qoidasi tutmaydi, faqat to'liq kalit bo'yicha yashiriladi
    for (const configured of [KEY, 'ci-dummy-proxy-gateway-secret']) {
      vi.stubEnv('ANTHROPIC_API_KEY', configured);
      for (const pad of [150, 180, 185, 190, 195, 199, 200, 230]) {
        for (const key of [configured, OTHER_KEY]) {
          respond(() => apiError(400, 'invalid_request_error', `${'x'.repeat(pad)}${key} tail`));
          const result = await testAi();
          const error = result.ok ? '' : result.error;
          expect(error.startsWith(`API xatosi 400: ${'x'.repeat(Math.min(pad, 200))}`), `${pad}`).toBe(true);
          expectNoKeys(result);
          expect(error, `${pad}`).not.toContain('dummy');
          expect(error.length, `${pad}`).toBeLessThanOrEqual(220);
        }
      }
    }
  });

  it("kutilmagan (API'ga aloqasiz) xato: umumiy matn, xato tafsiloti qaytarilmaydi", async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(aiClient().messages, 'create').mockRejectedValueOnce(new Error(`ichki xato: /app/.next/server/chunks/42.js ${KEY}`));
    const result = await testAi();
    expect(result).toEqual({ ok: false, error: expect.stringContaining('kutilmagan xato') });
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(JSON.stringify(result)).not.toContain('chunks');
    expect(log).toHaveBeenCalled();
  });

  it("API javobida usage bo'lmasa (buzilgan javob) ham xato tashlanmaydi", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    respond(() => json(200, { id: 'msg_01', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [] }));
    const result = await testAi();
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(KEY);
  });
});
