import { spawnSync } from 'node:child_process';
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditCheck } from '@/lib/ai/audit';
import type { OpsFacts, OpsState } from '@/lib/ops';

/**
 * Server kuzatuvi: holat (src/lib/ops.ts), signal manzili (/api/ops/heartbeat) va kunlik tekshiruvdagi server qoidalari
 * (src/lib/ai/audit.ts, collectChecks). Bazasiz va tarmoqsiz: prisma o'rnida shu fayldagi xotiradagi "baza" turadi —
 * SiteSetting kalit/qiymat bo'lib saqlanadi, User so'rovining sharti (where) esa qatorlarga haqiqatan qo'llanadi, shuning
 * uchun shart o'zgarsa test sezadi. deploy/watchdog.sh ning matni ham o'qiladi: skript yuboradigan JSON bilan ilova kutadigan
 * shakl bir-biridan uzoqlashib ketmasin (skript bash'da, ilova TypeScript'da — ularni boshqa hech narsa bog'lab turmaydi).
 * Skriptlarning bash qismi (env_val, zaxira yoshi, restore-test.sh va offsite-send.sh ning chiqish tuzog'i) haqiqiy bash'da,
 * vaqtinchalik papkada bajariladi: docker, curl va flock o'rnida soxta funksiyalar — tarmoqqa ham, bazaga ham chiqilmaydi.
 */
const h = vi.hoisted(() => ({
  prisma: {
    siteSetting: { findUnique: vi.fn(), upsert: vi.fn() },
    user: { findMany: vi.fn() },
    order: { count: vi.fn(), findMany: vi.fn() },
    corporateInvoice: { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    workOrder: { count: vi.fn(), findMany: vi.fn() },
    lead: { count: vi.fn() },
    review: { count: vi.fn() },
  },
  settings: {} as Record<string, unknown>,
  lowStockProducts: vi.fn(),
  staffRecipients: vi.fn(),
  outboxStats: vi.fn<(now?: Date) => Promise<{ pending: number; stuck: number; failed24h: number }>>(),
  readOps: vi.fn<(now?: Date) => Promise<{ state: OpsState; stale: boolean } | null>>(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: h.prisma }));
vi.mock('@/lib/settings', () => ({ getSettings: async () => h.settings }));
vi.mock('@/lib/inventory', () => ({ lowStockProducts: h.lowStockProducts }));
vi.mock('@/lib/telegram/staffLink', () => ({ staffRecipients: h.staffRecipients }));
vi.mock('@/lib/telegram/notify', () => ({ notifyStaff: vi.fn() }));
vi.mock('@/lib/telegram/outbox', () => ({ outboxStats: h.outboxStats }));
// Tekshiruv (audit.ts) holatni shu readOps orqali o'qiydi: odatda haqiqiy funksiya ishlaydi, xato holatlari uchun almashtiriladi.
// Qolgan eksportlar (OPS_FACTS, saveOps, alertChats) haqiqiy — signal manzili aynan o'shalarni ishlatadi
vi.mock('@/lib/ops', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ops')>()), readOps: h.readOps }));

const real = await vi.importActual<typeof import('@/lib/ops')>('@/lib/ops');
const { OPS_FACTS, alertChats, readOps, saveOps } = real;
const { POST } = await import('@/app/api/ops/heartbeat/route');
const { collectChecks, reportChecks } = await import('@/lib/ai/audit');

const SECRET = 'ci-dummy-ops-secret';
const NOW = new Date('2031-03-10T03:00:00Z'); // Toshkentda 10.03.2031, 08:00
const MINUTE = 60_000;
/** Sog'lom server: bu faktlar bilan hech qanday topilma chiqmaydi */
const HEALTHY: OpsFacts = { disk: 41, backupAgeH: 5, restoreOk: 1, offsiteOk: 1, certDays: 60, siteOk: 1, tickOk: 1 };
const FACT_KEYS = Object.keys(HEALTHY) as (keyof OpsFacts)[];

// ─── Xotiradagi baza ─────────────────────────────────────────────────────────

type UserRow = { id: number; role: 'user' | 'staff' | 'manager' | 'admin'; isActive: boolean; deletedAt: Date | null; telegramId: string | null; telegramNotify: boolean };
type Where = Record<string, unknown>;
type FindMany = { where?: Where; orderBy?: Record<string, 'asc' | 'desc'>; take?: number; select?: Record<string, boolean> };
type Upsert = { where: { key: string }; create: { key: string; value: unknown }; update: { value: unknown } };

const db = { settings: new Map<string, unknown>(), users: [] as UserRow[] };
let seq = 0;

/** Yangi foydalanuvchi qatori; standart — boshqaruv botiga ulangan faol administrator */
function user(patch: Partial<UserRow> = {}): UserRow {
  seq += 1;
  const row: UserRow = { id: seq, role: 'admin', isActive: true, deletedAt: null, telegramId: String(7_000_000 + seq), telegramNotify: true, ...patch };
  db.users.push(row);
  return row;
}

const same = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b);

/** Prisma shartining bitta ustunga tegishli qismi: qiymat, null yoki { equals | not | in | notIn }. Boshqasi kelsa xato — test jim o'tib ketmasin */
function fieldMatches(value: unknown, cond: unknown): boolean {
  if (typeof cond !== 'object' || cond === null || cond instanceof Date) return same(value, cond);
  return Object.entries(cond).every(([op, arg]) => {
    if (op === 'equals') return same(value, arg);
    if (op === 'not') return !fieldMatches(value, arg);
    if (op === 'in' && Array.isArray(arg)) return arg.some((a) => same(value, a));
    if (op === 'notIn' && Array.isArray(arg)) return !arg.some((a) => same(value, a));
    throw new Error(`soxta baza: "${op}" sharti qo'llab-quvvatlanmaydi`);
  });
}

async function findUsers(args: FindMany = {}): Promise<Record<string, unknown>[]> {
  let rows = db.users.filter((row) => Object.entries(args.where ?? {}).every(([field, cond]) => {
    if (!(field in row)) throw new Error(`soxta baza: User jadvalida "${field}" ustuni yo'q`);
    return fieldMatches(row[field as keyof UserRow], cond);
  }));
  for (const [field, dir] of Object.entries(args.orderBy ?? {})) {
    if (field !== 'id') throw new Error(`soxta baza: "${field}" bo'yicha tartiblash qo'llab-quvvatlanmaydi`);
    rows = [...rows].sort((a, b) => (dir === 'desc' ? b.id - a.id : a.id - b.id));
  }
  if (args.take !== undefined) rows = rows.slice(0, args.take);
  const fields = (args.select ? Object.keys(args.select).filter((k) => args.select?.[k]) : ['id', 'role', 'isActive', 'deletedAt', 'telegramId', 'telegramNotify']) as (keyof UserRow)[];
  return rows.map((row) => Object.fromEntries(fields.map((k) => [k, row[k]])));
}

async function findSetting({ where }: { where: { key: string } }) {
  return db.settings.has(where.key) ? { key: where.key, value: db.settings.get(where.key), updatedAt: new Date() } : null;
}

async function upsertSetting({ where, create, update }: Upsert) {
  const exists = db.settings.has(where.key);
  // JSON ustuni: bazaga nima yozilgan bo'lsa, undan faqat JSON qaytadi (Date satrga aylanadi, undefined yo'qoladi)
  const value = JSON.parse(JSON.stringify(exists ? update.value : create.value)) as unknown;
  db.settings.set(exists ? where.key : create.key, value);
  return { key: where.key, value, updatedAt: new Date() };
}

const stored = (key = 'ops') => db.settings.get(key);

/** Kunlik tekshiruvning bazadagi qismi: hech qanday muammo topilmagan do'kon */
function quietShop(): void {
  const p = h.prisma;
  p.order.count.mockResolvedValue(0);
  p.order.findMany.mockResolvedValue([]);
  p.corporateInvoice.count.mockResolvedValue(0);
  p.corporateInvoice.findMany.mockResolvedValue([]);
  p.corporateInvoice.aggregate.mockResolvedValue({ _sum: { totalAmount: null, paidAmount: null } });
  p.workOrder.count.mockResolvedValue(0);
  p.workOrder.findMany.mockResolvedValue([]);
  p.lead.count.mockResolvedValue(0);
  p.review.count.mockResolvedValue(0);
}

beforeEach(() => {
  db.settings.clear();
  db.users.length = 0;
  seq = 0;
  for (const model of Object.values(h.prisma)) for (const fn of Object.values(model)) fn.mockReset();
  h.prisma.siteSetting.findUnique.mockImplementation(findSetting);
  h.prisma.siteSetting.upsert.mockImplementation(upsertSetting);
  h.prisma.user.findMany.mockImplementation(findUsers);
  quietShop();
  h.lowStockProducts.mockReset().mockResolvedValue([]);
  h.staffRecipients.mockReset().mockResolvedValue([{ id: 1, name: 'Ali', role: 'staff', phone: '998901234567', telegramId: '7001', telegramNotify: true }]);
  h.outboxStats.mockReset().mockResolvedValue({ pending: 0, stuck: 0, failed24h: 0 });
  h.readOps.mockReset().mockImplementation(readOps);
  h.settings = { lowStockThreshold: 10, legalName: 'Pack24 MChJ', inn: '301234567', bankDetails: 'h/r 2020 8000 0000 0000 0001' };
  // Tashqi muhitdagi bot tokeni (ishlab chiquvchi kompyuteri) tekshiruvga "xodim ulanmagan" topilmasini qo'shib qo'ymasin
  for (const name of ['STAFF_BOT_TOKEN', 'SUPERVISOR_BOT_TOKEN']) vi.stubEnv(name, undefined);
  vi.stubEnv('TELEGRAM_OPS_SECRET', SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Soat `at` ga to'g'rilanadi (faqat Date soxta: kutishlar va Request/Response odatdagidek ishlaydi) */
function clock(at: Date): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at);
}

// ─── deploy/watchdog.sh matni ────────────────────────────────────────────────

const script = readFileSync(new URL('../../../deploy/watchdog.sh', import.meta.url), 'utf8');

function inScript(pattern: RegExp, what: string): RegExpExecArray {
  const m = pattern.exec(script);
  if (!m) throw new Error(`deploy/watchdog.sh: ${what} topilmadi — skript o'zgargan bo'lsa shu testdagi qolipni ham yangilang`);
  return m;
}

/** Skript signal tanasini shunday quradi: FACTS="$(printf '{"disk":%s,...}' "$DISK" ...)" — qolip, kalitlar va o'zgaruvchilar */
function scriptFacts(): { format: string; keys: string[]; vars: string[] } {
  const m = inScript(/FACTS="\$\(printf\s+'(\{[^']*\})'((?:\s+"\$[A-Z_]+")+)\s*\)"/, 'FACTS="$(printf \'{...}\' ...)" satri');
  return { format: m[1], keys: [...m[1].matchAll(/"([A-Za-z]+)":%s/g)].map((k) => k[1]), vars: [...m[2].matchAll(/"\$([A-Z_]+)"/g)].map((v) => v[1]) };
}

/** printf: har bir %s o'rniga navbatdagi qiymat */
function fill(format: string, values: number[]): string {
  let i = 0;
  return format.replace(/%s/g, () => String(values[i++]));
}

/** Skript javobdagi ID larni shu qolipdan o'tkazadi (grep -E '^-?[0-9]{4,20}$'): mos kelmagani jim tashlab yuboriladi */
const scriptChatFilter = (): RegExp => new RegExp(inScript(/grep -E '(\^[^']+\$)'/, 'chat ID larni saralaydigan grep')[1]);

// ─── Signal shakli ───────────────────────────────────────────────────────────

describe('server kuzatuvi: signal shakli (OPS_FACTS)', () => {
  const accepts = (body: unknown) => OPS_FACTS.safeParse(body).success;

  it('watchdog.sh yuboradigan JSON kalitlari ilova kutadigan kalitlar bilan aynan bir xil', () => {
    const { format, keys, vars } = scriptFacts();
    expect(format.match(/%s/g)).toHaveLength(keys.length);
    expect(vars).toHaveLength(keys.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(Object.keys(OPS_FACTS.shape).sort());
  });

  it('skript qurgan JSON (printf qolipi) o\'zgarishsiz qabul qilinadi', () => {
    const { format, keys } = scriptFacts();
    const body = fill(format, keys.map((k) => HEALTHY[k as keyof OpsFacts]));
    expect(OPS_FACTS.parse(JSON.parse(body))).toEqual(HEALTHY);
  });

  // Skript har bir faktni avval "aniqlanmadi" (-1) yoki 0/1 bilan to'ldiradi: shulardan birortasi rad etilsa signal umuman yetib bormaydi
  it('skript o\'zgaruvchilarga yozadigan har bir tayyor qiymat (-1 "aniqlanmadi", 0, 1) qabul qilinadi', () => {
    const { format, keys, vars } = scriptFacts();
    for (const [i, name] of vars.entries()) {
      const literals = [...script.matchAll(new RegExp(`(?<![A-Z_])${name}=(-?\\d+)(?![\\d$])`, 'g'))].map((m) => Number(m[1]));
      expect(literals.length, `${name}: skriptda tayyor qiymat topilmadi`).toBeGreaterThan(0);
      for (const literal of literals) {
        const values = keys.map((k) => HEALTHY[k as keyof OpsFacts]);
        values[i] = literal;
        expect(accepts(JSON.parse(fill(format, values))), `${name}=${literal}`).toBe(true);
      }
    }
  });

  it('offsiteOk yubormaydigan eski skript ham qabul qilinadi: -1 (yoqilmagan) deb olinadi', () => {
    const old: Record<string, unknown> = { ...HEALTHY };
    delete old.offsiteOk;
    expect(OPS_FACTS.parse(old)).toEqual({ ...HEALTHY, offsiteOk: -1 });
  });

  it('chegaralar: -1 faqat "aniqlab bo\'lmaydigan" faktlarda; bayroqlar 0/1; disk foizda', () => {
    for (const key of ['disk', 'backupAgeH', 'restoreOk', 'offsiteOk', 'certDays']) expect(accepts({ ...HEALTHY, [key]: -1 }), `${key}: -1`).toBe(true);
    // Sayt va davriy signal uchun "bilmayman" yo'q: skript ularni doim 0 yoki 1 qilib yuboradi
    for (const key of ['siteOk', 'tickOk']) expect(accepts({ ...HEALTHY, [key]: -1 }), `${key}: -1`).toBe(false);
    for (const key of FACT_KEYS) expect(accepts({ ...HEALTHY, [key]: -2 }), `${key}: -2`).toBe(false);
    for (const key of ['restoreOk', 'offsiteOk', 'siteOk', 'tickOk']) {
      expect(accepts({ ...HEALTHY, [key]: 0 }), `${key}: 0`).toBe(true);
      expect(accepts({ ...HEALTHY, [key]: 1 }), `${key}: 1`).toBe(true);
      expect(accepts({ ...HEALTHY, [key]: 2 }), `${key}: 2`).toBe(false);
    }
    for (const disk of [0, 100]) expect(accepts({ ...HEALTHY, disk }), `disk: ${disk}`).toBe(true);
    expect(accepts({ ...HEALTHY, disk: 101 })).toBe(false);
  });

  // Signal aynan shunday paytda kerak: uch oydan beri olinmagan zaxira yoki ertaga tugaydigan sertifikat "noto'g'ri son" bo'lib rad etilmasin
  it('juda eski zaxira va uzoq muddatli sertifikat qabul qilinadi; bema\'ni katta son — yo\'q', () => {
    for (const backupAgeH of [0, 30, 24 * 90]) expect(accepts({ ...HEALTHY, backupAgeH }), `backupAgeH: ${backupAgeH}`).toBe(true);
    for (const certDays of [0, 1, 398, 3650]) expect(accepts({ ...HEALTHY, certDays }), `certDays: ${certDays}`).toBe(true);
    for (const key of ['backupAgeH', 'certDays']) {
      for (const huge of [10_000_000, Number.MAX_SAFE_INTEGER, 1e21]) expect(accepts({ ...HEALTHY, [key]: huge }), `${key}: ${huge}`).toBe(false);
    }
  });

  it('son bo\'lmagan yoki butun bo\'lmagan qiymat rad etiladi (satr, kasr, null, mantiqiy, ro\'yxat, obyekt)', () => {
    const garbage: unknown[] = ['41', '1', '', 'ok', 41.5, 0.5, null, true, false, [1], { value: 1 }, Number.NaN, Number.POSITIVE_INFINITY];
    for (const key of FACT_KEYS) {
      for (const value of garbage) expect(accepts({ ...HEALTHY, [key]: value }), `${key}: ${inspect(value)}`).toBe(false);
    }
  });

  it('majburiy kalitlardan biri bo\'lmasa rad etiladi', () => {
    for (const key of FACT_KEYS.filter((k) => k !== 'offsiteOk')) {
      const body: Record<string, unknown> = { ...HEALTHY };
      delete body[key];
      expect(accepts(body), key).toBe(false);
    }
    expect(accepts({})).toBe(false);
  });

  it('obyekt bo\'lmagan tana rad etiladi', () => {
    for (const body of [null, undefined, 'disk=41', JSON.stringify(HEALTHY), 41, true, [], [HEALTHY]]) expect(accepts(body), inspect(body)).toBe(false);
  });

  // Saqlanadigan holatga faqat ma'lum sonlar tushadi: so'rovga qo'shib yuborilgan boshqa maydon (masalan vaqt) bazaga o'tmaydi
  it('ortiqcha maydonlar tashlab yuboriladi', () => {
    expect(OPS_FACTS.parse({ ...HEALTHY, at: '1999-01-01T00:00:00.000Z', role: 'admin', note: '<b>x</b>' })).toEqual(HEALTHY);
  });

});

// ─── Muddati o'tgan sertifikat ───────────────────────────────────────────────

/**
 * Skriptning sertifikat kunlarini hisoblashi (bash butun sonli bo'lish — nol tomonga yaxlitlaydi): muddat tugashiga `secondsLeft` soniya
 * qolgan (manfiy — o'tib ketgan). Har bir qadam skript matnida borligi va tartibi quyidagi testda tekshiriladi.
 */
function scriptCertDays(secondsLeft: number, valid: RegExp): number {
  let days = Math.trunc(secondsLeft / 86_400) + 0; // + 0: JavaScript'dagi "-0" bash'da oddiy 0
  if (days < 0) days = 0;
  return valid.test(String(days)) ? days : -1;
}

describe('server kuzatuvi: muddati o\'tgan sertifikat (watchdog.sh -> signal -> tekshiruv)', () => {
  // Skript ilgari manfiy kun yuborardi: -2 va undan kichigini ilova rad etadi (400 — butun signal yo'qoladi, sahifada "signal kelmayapti"),
  // -1 esa "aniqlanmadi" deb o'qiladi (sertifikat haqida hech kim hech narsa demaydi)
  const guard = () => inScript(/\[\[ "\$CERT_DAYS" =~ (\^\S+\$) \]\] \|\| CERT_DAYS=(-?\d+)/, 'CERT_DAYS qiymatini tekshiruvchi satr');

  it('skript: kunlar hisoblangach manfiy son 0 ga tenglanadi, keyin keshga yoziladi; keshdagi yaroqsiz qiymat -1 (aniqlanmadi) bo\'ladi', () => {
    const compute = script.indexOf('CERT_DAYS=$(( (CERT_END_S - NOW) / 86400 ))');
    const clamp = script.indexOf('[ "$CERT_DAYS" -lt 0 ] && CERT_DAYS=0');
    const cache = script.indexOf('echo "$CERT_DAYS" > "$STATE/cert-days"');
    expect(compute).toBeGreaterThan(-1);
    // Tartib muhim: avval 0 ga tenglash, keyin keshga yozish — aks holda manfiy son 6 soat keshda turib, har 5 daqiqada yuborilardi
    expect(clamp).toBeGreaterThan(compute);
    expect(cache).toBeGreaterThan(clamp);
    // Oxirgi so'z — tekshiruvda: undan keyin o'zgaruvchiga boshqa qiymat yozilmaydi
    const check = guard();
    expect(check.index).toBeGreaterThan(cache);
    expect(check[2]).toBe('-1');
    expect(script.slice(check.index + check[0].length)).not.toMatch(/(?<![A-Z_])CERT_DAYS=/);

    const valid = new RegExp(check[1]);
    // Eski skript keshga yozib ketgan manfiy son yoki buzilgan fayl: "aniqlanmadi"
    for (const cached of ['-5', '-1', '', 'abc', '1 2', '3.5', '12kun']) expect(valid.test(cached), inspect(cached)).toBe(false);
    for (const cached of ['0', '7', '89', '398']) expect(valid.test(cached), cached).toBe(true);
  });

  it('muddati o\'tgan sertifikat uchun skript 0 yuboradi: signal qabul qilinadi va kunlik tekshiruvda "muhim" topilma bo\'ladi', async () => {
    const valid = new RegExp(guard()[1]);
    const { format, keys } = scriptFacts();
    const DAY_S = 86_400;
    // Muddat: 5 kun oldin, 30 soat oldin, bir soniya oldin tugagan; hozir tugaydi; 3 soatdan keyin tugaydi — hammasi 0 kun
    for (const secondsLeft of [-5 * DAY_S, -30 * 3600, -1, 0, 3 * 3600]) {
      const certDays = scriptCertDays(secondsLeft, valid);
      expect(certDays, `${secondsLeft} s`).toBe(0);
      clock(new Date(NOW.getTime() - 2 * MINUTE));
      const body = fill(format, keys.map((k) => ({ ...HEALTHY, certDays })[k as keyof OpsFacts]));
      const res = await POST(new Request('http://127.0.0.1:3000/api/ops/heartbeat', { method: 'POST', headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' }, body }));
      expect(res.status, `${secondsLeft} s`).toBe(200);
      expect(stored()).toMatchObject({ certDays: 0 });
      // Signal eskirmagan, sertifikat esa "aniqlanmadi" emas — aniq topilma
      expect((await collectChecks(NOW)).map((c) => `${c.severity}:${c.key}`), `${secondsLeft} s`).toEqual(['high:ops_cert']);
      vi.useRealTimers();
    }
    // Hali muddati bor sertifikat o'z kuni bilan ketadi
    expect(scriptCertDays(2 * DAY_S + 100, valid)).toBe(2);
    expect(scriptCertDays(90 * DAY_S, valid)).toBe(90);
  });

  // Tuzatish aynan skriptda bo'lishi shart edi: ilova manfiy kunni hamon rad etadi (sxema o'zgarmagan)
  it('ilova manfiy kunni (-1 dan kichik) hamon rad etadi — shuning uchun skript uni hech qachon yubormasligi kerak', async () => {
    for (const certDays of [-2, -5, -400]) {
      const res = await POST(new Request('http://127.0.0.1:3000/api/ops/heartbeat', { method: 'POST', headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' }, body: JSON.stringify({ ...HEALTHY, certDays }) }));
      expect(res.status, String(certDays)).toBe(400);
    }
    expect(db.settings.size).toBe(0);
  });

  it('skript 0 kun uchun alohida xabar matni yuboradi ("tugagan yoki bugun tugaydi"), qolgan kunlar uchun — necha kun qolgani', () => {
    const texts = inScript(/if \[ "\$CERT_DAYS" -eq 0 \]; then CERT_TEXT="([^"]+)"; else CERT_TEXT="([^"]+)"; fi/, 'sertifikat xabari matnlari');
    expect(texts[1]).toContain('muddati tugagan yoki bugun tugaydi');
    expect(texts[1]).not.toContain('CERT_DAYS');
    expect(texts[2]).toContain('${CERT_DAYS} kundan keyin tugaydi');
  });

  // Skript muddati O'TGAN sertifikatni ham 0 qilib yuboradi: "0 kundan keyin tugaydi" degan nom 5 kun oldin tugagan sertifikat uchun noto'g'ri
  // bo'lardi. Topilma nomi skriptning Telegram xabaridagi ibora bilan bir xil
  it('muddati tugagan sertifikat (0 kun) kunlik tekshiruvda "0 kundan keyin tugaydi" emas, "tugagan yoki bugun tugaydi" deb aytiladi', async () => {
    const cert = async (certDays: number) => {
      await saveOps({ ...HEALTHY, certDays }, new Date(NOW.getTime() - 2 * MINUTE));
      const [found, ...rest] = await collectChecks(NOW);
      expect(rest, `${certDays} kun`).toEqual([]);
      return found;
    };
    const expired = await cert(0);
    expect(expired).toEqual({ key: 'ops_cert', severity: 'high', title: 'HTTPS sertifikat muddati tugagan yoki bugun tugaydi', count: 1, items: [], link: '/admin/audit' });
    expect(expired.title).not.toMatch(/\d/);
    const telegram = inScript(/if \[ "\$CERT_DAYS" -eq 0 \]; then CERT_TEXT="([^"]+)"; else/, 'muddati tugagan sertifikat xabari')[1];
    expect(telegram.startsWith(expired.title)).toBe(true);

    // Hali muddati bor sertifikat: necha kun qolgani bilan — 1–6 kun "muhim", 7–20 kun "o'rtacha"
    for (const [days, severity] of [[1, 'high'], [6, 'high'], [7, 'medium'], [20, 'medium']] as const) {
      expect(await cert(days), `${days} kun`).toMatchObject({ key: 'ops_cert', severity, title: `HTTPS sertifikat muddati ${days} kundan keyin tugaydi` });
    }
    // Saqlangan hisobotdan o'qilganda ham o'sha nom
    expect(reportChecks(JSON.parse(JSON.stringify([expired])))).toEqual([expired]);
  });
});

// ─── Holatni saqlash va o'qish ───────────────────────────────────────────────

describe('server kuzatuvi: holatni saqlash (saveOps)', () => {
  it('SiteSetting("ops") ga faktlar va signal vaqti (ISO) yoziladi', async () => {
    await saveOps(HEALTHY, NOW);
    const value = { ...HEALTHY, at: '2031-03-10T03:00:00.000Z' };
    expect(h.prisma.siteSetting.upsert).toHaveBeenCalledTimes(1);
    expect(h.prisma.siteSetting.upsert).toHaveBeenCalledWith({ where: { key: 'ops' }, create: { key: 'ops', value }, update: { value } });
    expect(stored()).toEqual(value);
  });

  it('vaqt berilmasa hozirgi vaqt yoziladi', async () => {
    clock(new Date('2031-03-10T03:07:11.000Z'));
    await saveOps(HEALTHY);
    expect(stored()).toEqual({ ...HEALTHY, at: '2031-03-10T03:07:11.000Z' });
  });

  // Signal qachon kelganini faqat server soati aytadi: faktlar bilan birga "at" kelib qolsa ham u vaqt o'rniga yozilmaydi
  it('faktlar ichida "at" kelib qolsa ham vaqt sifatida signal kelgan payt yoziladi', async () => {
    await saveOps({ ...HEALTHY, at: '1999-01-01T00:00:00.000Z' } as OpsFacts, NOW);
    expect(stored()).toEqual({ ...HEALTHY, at: NOW.toISOString() });
  });

  it('keyingi signal oldingisining o\'rniga yoziladi; boshqa sozlamalarga (cron holati) tegilmaydi', async () => {
    db.settings.set('cron', { digestDay: '2031-03-09', auditDay: '2031-03-10' });
    await saveOps(HEALTHY, NOW);
    const later = new Date(NOW.getTime() + 5 * MINUTE);
    await saveOps({ ...HEALTHY, disk: 93, siteOk: 0 }, later);
    expect([...db.settings.keys()].sort()).toEqual(['cron', 'ops']);
    expect(stored()).toEqual({ ...HEALTHY, disk: 93, siteOk: 0, at: later.toISOString() });
    expect(stored('cron')).toEqual({ digestDay: '2031-03-09', auditDay: '2031-03-10' });
  });
});

describe('server kuzatuvi: holatni o\'qish (readOps)', () => {
  const AT = new Date('2031-03-10T02:40:00.000Z');
  const after = (ms: number) => new Date(AT.getTime() + ms);

  it('saqlangan holat faktlari va vaqti bilan qaytadi', async () => {
    await saveOps(HEALTHY, AT);
    expect(await readOps(after(MINUTE))).toEqual({ state: { ...HEALTHY, at: AT.toISOString() }, stale: false });
    expect(h.prisma.siteSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'ops' } });
  });

  it('signal hali kelmagan (yozuv yo\'q): null', async () => {
    db.settings.set('cron', { ...HEALTHY, at: AT.toISOString() }); // boshqa kalitdagi yozuv holat deb olinmaydi
    expect(await readOps(AT)).toBeNull();
  });

  it('shakli buzilgan yozuv: null, xato tashlanmaydi', async () => {
    const at = AT.toISOString();
    const broken: unknown[] = [
      null, 'ok', 41, true, [], [{ ...HEALTHY, at }], {},
      HEALTHY, // vaqtsiz
      { ...HEALTHY, at: AT.getTime() }, { ...HEALTHY, at: null }, { ...HEALTHY, at: '' }, { ...HEALTHY, at: 'kecha kechqurun' }, { ...HEALTHY, at: { iso: at } },
      { at }, // faktlarsiz
      { ...HEALTHY, disk: '41', at }, { ...HEALTHY, disk: 101, at }, { ...HEALTHY, backupAgeH: 5.5, at }, { ...HEALTHY, siteOk: -1, at }, { ...HEALTHY, tickOk: undefined, at }, { ...HEALTHY, certDays: null, at },
    ];
    for (const value of broken) {
      db.settings.set('ops', value);
      await expect(readOps(AT), inspect(value)).resolves.toBeNull();
    }
  });

  it('30 daqiqagacha yangi, undan keyin eskirgan; "hozir" sifatida berilgan vaqt ishlatiladi', async () => {
    await saveOps(HEALTHY, AT);
    for (const ms of [0, MINUTE, 29 * MINUTE, 30 * MINUTE]) expect((await readOps(after(ms)))?.stale, `${ms / MINUTE} daqiqa`).toBe(false);
    for (const ms of [30 * MINUTE + 1, 31 * MINUTE, 24 * 60 * MINUTE]) expect((await readOps(after(ms)))?.stale, `${ms / MINUTE} daqiqa`).toBe(true);
    // Eskirgan holatning o'zi yo'qolmaydi: sahifada oxirgi ma'lum qiymatlar va oxirgi signal vaqti ko'rsatiladi
    expect((await readOps(after(24 * 60 * MINUTE)))?.state).toEqual({ ...HEALTHY, at: AT.toISOString() });
  });

  it('vaqt berilmasa hozirgi vaqtga nisbatan hisoblanadi', async () => {
    await saveOps(HEALTHY, AT);
    clock(after(29 * MINUTE));
    expect((await readOps())?.stale).toBe(false);
    clock(after(31 * MINUTE));
    expect((await readOps())?.stale).toBe(true);
  });

  it('offsiteOk siz saqlangan eski yozuv o\'qiladi (-1); notanish maydonlar holatga o\'tmaydi; vaqt ISO ko\'rinishiga keltiriladi', async () => {
    const old: Record<string, unknown> = { ...HEALTHY, at: '2031-03-10T07:40:00+05:00', note: 'x', alertChats: ['7001'] };
    delete old.offsiteOk;
    db.settings.set('ops', old);
    expect(await readOps(AT)).toEqual({ state: { ...HEALTHY, offsiteOk: -1, at: '2031-03-10T02:40:00.000Z' }, stale: false });
  });
});

// ─── Xabar oladiganlar ───────────────────────────────────────────────────────

describe('server kuzatuvi: nosozlik xabarini oladiganlar (alertChats)', () => {
  const sorted = (ids: (string | null)[]) => [...ids].sort();

  it('faqat boshqaruv botiga ulangan, faol, o\'chirilmagan administratorlar', async () => {
    const owner = user();
    user({ role: 'manager' });
    user({ role: 'staff' });
    user({ role: 'user' });
    user({ isActive: false });
    user({ deletedAt: new Date('2031-01-15T00:00:00Z') });
    user({ isActive: false, deletedAt: new Date('2031-01-15T00:00:00Z') });
    user({ telegramId: null });
    const second = user();
    expect(sorted(await alertChats())).toEqual(sorted([owner.telegramId, second.telegramId]));
  });

  it('hech kim ulanmagan bo\'lsa bo\'sh ro\'yxat', async () => {
    expect(await alertChats()).toEqual([]);
    user({ telegramId: null });
    user({ role: 'manager' });
    expect(await alertChats()).toEqual([]);
  });

  // Sayt ishlamay qolgani kundalik xabar emas: "xabarnomalarni o'chirish" tugmasi buni to'xtatmaydi
  it('xabarnomani o\'chirib qo\'ygan administrator ham oladi', async () => {
    const muted = user({ telegramNotify: false });
    expect(await alertChats()).toEqual([muted.telegramId]);
  });

  it('raqam bo\'lmagan Telegram ID (buzilgan yozuv) ro\'yxatga tushmaydi; skript filtri ham aynan shularni o\'tkazadi', async () => {
    const filter = scriptChatFilter();
    const garbage = ['', ' ', 'abc', '@pack24_admin', '12a45', '123', '1'.repeat(21), ' 7000001', '7000001 ', '7000001\n', '+7000001', '7 000 001', '70000.01', '７００００００１'];
    for (const telegramId of garbage) {
      db.users.length = 0;
      user({ telegramId });
      const good = user();
      expect(await alertChats(), inspect(telegramId)).toEqual([good.telegramId]);
    }
    db.users.length = 0;
    const good = ['1234', '700123456', '5'.repeat(20)].map((telegramId) => user({ telegramId }).telegramId);
    const chats = await alertChats();
    expect(sorted(chats)).toEqual(sorted(good));
    // Ilova qaytargan har bir ID skriptdagi grep'dan o'tadi — aks holda administrator ro'yxatda bo'la turib xabar olmay qolardi
    for (const id of chats) expect(id).toMatch(filter);
  });

  it('ko\'pi bilan 10 ta; eng avval qo\'shilgan administrator (ega) ro\'yxatdan tushib qolmaydi', async () => {
    const admins = Array.from({ length: 13 }, () => user());
    db.users.reverse(); // baza qatorlarni id tartibida qaytarishga majbur emas
    const chats = await alertChats();
    expect(chats).toHaveLength(10);
    expect(new Set(chats).size).toBe(10);
    expect(chats).toContain(admins[0].telegramId);
    for (const id of chats) expect(admins.map((a) => a.telegramId)).toContain(id);
  });
});

// ─── Signal manzili ──────────────────────────────────────────────────────────

/** Signal so'rovi; `headers` berilmasa to'g'ri kalit bilan. Satr tana o'zgarishsiz ketadi (yaroqsiz JSON uchun) */
const post = (body: unknown, headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) =>
  POST(new Request('http://127.0.0.1:3000/api/ops/heartbeat', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

describe('server kuzatuvi: signal manzili (POST /api/ops/heartbeat)', () => {
  /** Javob kodi va tanasi; maxfiy kalit hech bir javobda (tanada ham, sarlavhalarda ham) qaytmasligi shu yerda tekshiriladi */
  async function reply(res: Response): Promise<{ status: number; body: Record<string, unknown> }> {
    const text = await res.text();
    expect(text).not.toContain(SECRET);
    expect([...res.headers].flat().join('\n')).not.toContain(SECRET);
    return { status: res.status, body: JSON.parse(text) as Record<string, unknown> };
  }
  const nothingSaved = () => {
    expect(h.prisma.siteSetting.upsert).not.toHaveBeenCalled();
    expect(db.settings.size).toBe(0);
  };

  it('kalitsiz yoki xato kalit bilan: 401, hech narsa saqlanmaydi, administratorlar ro\'yxati berilmaydi', async () => {
    user(); // ulangan administrator bor — ro'yxat baribir chiqmasligi kerak
    const bad: Record<string, string>[] = [
      {},
      { authorization: 'Bearer ci-dummy-wrong-secret' },
      { authorization: SECRET }, // "Bearer " siz
      { authorization: `Basic ${SECRET}` },
      { authorization: `Bearer ${SECRET}x` },
      { authorization: `Bearer ${SECRET.slice(0, -1)}` },
      { authorization: 'Bearer ' },
      { authorization: 'Bearer undefined' }, // konteynerda kalit yo'q bo'lsa watchdog.sh aynan shuni yuboradi
      { 'x-telegram-bot-api-secret-token': SECRET }, // webhook sarlavhasi bu yerda kalit emas
    ];
    for (const headers of bad) expect(await reply(await post(HEALTHY, headers)), inspect(headers)).toEqual({ status: 401, body: { ok: false } });
    // Kalitsiz so'rovning tanasi yaroqsiz bo'lsa ham javob 401: nima noto'g'ri ekani begonaga aytilmaydi
    expect(await reply(await post('{', {}))).toEqual({ status: 401, body: { ok: false } });
    nothingSaved();
    expect(h.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('serverda kalit sozlanmagan yoki 16 belgidan qisqa bo\'lsa hech qanday so\'rov qabul qilinmaydi', async () => {
    vi.stubEnv('TELEGRAM_OPS_SECRET', '');
    expect((await post(HEALTHY, { authorization: 'Bearer ' })).status).toBe(401);
    expect((await post(HEALTHY, { authorization: 'Bearer undefined' })).status).toBe(401);
    vi.stubEnv('TELEGRAM_OPS_SECRET', undefined);
    expect((await post(HEALTHY, { authorization: 'Bearer undefined' })).status).toBe(401);
    vi.stubEnv('TELEGRAM_OPS_SECRET', 'qisqa-kalit');
    expect((await post(HEALTHY, { authorization: 'Bearer qisqa-kalit' })).status).toBe(401);
    nothingSaved();
  });

  it('tana JSON emas: 400, hech narsa saqlanmaydi', async () => {
    for (const raw of ['', '{', 'disk=41', '{"disk":41,', '<html>', 'null', '[]', '"41"', '41']) {
      const { status, body } = await reply(await post(raw));
      expect(status, inspect(raw)).toBe(400);
      expect(body.ok, inspect(raw)).toBe(false);
      expect(body).not.toHaveProperty('alertChats');
    }
    nothingSaved();
    expect(h.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('faktlar yaroqsiz (satr, kasr, chegaradan tashqari, kalit yetishmaydi): 400, oldingi holat o\'zgarmaydi', async () => {
    await saveOps(HEALTHY, NOW);
    h.prisma.siteSetting.upsert.mockClear();
    const before = stored();
    const withoutTick: Record<string, unknown> = { ...HEALTHY };
    delete withoutTick.tickOk;
    const bad: unknown[] = [{}, { ...HEALTHY, disk: '41' }, { ...HEALTHY, disk: 41.5 }, { ...HEALTHY, disk: 101 }, { ...HEALTHY, siteOk: -1 }, { ...HEALTHY, certDays: null }, { ...HEALTHY, restoreOk: true }, withoutTick, [HEALTHY]];
    for (const facts of bad) {
      const { status, body } = await reply(await post(facts));
      expect(status, inspect(facts)).toBe(400);
      expect(body.ok, inspect(facts)).toBe(false);
      expect(body).not.toHaveProperty('alertChats');
    }
    expect(h.prisma.siteSetting.upsert).not.toHaveBeenCalled();
    expect(stored()).toEqual(before);
  });

  it('to\'g\'ri kalit va faktlar: 200, holat hozirgi vaqt bilan saqlanadi, javobda xabar oladigan administratorlar', async () => {
    clock(NOW);
    const admin = user();
    user({ role: 'manager' });
    user({ isActive: false });
    expect(await reply(await post(HEALTHY))).toEqual({ status: 200, body: { ok: true, alertChats: [admin.telegramId] } });
    expect(stored()).toEqual({ ...HEALTHY, at: NOW.toISOString() });
    expect(await readOps(new Date(NOW.getTime() + 5 * MINUTE))).toEqual({ state: { ...HEALTHY, at: NOW.toISOString() }, stale: false });
  });

  it('administrator hali botga ulanmagan: baribir 200, ro\'yxat bo\'sh, holat saqlanadi', async () => {
    expect(await reply(await post({ ...HEALTHY, disk: 93 }))).toEqual({ status: 200, body: { ok: true, alertChats: [] } });
    expect(stored()).toMatchObject({ disk: 93 });
  });

  it('offsiteOk siz (eski skript) qabul qilinadi; so\'rovdagi ortiqcha maydonlar — jumladan vaqt — saqlanmaydi', async () => {
    clock(NOW);
    const old: Record<string, unknown> = { ...HEALTHY, at: '1999-01-01T00:00:00.000Z', alertChats: ['666666'], note: '<b>x</b>' };
    delete old.offsiteOk;
    expect((await reply(await post(old))).status).toBe(200);
    // Vaqtni server qo'yadi: skript (yoki kalitni bilgan boshqa kimdir) eski signalni yangi qilib ko'rsata olmaydi
    expect(stored()).toEqual({ ...HEALTHY, offsiteOk: -1, at: NOW.toISOString() });
  });

  // Skript va ilovani faqat shu so'rov bog'laydi: manzil, kalit nomi, tana va javobdagi maydon nomi skript matnidan olinadi
  it('watchdog.sh so\'rovi boshidan oxirigacha: skriptdagi manzil, kalit va tana bilan 200; javobni skript o\'qiy oladi', async () => {
    const path = inScript(/127\.0\.0\.1:3000(\/api\/ops\/[\w/-]+)/, 'signal manzili')[1];
    const secretEnv = inScript(/'Bearer '\s*\+\s*process\.env\.(\w+)/, 'Bearer kaliti')[1];
    const field = inScript(/j\.(\w+)\.join\(/, 'javobdagi ro\'yxat maydoni')[1];
    expect(path).toBe('/api/ops/heartbeat');
    expect(existsSync(new URL(`../../app${path}/route.ts`, import.meta.url))).toBe(true);

    const admin = user();
    const { format, keys } = scriptFacts();
    vi.stubEnv('TELEGRAM_OPS_SECRET', undefined);
    vi.stubEnv(secretEnv, SECRET);
    // Hamma narsa "aniqlanmadi" bo'lgan eng yomon holat ham yetib boradi
    const worst: OpsFacts = { disk: -1, backupAgeH: -1, restoreOk: -1, offsiteOk: -1, certDays: -1, siteOk: 0, tickOk: 0 };
    const res = await POST(new Request(`http://127.0.0.1:3000${path}`, { method: 'POST', headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' }, body: fill(format, keys.map((k) => worst[k as keyof OpsFacts])) }));
    expect(res.ok).toBe(true);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json[field]).toEqual([admin.telegramId]);
    // Skript ro'yxatni satrlarga yoyib, grep'dan o'tkazadi
    const lines = (json[field] as string[]).join('\n').split('\n').filter((line) => scriptChatFilter().test(line));
    expect(lines).toEqual([admin.telegramId]);
    expect(stored()).toMatchObject(worst);
  });

  it('holatni saqlab bo\'lmasa (baza ishlamayapti): 500, xato tafsiloti tashqariga chiqmaydi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    user();
    h.prisma.siteSetting.upsert.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432 (user pack24)'));
    const res = await post(HEALTHY);
    const text = await res.clone().text();
    expect(await reply(res)).toEqual({ status: 500, body: { ok: false } });
    for (const detail of ['ECONNREFUSED', '10.0.0.5', 'pack24', 'alertChats']) expect(text, detail).not.toContain(detail);
    // Sababi server logida qoladi (kalitsiz)
    expect(log).toHaveBeenCalled();
    expect(inspect(log.mock.calls, { depth: 6 })).not.toContain(SECRET);
  });

  it('administratorlar ro\'yxatini o\'qib bo\'lmasa: 500, yarim javob (ro\'yxatsiz "ok") qaytmaydi', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.prisma.user.findMany.mockRejectedValue(new Error('relation "User" does not exist'));
    const res = await post(HEALTHY);
    const text = await res.clone().text();
    expect(await reply(res)).toEqual({ status: 500, body: { ok: false } });
    expect(text).not.toContain('relation');
    expect(log).toHaveBeenCalled();
  });
});

// ─── Skriptning signal so'rovi va xabar oladiganlar ro'yxati ─────────────────

/** Skript web konteynerida `node -e "..."` bilan ishga tushiradigan JavaScript (bash qo'shtirnog'i ichida, o'zida qo'shtirnoq yo'q) */
const heartbeatOneLiner = (): string => inScript(/web node -e "(fetch\('http:\/\/127\.0\.0\.1:3000\/api\/ops\/heartbeat'[^"]*)" <\/dev\/null/, 'signal yuboradigan node buyrug\'i')[1];

/**
 * O'sha JavaScript'ni skript matnidan olib, haqiqatan bajaradi: fetch o'rnida `respond`, muhit o'zgaruvchilari o'rnida `env`.
 * Qaytadi — skript `$(...)` bilan o'qiydigan chiqish (stdout).
 */
async function runHeartbeatOneLiner(env: Record<string, string>, respond: (url: string, init: RequestInit) => Promise<Response>): Promise<string> {
  const out: string[] = [];
  const context = { fetch: respond, process: { env }, console: { log: (line: unknown) => out.push(`${String(line)}\n`) }, AbortSignal };
  await (runInNewContext(heartbeatOneLiner(), context) as Promise<unknown>);
  return out.join('');
}

/** Skriptning javob bilan ishi: `HB="$(... | tr -d '\r')"`, birinchi satr belgi bo'lsa ro'yxat fayli qayta yoziladi, bo'lmasa avvalgisi qoladi */
function chatsFileAfter(stdout: string, previous: string): string {
  // Blok ichida boshqa shart yo'q: ro'yxat bo'sh bo'lsa ham (grep hech narsa topmasa — `|| true`) fayl vaqtinchalik nusxa orqali almashtiriladi
  const rewrite = inScript(/if \[ "\$\(printf '%s\\n' "\$HB" \| head -1\)" = "(\w+)" \]; then\s+\{ printf '%s\\n' "\$HB" \| grep -E '(\^[^']+\$)' \|\| true; \} > "\$STATE\/chats\.tmp" && mv "\$STATE\/chats\.tmp" "\$STATE\/chats"\s+fi/, 'ro\'yxat faylini qayta yozadigan blok');
  const hb = stdout.replace(/\r/g, '').replace(/\n+$/, ''); // $(...) oxiridagi bo'sh satrlarni tashlaydi
  if (hb.split('\n')[0] !== rewrite[1]) return previous;
  return hb.split('\n').filter((line) => new RegExp(rewrite[2]).test(line)).map((line) => `${line}\n`).join('');
}

describe('server kuzatuvi: watchdog.sh signali va xabar oladiganlar ro\'yxati (skriptdagi kod haqiqatan bajariladi)', () => {
  const facts = (patch: Partial<OpsFacts> = {}) => {
    const { format, keys } = scriptFacts();
    return fill(format, keys.map((k) => ({ ...HEALTHY, ...patch })[k as keyof OpsFacts]));
  };
  type Respond = (url: string, init: RequestInit) => Promise<Response>;
  /** Skript so'rovi ilovaning haqiqiy manziliga boradi */
  const app: Respond = (url, init) => POST(new Request(url, init));
  const run = (respond: Respond = app, env: Record<string, string> = { TELEGRAM_OPS_SECRET: SECRET, FACTS: facts() }) => runHeartbeatOneLiner(env, respond);
  const reply = (status: number, body: unknown): Respond => async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const OLD = '7000999\n'; // faylda avvalgi signaldan qolgan administrator

  it('javob muvaffaqiyatli bo\'lsa birinchi satr — "ok" belgisi, keyin har satrda bitta ID; skript belgini aynan shu so\'z bilan solishtiradi', async () => {
    const first = user();
    const second = user();
    user({ role: 'manager' });
    const stdout = await run();
    expect(stdout).toBe(`ok\n${first.telegramId}\n${second.telegramId}\n`);
    // So'rov ilovaga yetib borgan: faktlar saqlangan
    expect(stored()).toMatchObject(HEALTHY);
    // Skriptdagi solishtirish va JavaScript chiqaradigan belgi bir xil so'z
    expect(heartbeatOneLiner()).toContain('console.log(\'ok\\n\'+j.alertChats.join(\'\\n\'))');
    expect(chatsFileAfter(stdout, OLD)).toBe(`${first.telegramId}\n${second.telegramId}\n`);
  });

  // Oxirgi administrator uzilgan, o'chirilgan yoki roli olingan: u server xabarlarini va (tashqi nusxa yoqilgan bo'lsa) har kungi
  // shifrlangan baza nusxasini olishda davom etmasligi kerak — bo'sh ro'yxat ham "muvaffaqiyatli javob"
  it('ilova bo\'sh ro\'yxat qaytarsa fayl bo\'shatiladi: uzilgan administrator xabar (va zaxira nusxa) olishda davom etmaydi', async () => {
    user({ role: 'manager' });
    user({ isActive: false });
    const stdout = await run();
    expect(stdout.replace(/\n+$/, '')).toBe('ok');
    expect(chatsFileAfter(stdout, OLD)).toBe('');
    // Administrator qayta ulansa keyingi signalda ro'yxatga qaytadi
    const back = user();
    expect(chatsFileAfter(await run(), '')).toBe(`${back.telegramId}\n`);
  });

  it('so\'rov o\'tmasa hech narsa chiqmaydi va avvalgi ro\'yxat qoladi: xato kalit, yaroqsiz faktlar, ilova xatosi, tarmoq uzilishi', async () => {
    user();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failures: [string, () => Promise<string>][] = [
      ['kalit xato (401)', () => run(app, { TELEGRAM_OPS_SECRET: 'ci-dummy-wrong-secret', FACTS: facts() })],
      ['konteynerda kalit yo\'q — "Bearer undefined" (401)', () => run(app, { FACTS: facts() })],
      ['faktlar yaroqsiz (400)', () => run(app, { TELEGRAM_OPS_SECRET: SECRET, FACTS: facts({ disk: 101 }) })],
      ['ilova xatosi (500)', () => { h.prisma.siteSetting.upsert.mockRejectedValueOnce(new Error('baza band')); return run(); }],
      ['tarmoq uzilgan', () => run(async () => { throw new TypeError('fetch failed'); })],
      ['502, JSON emas', () => run(reply(502, '<html>502 Bad Gateway</html>'))],
      ['200, lekin JSON emas', () => run(reply(200, '<html>ok</html>'))],
    ];
    for (const [name, attempt] of failures) {
      const stdout = await attempt();
      expect(stdout, name).toBe('');
      expect(chatsFileAfter(stdout, OLD), name).toBe(OLD);
    }
  });

  it('javob 200 bo\'lsa-da kutilgan shaklda bo\'lmasa ro\'yxatga tegilmaydi (ok: true va alertChats — ro\'yxat bo\'lishi shart)', async () => {
    const odd: unknown[] = [null, {}, { ok: true }, { ok: false, alertChats: ['7000001'] }, { ok: 'true', alertChats: ['7000001'] }, { ok: true, alertChats: '7000001' }, { ok: true, alertChats: { 0: '7000001' } }, { alertChats: ['7000001'] }];
    for (const body of odd) {
      const stdout = await run(reply(200, body));
      expect(stdout, inspect(body)).toBe('');
      expect(chatsFileAfter(stdout, OLD), inspect(body)).toBe(OLD);
    }
  });

  it('faylga faqat raqamli Telegram ID lar yoziladi: javobdagi boshqa har qanday satr (jumladan belgi satri) tashlab yuboriladi', async () => {
    const stdout = await run(reply(200, { ok: true, alertChats: ['7000001', 'ok', '', '@admin', '12', '-1001234567890', '7000002 ', 'x\n7000003', '1'.repeat(21)] }));
    // "x\n7000003" — ID ichidagi satr boshi alohida satr bo'lib qoladi: u ham raqam bo'lsagina o'tadi
    expect(chatsFileAfter(stdout, OLD)).toBe('7000001\n-1001234567890\n7000003\n');
  });

  it('so\'rov: ilovaning signal manziliga, kalit konteyner muhitidan (buyruq satrida emas), tana — FACTS o\'zgaruvchisidan', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    await run(async (url, init) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ ok: true, alertChats: [] }));
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe('http://127.0.0.1:3000/api/ops/heartbeat');
    expect(seen[0].init.method).toBe('POST');
    expect(new Headers(seen[0].init.headers).get('authorization')).toBe(`Bearer ${SECRET}`);
    expect(seen[0].init.body).toBe(facts());
    expect(seen[0].init.signal).toBeInstanceOf(AbortSignal); // so'rov muddat bilan cheklangan
    // Kalitning o'zi skript matnida ham, docker buyrug'i dalillarida ham yo'q: faqat o'zgaruvchi nomi (konteyner ichida o'qiladi)
    expect(heartbeatOneLiner()).toContain('process.env.TELEGRAM_OPS_SECRET');
    expect(script).not.toMatch(/env_val TELEGRAM_OPS_SECRET|-e TELEGRAM_OPS_SECRET/);
  });

  // Ro'yxat faylini ikki skript o'qiydi: watchdog.sh (xabarlar) va offsite-send.sh (shifrlangan baza nusxasi). Ikkalasi ham faqat
  // ilova bergan ID larga yuborishi uchun bir xil fayl va bir xil qolipdan foydalanadi
  it('xabar va zaxira nusxa faqat shu fayldagi raqamli ID larga yuboriladi: watchdog.sh va offsite-send.sh bir xil fayl va qolipni ishlatadi', () => {
    const offsite = readFileSync(new URL('../../../deploy/offsite-send.sh', import.meta.url), 'utf8');
    const appFilter = /^-?\d{4,20}$/; // src/lib/ops.ts alertChats
    const stateDir = /STATE="\$\{WATCHDOG_STATE:-([^}]+)\}"/;
    expect(stateDir.exec(offsite)?.[1]).toBe(inScript(stateDir, 'holat papkasi')[1]);
    for (const [name, text] of [['watchdog.sh', script], ['offsite-send.sh', offsite]] as const) {
      expect(text, name).toContain('done < "$STATE/chats"');
      const loopFilter = /\[\[ "\$(?:chat|CHAT)" =~ (\^\S+\$) \]\] \|\| continue/.exec(text);
      expect(loopFilter?.[1], name).toBe(scriptChatFilter().source);
    }
    // Skript qolipi (POSIX) va ilova qolipi bir xil satrlarni o'tkazadi
    for (const id of ['1234', '700123456', '-1001234567890', '5'.repeat(20), '123', '1'.repeat(21), 'abc', '12a45', ' 7000001', '+7000001', '']) {
      expect(scriptChatFilter().test(id), inspect(id)).toBe(appFilter.test(id));
    }
  });
});

// ─── Skriptlarning bash qismi: haqiqiy bash'da bajariladi ────────────────────

// Windows'da faqat Git Bash muhitida (MSYSTEM) ishlaydi: u yerdagi `bash` — WSL emas. Linux (CI) va macOS'da bash doim bor
const NO_BASH = process.platform === 'win32' && !process.env.MSYSTEM;
// Skriptlar Linux serveri uchun yozilgan: GNU find (-printf) va stat (-c) kerak bo'lgan bo'laklar macOS'da bajarilmaydi
const NO_GNU = NO_BASH || process.platform === 'darwin';

const offsiteScript = readFileSync(new URL('../../../deploy/offsite-send.sh', import.meta.url), 'utf8');
const restoreScript = readFileSync(new URL('../../../deploy/restore-test.sh', import.meta.url), 'utf8');

/** Vaqtinchalik papkada ishlaydi; papka oxirida (xato bo'lsa ham) o'chiriladi */
function sandbox<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'p24-ops-'));
  try {
    return run(dir);
  } finally {
    // Qayta urinishlar: o'chirib qo'yilgan skriptdan qolgan jarayon faylni yana bir lahza ushlab turishi mumkin (Windows)
    rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
  }
}

/** code — chiqish kodi (signal bilan tugagan bo'lsa signal nomi); stdout — faqat ekranga chiqqani; out — xatolar oqimi bilan birga */
type Run = { code: number | string | null; stdout: string; out: string };

/** `dir` ichida bash'ni ishga tushiradi. Tashqi muhitdagi sozlamalar (holat va zaxira papkasi, parol) skriptga o'tmaydi */
function bash(dir: string, args: string[], env: Record<string, string> = {}): Run {
  const clean: NodeJS.ProcessEnv = { ...process.env };
  for (const name of ['WATCHDOG_STATE', 'BACKUP_DIR', 'RESTORE_TEST_LOCK', 'BACKUP_PASS', 'TMPDIR']) delete clean[name];
  const r = spawnSync('bash', args, { cwd: dir, env: { ...clean, ...env }, encoding: 'utf8', timeout: 60_000 });
  if (r.error) throw r.error;
  return { code: r.status ?? r.signal, stdout: r.stdout, out: `${r.stdout}${r.stderr}` };
}

/** Bir necha satrli bash dasturini `dir` ichida bajaradi; xato bilan tugasa test to'xtaydi */
function bashLines(dir: string, lines: string[]): string {
  writeFileSync(join(dir, 'run.sh'), `${lines.join('\n')}\n`);
  const { code, stdout, out } = bash(dir, ['run.sh']);
  if (code !== 0) throw new Error(`bash ${code} bilan tugadi:\n${out}`);
  return stdout;
}

// ─── .env qiymatlarini o'qish (env_val) ──────────────────────────────────────

/** Skriptdagi env_val funksiyasining to'liq ta'rifi (tanasi — bitta quvur: grep | tail | cut | tr | sed) */
const envValFunction = (text: string, name: string): string => {
  const m = /^env_val\(\) \{\n.+\n\}$/m.exec(text);
  if (!m) throw new Error(`${name}: env_val funksiyasi topilmadi`);
  return m[0];
};

/**
 * env_val ning o'zini bajaradi (grep, tail, cut, tr va sed haqiqiy): har bir holat uchun alohida papkada .env yoziladi va funksiya
 * skriptdagidek — "$(env_val KALIT)" — chaqiriladi. Hamma holat bitta bash jarayonida; qiymatlar holatlar tartibida qaytadi.
 */
function envVals(cases: (readonly [key: string, env: string])[], text: string, name: string): string[] {
  return sandbox((dir) => {
    const lines = ['set -uo pipefail', envValFunction(text, name)];
    cases.forEach(([key, env], i) => {
      if (!/^[A-Z_]+$/.test(key)) throw new Error(`test: kalit nomi kutilmagan ko'rinishda: ${key}`);
      mkdirSync(join(dir, String(i)));
      writeFileSync(join(dir, String(i), '.env'), env);
      lines.push(`cd ${i} && printf '%s\\0' "$(env_val ${key})" && cd ..`);
    });
    const values = bashLines(dir, lines).split('\0');
    // Har bir qiymatdan keyin NUL: oxirgi bo'lak bo'sh
    if (values.pop() !== '' || values.length !== cases.length) throw new Error(`env_val: ${cases.length} ta qiymat kutilgan edi, ${values.length} ta chiqdi`);
    return values;
  });
}

describe('server kuzatuvi: .env qiymatlarini o\'qish (watchdog.sh va offsite-send.sh dagi env_val)', () => {
  const SCRIPTS = [['watchdog.sh', script], ['offsite-send.sh', offsiteScript]] as const;

  it('ikkala skriptda env_val bir xil (bittasi tuzatilib, ikkinchisi unutilmasin)', () => {
    expect(envValFunction(offsiteScript, 'offsite-send.sh')).toBe(envValFunction(script, 'watchdog.sh'));
  });

  describe.skipIf(NO_BASH)('funksiyaning o\'zi bajarilganda (haqiqiy bash; har bir holat uchun .env — vaqtinchalik papkada)', () => {
    /** [.env matni, kutilgan qiymat, so'raladigan kalit (standart X)] */
    type Case = readonly [env: string, expected: string, key?: string];
    /** Boshqa satrlar orasidagi DOMAIN satri */
    const domain = (line: string, expected: string): Case => [`NODE_ENV=production\n${line}\nAPP_URL=https://pack24.uz\n`, expected, 'DOMAIN'];

    // Qo'lda tahrirlangan .env ilova uchun (docker compose) ishlayveradi — skript ham xuddi shu qiymatni ko'rishi kerak: aks holda
    // domen "pack24.uz   " bo'lib, sayt doim "ochilmayapti" deb xabar berilardi, bot tokeni esa "yaroqsiz" bo'lib, xabar umuman ketmasdi
    const COMPOSE: Case[] = [
      domain('DOMAIN=pack24.uz', 'pack24.uz'),
      domain('DOMAIN="pack24.uz"', 'pack24.uz'),
      domain('DOMAIN=\'pack24.uz\'', 'pack24.uz'),
      domain('DOMAIN="pack24.uz"   ', 'pack24.uz'),
      domain('DOMAIN=  pack24.uz\t', 'pack24.uz'),
      domain('DOMAIN=  "pack24.uz"', 'pack24.uz'),
      domain('DOMAIN=pack24.uz # asosiy domen', 'pack24.uz'),
      domain('DOMAIN="pack24.uz"  # asosiy domen', 'pack24.uz'),
      domain('DOMAIN=\'pack24.uz\'\t# asosiy domen', 'pack24.uz'),
      domain('DOMAIN=pack24.uz\r', 'pack24.uz'),
      domain('DOMAIN="pack24.uz" # izoh\r', 'pack24.uz'),
      domain('DOMAIN=', ''),
      domain('DOMAIN=""', ''),
      domain('DOMAIN=\'\'', ''),
      domain('DOMAIN= # faqat izoh', ''),
    ];
    const LAST: Case[] = [
      // Bo'sh satr tepada qolib ketgan (bots-setup.sh dan oldingi qo'lda yozilgan) holat: haqiqiy qiymat — pastdagisi
      ['STAFF_BOT_TOKEN=""\nSTAFF_BOT_TOKEN="222:staff"\n', '222:staff', 'STAFF_BOT_TOKEN'],
      ['DOMAIN=eski.uz\nDOMAIN=pack24.uz\n', 'pack24.uz', 'DOMAIN'],
      ['DOMAIN=pack24.uz\nDOMAIN=\n', '', 'DOMAIN'],
      ['DOMAIN_OLD=eski.uz\n# DOMAIN=izohdagi.uz\n  DOMAIN=surilgan.uz\nMY_DOMAIN=boshqa.uz\n', '', 'DOMAIN'],
      ['DOMAIN=pack24.uz\n', '', 'BACKUP_PASSPHRASE'],
      ['', '', 'DOMAIN'],
      // Oxirgi satr yangi satr belgisisiz tugagan fayl
      ['NODE_ENV=production\nDOMAIN=pack24.uz', 'pack24.uz', 'DOMAIN'],
    ];
    const CHARS: Case[] = [
      ['X=a=b=c', 'a=b=c'],
      ['X="a=b"', 'a=b'],
      ['X=abc#def', 'abc#def'],
      ['X="it\'s"', 'it\'s'],
      ['X=ikki so\'z', 'ikki so\'z'],
      // Faqat BIR juft tashqi tirnoq olinadi: ichidagi boshqa turdagi tirnoq — qiymatning o'zi
      ['X="\'x\'"', '\'x\''],
      ['X=\'"x"\'', '"x"'],
      // Tirnoq qiymat boshida bo'lmasa oddiy belgi; juftsiz tirnoq ham olib tashlanmaydi
      ['X=a"b"', 'a"b"'],
      ['X="abc', '"abc'],
      // Qiymat hech qachon buyruq sifatida bajarilmaydi: shell uchun maxsus belgilar o'zgarishsiz qaytadi
      ['X=$(echo bajarildi)', '$(echo bajarildi)'],
      ['X="`echo bajarildi` $HOME \\n"', '`echo bajarildi` $HOME \\n'],
    ];
    // Izoh faqat tirnoqdan TASHQARIDA: ilgari izoh tirnoqdan oldin olib tashlanardi va qo'shtirnoqdagi «... #...» qiymati kesilib qolardi
    // (docker compose uni butun o'qiydi) — zaxira paroli shunday bo'lsa nusxa boshqa parol bilan shifrlanardi
    const QUOTED: Case[] = [
      ['X="ci-dummy-backup #2031-secret"', 'ci-dummy-backup #2031-secret'],
      ['X=\'ci-dummy-backup #2031-secret\'', 'ci-dummy-backup #2031-secret'],
      ['X="ci-dummy-backup #2031-secret" # zaxira paroli', 'ci-dummy-backup #2031-secret'],
      ['X="ci-dummy-backup #2031-secret"   #izoh "tirnoqli"\r', 'ci-dummy-backup #2031-secret'],
      ['X="a # b # c"', 'a # b # c'],
      ['X="# boshidan"', '# boshidan'],
      // Tirnoq ichidagi chetki bo'shliqlar ham qiymatning o'zi
      ['X="  ikki chetida  "', '  ikki chetida  '],
      // Tirnoqsiz qiymatda esa bo'shliqdan keyingi "#" — izoh
      ['X=ci-dummy-backup #2031-secret', 'ci-dummy-backup'],
    ];
    const TOKENS: Case[] = ['STAFF_BOT_TOKEN="222:staff"', 'STAFF_BOT_TOKEN="222:staff" ', 'STAFF_BOT_TOKEN=\'222:staff\'', 'STAFF_BOT_TOKEN=222:staff # boshqaruv boti', 'STAFF_BOT_TOKEN="222:staff"\r', 'STAFF_BOT_TOKEN="222:staff" # boshqaruv boti\r']
      .map((line): Case => [line, '222:staff', 'STAFF_BOT_TOKEN']);

    // Hamma jadval har bir skript uchun bitta bash jarayonida bajariladi (Windows'da jarayon ochish qimmat)
    const read = new Map<Case, Record<string, string>>();
    beforeAll(() => {
      const all = [COMPOSE, LAST, CHARS, QUOTED, TOKENS].flat();
      for (const [name, text] of SCRIPTS) {
        envVals(all.map(([env, , key]) => [key ?? 'X', env] as const), text, name).forEach((value, i) => read.set(all[i], { ...read.get(all[i]), [name]: value }));
      }
    }, 120_000);
    /** Jadvalning har bir satri ikkala skriptda ham kutilgan qiymatni bergan */
    const expectTable = (table: Case[]) => {
      const wanted = Object.fromEntries(table.map(([env, expected, key]) => [`${key ?? 'X'} <- ${inspect(env)}`, expected]));
      expect(Object.keys(wanted)).toHaveLength(table.length);
      for (const [name] of SCRIPTS) expect(Object.fromEntries(table.map((c) => [`${c[2] ?? 'X'} <- ${inspect(c[0])}`, read.get(c)?.[name]])), name).toEqual(wanted);
    };

    it('qiymat docker compose o\'qigandek olinadi: tirnoq, chetdagi bo\'shliq, satr oxiridagi izoh va CR (Windows satr oxiri) olib tashlanadi', () => {
      expectTable(COMPOSE);
    });

    it('kalit takrorlansa oxirgi satr olinadi; boshqa kalit, izohga olingan yoki surilgan satr hisobga kirmaydi; kalit yo\'q bo\'lsa bo\'sh', () => {
      expectTable(LAST);
    });

    it('qiymatning o\'zidagi belgilar saqlanadi: "=", bo\'shliqsiz "#", ichki tirnoq va bo\'shliq; faqat bir juft tashqi tirnoq olinadi; qiymat bajarilmaydi', () => {
      expectTable(CHARS);
    });

    it('tirnoq ichidagi " #" izoh emas: tirnoqli qiymat kesilmaydi (qo\'lda yozilgan zaxira paroli boshqa parol bilan shifrlanib qolmasin)', () => {
      expectTable(QUOTED);
    });

    it('shunday o\'qilgan bot tokeni skriptning token qolipidan o\'tadi — chetidagi bo\'shliq yoki tirnoq bilan o\'tmas edi', () => {
      expectTable(TOKENS);
      const tokenShape = new RegExp(inScript(/\[\[ "\$token" =~ (\^\S+\$) \]\] \|\| return 2/, 'bot tokeni qolipi')[1]);
      for (const c of TOKENS) expect(tokenShape.test(read.get(c)?.['watchdog.sh'] ?? ''), inspect(c[0])).toBe(true);
      for (const raw of ['"222:staff"', '222:staff ', '222:staff\r', '']) expect(tokenShape.test(raw), inspect(raw)).toBe(false);
      // Tashqi nusxa skripti ham tokenni aynan shu qolip bilan tekshiradi
      expect(/\[\[ "\$TOKEN" =~ (\^\S+\$) \]\] \|\| fail/.exec(offsiteScript)?.[1]).toBe(tokenShape.source);
    });
  });
});

// ─── Oxirgi zaxira nusxa yoshi (watchdog.sh, 4-tekshiruv) ────────────────────

/** Skriptning shu bo'lagi: BACKUP_AGE_H=-1 dan keyingi tekshiruv izohigacha (ichida bo'sh satr yo'q) */
const backupAgeBlock = (): string => inScript(/\n(BACKUP_AGE_H=-1\n(?:.+\n)+)\n# 5\)/, 'zaxira yoshini hisoblaydigan bo\'lak')[1];

/**
 * O'sha bo'lakni haqiqiy bash'da bajaradi (find, sort, tail va cut haqiqiy). Har bir holat — zaxira papkasidagi nomlar: fayl uchun yoshi
 * (soniyada; manfiy — vaqti kelajakda), 'papka' — shu nomli papka; `null` — zaxira papkasining o'zi yo'q.
 * Qaytadi: skript ilovaga yuboradigan backupAgeH qiymatlari. "Hozir" (NOW) skriptga beriladi — natija test qancha ishlaganiga bog'liq emas.
 */
function backupAges(cases: (Record<string, number | 'papka'> | null)[]): number[] {
  return sandbox((dir) => {
    const now = Math.floor(Date.now() / 1000);
    cases.forEach((names, i) => {
      if (!names) return;
      mkdirSync(join(dir, `b${i}`));
      for (const [name, age] of Object.entries(names)) {
        const path = join(dir, `b${i}`, name);
        if (age === 'papka') mkdirSync(path);
        else {
          writeFileSync(path, 'x');
          utimesSync(path, now - age, now - age);
        }
      }
    });
    const lines = ['set -uo pipefail', `NOW=${now}`, 'age() {', 'BACKUPS="$1"', backupAgeBlock(), 'echo "$BACKUP_AGE_H"', '}', ...cases.map((_, i) => `age b${i}`)];
    const values = bashLines(dir, lines).trim().split('\n');
    if (values.length !== cases.length) throw new Error(`zaxira yoshi: ${cases.length} ta qiymat kutilgan edi, chiqdi: ${inspect(values)}`);
    return values.map(Number);
  });
}

describe.skipIf(NO_GNU)('server kuzatuvi: oxirgi zaxira nusxa yoshi (watchdog.sh bo\'lagi haqiqiy bash\'da)', { timeout: 60_000 }, () => {
  const H = 3600;
  const DB = 'db-2031-05-05_0300.sql.gz';

  it('eng yangi db-*.sql.gz faylining yoshi to\'liq soatlarda; kunlik nusxa bo\'lmasa -1', () => {
    expect(backupAges([
      null,
      {},
      // Rasmlar arxivi, yarim yozilgan fayl, migratsiya oldidan olingan nusxa va shu nomli papka — kunlik baza nusxasi emas
      { 'uploads-2031-05-05_0300.tar.gz': H, [`${DB}.tmp`]: H, 'premigration-2031-05-05_0300.sql.gz': H, 'db-papka.sql.gz': 'papka' },
      { [DB]: 59 * 60 },
      { [DB]: 5 * H + 60 },
      { [DB]: 29 * H + 3599 },
      { [DB]: 30 * H },
      { 'db-2031-05-03_0300.sql.gz': 50 * H, [DB]: 3 * H + 10, 'uploads-2031-05-05_0300.tar.gz': 60 },
    ])).toEqual([-1, -1, -1, 0, 5, 29, 30, 3]);
  });

  // Server soati orqaga surilgan yoki nusxa boshqa serverdan ko'chirilgan: fayl vaqti "kelajakda". Ilgari 1–2 soat oldindagi fayl uchun yosh -1
  // chiqardi — ilova buni "zaxira nusxa topilmadi" deb o'qib, administratorlarga yolg'on xabar yuborardi
  it('fayl vaqti kelajakda bo\'lsa yosh 0 — "nusxa yo\'q" (-1) emas: kunlik tekshiruv "zaxira nusxa topilmadi" demaydi', async () => {
    const ages = backupAges([{ [DB]: -30 * 60 }, { [DB]: -H }, { [DB]: -90 * 60 }, { [DB]: -2 * H }, { [DB]: -26 * H }, { 'db-2031-05-03_0300.sql.gz': 40 * H, [DB]: -90 * 60 }]);
    expect(ages).toEqual([0, 0, 0, 0, 0, 0]);

    // Skript yuboradigan qiymat ilovada: 0 — sog'lom; -1 esa (faqat fayl umuman yo'q bo'lganda) "topilmadi"
    for (const backupAgeH of [ages[2], -1]) expect(OPS_FACTS.safeParse({ ...HEALTHY, backupAgeH }).success, String(backupAgeH)).toBe(true);
    await saveOps({ ...HEALTHY, backupAgeH: ages[2] }, new Date(NOW.getTime() - 2 * MINUTE));
    expect(await collectChecks(NOW)).toEqual([]);
    await saveOps({ ...HEALTHY, backupAgeH: -1 }, new Date(NOW.getTime() - 2 * MINUTE));
    expect((await collectChecks(NOW)).map((c) => `${c.severity}: ${c.title}`)).toEqual(['high: Zaxira nusxa topilmadi']);
  });
});

// ─── restore-test.sh va offsite-send.sh: natija belgisi (ok / fail) ──────────
// Ikkala skript natijani holat papkasidagi belgi fayllari bilan qoldiradi; watchdog.sh shularga qarab administratorlarga xabar beradi.
// Skript oxirigacha yetmagan bo'lsa (xato, kutilmagan to'xtash, o'chirib qo'yilish) "o'tmadi" belgisi qolishi shart — eski "o'tdi"
// belgisi buzilgan nusxani yashirmasin. Quyida skriptlarning o'zi bajariladi: faqat docker, curl, flock va rm o'rnida soxta funksiyalar

/** Skript boshiga (set -euo pipefail dan keyin) soxta buyruqlar qo'shiladi; qolgan hamma satr — asl skript */
const withStubs = (text: string, stubs: string): string => {
  const head = 'set -euo pipefail\n';
  if (!text.includes(head)) throw new Error('skript boshida "set -euo pipefail" topilmadi — shu testni ham yangilang');
  return text.replace(head, () => `${head}${stubs}\n`);
};
/** Skriptning asosiy jarayoniga SIGTERM (server o'chirilishi, kill) va u tugaguncha kutish (ko'pi bilan 2 soniya) */
const KILL_SCRIPT = 'kill -TERM $$; for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 $$ 2>/dev/null || break; sleep 0.2; done';

const DUMP_NAME = 'db-2031-05-05_0300.sql.gz';
const DUMP_SQL = 'CREATE TABLE "Order" (id integer);\nINSERT INTO "Order" VALUES (15);\n';
const DUMP_GZ = gzipSync(DUMP_SQL);
const fileExists = (...path: string[]) => existsSync(join(...path));
const fileText = (...path: string[]) => (fileExists(...path) ? readFileSync(join(...path), 'utf8') : null);

/**
 * docker o'rnida: har bir chaqiruv calls.log ga yoziladi. Sinov bazasiga tiklash (psql, kirishda — nusxa matni) P24_MODE ga qarab:
 * odatda matn restored.sql ga yoziladi; badsql — psql xato qaytaradi; kill — shu paytda skript o'chirib qo'yiladi.
 * Jadvallar sanog'i (… -c "SELECT count(*) …"): information_schema uchun P24_TABLES, qolganlari uchun 3.
 * rm: rmfail rejimida tiklash xatolari faylini o'chirib bo'lmaydi — skript kutilmagan joyda (set -e) to'xtaydi.
 */
const RESTORE_STUBS = [
  'docker() {',
  '  printf \'%s\\n\' "$*" >> calls.log',
  '  case "$*" in',
  '    *" dropdb "*) return 0 ;;',
  '    *" createdb "*) [ "${P24_MODE:-}" != nocreate ] ;;',
  '    *" -c "*) case "$*" in *information_schema*) echo "${P24_TABLES:-25}" ;; *) echo 3 ;; esac ;;',
  '    *" psql "*)',
  '      case "${P24_MODE:-}" in',
  `        kill) ${KILL_SCRIPT} ;;`,
  '        badsql) cat > /dev/null; echo \'ERROR:  relation "Order" already exists\' >&2; return 3 ;;',
  '        *) cat > restored.sql ;;',
  '      esac ;;',
  '  esac',
  '}',
  'flock() { :; }',
  'rm() { case "${P24_MODE:-}:$*" in rmfail:*restore-test.err) return 1 ;; esac; command rm "$@"; }',
].join('\n');

type RestoreRun = Run & { ok: string | null; fail: string | null; calls: string[]; restored: string | null };
/** restore-test.sh ni vaqtinchalik papkada bajaradi. `marker` — skriptgacha turgan belgi (oldingi sinov natijasi); `file: null` — nom berilmagan */
function restoreTest(opts: { mode?: string; tables?: number; marker?: 'ok' | 'fail'; file?: string | null; dump?: Buffer } = {}): RestoreRun {
  return sandbox((dir) => {
    for (const sub of ['deploy', 'backups', 'state']) mkdirSync(join(dir, sub));
    writeFileSync(join(dir, 'deploy', 'restore-test.sh'), withStubs(restoreScript, RESTORE_STUBS));
    writeFileSync(join(dir, 'backups', DUMP_NAME), opts.dump ?? DUMP_GZ);
    if (opts.marker) writeFileSync(join(dir, 'state', `restore-test.${opts.marker}`), 'avvalgi\n');
    const args = opts.file === null ? [] : [opts.file ?? `backups/${DUMP_NAME}`];
    const run = bash(dir, ['deploy/restore-test.sh', ...args], { WATCHDOG_STATE: 'state', BACKUP_DIR: 'backups', RESTORE_TEST_LOCK: 'restore.lock', P24_MODE: opts.mode ?? '', P24_TABLES: String(opts.tables ?? 25) });
    return { ...run, ok: fileText(dir, 'state', 'restore-test.ok'), fail: fileText(dir, 'state', 'restore-test.fail'), calls: (fileText(dir, 'calls.log') ?? '').split('\n').filter(Boolean), restored: fileText(dir, 'restored.sql') };
  });
}

const STAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\n$/;
/** Skript chiqishidagi "O'TMADI" / "YUBORILMADI" satrlari (sana-vaqtsiz) */
const failures = (run: Run, word: string) => run.out.split('\n').filter((line) => line.includes(word)).map((line) => line.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} /, ''));

describe.skipIf(NO_GNU)('zaxirani tiklash sinovi: natija belgisi (restore-test.sh haqiqiy bash\'da; docker va flock o\'rnida soxta funksiyalar)', { timeout: 60_000 }, () => {
  const TESTDB = 'pack24_restore_test';

  it('sinov muhiti: skriptga faqat soxta buyruqlar qo\'shilgan, qolgan hamma satr — asl skript', () => {
    const sandboxed = withStubs(restoreScript, RESTORE_STUBS);
    expect(sandboxed.replace(`${RESTORE_STUBS}\n`, () => '')).toBe(restoreScript);
    expect(sandboxed.indexOf(RESTORE_STUBS)).toBeLessThan(sandboxed.indexOf('trap on_exit EXIT'));
  });

  it('sinov o\'tsa: "o\'tdi" belgisi yoziladi, avvalgi "o\'tmadi" belgisi o\'chadi; nusxa faqat sinov bazasiga tiklanadi va u oxirida o\'chiriladi', () => {
    const run = restoreTest({ marker: 'fail' });
    expect(run.code, run.out).toBe(0);
    expect(run.ok).toMatch(STAMP);
    expect(run.fail).toBeNull();
    expect(run.out).toMatch(new RegExp(`tiklash sinovi o'tdi: ${DUMP_NAME.replaceAll('.', '\\.')} — 25 jadval, 3 buyurtma, 3 mahsulot, 3 foydalanuvchi\\n$`));
    expect(failures(run, 'O\'TMADI')).toEqual([]);
    // Nusxaning o'zi (gzip ochilgan holda) sinov bazasiga berilgan
    expect(run.restored).toBe(DUMP_SQL);
    // Ishlab turgan bazaga tegilmaydi: har bir docker chaqiruvi sinov bazasi nomi bilan; avval va oxirida u o'chiriladi
    expect(run.calls.filter((c) => !c.includes(TESTDB))).toEqual([]);
    expect(run.calls).toHaveLength(9);
    expect(run.calls[0]).toBe(`compose exec -T db dropdb -U pack24 --if-exists --force ${TESTDB}`);
    expect(run.calls[1]).toBe(`compose exec -T db createdb -U pack24 ${TESTDB}`);
    expect(run.calls[2]).toBe(`compose exec -T db psql -U pack24 -v ON_ERROR_STOP=1 -q -d ${TESTDB}`);
    expect(run.calls.at(-1)).toBe(run.calls[0]);
  });

  it('nusxa tiklanmasa yoki tiklangan baza to\'liq bo\'lmasa: "o\'tmadi" belgisi yoziladi, avvalgi "o\'tdi" belgisi o\'chadi; sabab bir marta aytiladi', () => {
    const cases: [string, Parameters<typeof restoreTest>[0], RegExp][] = [
      ['psql xato berdi', { mode: 'badsql' }, /^tiklash sinovi O'TMADI: nusxa tiklanmadi: ERROR: {2}relation "Order" already exists/],
      ['jadvallar kam', { tables: 3 }, /^tiklash sinovi O'TMADI: tiklangan baza to'liq emas \(jadvallar: 3, migratsiyalar: 3\)$/],
      ['sinov bazasi yaratilmadi', { mode: 'nocreate' }, /^tiklash sinovi O'TMADI: sinov bazasini yaratib bo'lmadi$/],
      ['fayl gzip emas', { dump: Buffer.from(DUMP_SQL) }, /^tiklash sinovi O'TMADI: fayl buzilgan \(gzip\): db-2031-05-05_0300\.sql\.gz$/],
    ];
    for (const [name, opts, reason] of cases) {
      const run = restoreTest({ ...opts, marker: 'ok' });
      expect(run.code, `${name}\n${run.out}`).toBe(1);
      expect(run.fail, name).toMatch(STAMP);
      expect(run.ok, name).toBeNull();
      // Tuzoq ikkinchi marta "o'tmadi" deb yozmaydi
      expect(failures(run, 'O\'TMADI'), name).toEqual([expect.stringMatching(reason)]);
      // Sinov bazasi qolib ketmaydi (yaratishgacha yetib borgan bo'lsa)
      if (run.calls.length) expect(run.calls.at(-1), name).toContain(` dropdb -U pack24 --if-exists --force ${TESTDB}`);
    }
  });

  // Tuzoq ilgari chiqish kodiga qarardi: signal bilan to'xtatilgan skriptda u 0 bo'lib ko'rinadi — "o'tmadi" yozilmas, kechagi "o'tdi"
  // belgisi esa bugungi (sinalmagan) nusxa uchun ham "yaxshi" deb turaverardi
  it('sinov o\'rtasida o\'chirib qo\'yilsa (SIGTERM): "o\'tmadi" belgisi yoziladi va avvalgi "o\'tdi" o\'chadi — chiqish kodi qanday bo\'lishidan qat\'i nazar', () => {
    const run = restoreTest({ mode: 'kill', marker: 'ok' });
    expect(run.code, run.out).not.toBe(0);
    expect(run.fail).toMatch(STAMP);
    expect(run.ok).toBeNull();
    expect(failures(run, 'O\'TMADI')).toEqual([expect.stringMatching(/^tiklash sinovi O'TMADI: sinov oxirigacha yetmadi \(to'xtatilgan yoki kutilmagan xato, kod \d+\)$/)]);
    expect(run.out).not.toContain('tiklash sinovi o\'tdi');
    // Sinov bazasi shunda ham o'chiriladi; jadvallarni sanashgacha yetib borilmagan
    expect(run.calls.at(-1)).toBe(`compose exec -T db dropdb -U pack24 --if-exists --force ${TESTDB}`);
    expect(run.calls.filter((c) => c.includes(' -c '))).toEqual([]);
  });

  it('kutilmagan joyda xato bilan to\'xtasa (set -e): shunda ham "o\'tmadi" belgisi yoziladi, avvalgi "o\'tdi" o\'chadi', () => {
    const run = restoreTest({ mode: 'rmfail', marker: 'ok' });
    expect(run.code, run.out).toBe(1);
    expect(run.fail).toMatch(STAMP);
    expect(run.ok).toBeNull();
    expect(failures(run, 'O\'TMADI')).toEqual(['tiklash sinovi O\'TMADI: sinov oxirigacha yetmadi (to\'xtatilgan yoki kutilmagan xato, kod 1)']);
    expect(run.calls.at(-1)).toContain(' dropdb ');
  });

  // Qo'lda berilgan nom xato bo'lsa bu zaxira muammosi emas
  it('yo\'q fayl nomi berilsa: xato aytiladi, lekin belgilar o\'zgarmaydi va bazaga umuman tegilmaydi', () => {
    for (const marker of ['ok', 'fail'] as const) {
      const run = restoreTest({ file: 'backups/db-yoq.sql.gz', marker });
      expect(run.code, run.out).toBe(1);
      expect(run.out).toMatch(/^XATO: fayl topilmadi: .*backups\/db-yoq\.sql\.gz\n$/);
      expect({ ok: run.ok, fail: run.fail }).toEqual({ ok: null, fail: null, [marker]: 'avvalgi\n' });
      expect(run.calls).toEqual([]);
    }
  });
});

/**
 * curl o'rnida: buyruq satri dalillari curl-args.log ga, stdin'dan o'qilgan sozlama (manzil, chat, fayl) curl-conf.log ga yoziladi;
 * yuborilayotgan fayl sent.enc ga nusxalanadi. P24_MODE: offline — Telegram javob bermaydi; kill — shu paytda skript o'chirib qo'yiladi.
 */
const OFFSITE_STUBS = [
  'curl() {',
  '  local conf doc',
  '  conf="$(cat)"',
  '  printf \'%s\\n\' "$*" >> curl-args.log',
  '  printf \'%s\\n\\n\' "$conf" >> curl-conf.log',
  '  doc="$(printf \'%s\\n\' "$conf" | sed -n \'s/^form = "document=@\\([^;]*\\);.*$/\\1/p\')"',
  '  [ -z "$doc" ] || cp "$doc" sent.enc',
  '  case "${P24_MODE:-}" in',
  '    offline) return 6 ;;',
  `    kill) ${KILL_SCRIPT} ;;`,
  '  esac',
  '}',
].join('\n');

/** Zaxira paroli: tirnoq ichida bo'shliq va "#" bor (qo'lda yozilgan .env) — soxta, gitleaks ruxsat bergan ko'rinishda */
const PHRASE = 'ci-dummy-backup #2031-secret';
const OFFSITE_ENV = `DOMAIN=pack24.uz\nBACKUP_PASSPHRASE="${PHRASE}" # zaxira paroli\nSTAFF_BOT_TOKEN="222:staff"\n`;

/** `openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt` yozgan faylni shu parol bilan ochadi (skript boshidagi "Ochish" buyrug'ining ishi); parol mos kelmasa null */
function decrypt(file: Buffer, phrase: string): Buffer | null {
  if (file.subarray(0, 8).toString('latin1') !== 'Salted__') throw new Error('shifrlangan fayl openssl sarlavhasi ("Salted__") bilan boshlanmaydi');
  const material = pbkdf2Sync(phrase, file.subarray(8, 16), 200_000, 48, 'sha256');
  const decipher = createDecipheriv('aes-256-cbc', material.subarray(0, 32), material.subarray(32));
  try {
    return Buffer.concat([decipher.update(file.subarray(16)), decipher.final()]);
  } catch {
    return null;
  }
}

type OffsiteRun = Run & { ok: string | null; fail: string | null; args: string[]; conf: string; sent: Buffer | null; temp: string[] };
/** offsite-send.sh ni vaqtinchalik papkada bajaradi. `chats: null` — ro'yxat fayli yo'q; `marker` — skriptgacha turgan belgi */
function offsiteSend(opts: { env?: string; chats?: string | null; mode?: string; marker?: 'ok' | 'fail'; file?: string | null } = {}): OffsiteRun {
  return sandbox((dir) => {
    for (const sub of ['deploy', 'backups', 'state', 'tmp']) mkdirSync(join(dir, sub));
    writeFileSync(join(dir, 'deploy', 'offsite-send.sh'), withStubs(offsiteScript, OFFSITE_STUBS));
    writeFileSync(join(dir, '.env'), opts.env ?? OFFSITE_ENV);
    writeFileSync(join(dir, 'backups', DUMP_NAME), DUMP_GZ);
    if (opts.chats !== null) writeFileSync(join(dir, 'state', 'chats'), opts.chats ?? '7000001\n');
    if (opts.marker) writeFileSync(join(dir, 'state', `offsite.${opts.marker}`), 'avvalgi\n');
    const args = opts.file === null ? [] : [opts.file ?? `backups/${DUMP_NAME}`];
    const run = bash(dir, ['deploy/offsite-send.sh', ...args], { WATCHDOG_STATE: 'state', TMPDIR: 'tmp', P24_MODE: opts.mode ?? '' });
    return {
      ...run,
      ok: fileText(dir, 'state', 'offsite.ok'),
      fail: fileText(dir, 'state', 'offsite.fail'),
      args: (fileText(dir, 'curl-args.log') ?? '').split('\n').filter(Boolean),
      conf: fileText(dir, 'curl-conf.log') ?? '',
      sent: fileExists(dir, 'sent.enc') ? readFileSync(join(dir, 'sent.enc')) : null,
      temp: readdirSync(join(dir, 'tmp')),
    };
  });
}

describe.skipIf(NO_GNU)('serverdan tashqaridagi nusxa: natija belgisi va shifr (offsite-send.sh haqiqiy bash\'da; curl o\'rnida soxta funksiya, openssl haqiqiy)', { timeout: 60_000 }, () => {
  it('sinov muhiti: skriptga faqat soxta curl qo\'shilgan, qolgan hamma satr — asl skript', () => {
    const sandboxed = withStubs(offsiteScript, OFFSITE_STUBS);
    expect(sandboxed.replace(`${OFFSITE_STUBS}\n`, () => '')).toBe(offsiteScript);
  });

  it('yuborilsa: "yuborildi" belgisi, avvalgi "yuborilmadi" o\'chadi; nusxa .env dagi parolning O\'ZI bilan shifrlangan (tirnoq ichidagi " #" bilan birga), faqat ro\'yxatdagi raqamli ID larga ketadi', () => {
    const run = offsiteSend({ chats: '7000001\n@pack24_admin\n-1001234567890\n12\n', marker: 'fail' });
    expect(run.code, run.out).toBe(0);
    expect(run.ok).toMatch(STAMP);
    expect(run.fail).toBeNull();
    expect(run.out).toMatch(new RegExp(`tashqi nusxa yuborildi: ${DUMP_NAME.replaceAll('.', '\\.')}\\.enc \\(\\d+ KB, 2 ta qabul qiluvchi\\)\\n$`));
    expect(failures(run, 'YUBORILMADI')).toEqual([]);

    // Har bir yaroqli ID ga bittadan so'rov: boshqaruv boti orqali, fayl nomi — asl nom + .enc
    const sends = run.conf.trim().split('\n\n').map((block) => block.split('\n'));
    expect(sends.map((lines) => lines.slice(0, 2))).toEqual([
      ['url = "https://api.telegram.org/bot222:staff/sendDocument"', 'form = "chat_id=7000001"'],
      ['url = "https://api.telegram.org/bot222:staff/sendDocument"', 'form = "chat_id=-1001234567890"'],
    ]);
    for (const lines of sends) expect(lines[2]).toMatch(new RegExp(`^form = "document=@(?:.*/)?tmp/pack24-offsite\\.\\w+;filename=${DUMP_NAME.replaceAll('.', '\\.')}\\.enc"$`));
    // Token ham, parol ham buyruq satrida yo'q (curl sozlamani stdin'dan, openssl parolni muhitdan oladi); ekranga ham chiqmaydi
    expect(run.args).toEqual(['-fsS -m 120 -o /dev/null -K -', '-fsS -m 120 -o /dev/null -K -']);
    for (const secret of ['222:staff', PHRASE, 'ci-dummy-backup']) expect(run.out, secret).not.toContain(secret);

    // Yuborilgan fayl — shifrlangan nusxa: ochiq matn emas va aynan .env dagi parol bilan ochiladi
    expect(run.sent).not.toBeNull();
    expect(run.sent!.includes(DUMP_GZ)).toBe(false);
    expect(decrypt(run.sent!, PHRASE)?.equals(DUMP_GZ)).toBe(true);
    // Ilgari " #" dan keyingisi izoh deb kesilardi: nusxa «"ci-dummy-backup» degan boshqa parol bilan shifrlanib, egasi uni ocha olmasdi
    for (const wrong of ['"ci-dummy-backup', 'ci-dummy-backup', `"${PHRASE}"`]) expect(decrypt(run.sent!, wrong)?.equals(DUMP_GZ) ?? false, wrong).toBe(false);
    // Vaqtinchalik (shifrlangan) fayl serverda qolmaydi
    expect(run.temp).toEqual([]);
  });

  it('yoqilmagan (parol yo\'q yoki bo\'sh): skript jim chiqadi — hech narsa yuborilmaydi, belgilar o\'zgarmaydi', () => {
    for (const env of ['STAFF_BOT_TOKEN="222:staff"\n', 'BACKUP_PASSPHRASE=""\nSTAFF_BOT_TOKEN="222:staff"\n', 'BACKUP_PASSPHRASE= # o\'chirilgan\n', `BACKUP_PASSPHRASE="${PHRASE}"\nBACKUP_PASSPHRASE=""\n`]) {
      const run = offsiteSend({ env, marker: 'ok' });
      expect({ code: run.code, out: run.out }, inspect(env)).toEqual({ code: 0, out: '' });
      expect({ ok: run.ok, fail: run.fail, args: run.args, sent: run.sent, temp: run.temp }, inspect(env)).toEqual({ ok: 'avvalgi\n', fail: null, args: [], sent: null, temp: [] });
    }
  });

  it('yuborib bo\'lmasa (Telegram javob bermadi, administrator yo\'q, bot tokeni yo\'q): "yuborilmadi" belgisi yoziladi, sabab bir marta aytiladi, vaqtinchalik fayl o\'chiriladi', () => {
    const cases: [string, Parameters<typeof offsiteSend>[0], RegExp, number][] = [
      ['Telegram javob bermadi', { mode: 'offline' }, /^tashqi nusxa YUBORILMADI: Telegram'ga yuborib bo'lmadi$/, 1],
      ['ro\'yxat bo\'sh', { chats: '' }, /^tashqi nusxa YUBORILMADI: boshqaruv botiga ulangan administrator yo'q/, 0],
      ['ro\'yxat fayli yo\'q', { chats: null }, /^tashqi nusxa YUBORILMADI: boshqaruv botiga ulangan administrator yo'q/, 0],
      ['ro\'yxatda yaroqli ID yo\'q', { chats: '@pack24_admin\n12\n' }, /^tashqi nusxa YUBORILMADI: Telegram'ga yuborib bo'lmadi$/, 0],
      ['bot tokeni yo\'q', { env: `BACKUP_PASSPHRASE="${PHRASE}"\n` }, /^tashqi nusxa YUBORILMADI: boshqaruv boti tokeni kiritilmagan/, 0],
      ['bot tokeni yaroqsiz', { env: `BACKUP_PASSPHRASE="${PHRASE}"\nSTAFF_BOT_TOKEN="staff token"\n` }, /^tashqi nusxa YUBORILMADI: boshqaruv boti tokeni kiritilmagan/, 0],
    ];
    for (const [name, opts, reason, attempts] of cases) {
      const run = offsiteSend(opts);
      expect(run.code, `${name}\n${run.out}`).toBe(1);
      expect(run.fail, name).toMatch(STAMP);
      expect(run.ok, name).toBeNull();
      // Tuzoq ikkinchi marta "yuborilmadi" deb yozmaydi
      expect(failures(run, 'YUBORILMADI'), name).toEqual([expect.stringMatching(reason)]);
      expect(run.args, name).toHaveLength(attempts);
      expect(run.temp, name).toEqual([]);
      expect(run.out, name).not.toContain(PHRASE);
    }
  });

  // Tuzoq ilgari chiqish kodiga qarardi: signal bilan to'xtatilgan skriptda u 0 bo'lib ko'rinadi — belgi yozilmas, administrator esa
  // nusxa yuborilmaganini bilmay qolardi
  it('yuborish o\'rtasida o\'chirib qo\'yilsa (SIGTERM): "yuborilmadi" belgisi yoziladi, "yuborildi" yozilmaydi, shifrlangan vaqtinchalik fayl o\'chiriladi', () => {
    const run = offsiteSend({ mode: 'kill' });
    expect(run.code, run.out).not.toBe(0);
    expect(run.fail).toMatch(STAMP);
    expect(run.ok).toBeNull();
    expect(failures(run, 'YUBORILMADI')).toEqual([expect.stringMatching(/^tashqi nusxa YUBORILMADI: yuborish oxirigacha yetmadi \(to'xtatilgan yoki kutilmagan xato, kod \d+\)$/)]);
    expect(run.out).not.toContain('tashqi nusxa yuborildi');
    // So'rov boshlangan edi (fayl shifrlangan), lekin skript tugaganda vaqtinchalik fayl qolmagan
    expect(run.args).toHaveLength(1);
    expect(run.sent).not.toBeNull();
    expect(run.temp).toEqual([]);
  });

  // Noto'g'ri chaqiruv (nom berilmagan yoki xato) yuborish muammosi emas
  it('fayl nomi berilmasa yoki bunday fayl bo\'lmasa: xato aytiladi, belgilar o\'zgarmaydi, hech narsa yuborilmaydi', () => {
    for (const file of [null, 'backups/db-yoq.sql.gz']) {
      const run = offsiteSend({ file, marker: 'ok' });
      expect(run.code, run.out).toBe(1);
      expect(run.out).toMatch(/^XATO: fayl topilmadi: /);
      expect({ ok: run.ok, fail: run.fail, args: run.args, temp: run.temp }).toEqual({ ok: 'avvalgi\n', fail: null, args: [], temp: [] });
    }
  });
});

// ─── Kunlik tekshiruvdagi server qoidalari ───────────────────────────────────

describe('kunlik tekshiruv: server holati va xabarlar navbati (collectChecks, bazasiz)', () => {
  const brief = (checks: AuditCheck[]) => checks.map((c) => `${c.severity}:${c.key}`);
  /** Server `agoMs` oldin shu faktlarni yuborgan (standart: 2 daqiqa oldin, sog'lom) */
  const heartbeat = (patch: Partial<OpsFacts> = {}, agoMs = 2 * MINUTE) => saveOps({ ...HEALTHY, ...patch }, new Date(NOW.getTime() - agoMs));
  /** Hamma narsa yomon: har bir server qoidasi topilma beradi */
  const BAD: OpsFacts = { disk: 97, backupAgeH: -1, restoreOk: 0, offsiteOk: 0, certDays: 2, siteOk: 0, tickOk: 1 };
  const ALL_BAD = ['high:ops_backup', 'high:ops_cert', 'high:ops_disk', 'high:ops_restore', 'high:ops_site', 'medium:ops_offsite'];

  it('server sog\'lom, navbat bo\'sh: topilma yo\'q; holat va navbat tekshiruv vaqti bilan so\'raladi', async () => {
    await heartbeat();
    expect(await collectChecks(NOW)).toEqual([]);
    expect(h.readOps).toHaveBeenCalledTimes(1);
    expect(h.readOps).toHaveBeenCalledWith(NOW);
    expect(h.outboxStats).toHaveBeenCalledTimes(1);
    expect(h.outboxStats).toHaveBeenCalledWith(NOW);
  });

  it('signal hali umuman kelmagan (eski server skripti) yoki yozuv buzilgan: server bo\'yicha hech narsa aytilmaydi', async () => {
    expect(await collectChecks(NOW)).toEqual([]);
    db.settings.set('ops', { ...BAD }); // vaqtsiz yozuv — holat emas
    expect(await collectChecks(NOW)).toEqual([]);
    h.readOps.mockResolvedValue(null);
    expect(await collectChecks(NOW)).toEqual([]);
  });

  it('signal eskirgan: bitta "signal kelmayapti" topilmasi; eski faktlar bo\'yicha boshqa hech narsa aytilmaydi', async () => {
    await heartbeat(BAD, 30 * MINUTE + 1);
    const found = await collectChecks(NOW);
    expect(found).toEqual([expect.objectContaining({ key: 'ops_stale', severity: 'medium', count: 1, items: [], link: '/admin/audit' })]);
    // Oxirgi signal vaqti Toshkent vaqti bilan ko'rsatiladi (02:29 UTC = 07:29)
    expect(found[0].title).toContain('10.03.2031');
    expect(found[0].title).toContain('07:29');
  });

  it('signal 30 daqiqadan eski bo\'lmasa "kelmayapti" deyilmaydi va faktlarning o\'zi tekshiriladi', async () => {
    await heartbeat(BAD, 30 * MINUTE);
    expect(brief(await collectChecks(NOW)).sort()).toEqual(ALL_BAD);
    // Xuddi shu yozuv bir daqiqadan keyingi tekshiruvda allaqachon eskirgan
    expect(brief(await collectChecks(new Date(NOW.getTime() + MINUTE)))).toEqual(['medium:ops_stale']);
  });

  const thresholds: [string, Partial<OpsFacts>, string[]][] = [
    ['disk 79% band', { disk: 79 }, []],
    ['disk 80% band', { disk: 80 }, ['medium:ops_disk']],
    ['disk 89% band', { disk: 89 }, ['medium:ops_disk']],
    ['disk 90% band', { disk: 90 }, ['high:ops_disk']],
    ['disk 100% band', { disk: 100 }, ['high:ops_disk']],
    ['disk aniqlanmadi (-1)', { disk: -1 }, []],
    ['zaxira nusxa topilmadi (-1)', { backupAgeH: -1 }, ['high:ops_backup']],
    ['zaxira 30 soat oldin olingan', { backupAgeH: 30 }, ['high:ops_backup']],
    ['zaxira 29 soat oldin olingan', { backupAgeH: 29 }, []],
    ['zaxira hozirgina olingan (0)', { backupAgeH: 0 }, []],
    ['tiklash sinovi o\'tmadi (0)', { restoreOk: 0 }, ['high:ops_restore']],
    ['tiklash sinovi o\'tdi (1)', { restoreOk: 1 }, []],
    ['tiklash sinovi hali o\'tkazilmagan (-1)', { restoreOk: -1 }, []],
    ['tashqi nusxa yuborilmadi (0)', { offsiteOk: 0 }, ['medium:ops_offsite']],
    ['tashqi nusxa yoqilmagan (-1)', { offsiteOk: -1 }, []],
    ['tashqi nusxa yuborilgan (1)', { offsiteOk: 1 }, []],
    ['sertifikat bugun tugaydi (0 kun)', { certDays: 0 }, ['high:ops_cert']],
    ['sertifikatga 6 kun qoldi', { certDays: 6 }, ['high:ops_cert']],
    ['sertifikatga 7 kun qoldi', { certDays: 7 }, ['medium:ops_cert']],
    ['sertifikatga 20 kun qoldi', { certDays: 20 }, ['medium:ops_cert']],
    ['sertifikatga 21 kun qoldi', { certDays: 21 }, []],
    ['sertifikat muddati aniqlanmadi (-1)', { certDays: -1 }, []],
    ['sayt internetdan ochilmayapti (0)', { siteOk: 0 }, ['high:ops_site']],
    ['sayt internetdan ochilyapti (1)', { siteOk: 1 }, []],
  ];
  it.each(thresholds)('chegara — %s', async (_name, patch, expected) => {
    await heartbeat(patch);
    const found = await collectChecks(NOW);
    expect(brief(found)).toEqual(expected);
    for (const c of found) expect(c).toMatchObject({ count: 1, items: [], link: '/admin/audit' });
  });

  // Butun yo'l: skript so'rovi -> signal manzili -> SiteSetting -> readOps -> tekshiruv
  it('signal manzili orqali kelgan faktlar keyingi tekshiruvda ko\'rinadi; sog\'lom signal kelgach yo\'qoladi', async () => {
    clock(new Date(NOW.getTime() - 3 * MINUTE));
    expect((await post({ ...HEALTHY, disk: 95, restoreOk: 0 })).status).toBe(200);
    expect(brief(await collectChecks(NOW)).sort()).toEqual(['high:ops_disk', 'high:ops_restore']);
    expect((await post(HEALTHY)).status).toBe(200);
    expect(await collectChecks(NOW)).toEqual([]);
    // Rad etilgan signal (yaroqsiz faktlar) oxirgi ma'lum holatni buzmaydi
    expect((await post({ ...HEALTHY, disk: 'to\'la' })).status).toBe(400);
    expect(await collectChecks(NOW)).toEqual([]);
  });

  it('topilma nomida aniq raqam bor: disk foizi, zaxira yoshi, sertifikatga qolgan kun', async () => {
    await heartbeat({ disk: 93, backupAgeH: 51, certDays: 4 });
    const title = Object.fromEntries((await collectChecks(NOW)).map((c) => [c.key, c.title]));
    expect(title.ops_disk).toContain('93%');
    expect(title.ops_backup).toContain('51 soat');
    expect(title.ops_cert).toContain('4 kun');
    await heartbeat({ disk: 84 });
    expect((await collectChecks(NOW))[0].title).toContain('84%');
  });

  it('xabarlar navbati: kutayotganlarning o\'zi muammo emas; yetkazilmagan va bir soatdan beri turganlar — soni bilan', async () => {
    await heartbeat();
    h.outboxStats.mockResolvedValue({ pending: 7, stuck: 0, failed24h: 0 });
    expect(await collectChecks(NOW)).toEqual([]);

    h.outboxStats.mockResolvedValue({ pending: 0, stuck: 0, failed24h: 3 });
    expect(await collectChecks(NOW)).toEqual([expect.objectContaining({ key: 'outbox_failed', severity: 'medium', count: 3, items: [], link: '/admin/audit' })]);

    h.outboxStats.mockResolvedValue({ pending: 2, stuck: 2, failed24h: 0 });
    expect(await collectChecks(NOW)).toEqual([expect.objectContaining({ key: 'outbox_stuck', severity: 'medium', count: 2, items: [], link: '/admin/audit' })]);

    h.outboxStats.mockResolvedValue({ pending: 5, stuck: 4, failed24h: 1 });
    expect((await collectChecks(NOW)).map((c) => [c.key, c.count]).sort()).toEqual([['outbox_failed', 1], ['outbox_stuck', 4]]);
  });

  it('bir nechta muammo birga: muhimlari tepada; saqlangan hisobotdan o\'qilganda hech biri yo\'qolmaydi', async () => {
    h.prisma.lead.count.mockResolvedValue(3);
    h.prisma.review.count.mockResolvedValue(1);
    h.outboxStats.mockResolvedValue({ pending: 4, stuck: 2, failed24h: 1 });
    await heartbeat({ disk: 85, offsiteOk: 0, certDays: 3, siteOk: 0 });
    const found = await collectChecks(NOW);
    expect(brief(found).sort()).toEqual(['high:ops_cert', 'high:ops_site', 'low:old_reviews', 'medium:ops_disk', 'medium:ops_offsite', 'medium:outbox_failed', 'medium:outbox_stuck', 'medium:stale_leads']);
    const rank = { high: 0, medium: 1, low: 2 };
    const order = found.map((c) => rank[c.severity]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // Hisobot bazaga JSON bo'lib yoziladi va sahifada reportChecks orqali o'qiladi: havolalar admin panel ichida qolishi shart
    expect(reportChecks(JSON.parse(JSON.stringify(found)))).toEqual(found);
  });

  it('server holatini o\'qib bo\'lmasa (readOps xatosi) qolgan tekshiruvlar ishlayveradi', async () => {
    await heartbeat(BAD);
    h.prisma.lead.count.mockResolvedValue(3);
    h.outboxStats.mockResolvedValue({ pending: 1, stuck: 1, failed24h: 0 });
    h.readOps.mockRejectedValue(new Error('baza band'));
    await expect(collectChecks(NOW).then((c) => brief(c).sort())).resolves.toEqual(['medium:outbox_stuck', 'medium:stale_leads']);

    // Haqiqiy readOps, faqat SiteSetting o'qilmayapti
    h.readOps.mockImplementation(readOps);
    h.prisma.siteSetting.findUnique.mockRejectedValue(new Error('connect ECONNREFUSED'));
    await expect(collectChecks(NOW).then((c) => brief(c).sort())).resolves.toEqual(['medium:outbox_stuck', 'medium:stale_leads']);
  });

  it('navbat holatini o\'qib bo\'lmasa (outboxStats xatosi) qolgan tekshiruvlar ishlayveradi', async () => {
    await heartbeat({ siteOk: 0 });
    h.prisma.review.count.mockResolvedValue(2);
    h.outboxStats.mockRejectedValue(new Error('relation "BotOutbox" does not exist'));
    await expect(collectChecks(NOW).then(brief)).resolves.toEqual(['high:ops_site', 'low:old_reviews']);
  });

  it('ikkalasi ham o\'qilmasa ham tekshiruv yiqilmaydi', async () => {
    h.readOps.mockRejectedValue(new Error('baza band'));
    h.outboxStats.mockRejectedValue(new Error('baza band'));
    await expect(collectChecks(NOW)).resolves.toEqual([]);
  });

  // ── Xabar oladigan administrator yo'qligi (ops_no_admin). Server nosozligi xabarlari faqat alertChats ro'yxatiga boradi: u bo'sh
  //    bo'lsa watchdog.sh muammoni faqat server logiga yozadi. Haqiqiy alertChats so'rovi xotiradagi User qatorlariga qo'llanadi

  it('boshqaruv boti ulangan, lekin xabar oladigan administrator yo\'q: ogohlantiradi; menejer, faol bo\'lmagan yoki ulanmagan administrator buni o\'zgartirmaydi', async () => {
    vi.stubEnv('STAFF_BOT_TOKEN', '222:staff');
    user({ role: 'manager' });
    user({ role: 'staff' });
    user({ isActive: false });
    user({ deletedAt: new Date('2031-01-15T00:00:00Z') });
    user({ telegramId: null });
    user({ telegramId: '@pack24_admin' }); // yozuvi buzilgan: skript bunday ID ga xabar yubormaydi
    const found = await collectChecks(NOW);
    expect(found).toEqual([expect.objectContaining({ key: 'ops_no_admin', severity: 'medium', count: 1, items: [], link: '/admin/staff' })]);
    expect(found[0].title).toContain('hech bir administrator ulanmagan');
    expect(reportChecks(JSON.parse(JSON.stringify(found)))).toEqual(found);

    // Xabarnomani o'chirib qo'ygan administrator ham hisob: server nosozligi xabari unga baribir boradi
    user({ telegramNotify: false });
    expect(await collectChecks(NOW)).toEqual([]);
  });

  it('bot tokeni yo\'q bo\'lsa (bot hali sozlanmagan) yoki ro\'yxatni o\'qib bo\'lmasa "administrator ulanmagan" deyilmaydi', async () => {
    // Hech kim yo'q, token ham yo'q: ogohlantirish ortiqcha
    expect(await collectChecks(NOW)).toEqual([]);
    // Eski nomdagi kalit bilan ham bot "ulangan" hisoblanadi
    vi.stubEnv('SUPERVISOR_BOT_TOKEN', '333:legacy');
    expect(brief(await collectChecks(NOW))).toEqual(['medium:ops_no_admin']);
    // "Bilmayman" — "yo'q" degani emas
    h.prisma.user.findMany.mockRejectedValue(new Error('baza band'));
    expect(await collectChecks(NOW)).toEqual([]);
  });

  it('administrator ulanmagani kuzatuv signaliga bog\'liq emas: signal eskirgan bo\'lsa ham, umuman kelmagan bo\'lsa ham aytiladi', async () => {
    vi.stubEnv('STAFF_BOT_TOKEN', '222:staff');
    expect(brief(await collectChecks(NOW))).toEqual(['medium:ops_no_admin']);
    await heartbeat({}, 31 * MINUTE);
    expect(brief(await collectChecks(NOW)).sort()).toEqual(['medium:ops_no_admin', 'medium:ops_stale']);
    await heartbeat({ siteOk: 0 });
    expect(brief(await collectChecks(NOW))).toEqual(['high:ops_site', 'medium:ops_no_admin']);
  });

  // Chegaralar skript matnidan olinadi: Telegram'ga xabar ketgan har bir holat kunlik tekshiruvda (va «Batafsil» sahifasida) ham ko'rinishi kerak
  it('watchdog.sh Telegram\'da xabar beradigan chegaralarda (disk, zaxira yoshi, sertifikat) kunlik tekshiruv ham topilma beradi', async () => {
    const diskAlert = Number(inScript(/\[ "\$DISK" -ge (\d+) \] && DISK_STATE=0/, 'disk xabar chegarasi')[1]);
    const diskRecover = Number(inScript(/\[ "\$DISK" -lt (\d+) \] && DISK_STATE=1/, 'disk "tuzaldi" chegarasi')[1]);
    const backupFresh = Number(inScript(/\[ "\$BACKUP_AGE_H" -lt (\d+) \] && echo 1 \|\| echo 0/, 'zaxira yoshi chegarasi')[1]);
    const certFine = Number(inScript(/\[ "\$CERT_DAYS" -ge (\d+) \] && echo 1 \|\| echo 0/, 'sertifikat chegarasi')[1]);
    // "Tuzaldi" xabari xabar chegarasidan pastroqda: disk chegarada (89/90) tebransa har safar xabar ketmaydi
    expect(diskRecover).toBeLessThan(diskAlert);
    const at = async (patch: Partial<OpsFacts>) => {
      await heartbeat(patch);
      return brief(await collectChecks(NOW));
    };

    expect(await at({ disk: diskAlert })).toEqual(['high:ops_disk']);
    expect(await at({ disk: diskAlert - 1 })).not.toContain('high:ops_disk');
    expect(await at({ backupAgeH: backupFresh })).toEqual(['high:ops_backup']);
    expect(await at({ backupAgeH: backupFresh - 1 })).toEqual([]);
    // Skript xabar beradigan har bir kun (0 … chegaradan bitta kam) tekshiruvda ham bor; tekshiruv undan oldinroq ham eslatadi
    for (let certDays = 0; certDays < certFine; certDays += 1) expect((await at({ certDays })).map((c) => c.split(':')[1]), `${certDays} kun`).toEqual(['ops_cert']);
    // Bayroqlar: skript 0 da xabar beradi (report <kalit> "$..._OK")
    for (const [flag, key] of [['restoreOk', 'ops_restore'], ['offsiteOk', 'ops_offsite'], ['siteOk', 'ops_site']] as const) {
      expect((await at({ [flag]: 0 })).map((c) => c.split(':')[1]), flag).toEqual([key]);
    }
  });
});
