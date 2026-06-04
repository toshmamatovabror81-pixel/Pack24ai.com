'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Box, Palette, Ruler, Type, RotateCcw, Download } from 'lucide-react';

// Dynamic import to avoid SSR hydration issues with Three.js
const ProductViewer3D = dynamic(() => import('@/components/ProductViewer3D'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500 font-medium">Loading 3D…</span>
        </div>
    ),
});

// ─── i18n ────────────────────────────────────────────────────────
const TX = {
    title: {
        uz: '360° Mahsulot Ko\'rinishi',
        ru: '360° Просмотр Продукта',
        en: '360° Product Preview',
    },
    subtitle: {
        uz: 'Qutingizni 3D formatda real vaqtda ko\'ring va sozlang',
        ru: 'Просмотрите и настройте вашу упаковку в 3D в реальном времени',
        en: 'View and customize your packaging in real-time 3D',
    },
    width: { uz: 'Kenglik (sm)', ru: 'Ширина (см)', en: 'Width (cm)' },
    height: { uz: 'Balandlik (sm)', ru: 'Высота (см)', en: 'Height (cm)' },
    depth: { uz: 'Chuqurlik (sm)', ru: 'Глубина (см)', en: 'Depth (cm)' },
    color: { uz: 'Rang', ru: 'Цвет', en: 'Color' },
    label: { uz: 'Yozuv', ru: 'Надпись', en: 'Label' },
    labelPlaceholder: { uz: 'Brend nomi...', ru: 'Название бренда...', en: 'Brand name...' },
    reset: { uz: 'Qayta tiklash', ru: 'Сбросить', en: 'Reset' },
    copyLink: { uz: 'Havolani nusxalash', ru: 'Скопировать ссылку', en: 'Copy Link' },
    copied: { uz: 'Nusxalandi!', ru: 'Скопировано!', en: 'Copied!' },
    dimensions: { uz: 'O\'lchamlar', ru: 'Размеры', en: 'Dimensions' },
    appearance: { uz: 'Ko\'rinish', ru: 'Внешний вид', en: 'Appearance' },
    dragHint: {
        uz: '🖱 Sichqoncha bilan aylantiring • Scroll bilan kattalashtiring',
        ru: '🖱 Перетащите для вращения • Прокрутите для увеличения',
        en: '🖱 Drag to rotate • Scroll to zoom',
    },
} as const;

type TXKey = keyof typeof TX;

// ─── Color presets ───────────────────────────────────────────────
const COLOR_PRESETS = [
    { name: 'Kraft', hex: '#c29b70' },
    { name: 'White', hex: '#f5f5f0' },
    { name: 'Navy', hex: '#0c2340' },
    { name: 'Green', hex: '#2d7a3a' },
    { name: 'Red', hex: '#e33326' },
    { name: 'Black', hex: '#1a1a1a' },
] as const;

// ─── Defaults ────────────────────────────────────────────────────
const DEFAULTS = {
    width: 30,
    height: 20,
    depth: 15,
    color: '#c29b70',
    label: 'Pack24',
};

// ─── Page Component ─────────────────────────────────────────────
export default function Preview3DPage() {
    const { language } = useLanguage();
    const t = (key: TXKey): string =>
        TX[key][language as keyof (typeof TX)[TXKey]] ?? TX[key].en;

    // State
    const [boxWidth, setBoxWidth] = useState(DEFAULTS.width);
    const [boxHeight, setBoxHeight] = useState(DEFAULTS.height);
    const [boxDepth, setBoxDepth] = useState(DEFAULTS.depth);
    const [boxColor, setBoxColor] = useState(DEFAULTS.color);
    const [boxLabel, setBoxLabel] = useState(DEFAULTS.label);
    const [copied, setCopied] = useState(false);

    const handleReset = useCallback(() => {
        setBoxWidth(DEFAULTS.width);
        setBoxHeight(DEFAULTS.height);
        setBoxDepth(DEFAULTS.depth);
        setBoxColor(DEFAULTS.color);
        setBoxLabel(DEFAULTS.label);
    }, []);

    const handleCopyLink = useCallback(() => {
        const params = new URLSearchParams({
            w: String(boxWidth),
            h: String(boxHeight),
            d: String(boxDepth),
            c: boxColor.replace('#', ''),
            l: boxLabel,
        });
        const url = `${window.location.origin}/tools/3d-preview?${params.toString()}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [boxWidth, boxHeight, boxDepth, boxColor, boxLabel]);

    return (
        <div className="min-h-screen bg-surface-page">
            {/* Hero */}
            <section className="bg-gradient-to-br from-brand-deeper via-[#0f2340] to-[#1a3a60] text-white py-12 sm:py-16">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-semibold text-blue-200 mb-4">
                        <Box size={14} className="text-emerald-400" />
                        360° 3D
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-extrabold mb-3">{t('title')}</h1>
                    <p className="text-blue-100/80 max-w-xl mx-auto">{t('subtitle')}</p>
                </div>
            </section>

            {/* Main content */}
            <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
                    {/* 3D Viewer */}
                    <Card className="overflow-hidden !p-0">
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 relative" style={{ minHeight: 500 }}>
                            <ProductViewer3D
                                color={boxColor}
                                label={boxLabel}
                                dimensions={{ width: boxWidth, height: boxHeight, depth: boxDepth }}
                            />
                        </div>
                        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs text-gray-400">{t('dragHint')}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold uppercase tracking-wider">
                                3D Preview
                            </span>
                        </div>
                    </Card>

                    {/* Controls Panel */}
                    <div className="flex flex-col gap-4">
                        {/* Dimensions */}
                        <Card>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                    <Ruler size={16} className="text-blue-600" />
                                </div>
                                <h3 className="font-bold text-gray-900">{t('dimensions')}</h3>
                            </div>

                            <div className="space-y-4">
                                <SliderControl
                                    label={t('width')}
                                    value={boxWidth}
                                    min={10}
                                    max={100}
                                    onChange={setBoxWidth}
                                    unit="sm"
                                />
                                <SliderControl
                                    label={t('height')}
                                    value={boxHeight}
                                    min={10}
                                    max={100}
                                    onChange={setBoxHeight}
                                    unit="sm"
                                />
                                <SliderControl
                                    label={t('depth')}
                                    value={boxDepth}
                                    min={5}
                                    max={50}
                                    onChange={setBoxDepth}
                                    unit="sm"
                                />
                            </div>
                        </Card>

                        {/* Appearance */}
                        <Card>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                                    <Palette size={16} className="text-purple-600" />
                                </div>
                                <h3 className="font-bold text-gray-900">{t('appearance')}</h3>
                            </div>

                            {/* Color presets */}
                            <label className="block text-sm font-medium text-gray-600 mb-2">{t('color')}</label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {COLOR_PRESETS.map((preset) => (
                                    <button
                                        key={preset.hex}
                                        onClick={() => setBoxColor(preset.hex)}
                                        className={`w-9 h-9 rounded-lg border-2 transition-all hover:scale-110 ${
                                            boxColor === preset.hex
                                                ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
                                                : 'border-gray-200'
                                        }`}
                                        style={{ backgroundColor: preset.hex }}
                                        title={preset.name}
                                    />
                                ))}
                                {/* Custom color input */}
                                <label className="w-9 h-9 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors overflow-hidden relative">
                                    <Palette size={14} className="text-gray-400" />
                                    <input
                                        type="color"
                                        value={boxColor}
                                        onChange={(e) => setBoxColor(e.target.value)}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                </label>
                            </div>

                            {/* Hex input */}
                            <Input
                                value={boxColor}
                                onChange={(e) => setBoxColor(e.target.value)}
                                placeholder="#c29b70"
                                className="mb-4 font-mono text-sm"
                            />

                            {/* Label */}
                            <label className="block text-sm font-medium text-gray-600 mb-2">
                                <Type size={14} className="inline mr-1 -mt-0.5" />
                                {t('label')}
                            </label>
                            <Input
                                value={boxLabel}
                                onChange={(e) => setBoxLabel(e.target.value)}
                                placeholder={t('labelPlaceholder')}
                                maxLength={30}
                            />
                        </Card>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                onClick={handleReset}
                                className="flex-1"
                            >
                                <RotateCcw size={14} className="mr-2" />
                                {t('reset')}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleCopyLink}
                                className="flex-1"
                            >
                                <Download size={14} className="mr-2" />
                                {copied ? t('copied') : t('copyLink')}
                            </Button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

// ─── Slider Control ─────────────────────────────────────────────
function SliderControl({
    label,
    value,
    min,
    max,
    onChange,
    unit,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
    unit: string;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-600">{label}</span>
                <span className="text-sm font-bold text-gray-900 tabular-nums">
                    {value} {unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
            />
        </div>
    );
}
