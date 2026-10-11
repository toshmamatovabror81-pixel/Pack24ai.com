import { inspect } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditCheck, AuditSummary } from '@/lib/ai/audit';

/**
 * Kunlik tekshiruv (src/lib/ai/audit.ts): bazasiz va tarmoqsiz. prisma, sozlamalar, ombor, xodimlar ro'yxati va Telegram
 * xabarnomasi soxta; Anthropic SDK esa haqiqiy — faqat uning fetch'i shu fayldagi soxta "API"ga ulangan (ai-client.test.ts
 * dagi kabi). Shuning uchun so'rov tanasi simdan ketadigan ko'rinishda tekshiriladi, javobni va xato sinflarini SDK'ning o'zi
 * yasaydi, api.anthropic.com ga esa hech narsa ketmaydi. Aniq qoidalar haqiqiy bazada — db/audit.test.ts.
 */
const h = vi.hoisted(() => ({
  prisma: {
    aiUsage: { findUnique: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
    auditReport: { create: vi.fn(), deleteMany: vi.fn() },
    order: { count: vi.fn(), findMany: vi.fn() },
    corporateInvoice: { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    workOrder: { count: vi.fn(), findMany: vi.fn() },
    lead: { count: vi.fn() },
    review: { count: vi.fn() },
    siteSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  },
  http: vi.fn<(url: string, init: RequestInit) => Promise<Response>>(),
  settings: {} as Record<string, unknown>,
  lowStockProducts: vi.fn(),
  staffRecipients: vi.fn(),
  notifyStaff: vi.fn(),
  sendDailyDigest: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: h.prisma }));
vi.mock('@/lib/settings', () => ({ getSettings: async () => h.settings }));
vi.mock('@/lib/inventory', () => ({ lowStockProducts: h.lowStockProducts }));
vi.mock('@/lib/telegram/staffLink', () => ({ staffRecipients: h.staffRecipients }));
vi.mock('@/lib/telegram/notify', () => ({ notifyStaff: h.notifyStaff }));
vi.mock('@/lib/orderNotify', () => ({ sendDailyDigest: h.sendDailyDigest }));
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const real = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  class Offline extends real.default {
    constructor(options: ConstructorParameters<typeof real.default>[0] = {}) {
      super({ ...options, fetch: (url, init) => h.http(String(url), init ?? {}) });
    }
  }
  return { ...real, default: Offline };
});

const { collectChecks, dailyAudit, reportChecks, reportSummary, runAudit, sendAuditToStaff, summarize } = await import('@/lib/ai/audit');
const { runTick } = await import('@/lib/cron');

/** Soxta kalit: gitleaks ruxsat bergan ko'rinishda (ci-dummy-…-secret), hech qayerda ishlamaydi */
const KEY = 'sk-ant-ci-dummy-anthropic-secret';
const NOW = new Date('2031-03-10T03:00:00Z'); // Toshkentda 10.03.2031, 08:00 — kunlik tekshiruv vaqti
const TODAY = '2031-03-10';
const DAY_MS = 86_400_000;
const HEADER = '🧭 <b>Kunlik tekshiruv</b>';

const check = (patch: Partial<AuditCheck> = {}): AuditCheck => ({
  key: 'stale_new', severity: 'high', title: '24 soatdan beri qabul qilinmagan yangi buyurtmalar', count: 2,
  items: ["#101 · 08.03.2031 · 250 000 so'm", "#104 · 09.03.2031 · 1 200 000 so'm"], link: '/admin/orders?status=new_', ...patch,
});
const CHECKS: AuditCheck[] = [
  check(),
  check({ key: 'overdue_invoices', title: "Muddati o'tgan hisob-fakturalar (jami qoldiq 3 400 000 so'm)", count: 1, items: ["INV-2031-0007 · qoldiq 3 400 000 so'm · muddat 01.03.2031"], link: '/admin/invoices?status=overdue' }),
  check({ key: 'stale_leads', severity: 'medium', title: '24 soatdan beri javobsiz arizalar', count: 4, items: [], link: '/admin/leads' }),
  check({ key: 'old_reviews', severity: 'low', title: "3 kundan beri ko'rib chiqilmagan sharhlar", count: 1, items: [], link: '/admin/reviews' }),
];
const priority = (n: number) => ({ title: `${n}-ish`, why: `${n}-sabab`, action: `${n}-amal` });
const SUMMARY: AuditSummary = { headline: 'Bugun 2 ta shoshilinch ish bor', priorities: [priority(1), priority(2)], note: "Yangi buyurtmalarni har kuni ertalab ko'rib chiqing" };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test', ...headers } });
const apiError = (status: number, type: string, message: string, headers: Record<string, string> = {}) => json(status, { type: 'error', error: { type, message } }, headers);
/** Messages API javobi; `output` — modelning matni (obyekt bo'lsa JSON qilib yoziladi) */
const message = (output: unknown, patch: Record<string, unknown> = {}) =>
  json(200, { id: 'msg_01', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: typeof output === 'string' ? output : JSON.stringify(output) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 812, output_tokens: 240 }, ...patch });
/** Har so'rovga yangi Response: tanasi faqat bir marta o'qiladi */
const respond = (make: () => Response) => h.http.mockImplementation(async () => make());
const sent = (i = 0) => {
  const [url, init] = h.http.mock.calls[i];
  return { url, headers: new Headers(init.headers), body: JSON.parse(String(init.body)) as { model: string; messages: { role: string; content: string }[] } & Record<string, unknown> };
};
/** AI'ga ketgan foydalanuvchi xabaridagi JSON ro'yxat */
const sentChecks = (i = 0) => {
  const text = sent(i).body.messages[0].content;
  return JSON.parse(text.slice(text.indexOf('['))) as Record<string, unknown>[];
};

/**
 * AiUsage jadvali o'rniga xotiradagi hisob (kun -> sanoqlar). Band qilish (createMany + shartli updateMany) va sarfni yozish (upsert)
 * haqiqiy bazadagi kabi bajariladi, shuning uchun chegara "qaysi so'rov chaqirildi" bo'yicha emas, natijasi bo'yicha tekshiriladi.
 * Kutilmagan shart yoki maydon kelsa xato tashlaydi — so'rov shakli o'zgarsa test jim o'tib ketmaydi.
 */
type UsageRow = { requests: number; inputTokens: number; outputTokens: number };
const usage = new Map<string, UsageRow>();
const used = (day = TODAY): UsageRow | null => usage.get(day) ?? null;
/** Bugun allaqachon `requests` ta so'rov sarflangan holat */
const useUp = (requests: number, day = TODAY) => usage.set(day, { requests, inputTokens: 0, outputTokens: 0 });

function usageTable(): void {
  usage.clear();
  const only = (what: string, value: object, allowed: string[]) => {
    const extra = Object.keys(value).filter((k) => !allowed.includes(k));
    if (extra.length) throw new Error(`test: aiUsage.${what} da kutilmagan maydon: ${extra.join(', ')}`);
  };
  const table = h.prisma.aiUsage;
  table.findUnique.mockImplementation(async ({ where }: { where: { day: string } }) => usage.get(where.day) ?? null);
  table.createMany.mockImplementation(async ({ data, skipDuplicates }: { data: { day: string }[]; skipDuplicates?: boolean }) => {
    let count = 0;
    for (const row of data) {
      if (usage.has(row.day)) {
        if (!skipDuplicates) throw new Error('test: Unique constraint failed on the fields: (`day`)');
        continue;
      }
      usage.set(row.day, { requests: 0, inputTokens: 0, outputTokens: 0 });
      count += 1;
    }
    return { count };
  });
  table.updateMany.mockImplementation(async ({ where, data }: { where: { day: string; requests?: { lt?: number; gt?: number } }; data: { requests: { increment?: number; decrement?: number } } }) => {
    only('updateMany.where', where, ['day', 'requests']);
    only('updateMany.where.requests', where.requests ?? {}, ['lt', 'gt']);
    only('updateMany.data', data, ['requests']);
    const row = usage.get(where.day);
    const { lt, gt } = where.requests ?? {};
    if (!row || (lt !== undefined && !(row.requests < lt)) || (gt !== undefined && !(row.requests > gt))) return { count: 0 };
    row.requests += (data.requests.increment ?? 0) - (data.requests.decrement ?? 0);
    return { count: 1 };
  });
  table.upsert.mockImplementation(async ({ where, create, update }: { where: { day: string }; create: UsageRow & { day: string }; update: Record<keyof UsageRow, { increment: number }> }) => {
    const row = usage.get(where.day);
    if (!row) usage.set(where.day, { requests: create.requests, inputTokens: create.inputTokens, outputTokens: create.outputTokens });
    else {
      row.requests += update.requests.increment;
      row.inputTokens += update.inputTokens.increment;
      row.outputTokens += update.outputTokens.increment;
    }
    return {};
  });
}

beforeEach(() => {
  h.http.mockReset();
  for (const model of Object.values(h.prisma)) for (const fn of Object.values(model)) fn.mockReset();
  usageTable();
  h.lowStockProducts.mockReset().mockResolvedValue([]);
  h.staffRecipients.mockReset().mockResolvedValue([]);
  h.notifyStaff.mockReset().mockResolvedValue(true);
  h.sendDailyDigest.mockReset().mockResolvedValue({ finance: 0, orders: 0 });
  h.settings = { lowStockThreshold: 10, legalName: 'Pack24 MChJ', inn: '301234567', bankDetails: 'h/r 2020 8000 0000 0000 0001' };
  // Tashqi muhitdagi sozlamalar (ishlab chiquvchi kompyuteridagi kalit, ANTHROPIC_BASE_URL yoki bot tokeni) testga ta'sir qilmasin
  for (const name of ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_CUSTOM_HEADERS', 'ANTHROPIC_LOG', 'AI_DAILY_LIMIT', 'AI_CUSTOMER_DAILY_LIMIT', 'STAFF_BOT_TOKEN', 'SUPERVISOR_BOT_TOKEN']) vi.stubEnv(name, undefined);
  vi.stubEnv('APP_URL', 'https://test.pack24.uz');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ─── Bazadagi JSON'ni o'qish ─────────────────────────────────────────────────

describe('tekshiruv hisoboti: saqlangan ro\'yxatni o\'qish (reportChecks)', () => {
  it('to\'g\'ri shakldagi ro\'yxat o\'zgarishsiz qaytadi', () => {
    expect(reportChecks(CHECKS)).toEqual(CHECKS);
    // Bazadan o'qilgan (JSON orqali o'tgan) qiymat ham shunday
    expect(reportChecks(JSON.parse(JSON.stringify(CHECKS)))).toEqual(CHECKS);
  });

  it('shakli buzilgan yozuv tashlab ketiladi, qolganlari tartibi bilan qoladi', () => {
    const good = check({ key: 'a' });
    const alsoGood = check({ key: 'b', severity: 'low' });
    const broken: unknown[] = [
      null, undefined, 'stale_new', 42, [], {},
      { ...check(), key: undefined }, { ...check(), key: 7 },
      { ...check(), title: undefined }, { ...check(), title: { uz: 'x' } },
      { ...check(), severity: undefined }, { ...check(), severity: 'critical' }, { ...check(), severity: 'HIGH' }, { ...check(), severity: 0 },
    ];
    expect(reportChecks([good, ...broken, alsoGood])).toEqual([good, alsoGood]);
    expect(reportChecks(broken)).toEqual([]);
  });

  it('son va misollar: son bo\'lmagan count 0 ga, satr bo\'lmagan misollar tashlab ketiladi', () => {
    const read = (patch: Record<string, unknown>) => reportChecks([{ ...check(), ...patch }])[0];
    expect(read({ count: '7' }).count).toBe(7);
    for (const count of [undefined, null, 'ko\'p', Number.NaN, {}]) expect(read({ count }).count, inspect(count)).toBe(0);
    expect(read({ items: ['#1', 5, null, { id: 2 }, '#2'] }).items).toEqual(['#1', '#2']);
    for (const items of [undefined, null, '#1', { 0: '#1', length: 1 }]) expect(read({ items }).items, inspect(items)).toEqual([]);
  });

  // Havola admin sahifasida <a href> bo'lib chiqadi: bazadagi yozuv buzilgan yoki almashtirilgan bo'lsa ham tashqi saytga olib ketmasin
  it('havola faqat admin panel ichida: boshqa har qanday qiymat /admin ga almashtiriladi', () => {
    const link = (value: unknown) => reportChecks([{ ...check(), link: value }])[0].link;
    for (const inside of ['/admin', '/admin/orders?status=new_', '/admin/invoices?status=overdue', '/admin/audit']) expect(link(inside)).toBe(inside);
    for (const outside of ['https://evil.example', 'https://evil.example/admin', 'javascript:alert(1)', '//evil.example/admin', 'evil.example/admin', '/login?next=/admin', ' /admin', 'admin/orders', '', undefined, null, 42, { href: '/admin' }]) {
      expect(link(outside), inspect(outside)).toBe('/admin');
    }
  });

  it('ro\'yxat bo\'lmasa bo\'sh ro\'yxat', () => {
    for (const value of [null, undefined, {}, 'x', 5, true, { 0: check(), length: 1 }, check()]) expect(reportChecks(value), inspect(value)).toEqual([]);
  });
});

describe('tekshiruv hisoboti: saqlangan AI xulosasini o\'qish (reportSummary)', () => {
  it('xulosa yo\'q yoki shakli buzilgan bo\'lsa null', () => {
    const broken: unknown[] = [null, undefined, 'xulosa', 5, [], {}, { headline: 'x' }, { priorities: [] }, { headline: 5, priorities: [] }, { headline: 'x', priorities: 'yo\'q' }, { headline: 'x', priorities: { 0: priority(1) } }];
    for (const value of broken) expect(reportSummary(value), inspect(value)).toBeNull();
  });

  it('sarlavha, ustuvor ishlar va maslahat saqlanadi', () => {
    expect(reportSummary(SUMMARY)).toEqual(SUMMARY);
    expect(reportSummary(JSON.parse(JSON.stringify(SUMMARY)))).toEqual(SUMMARY);
    // Ustuvor ish bo'lmasligi mumkin; maslahat yo'q yoki satr bo'lmasa bo'sh satr
    expect(reportSummary({ headline: 'Hammasi joyida', priorities: [] })).toEqual({ headline: 'Hammasi joyida', priorities: [], note: '' });
    expect(reportSummary({ headline: 'x', priorities: [], note: 12 })).toEqual({ headline: 'x', priorities: [], note: '' });
  });

  it('nomi yo\'q ustuvor ish tashlab ketiladi; qolgan maydonlari satr bo\'lmasa bo\'sh satr', () => {
    const priorities = [priority(1), { why: 'nomsiz', action: 'x' }, { title: '', why: 'bo\'sh nom', action: 'x' }, { title: 9, why: 'son', action: 'x' }, null, 'matn', { title: 'Faqat nom' }, { title: 'Aralash', why: 3, action: ['x'] }];
    expect(reportSummary({ headline: 'x', priorities, note: 'n' })).toEqual({
      headline: 'x',
      priorities: [priority(1), { title: 'Faqat nom', why: '', action: '' }, { title: 'Aralash', why: '', action: '' }],
      note: 'n',
    });
  });
});

// ─── AI xulosasi ─────────────────────────────────────────────────────────────

describe('tekshiruv: AI xulosasi (summarize)', () => {
  const table = h.prisma.aiUsage;

  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => message(SUMMARY));
  });

  it('kalit kiritilmagan: null, so\'rov ham, baza murojaati ham yo\'q', async () => {
    for (const empty of [undefined, '', '   ']) {
      vi.stubEnv('ANTHROPIC_API_KEY', empty);
      expect(await summarize(CHECKS, NOW), inspect(empty)).toBeNull();
      expect(await summarize(CHECKS, NOW, 'cron'), inspect(empty)).toBeNull();
    }
    expect(h.http).not.toHaveBeenCalled();
    for (const fn of Object.values(table)) expect(fn).not.toHaveBeenCalled();
  });

  it('topilma yo\'q: null, AI bezovta qilinmaydi va kunlik hisobdan so\'rov band qilinmaydi', async () => {
    expect(await summarize([], NOW)).toBeNull();
    expect(await summarize([], NOW, 'cron')).toBeNull();
    expect(h.http).not.toHaveBeenCalled();
    for (const fn of Object.values(table)) expect(fn).not.toHaveBeenCalled();
    expect(used()).toBeNull();
  });

  // ── Kunlik chegara: so'rov yuborilishidan oldin band qilinadi (reserveAiRequest)

  it('kunlik chegara tugagan: so\'rov band qilinmaydi va AI\'ga hech narsa ketmaydi; chegaragacha bitta qolgan bo\'lsa yuboriladi', async () => {
    useUp(300);
    expect(await summarize(CHECKS, NOW)).toBeNull();
    vi.stubEnv('AI_DAILY_LIMIT', '5');
    useUp(5);
    expect(await summarize(CHECKS, NOW)).toBeNull();
    // Chegara kun o'rtasida kamaytirilgan: allaqachon oshib ketgan sanoq ham to'xtatadi
    useUp(9);
    expect(await summarize(CHECKS, NOW)).toBeNull();
    expect(h.http).not.toHaveBeenCalled();
    expect(table.upsert).not.toHaveBeenCalled();
    // Rad etilgan urinish sanoqni o'zgartirmaydi
    expect(used()).toEqual({ requests: 9, inputTokens: 0, outputTokens: 0 });

    useUp(4);
    expect(await summarize(CHECKS, NOW)).not.toBeNull();
    expect(h.http).toHaveBeenCalledTimes(1);
    expect(used()?.requests).toBe(5);
    // O'zi band qilgan so'rov bilan chegara to'ldi: keyingisi o'tmaydi
    expect(await summarize(CHECKS, NOW)).toBeNull();
    expect(h.http).toHaveBeenCalledTimes(1);
    expect(used()?.requests).toBe(5);
  });

  it('AI_DAILY_LIMIT=0: qo\'lda so\'ralgan xulosa umuman yuborilmaydi; bo\'sh qiymat esa standart chegara (300)', async () => {
    vi.stubEnv('AI_DAILY_LIMIT', '0');
    expect(await summarize(CHECKS, NOW)).toBeNull();
    expect(h.http).not.toHaveBeenCalled();
    expect(used()?.requests).toBe(0);

    // .env dagi AI_DAILY_LIMIT="" satri AI'ni o'chirib qo'ymaydi
    vi.stubEnv('AI_DAILY_LIMIT', '  ');
    useUp(299);
    expect(await summarize(CHECKS, NOW)).not.toBeNull();
    expect(await summarize(CHECKS, NOW)).toBeNull();
    expect(h.http).toHaveBeenCalledTimes(1);
    expect(used()?.requests).toBe(300);
  });

  it('band qilish — bitta shartli yangilash: qo\'lda chegara sharti bilan, kunlik (cron) xulosada shartsiz', async () => {
    await summarize(CHECKS, NOW); // trigger ko'rsatilmasa — qo'lda
    await summarize(CHECKS, NOW, 'manual');
    await summarize(CHECKS, NOW, 'cron');
    // Kun qatori INSERT ... ON CONFLICT DO NOTHING bilan ochiladi: kunning birinchi ikki so'rovi bir vaqtda kelsa ham xato bo'lmaydi
    expect(table.createMany.mock.calls.map((c) => c[0])).toEqual(Array(3).fill({ data: [{ day: TODAY }], skipDuplicates: true }));
    const take = { requests: { increment: 1 } };
    expect(table.updateMany.mock.calls.map((c) => c[0])).toEqual([
      { where: { day: TODAY, requests: { lt: 300 } }, data: take },
      { where: { day: TODAY, requests: { lt: 300 } }, data: take },
      { where: { day: TODAY }, data: take },
    ]);
    // Sanoq alohida o'qilmaydi: "o'qib, keyin yozish" orasida boshqa so'rov chegaradan o'tib ketardi
    expect(table.findUnique).not.toHaveBeenCalled();
    expect(used()?.requests).toBe(3);
  });

  it('kunlik (cron) xulosa umumiy chegaradan tashqari: chegara tugagan kuni ham so\'raladi va sanoqqa qo\'shiladi', async () => {
    useUp(300);
    expect(await summarize(CHECKS, NOW, 'manual')).toBeNull();
    expect(h.http).not.toHaveBeenCalled();
    expect((await summarize(CHECKS, NOW, 'cron'))?.summary).toEqual(SUMMARY);
    expect(h.http).toHaveBeenCalledTimes(1);
    expect(used()).toEqual({ requests: 301, inputTokens: 812, outputTokens: 240 });
  });

  it('so\'rov AI\'ga ketishidan OLDIN sanaladi, sarf esa javob kelgach yoziladi', async () => {
    let onTheWire: UsageRow | null = null;
    h.http.mockImplementation(async () => {
      onTheWire = { ...(used() ?? { requests: -1, inputTokens: -1, outputTokens: -1 }) };
      return message(SUMMARY);
    });
    await summarize(CHECKS, NOW);
    // So'rov simga chiqqan paytda u allaqachon hisobda: javobsiz qolsa ham (vaqt tugashi, uzilish) chegaradan chetda qolmaydi
    expect(onTheWire).toEqual({ requests: 1, inputTokens: 0, outputTokens: 0 });
    const [reserved] = table.updateMany.mock.invocationCallOrder;
    const [requested] = h.http.mock.invocationCallOrder;
    const [recorded] = table.upsert.mock.invocationCallOrder;
    expect(reserved).toBeLessThan(requested);
    expect(requested).toBeLessThan(recorded);
  });

  it('chegara va sarf Toshkent kuni bo\'yicha sanaladi (UTC bo\'yicha hali kechagi kun bo\'lsa ham)', async () => {
    // 10-mart 19:30Z — Toshkentda 11-mart 00:30
    await summarize(CHECKS, new Date('2031-03-10T19:30:00Z'));
    expect(used('2031-03-11')).toEqual({ requests: 1, inputTokens: 812, outputTokens: 240 });
    expect(used('2031-03-10')).toBeNull();
    expect(table.updateMany.mock.calls[0][0]).toMatchObject({ where: { day: '2031-03-11' } });
    expect(table.upsert.mock.calls[0][0]).toMatchObject({ where: { day: '2031-03-11' } });
  });

  // ── Muvaffaqiyatli javob

  it('muvaffaqiyat: sarlavha, ustuvor ishlar, maslahat va API qaytargan model; sarfda faqat tokenlar — so\'rov bir marta sanaladi', async () => {
    respond(() => message(SUMMARY, { model: 'claude-opus-5-5-20260801' }));
    expect(await summarize(CHECKS, NOW)).toEqual({ summary: SUMMARY, model: 'claude-opus-5-5-20260801' });
    expect(h.http).toHaveBeenCalledTimes(1);
    // So'rov band qilishda sanalgan: sarf yozuvi "requests"ni oshirmaydi (aks holda bitta so'rov chegaradan ikkita yeydi)
    expect(table.upsert).toHaveBeenCalledTimes(1);
    expect(table.upsert).toHaveBeenCalledWith({
      where: { day: TODAY },
      create: { day: TODAY, requests: 0, inputTokens: 812, outputTokens: 240 },
      update: { requests: { increment: 0 }, inputTokens: { increment: 812 }, outputTokens: { increment: 240 } },
    });
    expect(used()).toEqual({ requests: 1, inputTokens: 812, outputTokens: 240 });
  });

  it('AI 5 tadan ko\'p ustuvor ish qaytarsa ham dastlabki 5 tasi olinadi; ustuvor ishsiz xulosa ham yaroqli', async () => {
    respond(() => message({ ...SUMMARY, priorities: [1, 2, 3, 4, 5, 6, 7].map(priority) }));
    const out = await summarize(CHECKS, NOW);
    expect(out?.summary.priorities).toEqual([1, 2, 3, 4, 5].map(priority));
    expect(out?.summary.headline).toBe(SUMMARY.headline);

    respond(() => message({ headline: 'Hammasi nazoratda', priorities: [], note: '' }));
    expect((await summarize(CHECKS, NOW))?.summary).toEqual({ headline: 'Hammasi nazoratda', priorities: [], note: '' });
  });

  // Sxemada uzunlik cheklanmagan: model qancha uzun yozsa ham sahifa va Telegram xabari (4096 belgi) uchun shu yerda kesiladi
  it('juda uzun javob kesiladi: sarlavha 300, nom 120, sabab 300, amal 300, maslahat 400 belgi', async () => {
    respond(() => message({ headline: 'H'.repeat(1000), priorities: [{ title: 'T'.repeat(500), why: 'W'.repeat(900), action: 'A'.repeat(900) }, priority(2)], note: 'N'.repeat(1500) }));
    expect((await summarize(CHECKS, NOW))?.summary).toEqual({
      headline: 'H'.repeat(300),
      priorities: [{ title: 'T'.repeat(120), why: 'W'.repeat(300), action: 'A'.repeat(300) }, priority(2)],
      note: 'N'.repeat(400),
    });
    // Aynan chegaradagi matn kesilmaydi
    const exact = { headline: 'H'.repeat(300), priorities: [{ title: 'T'.repeat(120), why: 'W'.repeat(300), action: 'A'.repeat(300) }], note: 'N'.repeat(400) };
    respond(() => message(exact));
    expect((await summarize(CHECKS, NOW))?.summary).toEqual(exact);
  });

  it('kesish emoji o\'rtasiga tushsa yarim belgi qolmaydi (Telegram bunday matnni rad etadi)', async () => {
    // Har bir maydonda chegaradagi belgi — emojining birinchi yarmi
    const cut = (n: number) => `${'x'.repeat(n - 1)}😀 davomi`;
    respond(() => message({ headline: cut(300), priorities: [{ title: cut(120), why: cut(300), action: cut(300) }], note: cut(400) }));
    const out = (await summarize(CHECKS, NOW))?.summary;
    expect(out).toEqual({ headline: 'x'.repeat(299), priorities: [{ title: 'x'.repeat(119), why: 'x'.repeat(299), action: 'x'.repeat(299) }], note: 'x'.repeat(399) });
    expect(JSON.stringify(out).isWellFormed()).toBe(true);
  });

  // ── So'rov

  // Maxfiylik: AI'ga faqat tekshiruv nomi, soni va buyurtma/hisob-faktura raqamlari ketadi
  it('so\'rov tanasi: har bir topilmadan faqat key, severity, title, count va examples ketadi', async () => {
    // Kelajakda tekshiruv obyektiga boshqa maydon qo'shilsa ham (masalan mijoz ma'lumoti) u AI'ga o'z-o'zidan ketib qolmasin
    const leaky = { ...check({ key: 'leaky', items: ['#9'] }), customerName: 'Maxfiy Mijozov', contactPhone: '998901112233', shippingAddress: 'Sirli ko\'cha 7' } as AuditCheck;
    await summarize([...CHECKS, leaky], NOW);

    const { url, body } = sent();
    expect(new URL(url).pathname).toBe('/v1/messages');
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].content.startsWith('Sana: 10.03.2031.')).toBe(true);
    expect(sentChecks()).toEqual([...CHECKS, leaky].map((c) => ({ key: c.key, severity: c.severity, title: c.title, count: c.count, examples: c.items })));
    for (const item of sentChecks()) expect(Object.keys(item).sort()).toEqual(['count', 'examples', 'key', 'severity', 'title']);
    // Butun so'rovda (tizim ko'rsatmasi va javob sxemasi bilan birga) havola ham, mijoz ma'lumoti ham yo'q
    const wire = JSON.stringify(body);
    for (const secret of ['"link"', '/admin', 'Maxfiy Mijozov', '998901112233', 'Sirli ko']) expect(wire, secret).not.toContain(secret);
    expect(wire).not.toContain(KEY);
  });

  it('so\'rov tanasi: oddiy (oqimsiz) so\'rov, javob shakli JSON sxema bilan beriladi, 8000 tokengacha', async () => {
    await summarize(CHECKS, NOW);
    const { body, headers } = sent();
    expect(body.max_tokens).toBe(8000);
    expect(body.stream ?? false).toBe(false);
    expect(typeof body.system).toBe('string');
    expect(body.output_config).toMatchObject({
      effort: 'medium',
      format: { type: 'json_schema', schema: { type: 'object', properties: { headline: { type: 'string' }, priorities: { type: 'array' }, note: { type: 'string' } } } },
    });
    // Kalit faqat sarlavhada ketadi
    expect(headers.get('x-api-key')).toBe(KEY);
    // Zaxira model sozlamasi: "betas" tanada emas, sarlavhada
    expect(body.fallbacks).toBe('default');
    expect(body).not.toHaveProperty('betas');
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
  });

  it('model: standart claude-opus-5-5; ANTHROPIC_MODEL bo\'lsa o\'sha (zaxira sozlamasi faqat qo\'llab-quvvatlaydigan modelda)', async () => {
    await summarize(CHECKS, NOW);
    expect(sent(0).body.model).toBe('claude-opus-5-5');
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-haiku-5-5');
    await summarize(CHECKS, NOW);
    expect(sent(1).body.model).toBe('claude-haiku-5-5');
    expect(sent(1).body).not.toHaveProperty('fallbacks');
    expect(sent(1).headers.get('anthropic-beta') ?? '').not.toContain('server-side-fallback');
  });

  // Sahifadagi tugma 40 soniyadan uzoq kuttirmaydi; kunlik xulosa fonda bajariladi — uzoqroq kutadi va bir marta qayta urinadi
  it('kutish vaqti: qo\'lda 40 soniya, kunlik (cron) xulosada 120 soniya', async () => {
    await summarize(CHECKS, NOW);
    await summarize(CHECKS, NOW, 'manual');
    await summarize(CHECKS, NOW, 'cron');
    expect([0, 1, 2].map((i) => sent(i).headers.get('x-stainless-timeout'))).toEqual(['40', '40', '120']);
  });

  it('kunlik (cron) xulosa: vaqtinchalik xatoda bir marta qayta uriniladi — hisobda baribir bitta so\'rov', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // retry-after-ms: SDK qayta urinishdan oldin shuncha kutadi (test tez o'tishi uchun 1 ms)
    const overloaded = () => apiError(529, 'overloaded_error', 'overloaded', { 'retry-after-ms': '1' });
    h.http.mockImplementationOnce(async () => overloaded()).mockImplementation(async () => message(SUMMARY));
    expect((await summarize(CHECKS, NOW, 'cron'))?.summary).toEqual(SUMMARY);
    expect(h.http).toHaveBeenCalledTimes(2);
    expect(sent(1).headers.get('x-stainless-retry-count')).toBe('1');
    expect(used()).toEqual({ requests: 1, inputTokens: 812, outputTokens: 240 });
    expect(log).not.toHaveBeenCalled();

    // Xato davom etsa: jami ikki urinish, uchinchisi yo'q
    h.http.mockReset();
    respond(overloaded);
    await expect(summarize(CHECKS, NOW, 'cron')).resolves.toBeNull();
    expect(h.http).toHaveBeenCalledTimes(2);
    expect(used()).toEqual({ requests: 2, inputTokens: 812, outputTokens: 240 });
    expect(log).toHaveBeenCalledTimes(1);
  });

  // ── Yaroqsiz javob: pul sarflangan, shuning uchun sarf baribir yoziladi

  const unusable: [string, () => Response, { logged: boolean }][] = [
    ['model rad etgan (stop_reason: refusal), matni yaroqli JSON bo\'lsa ham', () => message(SUMMARY, { stop_reason: 'refusal' }), { logged: false }],
    ['matnli rad javobi (JSON emas)', () => message('Kechirasiz, bu so\'rovga javob bera olmayman.', { stop_reason: 'refusal' }), { logged: false }],
    ['rad javobi, matn umuman yo\'q', () => message('', { content: [], stop_reason: 'refusal' }), { logged: false }],
    ['javobda matn yo\'q', () => message('', { content: [] }), { logged: true }],
    ['oddiy matn (JSON emas)', () => message('Kechirasiz, bugungi holat quyidagicha: ...'), { logged: true }],
    ['max_tokens da uzilib qolgan JSON', () => message('{"headline":"Bugun 2 ta shoshilinch ish bor","priorities":[{"title":"1-ish","why":', { stop_reason: 'max_tokens' }), { logged: true }],
    ['sxemaga mos emas: maydonlar yetishmaydi', () => message({ headline: 'x' }), { logged: true }],
    ['sxemaga mos emas: ustuvor ishda faqat nom', () => message({ headline: 'x', priorities: [{ title: 'faqat nom' }], note: '' }), { logged: true }],
    ['sxemaga mos emas: sarlavha son', () => message({ headline: 7, priorities: [], note: '' }), { logged: true }],
    ['JSON, lekin obyekt emas (ro\'yxat)', () => message('[]'), { logged: true }],
    ['JSON, lekin obyekt emas (null)', () => message('null'), { logged: true }],
  ];
  it.each(unusable)('yaroqsiz javob — %s: null, xato tashlanmaydi; sarflangan tokenlar baribir hisobga yoziladi', async (_name, make, { logged }) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    respond(make);
    await expect(summarize(CHECKS, NOW)).resolves.toBeNull();
    expect(h.http).toHaveBeenCalledTimes(1);
    expect(table.upsert).toHaveBeenCalledTimes(1);
    expect(table.upsert.mock.calls[0][0]).toMatchObject({ create: { requests: 0, inputTokens: 812, outputTokens: 240 }, update: { requests: { increment: 0 } } });
    expect(used()).toEqual({ requests: 1, inputTokens: 812, outputTokens: 240 });
    if (logged) {
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0][0])).toContain('[ai] tekshiruv');
    }
    expect(inspect(log.mock.calls, { depth: 6 })).not.toContain(KEY);
  });

  it('uzilgan javob logida sababi (stop_reason) ko\'rinadi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    respond(() => message('{"headline":"Bugun', { stop_reason: 'max_tokens' }));
    await summarize(CHECKS, NOW);
    expect(String(log.mock.calls[0][0])).toContain('max_tokens');
  });

  // ── API xatolari

  const failures: [string, () => void][] = [
    ['401 kalit yaroqsiz (AuthenticationError)', () => respond(() => apiError(401, 'authentication_error', 'invalid x-api-key'))],
    ['403 ruxsat yo\'q (PermissionDeniedError)', () => respond(() => apiError(403, 'permission_error', 'not allowed'))],
    ['404 model topilmadi (NotFoundError)', () => respond(() => apiError(404, 'not_found_error', 'model: claude-x'))],
    ['400 hisobda mablag\' yo\'q (BadRequestError)', () => respond(() => apiError(400, 'invalid_request_error', 'Your credit balance is too low'))],
    ['409 ziddiyat (ConflictError)', () => respond(() => apiError(409, 'invalid_request_error', 'conflict'))],
    ['413 so\'rov juda katta (APIError)', () => respond(() => apiError(413, 'request_too_large', 'too large'))],
    ['422 so\'rovni qayta ishlab bo\'lmadi (UnprocessableEntityError)', () => respond(() => apiError(422, 'invalid_request_error', 'unprocessable'))],
    ['429 so\'rovlar chegarasi (RateLimitError)', () => respond(() => apiError(429, 'rate_limit_error', 'rate limited'))],
    ['500 server xatosi (InternalServerError)', () => respond(() => apiError(500, 'api_error', 'internal'))],
    ['529 server band (InternalServerError)', () => respond(() => apiError(529, 'overloaded_error', 'overloaded'))],
    ['javob JSON emas, 502 (InternalServerError)', () => respond(() => new Response('<html>502 Bad Gateway</html>', { status: 502 }))],
    ['tarmoq uzilgan (APIConnectionError)', () => h.http.mockRejectedValue(new TypeError('fetch failed'))],
    ['so\'rov vaqti tugagan (APIConnectionTimeoutError)', () => h.http.mockRejectedValue(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))],
  ];
  it.each(failures)('%s: null qaytadi, xato tashlanmaydi, qayta urinilmaydi, kalit logga chiqmaydi', async (_name, fail) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fail();
    await expect(summarize(CHECKS, NOW)).resolves.toBeNull();
    // Admin sahifasidagi tugma ham shu yerdan o'tadi: SDK odatdagidek 429/5xx ni qayta yuborsa sahifa uzoq osilib qoladi
    expect(h.http).toHaveBeenCalledTimes(1);
    // Javob kelmagan: token sarfi yozilmaydi; yuborilgan so'rov esa hisobda qoladi (band qilish qaytarilmaydi)
    expect(table.upsert).not.toHaveBeenCalled();
    expect(used()).toEqual({ requests: 1, inputTokens: 0, outputTokens: 0 });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('[ai] tekshiruv');
    expect(inspect(log.mock.calls, { depth: 6 })).not.toContain(KEY);
  });

  it('so\'rovni band qilib bo\'lmasa (baza xatosi): null, AI\'ga so\'rov ketmaydi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Band qilishning ikkala qadami ham; kunlik (cron) xulosa ham sanalmagan so'rovni yubormaydi
    for (const step of ['createMany', 'updateMany'] as const) {
      for (const trigger of ['manual', 'cron'] as const) {
        table[step].mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
        await expect(summarize(CHECKS, NOW, trigger), `${step}, ${trigger}`).resolves.toBeNull();
      }
    }
    expect(h.http).not.toHaveBeenCalled();
    expect(table.upsert).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(4);
    for (const call of log.mock.calls) expect(String(call[0])).toContain('[ai] tekshiruv');
  });

  it('sarfni yozib bo\'lmasa ham tayyor xulosa yo\'qolmaydi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    table.upsert.mockRejectedValue(new Error('connect ECONNREFUSED'));
    expect((await summarize(CHECKS, NOW))?.summary).toEqual(SUMMARY);
    expect(log).toHaveBeenCalled();
  });
});

// ─── Xodimlarga yuborish ─────────────────────────────────────────────────────

describe('tekshiruv: xodimlarga yuborish (sendAuditToStaff)', () => {
  const staff = (telegramId: string) => ({ id: Number(telegramId), name: `Xodim ${telegramId}`, role: 'manager', phone: '998901234567', telegramId, telegramNotify: true });
  const htmlTo = (telegramId: string) => String(h.notifyStaff.mock.calls.find((c) => c[0] === telegramId)?.[1] ?? '');
  /** Xabardagi yagona ruxsat etilgan teg <b>; undan boshqa "<" yoki ">" qolsa, AI matni HTML sifatida o'tib ketgan */
  const withoutBold = (html: string) => html.replace(/<\/?b>/g, '');
  /**
   * Telegram (parse_mode=HTML) qabul qiladigan xabar: har bir <b> o'z juftida yopilgan (yopilmagan yoki ortiqcha teg butun xabarni
   * rad ettiradi), boshqa teg yo'q, har bir "&" — to'liq belgi kodi, yarim emoji yo'q.
   */
  const expectValidHtml = (html: string) => {
    expect(html.replace(/<b>[^<>]*<\/b>/g, '')).not.toMatch(/[<>]/);
    expect(html.replace(/&(?:amp|lt|gt);/g, '')).not.toContain('&');
    expect(html.isWellFormed()).toBe(true);
  };

  beforeEach(() => {
    h.staffRecipients.mockResolvedValue([staff('7001'), staff('7002')]);
  });

  it('topilma yo\'q bo\'lsa hech kimga hech narsa yuborilmaydi', async () => {
    expect(await sendAuditToStaff({ checks: [], summary: SUMMARY })).toBe(0);
    expect(await sendAuditToStaff({ checks: null, summary: null })).toBe(0);
    // Shakli buzilgan yozuvlardan iborat ro'yxat ham "topilma yo'q" hisoblanadi
    expect(await sendAuditToStaff({ checks: [{ key: 'x' }, 'matn'], summary: null })).toBe(0);
    expect(h.staffRecipients).not.toHaveBeenCalled();
    expect(h.notifyStaff).not.toHaveBeenCalled();
  });

  it('oluvchilar — aynan "reports" ruxsati bor xodimlar; har biriga bir xil xabar va "Batafsil" tugmasi', async () => {
    expect(await sendAuditToStaff({ checks: CHECKS, summary: SUMMARY })).toBe(2);
    expect(h.staffRecipients).toHaveBeenCalledTimes(1);
    expect(h.staffRecipients).toHaveBeenCalledWith('reports');
    expect(h.notifyStaff.mock.calls.map((c) => c[0])).toEqual(['7001', '7002']);
    expect(htmlTo('7002')).toBe(htmlTo('7001'));
    for (const call of h.notifyStaff.mock.calls) expect(call[2]).toEqual([[{ text: '📋 Batafsil', url: 'https://test.pack24.uz/admin/audit' }]]);
  });

  it('AI xulosasi bilan: sarlavha, raqamlangan ustuvor ishlar (nomi va amali), oxirida maslahat', async () => {
    await sendAuditToStaff({ checks: CHECKS, summary: SUMMARY });
    const lines = htmlTo('7001').split('\n');
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe('Bugun 2 ta shoshilinch ish bor');
    expect(htmlTo('7001')).toContain('1. <b>1-ish</b>\n1-amal\n2. <b>2-ish</b>\n2-amal');
    expect(htmlTo('7001')).not.toContain('3. ');
    expect(lines.at(-1)).toBe("💡 Yangi buyurtmalarni har kuni ertalab ko'rib chiqing");
    // Xulosa bo'lganda tekshiruvlarning xom ro'yxati takrorlanmaydi (u admin paneldagi "Batafsil"da)
    expect(htmlTo('7001')).not.toContain('🔴');
    expectValidHtml(htmlTo('7001'));
  });

  it('AI yozgan matn HTML sifatida emas, matn sifatida chiqadi', async () => {
    const hostile: AuditSummary = {
      headline: '<a href="https://evil.example">Bosing</a> & <i>tez</i>',
      priorities: [{ title: '<b>x</b> & y', why: '<s>w</s>', action: 'Kiring: <script>alert(1)</script> & "Buyurtmalar" > Yangi' }],
      note: '</b><code>x</code> & z',
    };
    await sendAuditToStaff({ checks: CHECKS, summary: hostile });
    const html = htmlTo('7001');
    expect(html).toContain('&lt;a href="https://evil.example"&gt;Bosing&lt;/a&gt; &amp; &lt;i&gt;tez&lt;/i&gt;');
    expect(html).toContain('1. <b>&lt;b&gt;x&lt;/b&gt; &amp; y</b>');
    expect(html).toContain('Kiring: &lt;script&gt;alert(1)&lt;/script&gt; &amp; "Buyurtmalar" &gt; Yangi');
    expect(html).toContain('💡 &lt;/b&gt;&lt;code&gt;x&lt;/code&gt; &amp; z');
    expect(withoutBold(html)).not.toMatch(/[<>]/);
    // Ochilgan va yopilgan <b> lar soni teng: AI matni tegni "yopib" yoki "ochib" keta olmaydi
    expect(html.match(/<b>/g)).toHaveLength(html.match(/<\/b>/g)?.length ?? -1);
    expectValidHtml(html);
  });

  it('juda uzun sarlavha, nom, amal va maslahat kesiladi (300 / 120 / 300 / 400 belgi)', async () => {
    const long: AuditSummary = { headline: 'S'.repeat(3000), priorities: [{ title: 'T'.repeat(500), why: '', action: 'A'.repeat(900) }], note: 'N'.repeat(1500) };
    await sendAuditToStaff({ checks: CHECKS, summary: long });
    const html = htmlTo('7001');
    expect(html.split('\n')[1]).toBe('S'.repeat(300));
    expect(html).toContain(`<b>${'T'.repeat(120)}</b>`);
    expect(html).not.toContain('T'.repeat(121));
    expect(html).toContain(`\n${'A'.repeat(300)}\n`);
    expect(html).not.toContain('A'.repeat(301));
    expect(html.endsWith(`💡 ${'N'.repeat(400)}`)).toBe(true);
  });

  it('kesish emoji o\'rtasiga tushsa yarim belgi qolmaydi', async () => {
    // Bazadagi eski (kesilmagan) xulosa: 300-belgi — emojining birinchi yarmi
    await sendAuditToStaff({ checks: CHECKS, summary: { headline: `${'s'.repeat(299)}😀 davomi`, priorities: [{ title: `${'t'.repeat(119)}😀 davomi`, why: '', action: `${'a'.repeat(299)}😀 davomi` }], note: `${'n'.repeat(399)}😀 davomi` } });
    const html = htmlTo('7001');
    expect(html.split('\n')).toEqual([HEADER, 's'.repeat(299), '', `1. <b>${'t'.repeat(119)}</b>`, 'a'.repeat(299), '', `💡 ${'n'.repeat(399)}`]);
    expectValidHtml(html);
  });

  // Telegram chegarasi 4096 belgi. Matn kesilgandan keyin qochiriladi (& -> &amp;, < -> &lt;), shuning uchun 300 belgili sarlavha
  // 1500 belgigacha o'sishi mumkin: xabar o'rtasidan kesilsa <b> yopilmay qoladi va Telegram butun xabarni rad etadi
  it('xabar 3800 belgidan oshmaydi: qochirilganda kengayadigan uzun xulosada sig\'magan bandlar butunligicha tashlanadi', async () => {
    const huge: AuditSummary = {
      headline: '&'.repeat(3000),
      priorities: [1, 2, 3, 4, 5].map(() => ({ title: '<'.repeat(500), why: '>'.repeat(900), action: '&'.repeat(900) })),
      note: '>'.repeat(1500),
    };
    expect(await sendAuditToStaff({ checks: CHECKS, summary: huge })).toBe(2);
    const html = htmlTo('7001');
    expect(html.length).toBeLessThanOrEqual(3800);
    expectValidHtml(html);
    // Sarlavha satri va (kesilgan) AI sarlavhasi joyida; birinchi band to'liq, ikkinchisi sig'maydi — yarmi emas, butunligicha yo'q
    expect(html.split('\n')).toEqual([HEADER, '&amp;'.repeat(300), '', `1. <b>${'&lt;'.repeat(120)}</b>`, '&amp;'.repeat(300)]);
    expect(html).not.toContain('2. ');
    expect(html).not.toContain('💡');
  });

  it('sig\'adigan xulosa to\'liq yuboriladi: eng uzun (kesilgan) 5 ta band, sarlavha va maslahat — hech narsa tashlanmaydi', async () => {
    const full: AuditSummary = {
      headline: 'S'.repeat(300),
      priorities: [1, 2, 3, 4, 5].map((n) => ({ title: `${n}`.repeat(120), why: 'W'.repeat(300), action: `${n}`.repeat(300) })),
      note: 'N'.repeat(400),
    };
    await sendAuditToStaff({ checks: CHECKS, summary: full });
    const html = htmlTo('7001');
    expect(html.length).toBeLessThanOrEqual(3800);
    expect(html.split('\n')).toEqual([
      HEADER, 'S'.repeat(300), '',
      ...[1, 2, 3, 4, 5].flatMap((n) => [`${n}. <b>${`${n}`.repeat(120)}</b>`, `${n}`.repeat(300)]),
      '', `💡 ${'N'.repeat(400)}`,
    ]);
    expectValidHtml(html);
  });

  it('bazadagi xulosada bandlar juda ko\'p bo\'lsa: boshidagilari to\'liq, sig\'maganlari va maslahat tashlanadi', async () => {
    // Saqlangan hisobot qo'lda o'zgartirilgan yoki eski koddan qolgan bo'lishi mumkin: 5 tadan ko'p band
    const title = (n: number) => `${n}-ish `.padEnd(120, 'T');
    const action = (n: number) => `${n}-amal `.padEnd(300, 'A');
    const many: AuditSummary = { headline: 'S'.repeat(300), priorities: Array.from({ length: 14 }, (_, i) => ({ title: title(i + 1), why: '', action: action(i + 1) })), note: 'N'.repeat(400) };
    await sendAuditToStaff({ checks: CHECKS, summary: many });
    const html = htmlTo('7001');
    expect(html.length).toBeLessThanOrEqual(3800);
    expectValidHtml(html);
    const lines = html.split('\n');
    expect(lines.slice(0, 3)).toEqual([HEADER, 'S'.repeat(300), '']);
    // Qolgan satrlar — butun bandlar (nom satri + amal satri), 1 dan boshlab uzluksiz; oxirgi band ham oxirigacha yozilgan
    const blocks = lines.slice(3);
    expect(blocks.length % 2).toBe(0);
    const kept = blocks.length / 2;
    expect(kept).toBeGreaterThanOrEqual(5);
    expect(kept).toBeLessThan(14);
    expect(blocks).toEqual(Array.from({ length: kept }, (_, i) => [`${i + 1}. <b>${title(i + 1)}</b>`, action(i + 1)]).flat());
    // Joy qolgan bo'lsa yana bitta band sig'ardi demak — tashlangani haqiqatan sig'magan
    expect(html.length + 1 + `${kept + 1}. <b>${title(kept + 1)}</b>\n${action(kept + 1)}`.length).toBeGreaterThan(3800);
  });

  it('xulosasiz xabar ham 3800 belgidan oshmaydi: nomi juda uzun tekshiruvlar butun satri bilan tashlanadi', async () => {
    const wide = Array.from({ length: 8 }, (_, i) => check({ key: `k${i}`, title: `${i}<&>`.repeat(250), count: i + 1 }));
    expect(await sendAuditToStaff({ checks: wide, summary: null })).toBe(2);
    const html = htmlTo('7001');
    expect(html.length).toBeLessThanOrEqual(3800);
    expectValidHtml(html);
    const lines = html.split('\n');
    expect(lines.slice(0, 2)).toEqual([HEADER, '']);
    // Qolgan har bir satr — to'liq tekshiruv satri: nomi oxirigacha, soni qalin
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.length).toBeLessThan(10);
    lines.slice(2).forEach((line, i) => expect(line).toBe(`🔴 ${`${i}&lt;&amp;&gt;`.repeat(250)}: <b>${i + 1}</b>`));
  });

  it('chegara aynan 3800 belgi: shuncha bo\'lgan xabar to\'liq ketadi, bir belgi ortig\'i — oxirgi satrsiz', async () => {
    const line = (title: string, n: number) => `🔴 ${title}: <b>${n}</b>`;
    const titles = (last: number) => [...Array<string>(7).fill('x'.repeat(458)), 'y'.repeat(last)];
    const whole = (last: number) => [HEADER, '', ...titles(last).map((t, i) => line(t, i + 1))].join('\n');
    const fits = 3800 - whole(0).length; // oxirgi nom shuncha belgi bo'lsa xabar aynan 3800 belgi
    expect(fits).toBeGreaterThan(0);
    const send = async (last: number) => {
      h.notifyStaff.mockClear();
      await sendAuditToStaff({ checks: titles(last).map((title, i) => check({ key: `k${i}`, title, count: i + 1 })), summary: null });
      return htmlTo('7001');
    };

    const exact = await send(fits);
    expect(exact).toHaveLength(3800);
    expect(exact).toBe(whole(fits));

    const over = await send(fits + 1);
    expect(whole(fits + 1)).toHaveLength(3801);
    expect(over).toBe(whole(fits + 1).split('\n').slice(0, -1).join('\n'));
    expectValidHtml(over);
  });

  it('hech bir band sig\'masa ham sarlavha satri yuboriladi (xodim "Batafsil" tugmasi orqali ko\'radi)', async () => {
    const wide = [check({ title: '&'.repeat(1000) })];
    expect(await sendAuditToStaff({ checks: wide, summary: null })).toBe(2);
    expect(htmlTo('7001').split('\n')[0]).toBe(HEADER);
    expect(htmlTo('7001').length).toBeLessThanOrEqual(3800);
    expectValidHtml(htmlTo('7001'));
    expect(h.notifyStaff.mock.calls[0][2]).toEqual([[{ text: '📋 Batafsil', url: 'https://test.pack24.uz/admin/audit' }]]);
  });

  it('xulosasiz (AI o\'chiq yoki xulosa buzilgan): tekshiruvlar muhimlik belgisi va soni bilan sanaladi', async () => {
    for (const summary of [null, undefined, { headline: 5 }, 'matn']) {
      h.notifyStaff.mockClear();
      await sendAuditToStaff({ checks: CHECKS, summary });
      expect(htmlTo('7001').split('\n')).toEqual([
        HEADER,
        '',
        '🔴 24 soatdan beri qabul qilinmagan yangi buyurtmalar: <b>2</b>',
        "🔴 Muddati o'tgan hisob-fakturalar (jami qoldiq 3 400 000 so'm): <b>1</b>",
        '🟠 24 soatdan beri javobsiz arizalar: <b>4</b>',
        "🟡 3 kundan beri ko'rib chiqilmagan sharhlar: <b>1</b>",
      ]);
    }
  });

  it('xulosasiz: ko\'pi bilan 8 ta tekshiruv sanaladi; nomi ham matn sifatida chiqadi', async () => {
    const many = Array.from({ length: 11 }, (_, i) => check({ key: `k${i}`, title: i === 0 ? 'Nomi <b>qalin</b> & belgili' : `Tekshiruv ${i}`, count: i + 1 }));
    await sendAuditToStaff({ checks: many, summary: null });
    const lines = htmlTo('7001').split('\n');
    expect(lines.filter((l) => l.startsWith('🔴'))).toHaveLength(8);
    expect(lines[2]).toBe('🔴 Nomi &lt;b&gt;qalin&lt;/b&gt; &amp; belgili: <b>1</b>');
    expect(lines.at(-1)).toBe('🔴 Tekshiruv 7: <b>8</b>');
    expectValidHtml(htmlTo('7001'));
  });

  it('natija — yetib borgan xabarlar soni; bitta oluvchidagi xato qolganlarini to\'xtatmaydi', async () => {
    h.staffRecipients.mockResolvedValue([staff('7001'), staff('7002'), staff('7003'), staff('7004')]);
    h.notifyStaff.mockImplementation(async (to: string) => {
      if (to === '7001') throw new Error('test: Telegram javob bermadi');
      return to !== '7003'; // 7003 botni bloklagan: notifyStaff false qaytaradi
    });
    expect(await sendAuditToStaff({ checks: CHECKS, summary: SUMMARY })).toBe(2);
    expect(h.notifyStaff.mock.calls.map((c) => c[0])).toEqual(['7001', '7002', '7003', '7004']);
  });

  it('oluvchilar ro\'yxatini o\'qib bo\'lmasa: 0, xato tashlanmaydi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.staffRecipients.mockRejectedValue(new Error('baza ulanmadi'));
    await expect(sendAuditToStaff({ checks: CHECKS, summary: SUMMARY })).resolves.toBe(0);
    expect(h.notifyStaff).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });
});

// ─── Aniq qoidalar: sozlamaga bog'liq qismi va tartib (sanoqlar haqiqiy bazada — db/audit.test.ts) ─────────────────

/** Bazadagi hamma sanoq `n` ta muammo topgandek javob beradi (0 — hech narsa topilmadi) */
function database(n: number): void {
  const p = h.prisma;
  const created = new Date('2031-03-01T05:00:00Z');
  p.order.count.mockResolvedValue(n);
  p.order.findMany.mockResolvedValue(n ? [{ id: 101, totalAmount: 250000, createdAt: created }] : []);
  p.corporateInvoice.count.mockResolvedValue(n);
  p.corporateInvoice.findMany.mockResolvedValue(n ? [{ invoiceNo: 'INV-2031-0007', totalAmount: 1200000, paidAmount: 200000, dueDate: created }] : []);
  p.corporateInvoice.aggregate.mockResolvedValue({ _sum: n ? { totalAmount: 1200000, paidAmount: 200000 } : { totalAmount: null, paidAmount: null } });
  p.workOrder.count.mockResolvedValue(n);
  p.workOrder.findMany.mockResolvedValue(n ? [{ orderNo: 'WO-2031-003', deadline: created, progress: 40 }] : []);
  p.lead.count.mockResolvedValue(n);
  p.review.count.mockResolvedValue(n);
  h.lowStockProducts.mockResolvedValue(n ? [{ id: 1, name: 'Skotch 48mm', sku: 'SK-48', inStock: true, quantity: 3 }] : []);
}
const linkedStaff = [{ id: 1, name: 'Ali', role: 'staff', phone: '998901234567', telegramId: '7001', telegramNotify: true }];

describe('tekshiruv: sozlamaga bog\'liq qoidalar va tartib (collectChecks, bazasiz)', () => {
  beforeEach(() => {
    database(0);
    h.staffRecipients.mockResolvedValue(linkedStaff);
  });
  const keys = async () => (await collectChecks(NOW)).map((c) => c.key);

  it('muammo yo\'q, rekvizitlar to\'liq: bo\'sh ro\'yxat', async () => {
    expect(await collectChecks(NOW)).toEqual([]);
  });

  it('rekvizitlar: bank rekvizitlari, yuridik nom yoki INN dan biri bo\'sh bo\'lsa ham eslatadi', async () => {
    const complete = { ...h.settings };
    for (const field of ['bankDetails', 'legalName', 'inn']) {
      h.settings = { ...complete, [field]: '' };
      expect(await collectChecks(NOW), field).toEqual([expect.objectContaining({ key: 'requisites_missing', severity: 'low', count: 1, items: [], link: '/admin/settings' })]);
    }
  });

  it('boshqaruv boti ulangan, lekin hech bir xodim ulanmagan bo\'lsa ogohlantiradi; token yo\'q yoki xodim bor bo\'lsa — yo\'q', async () => {
    // Bot hali sozlanmagan server: ogohlantirish ortiqcha
    h.staffRecipients.mockResolvedValue([]);
    expect(await keys()).toEqual([]);

    for (const env of ['STAFF_BOT_TOKEN', 'SUPERVISOR_BOT_TOKEN']) {
      vi.stubEnv('STAFF_BOT_TOKEN', undefined);
      vi.stubEnv('SUPERVISOR_BOT_TOKEN', undefined);
      vi.stubEnv(env, '222:staff-token');
      h.staffRecipients.mockResolvedValue([]);
      const found = await collectChecks(NOW);
      expect(found, env).toEqual([expect.objectContaining({ key: 'no_staff_linked', severity: 'medium', count: 1, link: '/admin/staff' })]);
      // Token qiymati hisobotga (bazaga, AI'ga va Telegram'ga ketadigan matnga) tushmaydi
      expect(JSON.stringify(found)).not.toContain('222:staff-token');
      h.staffRecipients.mockResolvedValue(linkedStaff);
      expect(await keys(), env).toEqual([]);
    }
    // Yangi buyurtma xabarini oladiganlar so'raladi ("orders" ruxsati)
    expect(h.staffRecipients).toHaveBeenCalledWith('orders');
    expect(h.staffRecipients).not.toHaveBeenCalledWith('reports');
  });

  it('ombor qoldig\'ini o\'qib bo\'lmasa qolgan tekshiruvlar ishlayveradi', async () => {
    h.lowStockProducts.mockRejectedValue(new Error('ombor topilmadi'));
    h.prisma.lead.count.mockResolvedValue(3);
    expect(await collectChecks(NOW)).toEqual([expect.objectContaining({ key: 'stale_leads', count: 3 })]);
  });

  it('hamma qoida topilma bersa: avval muhimlari, keyin o\'rtachalari, oxirida pastlari', async () => {
    database(2);
    vi.stubEnv('STAFF_BOT_TOKEN', '222:staff-token');
    h.staffRecipients.mockResolvedValue([]);
    h.settings = { ...h.settings, inn: '' };
    const found = await collectChecks(NOW);
    expect(found.map((c) => `${c.severity}:${c.key}`)).toEqual([
      'high:paid_not_started', 'high:stale_new', 'high:overdue_invoices', 'high:delivered_unpaid',
      'medium:late_production', 'medium:slow_processing', 'medium:slow_shipping', 'medium:stale_leads', 'medium:low_stock', 'medium:no_staff_linked',
      'low:failed_payments', 'low:invoices_due_soon', 'low:old_reviews', 'low:requisites_missing',
    ]);
    // Har bir havola admin panel ichida va saqlangan hisobotdan o'qilganda o'zgarmaydi
    expect(reportChecks(JSON.parse(JSON.stringify(found)))).toEqual(found);
    for (const c of found) expect(c.link, c.key).toMatch(/^\/admin\/[a-z]+/);
  });
});

// ─── Hisobotni saqlash va kunlik ish ─────────────────────────────────────────

describe('tekshiruv: hisobotni saqlash (runAudit, dailyAudit — bazasiz)', () => {
  type Created = { data: { trigger: string; checks: unknown; summary?: unknown; model: string | null; createdAt: Date } };

  beforeEach(() => {
    database(0);
    h.prisma.lead.count.mockResolvedValue(4);
    h.prisma.auditReport.create.mockImplementation(async ({ data }: Created) => ({ id: 77, ...data, summary: data.summary ?? null }));
    h.prisma.auditReport.deleteMany.mockResolvedValue({ count: 0 });
    h.staffRecipients.mockImplementation(async (section: string) => (section === 'reports' ? [{ ...linkedStaff[0], role: 'manager', telegramId: '7009' }] : linkedStaff));
  });
  const created = (i = 0) => (h.prisma.auditReport.create.mock.calls[i][0] as Created).data;

  it('AI yoqilgan: topilmalar bilan birga xulosa va uni yozgan model saqlanadi', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => message(SUMMARY, { model: 'claude-opus-5-5-20260801' }));
    const report = await runAudit('manual', NOW);
    expect(report.id).toBe(77);
    expect(created()).toMatchObject({ trigger: 'manual', summary: SUMMARY, model: 'claude-opus-5-5-20260801', createdAt: NOW });
    expect(reportChecks(created().checks).map((c) => [c.key, c.count])).toEqual([['stale_leads', 4]]);
    // AI'ga aynan shu topilmalar ketgan
    expect(sentChecks()).toEqual([{ key: 'stale_leads', severity: 'medium', title: '24 soatdan beri javobsiz arizalar', count: 4, examples: [] }]);
  });

  it('AI sozlanmagan yoki xato bergan: hisobot xulosasiz saqlanadi', async () => {
    await runAudit('cron', NOW);
    expect(created()).toMatchObject({ trigger: 'cron', model: null, createdAt: NOW });
    expect(created().summary ?? null).toBeNull();
    expect(h.http).not.toHaveBeenCalled();

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => apiError(500, 'api_error', 'internal'));
    h.prisma.auditReport.create.mockClear();
    await runAudit('manual', NOW);
    expect(created()).toMatchObject({ trigger: 'manual', model: null });
    expect(created().summary ?? null).toBeNull();
    expect(reportChecks(created().checks)).toHaveLength(1);
  });

  // Baza (JSONB) NUL kabi boshqaruv belgilarini rad etadi: ular AI matnidan olib tashlanadi, aks holda butun hisobot saqlanmay qolardi
  it('AI matnidagi boshqaruv belgilari (NUL va h.k.) saqlashdan oldin olib tashlanadi; satr boshi va tabulyatsiya qoladi', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => message({ headline: 'Bugun\u0000 2 ta\u0007 ish', priorities: [{ title: 'Yangi\u0001 buyurtma', why: 'pul\u001f', action: 'Qabul\tqiling\nbugun' }], note: 'Eslatma\u0000' }));
    await runAudit('manual', NOW);
    expect(created().summary).toEqual({ headline: 'Bugun 2 ta ish', priorities: [{ title: 'Yangi buyurtma', why: 'pul', action: 'Qabul\tqiling\nbugun' }], note: 'Eslatma' });
    expect(JSON.stringify(created().summary)).not.toMatch(/\\u000[0-8]|\\u001f/);
  });

  // Aniq qoidalar bo'yicha topilgan natija AI matniga bog'liq bo'lmasligi kerak
  it('xulosali hisobotni bazaga yozib bo\'lmasa: xulosasiz qayta saqlanadi — topilmalar yo\'qolmaydi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => message(SUMMARY));
    h.prisma.auditReport.create.mockImplementationOnce(async () => { throw new Error('unsupported Unicode escape sequence'); });
    const report = await runAudit('cron', NOW);
    expect(report.id).toBe(77);
    expect(h.prisma.auditReport.create).toHaveBeenCalledTimes(2);
    expect(created(0)).toMatchObject({ summary: SUMMARY });
    expect(created(1)).toMatchObject({ trigger: 'cron', model: null, createdAt: NOW });
    expect(created(1).summary ?? null).toBeNull();
    expect(reportChecks(created(1).checks)).toHaveLength(1);
    expect(log).toHaveBeenCalledTimes(1);
    // AI'siz hisobotning o'zi yozilmasa xato yashirilmaydi (cron uni "failed" deb qaytaradi)
    h.prisma.auditReport.create.mockClear();
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    h.prisma.auditReport.create.mockImplementationOnce(async () => { throw new Error('baza ulanmadi'); });
    await expect(runAudit('cron', NOW)).rejects.toThrow('baza ulanmadi');
    expect(h.prisma.auditReport.create).toHaveBeenCalledTimes(1);
  });

  // Oraliq server (proksi) xato matnida so'rov sarlavhasini — ya'ni kalitni — qaytarishi mumkin: u logga ham chiqmaydi
  it('API xato matnida kalit qaytarilgan bo\'lsa ham u logga yozilmaydi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => apiError(400, 'invalid_request_error', `proxy rejected header x-api-key: ${KEY}`));
    await runAudit('manual', NOW);
    const logged = log.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).toContain('API xatosi');
    expect(logged).not.toContain(KEY);
    expect(logged).toContain('***');
  });

  // runAudit kim ishga tushirganini summarize'ga uzatadi: chegara, kutish vaqti va qayta urinish shunga bog'liq
  it('qo\'lda ishga tushirilgan tekshiruv kunlik chegaraga bo\'ysunadi: chegara tugagan bo\'lsa hisobot xulosasiz saqlanadi', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => message(SUMMARY));
    useUp(300);
    await runAudit('manual', NOW);
    expect(h.http).not.toHaveBeenCalled();
    expect(created()).toMatchObject({ trigger: 'manual', model: null });
    expect(created().summary ?? null).toBeNull();
    expect(reportChecks(created().checks)).toHaveLength(1);
    expect(used()?.requests).toBe(300);

    // Chegaragacha joy bo'lsa: 40 soniyalik so'rov
    useUp(299);
    await runAudit('manual', NOW);
    expect(created(1)).toMatchObject({ trigger: 'manual', summary: SUMMARY });
    expect(sent(0).headers.get('x-stainless-timeout')).toBe('40');
    expect(h.prisma.aiUsage.updateMany.mock.calls.at(-1)?.[0]).toMatchObject({ where: { day: TODAY, requests: { lt: 300 } } });
  });

  it('kunlik (cron) tekshiruv: mijozlar chegarani tugatib qo\'ygan kuni ham ega xulosasiz qolmaydi', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => message(SUMMARY));
    useUp(300);
    await runAudit('cron', NOW);
    expect(h.http).toHaveBeenCalledTimes(1);
    expect(created()).toMatchObject({ trigger: 'cron', summary: SUMMARY, model: 'claude-opus-5-5' });
    expect(sent(0).headers.get('x-stainless-timeout')).toBe('120');
    expect(h.prisma.aiUsage.updateMany.mock.calls.at(-1)?.[0]).toEqual({ where: { day: TODAY }, data: { requests: { increment: 1 } } });
    expect(used()).toEqual({ requests: 301, inputTokens: 812, outputTokens: 240 });
  });

  it('kunlik ish: hisobot saqlanadi, "reports" xodimlariga boradi, 90 kundan eski hisobotlar o\'chiriladi', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => message(SUMMARY));
    useUp(300); // kunlik ish — cron: chegara to'lgan bo'lsa ham xulosa olinadi
    expect(await dailyAudit(NOW)).toEqual({ findings: 1, sent: 1, ai: true });
    expect(created().trigger).toBe('cron');
    expect(h.notifyStaff).toHaveBeenCalledTimes(1);
    expect(h.notifyStaff.mock.calls[0][0]).toBe('7009');
    expect(h.notifyStaff.mock.calls[0][1]).toContain(SUMMARY.headline);
    expect(h.prisma.auditReport.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date(NOW.getTime() - 90 * DAY_MS) } } });
  });

  it('kunlik ish: AI javobi yaroqsiz bo\'lsa hisobot xulosasiz saqlanadi va xodimlarga oddiy ro\'yxat boradi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => message('{"headline":"Bugun', { stop_reason: 'max_tokens' }));
    expect(await dailyAudit(NOW)).toEqual({ findings: 1, sent: 1, ai: false });
    expect(created().summary ?? null).toBeNull();
    expect(created().model).toBeNull();
    expect(h.notifyStaff.mock.calls[0][1]).toBe(`${HEADER}\n\n🟠 24 soatdan beri javobsiz arizalar: <b>4</b>`);
    // Uzilgan javob uchun ham pul sarflangan
    expect(used()).toEqual({ requests: 1, inputTokens: 812, outputTokens: 240 });
    expect(log).toHaveBeenCalled();
  });

  it('kunlik ish: AI\'siz ham ishlaydi; eski hisobotlarni o\'chirishdagi xato natijani buzmaydi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.prisma.auditReport.deleteMany.mockRejectedValue(new Error('baza band'));
    await expect(dailyAudit(NOW)).resolves.toEqual({ findings: 1, sent: 1, ai: false });
    expect(h.notifyStaff.mock.calls[0][1]).toContain('🟠 24 soatdan beri javobsiz arizalar: <b>4</b>');
    expect(log).toHaveBeenCalled();
  });

  it('kunlik ish: muammo topilmasa hisobot baribir saqlanadi, lekin xodimlar bezovta qilinmaydi', async () => {
    h.prisma.lead.count.mockResolvedValue(0);
    expect(await dailyAudit(NOW)).toEqual({ findings: 0, sent: 0, ai: false });
    expect(h.prisma.auditReport.create).toHaveBeenCalledTimes(1);
    expect(h.notifyStaff).not.toHaveBeenCalled();
  });
});

// ─── Cron: tekshiruv tick ichida (vaqt va holat haqiqiy bazada — db/cron.test.ts) ────────────────────────────────

describe('cron: kunlik tekshiruv tick ichida (bazasiz)', () => {
  beforeEach(() => {
    database(0);
    h.prisma.siteSetting.findUnique.mockResolvedValue(null);
    h.prisma.siteSetting.upsert.mockResolvedValue({});
    h.prisma.auditReport.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, summary: null, ...data }));
    h.prisma.auditReport.deleteMany.mockResolvedValue({ count: 0 });
  });
  const TEN = new Date('2031-03-10T05:00:00Z'); // Toshkentda 10:00 — tekshiruv ham, eslatma ham vaqti kelgan
  /** Fonda qolgan ish bo'lsa ulgurib bo'lsin (soxta baza darhol javob beradi) */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  // auto-update.sh cron so'rovini 60 soniyada uzadi: AI yoki baza sekin bo'lsa tick shu vaqt ichida javob berishi kerak
  it('tekshiruv 25 soniyadan uzoq cho\'zilsa tick kutmaydi ("running"); kun allaqachon belgilangan — qayta boshlanmaydi', async () => {
    vi.useFakeTimers();
    h.prisma.order.count.mockReturnValue(new Promise(() => undefined)); // baza javob bermayapti
    let result: unknown;
    const tick = runTick(NOW).then((r) => { result = r; });
    await vi.advanceTimersByTimeAsync(24_999);
    expect(result).toBeUndefined();
    expect(h.prisma.siteSetting.upsert).toHaveBeenCalledTimes(1);
    expect(h.prisma.siteSetting.upsert.mock.calls[0][0]).toMatchObject({ where: { key: 'cron' }, create: { key: 'cron', value: { auditDay: '2031-03-10' } }, update: { value: { auditDay: '2031-03-10' } } });
    await vi.advanceTimersByTimeAsync(1);
    await tick;
    expect(result).toEqual({ digest: null, audit: 'running' });
    expect(h.sendDailyDigest).not.toHaveBeenCalled();
  });

  it('tekshiruv va eslatma bir tickda: tekshiruv osilib qolsa ham eslatma yuboriladi', async () => {
    vi.useFakeTimers();
    h.prisma.order.count.mockReturnValue(new Promise(() => undefined));
    h.sendDailyDigest.mockResolvedValue({ finance: 1, orders: 2 });
    const tick = runTick(TEN);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(await tick).toEqual({ digest: { finance: 1, orders: 2 }, audit: 'running' });
    expect(h.sendDailyDigest).toHaveBeenCalledWith(TEN);
    expect(h.prisma.siteSetting.upsert.mock.calls[0][0]).toMatchObject({ update: { value: { auditDay: '2031-03-10', digestDay: '2031-03-10' } } });
  });

  it('tick kutib bo\'lgandan keyin yiqilgan tekshiruv: javob "running" bo\'lib ketgan, xato esa logga yoziladi (ushlanmagan xato qolmaydi)', async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Baza 30 soniyadan keyin xato qaytaradi — tick 25 soniyada javob berib bo'lgan
    h.prisma.order.count.mockImplementation(() => new Promise((_, reject) => { setTimeout(() => reject(new Error('baza uzildi')), 30_000); }));
    const tick = runTick(NOW);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(await tick).toEqual({ digest: null, audit: 'running' });
    expect(log).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('[cron] kunlik tekshiruv');
    expect(String(log.mock.calls[0][1])).toContain('baza uzildi');
    expect(h.prisma.auditReport.create).not.toHaveBeenCalled();
  });

  it('tekshiruv ulgursa natijasi tick javobida qaytadi', async () => {
    h.prisma.review.count.mockResolvedValue(2);
    expect(await runTick(NOW)).toEqual({ digest: null, audit: { findings: 1, sent: 0, ai: false } });
    expect(h.prisma.auditReport.create.mock.calls[0][0]).toMatchObject({ data: { trigger: 'cron', createdAt: NOW } });
  });

  it('tick ichidagi tekshiruv — cron: AI xulosasi umumiy chegara tugagan bo\'lsa ham so\'raladi', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => message(SUMMARY));
    useUp(300);
    h.prisma.review.count.mockResolvedValue(2);
    expect(await runTick(NOW)).toEqual({ digest: null, audit: { findings: 1, sent: 0, ai: true } });
    expect(h.http).toHaveBeenCalledTimes(1);
    expect(sent(0).headers.get('x-stainless-timeout')).toBe('120');
    expect(h.prisma.auditReport.create.mock.calls[0][0]).toMatchObject({ data: { trigger: 'cron', summary: SUMMARY } });
  });

  // settleWithin xatoda ham, kechikishda ham undefined qaytaradi: yiqilgan tekshiruv "running" (fonda davom etyapti) bo'lib ko'rinmasin
  it('tekshiruv xato bilan tugasa tick javobida "running" emas, "failed"; sababi logga yoziladi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.prisma.order.count.mockRejectedValue(new Error('baza ulanmadi'));
    expect(await runTick(NOW)).toEqual({ digest: null, audit: 'failed' });
    expect(h.prisma.auditReport.create).not.toHaveBeenCalled();
    expect(h.notifyStaff).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('[cron] kunlik tekshiruv');
    expect(String(log.mock.calls[0][1])).toContain('baza ulanmadi');
    // Kun tekshiruvdan OLDIN belgilangan: yiqilgan tekshiruv har 5 daqiqalik tickda qayta urinilmaydi
    expect(h.prisma.siteSetting.upsert).toHaveBeenCalledTimes(1);
    expect(h.prisma.siteSetting.upsert.mock.calls[0][0]).toMatchObject({ update: { value: { auditDay: '2031-03-10' } } });
  });

  it('hisobotni saqlashda xato (tekshiruvning oxirgi bosqichi): bu ham "failed", xodimlarga hech narsa ketmaydi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.prisma.lead.count.mockResolvedValue(4);
    h.staffRecipients.mockResolvedValue(linkedStaff);
    h.prisma.auditReport.create.mockRejectedValue(new Error('disk to\'la'));
    expect((await runTick(NOW)).audit).toBe('failed');
    expect(h.notifyStaff).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('tekshiruv xato bilan tugasa ham tick yiqilmaydi va shu tickdagi eslatma yuboriladi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.prisma.order.count.mockRejectedValue(new Error('baza ulanmadi'));
    h.sendDailyDigest.mockResolvedValue({ finance: 0, orders: 3 });
    expect(await runTick(TEN)).toEqual({ digest: { finance: 0, orders: 3 }, audit: 'failed' });
    expect(h.sendDailyDigest).toHaveBeenCalledTimes(1);
    expect(h.sendDailyDigest).toHaveBeenCalledWith(TEN);
    expect(h.prisma.auditReport.create).not.toHaveBeenCalled();
    expect(h.prisma.siteSetting.upsert.mock.calls[0][0]).toMatchObject({ update: { value: { auditDay: '2031-03-10', digestDay: '2031-03-10' } } });
    expect(log).toHaveBeenCalled();
  });

  it('yiqilgan tekshiruvdan keyingi tick (kun belgilangan): tekshiruv qayta boshlanmaydi', async () => {
    h.prisma.siteSetting.findUnique.mockResolvedValue({ key: 'cron', value: { auditDay: '2031-03-10', digestDay: '2031-03-10' } });
    expect(await runTick(new Date('2031-03-10T05:05:00Z'))).toEqual({ digest: null, audit: null });
    await settle();
    expect(h.prisma.order.count).not.toHaveBeenCalled();
    expect(h.prisma.siteSetting.upsert).not.toHaveBeenCalled();
    expect(h.sendDailyDigest).not.toHaveBeenCalled();
  });

  // Tekshiruv 08:00 da bajarilgan, 09:00 da faqat eslatma vaqti keladi: shu tickda tekshiruv yana ishga tushsa xodimlar har kuni
  // ikkita bir xil xabar oladi, AI'ga esa (chegaradan tashqari) ikkinchi so'rov ketadi
  it('faqat eslatma vaqti kelgan tick (tekshiruv bugun bajarilgan): tekshiruv fonda ham qayta ishga tushmaydi', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', KEY);
    respond(() => message(SUMMARY));
    h.prisma.siteSetting.findUnique.mockResolvedValue({ key: 'cron', value: { auditDay: '2031-03-10' } });
    h.prisma.lead.count.mockResolvedValue(4); // tekshiruv ishga tushsa topilma bo'lardi va xodimlarga xabar ketardi
    h.staffRecipients.mockResolvedValue(linkedStaff);
    h.sendDailyDigest.mockResolvedValue({ finance: 1, orders: 2 });
    const nine = new Date('2031-03-10T04:00:00Z'); // Toshkentda 09:00

    expect(await runTick(nine)).toEqual({ digest: { finance: 1, orders: 2 }, audit: null });
    await settle();
    expect(h.prisma.order.count).not.toHaveBeenCalled();
    expect(h.prisma.auditReport.create).not.toHaveBeenCalled();
    expect(h.notifyStaff).not.toHaveBeenCalled();
    expect(h.http).not.toHaveBeenCalled();
    expect(used()).toBeNull();
    expect(h.prisma.siteSetting.upsert.mock.calls[0][0]).toMatchObject({ update: { value: { auditDay: '2031-03-10', digestDay: '2031-03-10' } } });
  });
});
