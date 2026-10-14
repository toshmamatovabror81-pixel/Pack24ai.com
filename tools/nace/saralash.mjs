#!/usr/bin/env node
// Pack24 — qadoqlashga oid fayllarni nace.ai orqali saralash.
//
// Nima qiladi: berilgan papkalardagi hujjatlarni (PDF, Excel, Word, rasm, ...) nace.ai
// Document Intelligence (NDI) ga yuklaydi, har birini toifalaydi (classify), matnini
// Markdown ko'rinishida oladi (parse) va Drex qaror modelidan "bu hujjat pack24.uz
// skili uchun foydalimi, qaysi bo'limga tegishli, qaysi tilda" deb so'raydi.
// Natija: <chiqish>/index.json, <chiqish>/saralash-natija.md, <chiqish>/matn/*.md,
// <chiqish>/qollab-quvvatlanmagan.md (CorelDRAW .cdr va boshqa o'qilmaydigan fayllar).
//
// Ishga tushirish (Node 18+; tashqi kutubxona kerak emas):
//   node tools/nace/saralash.mjs --papka "E:\\Qadoqlash" --chiqish "E:\\PACK24.uz\\nace-natija"
//   node tools/nace/saralash.mjs --papka "E:\\Qadoqlash" --sinov          # faqat ro'yxat, API chaqirilmaydi
//   node tools/nace/saralash.mjs --papka "E:\\Qadoqlash" --limit 5        # avval 5 ta fayl bilan sinab ko'rish
//   node tools/nace/saralash.mjs --manbalar tools/nace/manbalar.txt       # internetdagi havolalar (PDF/HTML) — yuklamasdan, to'g'ridan-to'g'ri URL orqali
// API kalit: NACE_API_KEY muhit o'zgaruvchisi yoki %USERPROFILE%\.nace\config.toml (api_key = "nace_sk_...").
// Qayta ishga tushirilsa, tugagan fayllar o'tkazib yuboriladi (holat.json).

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// ---------- sozlamalar ----------
const SUPPORTED = new Set([
  '.pdf', '.xlsx', '.xlsm', '.xls', '.csv', '.docx', '.doc', '.docm', '.pptx', '.ppt',
  '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.webp', '.bmp', '.html', '.htm', '.txt', '.log',
  '.xml', '.md', '.mdx', '.json', '.vsdx', '.vsd', '.eml', '.msg', '.oft',
]);
const NO_PARSE = new Set(['.bmp']); // nace.ai: bmp uchun parse yo'q
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'nace-natija', '$RECYCLE.BIN', 'System Volume Information']);
const MAX_BYTES = 256 * 1024 * 1024; // bitta so'rovda yuklash chegarasi (chunked upload qilinmaydi)

// Toifalar (classify). id da '/' bo'lmasin; 'other' zaxira id — biz uni ishlatmaymiz.
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
function parseArgs(argv) {
  const a = {
    papkalar: [], manbalar: [], chiqish: path.resolve('nace-natija'), sinov: false, limit: 0, parallel: 2,
    rejim: 'low', parse: true, drex: true, drexModel: 'drex-latest', baseUrl: '', qayta: false, kalitFayl: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--papka') a.papkalar.push(v());
    else if (k === '--manbalar') a.manbalar.push(v());
    else if (k === '--chiqish') a.chiqish = path.resolve(v());
    else if (k === '--sinov') a.sinov = true;
    else if (k === '--limit') a.limit = Number(v()) || 0;
    else if (k === '--parallel') a.parallel = Math.max(1, Math.min(8, Number(v()) || 2));
    else if (k === '--rejim') a.rejim = v();
    else if (k === '--parse') a.parse = v() !== 'yoq';
    else if (k === '--drex') { const x = v(); a.drex = x !== 'yoq'; if (x && x !== 'ha' && x !== 'yoq') a.drexModel = x; }
    else if (k === '--base-url') a.baseUrl = v().replace(/\/+$/, '');
    else if (k === '--qayta') a.qayta = true;
    else if (k === '--kalit-fayl') a.kalitFayl = v();
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
  --manbalar <fayl>  internet havolalari ro'yxati: har qatorda bitta URL, ixtiyoriy " | nom" (# bilan izoh)
  --sinov            faqat fayllar ro'yxatini chiqaradi, API chaqirilmaydi (bepul)
  --limit N          faqat birinchi N ta faylni ishlaydi (sinov uchun)
  --parallel N       bir vaqtda nechta fayl (1-8, odatda 2)
  --rejim low|medium|high   parse sifati (low eng arzon)
  --parse yoq        matnni olmaslik (faqat toifalash)
  --drex yoq | <model>      Drex savollarini o'chirish yoki model nomi (odatda drex-latest)
  --qayta            tugagan fayllarni ham qaytadan ishlash
  --kalit-fayl <yo'l>       kalit yozilgan fayl (odatda ~/.nace/config.toml)
  --base-url <url>   API manzili (odatda https://console.nace.ai)`);
}

// ---------- kalit ----------
function readKey(kalitFayl) {
  const env = (process.env.NACE_API_KEY || '').trim();
  if (env) return { key: env, baseUrl: (process.env.NACE_BASE_URL || '').trim() };
  const f = kalitFayl || path.join(os.homedir(), '.nace', 'config.toml');
  if (!fs.existsSync(f)) return { key: '', baseUrl: '' };
  const txt = fs.readFileSync(f, 'utf8');
  const key = /^\s*api_key\s*=\s*"([^"]+)"/m.exec(txt)?.[1]?.trim() || '';
  const baseUrl = /^\s*base_url\s*=\s*"([^"]+)"/m.exec(txt)?.[1]?.trim() || '';
  return { key, baseUrl };
}

// ---------- yordamchilar ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
function toPosix(p) { return p.split(path.sep).join('/'); }
function safeRel(rel) { return toPosix(rel).replace(/^\/+/, '').replace(/[\\:*?"<>|]/g, '_'); }
function trunc(s, n) { return s.length > n ? s.slice(0, n) + '\n…' : s; }

class NaceError extends Error {
  constructor(status, code, message, body) { super(message); this.status = status; this.code = code; this.body = body; }
}

function makeClient({ baseUrl, key }) {
  async function request(method, url, { json, form, headers = {}, auth = true, raw = false } = {}, tries = 4) {
    const h = { ...headers };
    if (auth) h['Authorization'] = `Bearer ${key}`;
    let body;
    if (json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form;
    let lastErr;
    for (let t = 1; t <= tries; t++) {
      let res;
      try {
        res = await fetch(url, { method, headers: h, body, redirect: 'follow' });
      } catch (e) {
        lastErr = new NaceError(0, 'network', `Tarmoq xatosi: ${e.message}`);
        if (t < tries) { await sleep(2000 * 2 ** (t - 1)); continue; }
        throw lastErr;
      }
      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        const ra = Number(res.headers.get('retry-after')) || 0;
        lastErr = new NaceError(res.status, 'retry', `HTTP ${res.status}`);
        if (t < tries) { await sleep(ra ? ra * 1000 : 2000 * 2 ** (t - 1)); continue; }
        throw lastErr;
      }
      if (raw) return res;
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (res.status === 401 || res.status === 403) {
        throw new NaceError(res.status, 'unauthorized', 'API kalit noto\'g\'ri yoki ruxsat yo\'q (401/403). nace-kalit-ulash.cmd bilan qayta kiriting.');
      }
      if (res.status >= 400) {
        const code = data?.error?.code || data?.code || `http_${res.status}`;
        const msg = data?.error?.message || data?.message || text.slice(0, 300);
        throw new NaceError(res.status, code, `${code}: ${msg}`, data);
      }
      return { status: res.status, data, text, res };
    }
    throw lastErr;
  }

  const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);

  async function waitJob(first, label) {
    let job = first;
    const start = Date.now();
    let delay = 1000;
    while (true) {
      const status = job?.status;
      if (status && TERMINAL.has(status)) return job;
      const id = job?.job_id || job?.id;
      if (!id) throw new NaceError(0, 'no_job_id', `${label}: javobda job_id yo'q: ${JSON.stringify(job).slice(0, 200)}`);
      if (Date.now() - start > 600_000) throw new NaceError(0, 'timeout', `${label}: ish 10 daqiqada tugamadi (job ${id})`);
      await sleep(delay);
      delay = Math.min(10_000, delay * 1.6);
      const r = await request('GET', `${baseUrl}/v1/documents/jobs/${encodeURIComponent(id)}`);
      job = r.data;
    }
  }

  function assertSucceeded(job, label) {
    if (job.status !== 'succeeded') {
      const e = job.error || {};
      throw new NaceError(0, e.code || job.status, `${label}: ${e.code || job.status}${e.message ? ' — ' + e.message : ''}`);
    }
    return job;
  }

  async function upload(absPath, relPosix, size) {
    const grant = await request('POST', `${baseUrl}/v1/documents/upload-grants`, {
      json: { path: relPosix, ttl_seconds: 3600 },
    });
    const { upload_url, token, workspace_id } = grant.data || {};
    if (!upload_url || !token) throw new NaceError(0, 'bad_grant', `upload-grant javobi kutilmagan: ${grant.text.slice(0, 200)}`);
    const buf = await fsp.readFile(absPath);
    const form = new FormData();
    form.append('file', new Blob([buf]), path.basename(absPath));
    const meta = { path: relPosix, on_conflict: 'new_version' };
    if (size >= 32 * 1024 * 1024) meta.total_size_bytes = size;
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }), 'metadata.json');
    const up = await request('POST', upload_url, { form, headers: { 'X-Upload-Token': token }, auth: false });
    const job = assertSucceeded(await waitJob(up.data, 'yuklash'), 'yuklash');
    const file = job.result?.file || job.result?.files?.[0] || job.file;
    const ws = file?.workspace_id || workspace_id;
    const fid = file?.file_id || file?.id;
    if (!ws || !fid) throw new NaceError(0, 'bad_upload', `yuklash javobida file_id yo'q: ${JSON.stringify(job).slice(0, 300)}`);
    return { workspace_id: ws, file_id: fid, deduplicated: !!job.result?.deduplicated };
  }

  async function classify(source) {
    const r = await request('POST', `${baseUrl}/v1/documents/classify?wait_seconds=60`, {
      json: {
        source,
        classes: CLASSES.map(({ id, label, description }) => ({ id, label, description })),
        granularity: 'document',
        unknown_policy: 'allow',
        output: { max_alternatives: 3, include_reason: true },
      },
    });
    const job = assertSucceeded(await waitJob(r.data, 'toifalash'), 'toifalash');
    const unit = job.result?.units?.[0] || {};
    const labels = (unit.labels || []).map((l) => ({ id: l.class_id, label: l.label, confidence: l.confidence, reason: l.reason }));
    const billed = typeof job.result?.units_billed === 'number' ? job.result.units_billed : null; // classify'da result.units — hujjatlar ro'yxati, hisob birligi emas
    return { unknown: !!unit.unknown, labels, units: billed, job_id: job.job_id };
  }

  async function parse(source, rejim) {
    const r = await request('POST', `${baseUrl}/v1/documents/parse?wait_seconds=60`, {
      json: {
        source,
        parse_mode: rejim,
        output: { formats: ['markdown'], table_format: 'html', include_page_markers: true },
        figures: { mode: 'omit' },
      },
    });
    const job = assertSucceeded(await waitJob(r.data, 'matn olish'), 'matn olish');
    const doc = job.result?.document || {};
    let markdown = doc.markdown || '';
    const truncated = (job.result?.disclosures || []).some((d) => d.code === 'content_truncated');
    if (truncated && doc.content_url) {
      markdown = await fetchFull(doc.content_url);
    }
    return { markdown, pages: doc.page_count ?? null, lane: job.result?.lane || null, units: job.result?.units ?? null, ocr: !!job.result?.ocr_applied, job_id: job.job_id };
  }

  // To'liq matn: avval redirect=false bilan imzolangan havolani olamiz, keyin kalitsiz yuklaymiz.
  async function fetchFull(contentUrl) {
    const u = contentUrl + (contentUrl.includes('?') ? '&' : '?') + 'redirect=false';
    for (let t = 0; t < 20; t++) {
      const r = await request('GET', u);
      if (r.status === 202) { await sleep((Number(r.data?.retry_after_seconds) || 3) * 1000); continue; }
      const signed = r.data?.url;
      if (!signed) return r.text; // ba'zi javoblar matnni bevosita qaytarishi mumkin
      const res = await request('GET', signed, { auth: false, raw: true });
      return await res.text();
    }
    throw new NaceError(0, 'content_pending', 'To\'liq matn tayyor bo\'lmadi');
  }

  async function drex(model, state, questions) {
    const r = await request('POST', `${baseUrl}/v1/systemone`, { json: { model, state, questions } });
    return r.data;
  }

  async function ping() {
    // Kalitni tekshirish uchun arzon so'rov (ishlar ro'yxati).
    const r = await request('GET', `${baseUrl}/v1/documents/jobs?limit=1`);
    return r.status;
  }

  return { upload, classify, parse, drex, ping };
}

// ---------- fayllarni topish ----------
async function walk(root, out, unsupported) {
  let entries;
  try { entries = await fsp.readdir(root, { withFileTypes: true }); } catch (e) { console.warn(`O'qib bo'lmadi: ${root} (${e.message})`); return; }
  for (const ent of entries) {
    const abs = path.join(root, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name) || ent.name.startsWith('.')) continue;
      await walk(abs, out, unsupported);
    } else if (ent.isFile()) {
      if (ent.name.startsWith('~$') || ent.name.startsWith('.')) continue; // Office lock fayllari
      const ext = path.extname(ent.name).toLowerCase();
      let size = 0;
      try { size = (await fsp.stat(abs)).size; } catch { continue; }
      const item = { abs, ext, size, name: ent.name };
      if (SUPPORTED.has(ext) && size > 0 && size <= MAX_BYTES) out.push(item);
      else unsupported.push({ ...item, sabab: !SUPPORTED.has(ext) ? 'format' : size === 0 ? 'bo\'sh' : 'juda katta' });
    }
  }
}

// ---------- internet havolalari ----------
// Fayl formati: har qatorda "https://... | ixtiyoriy nom"; '#' bilan boshlangan qatorlar izoh.
async function readSources(files) {
  const out = [];
  const seen = new Set();
  for (const f of files) {
    let txt;
    try { txt = await fsp.readFile(f, 'utf8'); } catch (e) { console.error(`Manbalar fayli o'qilmadi: ${f} (${e.message})`); process.exit(2); }
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const [urlPart, ...rest] = line.split('|');
      const url = urlPart.trim();
      if (!/^https?:\/\//i.test(url)) { console.warn(`O'tkazib yuborildi (URL emas): ${line}`); continue; }
      if (seen.has(url)) continue;
      seen.add(url);
      const nom = rest.join('|').trim();
      out.push({ url, nom, rel: urlRel(url, nom), fileName: urlFileName(url) });
    }
  }
  return out;
}
function urlExt(url) {
  try {
    const p = new URL(url).pathname.toLowerCase();
    const ext = path.posix.extname(p);
    if (SUPPORTED.has(ext)) return ext;
  } catch {}
  return '.html';
}
function urlFileName(url) {
  const ext = urlExt(url);
  let base = 'sahifa';
  try { base = path.posix.basename(new URL(url).pathname) || 'sahifa'; } catch {}
  base = base.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'sahifa';
  return base + ext;
}
function urlRel(url, nom) {
  let host = 'internet';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  const name = (nom || urlFileName(url)).replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
  return `internet/${host}/${name}`;
}

// ---------- holat (resume) ----------
async function loadState(file) {
  try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return { boshlandi: nowIso(), fayllar: {} }; }
}
let saveChain = Promise.resolve();
function saveState(file, state) {
  saveChain = saveChain.then(async () => {
    const tmp = file + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(state, null, 2));
    await fsp.rename(tmp, file);
  }).catch((e) => console.warn(`holat.json yozilmadi: ${e.message}`));
  return saveChain;
}

// ---------- hisobot ----------
function classLabel(id) { return CLASSES.find((c) => c.id === id)?.label || id || '—'; }
function pct(x) { return typeof x === 'number' ? `${Math.round(x * 100)}%` : '—'; }

function buildIndex(state) {
  return Object.values(state.fayllar).sort((a, b) => a.rel.localeCompare(b.rel));
}

function buildSummary(state, unsupported, args) {
  const rows = buildIndex(state);
  const done = rows.filter((r) => r.holat === 'tayyor');
  const failed = rows.filter((r) => r.holat === 'xato');
  const byClass = new Map();
  for (const r of done) {
    const id = r.toifa?.labels?.[0]?.id || (r.toifa?.unknown ? 'nomalum' : 'nomalum');
    if (!byClass.has(id)) byClass.set(id, []);
    byClass.get(id).push(r);
  }
  const units = done.reduce((s, r) => s + (Number(r.toifa?.units) || 0) + (Number(r.matn?.units) || 0), 0);
  const drexTokens = done.reduce((s, r) => s + (Number(r.drex?.usage?.input_tokens) || 0) + (Number(r.drex?.usage?.output_tokens) || 0), 0);
  const L = [];
  L.push(`# Qadoqlash fayllari — nace.ai saralash natijasi`);
  L.push('');
  L.push(`Yangilandi: ${nowIso()}. Papkalar: ${args.papkalar.join('; ')}. Rejim: ${args.rejim}.`);
  L.push('');
  L.push(`- Ishlangan fayllar: ${done.length}`);
  L.push(`- Xato bilan tugagan: ${failed.length}`);
  L.push(`- Qo'llab-quvvatlanmagan (CorelDRAW .cdr va h.k.): ${unsupported.length} — qarang: qollab-quvvatlanmagan.md`);
  L.push(`- nace.ai birliklari (parse + classify units): ${units}; Drex tokenlari: ${drexTokens}`);
  L.push('');
  L.push('## Toifalar bo\'yicha');
  L.push('');
  const order = [...CLASSES.map((c) => c.id), 'nomalum'];
  for (const id of order) {
    const list = byClass.get(id);
    if (!list?.length) continue;
    L.push(`### ${classLabel(id)} (${list.length})`);
    L.push('');
    L.push('| Fayl | Ishonch | Drex: bo\'lim | Foydali | Til | Sahifa | Matn |');
    L.push('|---|---|---|---|---|---|---|');
    for (const r of list) {
      const top = r.toifa?.labels?.[0];
      const bolim = r.drex?.answers?.bolim?.choice || '—';
      const foyd = r.drex?.answers?.foydali?.noul;
      const til = r.drex?.answers?.til?.choice || '—';
      L.push(`| ${r.rel} | ${pct(top?.confidence)} | ${bolim} | ${typeof foyd === 'number' ? pct(foyd) : '—'} | ${til} | ${r.matn?.pages ?? '—'} | ${r.matn?.fayl ? r.matn.fayl : '—'} |`);
    }
    L.push('');
  }
  if (failed.length) {
    L.push('## Xatolar');
    L.push('');
    for (const r of failed) L.push(`- ${r.rel}: ${r.xato}`);
    L.push('');
  }
  L.push('## Drex bo\'limlari bo\'yicha (skil uchun)');
  L.push('');
  const byBolim = new Map();
  for (const r of done) {
    const b = r.drex?.answers?.bolim?.choice || 'drex_yoq';
    if (!byBolim.has(b)) byBolim.set(b, []);
    byBolim.get(b).push(r);
  }
  for (const [b, list] of byBolim) {
    const useful = list.filter((r) => (r.drex?.answers?.foydali?.noul ?? 1) >= 0.5);
    L.push(`- **${b}**: ${list.length} ta fayl, shundan foydali deb topilgani ${useful.length}: ${useful.slice(0, 40).map((r) => r.rel).join(', ')}${useful.length > 40 ? ', …' : ''}`);
  }
  L.push('');
  return L.join('\n');
}

function buildUnsupported(unsupported) {
  const L = ['# Qo\'llab-quvvatlanmagan fayllar', '', 'nace.ai bu formatlarni o\'qimaydi (masalan CorelDRAW .cdr). Nomlari skil uchun baribir foydali: maket nomlari mahsulot turlari va o\'lchamlarini ko\'rsatadi.', ''];
  const byExt = new Map();
  for (const u of unsupported) {
    const k = u.sabab === 'format' ? u.ext || '(kengaytmasiz)' : `(${u.sabab})`;
    if (!byExt.has(k)) byExt.set(k, []);
    byExt.get(k).push(u);
  }
  for (const [k, list] of [...byExt].sort((a, b) => b[1].length - a[1].length)) {
    L.push(`## ${k} (${list.length})`);
    L.push('');
    for (const u of list.sort((a, b) => a.abs.localeCompare(b.abs))) L.push(`- ${u.abs} (${(u.size / 1024).toFixed(0)} KB)`);
    L.push('');
  }
  return L.join('\n');
}

// ---------- asosiy ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const roots = args.papkalar.map((p) => path.resolve(p));
  for (const r of roots) if (!fs.existsSync(r)) { console.error(`Papka topilmadi: ${r}`); process.exit(2); }

  const files = [];
  const unsupported = [];
  for (const r of roots) await walk(r, files, unsupported);
  const sources = await readSources(args.manbalar);
  files.sort((a, b) => a.abs.localeCompare(b.abs));
  const relOf = (abs) => {
    const root = roots.find((r) => abs.startsWith(r + path.sep)) || roots[0];
    return safeRel(path.relative(root, abs));
  };

  console.log(`Topildi: ${files.length} ta o'qiladigan fayl, ${unsupported.length} ta o'qilmaydigan (cdr va h.k.), ${sources.length} ta internet havolasi.`);
  const byExt = {};
  for (const f of files) byExt[f.ext] = (byExt[f.ext] || 0) + 1;
  for (const u of unsupported) byExt[u.ext || '?'] = (byExt[u.ext || '?'] || 0) + 1;
  console.log('Kengaytmalar: ' + Object.entries(byExt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  const totalMB = files.reduce((s, f) => s + f.size, 0) / 1024 / 1024;
  console.log(`Umumiy hajm (o'qiladiganlar): ${totalMB.toFixed(1)} MB`);

  await fsp.mkdir(args.chiqish, { recursive: true });
  await fsp.writeFile(path.join(args.chiqish, 'qollab-quvvatlanmagan.md'), buildUnsupported(unsupported));

  if (args.sinov) {
    const list = files.map((f) => `${relOf(f.abs)}\t${(f.size / 1024).toFixed(0)} KB`).concat(sources.map((u) => `${u.rel}\t${u.url}`)).join('\n');
    await fsp.writeFile(path.join(args.chiqish, 'sinov-royxat.txt'), list);
    console.log(`Sinov rejimi: API chaqirilmadi. Ro'yxat: ${path.join(args.chiqish, 'sinov-royxat.txt')}`);
    return;
  }

  const { key, baseUrl: keyBase } = readKey(args.kalitFayl);
  if (!key) {
    console.error('API kalit topilmadi. nace-kalit-ulash.cmd ni ishga tushiring yoki NACE_API_KEY muhit o\'zgaruvchisini bering.');
    process.exit(3);
  }
  if (!/^nace_sk_/.test(key)) console.warn('Diqqat: kalit nace_sk_ bilan boshlanmaydi — tekshirib ko\'ring.');
  const baseUrl = args.baseUrl || keyBase || 'https://console.nace.ai';
  const log = (m) => { const line = `[${nowIso()}] ${m}`; console.log(line); fs.appendFileSync(path.join(args.chiqish, 'log.txt'), line + '\n'); };
  const client = makeClient({ baseUrl, key });

  try { await client.ping(); } catch (e) {
    if (e.code === 'unauthorized') { console.error(e.message); process.exit(3); }
    log(`Ogohlantirish: kalitni tekshirib bo'lmadi (${e.message}); davom etamiz.`);
  }

  const stateFile = path.join(args.chiqish, 'holat.json');
  const state = await loadState(stateFile);
  const matnDir = path.join(args.chiqish, 'matn');
  await fsp.mkdir(matnDir, { recursive: true });

  let todo = files.map((f) => ({ ...f, rel: relOf(f.abs) })).concat(sources.map((u) => ({ ...u, abs: u.url, ext: urlExt(u.url), size: 0, name: u.fileName, isUrl: true })));
  if (!args.qayta) todo = todo.filter((f) => state.fayllar[f.rel]?.holat !== 'tayyor');
  if (args.limit > 0) todo = todo.slice(0, args.limit);
  log(`Ishlanadi: ${todo.length} ta fayl (parallel ${args.parallel}, rejim ${args.rejim}, parse ${args.parse ? 'ha' : 'yo\'q'}, drex ${args.drex ? args.drexModel : 'yo\'q'}).`);

  let drexEnabled = args.drex;
  let drexModel = args.drexModel;
  let stop = false;
  let done = 0;

  async function one(f) {
    const rec = state.fayllar[f.rel] || { rel: f.rel, abs: f.abs, ext: f.ext, size: f.size, url: f.isUrl ? f.url : undefined };
    rec.holat = 'jarayonda';
    rec.boshlandi = nowIso();
    state.fayllar[f.rel] = rec;
    try {
      if (f.isUrl) rec.src = { type: 'url', url: f.url, file_name: f.fileName };
      else if (!rec.src) { const up = await client.upload(f.abs, 'pack24/' + f.rel, f.size); rec.src = { type: 'workspace_file', workspace_id: up.workspace_id, file_id: up.file_id }; await saveState(stateFile, state); }
      if (!rec.toifa) { rec.toifa = await client.classify(rec.src); await saveState(stateFile, state); }
      if (args.parse && !NO_PARSE.has(f.ext) && !rec.matn) {
        const p = await client.parse(rec.src, args.rejim);
        const mdName = f.rel.replace(/\.[^./\\]+$/, '') + '.md'; // faqat kengaytmani olib tashlaymiz
        const mdPath = path.join(matnDir, mdName);
        await fsp.mkdir(path.dirname(mdPath), { recursive: true });
        const head = `---\nfayl: ${f.isUrl ? f.url : f.abs}\ntoifa: ${rec.toifa?.labels?.[0]?.id || 'nomalum'}\nsahifa: ${p.pages ?? ''}\nlane: ${p.lane ?? ''}\n---\n\n`;
        await fsp.writeFile(mdPath, head + p.markdown, 'utf8');
        rec.matn = { fayl: toPosix(path.join('matn', mdName)), pages: p.pages, lane: p.lane, units: p.units, ocr: p.ocr, belgilar: p.markdown.length, job_id: p.job_id };
        await saveState(stateFile, state);
      }
      if (drexEnabled && !rec.drex) {
        let text = '';
        if (rec.matn?.fayl) { try { text = await fsp.readFile(path.join(args.chiqish, rec.matn.fayl), 'utf8'); text = text.replace(/^---[\s\S]*?---\n\n/, ''); } catch {} }
        const top = rec.toifa?.labels?.[0];
        const stateText = `File name: ${f.rel}\nClassifier: ${top ? `${top.id} (${pct(top.confidence)})` : 'unknown'}${top?.reason ? ' — ' + top.reason : ''}\n\nContent:\n${trunc(text, 6000)}`;
        try {
          const ans = await client.drex(drexModel, stateText, DREX_QUESTIONS);
          rec.drex = { model: ans.model || drexModel, answers: ans.answers || {}, usage: ans.usage || null };
        } catch (e) {
          if (drexModel !== 'drex-v1.0' && (e.status === 404 || e.status === 400 || e.status === 422) && /model/i.test(e.message)) {
            log(`Drex modeli "${drexModel}" qabul qilinmadi (${e.message}); drex-v1.0 bilan davom etamiz.`);
            drexModel = 'drex-v1.0';
            const ans = await client.drex(drexModel, stateText, DREX_QUESTIONS);
            rec.drex = { model: ans.model || drexModel, answers: ans.answers || {}, usage: ans.usage || null };
          } else if (e.code === 'unauthorized') { throw e; }
          else { log(`Drex xatosi (${f.rel}): ${e.message}; Drex o'chirildi, qolganlari faqat toifalanadi.`); drexEnabled = false; }
        }
        await saveState(stateFile, state);
      }
      rec.holat = 'tayyor';
      rec.xato = undefined;
      rec.tugadi = nowIso();
      done++;
      log(`OK ${done}/${todo.length}: ${f.rel} → ${rec.toifa?.labels?.[0]?.id || 'nomalum'} (${pct(rec.toifa?.labels?.[0]?.confidence)})${rec.matn ? `, ${rec.matn.pages ?? '?'} sahifa` : ''}`);
    } catch (e) {
      rec.holat = 'xato';
      rec.xato = e.message;
      rec.tugadi = nowIso();
      if (e.code === 'unauthorized' || e.code === 'insufficient_credit' || e.status === 402) { stop = true; log(`TO'XTATILDI: ${e.message}`); }
      else log(`XATO ${f.rel}: ${e.message}`);
    }
    await saveState(stateFile, state);
  }

  // oddiy ishchi havzasi
  let idx = 0;
  async function worker() {
    while (!stop && idx < todo.length) {
      const f = todo[idx++];
      await one(f);
      if (done % 10 === 0) await writeReports();
    }
  }
  async function writeReports() {
    await fsp.writeFile(path.join(args.chiqish, 'index.json'), JSON.stringify(buildIndex(state), null, 2));
    await fsp.writeFile(path.join(args.chiqish, 'saralash-natija.md'), buildSummary(state, unsupported, args));
  }
  await Promise.all(Array.from({ length: Math.min(args.parallel, Math.max(1, todo.length)) }, worker));
  await saveState(stateFile, state);
  await writeReports();
  const all = buildIndex(state);
  const ok = all.filter((r) => r.holat === 'tayyor').length;
  const bad = all.filter((r) => r.holat === 'xato').length;
  log(`Tugadi. Tayyor: ${ok}, xato: ${bad}. Hisobot: ${path.join(args.chiqish, 'saralash-natija.md')}`);
  if (stop) process.exit(4);
  if (bad) process.exit(1);
}

main().catch((e) => { console.error(`Kutilmagan xato: ${e.stack || e.message}`); process.exit(1); });
