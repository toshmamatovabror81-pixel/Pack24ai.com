'use client';

import { useState, useMemo } from 'react';
import { Calculator, Box, Ruler, Layers, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';

/* ═══════════════════════════════════════════════════════════════════════════
   i18n
   ═══════════════════════════════════════════════════════════════════════════ */
const T: Record<string, Record<string, string>> = {
    title:       { uz: 'Quti kalkulyatori', ru: 'Калькулятор коробки', en: 'Box Calculator' },
    length:      { uz: 'Uzunlik (mm)', ru: 'Длина (мм)', en: 'Length (mm)' },
    width:       { uz: 'Kenglik (mm)', ru: 'Ширина (мм)', en: 'Width (mm)' },
    height:      { uz: 'Balandlik (mm)', ru: 'Высота (мм)', en: 'Height (mm)' },
    volume:      { uz: 'Hajm', ru: 'Объём', en: 'Volume' },
    area:        { uz: 'Yuza (sirt)', ru: 'Площадь', en: 'Surface area' },
    dieline:     { uz: 'Dieline o\'lchami', ru: 'Размер развёртки', en: 'Dieline size' },
    material:    { uz: 'Material', ru: 'Материал', en: 'Material' },
    reset:       { uz: 'Tozalash', ru: 'Сбросить', en: 'Reset' },
    result:      { uz: 'Natija', ru: 'Результат', en: 'Result' },
    hint:        { uz: 'O\'lchamlarni kiriting', ru: 'Введите размеры', en: 'Enter dimensions' },
    sheetSize:   { uz: 'Varaq o\'lchami', ru: 'Размер листа', en: 'Sheet size' },
    perimeter:   { uz: 'Perimetr', ru: 'Периметр', en: 'Perimeter' },
};
const t = (key: string, lang: string) => T[key]?.[lang] || T[key]?.uz || '';

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function BoxCalculator() {
    const { language } = useLanguage();
    const [length, setLength] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');

    const L = parseFloat(length) || 0;
    const W = parseFloat(width) || 0;
    const H = parseFloat(height) || 0;
    const hasInput = L > 0 && W > 0 && H > 0;

    const calc = useMemo(() => {
        if (!hasInput) return null;

        // Surface area (6 yuz) = 2(LW + LH + WH)
        const surfaceArea = 2 * (L * W + L * H + W * H);
        // Volume = L × W × H
        const volume = L * W * H;
        // Dieline flat sheet — tuck end box uchun taxminiy
        // Kenglik: W + H + W + H + 15mm (yopish qismi)
        // Uzunlik: L + H + H + 20mm (tutqich/qopqoq)
        const dielineW = W + H + W + H + 15;
        const dielineL = L + H + H + 20;
        const sheetArea = dielineW * dielineL;
        // Perimeter
        const perimeter = 4 * (L + W + H);

        return {
            volume,
            volumeL: volume / 1e6, // litr
            surfaceArea,
            surfaceCm2: surfaceArea / 100,
            dielineW,
            dielineL,
            sheetArea,
            sheetCm2: sheetArea / 100,
            perimeter,
        };
    }, [L, W, H, hasInput]);

    const reset = () => { setLength(''); setWidth(''); setHeight(''); };

    const fmt = (n: number) => {
        if (n >= 1e6) return `${(n / 1e6).toFixed(2)} L`;
        if (n >= 1e4) return n.toLocaleString('uz-UZ', { maximumFractionDigits: 0 });
        return n.toLocaleString('uz-UZ', { maximumFractionDigits: 1 });
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center gap-2">
                <Calculator size={18} className="text-white" />
                <h3 className="text-sm font-bold text-white">{t('title', language)}</h3>
            </div>

            {/* Inputs */}
            <div className="p-4 space-y-3">
                <InputField icon={Ruler} label={t('length', language)} value={length} onChange={setLength} color="text-blue-500" />
                <InputField icon={Ruler} label={t('width', language)} value={width} onChange={setWidth} color="text-emerald-500" />
                <InputField icon={Ruler} label={t('height', language)} value={height} onChange={setHeight} color="text-amber-500" />

                {/* Mini 3D box preview */}
                {hasInput && (
                    <div className="flex justify-center py-2">
                        <MiniBoxPreview l={L} w={W} h={H} />
                    </div>
                )}

                {/* Results */}
                {calc ? (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('result', language)}</p>

                        <ResultRow icon={Box} label={t('volume', language)} value={`${fmt(calc.volume)} mm³`} sub={`${calc.volumeL.toFixed(2)} L`} />
                        <ResultRow icon={Layers} label={t('area', language)} value={`${fmt(calc.surfaceCm2)} cm²`} />
                        <ResultRow icon={Ruler} label={t('perimeter', language)} value={`${fmt(calc.perimeter)} mm`} />

                        <div className="bg-indigo-50 rounded-xl p-3 mt-2">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">{t('sheetSize', language)}</p>
                            <p className="text-sm font-extrabold text-indigo-900">
                                {fmt(calc.dielineW)} × {fmt(calc.dielineL)} mm
                            </p>
                            <p className="text-[11px] text-indigo-500 mt-0.5">{fmt(calc.sheetCm2)} cm²</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-gray-400 text-center py-3 italic">{t('hint', language)}</p>
                )}

                {/* Reset */}
                {hasInput && (
                    <button onClick={reset} className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 py-2 transition-colors">
                        <RotateCcw size={12} /> {t('reset', language)}
                    </button>
                )}
            </div>
        </div>
    );
}

/* ── Input field ── */
function InputField({ icon: Icon, label, value, onChange, color }: {
    icon: typeof Ruler; label: string; value: string; onChange: (v: string) => void; color: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <Icon size={14} className={color} />
            <div className="flex-1 relative">
                <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    placeholder={label}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
            </div>
        </div>
    );
}

/* ── Result row ── */
function ResultRow({ icon: Icon, label, value, sub }: {
    icon: typeof Box; label: string; value: string; sub?: string;
}) {
    return (
        <div className="flex items-center justify-between py-1">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Icon size={12} /> {label}
            </span>
            <div className="text-right">
                <span className="text-xs font-bold text-gray-900">{value}</span>
                {sub && <span className="text-[10px] text-gray-400 ml-1">({sub})</span>}
            </div>
        </div>
    );
}

/* ── Mini isometric box preview ── */
function MiniBoxPreview({ l, w, h }: { l: number; w: number; h: number }) {
    const max = Math.max(l, w, h, 1);
    const scale = 60 / max;
    const bL = Math.max(l * scale, 8);
    const bW = Math.max(w * scale, 6);
    const bH = Math.max(h * scale, 8);

    return (
        <svg width="120" height="100" viewBox="0 0 120 100" className="text-indigo-500">
            {/* Front face */}
            <rect x={30} y={100 - bH - 5} width={bL} height={bH} fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5" rx="1" />
            {/* Top face (parallelogram) */}
            <polygon
                points={`${30},${100 - bH - 5} ${30 + bW * 0.6},${100 - bH - 5 - bW * 0.4} ${30 + bL + bW * 0.6},${100 - bH - 5 - bW * 0.4} ${30 + bL},${100 - bH - 5}`}
                fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.5"
            />
            {/* Right face (parallelogram) */}
            <polygon
                points={`${30 + bL},${100 - bH - 5} ${30 + bL + bW * 0.6},${100 - bH - 5 - bW * 0.4} ${30 + bL + bW * 0.6},${100 - 5 - bW * 0.4} ${30 + bL},${100 - 5}`}
                fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"
            />
            {/* Labels */}
            <text x={30 + bL / 2} y={100} fontSize="8" fill="currentColor" textAnchor="middle" fontWeight="bold">{l}</text>
            <text x={30 + bL + bW * 0.35 + 8} y={100 - bH / 2} fontSize="8" fill="currentColor" textAnchor="start" fontWeight="bold">{w}</text>
            <text x={22} y={100 - bH / 2} fontSize="8" fill="currentColor" textAnchor="end" fontWeight="bold">{h}</text>
        </svg>
    );
}
