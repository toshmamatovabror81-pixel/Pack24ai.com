import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formatDate, formatPrice, toNumber } from '@/lib/format';
import { lowStockProducts } from '@/lib/inventory';
import { OPEN_INVOICE_STATUSES, overdueCutoff, overdueInvoiceWhere, OWED_ORDER } from '@/lib/invoiceStatus';
import { alertChats, readOps } from '@/lib/ops';
import { getSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import { tashkentClock } from '@/lib/tashkent';
import { clip, esc } from '@/lib/telegram/api';
import { botToken } from '@/lib/telegram/bots';
import { notifyStaff } from '@/lib/telegram/notify';
import { outboxStats } from '@/lib/telegram/outbox';
import { staffRecipients } from '@/lib/telegram/staffLink';
import { aiClient, aiConfigured, aiModel, fallbackParams, recordAiUsage, reserveAiRequest, withoutKeys } from './client';

/**
 * Kunlik tekshiruv. Ikki qism:
 *  1) Aniq qoidalar (collectChecks): javobsiz buyurtmalar, to'lanmagan yetkazilganlar, muddati o'tgan hisob-fakturalar,
 *     kechikkan ishlab chiqarish, kam qoldiq va h.k. — bular bazadan hisoblanadi, AI'ga bog'liq emas va har doim to'g'ri.
 *  2) AI xulosasi (summarize): Claude topilmalarni muhimligi bo'yicha tartiblab, nima qilish kerakligini o'zbekcha yozadi.
 *     AI'ga faqat raqamlar va buyurtma/hisob-faktura raqamlari yuboriladi — mijoz ismi, telefoni yoki manzili yuborilmaydi.
 * AI kaliti bo'lmasa yoki xato bersa hisobot xulosasiz saqlanadi.
 */

export type Severity = 'high' | 'medium' | 'low';
export type AuditCheck = { key: string; severity: Severity; title: string; count: number; items: string[]; link: string };
export type AuditSummary = { headline: string; priorities: { title: string; why: string; action: string }[]; note: string };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const sum = (v: unknown) => formatPrice(v as number, "so'm");
const ago = (now: Date, ms: number) => new Date(now.getTime() - ms);
const ITEMS = 8;

/** Bazadan hisoblanadigan tekshiruvlar; faqat muammo topilganlari qaytadi (muhimlari tepada) */
export async function collectChecks(now = new Date()): Promise<AuditCheck[]> {
  const settings = await getSettings();
  const live: Prisma.OrderWhereInput = { deletedAt: null };
  const orderItem = (o: { id: number; totalAmount: unknown; createdAt: Date }) => `#${o.id} · ${formatDate(o.createdAt, 'uz')} · ${sum(o.totalAmount)}`;
  const orderSelect = { id: true, totalAmount: true, createdAt: true } as const;
  const orders = (where: Prisma.OrderWhereInput) =>
    Promise.all([prisma.order.count({ where: { ...live, ...where } }), prisma.order.findMany({ where: { ...live, ...where }, orderBy: { id: 'asc' }, take: ITEMS, select: orderSelect })]);
  /**
   * Shu holatda `days` kundan beri turgan buyurtmalar. Holatga qachon o'tgani tarixdan (OrderEvent) olinadi: confirmedAt/shippedAt
   * faqat birinchi marta qo'yiladi (onlayn to'lovda — to'lov paytida, buyurtma hali "yangi" bo'lsa ham), shuning uchun ular
   * faqat tarixi yo'q eski buyurtmalar uchun ishlatiladi.
   */
  const stuck = (status: 'processing' | 'shipping', days: number, legacy: 'confirmedAt' | 'shippedAt') => orders({
    status,
    events: { none: { kind: 'status', toValue: status, createdAt: { gte: ago(now, days * DAY) } } },
    OR: [{ events: { some: { kind: 'status', toValue: status } } }, { [legacy]: { lt: ago(now, days * DAY) } }],
  });
  // Ishlab chiqarish muddati — sana (soatsiz): bugungi muddat hali o'tmagan (admin sahifasidagi isOverdue bilan bir xil qoida)
  const lateWorkWhere: Prisma.WorkOrderWhereInput = { status: { in: ['planned', 'in_progress', 'paused'] }, deadline: { lt: new Date(`${tashkentClock(now).day}T00:00:00.000Z`) } };

  const [
    [staleNew, staleNewRows], [paidNotStarted, paidNotStartedRows], [slowProcessing, slowProcessingRows], [slowShipping, slowShippingRows],
    [deliveredUnpaid, deliveredUnpaidRows], [failedPay, failedPayRows],
    overdueCount, overdueRows, overdueSum, dueSoon, lateWork, lateWorkRows, staleLeads, oldReviews, lowStock, linkedStaff, ops, queue, alertAdmins,
  ] = await Promise.all([
    orders({ status: 'new_', createdAt: { lt: ago(now, DAY) } }),
    orders({ status: 'new_', paymentStatus: 'paid', createdAt: { lt: ago(now, 2 * HOUR) } }),
    stuck('processing', 5, 'confirmedAt'),
    stuck('shipping', 5, 'shippedAt'),
    // Ochiq hisob-fakturasi bor buyurtma bu yerga kirmaydi: muddati kelmagan bo'lsa mijoz kechikmagan, o'tgan bo'lsa "muddati o'tgan hisob-fakturalar"da turadi
    orders({ status: 'delivered', paymentStatus: { in: ['pending', 'failed'] }, deliveredAt: { lt: ago(now, 3 * DAY) }, corporateInvoices: { none: { status: { in: OPEN_INVOICE_STATUSES } } } }),
    // To'lov qachon o'tmagani tarixdan olinadi (updatedAt har qanday o'zgarishda yangilanadi)
    orders({ paymentStatus: 'failed', status: { notIn: ['cancelled', 'draft'] }, events: { some: { kind: 'payment', toValue: 'failed', createdAt: { gt: ago(now, DAY) } } } }),
    prisma.corporateInvoice.count({ where: overdueInvoiceWhere(now) }),
    prisma.corporateInvoice.findMany({ where: overdueInvoiceWhere(now), orderBy: { dueDate: 'asc' }, take: ITEMS, select: { invoiceNo: true, totalAmount: true, paidAmount: true, dueDate: true } }),
    prisma.corporateInvoice.aggregate({ where: overdueInvoiceWhere(now), _sum: { totalAmount: true, paidAmount: true } }),
    prisma.corporateInvoice.count({ where: { status: { in: OPEN_INVOICE_STATUSES }, order: OWED_ORDER, dueDate: { gte: overdueCutoff(now), lt: new Date(overdueCutoff(now).getTime() + 4 * DAY) } } }),
    prisma.workOrder.count({ where: lateWorkWhere }),
    prisma.workOrder.findMany({ where: lateWorkWhere, orderBy: { deadline: 'asc' }, take: ITEMS, select: { orderNo: true, deadline: true, progress: true } }),
    prisma.lead.count({ where: { status: 'new_', createdAt: { lt: ago(now, DAY) } } }),
    prisma.review.count({ where: { status: 'pending', createdAt: { lt: ago(now, 3 * DAY) } } }),
    lowStockProducts(settings.lowStockThreshold).catch(() => []),
    staffRecipients('orders').catch(() => []),
    readOps(now).catch(() => null),
    outboxStats(now).catch(() => ({ pending: 0, stuck: 0, failed24h: 0 })),
    alertChats().catch(() => null),
  ]);

  const checks: AuditCheck[] = [];
  const add = (c: AuditCheck) => { if (c.count > 0) checks.push(c); };
  add({ key: 'paid_not_started', severity: 'high', title: "To'lovi kelgan, lekin hali qabul qilinmagan buyurtmalar (2 soatdan ortiq)", count: paidNotStarted, items: paidNotStartedRows.map(orderItem), link: `/admin/orders?status=new_` });
  add({ key: 'stale_new', severity: 'high', title: '24 soatdan beri qabul qilinmagan yangi buyurtmalar', count: staleNew, items: staleNewRows.map(orderItem), link: `/admin/orders?status=new_` });
  add({ key: 'overdue_invoices', severity: 'high', title: `Muddati o'tgan hisob-fakturalar (jami qoldiq ${sum(toNumber(overdueSum._sum.totalAmount) - toNumber(overdueSum._sum.paidAmount))})`, count: overdueCount, items: overdueRows.map((i) => `${i.invoiceNo} · qoldiq ${sum(toNumber(i.totalAmount) - toNumber(i.paidAmount))} · muddat ${formatDate(i.dueDate, 'uz')}`), link: `/admin/invoices?status=overdue` });
  add({ key: 'delivered_unpaid', severity: 'high', title: "Yetkazilgan, lekin 3 kundan beri to'lanmagan buyurtmalar", count: deliveredUnpaid, items: deliveredUnpaidRows.map(orderItem), link: `/admin/orders?status=delivered` });
  add({ key: 'late_production', severity: 'medium', title: "Muddati o'tgan ishlab chiqarish topshiriqlari", count: lateWork, items: lateWorkRows.map((w) => `${w.orderNo} · muddat ${formatDate(w.deadline, 'uz')} · ${w.progress}%`), link: `/admin/production` });
  add({ key: 'slow_processing', severity: 'medium', title: '5 kundan beri "Tayyorlanmoqda" holatida turgan buyurtmalar', count: slowProcessing, items: slowProcessingRows.map(orderItem), link: `/admin/orders?status=processing` });
  add({ key: 'slow_shipping', severity: 'medium', title: '5 kundan beri "Yo\'lda" holatida turgan buyurtmalar', count: slowShipping, items: slowShippingRows.map(orderItem), link: `/admin/orders?status=shipping` });
  add({ key: 'stale_leads', severity: 'medium', title: '24 soatdan beri javobsiz arizalar', count: staleLeads, items: [], link: `/admin/leads` });
  add({ key: 'low_stock', severity: 'medium', title: `Omborda kam qolgan mahsulotlar (${settings.lowStockThreshold} dona va undan kam)`, count: lowStock.length, items: lowStock.slice(0, ITEMS).map((p) => `${clip(p.name, 60)} · ${p.quantity} dona`), link: `/admin/inventory?low=1` });
  add({ key: 'failed_payments', severity: 'low', title: "Oxirgi 24 soatda o'tmagan onlayn to'lovlar", count: failedPay, items: failedPayRows.map(orderItem), link: `/admin/orders` });
  add({ key: 'invoices_due_soon', severity: 'low', title: "To'lov muddati 3 kun ichida tugaydigan hisob-fakturalar", count: dueSoon, items: [], link: `/admin/invoices` });
  add({ key: 'old_reviews', severity: 'low', title: "3 kundan beri ko'rib chiqilmagan sharhlar", count: oldReviews, items: [], link: `/admin/reviews` });
  // Sozlamalar: bot ulangan-u, hech bir xodim ulanmagan bo'lsa yangi buyurtma xabarlari hech kimga bormaydi
  if (botToken('staff') && linkedStaff.length === 0) add({ key: 'no_staff_linked', severity: 'medium', title: "Boshqaruv botiga hech bir xodim ulanmagan — yangi buyurtma xabarlari hech kimga bormayapti", count: 1, items: [], link: `/admin/staff` });
  if (!settings.bankDetails || !settings.legalName || !settings.inn) add({ key: 'requisites_missing', severity: 'low', title: "Kompaniya rekvizitlari to'liq kiritilmagan (hisob-faktura va mijoz botidagi «Rekvizitlar» bo'sh chiqadi)", count: 1, items: [], link: `/admin/settings` });
  // Server nosozligi xabarlari (deploy/watchdog.sh) faqat botga ulangan administratorlarga boradi: ular bo'lmasa muammo faqat server logida qoladi
  if (botToken('staff') && alertAdmins && alertAdmins.length === 0) add({ key: 'ops_no_admin', severity: 'medium', title: "Boshqaruv botiga hech bir administrator ulanmagan — sayt ishlamay qolsa yoki serverda muammo chiqsa Telegram xabari hech kimga bormaydi", count: 1, items: [], link: '/admin/staff' });
  // Bot xabarlari navbati: Telegram'ga yetib bormayotgan xabarlar
  add({ key: 'outbox_failed', severity: 'medium', title: "Oxirgi 24 soatda Telegram'ga yetkazib bo'lmagan bot xabarlari (qayta urinishlar tugadi)", count: queue.failed24h, items: [], link: '/admin/audit' });
  add({ key: 'outbox_stuck', severity: 'medium', title: "Bir soatdan beri yuborilmay turgan bot xabarlari (server Telegram'ga ulana olmayapti)", count: queue.stuck, items: [], link: '/admin/audit' });
  // Server holati (deploy/watchdog.sh yuboradi). Hali umuman kelmagan bo'lsa (eski server skripti) tekshirilmaydi
  if (ops) {
    const s = ops.state;
    const one = (key: string, severity: Severity, title: string) => add({ key, severity, title, count: 1, items: [], link: '/admin/audit' });
    if (ops.stale) one('ops_stale', 'medium', `Server kuzatuvi signali kelmayapti (oxirgisi ${formatDate(s.at, 'uz', true)}) — avtomatik yangilanish va kuzatuv to'xtagan bo'lishi mumkin`);
    else {
      if (s.disk >= 90) one('ops_disk', 'high', `Serverda joy tugayapti: disk ${s.disk}% band`);
      else if (s.disk >= 80) one('ops_disk', 'medium', `Server diski ${s.disk}% band`);
      if (s.backupAgeH < 0) one('ops_backup', 'high', 'Zaxira nusxa topilmadi');
      else if (s.backupAgeH >= 30) one('ops_backup', 'high', `Zaxira nusxa ${s.backupAgeH} soatdan beri olinmagan`);
      if (s.restoreOk === 0) one('ops_restore', 'high', "Zaxira nusxani sinov tariqasida tiklab bo'lmadi — nusxa yaroqsiz bo'lishi mumkin");
      if (s.offsiteOk === 0) one('ops_offsite', 'medium', "Zaxira nusxani Telegram'ga (serverdan tashqariga) yuborib bo'lmadi");
      if (s.certDays === 0) one('ops_cert', 'high', 'HTTPS sertifikat muddati tugagan yoki bugun tugaydi');
      else if (s.certDays > 0 && s.certDays < 7) one('ops_cert', 'high', `HTTPS sertifikat muddati ${s.certDays} kundan keyin tugaydi`);
      else if (s.certDays >= 0 && s.certDays < 21) one('ops_cert', 'medium', `HTTPS sertifikat muddati ${s.certDays} kundan keyin tugaydi`);
      if (s.siteOk === 0) one('ops_site', 'high', 'Sayt internetdan ochilmayapti (server ichidan ishlayapti)');
    }
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return checks.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

const SUMMARY_SCHEMA = z.object({
  headline: z.string().describe("Bir jumlali umumiy holat, o'zbek tilida (lotin)"),
  priorities: z.array(z.object({
    title: z.string().describe('Muammo nomi, qisqa'),
    why: z.string().describe('Nima uchun muhim: pul, mijoz yoki muddat nuqtai nazaridan, 1 jumla'),
    action: z.string().describe("Bugun aniq nima qilish kerak, 1-2 jumla, admin paneldagi bo'lim nomi bilan"),
  })).describe("Eng muhim 1-5 ta ish, muhimlik tartibida"),
  note: z.string().describe("Takrorlanayotgan sabab yoki jarayonni yaxshilash bo'yicha bitta amaliy maslahat; bo'lmasa bo'sh satr"),
});

const SUMMARY_SYSTEM = `You are the operations analyst of Pack24 (pack24.uz), a packaging manufacturer and online wholesaler in Tashkent. Every morning you receive the list of problems that the system's deterministic checks found in the order, payment, invoice, production, stock and lead data. Write the owner's morning briefing.

Rules
- Write in Uzbek (Latin script), plain business language for a non-technical owner. No Markdown.
- Use only the numbers given in the input; never invent orders, sums or causes. If the input is small, the briefing is small.
- Order priorities by money at risk and customer impact: paid-but-unprocessed orders and unanswered new orders first, then overdue invoices and unpaid delivered orders, then production delays, then the rest.
- Each action must be something a manager can do today in the admin panel or by calling the customer; name the admin section (Buyurtmalar, Hisob-fakturalar, Ishlab chiqarish, Ombor, Arizalar, Xodimlar, Sozlamalar).
- At most 5 priorities; merge related checks into one item when the action is the same.`;

/**
 * AI xulosasi; kalit yo'q, topilma yo'q, kunlik chegara tugagan yoki xato bo'lsa null. Kunlik avtomatik xulosa (cron) umumiy
 * chegaradan tashqari sanaladi (kuniga bitta so'rov: mijozlar chegarani tugatib qo'ygan kuni ham ega xulosasiz qolmaydi) va
 * uzoqroq kutiladi — u fonda bajariladi; sahifadagi tugma esa 40 s dan uzoq kuttirmaydi.
 */
export async function summarize(checks: AuditCheck[], now = new Date(), trigger: 'cron' | 'manual' = 'manual'): Promise<{ summary: AuditSummary; model: string } | null> {
  if (!aiConfigured() || !checks.length) return null;
  const model = aiModel();
  try {
    // So'rov yuborilishidan oldin sanaladi: javobsiz qolgani ham hisobda turadi
    if (!(await reserveAiRequest(now, { force: trigger === 'cron' }))) return null;
    const response = await aiClient().beta.messages.create({
      model,
      max_tokens: 8000,
      system: SUMMARY_SYSTEM,
      output_config: { effort: 'medium', format: betaZodOutputFormat(SUMMARY_SCHEMA) },
      messages: [{ role: 'user', content: `Sana: ${formatDate(now, 'uz')}.\nTekshiruv natijalari (JSON):\n${JSON.stringify(checks.map(({ key, severity, title, count, items }) => ({ key, severity, title, count, examples: items })))}` }],
      ...fallbackParams(model),
    }, trigger === 'cron' ? { timeout: 120_000, maxRetries: 1 } : { timeout: 40_000, maxRetries: 0 });
    // Sarf javob kelishi bilan yoziladi — javob yaroqsiz chiqsa ham (rad etish, kesilgan JSON) pul sarflangan
    await recordAiUsage({ inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }, now);
    if (response.stop_reason === 'refusal') return null;
    const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      console.error(`[ai] tekshiruv: javob JSON emas (stop_reason: ${response.stop_reason})`);
      return null;
    }
    const parsed = SUMMARY_SCHEMA.safeParse(raw);
    if (!parsed.success) {
      console.error("[ai] tekshiruv: javob kutilgan shaklda emas");
      return null;
    }
    const out = parsed.data;
    // Uzunliklar shu yerda cheklanadi: sahifada ham, Telegram xabarida ham (4096 belgi) bir xil matn chiqadi
    // Boshqaruv belgilari (masalan NUL) olib tashlanadi: baza (JSONB) ularni rad etadi va butun hisobot saqlanmay qolardi
    const tidy = (s: string, max: number) => clip(s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''), max);
    const priorities = out.priorities.slice(0, 5).map((p) => ({ title: tidy(p.title, 120), why: tidy(p.why, 300), action: tidy(p.action, 300) }));
    return { summary: { headline: tidy(out.headline, 300), priorities, note: tidy(out.note, 400) }, model: response.model };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) console.error("[ai] tekshiruv: kalit yaroqsiz yoki ruxsat yo'q", e.status);
    else if (e instanceof Anthropic.RateLimitError) console.error("[ai] tekshiruv: so'rovlar chegarasi (429)");
    else if (e instanceof Anthropic.APIError) console.error('[ai] tekshiruv: API xatosi', e.status, withoutKeys(e.message).slice(0, 300));
    else console.error('[ai] tekshiruv', e);
    return null;
  }
}

/** Tekshiruvni bajarib, hisobotni saqlaydi (admin sahifasi va kunlik cron shu funksiyani chaqiradi) */
export async function runAudit(trigger: 'cron' | 'manual', now = new Date()) {
  const checks = await collectChecks(now);
  // AI faqat ish (buyurtma, to'lov, ishlab chiqarish ...) topilmalarini umumlashtiradi: server topilmalari admin panelda tuzatilmaydi,
  // ular xabarda o'z satrida turadi va modelga bog'liq emas
  const ai = await summarize(checks.filter((c) => !isInfra(c)), now, trigger);
  const data = { trigger, checks: checks as unknown as Prisma.InputJsonValue, createdAt: now };
  if (!ai) return prisma.auditReport.create({ data: { ...data, model: null } });
  try {
    return await prisma.auditReport.create({ data: { ...data, summary: ai.summary as unknown as Prisma.InputJsonValue, model: ai.model } });
  } catch (e) {
    // AI matni bazaga yozilmasa ham aniq qoidalar bo'yicha topilgan natija yo'qolmaydi: hisobot xulosasiz saqlanadi
    console.error("[ai] tekshiruv: xulosani saqlab bo'lmadi — hisobot xulosasiz saqlanadi", e);
    return prisma.auditReport.create({ data: { ...data, model: null } });
  }
}

const KEEP_REPORTS_DAYS = 90;

/** Kunlik avtomatik tekshiruv (cron): hisobot saqlanadi, xodimlarga yuboriladi, eski hisobotlar tozalanadi */
export async function dailyAudit(now = new Date()): Promise<{ findings: number; sent: number; ai: boolean }> {
  const report = await runAudit('cron', now);
  const sent = await sendAuditToStaff(report);
  await prisma.auditReport.deleteMany({ where: { createdAt: { lt: ago(now, KEEP_REPORTS_DAYS * DAY) } } }).catch((e) => console.error('[ai] eski hisobotlarni tozalash', e));
  return { findings: reportChecks(report.checks).length, sent, ai: !!report.summary };
}

const SEVERITIES: Severity[] = ['high', 'medium', 'low'];
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Bazadagi JSON'dan tekshiruvlar ro'yxati (shakli buzilgan yozuv tashlab ketiladi) */
export function reportChecks(value: unknown): AuditCheck[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): AuditCheck[] => {
    const c = (raw ?? {}) as Record<string, unknown>;
    if (typeof c.key !== 'string' || typeof c.title !== 'string' || !SEVERITIES.includes(c.severity as Severity)) return [];
    const link = typeof c.link === 'string' && c.link.startsWith('/admin') ? c.link : '/admin';
    return [{ key: c.key, severity: c.severity as Severity, title: c.title, count: Number(c.count) || 0, items: strings(c.items), link }];
  });
}

/** Bazadagi JSON'dan AI xulosasi (yo'q yoki shakli buzilgan bo'lsa null) */
export function reportSummary(value: unknown): AuditSummary | null {
  const s = (value ?? {}) as Record<string, unknown>;
  if (typeof s.headline !== 'string' || !Array.isArray(s.priorities)) return null;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const priorities = s.priorities.map((p) => (p ?? {}) as Record<string, unknown>).map((p) => ({ title: text(p.title), why: text(p.why), action: text(p.action) })).filter((p) => p.title);
  return { headline: s.headline, priorities, note: text(s.note) };
}

const ICON: Record<Severity, string> = { high: '🔴', medium: '🟠', low: '🟡' };
/** Server va xabarlar navbati topilmalari (admin panelda emas, serverda tuzatiladi) */
const isInfra = (c: { key: string }) => /^(ops|outbox)_/.test(c.key);

/** Hisobotni "reports" ruxsati bor, botga ulangan xodimlarga yuborish; muammo topilmagan bo'lsa hech narsa yuborilmaydi */
export async function sendAuditToStaff(report: { checks: unknown; summary: unknown }): Promise<number> {
  const checks = reportChecks(report.checks);
  if (!checks.length) return 0;
  const summary = reportSummary(report.summary);
  const line = (c: AuditCheck) => `${ICON[c.severity]} ${esc(c.title)}: <b>${c.count}</b>`;
  // Administrator ulanmagani — server topilmasi emas: Admin > Xodimlar bo'limida tuzatiladi, shuning uchun o'z izohi bilan chiqadi
  const noAdmin = checks.filter((c) => c.key === 'ops_no_admin');
  const infra = checks.filter((c) => isInfra(c) && c.key !== 'ops_no_admin');
  const business = checks.filter((c) => !isInfra(c));
  const shown = business.slice(0, 8);
  const parts = [
    '🧭 <b>Kunlik tekshiruv</b>',
    ...(summary ? [esc(clip(summary.headline, 300))] : []),
    '',
    // Server va navbat topilmalari AI xulosasiga bog'liq emas: har doim o'z satrida va tepada (uzunlik chegarasida tushib qolmasin)
    ...(noAdmin.length ? [...noAdmin.map(line), "👉 Buni administrator tuzatadi: admin panel → Xodimlar → o'z qatorida «Telegram kodi» tugmasi, chiqqan kodni boshqaruv botiga yozadi.", ''] : []),
    ...(infra.length ? [...infra.map(line), '🛠 Bular admin panelda tuzatilmaydi — texnik mutaxassisga ayting («Batafsil» → Server holati).', ''] : []),
    ...(summary ? summary.priorities.map((p, i) => `${i + 1}. <b>${esc(clip(p.title, 120))}</b>\n${esc(clip(p.action, 300))}`) : shown.map(line)),
    ...(!summary && business.length > shown.length ? [`… yana ${business.length - shown.length} ta`] : []),
    ...(summary?.note ? [`\n💡 ${esc(clip(summary.note, 400))}`] : []),
  ];
  // Telegram chegarasi 4096 belgi: sig'maydigan oxirgi bandlar butunligicha tashlanadi. sendMessage'ning o'zi kesishiga
  // qoldirilsa, kesish <b> tegi o'rtasiga tushib, Telegram butun xabarni rad etardi (to'liq matn — «Batafsil» sahifasida).
  let lines = '';
  for (const part of parts) {
    if (lines.length + part.length + 1 > 3800) break;
    lines += (lines ? '\n' : '') + part;
  }
  try {
    const sent = await Promise.allSettled((await staffRecipients('reports')).map((u) => notifyStaff(u.telegramId, lines, [[{ text: '📋 Batafsil', url: `${siteUrl()}/admin/audit` }]])));
    return sent.filter((r) => r.status === 'fulfilled' && r.value).length;
  } catch (e) {
    console.error('[ai] tekshiruvni yuborish', e);
    return 0;
  }
}
