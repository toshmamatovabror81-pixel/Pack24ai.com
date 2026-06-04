'use client';

import React, { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';
import {
    Camera, Box, Palette, Type, Download,
    RotateCcw, X, Maximize2, ChevronUp, ChevronDown,
    ArrowLeft, Info,
} from 'lucide-react';

const ARPreview = dynamic(() => import('@/components/ARPreview'), { ssr: false });

// ─── i18n ────────────────────────────────────────────────────────
const TX = {
    title:        { uz: 'AR Quti Preview',       ru: 'AR Просмотр коробки',    en: 'AR Box Preview' },
    subtitle:     { uz: 'Kamerani qutiga qarating va joylashuvni tanlang', ru: 'Наведите камеру и выберите расположение', en: 'Point your camera and choose placement' },
    width:        { uz: 'Kenglik',                ru: 'Ширина',                  en: 'Width' },
    height:       { uz: 'Balandlik',              ru: 'Высота',                  en: 'Height' },
    depth_label:  { uz: 'Chuqurlik',              ru: 'Глубина',                 en: 'Depth' },
    color:        { uz: 'Rang',                   ru: 'Цвет',                    en: 'Color' },
    label:        { uz: 'Yozuv',                  ru: 'Надпись',                 en: 'Label' },
    label_ph:     { uz: 'Brend nomi...',          ru: 'Название бренда...',      en: 'Brand name...' },
    rotate:       { uz: 'Aylantirish',            ru: 'Вращение',               en: 'Rotate' },
    capture:      { uz: 'Skrinshot olish',        ru: 'Сделать скриншот',        en: 'Capture Screenshot' },
    captured:     { uz: 'Saqlandi!',              ru: 'Сохранено!',              en: 'Captured!' },
    controls:     { uz: 'Sozlamalar',             ru: 'Настройки',               en: 'Controls' },
    back:         { uz: 'Orqaga',                 ru: 'Назад',                   en: 'Back' },
    info_banner:  { uz: 'Kamerani qutiga qarating va joylashuvni tanlang', ru: 'Наведите камеру на объект и выберите расположение', en: 'Point your camera at the target and choose placement' },
    drag_hint:    { uz: 'Qutini surish uchun bosing va torting', ru: 'Нажмите и перетащите для перемещения', en: 'Press and drag to move the box' },
    beta:         { uz: 'BETA',                   ru: 'БЕТА',                    en: 'BETA' },
} as const;

type TxKey = keyof typeof TX;

const COLOR_PRESETS = [
    { name: 'Blue',   hex: '#3b82f6' },
    { name: 'Red',    hex: '#ef4444' },
    { name: 'Green',  hex: '#22c55e' },
    { name: 'Purple', hex: '#a855f7' },
    { name: 'Orange', hex: '#f97316' },
    { name: 'Navy',   hex: '#0c2340' },
    { name: 'Pink',   hex: '#ec4899' },
    { name: 'Teal',   hex: '#14b8a6' },
];

// ─── Page ────────────────────────────────────────────────────────
export default function ARPreviewPage() {
    const { language } = useLanguage();
    const t = (key: TxKey): string => TX[key][language as 'uz' | 'ru' | 'en'] ?? TX[key].en;

    // Box config
    const [boxWidth, setBoxWidth] = useState(120);
    const [boxHeight, setBoxHeight] = useState(120);
    const [boxDepth, setBoxDepth] = useState(120);
    const [boxColor, setBoxColor] = useState('#3b82f6');
    const [boxLabel, setBoxLabel] = useState('');
    const [rotating, setRotating] = useState(true);

    // UI state
    const [panelOpen, setPanelOpen] = useState(true);
    const [showCaptured, setShowCaptured] = useState(false);
    const arRef = useRef<HTMLDivElement>(null);

    // Screenshot handler
    const handleScreenshot = useCallback((dataUrl: string) => {
        const link = document.createElement('a');
        link.download = `ar-preview-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        setShowCaptured(true);
        setTimeout(() => setShowCaptured(false), 2000);
    }, []);

    const triggerCapture = useCallback(() => {
        const el = arRef.current?.querySelector('[data-ar-container]') as HTMLDivElement & { capture?: () => void } | null;
        // Access the capture function exposed by ARPreview's container
        if (el && typeof el.capture === 'function') {
            el.capture();
            return;
        }
        // Fallback: find the AR component's container and call capture
        const container = arRef.current?.querySelector('.relative.w-full.h-full') as HTMLDivElement & { capture?: () => void } | null;
        if (container && typeof container.capture === 'function') {
            container.capture();
        }
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
            {/* ── Top bar ── */}
            <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/60 to-transparent">
                <Link
                    href="/tools"
                    className="flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium transition-colors"
                >
                    <ArrowLeft size={18} />
                    <span className="hidden sm:inline">{t('back')}</span>
                </Link>

                <div className="flex items-center gap-2">
                    <Box size={18} className="text-white/80" />
                    <h1 className="text-white font-bold text-sm sm:text-base">{t('title')}</h1>
                    <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t('beta')}</span>
                </div>

                <button
                    onClick={() => setPanelOpen(!panelOpen)}
                    className="text-white/80 hover:text-white transition-colors"
                    aria-label="Toggle controls"
                >
                    {panelOpen ? <X size={20} /> : <Maximize2 size={20} />}
                </button>
            </div>

            {/* ── Info banner ── */}
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 max-w-xs text-center">
                <Info size={12} className="shrink-0" />
                <span>{t('drag_hint')}</span>
            </div>

            {/* ── AR camera view ── */}
            <div ref={arRef} className="flex-1 relative">
                <ARPreview
                    width={boxWidth}
                    height={boxHeight}
                    depth={boxDepth}
                    color={boxColor}
                    label={boxLabel}
                    rotating={rotating}
                    onScreenshot={handleScreenshot}
                />
            </div>

            {/* ── Captured toast ── */}
            {showCaptured && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg animate-bounce">
                    ✓ {t('captured')}
                </div>
            )}

            {/* ── Bottom controls panel ── */}
            <div
                className={`absolute bottom-0 left-0 right-0 z-30 transition-transform duration-300 ${
                    panelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-40px)]'
                }`}
            >
                {/* Toggle handle */}
                <button
                    onClick={() => setPanelOpen(!panelOpen)}
                    className="w-full flex justify-center py-1.5 bg-white/10 backdrop-blur-md rounded-t-2xl border-t border-white/10"
                >
                    <div className="flex items-center gap-1 text-white/70 text-xs font-medium">
                        {panelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        {t('controls')}
                    </div>
                </button>

                <div className="bg-white/95 backdrop-blur-xl px-4 py-4 max-h-[45vh] overflow-y-auto">
                    {/* ── Dimensions ── */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <DimInput icon="W" label={t('width')} value={boxWidth} onChange={setBoxWidth} />
                        <DimInput icon="H" label={t('height')} value={boxHeight} onChange={setBoxHeight} />
                        <DimInput icon="D" label={t('depth_label')} value={boxDepth} onChange={setBoxDepth} />
                    </div>

                    {/* ── Color presets ── */}
                    <div className="mb-4">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Palette size={14} className="text-gray-500" />
                            <span className="text-xs font-semibold text-gray-600">{t('color')}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {COLOR_PRESETS.map((c) => (
                                <button
                                    key={c.hex}
                                    onClick={() => setBoxColor(c.hex)}
                                    className={`w-8 h-8 rounded-xl transition-all ${
                                        boxColor === c.hex
                                            ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                                            : 'hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: c.hex }}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* ── Label ── */}
                    <div className="mb-4">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Type size={14} className="text-gray-500" />
                            <span className="text-xs font-semibold text-gray-600">{t('label')}</span>
                        </div>
                        <input
                            type="text"
                            value={boxLabel}
                            onChange={(e) => setBoxLabel(e.target.value)}
                            placeholder={t('label_ph')}
                            maxLength={30}
                            className="w-full h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-colors"
                        />
                    </div>

                    {/* ── Actions row ── */}
                    <div className="flex items-center gap-3">
                        <Button
                            variant={rotating ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setRotating(!rotating)}
                            className="gap-1.5"
                        >
                            <RotateCcw size={14} />
                            {t('rotate')}
                        </Button>

                        <Button
                            variant="primary"
                            size="sm"
                            onClick={triggerCapture}
                            className="flex-1 gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
                        >
                            <Camera size={14} />
                            {t('capture')}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={triggerCapture}
                            title={t('capture')}
                        >
                            <Download size={16} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Dimension Input ─────────────────────────────────────────────
function DimInput({
    icon,
    label,
    value,
    onChange,
}: {
    icon: string;
    label: string;
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1 block">{label}</label>
            <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 w-5 h-5 rounded flex items-center justify-center">
                    {icon}
                </span>
                <input
                    type="number"
                    min={20}
                    max={400}
                    value={value}
                    onChange={(e) => onChange(Math.max(20, Math.min(400, Number(e.target.value) || 20)))}
                    className="w-full h-8 px-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                />
            </div>
        </div>
    );
}
