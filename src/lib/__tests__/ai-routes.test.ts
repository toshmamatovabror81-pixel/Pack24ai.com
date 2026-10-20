import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Section } from '@/lib/auth/permissions';
import type { Role } from '@/lib/auth/session';

/**
 * AI bo'limining tashqi "eshiklari":
 *  - /api/ai/status — ochiq manzil: faqat Bearer TELEGRAM_OPS_SECRET bilan ishlaydi va API kalitini hech qachon qaytarmaydi;
 *  - deploy/ai-setup.sh — shu manzilni chaqiradigan sozlash skripti (kalit va ops kaliti buyruq satriga chiqmaydi);
 *  - admin paneldagi «Hozir tekshirish» amali — faqat "reports" ruxsati bilan, daqiqasiga bir marta va bir vaqtda bitta (har biri AI so'rovi, pul);
 *  - «AI tekshiruv» sahifasidagi ?id va yon menyudagi havola.
 * Anthropic'ga so'rov ketmaydi: testAi va runAudit soxta, tarmoq (fetch) yopiq. Sozlamalar (kalit bor-yo'qligi, model,
 * chegaralar) esa haqiqiy lib/ai/client orqali process.env dan o'qiladi.
 */
// Vitest .tsx fayllarni klassik JSX (React.createElement) bilan o'giradi — sahifa moduli global React'ni kutadi (pages.test.ts dagidek)
(globalThis as { React?: unknown }).React = React;

const h = vi.hoisted(() => ({
  testAi: vi.fn(),
  aiRequestsToday: vi.fn(),
  runAudit: vi.fn(),
  fetch: vi.fn(),
  /** Kirgan xodimning roli; null — sessiya yo'q */
  role: 'admin' as 'user' | 'staff' | 'manager' | 'admin' | null,
  /** Bazadagi hisobotlar (AuditReport) */
  reports: [] as { id: number; createdAt: Date }[],
  /** Amal ichidagi qadamlar tartibi */
  steps: [] as string[],
  /** Sahifa bazadan id bo'yicha so'ragan hisobotlar (auditReport.findUnique) */
  lookups: [] as unknown[],
}));

/** next/navigation redirect() xato tashlab chiqadi — testda manzilini shu xatodan olamiz */
class Redirect extends Error {
  constructor(public url: string) { super(`REDIRECT ${url}`); }
}

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Redirect(url); } }));
// Haqiqiy requireStaff kabi: sessiya bo'lmasa login'ga, bo'lim ruxsati bo'lmasa /admin?denied=1 ga. Ruxsat jadvali (can) haqiqiy
vi.mock('@/lib/auth', async () => {
  const { can } = await import('@/lib/auth/permissions');
  return {
    requireStaff: async (section?: Section) => {
      h.steps.push(`requireStaff:${section ?? ''}`);
      const role: Role | null = h.role;
      if (!role || role === 'user') throw new Redirect('/admin/login');
      if (section && !can(role, section)) throw new Redirect('/admin?denied=1');
      return { id: 1, name: 'Admin Ali', role };
    },
  };
});
// Sahifa hisobot JSON'ini o'qiydigan yordamchilarni ham shu moduldan oladi (testlarda hisobot yo'q — chaqirilmaydi)
vi.mock('@/lib/ai/audit', () => ({ runAudit: h.runAudit, reportChecks: () => [], reportSummary: () => null }));
vi.mock('@/lib/db', () => ({
  prisma: {
    auditReport: {
      // Baza kabi tartiblaydi: "oxirgi hisobot" noto'g'ri tartibda so'ralsa test sezadi
      findFirst: async ({ orderBy }: { orderBy?: Partial<Record<'id' | 'createdAt', 'asc' | 'desc'>> } = {}) => {
        h.steps.push('auditReport.findFirst');
        const [field, dir] = (Object.entries(orderBy ?? {})[0] ?? ['id', 'asc']) as ['id' | 'createdAt', 'asc' | 'desc'];
        return [...h.reports].sort((a, b) => (Number(a[field]) - Number(b[field])) * (dir === 'desc' ? -1 : 1))[0] ?? null;
      },
      findUnique: async ({ where }: { where: { id: unknown } }) => {
        h.lookups.push(where.id);
        return null;
      },
      findMany: async () => [],
    },
    aiUsage: {
      findUnique: async () => null,
      aggregate: async () => ({ _sum: { requests: null, inputTokens: null, outputTokens: null } }),
    },
  },
}));
// Pul sarflaydigan sinov so'rovi va bazadan o'qiladigan bugungi sarf soxta; qolgani (aiConfigured, aiModel, chegaralar) haqiqiy
vi.mock('@/lib/ai/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/client')>()),
  testAi: h.testAi,
  aiRequestsToday: h.aiRequestsToday,
}));

const { GET, POST } = await import('@/app/api/ai/status/route');
const { runAuditNow } = await import('@/app/admin/(panel)/audit/actions');
const { default: AuditPage } = await import('@/app/admin/(panel)/audit/page');
const { adminNav } = await import('@/components/admin/nav');
const { can } = await import('@/lib/auth/permissions');
const { AI_DEFAULT_MODEL } = await import('@/lib/ai/client');

// Soxta kalitlar CI'dagi sir skaneri (gitleaks) ruxsat bergan ko'rinishda: ci-dummy-<nom>-secret
const SECRET = 'ci-dummy-ops-secret';
/** Soxta kalit (haqiqiy kalit ko'rinishida): javoblarda uning hech bir bo'lagi chiqmasligi kerak */
const KEY = 'sk-ant-ci-dummy-anthropic-secret';
/** Sinov natijalari haqiqiy testAi qaytaradigan shaklda (maydon nomi o'zgarsa shu yerda tur xatosi chiqadi) */
type TestResult = Awaited<ReturnType<typeof import('@/lib/ai/client')['testAi']>>;
const PASSED = { ok: true, model: 'claude-opus-5-5' } satisfies TestResult;
const FAILED = { ok: false, error: 'kalit yaroqsiz (401): console.anthropic.com > API Keys da yangi kalit yarating' } satisfies TestResult;
const AUTH = { authorization: `Bearer ${SECRET}` };
const URL_STATUS = 'https://pack24.uz/api/ai/status';
const get = (headers: Record<string, string> = {}) => GET(new Request(URL_STATUS, { headers }));
const post = (headers: Record<string, string> = {}) => POST(new Request(URL_STATUS, { method: 'POST', headers }));
/** Javob matni va sarlavhalari: kalit qidiriladigan hamma joy */
const dump = async (res: Response) => `${await res.clone().text()}\n${JSON.stringify([...res.headers])}`;

beforeEach(() => {
  vi.stubEnv('TELEGRAM_OPS_SECRET', SECRET);
  vi.stubEnv('ANTHROPIC_API_KEY', KEY);
  vi.stubEnv('ANTHROPIC_MODEL', undefined);
  vi.stubEnv('AI_DAILY_LIMIT', undefined);
  vi.stubEnv('AI_CUSTOMER_DAILY_LIMIT', undefined);
  // Hech bir test tarmoqqa chiqmaydi (kalit soxta bo'lsa ham)
  vi.stubGlobal('fetch', h.fetch.mockReset().mockRejectedValue(new Error('testda tarmoq yopiq')));
  h.testAi.mockReset().mockResolvedValue(PASSED);
  h.aiRequestsToday.mockReset().mockResolvedValue(0);
  h.runAudit.mockReset().mockImplementation(async (trigger: string) => { h.steps.push(`runAudit:${trigger}`); return { id: 77 }; });
  h.role = 'admin';
  h.reports = [];
  h.steps = [];
  h.lookups = [];
});
afterEach(() => {
  expect(h.fetch).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('AI holati manzili (/api/ai/status)', () => {
  it('kalitsiz yoki xato kalit bilan GET ham, POST ham 401: sozlamalar ochilmaydi, sinov so\'rovi yuborilmaydi', async () => {
    const bad: Record<string, string>[] = [
      {},
      { authorization: 'Bearer ci-dummy-wrong-secret' },
      { authorization: SECRET }, // "Bearer " siz
      { authorization: `Basic ${SECRET}` },
      { authorization: `Bearer ${SECRET}x` },
      // Uzunligi bir xil, bitta belgisi (yoki faqat harf kattaligi) boshqa
      { authorization: `Bearer ${SECRET.slice(0, -1)}X` },
      { authorization: `Bearer ${SECRET.toUpperCase()}` },
      { authorization: 'Bearer undefined' }, // konteynerda kalit yo'q bo'lsa skript aynan shuni yuboradi
      { authorization: `Bearer ${KEY}` }, // AI kaliti ops kaliti o'rnini bosmaydi
      { 'x-telegram-bot-api-secret-token': SECRET },
    ];
    for (const headers of bad) {
      for (const call of [get, post]) {
        const res = await call(headers);
        expect(res.status, JSON.stringify(headers)).toBe(401);
        // Faqat { ok: false }: AI ulangan-ulanmagani, model va chegaralar begonaga aytilmaydi
        expect(await res.json(), JSON.stringify(headers)).toEqual({ ok: false });
      }
    }
    expect(h.testAi).not.toHaveBeenCalled();
    expect(h.aiRequestsToday).not.toHaveBeenCalled();
  });

  it('serverda TELEGRAM_OPS_SECRET sozlanmagan yoki 16 belgidan qisqa bo\'lsa hech kim kira olmaydi', async () => {
    vi.stubEnv('TELEGRAM_OPS_SECRET', '');
    expect((await get({ authorization: 'Bearer ' })).status).toBe(401);
    expect((await post({ authorization: 'Bearer ' })).status).toBe(401);
    expect((await post({ authorization: 'Bearer undefined' })).status).toBe(401);
    vi.stubEnv('TELEGRAM_OPS_SECRET', 'qisqa-kalit');
    expect((await get({ authorization: 'Bearer qisqa-kalit' })).status).toBe(401);
    expect((await post({ authorization: 'Bearer qisqa-kalit' })).status).toBe(401);
    expect(h.testAi).not.toHaveBeenCalled();
    expect(h.aiRequestsToday).not.toHaveBeenCalled();
  });

  it("to'g'ri kalit bilan GET: ulanganlik, model, bugungi sarf va chegaralar — API kaliti javobda yo'q", async () => {
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-haiku-5-5');
    vi.stubEnv('AI_DAILY_LIMIT', '120');
    vi.stubEnv('AI_CUSTOMER_DAILY_LIMIT', '7');
    h.aiRequestsToday.mockResolvedValue(42);
    const res = await get(AUTH);
    expect(res.status).toBe(200);
    const seen = await dump(res);
    // Aynan shu maydonlar: ortiqcha (masalan kalit yoki uning niqoblangan ko'rinishi) qo'shilsa test sezadi
    expect(await res.json()).toEqual({ ok: true, configured: true, model: 'claude-haiku-5-5', today: 42, dailyLimit: 120, customerDailyLimit: 7 });
    expect(seen).not.toContain(KEY);
    expect(seen).not.toMatch(/sk-ant/i);
    expect(seen).not.toContain(KEY.slice(-8));
    expect(seen).not.toContain(SECRET);
    // Holatni ko'rish pul sarflamaydi: haqiqiy sinov so'rovi faqat POST'da
    expect(h.testAi).not.toHaveBeenCalled();
  });

  it("kalit kiritilmagan (bo'sh yoki faqat bo'shliq): configured=false; model va chegaralar standart qiymatda", async () => {
    for (const key of ['', '   ']) {
      vi.stubEnv('ANTHROPIC_API_KEY', key);
      const res = await get(AUTH);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, configured: false, model: AI_DEFAULT_MODEL, today: 0, dailyLimit: 300, customerDailyLimit: 20 });
    }
    expect(AI_DEFAULT_MODEL).toMatch(/^claude-/);
  });

  // Number('') === 0: bo'sh satr "0" deb o'qilsa, AI_DAILY_LIMIT="" satri AI'ni butunlay o'chirib qo'yardi
  it(".env da chegaralar bo'sh qoldirilgan (AI_DAILY_LIMIT=\"\" yoki faqat bo'shliq): standart 300 va 20 ko'rinadi, 0 emas; aniq yozilgan 0 esa 0", async () => {
    const limits = async (daily: string, customer: string) => {
      vi.stubEnv('AI_DAILY_LIMIT', daily);
      vi.stubEnv('AI_CUSTOMER_DAILY_LIMIT', customer);
      const { dailyLimit, customerDailyLimit } = await (await get(AUTH)).json();
      return [dailyLimit, customerDailyLimit];
    };
    for (const blank of ['', '   ', '\t']) expect(await limits(blank, blank), JSON.stringify(blank)).toEqual([300, 20]);
    // Bittasi bo'sh, ikkinchisi yozilgan: har biri alohida o'qiladi
    expect(await limits('', '7')).toEqual([300, 7]);
    expect(await limits(' 120 ', ' ')).toEqual([120, 20]);
    // Egasi ataylab yozgan 0 — "bugun AI so'rovi yo'q" degani, standartga almashmaydi
    expect(await limits('0', '0')).toEqual([0, 0]);
    // .env.example endi bu satrlarni bo'sh qiymat bilan bermaydi: izoh ichidagi namuna qiymatlar esa ilovadagi standartlarning o'zi
    const example = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');
    expect(example).not.toMatch(/^AI_(?:CUSTOMER_)?DAILY_LIMIT=/m);
    expect(example).toMatch(/^# AI_DAILY_LIMIT="300"$/m);
    expect(example).toMatch(/^# AI_CUSTOMER_DAILY_LIMIT="20"$/m);
  });

  it("bugungi sarfni o'qib bo'lmasa (baza xatosi) ham holat qaytadi: today=null, xato matni tashqariga chiqmaydi", async () => {
    h.aiRequestsToday.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const res = await get(AUTH);
    expect(res.status).toBe(200);
    expect(await dump(res)).not.toContain('ECONNREFUSED');
    expect(await res.json()).toMatchObject({ ok: true, configured: true, today: null });
  });

  it("to'g'ri kalit bilan POST: sinov o'tsa 200 va model; o'tmasa 502 va sababi — ikkalasida ham kalit yo'q", async () => {
    const ok = await post(AUTH);
    expect(ok.status).toBe(200);
    expect(await dump(ok)).not.toMatch(/sk-ant/i);
    expect(await ok.json()).toEqual(PASSED);
    expect(h.testAi).toHaveBeenCalledTimes(1);

    h.testAi.mockResolvedValue(FAILED);
    const failed = await post(AUTH);
    expect(failed.status).toBe(502);
    expect(await dump(failed)).not.toMatch(/sk-ant/i);
    expect(await failed.json()).toEqual(FAILED);
    expect(h.testAi).toHaveBeenCalledTimes(2);
  });

});

describe('deploy/ai-setup.sh: sozlash skripti', () => {
  const script = readFileSync(new URL('../../../deploy/ai-setup.sh', import.meta.url), 'utf8');
  const lines = script.split('\n');
  /** Konteyner ichida ishlaydigan sinov so'rovi: bash'da bitta tirnoq ichidagi `node -e '…'` bloki */
  const probe = /docker compose exec -T web node -e '\n([\s\S]*?)\n'; then\n/.exec(script)?.[1] ?? '';
  /** Matn skriptda bor va `after` dan keyin keladi; o'rnini qaytaradi (tartibni tekshirish uchun) */
  const pos = (needle: string, after = 0) => {
    const i = script.indexOf(needle, after);
    expect(i, needle).toBeGreaterThanOrEqual(0);
    return i;
  };

  it("sinov so'rovi /api/ai/status ga Bearer bilan POST qilinadi va javobdan route beradigan maydonlar (ok, model, error) o'qiladi; 404 va 401 ning o'z tushuntirishi bor", () => {
    expect(probe.length).toBeGreaterThan(300);
    expect(probe).toMatch(/fetch\("http:\/\/127\.0\.0\.1:3000\/api\/ai\/status",\s*\{\s*method:\s*"POST"/);
    // Ops kaliti konteynerning o'z muhitidan o'qiladi va faqat sarlavhada ketadi
    expect(probe).toMatch(/const secret = process\.env\.TELEGRAM_OPS_SECRET\b/);
    expect(probe).toMatch(/authorization:\s*"Bearer "\s*\+\s*secret\b/);
    // Skript "ishlayapti, model: …" va "XATO: …" satrlarini aynan shu nomdagi maydonlardan yig'adi
    for (const field of new Set([...Object.keys(PASSED), ...Object.keys(FAILED)])) expect(probe, field).toContain(`j.${field}`);
    const said = (status: number) => new RegExp(`r\\.status === ${status}\\) console\\.log\\("([^"]+)"\\)`).exec(probe)?.[1] ?? '';
    expect(said(404)).toMatch(/yangi versiyaga yangilanmagan/);
    expect(said(401)).toMatch(/TELEGRAM_OPS_SECRET qabul qilinmadi/);
    expect(said(404)).not.toBe(said(401));
  });

  // Blok bash'da '…' ichida: ichidagi birinchi apostrof satrni yopib qo'yadi va qolgan matn bash buyrug'i bo'lib bajariladi
  it("node -e bloki ichida apostrof yo'q (o'zbekcha matnlardagi o' / g' ham): bash uni bitta butun argument sifatida uzatadi", () => {
    expect(probe).toContain('process.exit(1)');
    expect(probe).not.toContain("'");
    // Blok skriptdagi yagona ko'p satrli node -e: undan oldingi satr uni ochadi, keyingisi yopadi
    expect(script.match(/node -e '\n/g)).toHaveLength(1);
    expect(script).toContain(`node -e '\n${probe}\n'; then\n`);
  });

  it("ops kaliti ham, API kaliti ham buyruq satriga chiqmaydi (`ps` da ko'rinmaydi) va ekranga yozilmaydi", () => {
    // Avvalgi usul: OPS="$(current TELEGRAM_OPS_SECRET)" va `docker compose exec -e OPS="$OPS"` — qiymat jarayonlar ro'yxatida ko'rinardi
    expect(script).not.toContain('-e OPS');
    expect(script).not.toMatch(/current TELEGRAM_OPS_SECRET/);
    const docker = lines.filter((l) => /\bdocker\b/.test(l) && !l.trimStart().startsWith('#'));
    expect(docker.length).toBeGreaterThanOrEqual(4);
    for (const line of docker) {
      expect(line, line).not.toMatch(/\s(?:-e|--env)[ =]+"?[A-Za-z_]+=/);
      expect(line, line).not.toMatch(/\$\{?(?:OLD_)?KEY\b|\$\{?OPS\b|\$val\b/);
    }
    // API kaliti yashirin o'qiladi va faqat bash'ning ichki buyruqlariga (shart, printf, o'z funksiyasi) beriladi
    expect(script).toContain('read -rs KEY');
    const withKey = lines.filter((l) => /\$\{?(?:OLD_)?KEY\b|\$val\b/.test(l));
    expect(withKey.length).toBeGreaterThanOrEqual(8);
    for (const line of withKey) expect(line.trim().replace(/^(?:if|elif) (?:! )?/, ''), line).toMatch(/^(?:\[\[? |set_var ANTHROPIC_API_KEY |printf '%s="%s"\\n' |KEY=)/);
    for (const line of lines.filter((l) => /^\s*echo\b/.test(l))) expect(line, line).not.toMatch(/\$\{?(?:OLD_)?KEY\b/);
  });

  it("yangi kalit sinovdan o'tmasa avvalgi kalit .env ga qaytariladi va sayt qayta ishga tushiriladi; o'zgarmagan kalitga tegilmaydi", () => {
    // Eski kalit yangisi so'ralishidan OLDIN eslab qolinadi
    const remembered = pos('OLD_KEY="$(current ANTHROPIC_API_KEY)"');
    const asked = pos('read -rs KEY', remembered);
    // Kalit faqat haqiqatan o'zgargan bo'lsa yoziladi va "o'zgardi" deb belgilanadi (yozishdan oldin "hali sinalmagan" bayrog'i ko'tariladi)
    const saved = pos('  if [ "$KEY" != "$OLD_KEY" ]; then\n    UNTESTED=1\n    set_var ANTHROPIC_API_KEY "$KEY"\n    KEY_CHANGED=1\n  fi', asked);
    const tested = pos("node -e '\n", saved);
    // Sinov o'tsa skript shu yerda muvaffaqiyat bilan tugaydi — tiklash qismiga yetib bormaydi
    const passed = pos('\n  exit 0\nfi\n', tested);
    const restored = pos('if [ -n "$KEY_CHANGED" ]; then\n  set_var ANTHROPIC_API_KEY "$OLD_KEY"\n', passed);
    const restarted = pos('restart_web || exit 1', restored);
    expect(script.slice(restored, restarted)).not.toMatch(/\bexit\b/);
    // Kalit o'zgarmagan bo'lsa (faqat model yoki chegara) tiklanadigan narsa yo'q; har ikki holatda ham skript xato kodi bilan tugaydi
    expect(script.slice(restarted)).toMatch(/\nelse\n  echo "[^"\n]*kalit o'zgartirilmadi[^"\n]*"\nfi\nexit 1\n$/);
    // "-" bilan o'chirish ham o'zgarish hisoblanadi (lekin sinovgacha bormaydi: kalit bo'sh bo'lsa skript oldinroq tugaydi)
    pos('  set_var ANTHROPIC_API_KEY ""\n  KEY_CHANGED=1', asked);
    expect(script.match(/KEY_CHANGED=1/g)).toHaveLength(2);
  });

  // Kalit .env ga sinovdan OLDIN yoziladi (sayt uni o'qib qayta ishga tushishi kerak). Skript sinovgacha yetmay tugasa — deploy qulfi
  // bo'shamadi, docker xato berdi, Ctrl-C yoki SSH uzildi — sinalmagan kalit .env da qolib, keyingi deployda jimgina kuchga kirardi.
  // Shu yerda skript matnining tuzilishi tekshiriladi; xatti-harakatning o'zi — pastdagi "skript haqiqiy bajarilganda" bo'limida
  it("sayt qayta ishga tushmasa yoki deploy qulfi olinmasa ham sinalmagan yangi kalit .env da qolmaydi: avvalgi kalit qaytariladi", () => {
    // Tiklash funksiyasi: bayroq tushirilgan bo'lsa hech narsaga tegmaydi; ko'tarilgan bo'lsa uni tushirib (ikki marta ishlamasin) avvalgi kalitni yozadi
    const restore = /\nrestore_untested\(\) \{\n([\s\S]*?)\n\}\n/.exec(script)?.[1] ?? '';
    expect(restore.split('\n').map((l) => l.trim()).slice(0, 4)).toEqual(['[ -n "$UNTESTED" ] || return 0', 'UNTESTED=""', 'set_var ANTHROPIC_API_KEY "$OLD_KEY"', 'chmod 600 .env']);
    // O'zi exit chaqirmaydi (skriptning chiqish kodi o'zgarmasin) va egasiga nima bo'lganini aytadi
    expect(restore).not.toMatch(/\bexit\b/);
    expect(restore).toMatch(/\n\s+echo "[^"\n]*avvalgi holat tiklandi[^"\n]*"[^\n]*\n/);
    // Sayt sinalmagan kalit bilan qayta ishga tushib ulgurgan bo'lsa (RESTARTED), avvalgi sozlama bilan qaytariladi — xatosi chiqishni to'xtatmaydi
    expect(restore.trimEnd().split('\n').pop()?.trim()).toBe('if [ -n "$RESTARTED" ]; then docker compose up -d --force-recreate web >/dev/null 2>&1 || true; fi');
    expect(script).toMatch(/\nRESTARTED=1\nrestart_web \|\| exit 1\n/);
    // U skriptning har qanday tugashiga (exit, xato, Ctrl-C, SSH uzilishi) ulangan — skriptdagi yagona tuzoq
    expect(lines.filter((l) => /^\s*trap\b/.test(l))).toEqual(['trap restore_untested EXIT']);
    // Tartib: eski kalit eslab qolinadi -> tuzoq o'rnatiladi -> yangi kalit so'raladi
    const remembered = pos('OLD_KEY="$(current ANTHROPIC_API_KEY)"');
    const trapped = pos('\ntrap restore_untested EXIT\n', pos('\nrestore_untested() {\n', remembered));
    const asked = pos('read -rs KEY', trapped);

    // Bayroq o'zgaradigan hamma joy, skriptdagi tartibda: boshlang'ich qiymat, tiklash funksiyasi, yangi kalit, sinov o'tdi, skriptning o'zi tikladi
    expect(lines.filter((l) => /^\s*UNTESTED=/.test(l)).map((l) => l.replace(/\s+#.*$/, '').trim())).toEqual(['UNTESTED=""', 'UNTESTED=""', 'UNTESTED=1', 'UNTESTED=""', 'UNTESTED=""']);
    // Faqat yangi kalit yozilishidan bevosita OLDIN ko'tariladi (yozish yarmida uzilsa ham tuzoq tiklaydi)...
    const raised = pos('    UNTESTED=1\n    set_var ANTHROPIC_API_KEY "$KEY"\n', asked);
    // ...AI'ni "-" bilan o'chirishda emas: u yerdagi bo'sh kalit — egasining tanlovi, sinovsiz ham kuchda qoladi
    const disable = script.slice(pos('if [ "$KEY" = "-" ]; then\n', asked), pos('\nelif [ -n "$KEY" ]; then\n', asked));
    expect(disable).toContain('set_var ANTHROPIC_API_KEY ""');
    expect(disable).not.toContain('UNTESTED');

    // Sinovgacha bo'lgan yo'lda bayroq tushirilmaydi: shu oraliqdagi chiqishlarda (qulf kutish muddati tugadi, sayt qayta ishga tushmadi) tuzoq tiklaydi
    const tested = pos("node -e '\n", raised);
    const untested = script.slice(raised + '    UNTESTED=1\n'.length, tested);
    expect(untested).not.toContain('UNTESTED');
    expect(untested).toMatch(/\n {2}flock -w 600 9 \|\| \{ echo "[^"\n]+"; exit 1; \}\n/);
    expect(untested).toMatch(/\nrestart_web \|\| exit 1\n/);
    const restartBody = /\nrestart_web\(\) \{\n([\s\S]*?)\n\}\n/.exec(script)?.[1] ?? '';
    expect(restartBody).toContain('return 1');
    expect(restartBody).not.toContain('UNTESTED');
    // Shu ikki yo'lning xabarlari endi "sozlamalar saqlandi / yozilgan" demaydi — kalit qaytarilgan, buni tuzoqning o'z xabari aytadi
    expect(lines.find((l) => l.includes('flock -w 600 9'))).not.toMatch(/saqlan|yozilgan/i);
    expect(restartBody).not.toMatch(/saqlan|yozilgan/i);

    // Bayroq faqat ikki joyda tushiriladi: sinov o'tgach, muvaffaqiyatli chiqishdan oldin (yangi kalit qoladi)...
    const passed = pos('\n  UNTESTED=""\n  exit 0\nfi\n', tested);
    expect(script.slice(tested, passed)).not.toMatch(/^\s*exit\b/m);
    // ...va sinov o'tmaganda skript avvalgi kalitni o'zi qaytargach (tuzoq uni ikkinchi marta yozmaydi)
    pos('if [ -n "$KEY_CHANGED" ]; then\n  set_var ANTHROPIC_API_KEY "$OLD_KEY"\n  UNTESTED=""\n', passed);
  });

  it("ikki marta qo'yilgan kalit (sk-ant-…sk-ant-…) saqlanmasdan rad etiladi", () => {
    const glob = /\[\[ "\$KEY" == (\S+) \]\]/.exec(script)?.[1] ?? '';
    const format = /\[\[ "\$KEY" =~ (\S+) \]\]/.exec(script)?.[1] ?? '';
    expect(glob).toBeTruthy();
    expect(format).toMatch(/^\^.+\$$/);
    // bash'dagi qolip (* — istalgan matn) va ERE shu ko'rinishda JS'da ham bir xil ishlaydi
    expect(glob).toMatch(/^[\w*-]+$/);
    const doubled = new RegExp(`^${glob.split('*').join('.*')}$`);
    const wellFormed = new RegExp(format);
    expect(wellFormed.test(KEY)).toBe(true);
    expect(doubled.test(KEY)).toBe(false);
    // Ko'rinish tekshiruvining o'zi ikki marta qo'yilgan kalitni o'tkazib yuboradi — shuning uchun alohida tekshiruv kerak
    for (const pasted of [`${KEY}${KEY}`, `${KEY}sk-ant-`]) {
      expect(wellFormed.test(pasted), pasted).toBe(true);
      expect(doubled.test(pasted), pasted).toBe(true);
    }
    expect(wellFormed.test('sk-ant-qisqa')).toBe(false);
    expect(wellFormed.test(`${KEY} ; rm -rf /`)).toBe(false);
    // Rad etish .env ga yozishdan oldin va skriptni to'xtatadi
    const rejected = pos(`if [[ "$KEY" == ${glob} ]]; then`);
    const saved = pos('set_var ANTHROPIC_API_KEY "$KEY"');
    expect(rejected).toBeLessThan(saved);
    expect(script.slice(rejected, saved)).toMatch(/^[^\n]+\n\s+unset KEY\n\s+echo "[^"\n]*ikki marta[^"\n]*"\n\s+exit 1\n\s+fi\n/);
  });

  it("kunlik chegara kamida 1 bo'lishi shart: 0 (AI'ni jimgina o'chirib qo'yadigan qiymat), manfiy, kasr yoki son bo'lmagan kiritma saqlanmaydi", () => {
    const pattern = /\[\[ "\$NEW_LIMIT" =~ (\S+) \]\]/.exec(script)?.[1] ?? '';
    expect(pattern).toMatch(/^\^.+\$$/);
    const valid = new RegExp(pattern);
    for (const ok of ['1', '9', '10', '300', '999999']) expect(valid.test(ok), ok).toBe(true);
    for (const bad of ['0', '00', '007', '-5', '1.5', '1e3', '1000000', 'ko\'p', '300; reboot', '']) expect(valid.test(bad), bad).toBe(false);
    // Faqat shu tekshiruvdan o'tgan qiymat yoziladi
    pos(`if [[ "$NEW_LIMIT" =~ ${pattern} ]]; then\n      set_var AI_DAILY_LIMIT "$NEW_LIMIT"`);
    expect(script.match(/set_var AI_DAILY_LIMIT/g)).toHaveLength(1);
  });

  it("saytni qayta ishga tushirishdan oldin avtomatik yangilanish (deploy) bilan bir xil qulf olinadi; band bo'lsa 10 daqiqagacha kutadi", () => {
    const deployLock = /^LOCK=(\S+)$/m.exec(readFileSync(new URL('../../../deploy/auto-update.sh', import.meta.url), 'utf8'))?.[1] ?? '';
    expect(deployLock).toBe('/var/lock/pack24-deploy.lock');
    const opened = pos(`exec 9>${deployLock}\n`);
    const tried = pos('if ! flock -n 9; then', opened);
    const waited = pos('flock -w 600 9 || {', tried);
    // Kutib ham ololmasa: saytga tegmasdan to'xtaydi
    expect(script.slice(waited).split('\n')[0]).toMatch(/exit 1; \}$/);
    // Qulf birinchi qayta ishga tushirishdan (funksiya ta'rifidan emas, chaqiruvidan) oldin olinadi
    const firstRestart = lines.findIndex((l) => l === 'restart_web || exit 1');
    expect(firstRestart).toBeGreaterThan(script.slice(0, waited).split('\n').length - 1);
    expect(lines.filter((l) => /^\s*restart_web\b/.test(l) && !l.includes('()'))).toEqual(['restart_web || exit 1', '  restart_web || exit 1']);
  });

  it("sayt qayta ishga tushmasa: docker holati va oxirgi loglar ko'rsatiladi, skript xato bilan to'xtaydi", () => {
    const body = /\nrestart_web\(\) \{\n([\s\S]*?)\n\}\n/.exec(script)?.[1] ?? '';
    expect(body).toContain('docker compose up -d --force-recreate web');
    expect(body).toContain('/api/health');
    // Ikki xil nosozlik: konteyner umuman ko'tarilmadi (holati) va ko'tarildi, lekin javob bermayapti (loglari)
    expect(body).toMatch(/if ! docker compose up[^\n]+\n(?:\s+echo [^\n]+\n)+\s+docker compose ps web \|\| true\n\s+return 1\n/);
    expect(body).toMatch(/\n\s+echo "XATO: sayt javob bermadi[^\n]*\n\s+docker compose logs --tail=\d+ web \|\| true\n\s+return 1$/);
    // Funksiya skriptni o'zi to'xtatmaydi (return): to'xtatishni chaqiruvchi hal qiladi
    expect(body).not.toMatch(/\bexit\b(?! *\()/);
  });

  it("egasiga «hozirgisi» deb ko'rsatiladigan model va chegara — ilovaning haqiqiy standartlari", async () => {
    vi.stubEnv('ANTHROPIC_MODEL', '');
    vi.stubEnv('AI_DAILY_LIMIT', '');
    const shown = await (await get(AUTH)).json();
    expect(shown).toMatchObject({ model: AI_DEFAULT_MODEL, dailyLimit: 300 });
    expect(script).toContain(`\${MODEL:-${shown.model}}`);
    expect(script).toContain(`\${LIMIT:-${shown.dailyLimit}}`);
    // Tanlov ro'yxatidagi birinchi model ham shu standart
    expect(script).toContain(`1) set_var ANTHROPIC_MODEL "${AI_DEFAULT_MODEL}"`);
  });

  describe("sinov so'rovi haqiqiy bajarilganda (node -e bloki alohida jarayonda, sayt o'rnida — shu route'ga ulangan mahalliy server)", () => {
    type Seen = { method?: string; url?: string; authorization?: string };
    /** Soxta "sayt": faqat POST /api/ai/status ni haqiqiy route'ga uzatadi; `gone` — route hali yo'q eski versiya (Next 404 sahifasi) */
    const site = async (gone = false) => {
      const seen: Seen[] = [];
      const server = createServer((req, res) => {
        seen.push({ method: req.method, url: req.url, authorization: req.headers.authorization });
        if (gone || req.method !== 'POST' || req.url !== '/api/ai/status') {
          res.writeHead(404, { 'content-type': 'text/html' }).end('<!DOCTYPE html><html><body>404: This page could not be found.</body></html>');
          return;
        }
        void POST(new Request(URL_STATUS, { method: 'POST', headers: { authorization: req.headers.authorization ?? '' } })).then(async (out) => {
          res.writeHead(out.status, { 'content-type': 'application/json' }).end(await out.text());
        });
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      return { seen, port: (server.address() as AddressInfo).port, close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }) };
    };
    /** Blokni skriptdagidek `node -e` bilan bajaradi (faqat port almashtiriladi); ops kaliti — konteyner muhitidagi qiymat. `out` — ekranga (stdout) chiqqani */
    const runProbe = (port: number, secret: string | undefined) => new Promise<{ code: number | string; out: string }>((resolve) => {
      const env: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: '' };
      delete env.TELEGRAM_OPS_SECRET;
      if (secret !== undefined) env.TELEGRAM_OPS_SECRET = secret;
      const code = probe.replace('127.0.0.1:3000', `127.0.0.1:${port}`);
      execFile(process.execPath, ['-e', code], { env, timeout: 20_000 }, (err, stdout) => resolve({ code: err ? (err.code ?? 'signal') : 0, out: stdout }));
    });

    it("to'g'ri kalit: bitta POST, Bearer sarlavhasi bilan; sinov o'tsa 0 kodi va model nomi, o'tmasa 1 kodi va route bergan sabab", async () => {
      expect(probe).toContain('127.0.0.1:3000');
      const web = await site();
      try {
        const ok = await runProbe(web.port, SECRET);
        expect(ok).toEqual({ code: 0, out: `  ishlayapti, model: ${PASSED.model}\n` });
        expect(web.seen).toEqual([{ method: 'POST', url: '/api/ai/status', authorization: `Bearer ${SECRET}` }]);
        expect(h.testAi).toHaveBeenCalledTimes(1);

        h.testAi.mockResolvedValue(FAILED);
        const failed = await runProbe(web.port, SECRET);
        expect(failed).toEqual({ code: 1, out: `  XATO: ${FAILED.error}\n` });
        expect(h.testAi).toHaveBeenCalledTimes(2);
        expect(`${ok.out}${failed.out}`).not.toContain(SECRET);
      } finally {
        await web.close();
      }
    }, 60_000);

    it("konteynerdagi ops kaliti qabul qilinmasa (401), sayt eski versiyada bo'lsa (404) yoki kalit umuman yo'q bo'lsa: har biriga o'z tushuntirishi, 1 kodi, AI sinovi bajarilmaydi", async () => {
      const web = await site();
      const old = await site(true);
      try {
        const denied = await runProbe(web.port, 'ci-dummy-stale-secret');
        expect(denied.code).toBe(1);
        expect(denied.out).toMatch(/^ {2}XATO: \.env dagi TELEGRAM_OPS_SECRET qabul qilinmadi[^\n]*\n$/);
        expect(denied.out).not.toContain('ci-dummy-stale-secret');
        expect(web.seen).toHaveLength(1);

        const outdated = await runProbe(old.port, SECRET);
        expect(outdated.code).toBe(1);
        expect(outdated.out).toMatch(/^ {2}XATO: sayt hali yangi versiyaga yangilanmagan[^\n]*\n$/);
        expect(old.seen).toEqual([{ method: 'POST', url: '/api/ai/status', authorization: `Bearer ${SECRET}` }]);

        // Kalit yo'q yoki bo'sh: so'rov umuman yuborilmaydi ("Bearer undefined" ketmaydi)
        for (const secret of [undefined, '']) {
          const missing = await runProbe(web.port, secret);
          expect(missing, String(secret)).toEqual({ code: 1, out: '  XATO: .env da TELEGRAM_OPS_SECRET topilmadi\n' });
        }
        expect(web.seen).toHaveLength(1);
        expect(h.testAi).not.toHaveBeenCalled();
      } finally {
        await web.close();
        await old.close();
      }
    }, 60_000);
  });

  // Windows'da faqat Git Bash muhitida (MSYSTEM) ishlaydi: u yerdagi `bash` — WSL emas. Linux (CI) va macOS'da bash doim bor
  describe.skipIf(process.platform === 'win32' && !process.env.MSYSTEM)("skript haqiqiy bajarilganda (bash; docker, flock va sleep o'rnida soxta funksiyalar, .env — vaqtinchalik papkada)", () => {
    /** Skript ishga tushguncha .env da turgan (ishlab turgan) kalit */
    const OLD = 'sk-ant-ci-dummy-previous-secret';
    const ENV_REST = `TELEGRAM_OPS_SECRET="${SECRET}"\nAI_DAILY_LIMIT="120"\n`;
    const ttyCheck = lines.find((l) => l.startsWith('[ -t 0 ] || ')) ?? '';
    const lockOpen = 'exec 9>/var/lock/pack24-deploy.lock\n';
    /** Tashqi buyruqlar o'rnida bash funksiyalari: chaqiruvlar calls.log ga yoziladi, P24_FAIL da ko'rsatilgan qadam xato qaytaradi */
    const stubs = [
      'docker() {',
      '  case "$*" in',
      '    *"up -d"*) echo up >> calls.log; [ "${P24_FAIL:-}" != up ] ;;',
      '    *"/api/health"*) echo health >> calls.log; [ "${P24_FAIL:-}" != health ] ;;',
      '    *"/api/ai/status"*) echo probe >> calls.log; [ "${P24_FAIL:-}" != probe ] ;;',
      '    *) echo "$2" >> calls.log ;;',
      '  esac',
      '}',
      'flock() { echo "flock $1" >> calls.log; [ "${P24_FAIL:-}" != lock ]; }',
      'sleep() { :; }',
    ].join('\n');
    /** Skriptning o'zi; faqat ikki satri almashtirilgan: terminal tekshiruvi (o'rniga soxta buyruqlar) va qulf faylining manzili */
    const sandboxed = script.replace(`${ttyCheck}\n`, () => `${stubs}\n`).replace(lockOpen, () => 'exec 9>deploy.lock\n');
    type Step = 'lock' | 'up' | 'health' | 'probe';
    type Outcome = { code: number | string; out: string; env: string; key: string | undefined; calls: string[] };
    /** Skriptni vaqtinchalik papkada bajaradi: `answers` — egasining javoblari (kalit, model, chegara); `old: null` — .env da kalit satri umuman yo'q */
    const setup = (answers: string[], opts: { old?: string | null; fail?: Step } = {}) => new Promise<Outcome>((resolve) => {
      const dir = mkdtempSync(join(tmpdir(), 'p24-ai-setup-'));
      const old = opts.old === undefined ? OLD : opts.old;
      mkdirSync(join(dir, 'deploy'));
      writeFileSync(join(dir, '.env'), old === null ? ENV_REST : `ANTHROPIC_API_KEY="${old}"\n${ENV_REST}`);
      writeFileSync(join(dir, 'deploy', 'ai-setup.sh'), sandboxed);
      const child = execFile('bash', ['deploy/ai-setup.sh'], { cwd: dir, env: { ...process.env, P24_FAIL: opts.fail ?? '' }, timeout: 30_000 }, (err, stdout, stderr) => {
        const env = readFileSync(join(dir, '.env'), 'utf8');
        const calls = existsSync(join(dir, 'calls.log')) ? readFileSync(join(dir, 'calls.log'), 'utf8').trim().split('\n') : [];
        rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
        resolve({ code: err ? (err.code ?? 'signal') : 0, out: `${stdout}${stderr}`, env, key: /^ANTHROPIC_API_KEY="(.*)"$/m.exec(env)?.[1], calls });
      });
      child.stdin?.on('error', () => undefined);
      child.stdin?.end(answers.map((a) => `${a}\n`).join(''));
    });
    /** Chaqiruvlar ketma-ketligi (ketma-ket takrorlar bitta qilib) */
    const flow = (o: Outcome) => o.calls.filter((c, i) => c !== o.calls[i - 1]).join(' > ');
    /** Yangi kalit, model va chegara o'zgarmaydi (Enter) */
    const NEW_KEY = [KEY, '', ''];
    const RESTORED = /avvalgi holat tiklandi/;

    it("sinov muhiti: skriptning terminal tekshiruvi va qulf satri topilib almashtirilgan, qolgan hamma satr — asl skript", () => {
      expect(ttyCheck).toMatch(/exit 1; \}$/);
      expect(script).toContain(lockOpen);
      expect(sandboxed).toContain(`${stubs}\n`);
      expect(sandboxed).not.toContain('[ -t 0 ]');
      expect(sandboxed).not.toContain('/var/lock/');
      // Ikki almashtirish ortga qaytarilsa — asl skriptning o'zi
      expect(sandboxed.replace(`${stubs}\n`, () => `${ttyCheck}\n`).replace('exec 9>deploy.lock\n', () => lockOpen)).toBe(script);
    });

    it("yangi kalit sinovgacha yetib bormasa (deploy qulfi bo'shamadi, docker xato berdi, sayt javob bermadi): skript 1 kodi bilan tugaydi, .env da avvalgi kalit qoladi", async () => {
      const [locked, down, silent] = await Promise.all((['lock', 'up', 'health'] as const).map((fail) => setup(NEW_KEY, { fail })));
      for (const [name, run] of Object.entries({ locked, down, silent })) {
        expect(run.code, `${name}\n${run.out}`).toBe(1);
        // Sinalmagan kalit qolmadi, avvalgisi joyida; .env ning boshqa satrlari va yagona kalit satri saqlangan
        expect(run.key, name).toBe(OLD);
        expect(run.env.split('\n').sort(), name).toEqual(`ANTHROPIC_API_KEY="${OLD}"\n${ENV_REST}`.split('\n').sort());
        // Egasiga nima bo'lgani aytiladi; kalitlarning o'zi ekranga chiqmaydi
        expect(run.out, name).toMatch(RESTORED);
        expect(run.out, name).not.toContain(KEY);
        expect(run.out, name).not.toContain(OLD);
        // Kalit sinovgacha yetib bormagan
        expect(run.calls, name).not.toContain('probe');
      }
      // Qulf olinmasa saytga umuman tegilmaydi (docker chaqirilmaydi); docker xatosida holat, javob bermagan saytda (24 marta so'ralgach) loglar ko'rsatiladi
      expect(flow(locked)).toBe('flock -n > flock -w');
      expect(flow(down)).toMatch(/^flock -n > up > ps\b/);
      expect(flow(silent)).toMatch(/^flock -n > up > health > logs\b/);
      expect(silent.calls.filter((c) => c === 'health')).toHaveLength(24);
    }, 60_000);

    it("birinchi marta kiritilayotgan kalit (avval AI o'chiq) ham sinalmasdan qolmaydi: .env da bo'sh kalit — AI o'chiqligicha qoladi", async () => {
      const runs = await Promise.all([setup(NEW_KEY, { old: '', fail: 'lock' }), setup(NEW_KEY, { old: null, fail: 'up' })]);
      for (const [i, run] of runs.entries()) {
        expect(run.code, `${i}\n${run.out}`).toBe(1);
        expect(run.key, `${i}`).toBe('');
        expect(run.env, `${i}`).not.toContain(KEY);
        expect(run.out, `${i}`).toMatch(RESTORED);
        expect(run.calls, `${i}`).not.toContain('probe');
      }
    }, 60_000);

    it("tuzoq faqat sinalmagan yangi kalitni qaytaradi: sinovdan o'tgan kalit, «-» bilan o'chirish va o'zgarmagan kalit o'z holicha qoladi", async () => {
      const [passed, disabled, same] = await Promise.all([setup(NEW_KEY), setup(['-'], { fail: 'up' }), setup([OLD, '', ''], { fail: 'lock' })]);
      // Sinov o'tdi: yangi kalit kuchda, hech narsa qaytarilmagan
      expect(passed.code, passed.out).toBe(0);
      expect(passed.key).toBe(KEY);
      expect(flow(passed)).toBe('flock -n > up > health > probe');
      expect(passed.out).toContain('TAYYOR');
      // «-»: egasi AI'ni o'chirdi — sayt qayta ishga tushmasa ham bo'sh kalit qoladi (eski kalit qaytib kelmaydi)
      expect(disabled.code, disabled.out).toBe(1);
      expect(disabled.key).toBe('');
      expect(flow(disabled)).toBe('flock -n > up > ps');
      // O'sha kalitning o'zi qayta kiritildi: .env ga umuman tegilmagan
      expect(same.code, same.out).toBe(1);
      expect(same.env).toBe(`ANTHROPIC_API_KEY="${OLD}"\n${ENV_REST}`);
      for (const run of [passed, disabled, same]) {
        expect(run.out).not.toMatch(RESTORED);
        expect(run.out).not.toContain(KEY);
        expect(run.out).not.toContain(OLD);
      }
    }, 60_000);

    it("sinov o'tmasa skript avvalgi kalitni o'zi qaytarib, saytni qayta ishga tushiradi — tuzoq ikkinchi marta yozmaydi", async () => {
      const rejected = await setup(NEW_KEY, { fail: 'probe' });
      expect(rejected.code, rejected.out).toBe(1);
      expect(rejected.key).toBe(OLD);
      expect(rejected.env.match(/^ANTHROPIC_API_KEY=/gm)).toHaveLength(1);
      expect(flow(rejected)).toBe('flock -n > up > health > probe > up > health');
      expect(rejected.out).toContain('Avvalgi kalit qaytarildi');
      expect(rejected.out).not.toMatch(RESTORED);
      expect(rejected.out).not.toContain(KEY);
    }, 60_000);
  });
});

describe('admin: «Hozir tekshirish» (runAuditNow)', () => {
  const NOW = new Date('2026-10-10T07:00:00Z');
  const ago = (ms: number) => new Date(NOW.getTime() - ms);
  const DAY = 24 * 3_600_000;
  /** Amalni bajaradi va u yo'naltirgan manzilni qaytaradi */
  const run = async (): Promise<string> => {
    try {
      await runAuditNow();
    } catch (e) {
      if (e instanceof Redirect) return e.url;
      throw e;
    }
    throw new Error("amal hech qayerga yo'naltirmadi");
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  });

  it("«reports» ruxsatini talab qiladi: ruxsatsiz xodim yoki sessiyasiz so'rov bazagacha ham, tekshiruvgacha ham yetib bormaydi", async () => {
    // Xodim (staff) rolida "reports" yo'q, garchi "dashboard" va "orders" bo'lsa ham
    h.role = 'staff';
    expect(await run()).toBe('/admin?denied=1');
    h.role = 'user';
    expect(await run()).toBe('/admin/login');
    h.role = null;
    expect(await run()).toBe('/admin/login');
    expect(h.steps).toEqual(Array(3).fill('requireStaff:reports'));
    expect(h.runAudit).not.toHaveBeenCalled();
  });

  it("hisobot hali yo'q: avval ruxsat, keyin tekshiruv runAudit('manual') bilan bir marta; yangi hisobot sahifasiga ?done=1 bilan yo'naltiradi", async () => {
    for (const role of ['manager', 'admin'] as const) {
      h.role = role;
      h.steps = [];
      h.runAudit.mockClear();
      expect(await run()).toBe('/admin/audit?id=77&done=1');
      expect(h.steps).toEqual(['requireStaff:reports', 'auditReport.findFirst', 'runAudit:manual']);
      expect(h.runAudit.mock.calls).toEqual([['manual']]);
    }
  });

  it("oxirgi hisobot 60 soniyadan yosh bo'lsa: ?wait=1 ga qaytaradi, tekshiruv (AI so'rovi) bajarilmaydi", async () => {
    // Eski hisobotlar orasida eng oxirgisi hisobga olinadi
    h.reports = [{ id: 1, createdAt: ago(3 * DAY) }, { id: 2, createdAt: ago(DAY) }, { id: 3, createdAt: ago(59_999) }];
    expect(await run()).toBe('/admin/audit?wait=1');
    h.reports = [{ id: 9, createdAt: ago(1_000) }];
    expect(await run()).toBe('/admin/audit?wait=1');
    expect(h.runAudit).not.toHaveBeenCalled();
  });

  it("oxirgi hisobot bir daqiqa (yoki undan ko'p) oldin bo'lsa: tekshiruv bajariladi", async () => {
    h.reports = [{ id: 1, createdAt: ago(59_999) }];
    expect(await run()).toBe('/admin/audit?wait=1');
    // Bir millisoniyadan keyin roppa-rosa 60 soniya to'ladi
    vi.setSystemTime(NOW.getTime() + 1);
    expect(await run()).toBe('/admin/audit?id=77&done=1');
    h.reports = [{ id: 1, createdAt: ago(5 * 60_000) }, { id: 2, createdAt: ago(61_000) }];
    h.runAudit.mockResolvedValueOnce({ id: 1234 });
    expect(await run()).toBe('/admin/audit?id=1234&done=1');
    expect(h.runAudit.mock.calls).toEqual([['manual'], ['manual']]);
  });

  it("tekshiruv xato bilan tugasa «bajarildi» (?done=1) deb yo'naltirilmaydi", async () => {
    h.runAudit.mockRejectedValueOnce(new Error('baza ulanmadi'));
    await expect(run()).rejects.toThrow('baza ulanmadi');
  });

  /** Tugashini test o'zi boshqaradigan tekshiruv: AI javobini kutib turgan runAudit */
  const hanging = () => {
    let finish!: (report: { id: number }) => void;
    let fail!: (e: Error) => void;
    h.runAudit.mockImplementationOnce((trigger: string) => {
      h.steps.push(`runAudit:${trigger}`);
      return new Promise<{ id: number }>((resolve, reject) => { finish = resolve; fail = reject; });
    });
    return { finish: (report: { id: number }) => finish(report), fail: (e: Error) => fail(e) };
  };
  /** Boshlangan amal runAudit'gacha yetib borishi uchun navbatni bo'shatadi (vaqt soxta — faqat Date) */
  const settle = async () => { for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r)); };

  // "Oxirgi hisobot" faqat tekshiruv tugagach yoziladi: usiz birinchisi AI javobini kutayotganda (40 s gacha) har bir bosish yangi tekshiruv boshlardi
  it("birinchi tekshiruv hali tugamagan (hisobot bazaga yozilmagan) paytda ikkinchi bosish yangi tekshiruvni boshlamaydi: ?wait=1; tugagach qulf bo'shaydi", async () => {
    const audit = hanging();
    const first = run();
    await settle();
    expect(h.runAudit).toHaveBeenCalledTimes(1);
    // Bazada hali hech narsa yo'q (60 soniyalik tekshiruv bu yerda yordam bermaydi) — baribir kutishga yo'naltiradi
    expect(h.reports).toEqual([]);
    h.steps = [];
    expect(await run()).toBe('/admin/audit?wait=1');
    expect(await run()).toBe('/admin/audit?wait=1');
    expect(h.steps).toEqual(['requireStaff:reports', 'auditReport.findFirst', 'requireStaff:reports', 'auditReport.findFirst']);
    expect(h.runAudit).toHaveBeenCalledTimes(1);
    // Qulf ruxsat tekshiruvidan keyin: ruxsatsiz xodim "kuting" emas, rad javobini oladi
    h.role = 'staff';
    expect(await run()).toBe('/admin?denied=1');
    h.role = 'admin';
    audit.finish({ id: 501 });
    expect(await first).toBe('/admin/audit?id=501&done=1');
    // Tugadi: keyingi bosish (oxirgi hisobot bir daqiqadan eski bo'lsa) yana tekshiradi
    h.reports = [{ id: 501, createdAt: ago(61_000) }];
    expect(await run()).toBe('/admin/audit?id=77&done=1');
    expect(h.runAudit.mock.calls).toEqual([['manual'], ['manual']]);
  });

  it("tekshiruv xato bilan tugasa ham qulf bo'shaydi: «Hozir tekshirish» abadiy ?wait=1 da qolib ketmaydi", async () => {
    const audit = hanging();
    const first = run();
    await settle();
    expect(await run()).toBe('/admin/audit?wait=1');
    audit.fail(new Error('baza ulanmadi'));
    await expect(first).rejects.toThrow('baza ulanmadi');
    expect(await run()).toBe('/admin/audit?id=77&done=1');
    // Darhol (kutmasdan) yiqilgan tekshiruvdan keyin ham
    h.runAudit.mockRejectedValueOnce(new Error('AI javob bermadi'));
    await expect(run()).rejects.toThrow('AI javob bermadi');
    expect(await run()).toBe('/admin/audit?id=77&done=1');
    expect(h.runAudit).toHaveBeenCalledTimes(4);
  });

  it("kutishga yo'naltirilgan (bazadagi yosh hisobot tufayli) bosish qulfni ushlab qolmaydi", async () => {
    h.reports = [{ id: 1, createdAt: ago(1_000) }];
    expect(await run()).toBe('/admin/audit?wait=1');
    h.reports = [];
    expect(await run()).toBe('/admin/audit?id=77&done=1');
    expect(h.runAudit).toHaveBeenCalledTimes(1);
  });
});

describe('admin: «AI tekshiruv» sahifasi (?id)', () => {
  /** Server komponenti to'g'ridan-to'g'ri chaqiriladi (HTML'ga aylantirilmaydi): bazadan nima so'ralgani tekshiriladi */
  const open = (sp: Record<string, string | string[] | undefined>) => AuditPage({ searchParams: Promise.resolve(sp) });

  // Ustun INT4: chegaradan katta son Prisma'ga yetib borsa so'rov xato bilan yiqiladi va sahifa o'rnida 500 chiqadi
  it("?id faqat INT4 oralig'idagi musbat butun son bo'lsa bazadan so'raladi; boshqa har qanday qiymat e'tiborsiz — sahifa oxirgi hisobot bilan ochiladi", async () => {
    for (const id of ['2147483648', '4294967297', '99999999999999999999', '1e400', 'Infinity', '-1', '0', '1.5', 'abc', '5abc', 'NaN', '', ' ']) {
      expect(React.isValidElement(await open({ id })), id).toBe(true);
      expect(h.lookups, JSON.stringify(id)).toEqual([]);
    }
    // Takrorlangan parametr (?id=5&id=6) va parametrsiz so'rov
    await open({ id: ['5', '6'] });
    await open({});
    expect(h.lookups).toEqual([]);
    await open({ id: '1' });
    await open({ id: '2147483647' });
    expect(h.lookups).toEqual([1, 2147483647]);
  });

  it("sahifa ham amal kabi «reports» ruxsatini talab qiladi: ruxsatsiz xodim uchun bazaga so'rov ketmaydi", async () => {
    h.role = 'staff';
    await expect(open({ id: '1' })).rejects.toMatchObject({ url: '/admin?denied=1' });
    h.role = null;
    await expect(open({ id: '1' })).rejects.toMatchObject({ url: '/admin/login' });
    expect(h.steps).toEqual(['requireStaff:reports', 'requireStaff:reports']);
    expect(h.lookups).toEqual([]);
  });
});

describe('admin menyusi: «AI tekshiruv» havolasi', () => {
  const sidebar = readFileSync(new URL('../../components/admin/Sidebar.tsx', import.meta.url), 'utf8');
  const names = (block: string | undefined) => (block ?? '').split(',').map((n) => n.trim()).filter((n) => n && !n.startsWith('type '));
  const imported = names(sidebar.match(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/)?.[1]);
  const registered = names(sidebar.match(/const ICONS[^=]*=\s*\{([^}]*)\}/)?.[1]);
  const fallback = sidebar.match(/ICONS\[[^\]]+\]\s*\?\?\s*(\w+)/)?.[1];
  const audit = adminNav.find((i) => i.href === '/admin/audit');

  it("havola bitta va «reports» bo'limiga bog'langan: amal talab qiladigan ruxsatning o'zi, shuning uchun ruxsatsiz xodimga ko'rinmaydi", () => {
    expect(adminNav.filter((i) => i.href === '/admin/audit')).toHaveLength(1);
    expect(audit).toMatchObject({ href: '/admin/audit', section: 'reports' });
    expect(audit?.label.trim()).toBeTruthy();
    // Menyu layout'da can(rol, bo'lim) bilan suziladi
    const sees = (role: Role) => adminNav.filter((i) => can(role, i.section)).some((i) => i.href === '/admin/audit');
    expect(sees('admin')).toBe(true);
    expect(sees('manager')).toBe(true);
    expect(sees('staff')).toBe(false);
    expect(sees('user')).toBe(false);
  });

  it("ikonkasi Sidebar'da import qilingan va ICONS ro'yxatiga kiritilgan — jimgina standart ikonkaga almashib qolmaydi", () => {
    // Fayl matni kutilgandek o'qildi (aks holda quyidagi tekshiruvlar ma'nosiz)
    expect(imported.length).toBeGreaterThan(10);
    expect(registered.length).toBeGreaterThan(10);
    expect(fallback).toBeTruthy();
    const icon = audit?.icon ?? '';
    expect(icon).toMatch(/^[A-Z]\w+$/);
    expect(imported).toContain(icon);
    expect(registered).toContain(icon);
    // Topilmagan ikonka o'rniga bosh sahifa ikonkasi chiqadi: «AI tekshiruv» undan farq qilishi kerak
    expect(icon).not.toBe(fallback);
    // Menyudagi qolgan bo'limlar uchun ham shu qoida
    for (const item of adminNav) {
      expect(imported, item.href).toContain(item.icon);
      expect(registered, item.href).toContain(item.icon);
    }
  });
});
