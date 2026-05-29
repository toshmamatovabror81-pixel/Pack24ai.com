'use client';

import { useState, useMemo, useEffect } from 'react';
import {
    Calculator, Box, Ruler, Layers, RotateCcw, Package, Palette, FileText,
    type LucideIcon,
} from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import {
    computeBoxMetrics,
    isFlexoQtyValid,
    PAPER_LAYER_PROFILES,
    getPaperLayerProfile,
    type PaperLayerProfileId,
} from '@/lib/domain/boxCalculator';

type PriceEstimate = {
    roundedPrice: number;
    orderUnits: number;
    orderSubtotal: number;
    offsetSetupTotal: number;
    offsetPrintUzs: number;
    offsetDesignUzs: number;
    orderGrandTotal: number;
    qtyValid: boolean;
};

const T: Record<string, Record<string, string>> = {
    title:       { uz: 'Quti kalkulyatori', ru: 'Калькулятор коробки', en: 'Box Calculator' },
    length:      { uz: 'Uzunlik (mm)', ru: 'Длина (мм)', en: 'Length (mm)' },
    width:       { uz: 'Kenglik (mm)', ru: 'Ширина (мм)', en: 'Width (mm)' },
    height:      { uz: 'Balandlik (mm)', ru: 'Высота (мм)', en: 'Height (mm)' },
    volume:      { uz: 'Hajm', ru: 'Объём', en: 'Volume' },
    area:        { uz: 'Yuza (sirt)', ru: 'Площадь', en: 'Surface area' },
    perimeter:   { uz: 'Perimetr', ru: 'Периметр', en: 'Perimeter' },
    sheetSize:   { uz: 'Varaq o\'lchami', ru: 'Размер листа', en: 'Sheet size' },
    result:      { uz: 'Natija', ru: 'Результат', en: 'Result' },
    hint:        { uz: 'O\'lchamlarni kiriting', ru: 'Введите размеры', en: 'Enter dimensions' },
    reset:       { uz: 'Tozalash', ru: 'Сбросить', en: 'Reset' },
    type:        { uz: 'Chop etish turi', ru: 'Тип печати', en: 'Print type' },
    offset:      { uz: 'Ofset (Ofsetniy)', ru: 'Офсет', en: 'Offset' },
    flexo:       { uz: 'Flekso (Fleksografiya)', ru: 'Флексо', en: 'Flexo' },
    paperLayers: { uz: 'Qog\'oz qatlamlari', ru: 'Слои бумаги', en: 'Paper layers' },
    paper:       { uz: 'Qog\'oz turi (liner)', ru: 'Тип бумаги (liner)', en: 'Paper type (liner)' },
    paperWhite:  { uz: 'Oq', ru: 'Белая', en: 'White' },
    paperKraft:  { uz: 'Kraft', ru: 'Крафт', en: 'Kraft' },
    paperPlain:  { uz: 'Oddiy (Prastoy)', ru: 'Простая', en: 'Plain' },
    offsetPaperNote: {
        uz: 'Ofsetda faqat oq liner qo\'llaniladi',
        ru: 'Для офсета только белый liner',
        en: 'Offset printing uses white liner only',
    },
    thickness:   { uz: 'Qalinlik', ru: 'Толщина', en: 'Thickness' },
    needsPrint:  { uz: 'Pechat bo\'ladimi?', ru: 'С печатью?', en: 'With print?' },
    yes:         { uz: 'Ha', ru: 'Да', en: 'Yes' },
    no:          { uz: 'Yo\'q', ru: 'Нет', en: 'No' },
    qty:         { uz: 'Soni (dona)', ru: 'Количество (шт)', en: 'Quantity (pcs)' },
    qtyMinErr:   { uz: 'Eng kamida 1000 dona bo\'lishi kerak', ru: 'Минимум 1000 шт.', en: 'Minimum 1000 pcs required' },
    pricePrint:  { uz: 'Pechat xizmati', ru: 'Услуги печати', en: 'Print service' },
    priceDesign: { uz: 'Dizayner xizmati', ru: 'Услуги дизайнера', en: 'Designer service' },
    priceDie:    { uz: 'Qolip pichog\'i', ru: 'Штанцформа', en: 'Die-cut mold' },
    sepPrice:    { uz: 'Alohida hisoblanadi', ru: 'Считается отдельно', en: 'Calculated separately' },
    pricing:     { uz: 'Taxminiy narx', ru: 'Ориентировочная цена', en: 'Estimated price' },
    salePrice:   { uz: '1 dona narxi', ru: 'Цена за 1 шт.', en: 'Price per unit' },
    saleRounded: { uz: 'Yaxlitlangan', ru: 'Округлено', en: 'Rounded' },
    orderTotal:  { uz: 'Buyurtma jami', ru: 'Итого заказ', en: 'Order total' },
    offsetSetup: { uz: 'Ofset sozlama (1 marta)', ru: 'Настройка офсета (разово)', en: 'Offset setup (one-time)' },
    priceNote:   {
        uz: 'Narx taxminiy. Aniq summa buyurtma berilganda tasdiqlanadi.',
        ru: 'Цена ориентировочная. Точная сумма подтверждается при заказе.',
        en: 'Price is estimated. Final amount confirmed on order.',
    },
};
const t = (key: string, lang: string) => T[key]?.[lang] || T[key]?.uz || '';

export default function BoxCalculator() {
    const { language } = useLanguage();

    const [length, setLength] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [qty, setQty] = useState('');
    const [printType, setPrintType] = useState<'offset' | 'flexo'>('offset');
    const [layerProfile, setLayerProfile] = useState<PaperLayerProfileId>('e-flute');
    const [paper, setPaper] = useState<'white' | 'kraft' | 'plain'>('white');
    const [needsPrint, setNeedsPrint] = useState(true);

    const profile = getPaperLayerProfile(layerProfile);
    const L = parseFloat(length) || 0;
    const W = parseFloat(width) || 0;
    const H = parseFloat(height) || 0;
    const Q = parseInt(qty, 10) || 0;

    const calc = useMemo(() => computeBoxMetrics({ l: L, w: W, h: H }), [L, W, H]);
    const [estimate, setEstimate] = useState<PriceEstimate | null>(null);
    const [priceLoading, setPriceLoading] = useState(false);
    const qtyInvalid = printType === 'flexo' && Q > 0 && !isFlexoQtyValid(Q);

    useEffect(() => {
        if (!calc) {
            setEstimate(null);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setPriceLoading(true);
            try {
                const res = await fetch('/api/box-calculator/estimate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        l: L, w: W, h: H,
                        profileId: layerProfile,
                        printType,
                        needsPrint,
                        qty: Q,
                    }),
                });
                if (res.ok) setEstimate(await res.json());
                else setEstimate(null);
            } catch (e) {
                if ((e as Error).name !== 'AbortError') setEstimate(null);
            } finally {
                if (!controller.signal.aborted) setPriceLoading(false);
            }
        }, 300);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [L, W, H, layerProfile, printType, needsPrint, Q, calc]);

    const selectPrintType = (type: 'offset' | 'flexo') => {
        setPrintType(type);
        if (type === 'offset') setPaper('white');
    };

    const reset = () => {
        setLength('');
        setWidth('');
        setHeight('');
        setQty('');
        setPrintType('offset');
        setLayerProfile('e-flute');
        setPaper('white');
        setNeedsPrint(true);
        setEstimate(null);
    };

    const fmtNum = (n: number) => n.toLocaleString('uz-UZ', { maximumFractionDigits: 2 });
    const fmtMoney = (n: number) => `${Math.round(n).toLocaleString('uz-UZ')} so'm`;
    const profileLabel = profile.label[language as keyof typeof profile.label] || profile.label.uz;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col h-full">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center gap-2">
                <Calculator size={18} className="text-white" />
                <h3 className="text-sm font-bold text-white">{t('title', language)}</h3>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
                {/* Chop etish turi */}
                <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{t('type', language)}</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => selectPrintType('offset')}
                            className={`flex-1 text-xs py-1.5 font-semibold rounded-md transition-all ${printType === 'offset' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t('offset', language)}
                        </button>
                        <button
                            type="button"
                            onClick={() => selectPrintType('flexo')}
                            className={`flex-1 text-xs py-1.5 font-semibold rounded-md transition-all ${printType === 'flexo' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t('flexo', language)}
                        </button>
                    </div>
                </div>

                {/* Qog'oz qatlamlari — o'lchamdan oldin */}
                <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{t('paperLayers', language)}</label>
                    <div className="grid grid-cols-1 gap-1.5">
                        {PAPER_LAYER_PROFILES.map((p) => {
                            const label = p.label[language as keyof typeof p.label] || p.label.uz;
                            return (
                                <SelectBox
                                    key={p.id}
                                    selected={layerProfile === p.id}
                                    onClick={() => setLayerProfile(p.id)}
                                    label={label}
                                    compact
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Qog'oz turi (liner) */}
                <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{t('paper', language)}</label>
                    {printType === 'offset' ? (
                        <div className="space-y-1.5">
                            <div className="py-2 px-3 text-xs font-semibold rounded-lg border bg-indigo-50 border-indigo-200 text-indigo-700">
                                {t('paperWhite', language)}
                            </div>
                            <p className="text-[10px] text-gray-400 leading-snug">{t('offsetPaperNote', language)}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            <SelectBox selected={paper === 'white'} onClick={() => setPaper('white')} label={t('paperWhite', language)} />
                            <SelectBox selected={paper === 'kraft'} onClick={() => setPaper('kraft')} label={t('paperKraft', language)} />
                            <SelectBox selected={paper === 'plain'} onClick={() => setPaper('plain')} label={t('paperPlain', language)} />
                        </div>
                    )}
                </div>

                {printType === 'flexo' && (
                    <>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{t('needsPrint', language)}</label>
                            <div className="grid grid-cols-2 gap-2">
                                <SelectBox selected={needsPrint} onClick={() => setNeedsPrint(true)} label={t('yes', language)} />
                                <SelectBox selected={!needsPrint} onClick={() => setNeedsPrint(false)} label={t('no', language)} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{t('qty', language)}</label>
                            <InputField icon={Package} label={t('qty', language)} value={qty} onChange={setQty} color="text-indigo-500" />
                            {qtyInvalid && (
                                <p className="text-[10px] text-red-500 mt-1 font-medium">{t('qtyMinErr', language)}</p>
                            )}
                        </div>
                    </>
                )}

                {/* O'lchamlar */}
                <div className="space-y-2 pt-1 border-t border-gray-100">
                    <InputField icon={Ruler} label={t('length', language)} value={length} onChange={setLength} color="text-blue-500" />
                    <InputField icon={Ruler} label={t('width', language)} value={width} onChange={setWidth} color="text-emerald-500" />
                    <InputField icon={Ruler} label={t('height', language)} value={height} onChange={setHeight} color="text-amber-500" />
                </div>

                {calc && (
                    <div className="flex justify-center py-2 bg-indigo-50/50 rounded-xl border border-indigo-50">
                        <MiniBoxPreview l={L} w={W} h={H} />
                    </div>
                )}

                {calc && estimate ? (
                    <div className="space-y-2 pt-3 border-t border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t('result', language)}</p>

                        <ResultRow icon={Layers} label={t('paperLayers', language)} value={profileLabel} />
                        <ResultRow icon={Ruler} label={t('thickness', language)} value={`~${profile.thicknessMm} mm`} />
                        <ResultRow icon={Box} label={t('volume', language)} value={`${calc.volumeL.toFixed(2)} L`} />
                        <ResultRow icon={Layers} label={t('area', language)} value={`${fmtNum(calc.surfaceCm2)} cm²`} />
                        <ResultRow icon={Ruler} label={t('perimeter', language)} value={`${fmtNum(calc.perimeter)} mm`} />

                        <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">{t('sheetSize', language)}</p>
                            <p className="text-sm font-extrabold text-indigo-900">
                                {fmtNum(calc.dielineW)} × {fmtNum(calc.dielineL)} mm
                            </p>
                            <p className="text-[11px] text-indigo-500 mt-0.5">{fmtNum(calc.sheetCm2)} cm²</p>
                        </div>

                        <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100">
                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">{t('pricing', language)}</p>
                            <div className="bg-white rounded-lg px-3 py-2 border border-emerald-200">
                                <p className="text-[10px] text-emerald-600 font-bold uppercase">{t('salePrice', language)}</p>
                                <p className="text-lg font-black text-emerald-800">
                                    {priceLoading ? '…' : fmtMoney(estimate.roundedPrice)}
                                </p>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 leading-snug">{t('priceNote', language)}</p>
                        </div>

                        {printType === 'offset' && estimate.offsetSetupTotal > 0 && (
                            <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 space-y-2">
                                <p className="text-[10px] font-bold text-blue-600 uppercase">{t('offsetSetup', language)}</p>
                                <PriceRow label={t('pricePrint', language)} val={fmtMoney(estimate.offsetPrintUzs)} icon={Palette} />
                                <PriceRow label={t('priceDesign', language)} val={fmtMoney(estimate.offsetDesignUzs)} icon={FileText} />
                                <PriceRow label={t('priceDie', language)} val={t('sepPrice', language)} icon={Layers} isWarning />
                            </div>
                        )}

                        {printType === 'flexo' && (
                            <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
                                <PriceRow label={t('priceDie', language)} val={t('sepPrice', language)} icon={Layers} isWarning />
                            </div>
                        )}

                        <div className="bg-gray-900 rounded-xl p-3 text-white">
                            <p className="text-[10px] font-bold uppercase opacity-70">{t('orderTotal', language)}</p>
                            <p className="text-xs opacity-80 mt-1">
                                {estimate.orderUnits.toLocaleString('uz-UZ')} dona × {fmtMoney(estimate.roundedPrice)}
                                {Q > 0 && printType === 'offset' && estimate.offsetSetupTotal > 0
                                    ? ` + ${fmtMoney(estimate.offsetSetupTotal)} (${t('offsetSetup', language)})`
                                    : ''}
                            </p>
                            <p className="text-xl font-black mt-1">
                                {priceLoading ? '…' : fmtMoney(Q > 0 ? estimate.orderGrandTotal : estimate.roundedPrice)}
                            </p>
                        </div>
                    </div>
                ) : calc ? (
                    <p className="text-[10px] text-gray-400 text-center py-2 italic">{priceLoading ? '…' : t('hint', language)}</p>
                ) : (
                    <p className="text-[10px] text-gray-400 text-center py-2 italic">{t('hint', language)}</p>
                )}

                {(calc || Q > 0) && (
                    <button
                        type="button"
                        onClick={reset}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors border-t border-gray-100 mt-2"
                    >
                        <RotateCcw size={12} /> {t('reset', language)}
                    </button>
                )}
            </div>
        </div>
    );
}

function SelectBox({
    selected,
    onClick,
    label,
    compact,
}: {
    selected: boolean;
    onClick: () => void;
    label: string;
    compact?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`${compact ? 'py-2 px-3 text-left w-full' : 'py-1.5 px-2 text-center'} text-xs font-semibold rounded-lg border transition-colors ${
                selected ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
        >
            {label}
        </button>
    );
}

function ResultRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-1 gap-2">
            <span className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                <Icon size={12} /> {label}
            </span>
            <span className="text-xs font-bold text-gray-900 text-right">{value}</span>
        </div>
    );
}

function PriceRow({ label, val, icon: Icon, isWarning }: { label: string; val: string; icon: LucideIcon; isWarning?: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                <Icon size={12} className={isWarning ? 'text-amber-500' : 'text-blue-500'} />
                <span>{label}:</span>
            </div>
            <span className={`text-[11px] font-bold ${isWarning ? 'text-amber-600' : 'text-gray-900'}`}>{val}</span>
        </div>
    );
}

function InputField({ icon: Icon, label, value, onChange, color }: {
    icon: LucideIcon; label: string; value: string; onChange: (v: string) => void; color: string;
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

function MiniBoxPreview({ l, w, h }: { l: number; w: number; h: number }) {
    const max = Math.max(l, w, h, 1);
    const scale = 50 / max;
    const bL = Math.max(l * scale, 8);
    const bW = Math.max(w * scale, 6);
    const bH = Math.max(h * scale, 8);

    return (
        <svg width="100" height="85" viewBox="0 0 120 100" className="text-indigo-500" aria-hidden>
            <rect x={30} y={100 - bH - 5} width={bL} height={bH} fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5" rx="1" />
            <polygon
                points={`${30},${100 - bH - 5} ${30 + bW * 0.6},${100 - bH - 5 - bW * 0.4} ${30 + bL + bW * 0.6},${100 - bH - 5 - bW * 0.4} ${30 + bL},${100 - bH - 5}`}
                fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.5"
            />
            <polygon
                points={`${30 + bL},${100 - bH - 5} ${30 + bL + bW * 0.6},${100 - bH - 5 - bW * 0.4} ${30 + bL + bW * 0.6},${100 - 5 - bW * 0.4} ${30 + bL},${100 - 5}`}
                fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"
            />
            <text x={30 + bL / 2} y={100} fontSize="8" fill="currentColor" textAnchor="middle" fontWeight="bold">{l}</text>
            <text x={30 + bL + bW * 0.35 + 8} y={100 - bH / 2} fontSize="8" fill="currentColor" textAnchor="start" fontWeight="bold">{w}</text>
            <text x={22} y={100 - bH / 2} fontSize="8" fill="currentColor" textAnchor="end" fontWeight="bold">{h}</text>
        </svg>
    );
}
