'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Calculator, Send } from 'lucide-react';
import { LIMITS, boxSummary, calcBox, parseNum, type BoxError, type BoxField, type BoxNote, type Storage } from '@/lib/boxCalc';
import type { Dict } from '@/lib/i18n/dict/uz';
import { prefillLeadForm } from '../forms/leadPrefill';
import { track } from './track';

type Labels = Dict['calc'];
type NumField = Exclude<BoxField, 'storage'>;

// Intl server va brauzerda turlicha bo'shliq berishi mumkin (gidratsiya farqi) — o'zimiz formatlaymiz
function fmt(n: number, en: boolean): string {
  const [int, frac] = String(n).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, en ? ',' : ' ');
  return frac ? `${grouped}${en ? '.' : ','}${frac}` : grouped;
}

const LIMIT_OF: Record<NumField, { min: number; max: number }> = {
  length: LIMITS.dim,
  width: LIMITS.dim,
  height: LIMITS.dim,
  weightKg: LIMITS.weight,
  tiers: LIMITS.tiers,
  quantity: LIMITS.quantity,
};

export function BoxCalculator({ labels: t, locale }: { labels: Labels; locale: string }) {
  const en = locale === 'en';
  const u = t.units;
  const uid = useId();
  // Kiritish matn sifatida saqlanadi — foydalanuvchi bo'sh qoldirishi yoki vergul yozishi mumkin
  const [values, setValues] = useState<Record<NumField, string>>({ length: '400', width: '300', height: '300', weightKg: '10', tiers: '5', quantity: '1000' });
  const [storage, setStorage] = useState<Storage>('dry');

  const outcome = useMemo(
    () =>
      calcBox({
        length: parseNum(values.length),
        width: parseNum(values.width),
        height: parseNum(values.height),
        weightKg: parseNum(values.weightKg),
        tiers: parseNum(values.tiers, { integer: true }),
        quantity: parseNum(values.quantity, { integer: true }),
        storage,
      }),
    [values, storage],
  );

  const errorOf = (field: NumField): BoxError | undefined => (outcome.ok ? undefined : outcome.errors.find((e) => e.field === field));
  const errorText = (field: NumField, e: BoxError) => {
    if (e.code !== 'range') return t.errors[e.code];
    const max = fmt(LIMIT_OF[field].max, en);
    // Og'irlik 0 dan qat'iy katta bo'lishi kerak — "0 dan" degan matn 0 ni to'g'ri qilib ko'rsatardi
    if (field === 'weightKg') return t.errors.positive.replace('{max}', max);
    return t.errors.range.replace('{min}', fmt(LIMIT_OF[field].min, en)).replace('{max}', max);
  };

  const field = (name: NumField, label: string, opts: { integer?: boolean } = {}) => {
    const id = `${uid}-${name}`;
    const err = errorOf(name);
    return (
      <div key={name}>
        <label htmlFor={id} className="label">{label}</label>
        {/* type="text": type="number" da brauzer "12,5" ni bo'sh qatorga aylantiradi — vergulni parseNum o'zi o'qiydi */}
        <input
          id={id}
          type="text"
          inputMode={opts.integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          pattern={opts.integer ? '[0-9]*' : '[0-9]*[.,]?[0-9]*'}
          value={values[name]}
          onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-err` : undefined}
          className={`input ${err ? 'border-accent-500' : ''}`}
        />
        {err && <p id={`${id}-err`} className="mt-1 text-xs text-accent-600">{errorText(name, err)}</p>}
      </div>
    );
  };

  const r = outcome.ok ? outcome.result : null;
  const c = r?.construction ?? null;
  const consult = r?.notes.includes('consult') ?? false;
  const notes = (r?.notes ?? []).filter((n): n is Exclude<BoxNote, 'consult'> => n !== 'consult');
  const headline = c ? `${t.layers.replace('{n}', String(c.layers))}, ${c.flute} ${t.flute}, ${c.grade}` : '';

  // Ekran o'quvchiga faqat qisqa xulosa, yozish to'xtagach (~0,5 s) — har tugmada butun blok o'qilmasin
  const announceText = !r ? t.fix : c ? (consult ? `${headline}. ${t.review}` : headline) : t.consult;
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setAnnounce(announceText), 500);
    return () => clearTimeout(timer);
  }, [announceText]);

  const apply = () => {
    if (!r) return;
    const summary = boxSummary(r, {
      title: t.summaryTitle,
      size: t.size,
      weight: t.weight,
      tiers: t.tiers,
      storage: t.storage,
      storageValue: storage === 'humid' ? t.humid : t.dry,
      quantity: t.quantity,
      construction: t.construction,
      layers: t.layers,
      consult: t.consult,
      review: t.review,
      blank: t.blank,
      area: `${t.area} / ${t.total}`,
      load: t.load,
      ect: t.ect,
      units: u,
    });
    prefillLeadForm({
      type: 'custom_box',
      fields: { size: `${r.input.length} x ${r.input.width} x ${r.input.height} ${u.mm}`, quantity: String(r.input.quantity), message: summary },
    });
    track('box_calc_apply', { grade: c && !consult ? c.grade : 'consult' });
  };

  return (
    <section aria-labelledby={`${uid}-title`} className="card mt-6 p-6">
      <h2 id={`${uid}-title`} className="flex items-center gap-2 text-xl font-bold text-slate-900">
        <Calculator className="h-5 w-5 text-brand-500" aria-hidden />
        {t.title}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{t.intro}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {field('length', t.length)}
        {field('width', t.width)}
        {field('height', t.height)}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {field('weightKg', t.weight)}
        {field('tiers', t.tiers, { integer: true })}
        {field('quantity', t.quantity, { integer: true })}
      </div>
      <fieldset className="mt-4">
        <legend className="label">{t.storage}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['dry', 'humid'] as const).map((s) => (
            <label key={s} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${storage === s ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}>
              <input type="radio" name={`${uid}-storage`} checked={storage === s} onChange={() => setStorage(s)} />
              {s === 'dry' ? t.dry : t.humid}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>
      <div className="mt-6 rounded-xl bg-slate-50 p-4 sm:p-5">
        <h3 className="font-semibold text-slate-900">{t.result}</h3>
        {!r ? (
          <p className="mt-2 text-sm text-slate-600">{t.fix}</p>
        ) : (
          <>
            {c && (
              <p className="mt-2 text-lg font-bold text-brand-600">
                {headline}
                <span className="ml-1 text-sm font-normal text-slate-600">(ECT ≥ {fmt(c.ectMin, en)} {u.knm})</span>
              </p>
            )}
            {consult && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{c ? t.review : t.consult}</p>}
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t.blank}</dt><dd className="whitespace-nowrap text-right font-medium">{fmt(r.blank.lengthMm, en)} × {fmt(r.blank.widthMm, en)} {u.mm}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t.outer}</dt><dd className="whitespace-nowrap text-right font-medium">{r.outer.length} × {r.outer.width} × {r.outer.height} {u.mm}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t.area}</dt><dd className="whitespace-nowrap text-right font-medium">{fmt(r.areaM2, en)} {u.m2}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t.total}</dt><dd className="text-right font-medium"><span className="whitespace-nowrap">{fmt(r.totalAreaM2, en)} {u.m2}</span> <span className="whitespace-nowrap font-normal text-slate-500">({t.waste} {r.wastePct} %)</span></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t.load}</dt><dd className="whitespace-nowrap text-right font-medium">{fmt(r.loadN, en)} {u.n}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t.ect}</dt><dd className="whitespace-nowrap text-right font-medium">{fmt(r.requiredEct, en)} {u.knm}</dd></div>
            </dl>
            {notes.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">
                {notes.map((n) => <li key={n}>{t.notes[n]}</li>)}
              </ul>
            )}
          </>
        )}
        <p className="mt-3 text-xs font-medium text-slate-700">{t.caveat}</p>
      </div>

      <button type="button" onClick={apply} disabled={!r} className="btn-accent mt-4 w-full sm:w-auto">
        <Send className="h-4 w-4" aria-hidden />
        {t.apply}
      </button>
    </section>
  );
}
