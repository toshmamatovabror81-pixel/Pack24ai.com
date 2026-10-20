/**
 * Gofrokarton quti kalkulyatori (FEFCO 0201, to'rt klapanli quti) — sof funksiya, React va narxsiz.
 * Manba: pack24-qadoqlash skili (SKILL.md 7-bo'lim 1- va 3-retsept; mustahkamlik.md 2, 4.2; gofrokarton-va-gost.md 3-jadval;
 * narxlash-va-taklif.md 4-bo'lim). Natija taxminiy: aniq karton markasi va narxni menejer tasdiqlaydi.
 */

export type Storage = 'dry' | 'humid';

export type BoxInput = {
  /** Ichki uzunlik, mm (L >= W bo'lmasa almashtiriladi) */
  length: number;
  /** Ichki kenglik, mm */
  width: number;
  /** Ichki balandlik, mm */
  height: number;
  /** Bitta to'la quti og'irligi (brutto), kg */
  weightKg: number;
  /** Taxtdagi qutilar soni, eng pastkisi bilan */
  tiers: number;
  storage: Storage;
  /** Tiraj, dona */
  quantity: number;
};

export type BoxField = keyof BoxInput;
export type BoxError = { field: BoxField; code: 'invalid' | 'range' | 'integer' };

export type Flute = 'B' | 'C' | 'BE' | 'BC';
export type Construction = {
  layers: 3 | 5;
  flute: Flute;
  /** GOST R 52901-2007 markasi */
  grade: string;
  /** Markaning minimal ECT si, kN/m */
  ectMin: number;
  /** Karton qalinligi, mm (McKee dagi d) */
  thicknessMm: number;
};

export type BoxNote =
  | 'swapped' // L < W kiritilgan — almashtirildi
  | 'noStacking' // n = 1: taxt yuki yo'q, eng past marka
  | 'heavy' // og'ir quti — faqat 5 qatlam
  | 'humid' // nam ombor koeffitsiyenti qo'llandi
  | 'mckeeShort' // past quti: McKee aniqligi kam
  | 'ratioLW' // L/W > 2,5 (GOST 9142 tavsiyasi)
  | 'ratioHW' // H/W 0,5…2 dan tashqarida
  | 'tooHeavy' // 45 kg dan og'ir: GWP jadvali tugaydi — maslahat
  | 'oversize' // zagotovka gofroagregat/varaqqa sig'maydi — maslahat
  | 'consult'; // menejer maslahati kerak (marka yetmaydi, juda og'ir yoki juda katta)

export type BoxResult = {
  /** L >= W ga keltirilgan kirish */
  input: BoxInput;
  construction: Construction | null;
  /** Zagotovka (razvyortka), mm */
  blank: { lengthMm: number; widthMm: number };
  /** Tashqi o'lcham, mm (taxminiy: ichki + 2 qalinlik) */
  outer: { length: number; width: number; height: number };
  /** Bitta zagotovka maydoni, m² */
  areaM2: number;
  /** Tiraj uchun sof maydon, m² */
  netAreaM2: number;
  /** Chiqindi bilan jami maydon, m² */
  totalAreaM2: number;
  wastePct: number;
  /** GOST 9142-2014 bo'yicha talab qilinadigan siqilishga qarshilik P, N */
  loadN: number;
  /** Teskari McKee: tanlangan (yoki eng qalin) karton uchun kerakli ECT, kN/m (yuqoriga yaxlitlangan) */
  requiredEct: number;
  notes: BoxNote[];
};

export type BoxCalcOutcome = { ok: true; result: BoxResult } | { ok: false; errors: BoxError[] };

/** Chegaralar — saytdagi forma ham shularni ishlatadi */
export const LIMITS = {
  dim: { min: 50, max: 2500 },
  weight: { min: 0, max: 100 },
  tiers: { min: 1, max: 20 },
  quantity: { min: 1, max: 10_000_000 },
} as const;

// GOST 9142-2014 §4.1.4: P = 9,8·K·K₀·m·(n−1); K = 3,0, K₀ = 1,86 (75–80 % RH ombor), aks holda 1
export const GOST_K = 3.0;
export const K0_HUMID = 1.86;
// McKee konstantasi (soddalashtirilgan formula)
export const MCKEE = 5.87;
// Yelim klapani: GOST 9142 da 20–50 mm, Pack24 da 30–40 mm — o'rtacha 35 mm
export const GLUE_FLAP_MM = 35;
// Chiqindi: skil (narxlash-va-taklif.md) jami 8–15 % deydi — bitta qiymat 10 %
export const WASTE_PCT = 10;
// GWP tezkor jadvali: 3 qatlamli quti ~35 kg gacha; og'irrog'i faqat 5 qatlam
export const MAX_3LAYER_KG = 35;
// GWP 5 qatlam jadvali 45 kg da tugaydi — undan og'irini menejer ko'radi
export const MAX_TABLE_KG = 45;
// Gofroagregat eni 1000–2500 mm (ishlab-chiqarish.md 2-jadval) — 2500 dan ~100 mm qirqim (trim) chiqadi
export const MAX_BLANK_WIDTH_MM = 2400;
// Varaq uzunligi (FFG/shtamp) uchun skilda raqam yo'q — taxminiy chegara, oshsa ikki bo'lakli quti kerak
export const MAX_BLANK_LENGTH_MM = 3000;

// Qalinlik qo'shimchasi (SKILL.md 7.1): 3 qatlam uzunlikka 2(L+W)+59 → 35 klapan + 24; eniga +8; 5 qatlam +69 (35 + 34) va +16
const ALLOWANCE: Record<3 | 5, { length: number; width: number }> = {
  3: { length: 24, width: 8 },
  5: { length: 34, width: 16 },
};

// Qalinlik, mm — hisob uchun ehtiyotkor (pastki) qiymat: B ≈ 3, C 3,5–4 → 3,5, BE 4,4–4,6 → 4,4, BC 6–7 → 6
// (materiallar.md 2-jadval). Yupqaroq qalinlik kerakli ECT ni oshiradi — marka past tanlanmaydi
const THICKNESS: Record<Flute, number> = { B: 3, C: 3.5, BE: 4.4, BC: 6 };

// GOST R 52901-2007 ECT minimumlari, kN/m (gofrokarton-va-gost.md 3-jadval)
const T_GRADES: [string, number][] = [
  ['Т-21', 2.2],
  ['Т-22', 3.0],
  ['Т-23', 3.8],
  ['Т-24', 4.6],
  ['Т-25', 5.4],
  ['Т-26', 6.2],
  ['Т-27', 7.0],
];
const P_GRADES: [string, number][] = [
  ['П-31', 5.0],
  ['П-32', 6.0],
  ['П-33', 8.0],
  ['П-34', 10.0],
  ['П-35', 12.0],
  ['П-36', 15.0],
  ['П-37', 17.0],
];

/**
 * Arzondan qimmatga tartib: avval 3 qatlam (Т-21…Т-27), keyin 5 qatlam (П-31…П-37), marka bo'yicha.
 * Bir xil markada B (Pack24 asosiy profili, arzonroq) C dan, BE esa BC dan oldin — marka narxga ko'proq ta'sir qiladi.
 * Profil natijada ko'rsatiladi: marka faqat shu profil uchun hisoblangan.
 */
export const CONSTRUCTIONS: Construction[] = [
  ...T_GRADES.flatMap(([grade, ectMin]) =>
    (['B', 'C'] as const).map((flute) => ({ layers: 3 as const, flute, grade, ectMin, thicknessMm: THICKNESS[flute] })),
  ),
  ...P_GRADES.flatMap(([grade, ectMin]) =>
    (['BE', 'BC'] as const).map((flute) => ({ layers: 5 as const, flute, grade, ectMin, thicknessMm: THICKNESS[flute] })),
  ),
];

const round = (v: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};
// Ko'rsatiladigan kerakli ECT yuqoriga yaxlitlanadi: rad etilgan marka minimumiga teng ko'rinmasin
// (toFixed — 3,31·100 = 330,99999… kabi suzuvchi xatoni yuqoriga sakratmaslik uchun)
const ceil2 = (v: number) => Math.ceil(Number((v * 100).toFixed(6))) / 100;

/**
 * Og'irlik bo'yicha minimal marka (GWP tezkor jadvali, SKILL.md 6.2 — taxminiy): taxt yuki kichik bo'lsa ham
 * og'ir quti ko'tarish va zarbaga (burst) bardosh berishi kerak. Juftlikdan yuqorisi olinadi (Т-24/25 → Т-25).
 */
const WEIGHT_FLOOR: Record<3 | 5, [number, number][]> = {
  // [kg gacha, minimal ECT kN/m]
  3: [
    [6, 2.2], // 125K/T → Т-21
    [12, 3.0], // 150K/T → Т-22
    [17, 3.8], // 200K/T → Т-23
    [25, 5.4], // 200K/300T → Т-24/25
    [MAX_3LAYER_KG, 7.0], // 300K/T → Т-26/27
  ],
  5: [
    [15, 5.0], // П-31
    [25, 6.0], // П-32
    [35, 8.0], // П-33
    [Infinity, 10.0], // 35–45 kg → П-34+; 45 dan og'iri — maslahat ('tooHeavy')
  ],
};

/** Og'irlik bo'yicha shu qatlam soni uchun minimal ECT, kN/m; 3 qatlam yaramasa Infinity */
export function minEctByWeight(layers: 3 | 5, weightKg: number): number {
  return WEIGHT_FLOOR[layers].find(([kg]) => weightKg <= kg)?.[1] ?? Infinity;
}

/** Forma qatori → son: vergulli kasr ("12,5") va bo'shliqlar qabul qilinadi, bo'sh qator NaN */
export function parseNum(v: string): number {
  const s = v.trim();
  return s === '' ? Number.NaN : Number(s.replace(',', '.'));
}

/** Kirishni tekshiradi; xato bo'lsa ro'yxat qaytaradi (istisno otmaydi) */
export function validateBox(input: BoxInput): BoxError[] {
  const errors: BoxError[] = [];
  const num = (field: BoxField, v: unknown, min: number, max: number, opts: { integer?: boolean; minExclusive?: boolean } = {}) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return errors.push({ field, code: 'invalid' });
    if (opts.integer && !Number.isInteger(v)) return errors.push({ field, code: 'integer' });
    if ((opts.minExclusive ? v <= min : v < min) || v > max) errors.push({ field, code: 'range' });
  };
  num('length', input.length, LIMITS.dim.min, LIMITS.dim.max);
  num('width', input.width, LIMITS.dim.min, LIMITS.dim.max);
  num('height', input.height, LIMITS.dim.min, LIMITS.dim.max);
  num('weightKg', input.weightKg, LIMITS.weight.min, LIMITS.weight.max, { minExclusive: true });
  num('tiers', input.tiers, LIMITS.tiers.min, LIMITS.tiers.max, { integer: true });
  num('quantity', input.quantity, LIMITS.quantity.min, LIMITS.quantity.max, { integer: true });
  if (input.storage !== 'dry' && input.storage !== 'humid') errors.push({ field: 'storage', code: 'invalid' });
  return errors;
}

/** GOST 9142-2014: pastki qutiga kerakli siqilishga qarshilik, N (n = 1 da 0) */
export function requiredLoadN(weightKg: number, tiers: number, storage: Storage): number {
  const k0 = storage === 'humid' ? K0_HUMID : 1;
  return 9.8 * GOST_K * k0 * weightKg * Math.max(0, tiers - 1);
}

/** McKee perimetri Z = 2(L+W), mm, ichki o'lchamdan (SKILL.md 7.3, mustahkamlik.md 2): tashqidan kichik — ehtiyotkor */
export const perimeter = (l: number, w: number) => 2 * (l + w);

/** Teskari McKee: ECT = BCT / (5,87·√(d·Z)); N va mm → N/mm = kN/m */
export function requiredEctKnM(loadN: number, thicknessMm: number, perimeterMm: number): number {
  return loadN / (MCKEE * Math.sqrt(thicknessMm * perimeterMm));
}

/** FEFCO 0201 zagotovkasi, mm (ichki o'lchamdan) */
export function blank0201(l: number, w: number, h: number, layers: 3 | 5) {
  const a = ALLOWANCE[layers];
  return { lengthMm: 2 * (l + w) + GLUE_FLAP_MM + a.length, widthMm: w + h + a.width };
}

export function calcBox(raw: BoxInput): BoxCalcOutcome {
  const errors = validateBox(raw);
  if (errors.length) return { ok: false, errors };

  const notes: BoxNote[] = [];
  const swapped = raw.width > raw.length;
  // FEFCO 101: L — ochiq tomonning uzunrog'i
  const input: BoxInput = swapped ? { ...raw, length: raw.width, width: raw.length } : { ...raw };
  if (swapped) notes.push('swapped');
  const { length: l, width: w, height: h, weightKg, tiers, storage, quantity } = input;

  const loadN = requiredLoadN(weightKg, tiers, storage);
  if (tiers === 1) notes.push('noStacking');
  if (storage === 'humid') notes.push('humid');
  // 35 kg dan og'irga 3 qatlam minimal markasi Infinity — faqat 5 qatlam qoladi
  if (weightKg > MAX_3LAYER_KG) notes.push('heavy');
  const tooHeavy = weightKg > MAX_TABLE_KG;
  if (tooHeavy) notes.push('tooHeavy');

  const z = perimeter(l, w);
  const ectFor = (c: Construction) => requiredEctKnM(loadN, c.thicknessMm, z);
  // Ikki shart: taxt yuki (McKee) va og'irlik bo'yicha minimal marka (GWP)
  const construction = CONSTRUCTIONS.find((c) => c.ectMin >= ectFor(c) && c.ectMin >= minEctByWeight(c.layers, weightKg)) ?? null;
  // Topilmasa — eng qalin (BC) karton bo'yicha ko'rsatamiz: maslahat uchun eng yaqin variant
  const basis = construction ?? CONSTRUCTIONS[CONSTRUCTIONS.length - 1];
  const d = basis.thicknessMm;

  // McKee cheklovi: balandlik perimetrning 1/7 qismidan kam bo'lsa aniqlik pasayadi
  if (h < z / 7) notes.push('mckeeShort');
  // GOST 9142-2014 nisbat tavsiyalari
  if (l / w > 2.5) notes.push('ratioLW');
  if (h / w < 0.5 || h / w > 2) notes.push('ratioHW');

  const b = blank0201(l, w, h, basis.layers);
  const blank = { lengthMm: round(b.lengthMm, 0), widthMm: round(b.widthMm, 0) };
  // Bitta bo'lakli zagotovka uskunaga sig'masa — marka ko'rsatiladi, lekin menejer ko'radi (ikki bo'lak yoki boshqa uslub)
  const oversize = blank.widthMm > MAX_BLANK_WIDTH_MM || blank.lengthMm > MAX_BLANK_LENGTH_MM;
  if (oversize) notes.push('oversize');
  if (!construction || tooHeavy || oversize) notes.push('consult');
  const area = (b.lengthMm * b.widthMm) / 1_000_000;
  const net = area * quantity;
  // Tashqi: L, W ga 2d, 0201 da H ga ~4d (fefco.md 4-bo'lim, taxmin)
  const outer = { length: round(l + 2 * d, 0), width: round(w + 2 * d, 0), height: round(h + 4 * d, 0) };

  return {
    ok: true,
    result: {
      input,
      construction,
      blank,
      outer,
      areaM2: round(area, 3),
      netAreaM2: round(net, 2),
      totalAreaM2: round(net * (1 + WASTE_PCT / 100), 2),
      wastePct: WASTE_PCT,
      loadN: round(loadN, 0),
      requiredEct: ceil2(ectFor(basis)),
      notes,
    },
  };
}

/** Ariza uchun matn (narxsiz) — tarjima qilingan yorliqlar beriladi */
export type SummaryLabels = {
  title: string;
  size: string;
  /** Birlik yorliq ichida bo'ladi ("…, kg") */
  weight: string;
  tiers: string;
  storage: string;
  storageValue: string;
  quantity: string;
  construction: string;
  /** '{n} qatlamli' kabi shablon */
  layers: string;
  consult: string;
  /** Marka bor, lekin menejer ko'rishi kerak (juda og'ir yoki juda katta) */
  review: string;
  blank: string;
  area: string;
  load: string;
  ect: string;
  units: { mm: string; m2: string; n: string; knm: string };
};

export function boxSummary(r: BoxResult, t: SummaryLabels): string {
  const c = r.construction;
  const { length, width, height, weightKg, tiers, quantity } = r.input;
  const u = t.units;
  // Marka bor, lekin maslahat kerak (juda og'ir yoki katta) — menejer buni ham ko'rsin
  const consultToo = c !== null && r.notes.includes('consult');
  return [
    t.title,
    `${t.size}: ${length} × ${width} × ${height} ${u.mm} (FEFCO 0201)`,
    `${t.weight}: ${weightKg}; ${t.tiers}: ${tiers}; ${t.storage}: ${t.storageValue}`,
    `${t.quantity}: ${quantity}`,
    `${t.construction}: ${c ? `${t.layers.replace('{n}', String(c.layers))}, ${c.flute}, ${c.grade} (ECT ≥ ${c.ectMin} ${u.knm})` : t.consult}`,
    ...(consultToo ? [t.review] : []),
    `${t.blank}: ${r.blank.lengthMm} × ${r.blank.widthMm} ${u.mm}`,
    `${t.area}: ${r.areaM2} ${u.m2} / ${r.totalAreaM2} ${u.m2} (+${r.wastePct} %)`,
    `${t.load}: ${r.loadN} ${u.n}; ${t.ect}: ${r.requiredEct} ${u.knm}`,
  ].join('\n');
}
