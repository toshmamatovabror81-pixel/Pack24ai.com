#!/usr/bin/env node
// Pack24 — qadoqlashga oid fayllarni nace.ai orqali saralash.
//
// Nima qiladi: berilgan papkalardagi hujjatlarni (PDF, Excel, Word, rasm, ...) va internet
// havolalarini nace.ai Document Intelligence (NDI) ga beradi: har birini toifalaydi (classify),
// matnini Markdown ko'rinishida oladi (parse) va Drex qaror modelidan "bu hujjat pack24.uz
// skili uchun foydalimi, qaysi bo'limga tegishli, qaysi tilda" deb so'raydi.
// Natija: <chiqish>/index.json, <chiqish>/saralash-natija.md, <chiqish>/matn/<fayl>.<kengaytma>.md,
// <chiqish>/qollab-quvvatlanmagan.md (CorelDRAW .cdr va boshqa o'qilmaydigan fayllar).
//
// Ishga tushirish (Node 18+; tashqi kutubxona kerak emas). Windows'da yo'llarni "/" bilan yoki
// oxirida "\" siz yozing ("E:/Qadoqlash" yoki "E:\Qadoqlash"; "E:\Qadoqlash\" EMAS):
//   node tools/nace/saralash.mjs --papka "E:/Qadoqlash" --chiqish "E:/PACK24.uz/nace-natija"
//   node tools/nace/saralash.mjs --papka "E:/Qadoqlash" --sinov          # faqat ro'yxat, API chaqirilmaydi
//   node tools/nace/saralash.mjs --papka "E:/Qadoqlash" --limit 5        # avval 5 ta fayl bilan sinab ko'rish
//   node tools/nace/saralash.mjs --manbalar tools/nace/manbalar.txt      # internet havolalari (yuklamasdan, URL orqali)
// API kalit: NACE_API_KEY muhit o'zgaruvchisi yoki %USERPROFILE%\.nace\config.toml (api_key = "nace_sk_...").
// Qayta ishga tushirilsa, tugagan va o'zgarmagan fayllar o'tkazib yuboriladi (holat.json);
// o'zgargan fayl (hajm/sana) qaytadan ishlanadi; yarim qolgan ish (job) davom ettiriladi.
// Chiqish kodlari: 0 hammasi tayyor, 1 ba'zi fayllar xato, 2 parametr xatosi, 3 kalit yo'q,
// 4 kalit noto'g'ri yoki kredit tugadi, 5 nace.ai vaqtincha javob bermayapti (keyinroq qayta ishga tushiring).

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// ---------- sozlamalar ----------
const SUPPORTED = new Set([
  '.pdf', '.xlsx', '.xlsm', '.xls', '.csv', '.docx', '.doc', '.docm', '.pptx', '.ppt',
  '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.webp', '.bmp', '.html', '.htm', '.txt', '.log',
  '.xml', '.md', '.mdx', '.json', '.vsdx', '.vsd', '.eml', '.msg', '.oft',
]);
const NO_PARSE = new Set(['.bmp']); // nace.ai: bmp uchun parse yo'q
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '$RECYCLE.BIN', 'System Volume Information']);
const MAX_BYTES = 256 * 1024 * 1024; // bitta so'rovda yuklash chegarasi (bo'laklab yuklash qilinmagan)
const MAX_RETRY_WAIT = 120; // soniya: bundan uzun Retry-After kutilmaydi, ish to'xtatiladi
const WIN = process.platform === 'win32';
const MIME_EXT = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/csv': '.csv', 'text/plain': '.txt', 'text/markdown': '.md', 'text/html': '.html',
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/tiff': '.tiff',
};

// Toifalar (classify). id da '/' bo'lmasin; 'other' va boshqa zaxira id'lar ishlatilmaydi.
const CLASSES = [
  { id: 'narx_taklif', label: 'Narx ro\'yxati / tijorat taklifi', description: 'Price list or commercial offer (kommercheskoe predlozhenie, prays-list): tables of packaging products with prices, quantities, discounts, delivery terms.' },
  { id: 'texnik_spets', label: 'Texnik spetsifikatsiya / mahsulot pasporti', description: 'Technical specification, datasheet or passport of a packaging product or material: dimensions, cardboard/paper grade, flute type, grammage, tolerances, GOST/standard references.' },
  { id: 'maket', label: 'Maket / shtamp chizmasi / dizayn', description: 'Dieline, die-cut drawing, box layout (razvertka) or print artwork of a box, bag or label; mostly drawings with few words.' },
  { id: 'shartnoma', label: 'Shartnoma / kelishuv', description: 'Contract, agreement, supply terms or annex between the company and a customer or supplier.' },
  { id: 'hisob_hujjat', label: 'Hisob-faktura / akt / nakladnoy', description: 'Invoice, bill, act of acceptance, waybill, payment or accounting document.' },
  { id: 'sertifikat', label: 'Sertifikat / standart', description: 'Certificate, declaration of conformity, lab test report, or the text of a GOST / ISO / technical standard.' },
  { id: 'prezentatsiya', label: 'Prezentatsiya / katalog / reklama', description: 'Company presentation, marketing brochure, product catalogue, website or social media text.' },
  { id: 'ishlab_chiqarish', label: 'Ishlab chiqarish / kalkulyatsiya / ombor', description: 'Internal production plan, cost calculation (kalkulyatsiya), material consumption, stock or inventory sheet, equipment manual.' },
  { id: 'yozishma', label: 'Yozishma / so\'rov', description: 'Letters, customer requests, emails, chat exports, questionnaires.' },
  { id: 'bilim_maqola', label: 'Bilim maqolasi / qo\'llanma', description: 'Educational or reference article, guide, encyclopedia page or textbook chapter about packaging materials, box design, printing or the packaging market.' },
];

// Drex savollari (qaror modeli). state = fayl nomi + toifa + matn boshi.
const DREX_QUESTIONS = {
  foydali: {
    type: 'noul',
    instructions: 'Does this document contain packaging-business knowledge that would help an assistant for the packaging company pack24.uz (products, materials, sizes, prices, production, customers, terms)? Answer yes only if the content is reusable knowledge, not a one-off record.',
  },
  bolim: {
    type: 'choice',
    instructions: 'Which section of the pack24.uz knowledge skill does this document mainly feed?',
    criteria: {
      katalog: 'Product range: box, bag, container types, standard sizes, SKUs, what the company sells',
      narxlar: 'Prices, offers, discounts, cost calculations, payment terms',
      materiallar: 'Paper, cardboard, corrugated board grades, flute profiles, grammage, standards (GOST/ISO)',
      ishlab_chiqarish: 'Production process, equipment, dielines, printing, tolerances, lead times',
      mijozlar: 'Customers, orders, correspondence, contracts, invoices, delivery',
      boshqa: 'None of the above',
    },
  },
  til: {
    type: 'choice',
    instructions: 'Main language of the document text.',
    criteria: { uz: 'Uzbek (Latin or Cyrillic)', ru: 'Russian', en: 'English', boshqa: 'Other or no text' },
  },
};

// ---------- argumentlar ----------
const QAYTA_REJIMLAR = ['hammasi', 'toifa', 'matn', 'drex'];
function cleanPath(v) {
  // Windows'da "E:\Qadoqlash\" deb yozilsa cmd `\"` ni oddiy qo'shtirnoq deb o'qiydi va qiymat `E:\Qadoqlash"` bo'lib qoladi.
  return String(v ?? '').replace(/["]+$/, '').trim();
}
function parseArgs(argv) {
  const a = {
    papkalar: [], manbalar: [], chiqish: path.resolve('nace-natija'), sinov: false, limit: 0, parallel: 2,
    rejim: 'low', parse: true, drex: true, drexModel: 'drex-latest', baseUrl: '', qayta: '', kalitFayl: '', kutishMin: 10,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const peek = () => argv[i + 1];
    const v = () => { if (i + 1 >= argv.length) { console.error(`${k} uchun qiymat kerak`); process.exit(2); } return argv[++i]; };
    if (k === '--papka') a.papkalar.push(cleanPath(v()));
    else if (k === '--manbalar') a.manbalar.push(cleanPath(v()));
    else if (k === '--chiqish') a.chiqish = path.resolve(cleanPath(v()));
    else if (k === '--sinov') a.sinov = true;
    else if (k === '--limit') a.limit = Number(v()) || 0;
    else if (k === '--parallel') a.parallel = Math.max(1, Math.min(8, Number(v()) || 2));
    else if (k === '--rejim') a.rejim = v();
    else if (k === '--parse') a.parse = v() !== 'yoq';
    else if (k === '--drex') { const x = v(); a.drex = x !== 'yoq'; if (x && x !== 'ha' && x !== 'yoq') a.drexModel = x; }
    else if (k === '--base-url') a.baseUrl = cleanPath(v()).replace(/\/+$/, '');
    else if (k === '--qayta') { a.qayta = 'hammasi'; if (peek() && QAYTA_REJIMLAR.includes(peek())) a.qayta = v(); }
    else if (k === '--kutish') a.kutishMin = Math.max(1, Number(v()) || 10);
    else if (k === '--kalit-fayl') a.kalitFayl = cleanPath(v());
    else if (k === '--yordam' || k === '-h' || k === '--help') { yordam(); process.exit(0); }
    else { console.error(`Noma'lum parametr: ${k}`); yordam(); process.exit(2); }
  }
  if (!['low', 'medium', 'high'].includes(a.rejim)) { console.error('--rejim low | medium | high bo\'lishi kerak'); process.exit(2); }
  if (a.papkalar.length === 0 && a.manbalar.length === 0) { console.error('Kamida bitta --papka yoki --manbalar bering.'); yordam(); process.exit(2); }
  return a;
}
function yordam() {
  console.log(`Foydalanish: node saralash.mjs [--papka <papka>]... [--manbalar <havolalar.txt>]... [--chiqish <papka>]
  --papka <papka>    kompyuterdagi papka (PDF, Excel, Word, rasm, ...)
  --manbalar <fayl>  internet havolalari: har qatorda "URL | nom | fayl.pdf" (nom va fayl nomi ixtiyoriy; # izoh)
  --sinov            faqat fayllar ro'yxatini chiqaradi, API chaqirilmaydi (bepul)
  --limit N          faqat birinchi N ta ishlanmagan faylni ishlaydi (sinov uchun)
  --parallel N       bir vaqtda nechta fayl (1-8, odatda 2)
  --rejim low|medium|high   parse sifati (low eng arzon)
  --parse yoq        matnni olmaslik (faqat toifalash)
  --drex yoq | <model>      Drex savollarini o'chirish yoki model nomi (odatda drex-latest)
  --qayta [hammasi|toifa|matn|drex]  tugagan fayllarning shu bosqichlarini qaytadan ishlash (yuklash takrorlanmaydi)
  --kutish N         bitta ish uchun kutish, daqiqa (odatda 10; katta skanerlar uchun ko'proq)
  --kalit-fayl <yo'l>       kalit yozilgan fayl (odatda ~/.nace/config.toml)
  --base-url <url>   API manzili (odatda https://console.nace.ai)`);
}

// ---------- kalit ----------
function readKey(kalitFayl) {
  const env = (process.env.NACE_API_KEY || '').trim();
  const strip = (s) => (s || '').trim().replace(/\/+$/, '');
  if (env) return { key: env, baseUrl: strip(process.env.NACE_BASE_URL) };
  const f = kalitFayl || path.join(os.homedir(), '.nace', 'config.toml');
  if (!fs.existsSync(f)) return { key: '', baseUrl: '' };
  const txt = fs.readFileSync(f, 'utf8');
  const key = /^\s*api_key\s*=\s*"([^"]+)"/m.exec(txt)?.[1]?.trim() || '';
  const baseUrl = strip(/^\s*base_url\s*=\s*"([^"]+)"/m.exec(txt)?.[1]);
  return { key, baseUrl };
}

// ---------- yordamchilar ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
function toPosix(p) { return p.split(path.sep).join('/'); }
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
function safeSeg(seg) {
  let s = seg.replace(/[\\/:*?"<>|]/g, '_').replace(/[. ]+$/, '');
  if (RESERVED.test(s.replace(/\.[^.]*$/, ''))) s = '_' + s;
  return s || '_';
}
function safeRel(rel) { return toPosix(rel).replace(/^\/+/, '').split('/').map(safeSeg).join('/'); }
function trunc(s, n) { return s.length > n ? s.slice(0, n) + '\n…' : s; }
function norm(p) { const r = path.resolve(p); return WIN ? r.toLowerCase() : r; }
function isInside(child, parent) {
  const c = norm(child); const p = norm(parent);
  return c === p || c.startsWith(p.endsWith(path.sep) ? p : p + path.sep);
}
function shortHash(s) { return crypto.createHash('sha1').update(s).digest('hex').slice(0, 6); }
function pct(x) { return typeof x === 'number' ? `${Math.round(x * 100)}%` : '—'; }
function classLabel(id) { return CLASSES.find((c) => c.id === id)?.label || id || '—'; }

class NaceError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; Object.assign(this, extra); }
}
function isBilling(e) { return e.status === 402 || /credit|quota|billing|payment/i.test(String(e.code || '')); }
function isFatal(e) { return e.code === 'unauthorized' || isBilling(e); }
function isTransient(e) { return e.code === 'retry' || e.code === 'network' || e.status === 429 || (e.status >= 500 && e.status <= 599); }

function makeClient({ baseUrl, key, log, kutishMs }) {
  // Javob tanasi xabarga qo'shilmaydi (token va h.k. sizib chiqmasin): faqat status va server xabari.
  async function request(method, url, { json, form, headers = {}, auth = true, raw = false, timeout = 60_000, idem } = {}, tries = 4) {
    const h = { ...headers };
    if (auth) h['Authorization'] = `Bearer ${key}`;
    if (idem) h['Idempotency-Key'] = idem;
    let body;
    if (json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form;
    let lastErr;
    for (let t = 1; t <= tries; t++) {
      let res;
      try {
        res = await fetch(url, { method, headers: h, body, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
      } catch (e) {
        lastErr = new NaceError(0, 'network', `Tarmoq xatosi: ${e.name === 'TimeoutError' || e.name === 'AbortError' ? `javob ${Math.round(timeout / 1000)} s ichida kelmadi` : e.message}`);
        if (t < tries) { const w = Math.min(MAX_RETRY_WAIT, 2 * 2 ** (t - 1)); log(`Kutish ${w}s: ${lastErr.message} (${t}/${tries}) ${method} ${urlShort(url)}`); await sleep(w * 1000); continue; }
        throw lastErr;
      }
      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        const text = await res.text().catch(() => '');
        let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
        const code = data?.error?.code || data?.code || 'retry';
        const raH = res.headers.get('retry-after');
        const ra = Number(raH) || 0;
        lastErr = new NaceError(res.status, code === 'retry' ? 'retry' : code, `HTTP ${res.status} ${code}${ra ? ` (Retry-After ${ra}s)` : ''}`, { retryAfter: ra, serverMessage: data?.error?.message || '' });
        if (res.status === 429 && (ra > MAX_RETRY_WAIT || /credit|quota|billing|payment/i.test(code))) throw lastErr;
        if (t < tries) { const w = ra ? Math.min(ra, MAX_RETRY_WAIT) : Math.min(MAX_RETRY_WAIT, 2 * 2 ** (t - 1)); log(`Kutish ${w}s: HTTP ${res.status} ${code} (${t}/${tries}) ${method} ${urlShort(url)}`); await sleep(w * 1000); continue; }
        throw lastErr;
      }
      if (raw) {
        if (!res.ok) throw new NaceError(res.status, 'content_download', `Fayl yuklanmadi: HTTP ${res.status}`);
        return res;
      }
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (res.status === 401 || res.status === 403) {
        if (!auth) throw new NaceError(res.status, 'upload_token', `Yuklash ruxsati rad etildi (HTTP ${res.status})`);
        throw new NaceError(res.status, 'unauthorized', `nace.ai kalitni qabul qilmadi yoki ruxsat yo'q (HTTP ${res.status}): kalitni nace-kalit-ulash.cmd bilan qayta kiriting yoki console.nace.ai da balansni tekshiring.`);
      }
      if (res.status >= 400) {
        const code = data?.error?.code || data?.code || `http_${res.status}`;
        const msg = data?.error?.message || data?.message || (data ? 'server xabari yo\'q' : 'javob JSON emas');
        throw new NaceError(res.status, code, `${code}: ${String(msg).slice(0, 300)}`, { data });
      }
      return { status: res.status, data, text, res };
    }
    throw lastErr;
  }
  function urlShort(u) { try { const x = new URL(u); return x.pathname.split('/').slice(0, 4).join('/'); } catch { return '?'; } }

  const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);
  const jobUrl = (id) => `${baseUrl}/v1/documents/jobs/${encodeURIComponent(id)}`;

  async function getJob(id) { return (await request('GET', jobUrl(id))).data; }

  async function waitJob(first, label) {
    let job = first;
    const start = Date.now();
    let delay = 1000;
    while (true) {
      if (job?.status && TERMINAL.has(job.status)) return job;
      const id = job?.job_id || job?.id;
      if (!id) throw new NaceError(0, 'no_job_id', `${label}: javobda job_id yo'q (maydonlar: ${Object.keys(job || {}).join(',') || 'bo\'sh'})`);
      if (Date.now() - start > kutishMs) throw new NaceError(0, 'timeout', `${label}: ish ${Math.round(kutishMs / 60000)} daqiqada tugamadi (job ${id}); keyingi ishga tushirishda davom etadi`, { job_id: id });
      await sleep(delay);
      delay = Math.min(10_000, delay * 1.6);
      job = await getJob(id);
    }
  }

  function assertSucceeded(job, label) {
    if (job.status !== 'succeeded') {
      const e = job.error || {};
      throw new NaceError(0, e.code || job.status, `${label}: ${e.code || job.status}${e.message ? ' — ' + String(e.message).slice(0, 200) : ''}`, { job_id: job.job_id, doimiy: !e.retryable });
    }
    return job;
  }

  async function uploadOnce(absPath, relPosix, size) {
    const grant = await request('POST', `${baseUrl}/v1/documents/upload-grants`, { json: { path: relPosix, ttl_seconds: 3600 } });
    const { upload_url, token, workspace_id } = grant.data || {};
    if (!upload_url || !token) throw new NaceError(grant.status, 'bad_grant', `upload-grant javobi kutilmagan (HTTP ${grant.status}; maydonlar: ${Object.keys(grant.data || {}).join(',') || 'yo\'q'})`);
    const buf = await fsp.readFile(absPath);
    const form = new FormData();
    form.append('file', new Blob([buf]), path.basename(absPath));
    // metadata — oddiy maydon (rasmiy SDK'lar shunday yuboradi), fayl qismi EMAS
    form.append('metadata', JSON.stringify({ path: relPosix, total_size_bytes: size, on_conflict: 'new_version' }));
    const up = await request('POST', upload_url, { form, headers: { 'X-Upload-Token': token }, auth: false, timeout: 600_000 });
    const job = assertSucceeded(await waitJob(up.data, 'yuklash'), 'yuklash');
    const file = job.result?.file || job.result?.files?.[0] || job.file;
    const ws = file?.workspace_id || workspace_id;
    const fid = file?.file_id || file?.id;
    if (!ws || !fid) throw new NaceError(0, 'bad_upload', `yuklash javobida file_id yo'q (maydonlar: ${Object.keys(job.result || {}).join(',') || 'yo\'q'})`);
    return { type: 'workspace_file', workspace_id: ws, file_id: fid, deduplicated: !!job.result?.deduplicated };
  }
  async function upload(absPath, relPosix, size) {
    try { return await uploadOnce(absPath, relPosix, size); } catch (e) {
      if (e.code === 'upload_token') { log(`Yuklash ruxsati rad etildi, yangi ruxsat olinmoqda: ${relPosix}`); return await uploadOnce(absPath, relPosix, size); }
      throw e;
    }
  }

  // Ishni boshlash: qisqa kutish bilan POST (Idempotency-Key har chaqiriqda yangi, retry'larda bir xil).
  async function submit(kind, body) {
    const r = await request('POST', `${baseUrl}/v1/documents/${kind}?wait_seconds=10`, { json: body, idem: crypto.randomUUID(), timeout: 90_000 });
    return r.data;
  }
  function classifyBody(source) {
    return {
      source,
      classes: CLASSES.map(({ id, label, description }) => ({ id, label, description })),
      granularity: 'document',
      unknown_policy: 'allow',
      output: { max_alternatives: 3, include_reason: true },
    };
  }
  function classifyResult(job) {
    const unit = job.result?.units?.[0] || {};
    const labels = (unit.labels || []).map((l) => ({ id: l.class_id, label: l.label, confidence: l.confidence, reason: l.reason }));
    return { unknown: !!unit.unknown, labels, job_id: job.job_id };
  }
  function parseBody(source, rejim) {
    return {
      source,
      parse_mode: rejim,
      output: { formats: ['markdown'], table_format: 'html', include_page_markers: true },
      figures: { mode: 'omit' },
    };
  }
  async function parseResult(job, rejim) {
    const doc = job.result?.document || {};
    let markdown = doc.markdown || '';
    let kesilgan = false;
    const truncated = (job.result?.disclosures || []).some((d) => d.code === 'content_truncated');
    if (truncated) {
      // Oddiy hujjat: document.content_url; ish kitobi (Excel): har varaq uchun sheets[].content_url
      const parts = doc.content_url
        ? [{ nom: '', url: doc.content_url }]
        : (doc.spreadsheet?.sheets || []).filter((s) => s.content_url).map((s) => ({ nom: s.name || s.sheet || '', url: s.content_url }));
      if (parts.length) {
        try {
          const texts = [];
          for (const p of parts) { const t = await fetchFull(p.url); texts.push(p.nom ? `## ${p.nom}\n\n${t}` : t); }
          markdown = texts.join('\n\n');
        } catch (e) { kesilgan = true; log(`To'liq matn olinmadi (${e.message}); qisqartirilgan matn saqlanadi.`); }
      } else kesilgan = true;
    }
    return { markdown, kesilgan, pages: doc.page_count ?? null, lane: job.result?.lane || null, units: typeof job.result?.units === 'number' ? job.result.units : null, ocr: !!job.result?.ocr_applied, job_id: job.job_id, rejim };
  }

  // To'liq matn: redirect=false bilan imzolangan havolani olamiz, keyin kalitsiz yuklaymiz; eskirgan bo'lsa bir marta yangilaymiz.
  async function fetchFull(contentUrl) {
    const u = contentUrl + (contentUrl.includes('?') ? '&' : '?') + 'redirect=false';
    for (let attempt = 0; attempt < 2; attempt++) {
      let signed = '';
      for (let t = 0; t < 20; t++) {
        const r = await request('GET', u);
        if (r.status === 202) { await sleep((Number(r.data?.retry_after_seconds) || 3) * 1000); continue; }
        if (r.data && typeof r.data === 'object' && r.data.url) { signed = r.data.url; break; }
        if (r.data === null && r.text) return r.text; // API redirect=false ni e'tiborsiz qoldirib matnni o'zi qaytargan
        throw new NaceError(r.status, 'content_download', `To'liq matn havolasi kutilmagan ko'rinishda (maydonlar: ${Object.keys(r.data || {}).join(',') || 'yo\'q'})`);
      }
      if (!signed) throw new NaceError(0, 'content_pending', 'To\'liq matn tayyor bo\'lmadi');
      try {
        const res = await request('GET', signed, { auth: false, raw: true, timeout: 300_000 });
        const ct = res.headers.get('content-type') || '';
        if (/json/i.test(ct) && !/markdown|text/i.test(ct)) throw new NaceError(res.status, 'content_download', `To'liq matn o'rniga JSON keldi (${ct})`);
        return await res.text();
      } catch (e) {
        if (attempt === 0 && e.code === 'content_download') { log(`Imzolangan havola ishlamadi (${e.message}); yangisi olinmoqda.`); continue; }
        throw e;
      }
    }
    throw new NaceError(0, 'content_download', 'To\'liq matn yuklanmadi');
  }

  async function drex(model, state, questions) {
    const r = await request('POST', `${baseUrl}/v1/systemone`, { json: { model, state, questions }, timeout: 90_000 });
    return r.data;
  }

  async function ping() { return (await request('GET', `${baseUrl}/v1/documents/jobs?limit=1`)).status; }

  async function headExt(url) {
    // Kengaytmasiz URL: Content-Type bo'yicha fayl turini aniqlaymiz (kalitsiz, qisqa kutish)
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20_000) });
      const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const cd = res.headers.get('content-disposition') || '';
      const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
      if (m) { const ext = path.posix.extname(decodeURIComponent(m[1]).toLowerCase()); if (SUPPORTED.has(ext)) return ext; }
      if (MIME_EXT[ct]) return MIME_EXT[ct];
    } catch {}
    return '';
  }

  return { upload, submit, waitJob, getJob, assertSucceeded, classifyBody, classifyResult, parseBody, parseResult, drex, ping, headExt };
}

// ---------- fayllarni topish ----------
async function walk(root, out, unsupported, chiqish, visited = new Set()) {
  let real;
  try { real = await fsp.realpath(root); } catch { real = root; }
  const vkey = norm(real);
  if (visited.has(vkey)) return;
  visited.add(vkey);
  let entries;
  try { entries = await fsp.readdir(root, { withFileTypes: true }); } catch (e) { console.warn(`O'qib bo'lmadi: ${root} (${e.message})`); return; }
  for (const ent of entries) {
    const abs = path.join(root, ent.name);
    let isDir = ent.isDirectory();
    let isFile = ent.isFile();
    if (!isDir && !isFile && ent.isSymbolicLink()) {
      try { const st = await fsp.stat(abs); isDir = st.isDirectory(); isFile = st.isFile(); } catch { continue; }
    }
    if (isDir) {
      if (SKIP_DIRS.has(ent.name) || ent.name.startsWith('.') || isInside(abs, chiqish)) continue;
      await walk(abs, out, unsupported, chiqish, visited);
    } else if (isFile) {
      if (ent.name.startsWith('~$') || ent.name.startsWith('.')) continue; // Office vaqtinchalik fayllari
      const ext = path.extname(ent.name).toLowerCase();
      let st;
      try { st = await fsp.stat(abs); } catch { continue; }
      const item = { abs, ext, size: st.size, mtime: Math.round(st.mtimeMs), name: ent.name };
      if (SUPPORTED.has(ext) && st.size > 0 && st.size <= MAX_BYTES) out.push(item);
      else unsupported.push({ ...item, sabab: !SUPPORTED.has(ext) ? 'format' : st.size === 0 ? 'bo\'sh' : 'juda katta' });
    }
  }
}

// ---------- internet havolalari ----------
// Fayl formati: har qatorda "https://... | ixtiyoriy nom | ixtiyoriy fayl nomi (kengaytma bilan)"; '#' izoh.
async function readSources(files) {
  const out = [];
  const seen = new Set();
  for (const f of files) {
    let txt;
    try { txt = await fsp.readFile(f, 'utf8'); } catch (e) { console.error(`Manbalar fayli o'qilmadi: ${f} (${e.message})`); process.exit(2); }
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const cols = line.split('|').map((s) => s.trim());
      const url = cols[0];
      if (!/^https?:\/\//i.test(url)) { console.warn(`O'tkazib yuborildi (URL emas): ${line}`); continue; }
      const k = url.replace(/\/+$/, '');
      if (seen.has(k)) continue;
      seen.add(k);
      const nom = cols[1] || '';
      const fileNameCol = cols[2] && SUPPORTED.has(path.posix.extname(cols[2].toLowerCase())) ? cols[2] : '';
      out.push({ url, nom, fileNameCol, rel: urlRel(url, nom) });
    }
  }
  return out;
}
function urlExt(url) {
  try { const ext = path.posix.extname(new URL(url).pathname.toLowerCase()); if (SUPPORTED.has(ext)) return ext; } catch {}
  return '';
}
function urlBase(url) {
  let base = 'sahifa';
  try { base = path.posix.basename(new URL(url).pathname) || 'sahifa'; } catch {}
  return base.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'sahifa';
}
function urlRel(url, nom) {
  let host = 'internet';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  const name = safeSeg((nom || urlBase(url)).slice(0, 90));
  return `internet/${safeSeg(host)}/${name}~${shortHash(url)}`;
}

// ---------- holat (resume) ----------
async function loadState(file) {
  try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return { boshlandi: nowIso(), fayllar: {} }; }
}
let chain = Promise.resolve();
function enqueue(fn) { chain = chain.then(fn).catch((e) => console.warn(`Yozish xatosi: ${e.message}`)); return chain; }
async function writeAtomic(file, content) {
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, content);
  await fsp.rename(tmp, file);
}
function saveState(file, state) { return enqueue(() => writeAtomic(file, JSON.stringify(state, null, 2))); }

// ---------- hisobot ----------
function buildIndex(state) { return Object.values(state.fayllar).sort((a, b) => a.rel.localeCompare(b.rel)); }

function buildSummary(state, unsupported, args) {
  const rows = buildIndex(state);
  const done = rows.filter((r) => r.holat === 'tayyor');
  const failed = rows.filter((r) => r.holat === 'xato');
  const waiting = rows.filter((r) => r.holat === 'kutilmoqda' || r.holat === 'jarayonda');
  const removed = rows.filter((r) => r.holat === 'ochirilgan');
  const byClass = new Map();
  for (const r of done) {
    const id = r.toifa?.unknown ? 'nomalum' : (r.toifa?.labels?.[0]?.id || 'nomalum');
    if (!byClass.has(id)) byClass.set(id, []);
    byClass.get(id).push(r);
  }
  const parseUnits = done.reduce((s, r) => s + (Number(r.matn?.units) || 0), 0);
  const drexTokens = done.reduce((s, r) => s + (Number(r.drex?.usage?.input_tokens) || 0) + (Number(r.drex?.usage?.output_tokens) || 0), 0);
  const L = [];
  L.push('# Qadoqlash fayllari — nace.ai saralash natijasi', '');
  L.push(`Yangilandi: ${nowIso()}. Papkalar: ${args.papkalar.join('; ') || '—'}. Manbalar: ${args.manbalar.join('; ') || '—'}. Rejim: ${args.rejim}.`, '');
  L.push(`- Ishlangan fayllar: ${done.length}`);
  L.push(`- Xato bilan tugagan: ${failed.length}${waiting.length ? `; kutilmoqda/yarim: ${waiting.length}` : ''}${removed.length ? `; o'chirilgan: ${removed.length}` : ''}`);
  L.push(`- Qo'llab-quvvatlanmagan (CorelDRAW .cdr va h.k.): ${unsupported.length} — qarang: qollab-quvvatlanmagan.md`);
  L.push(`- Matn olish birliklari (parse units): ${parseUnits}; Drex tokenlari: ${drexTokens}; kesilgan matnlar: ${done.filter((r) => r.matn?.kesilgan).length}`, '');
  L.push('## Toifalar bo\'yicha', '');
  const order = [...CLASSES.map((c) => c.id), ...[...byClass.keys()].filter((k) => !CLASSES.some((c) => c.id === k))];
  for (const id of order) {
    const list = byClass.get(id);
    if (!list?.length) continue;
    L.push(`### ${id === 'nomalum' ? 'Noma\'lum toifa' : classLabel(id)} (${list.length})`, '');
    L.push('| Fayl | Ishonch | Drex: bo\'lim | Foydali | Til | Sahifa | Matn |');
    L.push('|---|---|---|---|---|---|---|');
    for (const r of list) {
      const top = r.toifa?.labels?.[0];
      const bolim = r.drex?.answers?.bolim?.choice || '—';
      const foyd = r.drex?.answers?.foydali?.noul;
      const til = r.drex?.answers?.til?.choice || '—';
      L.push(`| ${r.rel} | ${pct(top?.confidence)} | ${bolim} | ${typeof foyd === 'number' ? pct(foyd) : '—'} | ${til} | ${r.matn?.pages ?? '—'} | ${r.matn?.fayl || '—'}${r.matn?.kesilgan ? ' (kesilgan)' : ''} |`);
    }
    L.push('');
  }
  if (failed.length) {
    L.push('## Xatolar', '');
    for (const r of failed) L.push(`- ${r.rel}: ${r.xato}${r.doimiy ? ' (doimiy — faqat --qayta bilan qayta uriniladi)' : ''}`);
    L.push('');
  }
  if (waiting.length) {
    L.push('## Tugallanmagan (keyingi ishga tushirishda davom etadi)', '');
    for (const r of waiting) L.push(`- ${r.rel}: ${r.kutilmoqda ? `${r.kutilmoqda.bosqich} (job ${r.kutilmoqda.job_id})` : r.holat}`);
    L.push('');
  }
  L.push('## Drex bo\'limlari bo\'yicha (skil uchun)', '');
  const withDrex = done.filter((r) => r.drex?.answers);
  L.push(`Drex javobi bor fayllar: ${withDrex.length} / ${done.length}${done.length - withDrex.length ? ` (${done.length - withDrex.length} tasida Drex xatosi — keyingi ishga tushirishda qayta so'raladi)` : ''}`, '');
  const byBolim = new Map();
  for (const r of withDrex) {
    const b = r.drex.answers?.bolim?.choice || 'javobsiz';
    if (!byBolim.has(b)) byBolim.set(b, []);
    byBolim.get(b).push(r);
  }
  for (const [b, list] of byBolim) {
    const useful = list.filter((r) => (r.drex?.answers?.foydali?.noul ?? 0) >= 0.5);
    L.push(`- **${b}**: ${list.length} ta fayl, shundan foydali deb topilgani ${useful.length}: ${useful.slice(0, 40).map((r) => r.rel).join(', ')}${useful.length > 40 ? ', …' : ''}`);
  }
  L.push('');
  return L.join('\n');
}

function buildUnsupported(unsupported) {
  const L = ['# Qo\'llab-quvvatlanmagan fayllar', '', 'nace.ai bu formatlarni o\'qimaydi (masalan CorelDRAW .cdr). Nomlari skil uchun baribir foydali: maket nomlari mahsulot turlari va o\'lchamlarini ko\'rsatadi. .cdr maketlarni PDF yoki PNG qilib eksport qilsangiz, ular ham saralanadi.', ''];
  const byExt = new Map();
  for (const u of unsupported) {
    const k = u.sabab === 'format' ? u.ext || '(kengaytmasiz)' : `(${u.sabab})`;
    if (!byExt.has(k)) byExt.set(k, []);
    byExt.get(k).push(u);
  }
  for (const [k, list] of [...byExt].sort((a, b) => b[1].length - a[1].length)) {
    L.push(`## ${k} (${list.length})`, '');
    for (const u of list.sort((a, b) => a.abs.localeCompare(b.abs))) L.push(`- ${u.abs} (${(u.size / 1024).toFixed(0)} KB)`);
    L.push('');
  }
  return L.join('\n');
}

// ---------- asosiy ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const roots = args.papkalar.map((p) => path.resolve(p));
  for (const r of roots) {
    if (!fs.existsSync(r)) { console.error(`Papka topilmadi: ${r}`); process.exit(2); }
    if (isInside(r, args.chiqish)) { console.error(`--papka (${r}) --chiqish (${args.chiqish}) ichida bo'lishi mumkin emas.`); process.exit(2); }
  }
  await fsp.mkdir(args.chiqish, { recursive: true });

  const files = [];
  const unsupported = [];
  for (const r of roots) await walk(r, files, unsupported, args.chiqish);
  files.sort((a, b) => a.abs.localeCompare(b.abs));
  const sources = await readSources(args.manbalar);

  // Har bir faylga takrorlanmas kalit: <papka nomi>/<nisbiy yo'l>; to'qnashsa ~2, ~3
  const rootPrefix = (abs) => {
    const i = roots.findIndex((r) => isInside(abs, r));
    const root = roots[i < 0 ? 0 : i];
    const rel = safeRel(path.relative(root, abs));
    // Kalit papkalar soniga bog'liq bo'lmasin (keyingi safar boshqa to'plam bilan ishga tushirilsa ham qayta yuklanmasin)
    return `${safeSeg(path.basename(root) || root.replace(/[^A-Za-z0-9]/g, '') || 'papka')}/${rel}`;
  };
  const used = new Set();
  const uniq = (rel) => { let r = rel, n = 2; while (used.has(norm(r))) r = `${rel}~${n++}`; used.add(norm(r)); return r; };
  const seenAbs = new Set();
  const items = [];
  for (const f of files) { const k = norm(f.abs); if (seenAbs.has(k)) continue; seenAbs.add(k); items.push({ ...f, rel: uniq(rootPrefix(f.abs)), isUrl: false }); }
  for (const u of sources) items.push({ ...u, abs: u.url, ext: u.fileNameCol ? path.posix.extname(u.fileNameCol.toLowerCase()) : urlExt(u.url), size: 0, mtime: 0, name: u.fileNameCol || urlBase(u.url), rel: uniq(u.rel), isUrl: true });

  console.log(`Topildi: ${files.length} ta o'qiladigan fayl, ${unsupported.length} ta o'qilmaydigan (cdr va h.k.), ${sources.length} ta internet havolasi.`);
  const byExt = {};
  for (const f of files) byExt[f.ext] = (byExt[f.ext] || 0) + 1;
  for (const u of unsupported) byExt[u.ext || '?'] = (byExt[u.ext || '?'] || 0) + 1;
  console.log('Kengaytmalar: ' + (Object.entries(byExt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '—'));
  console.log(`Umumiy hajm (o'qiladiganlar): ${(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB`);
  await fsp.writeFile(path.join(args.chiqish, 'qollab-quvvatlanmagan.md'), buildUnsupported(unsupported));

  if (args.sinov) {
    const list = items.map((f) => `${f.rel}\t${f.isUrl ? f.url : `${(f.size / 1024).toFixed(0)} KB`}`).join('\n');
    await fsp.writeFile(path.join(args.chiqish, 'sinov-royxat.txt'), list);
    console.log(`Sinov rejimi: API chaqirilmadi. Ro'yxat: ${path.join(args.chiqish, 'sinov-royxat.txt')}`);
    return;
  }

  const { key, baseUrl: keyBase } = readKey(args.kalitFayl);
  if (!key) { console.error('API kalit topilmadi. nace-kalit-ulash.cmd ni ishga tushiring yoki NACE_API_KEY muhit o\'zgaruvchisini bering.'); process.exit(3); }
  if (!/^nace_sk_/.test(key)) console.warn('Diqqat: kalit nace_sk_ bilan boshlanmaydi — tekshirib ko\'ring.');
  const baseUrl = args.baseUrl || keyBase || 'https://console.nace.ai';
  const logFile = path.join(args.chiqish, 'log.txt');
  const log = (m) => { const line = `[${nowIso()}] ${m}`; console.log(line); try { fs.appendFileSync(logFile, line + '\n'); } catch {} };
  const client = makeClient({ baseUrl, key, log, kutishMs: args.kutishMin * 60_000 });

  try { await client.ping(); } catch (e) {
    if (e.code === 'unauthorized') { console.error(e.message); process.exit(4); }
    log(`Ogohlantirish: kalitni tekshirib bo'lmadi (${e.message}); davom etamiz.`);
  }

  const stateFile = path.join(args.chiqish, 'holat.json');
  const state = await loadState(stateFile);
  state.fayllar ||= {};
  const matnDir = path.join(args.chiqish, 'matn');
  await fsp.mkdir(matnDir, { recursive: true });

  // O'chirilgan mahalliy fayllar (faqat hozirgi papkalar ichidagilar)
  const itemKeys = new Set(items.map((f) => f.rel));
  for (const rec of Object.values(state.fayllar)) {
    if (rec.url || itemKeys.has(rec.rel)) continue;
    if (rec.abs && roots.some((r) => isInside(rec.abs, r)) && !fs.existsSync(rec.abs) && rec.holat !== 'ochirilgan') { rec.holat = 'ochirilgan'; rec.tugadi = nowIso(); }
  }

  const changed = (f, rec) => !f.isUrl && (rec.size !== f.size || (rec.mtime ?? null) !== f.mtime);
  let todo = items.filter((f) => {
    const rec = state.fayllar[f.rel];
    if (!rec) return true;
    if (args.qayta) return true;
    if (rec.holat === 'tayyor') return changed(f, rec);
    if (rec.holat === 'xato' && rec.doimiy) return changed(f, rec); // doimiy xato: faqat --qayta yoki fayl o'zgarsa
    return true;
  });
  if (args.limit > 0) todo = todo.slice(0, args.limit);
  log(`Ishlanadi: ${todo.length} ta fayl (parallel ${args.parallel}, rejim ${args.rejim}, parse ${args.parse ? 'ha' : 'yo\'q'}, drex ${args.drex ? args.drexModel : 'yo\'q'}${args.qayta ? `, qayta: ${args.qayta}` : ''}).`);

  let drexModel = args.drexModel;
  let drexFallbackTried = false;
  let stop = false;
  let stopCode = 0;
  let retryStreak = 0;
  let done = 0;

  const writeReports = () => enqueue(async () => {
    await writeAtomic(path.join(args.chiqish, 'index.json'), JSON.stringify(buildIndex(state), null, 2));
    await writeAtomic(path.join(args.chiqish, 'saralash-natija.md'), buildSummary(state, unsupported, args));
  });

  async function one(f) {
    let rec = state.fayllar[f.rel];
    let ran = false;
    if (!rec) { rec = { rel: f.rel, abs: f.isUrl ? undefined : f.abs, url: f.isUrl ? f.url : undefined, ext: f.ext, size: f.size, mtime: f.mtime }; state.fayllar[f.rel] = rec; }
    const reset = (bosqichlar) => { for (const b of bosqichlar) delete rec[b]; delete rec.kutilmoqda; delete rec.drexXato; delete rec.doimiy; };
    if (changed(f, rec)) { reset(['src', 'toifa', 'matn', 'drex']); rec.size = f.size; rec.mtime = f.mtime; rec.abs = f.abs; log(`O'zgargan fayl, qaytadan: ${f.rel}`); }
    else if (args.qayta === 'hammasi' || args.qayta === 'toifa') reset(['toifa', 'matn', 'drex']);
    else if (args.qayta === 'matn') reset(['matn', 'drex']);
    else if (args.qayta === 'drex') reset(['drex']);
    if (rec.matn && rec.matn.rejim && rec.matn.rejim !== args.rejim && !args.qayta) log(`Eslatma: ${f.rel} matni "${rec.matn.rejim}" rejimida olingan; "${args.rejim}" uchun --qayta matn bering.`);
    rec.holat = 'jarayonda';
    rec.boshlandi = nowIso();
    rec.xato = undefined;

    // Bosqichni ishga tushirish: yarim qolgan job bo'lsa avval uni so'raymiz, keyin kerak bo'lsa yangisini yuboramiz
    async function stage(bosqich, kind, body, collect) {
      if (stop) throw new NaceError(0, 'stopped', 'to\'xtatildi');
      let job = null;
      const k = rec.kutilmoqda;
      if (k && k.bosqich === bosqich && k.rejim === args.rejim && k.job_id) {
        try { job = await client.getJob(k.job_id); } catch (e) { if (e.status === 404 || e.status === 410) job = null; else throw e; }
        if (job && (job.status === 'failed' || job.status === 'cancelled' || (job.status === 'succeeded' && job.result_state && job.result_state !== 'available'))) job = null;
        if (job) log(`Davom: ${f.rel} ${bosqich} (job ${k.job_id}, ${job.status})`);
      }
      if (!job) {
        job = await client.submit(kind, body);
        rec.kutilmoqda = { bosqich, job_id: job?.job_id || job?.id, rejim: args.rejim, boshlandi: nowIso() };
        await saveState(stateFile, state);
      }
      job = client.assertSucceeded(await client.waitJob(job, bosqich), bosqich);
      const out = await collect(job);
      delete rec.kutilmoqda;
      ran = true;
      return out;
    }

    try {
      if (f.isUrl) {
        let fileName = f.fileNameCol || '';
        if (!fileName) {
          let ext = urlExt(f.url);
          if (!ext) { ext = await client.headExt(f.url) || '.html'; }
          fileName = urlBase(f.url) + ext;
        }
        rec.src = { type: 'url', url: f.url, file_name: fileName };
        rec.ext = path.posix.extname(fileName.toLowerCase());
      } else if (!rec.src) {
        if (stop) throw new NaceError(0, 'stopped', 'to\'xtatildi');
        rec.src = await client.upload(f.abs, 'pack24/' + f.rel, f.size);
        ran = true;
        await saveState(stateFile, state);
      }
      if (!rec.toifa) {
        rec.toifa = await stage('toifa', 'classify', client.classifyBody(rec.src), (job) => client.classifyResult(job));
        await saveState(stateFile, state);
      }
      if (args.parse && !NO_PARSE.has(rec.ext) && !rec.matn) {
        const p = await stage('matn', 'parse', client.parseBody(rec.src, args.rejim), (job) => client.parseResult(job, args.rejim));
        const mdName = f.rel + '.md'; // kengaytma saqlanadi: Narx.pdf.md va Narx.xlsx.md bir-birini yozmaydi
        const mdPath = path.join(matnDir, mdName);
        await fsp.mkdir(path.dirname(mdPath), { recursive: true });
        const head = `---\nfayl: ${f.isUrl ? f.url : f.abs}\ntoifa: ${rec.toifa?.unknown ? 'nomalum' : (rec.toifa?.labels?.[0]?.id || 'nomalum')}\nsahifa: ${p.pages ?? ''}\nlane: ${p.lane ?? ''}\nrejim: ${p.rejim}\nkesilgan: ${p.kesilgan}\n---\n\n`;
        await fsp.writeFile(mdPath, head + p.markdown, 'utf8');
        rec.matn = { fayl: toPosix(path.join('matn', mdName)), pages: p.pages, lane: p.lane, units: p.units, ocr: p.ocr, kesilgan: p.kesilgan, belgilar: p.markdown.length, job_id: p.job_id, rejim: p.rejim };
        await saveState(stateFile, state);
      }
      if (args.drex && !rec.drex) {
        if (stop) throw new NaceError(0, 'stopped', 'to\'xtatildi');
        let text = '';
        if (rec.matn?.fayl) { try { text = await fsp.readFile(path.join(args.chiqish, rec.matn.fayl), 'utf8'); text = text.replace(/^---[\s\S]*?---\n\n/, ''); } catch {} }
        const top = rec.toifa?.labels?.[0];
        const stateText = `File name: ${f.rel}\nClassifier: ${top ? `${top.id} (${pct(top.confidence)})` : 'unknown'}${top?.reason ? ' — ' + top.reason : ''}\n\nContent:\n${trunc(text, 6000)}`;
        let used = drexModel;
        const ask = async () => { used = drexModel; const ans = await client.drex(used, stateText, DREX_QUESTIONS); rec.drex = { model: ans.model || used, answers: ans.answers || {}, usage: ans.usage || null }; delete rec.drexXato; ran = true; };
        const modelRejected = (e) => e.status === 400 || e.status === 404 || e.status === 422;
        try { await ask(); } catch (e) {
          if (isFatal(e) || isTransient(e)) throw e; // tashqi catch: fayl xato, kerak bo'lsa butun ish to'xtaydi
          let retry = false;
          if (modelRejected(e) && used !== drexModel) retry = true; // boshqa ishchi modelni allaqachon almashtirgan
          else if (modelRejected(e) && !drexFallbackTried && drexModel !== 'drex-v1.0') {
            drexFallbackTried = true;
            log(`Drex modeli "${drexModel}" qabul qilinmadi (${e.message}); drex-v1.0 bilan urinib ko'ramiz.`);
            drexModel = 'drex-v1.0';
            retry = true;
          }
          if (retry) {
            try { await ask(); } catch (e2) { if (isFatal(e2) || isTransient(e2)) throw e2; rec.drexXato = e2.message; log(`Drex xatosi (${f.rel}): ${e2.message}; fayl Drex javobisiz saqlanadi.`); }
          } else { rec.drexXato = e.message; log(`Drex xatosi (${f.rel}): ${e.message}; fayl Drex javobisiz saqlanadi.`); }
        }
        await saveState(stateFile, state);
      }
      rec.holat = 'tayyor';
      rec.tugadi = nowIso();
      retryStreak = 0;
      done++;
      const top = rec.toifa?.labels?.[0];
      log(`${ran ? 'OK' : 'O\'zgarmadi'} ${done}/${todo.length}: ${f.rel} → ${rec.toifa?.unknown ? 'nomalum' : (top?.id || 'nomalum')} (${pct(top?.confidence)})${rec.matn ? `, ${rec.matn.pages ?? '?'} sahifa${rec.matn.kesilgan ? ', kesilgan' : ''}` : ''}${rec.drexXato ? ', Drex yo\'q' : ''}`);
    } catch (e) {
      rec.tugadi = nowIso();
      if (e.code === 'timeout') { rec.holat = 'kutilmoqda'; rec.xato = e.message; log(`KUTILMOQDA ${f.rel}: ${e.message}`); }
      else if (e.code === 'stopped') { rec.holat = 'kutilmoqda'; }
      else {
        rec.holat = 'xato';
        rec.xato = e.message;
        rec.xato_kodi = e.code || null;
        rec.doimiy = !!(e.doimiy || e.status === 413 || e.status === 422 || e.code === 'corrupt_file' || e.code === 'unsupported_file_type' || e.code === 'invalid_request');
        if (isFatal(e)) { stop = true; stopCode = 4; log(`TO'XTATILDI: ${e.message}`); }
        else if (e.status === 429 && (e.retryAfter > MAX_RETRY_WAIT || isBilling(e))) { stop = true; stopCode = 5; log(`TO'XTATILDI: ${e.message}${e.retryAfter ? ` — ${Math.ceil(e.retryAfter / 60)} daqiqadan keyin qayta ishga tushiring` : ''}`); }
        else if (isTransient(e)) { retryStreak++; log(`XATO ${f.rel}: ${e.message}`); if (retryStreak >= 3) { stop = true; stopCode = 5; log('TO\'XTATILDI: ketma-ket 3 ta fayl nace.ai javob bermagani uchun tugamadi; keyinroq qayta ishga tushiring.'); } }
        else log(`XATO ${f.rel}: ${e.message}${rec.doimiy ? ' (doimiy)' : ''}`);
      }
    }
    await saveState(stateFile, state);
    writeReports();
  }

  let idx = 0;
  async function worker() {
    while (!stop && idx < todo.length) await one(todo[idx++]);
  }
  await Promise.all(Array.from({ length: Math.min(args.parallel, Math.max(1, todo.length)) }, worker));
  await saveState(stateFile, state);
  await writeReports();
  const all = buildIndex(state);
  const ok = all.filter((r) => r.holat === 'tayyor').length;
  const bad = all.filter((r) => r.holat === 'xato').length;
  const wait = all.filter((r) => r.holat === 'kutilmoqda').length;
  log(`Tugadi. Tayyor: ${ok}, xato: ${bad}, kutilmoqda: ${wait}. Hisobot: ${path.join(args.chiqish, 'saralash-natija.md')}`);
  if (stop) process.exit(stopCode || 1);
  if (bad) process.exit(1);
}

main().catch((e) => { console.error(`Kutilmagan xato: ${e.stack || e.message}`); process.exit(1); });
