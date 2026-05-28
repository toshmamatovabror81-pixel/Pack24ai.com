'use client';

import { useState, useMemo } from 'react';
import { Calculator, Box, Ruler, Layers, RotateCcw, Package, Palette, FileText, Info } from 'lucide-react';
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
    result:      { uz: 'Natija', ru: 'Результат', en: 'Result' },
    hint:        { uz: 'O\'lchamlarni kiriting', ru: 'Введите размеры', en: 'Enter dimensions' },
    reset:       { uz: 'Tozalash', ru: 'Сбросить', en: 'Reset' },
    
    // Yangi qo'shimchalar
    type:        { uz: 'Chop etish turi', ru: 'Тип печати', en: 'Print type' },
    offset:      { uz: 'Ofset (Ofsetniy)', ru: 'Офсет', en: 'Offset' },
    flexo:       { uz: 'Flekso (Fleksografiya)', ru: 'Флексо', en: 'Flexo' },
    
    layers:      { uz: 'Gofra qavati', ru: 'Слои гофры', en: 'Corrugated layers' },
    layer3:      { uz: '3 qavatli', ru: '3-слойная', en: '3 layers' },
    layer5:      { uz: '5 qavatli', ru: '5-слойная', en: '5 layers' },
    
    paper:       { uz: 'Qog\'oz turi', ru: 'Тип бумаги', en: 'Paper type' },
    paperWhite:  { uz: 'Oq (Faqat oq)', ru: 'Белая (Только белая)', en: 'White (Only white)' },
    paperWhiteF: { uz: 'Oq', ru: 'Белая', en: 'White' },
    paperKraft:  { uz: 'Kraft', ru: 'Крафт', en: 'Kraft' },
    paperPlain:  { uz: 'Oddiy (Prastoy)', ru: 'Простая', en: 'Plain' },
    
    needsPrint:  { uz: 'Pechat bo\'ladimi?', ru: 'С печатью?', en: 'With print?' },
    yes:         { uz: 'Ha', ru: 'Да', en: 'Yes' },
    no:          { uz: 'Yo\'q', ru: 'Нет', en: 'No' },
    
    qty:         { uz: 'Soni (dona)', ru: 'Количество (шт)', en: 'Quantity (pcs)' },
    qtyMinErr:   { uz: 'Eng kamida 1000 dona bo\'lishi kerak', ru: 'Минимум 1000 шт.', en: 'Minimum 1000 pcs required' },
    
    pricePrint:  { uz: 'Pechat xizmati', ru: 'Услуги печати', en: 'Print service' },
    priceDesign: { uz: 'Dizayner xizmati', ru: 'Услуги дизайнера', en: 'Designer service' },
    priceDie:    { uz: 'Qolip pichog\'i', ru: 'Штанцформа', en: 'Die-cut mold' },
    sepPrice:    { uz: 'Alohida hisoblanadi', ru: 'Считается отдельно', en: 'Calculated separately' },
};
const t = (key: string, lang: string) => T[key]?.[lang] || T[key]?.uz || '';

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function BoxCalculator() {
    const { language } = useLanguage();
    
    // Asosiy o'lchamlar
    const [length, setLength] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [qty, setQty] = useState('');

    // Yangi variantlar
    const [printType, setPrintType] = useState<'offset' | 'flexo'>('offset');
    const [layers, setLayers] = useState<'3' | '5'>('3');
    const [paper, setPaper] = useState<'white' | 'kraft' | 'plain'>('white');
    const [needsPrint, setNeedsPrint] = useState<boolean>(true);

    const L = parseFloat(length) || 0;
    const W = parseFloat(width) || 0;
    const H = parseFloat(height) || 0;
    const Q = parseInt(qty) || 0;
    const hasInput = L > 0 && W > 0 && H > 0;

    // Offset tanlanganda paper albatta Oq bo'ladi
    if (printType === 'offset' && paper !== 'white') {
        setPaper('white');
    }

    const calc = useMemo(() => {
        if (!hasInput) return null;
        const volume = L * W * H;
        return { volume, volumeL: volume / 1e6 };
    }, [L, W, H, hasInput]);

    const reset = () => { 
        setLength(''); setWidth(''); setHeight(''); setQty('');
        setPrintType('offset'); setLayers('3'); setPaper('white'); setNeedsPrint(true);
    };

    const fmtNum = (n: number) => n.toLocaleString('uz-UZ');

    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col h-full">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center gap-2">
                <Calculator size={18} className="text-white" />
                <h3 className="text-sm font-bold text-white">{t('title', language)}</h3>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
                
                {/* ── Type Selection ── */}
                <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{t('type', language)}</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button 
                            onClick={() => { setPrintType('offset'); setPaper('white'); }}
                            className={`flex-1 text-xs py-1.5 font-semibold rounded-md transition-all ${printType === 'offset' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t('offset', language)}
                        </button>
                        <button 
                            onClick={() => setPrintType('flexo')}
                            className={`flex-1 text-xs py-1.5 font-semibold rounded-md transition-all ${printType === 'flexo' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t('flexo', language)}
                        </button>
                    </div>
                </div>

                {/* ── Dimensions ── */}
                <div className="space-y-2">
                    <InputField icon={Ruler} label={t('length', language)} value={length} onChange={setLength} color="text-blue-500" />
                    <InputField icon={Ruler} label={t('width', language)} value={width} onChange={setWidth} color="text-emerald-500" />
                    <InputField icon={Ruler} label={t('height', language)} value={height} onChange={setHeight} color="text-amber-500" />
                </div>

                {/* ── Mini 3D box preview ── */}
                {hasInput && (
                    <div className="flex justify-center py-2 bg-indigo-50/50 rounded-xl border border-indigo-50">
                        <MiniBoxPreview l={L} w={W} h={H} />
                    </div>
                )}

                {/* ── Configuration ── */}
                <div className="space-y-3 pt-1">
                    {/* Layers */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{t('layers', language)}</label>
                        <div className="grid grid-cols-2 gap-2">
                            <SelectBox selected={layers === '3'} onClick={() => setLayers('3')} label={t('layer3', language)} />
                            <SelectBox selected={layers === '5'} onClick={() => setLayers('5')} label={t('layer5', language)} />
                        </div>
                    </div>

                    {/* Paper */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{t('paper', language)}</label>
                        {printType === 'offset' ? (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500 font-medium cursor-not-allowed">
                                {t('paperWhite', language)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                <SelectBox selected={paper === 'white'} onClick={() => setPaper('white')} label={t('paperWhiteF', language)} />
                                <SelectBox selected={paper === 'kraft'} onClick={() => setPaper('kraft')} label={t('paperKraft', language)} />
                                <SelectBox selected={paper === 'plain'} onClick={() => setPaper('plain')} label={t('paperPlain', language)} />
                            </div>
                        )}
                    </div>

                    {/* Print Toggle (Flexo only) */}
                    {printType === 'flexo' && (
                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{t('needsPrint', language)}</label>
                            <div className="grid grid-cols-2 gap-2">
                                <SelectBox selected={needsPrint === true} onClick={() => setNeedsPrint(true)} label={t('yes', language)} />
                                <SelectBox selected={needsPrint === false} onClick={() => setNeedsPrint(false)} label={t('no', language)} />
                            </div>
                        </div>
                    )}

                    {/* Quantity */}
                    {printType === 'flexo' && (
                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{t('qty', language)}</label>
                            <div className="relative">
                                <InputField icon={Package} label={t('qty', language)} value={qty} onChange={setQty} color="text-indigo-500" />
                                {Q > 0 && Q < 1000 && (
                                    <p className="text-[10px] text-red-500 mt-1 font-medium">{t('qtyMinErr', language)}</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Results & Pricing Info ── */}
                {calc && (
                    <div className="space-y-2 pt-3 border-t border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t('result', language)}</p>

                        {/* Volume stat */}
                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg mb-3">
                            <span className="text-xs text-gray-500 font-medium">{t('volume', language)}</span>
                            <span className="text-xs font-bold text-gray-900">{calc.volumeL.toFixed(2)} L</span>
                        </div>

                        {/* Fixed Pricing Display */}
                        {printType === 'offset' ? (
                            <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 space-y-2">
                                <PriceRow label={t('pricePrint', language)} val="450 000 UZS" icon={Palette} />
                                <PriceRow label={t('priceDesign', language)} val="450 000 UZS" icon={FileText} />
                                <PriceRow label={t('priceDie', language)} val={t('sepPrice', language)} icon={Layers} isWarning />
                            </div>
                        ) : (
                            <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100 space-y-2">
                                {needsPrint && <PriceRow label={t('pricePrint', language)} val={t('sepPrice', language)} icon={Palette} isWarning />}
                                <PriceRow label={t('priceDie', language)} val={t('sepPrice', language)} icon={Layers} isWarning />
                            </div>
                        )}
                    </div>
                )}

                {!calc && (
                    <p className="text-[10px] text-gray-400 text-center py-2 italic">{t('hint', language)}</p>
                )}

                {/* Reset */}
                {(hasInput || Q > 0) && (
                    <button onClick={reset} className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors border-t border-gray-100 mt-2">
                        <RotateCcw size={12} /> {t('reset', language)}
                    </button>
                )}
            </div>
        </div>
    );
}

/* ── UI Helpers ── */

function SelectBox({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-colors ${
                selected ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
        >
            {label}
        </button>
    );
}

function PriceRow({ label, val, icon: Icon, isWarning }: { label: string; val: string; icon: any; isWarning?: boolean }) {
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
    icon: any; label: string; value: string; onChange: (v: string) => void; color: string;
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

/* ── Mini isometric box preview ── */
function MiniBoxPreview({ l, w, h }: { l: number; w: number; h: number }) {
    const max = Math.max(l, w, h, 1);
    const scale = 50 / max;
    const bL = Math.max(l * scale, 8);
    const bW = Math.max(w * scale, 6);
    const bH = Math.max(h * scale, 8);

    return (
        <svg width="100" height="85" viewBox="0 0 120 100" className="text-indigo-500">
            {/* Front face */}
            <rect x={30} y={100 - bH - 5} width={bL} height={bH} fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5" rx="1" />
            {/* Top face */}
            <polygon
                points={`${30},${100 - bH - 5} ${30 + bW * 0.6},${100 - bH - 5 - bW * 0.4} ${30 + bL + bW * 0.6},${100 - bH - 5 - bW * 0.4} ${30 + bL},${100 - bH - 5}`}
                fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.5"
            />
            {/* Right face */}
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
